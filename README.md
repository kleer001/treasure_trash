# Treasure Trash

### ▶ [Play it in your browser](https://kleer001.github.io/treasure_trash/spike/)

Seven rooms, no install, no timer. Arrows or WASD, `U` to undo, `R` to restart.

A **Trace ROM Studio** game, currently in **design + verified-prototype** phase.
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
| `GAME-SHEET.md` | Player-facing pitch (the fantasy, the loop, the hook). |
| `SPEC-SHEET.md` | **The buildable spec**, plus the design-gate record. Build from this. |
| `levels.md` | **The live ruleset** + cell-exact verified rooms (L0–L6) and sketches for what comes next. Start here for mechanics. |
| `REVIEW-LOG.md` | The persona panel's notes across the gates. |
| `rules.html` | The "Block-Pusher Laws" doc (the 4 panel lists + progression-mutation addendum), house doc style. |
| `spike/` | **Playable prototype** of L0–L6 + a headless verifier. Throwaway, gate-legal, not the real game. Formats and API: `spike/FORMATS.md`. |
| `TODO.md` | Where we are, what's locked, what's open, and the next move. **Read this to continue.** |
| `DESIGN-BIBLE.md` | **Superseded — history only.** Describes a retired real-time two-animal design. Do not implement from it. |

## Quickstart
- **Play it online:** <https://kleer001.github.io/treasure_trash/spike/> — deployed from
  `main` by `.github/workflows/pages.yml`. (The site root serves the `src/` rendering
  scaffolding, not the game; the game is the `/spike/` path until `src/` catches up.)
- **Play it locally:** `cd spike && ./run.sh 8000`, then open the URL. It loads ES
  modules, so it needs `http://` — opening the file directly will not work.
  Arrows/WASD or the on-screen d-pad; `U` undo, `R` restart.
- **Check every claim the level files make:** `cd spike && node verify.mjs` → L0–L6 solve
  in provably-minimal par (2/4/7/5/5/6/11), the exit is unoccupied across every reachable
  state, and the trap and refusal counts match what the files declare.
- **Run the tests:** `npm test` — the rules engine, the compositor, the seeded RNG.

## Status in one line
Gate 1 is **closed** — the raccoon's core mechanic is designed and verified in a spike,
and `SPEC-SHEET.md` is the spec to build from. The real game is **not built yet**; `src/`
is the next move. See `TODO.md`.
