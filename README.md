# Treasure Trash

A **Trace ROM Studio** game, currently in **design + verified-prototype** phase.
An untimed, Sokoban-family **command puzzle**: you direct a raccoon (and, later, a
crow) through an alley, tearing open trash to get at the shiny — where every torn
bag sprays a **directional 2×3 fan of trash that stays**, so the puzzle is choosing
each strike's direction and order to avoid burying your own path.

Lineage: Sokoban (irreversible deadlock) × The Lost Vikings / Pikmin (multi-character
command) × reactive objects (Stephen's Sausage Roll, A Monster's Expedition).

## What's in here
| File | What it is |
|---|---|
| `GAME-SHEET.md` | Player-facing pitch (the fantasy, the loop, the hook). |
| `DESIGN-BIBLE.md` | Full speculative design bible — control model, pillars, tools, bosses, story. Marked speculative vs. solid. |
| `levels.md` | **The live ruleset** + cell-exact verified rooms (L1–L3) and sketches (L4–L5). Start here for mechanics. |
| `rules.html` | The "Block-Pusher Laws" doc (the 4 panel lists + progression-mutation addendum), house doc style. |
| `spike/` | **Playable prototype** of L1–L3 + a headless verifier. Throwaway, gate-legal, not the real game. |
| `TODO.md` | Where we are, what's locked, what's open, and the next move. **Read this to continue.** |

## Quickstart
- **Play the prototype:** open `spike/index.html` in any browser (self-contained; no
  server, no build). Arrows/WASD or the on-screen d-pad; `U` undo, `R` restart.
- **Prove the rooms solve:** `cd spike && node verify.mjs` → L1–L3 solve in par
  (2/5/3) and the L3 soft-lock fires.

## Status in one line
Core raccoon mechanic **designed and verified in a spike**; the real game is **not
built yet** — the studio's Gate 1 (SPEC-SHEET + REVIEW-LOG) must close before any
code lands in `src/`. See `TODO.md`.
