# ITCH-PAGE — GAME_NAME

The itch.io page, authored here and pasted into itch's editor at release. itch's
description field accepts a subset of HTML; everything else is page metadata you
set in the dashboard. **Every claim here passes the release gate** — every claim
fact-checked, nothing oversold. See `RELEASE-CHECKLIST.md`.

---

## Metadata (set in the itch dashboard)

- **Title:** GAME_NAME
- **Short description / tagline:** TAGLINE — one line, **hard limit 120 characters**;
  over it, itch rejects the entire form and discards every other edit in that save.
  Shown in search and under the title. No hype it can't back up.
- **Classification:** Game
- **Kind of project:** HTML — "This file will be played in the browser"
- **Pricing:** free / paid ($X) / "no payment, donations allowed" — decide and note why
- **Uploads:** zip of the game (index.html at the zip root); mark it "play in browser"
  — and mark it again after *every* build replacement, which silently clears the flag
  and turns the page into a download (see `PUBLISHING-RUNBOOK.md`)
- **Embed:** viewport WIDTHxHEIGHT (match the canvas), fullscreen button on,
  mobile-friendly if it is
- **Genre:** GENRE
- **Tags (≤ 10):** tag, tag, tag — real genre/mechanic tags players search, not filler
- **Platforms:** HTML5 (add downloadable builds only if they exist)
- **Input:** keyboard / mouse / touch — whatever is true
- **Accessibility / languages:** colorblind notes, subtitles, LANGS — if true
- **Average session:** e.g. "A few minutes"
- **Links:** source (github.com/kleer001/GAME_REPO), landing (promo.html), socials

---

## Cover & media

- **Cover image:** 630×500 px (itch's recommended). One clear, readable frame.
- **Screenshots:** 3–5, from `docs/img/`. Show the actual game, not staged mockups.
- **Trailer (optional):** 20–60s. itch takes a hosted **link**, not a file, so the
  video has to be up on YouTube/Vimeo before this field can be filled.

---

## Description (paste into itch's rich-text editor)

> TAGLINE

LEDE — two or three sentences: the fantasy and the core loop, in the player's
words. What they do, and why they start again.

**What you do**

- PILLAR ONE — one specific, true thing the player does.
- PILLAR TWO — another concrete draw.
- PILLAR THREE — the hook that brings them back.

**Controls**

- KEY — action
- KEY — action

**Notes**

- Runs in the browser; ADVISORY (e.g. headphones recommended) if any.
- Built with vanilla JS, no engine. Source is open (MIT): github.com/kleer001/GAME_REPO
- CREDITS — any borrowed assets, fonts, or libraries, with links and licenses.

---

## Pre-publish checks (part of the release gate)

Mechanics of the dashboard itself — how a save can silently revert fields, how to
verify a release server-side — live in `PUBLISHING-RUNBOOK.md`. Read it before the
first publish and before every update.

- [ ] Tagline and every bullet is literally true
- [ ] No superlatives the game can't earn — no "best," "revolutionary"
- [ ] Tags are ones the genre's players actually search
- [ ] Screenshots are from the real build
- [ ] Credits and licenses complete for all borrowed work
- [ ] The uploaded build runs from a fresh unzip
