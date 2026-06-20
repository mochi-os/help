# Mochi Help app
# Copyright © 2026 Mochi OÜ
# SPDX-License-Identifier: AGPL-3.0-only
# This file is part of Mochi, licensed under the GNU AGPL v3 with the
# Mochi Application Interface Exception - see license.txt and license-exception.md.

# Fallback entity IDs used when no server setting overrides them.
# On a self-hosted instance, configure help_users_forum and help_dev_project
# in Settings (Admin → Settings) to point at local forum/project entities.
USERS_FORUM = "126YM4PAEioT47rkAionhLKowZw6kWugijf9AAF6jFtxwRbo1Mo"
DEV_PROJECT = "1KEog9eeM2F4VFkz76FCSgKo8nf7ENyoX3aRjUKzL9wfDsDRSE"

# The Mochi development project uses one ticket class with a `category`
# field whose options include `bug` and `feature`. Help posts a ticket in
# that class and sets the category to mark it as a bug or feature request.
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
	a.user.preference.set("help.visited", "true")
	return {"data": {"visited": True}}

# Serve one of the server-level documents (rules / terms / privacy) so the
# footer in help's SPA can render them without linking cross-app to /settings/
# (CLAUDE.md: an app must call its own actions for the data it displays).
# Uses a.json() rather than `return {"data": …}` because DocumentPage in
# lib/web reads `res.data.html` directly without unwrapping a data envelope.
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

	result = mochi.remote.request(
		a.user.identity.id,
		target["service"],
		"app/subscribe",
		{target["entity_field"]: target["entity_id"]},
	)
	# prepare is a non-destructive preflight. Return availability information
	# instead of throwing so the dialog can explain problems inline before the
	# user spends time writing a full post.
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
		# Mint the post id here so the forum-side handler dedups
		# correctly under any future multi-host fan-out (today the
		# call uses mochi.remote.request which is single-fire, so
		# the id is a single source). Convention from the cross-app
		# event-atomicity audit (task #43): callers carry event
		# identity, receivers never mint.
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

	# Project tickets must have a valid fingerprint to build the redirect URL
	# (the ticket page won't load without it). Forum posts (intro/question)
	# show an in-app success state in the client so the redirect is only used
	# for the optional "Go to forum" link — fall back to the forum root if
	# the fingerprint is missing or invalid.
	if kind in ("bug", "feature"):
		if not fingerprint:
			a.error.label(502, "errors.no_fingerprint_returned")
			return

	# SPA URLs use /<app>/<fingerprint>/<id> — bare; `/<app>/<fingerprint>/-/<id>`
	# is the JSON action route and would render raw JSON in the browser.
	# Forum posts land on the forum page (pending-moderation posts can't be
	# read by the author until approved, so the post page is a dead end);
	# project tickets land on the ticket itself (they're visible immediately).
	if target["service"] == "forums":
		redirect = ("/forums/" + fingerprint + "/") if fingerprint else "/forums/"
	else:
		# Defence-in-depth: the project owner is hardcoded to a trusted
		# entity, but we still validate the returned object id before
		# substituting it into a URL — a malformed value would render an
		# unloadable page; an attacker-controlled value (if the trust
		# boundary ever moves) could embed path traversal or query-string
		# noise. Fall back to the project root when invalid.
		obj_id = result.get("id", "") if result else ""
		if obj_id and not mochi.text.valid(obj_id, "id"):
			obj_id = ""
		redirect = "/projects/" + fingerprint + "/" + obj_id

	return {"data": {"redirect": redirect}}

def _target_for_kind(kind):
	users_forum = mochi.setting.get("help_users_forum") or USERS_FORUM
	dev_project = mochi.setting.get("help_dev_project") or DEV_PROJECT
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
