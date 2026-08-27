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
	# mochi.remote.request returns the far end's decoded JSON as-is, so a
	# destination answering with an array or a bare string yields a truthy
	# non-dict and every .get below aborts the action - a 500 instead of the
	# inline message this handler exists to produce. Only core's own failure
	# paths are guaranteed dicts.
	if type(result) != "dict":
		return {"data": {
			"available": False,
			"message": mochi.app.label("errors.remote_failed"),
		}}

	# Return availability information instead of throwing so the dialog can
	# explain problems inline before the user spends time writing a full post.
	if result.get("error"):
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
	# Same as action_prepare: the response is the far end's decoded JSON, and a
	# non-dict makes every .get below abort rather than refuse cleanly.
	if type(result) != "dict":
		a.error.label(502, "errors.remote_failed")
		return

	if result.get("error"):
		code = result.get("code", 502)
		# Surface timeout/connectivity failures as 503 with a specific label so
		# the frontend can show "service unavailable" rather than a generic error.
		if code == 504:
			a.error.label(503, "errors.service_unavailable")
			return
		_surface_remote_error(a, result)
		return

	fingerprint = result.get("fingerprint")
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
		obj_id = result.get("id", "")
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

# Which label key to show for a remote failure, or the generic one.
#
# The prefix test alone did not do what the old comment claimed. resolve_label
# returns the key ITSELF when this app's catalogue has no entry, so any string
# beginning "errors." was echoed to the user unchanged - and the destinations
# send keys from their own namespaces, most of which are not in ours, so raw
# tokens like "errors.object_not_found" were reaching the browser in ordinary
# operation, not just under a hostile peer.
#
# Three gates. The type test because mochi.text.valid raises on a non-string
# rather than returning False, which turned a handled remote error into a 500.
# "constant" bounds the value to 100 characters of a safe charset, so unbounded
# remote text cannot reach the user or the label-miss log line. And resolving it
# and comparing is the allowlist: if the answer is the key we passed in, we have
# no translation, so say something the reader can actually use instead.
def _remote_error_key(result):
	err = result.get("error", "")
	if type(err) != "string" or not mochi.text.valid(err, "constant"):
		return "errors.remote_failed"
	if not err.startswith("errors."):
		return "errors.remote_failed"
	if mochi.app.label(err) == err:
		return "errors.remote_failed"
	return err

def _surface_remote_error(a, result):
	code = result.get("code", 502)
	# The code is remote-supplied: clamp it to 4xx/5xx so a destination cannot make
	# help answer with a success or redirect. JSON decoding yields floats for
	# integers, so truncate first.
	if type(code) == "float":
		code = int(code)
	if type(code) != "int" or code < 400 or code > 599:
		code = 502
	a.error.label(code, _remote_error_key(result))

def _remote_error_message(result):
	return mochi.app.label(_remote_error_key(result))
