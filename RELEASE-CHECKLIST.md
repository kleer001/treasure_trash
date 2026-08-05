# RELEASE-CHECKLIST — Treasure Trash 🔒

**The one hard stop.** No itch.io page goes live, no GitHub release is cut, no build
reaches a player until this list is worked. See `CLAUDE.md` → "The release gate."

This is the studio's only binding document. Everything on it is something a player
or a reader would catch: a build that won't run from a fresh clone, a page that
oversells, a fabricated historical claim. It applies once — at ship — and it has no
opinion about how the game got built.

## Not yet

**This file is post-beta.** Past the prototype, past alpha, past beta — a
content-complete game with no known blockers, that someone who isn't you has
played. Until then it is closed:

- **Don't open it during the build.** Not to plan against, not to pre-tick, not to
  "get ahead of." A checklist consulted early stops being a ship gate and turns into
  a second spec sheet.
- **Don't let it shape what gets built.** Nothing on this list is a feature, and no
  item here is a reason to build or not build anything.
- **Don't track partial progress.** The boxes get ticked in one pass, on a finished
  game. A half-ticked list from three months ago is worse than an empty one, because
  the ticks are stale and you'll trust them.

If the game is still changing shape, close this file and go build.

- [ ] Runs clean from a fresh clone (`./run.sh`, no console errors)
- [ ] `npm test` green, and CI green on the release commit
- [ ] No fabricated history or specs anywhere, including the store page
- [ ] `LICENSE` present; attribution for any borrowed assets
- [ ] `publishing/` finalized — `promo.html`, `ITCH-PAGE.md`, `MARKETING-PLAN.md`;
      every claim fact-checked, none oversold
- [ ] The page describes the actual game, and the genre's players get what they're
      promised
- [ ] `publishing/PUBLISHING-RUNBOOK.md` § Pre-publish checks worked
- [ ] Every remaining concern fixed, or accepted here on the record: _…_
- [ ] **Release gate cleared — DATE. Ship it.** *(this box is load-bearing: ticking
      it is what puts `promo.html` on GitHub Pages — `.github/workflows/pages.yml`
      withholds the landing page until it is checked)*
