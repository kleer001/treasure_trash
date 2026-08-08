# Treasure Trash

### ▶ [Play it in your browser](https://kleer001.github.io/treasure_trash/)

Thirty-one rooms, no install, no timer. Arrows or WASD, `U` to undo, `R` to restart.

A **Trace ROM Studio** game.
An untimed, single-raccoon, Sokoban-family **block-pusher**: you tear open garbage bags
in an alley, and every torn bag sprays a **directional fan of trash that stays**.
The puzzle is choosing each strike's direction and order so your own mess never blocks
another bag's fan, your path, or your way out. Win by opening every bag **and** standing
on the exit.

Lineage: Sokoban (Thinking Rabbit, 1982 — irreversible deadlock, no pull) × the
clear-the-objective-then-reach-the-exit shape of *Adventures of Lolo* (HAL, 1989) and
*Chip's Challenge* (Epyx, 1989) × reactive objects (Stephen's Sausage Roll, A Monster's
Expedition). The burst is additive — it *closes* space where bomb-Sokoban clears it.

## What's in here
| File | What it is |
|---|---|
| `src/` | The game: `rules.js` (the engine of record), `format.js`, `solver.js`, `stage.js`, `sprites.js`, `main.js`. |
| `levels/`, `FORMATS.md` | The `.tt`/`.sol` level pack and the file syntax. |
| `levels.md` | Index of the shipped rooms. |
| `tools/` | Offline only: `verify.mjs`, `metrics.mjs`, `build-artifact.mjs`, `draft-room.mjs`. |
| `bench-cart.html` | The mechanic bench: a served page that imports `src/` to try one piece at a time. Presentation only — it carries no copy of the engine, and `verify.mjs` fails on a second copy of one anywhere in the tree. |
| `TODO.md` | Where we are, what's open, and the next move. |
| `BREADCRUMB.md` | Session handoff written and read by `/bob`. |
| `GAME-SHEET.md` | Player-facing pitch (the fantasy, the loop, the hook). |
| `SPEC-SHEET.md` | Design sketchpad. Nothing in it is binding, and it is never synced to the code. |
| `RELEASE-CHECKLIST.md` | The one hard stop, worked once at ship. Post-beta — closed until then. |
| `publishing/` | Launch surfaces and the tools that build them. Nothing the game needs to run; the scripts live there and work on the game root. |

## Quickstart
- **Play it online:** <https://kleer001.github.io/treasure_trash/> — deployed from
  `main` by `.github/workflows/pages.yml`.
- **Play it locally:** `./run.sh 8000` — it takes the first free port from there and opens
  the page. ES modules, `fetch` and relative paths all behave differently under `file://`,
  so a served page is the only supported way to run it.
  Arrows/WASD or the on-screen d-pad; `U` undo, `R` restart.
- **Check every claim the level files make:** `node tools/verify.mjs` — it prints what it
  checked and exits non-zero on the first failure.
- **Run the tests:** `npm test`.

## Status in one line
A prototype. The core mechanic is built and playable in `src/`, and every room's par is proven minimal
by `tools/verify.mjs`. What's left is everything around it — art, audio, progression, the
solvability indicator. See `TODO.md`.
