# Mochi Help app
# Copyright Alistair Cunningham 2025-2026

# Canonical Mochi entities on the public Mochi instance.
USERS_FORUM = "126YM4PAEioT47rkAionhLKowZw6kWugijf9AAF6jFtxwRbo1Mo"
DEV_PROJECT = "1KEog9eeM2F4VFkz76FCSgKo8nf7ENyoX3aRjUKzL9wfDsDRSE"

# The Mochi development project uses one ticket class with a `category`
# field whose options include `bug` and `feature`. Help posts a ticket in
# that class and sets the category to mark it as a bug or feature request.
DEV_TICKET_CLASS = "ticket"

VALID_KINDS = ["intro", "question", "bug", "feature"]

# Length limits roughly mirror forums: 500 char title, 50000 char body.
TITLE_MAX = 500
BODY_MAX = 50000
BODY_MIN = 1

def action_visit(a):
	if not a.user or not a.user.identity:
		a.error.label(401, "errors.not_logged_in")
		return
	a.user.preference.set("help.visited", "true")
	return {"data": {"visited": True}}

def action_prepare(a):
	if not a.user or not a.user.identity:
		a.error.label(401, "errors.not_logged_in")
		return

	kind = a.input("kind")
	if kind not in VALID_KINDS:
		a.error.label(400, "errors.invalid_kind")
		return

	target = _target_for_kind(kind)
	if not target:
		a.error.label(503, "errors.help_not_configured")
		return

	result = mochi.remote.request(
		a.user.identity.id,
		target["service"],
		"app/subscribe",
		{target["entity_field"]: target["entity_id"]},
	)
	if result and result.get("error"):
		_surface_remote_error(a, result)
		return

	return {"data": result or {}}

def action_contribute(a):
	if not a.user or not a.user.identity:
		a.error.label(401, "errors.not_logged_in")
		return

	kind = a.input("kind")
	if kind not in VALID_KINDS:
		a.error.label(400, "errors.invalid_kind")
		return

	body = (a.input("body", "") or "").strip()
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

	if kind in ("intro", "question"):
		title = _intro_or_question_title(a.user, kind)
		event = "app/post"
		payload = {
			"forum": target["entity_id"],
			"title": title,
			"body": body,
		}
	else:
		title = (a.input("title", "") or "").strip()
		if not title:
			a.error.label(400, "errors.title_is_required")
			return
		if len(title) > TITLE_MAX:
			a.error.label(400, "errors.title_too_long")
			return
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
		_surface_remote_error(a, result)
		return

	fingerprint = result.get("fingerprint") if result else ""
	if not fingerprint:
		a.error.label(502, "errors.no_fingerprint_returned")
		return

	if target["service"] == "forums":
		redirect = "/forums/" + fingerprint + "/"
		post_id = result.get("post", "") if result else ""
		if post_id:
			redirect = "/forums/" + fingerprint + "/-/" + post_id
	else:
		redirect = "/projects/" + fingerprint + "/"
		obj_id = result.get("id", "") if result else ""
		if obj_id:
			redirect = "/projects/" + fingerprint + "/" + obj_id

	return {"data": {"redirect": redirect}}

def _target_for_kind(kind):
	if kind in ("intro", "question"):
		if not USERS_FORUM:
			return None
		return {"service": "forums", "entity_id": USERS_FORUM, "entity_field": "forum"}
	if kind in ("bug", "feature"):
		if not DEV_PROJECT:
			return None
		return {"service": "projects", "entity_id": DEV_PROJECT, "entity_field": "project"}
	return None

def _intro_or_question_title(user, kind):
	name = user.identity.name or mochi.app.label("titles.someone")
	if kind == "intro":
		return mochi.app.label("titles.intro", name=name)
	return mochi.app.label("titles.question", name=name)

# Translate remote error keys (e.g. "errors.invalid_id") through the app's
# label catalog before surfacing to the user. Falls back to the literal key.
def _surface_remote_error(a, result):
	code = result.get("code", 502)
	err = result.get("error", "")
	if err.startswith("errors."):
		a.error.label(code, err)
	else:
		a.error(code, err or "Remote request failed")
