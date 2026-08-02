# Treasure Trash

### ▶ [Play it in your browser](https://kleer001.github.io/treasure_trash/)

Thirteen rooms, no install, no timer. Arrows or WASD, `U` to undo, `R` to restart.

A **Trace ROM Studio** game. An untimed, single-raccoon, Sokoban-family **block-pusher**:
you tear open garbage bags in an alley, and every torn bag sprays a **directional 2×3 fan
of trash that stays**. The puzzle is choosing each strike's direction and order so your own
mess never blocks another bag's fan, your path, or your way out. Win by opening every bag
**and** standing on the exit.

Lineage: Sokoban (Thinking Rabbit, 1982 — irreversible deadlock, no pull) × the
clear-the-objective-then-reach-the-exit shape of *Adventures of Lolo* (HAL, 1989) and
*Chip's Challenge* (Epyx, 1989) × reactive objects (Stephen's Sausage Roll, A Monster's
Expedition). The burst is additive — it *closes* space where bomb-Sokoban clears it.

## What's in here
| Path | What it is |
|---|---|
| `index.html`, `src/` | **The game.** `rules`/`solver`/`format` are the engine; `session`/`view`/`layers`/`sprites`/`anim`/`input`/`audio`/`hud`/`theme` are the game around it, wired by `main.js`. |
| `levels/` | The rooms, as data — one `.tt` pack per act. Format: `FORMATS.md`. |
| `tools/` | The verifier, the metrics tool and the publishing bundler. They import `src/`; they own no rules. |
| `tests/` | `node --test` specs for the engine, the session, the timelines and the compositor. |
| `GAME-SHEET.md` | Player-facing pitch (the fantasy, the loop, the hook). |
| `SPEC-SHEET.md` | **The buildable spec.** |
| `levels.md` | **The live ruleset** + cell-exact verified rooms (L0–L12). Start here for mechanics. |
| `rules.html` | The "Block-Pusher Laws" doc, house doc style. |
| `TODO.md` | Where we are, what's locked, what's open, and the next move. **Read this to continue.** |

## Quickstart
- **Play it online:** <https://kleer001.github.io/treasure_trash/> — deployed from `main`
  by `.github/workflows/pages.yml`. The landing page is `/promo.html`.
- **Play it locally:** `./run.sh 8000`, then open the URL. It loads ES modules, so it needs
  `http://` — opening the file directly will not work. Arrows/WASD or the on-screen d-pad;
  `U` undo, `R` restart.
- **Check every claim the level files make:** `npm run verify` → every room solves in
  provably-minimal par, the exit is unoccupied across every reachable state, the trap and
  refusal counts match what the files declare, and `levels.md` still draws the rooms it
  documents.
- **Run the tests:** `npm test`.
- **Measure the rooms:** `npm run metrics` — the table `LEVEL-GENERATION.md` explains.

## Status in one line
The game is playable end to end from `src/`, with every room verified against the engine
that runs it. Next up is the MVP gate: play it through and find out whether the
raccoon-alone game is fun. See `TODO.md`.
