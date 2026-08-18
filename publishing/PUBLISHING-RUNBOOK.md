# PUBLISHING-RUNBOOK

How the publishing surfaces actually behave. `ITCH-PAGE.md` and `MARKETING-PLAN.md`
cover *what to write*; this covers *what the tools do with it*, including the ways
they lose work silently.

Nothing here is discoverable from the dashboards. Every item is a failure mode that
reports success.

---

Every section asserting how an outside service behaves carries an **Observed:** date — when the
claim was last checked against the live service. A platform claim with no date cannot be told
apart from a belief a year later. Re-check before a release and move the date forward, whether
the claim held or not.

## Order of operations

1. **Page copy first**, while the build is still cooking — the description is the
   part visitors read before pressing anything, and it is usually the part left
   empty longest.
2. **Build second.** Package, then verify the archive before uploading.
3. **Host the trailer third.** itch's trailer field takes a *link*, not a file, so
   the video must exist on YouTube/Vimeo before the field can be filled. The
   footage comes from `capture.sh` and is cut by `post.sh`, against the plan in
   `video_shot_list.md`. Note that `capture.sh` opens a visible browser window
   and records the desktop's audio, so a run owns the machine until it finishes.
4. **Wire the trailer last**, as its own save.

Each step gets an independent verification that does not trust the UI's success
message. See *Verify server-side* below.

---

## itch.io — the edit form

**Observed:** 2026-08-05

**Saving rewrites every field, not just the one you changed.** The form posts the
whole record from whatever the loaded page contained. A page that comes up with a
stale or empty field writes that emptiness back over good data, and the save still
returns `{"success":true}`. Changing one field can silently revert the description
and tagline.

> Before saving, confirm the fields you are *not* editing still hold what you
> expect. Checking only after the save catches the damage but does not prevent it.

**One invalid field rejects the entire form.** Validation is all-or-nothing. An
over-length tagline returns

```
short_text: expected text between 1 and 120 characters, or empty
```

and discards every other edit in the same save. The symptom is misleading: the
field you were actually editing appears to have refused to take, while the real
culprit is a field you did not touch.

**The tagline limit is a hard 120 characters**, not a guideline. Count before
pasting.

**The description is a rich-text editor over a hidden textarea.** The posted value
is the textarea; the visible editor syncs into it. Writing one without the other
loses the edit.

**Screenshot deletion is confirm-dialog gated.** Automation that dismisses dialogs
by default will click Delete and change nothing, with no error.

---

## itch.io — replacing a build (every update after the first)

**Observed:** 2026-08-05

Uploading a zip **with the same filename replaces the existing upload in place** —
one row, but a new upload id. Two consequences that bite every time:

1. **The swap happens on upload, not on Save.** The live game changes the moment
   the file finishes transferring. There is no staged state to review.
2. **The replacement arrives as `type=default`**, losing the browser-playable flag.
   Until "This file will be played in the browser" is re-ticked and saved, the page
   offers a download instead of a game.

So a routine build update briefly breaks the page unless the re-tick follows
immediately. Plan for it; verify after.

---

## itch.io — verify server-side

**Observed:** 2026-08-05

The dashboard is not evidence. itch exposes a read-only API that is:

```sh
# game id, tagline, published state
curl -sS "https://itch.io/api/1/$KEY/my-games"

# uploads: id, filename, size, type, storage
curl -sS "https://itch.io/api/1/$KEY/game/$GAME_ID/uploads"
```

Two checks that actually prove a release:

- **`type` must be `html`.** Anything else means the page is serving a download.
- **`size` must equal the local archive's byte count.** This is the only proof that
  the build people can play is the build that was packaged.

The key comes from `itch.io/user/settings/api-keys`. Treat it as a secret: read it
into an environment variable, never echo it, and never put it in a URL that gets
logged.

---

## itch.io — butler, and when it is worth it

**Observed:** 2026-08-05

`butler` is itch's CLI uploader. Install:

```sh
curl -sSL -o butler.zip "https://broth.itch.zone/butler/linux-amd64/LATEST/archive/default"
```

Authenticate with `butler login` (writes `~/.config/itch/butler_creds`) or set
`BUTLER_API_KEY` for unattended use.

What it does **not** do: page furniture. Description, tagline, screenshots, cover
and trailer have no public API and no butler command. Those are dashboard-only.

A first push creates a **new channel**. Per itch's docs, *"Tagging a channel as
'HTML5 / Playable in browser' needs to be done from the itch.io Edit game page,
once the first build is pushed."* That tagging pass is what a game whose Kind is
not yet HTML needs; on a game already set to HTML, a first pushed build comes back
`type=html` with no dashboard interaction.

**Choosing:** replacing the file in the dashboard is the smallest change for a
one-off update, but it does **not** preserve the existing upload's flags — the
replacement is a new upload id arriving as `type=default`, so the browser-playable
tick has to be re-set and saved after every such replacement (see *replacing a
build* above). `butler push` skips that step entirely on a game already tagged
HTML. butler costs one extra setup pass now and makes every later update a single
unattended command. Take butler if the game will ship more than once.

---

## YouTube — the trailer

**Observed:** 2026-08-05

**Test & Compare** runs up to **3 variants**, as title-only, thumbnail-only, or
title-and-thumbnail. Two things follow from how it scores:

- It judges on **watch time per impression, not click-through**. A variant that
  wins the click and loses the viewer correctly loses. This is why an engagement
  outro tacked onto a short trailer is a net negative — it costs watch time at the
  exact moment the video should end.
- It runs **up to 14 days**. At low view volume, expect inconclusive results and do
  not read noise as a winner.

Requirements: desktop YouTube Studio, **Advanced Features** enabled (phone + ID
verification), long-form only. Shorts are not eligible.

**Write three titles that test different hypotheses**, not three rewordings — e.g.
genre-anchored, mechanic-as-provocation, creator-voice. Front-load the payload
inside ~60 characters, where browse and search truncate. Keep the game's name in
every variant so a hook is never bought with discoverability.

**Thumbnails are 16:9 at 1280×720, cap 2 MB.** A 4:3 game pillarboxes and loses
roughly a quarter of the usable area. Cropping to 16:9 recovers it but usually eats
the bottom band, which is where burned-in captions and the HUD live. Decide
deliberately rather than letting the encoder choose.

Aspect ratio also decides the upload type: a 4:3 or wider cut uploads as a normal
video regardless of length, while a 9:16 cut becomes a Short — and Shorts cannot be
A/B tested. Cut verticals for feeds, not for the trailer slot.

**Put the engagement prompt in the pinned comment, not the video.** It costs nothing
in watch time and nothing in tone. Ground it in something specific and true about
the game; a real detail invites real answers, where a generic question invites none.

---

## Pre-publish checks

- **The fullscreen key check.** In the itch embed, press the fullscreen button, then try the
  arrow keys. The failure exists only inside the embed and no local build reproduces it.

- [ ] Tagline ≤ 120 characters, counted
- [ ] Archive has `index.html` at its root, no absolute asset paths, under itch's
      1000-file limit
- [ ] Uploaded build's API `type` is `html` and `size` matches the local archive
- [ ] The live page loads and the game actually runs — play it, don't infer it
- [ ] Description, tagline and screenshots all still correct *after* the last save
- [ ] Trailer hosted and its link wired into the page
