# Treasure Trash

### ▶ [Play it in your browser](https://kleer001.github.io/treasure_trash/)

Eighteen rooms, no install, no timer. Arrows or WASD, `U` to undo, `R` to restart.

A **Trace ROM Studio** game.
An untimed, single-raccoon, Sokoban-family **block-pusher**: you tear open garbage bags
in an alley, and every torn bag sprays a **directional 2×3 fan of trash that stays**.
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
| `src/` | The game: `rules.js` (the engine of record), `format.js`, `solver.js`, `main.js` (presentation + input). |
| `levels/`, `FORMATS.md` | The `.tt`/`.sol` level pack and the format spec the verifier enforces. |
| `levels.md` | The shipped rooms L0–L17: diagrams, solves, and measured refusal and trap counts. |
| `tools/` | Offline only: `verify.mjs` proves every par minimal, `metrics.mjs` reads a room, `build-artifact.mjs` bundles one self-contained HTML. |
| `TODO.md` | Where we are, what's open, and the next move. |
| `GAME-SHEET.md` | Player-facing pitch (the fantasy, the loop, the hook). |

## Quickstart
- **Play it online:** <https://kleer001.github.io/treasure_trash/> — deployed from
  `main` by `.github/workflows/pages.yml`.
- **Play it locally:** `./run.sh 8000` — it takes the first free port from there and opens
  the page. ES modules, `fetch` and relative paths all behave differently under `file://`,
  so a served page is the only supported way to run it.
  Arrows/WASD or the on-screen d-pad; `U` undo, `R` restart.
- **Check every claim the level files make:** `node tools/verify.mjs` → all 18 rooms solve
  in provably-minimal par (2/4/7/5/5/6/11/13/15/17/19/21/23/25/7/8/6/7), the exit is
  unoccupied across every reachable state, and the trap and refusal counts match what the
  files declare.
- **Run the tests:** `npm test` — the rules engine, the compositor, the seeded RNG.

## Status in one line
The core mechanic is built and playable in `src/`, and every room's par is proven minimal
by `tools/verify.mjs`. What's left is everything around it — art, audio, progression, the
solvability indicator. See `TODO.md`.
