# Mochi Help app
# Copyright © 2026 Mochisoft OÜ
# SPDX-License-Identifier: AGPL-3.0-only
# This file is part of Mochi, licensed under the GNU AGPL v3 with the
# Mochi Application Interface Exception - see license.txt and license-exception.md.

# Destination entities for help submissions. A self-hosted instance that wants
# its own forum and project edits these.
USERS_FORUM = "12tnp9sacfPZq6DE8dsgHM4kLsosFEwCUPqWuJmuJuEkdjwXm5z"
DEV_PROJECT = "1MwcNqrNbsayEbZDAvVEN6gzEhfLyY8tvV8Mowjo9nn3tkLoKU"

# The development project's ticket class; its `category` field takes `bug` or
# `feature`.
DEV_TICKET_CLASS = "ticket"

VALID_KINDS = ["intro", "question", "bug", "feature"]

# Length limits roughly mirror forums: 500 char title, 50000 char body.
# BODY_MIN of 20 chars stops one-letter "x" posts while still letting short
# bug reports through; the help SPA enforces the same minimum client-side.
TITLE_MAX = 500
BODY_MAX = 50000
BODY_MIN = 20

def action_visit(a):
	if not a.user:
		a.error.label(401, "errors.not_logged_in")
		return
	# The SPA calls this on every Help mount, but only the first visit changes
	# anything (home.star checks != "true"), so skip the versioned preference
	# write once it holds — the get reads the request's in-memory map for free.
	if a.user.preference.get("help.visited") != "true":
		a.user.preference.set("help.visited", "true")
	return {"data": {"visited": True}}

# Serve a server document for the SPA footer. Uses a.json() rather than a data
# envelope: DocumentPage in lib/web reads `res.data.html` directly.
def action_document_get(a):
	name = a.input("name", "")
	if name not in ("rules", "terms", "privacy"):
		a.error.label(404, "errors.unknown_document")
		return
	body = mochi.document.get(name)
	html = mochi.text.markdown(body)
	a.json({"name": name, "body": body, "html": html})

def action_prepare(a):
	if not a.user:
		a.error.label(401, "errors.not_logged_in")
		return

	kind = a.input("kind")
	if kind not in VALID_KINDS:
		a.error.label(400, "errors.invalid_kind")
		return

	target = _target_for_kind(kind)
	if not target:
		return {"data": {
			"available": False,
			"message": mochi.app.label("errors.help_not_configured"),
		}}

	# app/check is read-only: the subscription happens on submission, so a
	# cancelled dialog leaves no trace.
	result = mochi.remote.request(
		a.user.identity.id,
		target["service"],
		"app/check",
		{target["entity_field"]: target["entity_id"]},
	)
	# Return availability information instead of throwing so the dialog can
	# explain problems inline before the user spends time writing a full post.
	if result and result.get("error"):
		code = result.get("code", 502)
		message = (
			mochi.app.label("errors.service_unavailable")
			if code == 504
			else _remote_error_message(result)
		)
		return {"data": {
			"available": False,
			"message": message,
		}}

	if not result:
		return {"data": {
			"available": False,
			"message": mochi.app.label("errors.remote_failed"),
		}}

	# Whitelist only the fields the dialog consumes rather than spreading the
	# whole remote reply through to the browser.
	data = {"available": True}
	if "fingerprint" in result:
		data["fingerprint"] = result["fingerprint"]
	if "already_subscribed" in result:
		data["already_subscribed"] = result["already_subscribed"]
	return {"data": data}

def action_contribute(a):
	if not a.user:
		a.error.label(401, "errors.not_logged_in")
		return

	kind = a.input("kind")
	if kind not in VALID_KINDS:
		a.error.label(400, "errors.invalid_kind")
		return

	body = a.input("body", "").strip()
	if len(body) < BODY_MIN:
		a.error.label(400, "errors.body_is_required")
		return
	if len(body) > BODY_MAX:
		a.error.label(400, "errors.body_too_long")
		return

	target = _target_for_kind(kind)
	if not target:
		a.error.label(503, "errors.help_not_configured")
		return

	if kind == "intro":
		title = _intro_title(a.user)
	else:
		title = a.input("title", "").strip()
		if not title:
			a.error.label(400, "errors.title_is_required")
			return
		if len(title) > TITLE_MAX:
			a.error.label(400, "errors.title_too_long")
			return

	if kind in ("intro", "question"):
		event = "app/post"
		# Callers mint the post id; receivers never do, so a retried or fanned-out
		# delivery dedups.
		payload = {
			"id": mochi.uid(),
			"forum": target["entity_id"],
			"title": title,
			"body": body,
			# Tag the post so the forum's filter-by-tag UI can group
			# help-app submissions. Tags are stored lowercase by
			# validate_tag(), so use lowercase here for round-trip equality.
			"tags": ["introduction" if kind == "intro" else "question"],
		}
	else:
		event = "app/object/create"
		payload = {
			"project": target["entity_id"],
			"class": DEV_TICKET_CLASS,
			"title": title,
			"body": body,
			"values": {"category": kind},
		}

	result = mochi.remote.request(
		a.user.identity.id,
		target["service"],
		event,
		payload,
	)
	if result and result.get("error"):
		code = result.get("code", 502)
		# Surface timeout/connectivity failures as 503 with a specific label so
		# the frontend can show "service unavailable" rather than a generic error.
		if code == 504:
			a.error.label(503, "errors.service_unavailable")
			return
		_surface_remote_error(a, result)
		return

	# If the remote call returned nothing at all, treat as a hard failure.
	if not result:
		a.error.label(502, "errors.remote_failed")
		return

	fingerprint = result.get("fingerprint") if result else ""
	# Validate the fingerprint when present.
	if fingerprint and not mochi.text.valid(fingerprint, "fingerprint"):
		fingerprint = ""

	# Tickets need the fingerprint for their redirect; forum posts only use it for
	# the optional "Go to forum" link, so fall back to the forum root.
	if kind in ("bug", "feature"):
		if not fingerprint:
			a.error.label(502, "errors.no_fingerprint_returned")
			return
		# An empty comment id means the ticket landed without its description; log it
		# rather than fail a ticket that exists.
		if not result.get("comment"):
			mochi.log.debug("help: ticket " + result.get("id", "") + " created without its description comment")

	# SPA URLs are /<app>/<fingerprint>/<id> (the -/ form is the JSON route). Forum
	# posts land on the forum: a pending-moderation post page is unreadable by its
	# author.
	if target["service"] == "forums":
		redirect = ("/forums/" + fingerprint + "/") if fingerprint else "/forums/"
	else:
		# Validate the returned object id before placing it in a URL; fall back to the
		# project root.
		obj_id = result.get("id", "") if result else ""
		if obj_id and not mochi.text.valid(obj_id, "id"):
			obj_id = ""
		redirect = "/projects/" + fingerprint + "/" + obj_id

	return {"data": {"redirect": redirect}}

def _target_for_kind(kind):
	users_forum = USERS_FORUM
	dev_project = DEV_PROJECT
	if kind in ("intro", "question"):
		if not users_forum:
			return None
		return {"service": "forums", "entity_id": users_forum, "entity_field": "forum"}
	if kind in ("bug", "feature"):
		if not dev_project:
			return None
		return {"service": "projects", "entity_id": dev_project, "entity_field": "project"}
	return None

def _intro_title(user):
	name = user.identity.name or mochi.app.label("titles.someone")
	return mochi.app.label("titles.intro", name=name)

# Translate remote error keys (e.g. "errors.invalid_id") through the app's
# label catalog before surfacing to the user. Non-prefixed remote errors are
# replaced with a generic translated message — we don't pass arbitrary
# remote-supplied text through to the user-facing error body.
def _surface_remote_error(a, result):
	code = result.get("code", 502)
	# The code is remote-supplied: clamp it to 4xx/5xx so a destination cannot make
	# help answer with a success or redirect. JSON decoding yields floats for
	# integers, so truncate first.
	if type(code) == "float":
		code = int(code)
	if type(code) != "int" or code < 400 or code > 599:
		code = 502
	err = result.get("error", "")
	if err.startswith("errors."):
		a.error.label(code, err)
	else:
		a.error.label(code, "errors.remote_failed")

def _remote_error_message(result):
	err = result.get("error", "")
	if err.startswith("errors."):
		return mochi.app.label(err)
	return mochi.app.label("errors.remote_failed")
