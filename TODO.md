# TODO / Handoff — Treasure Trash

`levels.md` documents the shipped rooms; `FORMATS.md` documents the data formats;
`GAME-SHEET.md` is the pitch.

## Where we are
- The raccoon's core mechanic is built and playable — L0–L17, each solvable in a
  provably-minimal par found by exhaustive search rather than asserted.
- Crow is pinned, parked until the raccoon-alone game proves fun.
- **The game lives in `src/`.** `rules.js` is the engine of record, `format.js` the
  `.tt`/`.sol` parser, `solver.js` the exhaustive search, `main.js` presentation and
  input. `tools/` is offline only — `verify.mjs`, `metrics.mjs`, `build-artifact.mjs` —
  and `src/` never imports it.
- Levels are data: `levels/*.tt` + `*.sol`, one rules module shared by the player, the
  solver and the tests, and a verifier that proves par minimal rather than trusting it.
- Objects built and unit-tested: bag, metal can, spilled trash, recycle bin, wheelie bin,
  water jug, furniture, and the bag-on-can stack. The exit and water are terrain.

## NEXT MOVE — everything around the mechanic
`./run.sh`, then L0–L17. `npm test` and `node tools/verify.mjs` are green.
- **The solvability indicator.** `solver.js` already detects a dead board offline; wire it
  to run after each state change and surface a non-blocking "can no longer be won." The
  positional soft-lock is currently silent, and a dead board should announce itself.
- **Render through the compositor.** `main.js` draws straight to the canvas; the house
  pattern is ordered layers via `src/compositor.js`. Worth doing before the art pass.
- **Audio** — procedural WebAudio. The only sound today is the win chime.
- **Art pass**, and more rooms toward a full Act 1.
- `src/rng.js`, `src/logo.js` and `src/compositor.js` are scaffolding the game does not
  import yet; `main.js` uses its own inline LCG for confetti rather than `mulberry32`.
  Wire them in or drop them.

## Open decisions
- **The crow.** Un-pin and design its powers. What can the crow do that the raccoon can't
  — reach gaps, fly over low trash, grab the shiny the burst reveals?
- **The title.** Treasure was cut, so the name promises loot the game refuses. Blocks
  release, nothing else.
- **Verb/skill tree.** Deferred by scope; layer it after the base loop proves out.
- **Game aesthetic — decided 2026-07-29: Memphis for the game surface.** Bright flat
  geometry, chosen for legibility. It argues against a game about grime; worth revisiting
  with a full board of trash on screen.

## Backlog (rooms & content)
- **L7–L13 need regenerating, not re-sorting.** `tools/metrics.mjs` scores them: par
  climbs 13 → 25 while board-changing decisions stay flat at 3–5, so the ladder is built
  out of walking; L11 and L13 have zero coupling between their bags; L11 stays playable
  for 34 moves after it is lost. The bank cannot supply replacements — 0 of its 226 rooms
  pass the same filters. The generator that produced them is not in the repo.
- **L15 lost its question.** It was the pack's only room that asked *which bag first*.
  Making a filled canal cell ordinary floor let a later fan bury a crossing, and the order
  metric went 1/2 → 2/2. Re-picking it needs a sweep against the current rules.
- **Passive fan preview can be ambiguous.** With arming off and the raccoon between two
  bags (L3), both fans light and the player can't tell which cell belongs to which strike.
  In L3 that happens to be the lesson, but by luck. Options: preview only the last-moved
  direction, or tint the two fans differently.
- **Playtest the exit.** Mechanically verified but not felt — is the walk to `E` tension
  or filler? Cheapest test: play L1–L3 and see if the last move is ever a decision.
- **The shopping cart** — a 2-cell wheelie bin — is specified and unbuilt. The multi-cell
  state model it needed now exists.
- **The bag-on-can stack has no room.** It holds two bags and both pay the adjacency tax,
  so every solvable room built around it comes out at par 20 with 5–10 optimal lines and
  300+ soft-locks. That is an expert-act piece, not an introduction.

## How to run / verify (local)
```
# play it (ES modules need http://, so serve it)
./run.sh 8000                 # then open http://localhost:8000

# check every claim the level files make
node tools/verify.mjs
```

## Handy links
- Playable build (Artifact): https://claude.ai/code/artifact/10ed938d-a736-4251-a501-cafa78653bda
  Rebuild + republish after any game change: `node tools/build-artifact.mjs`, then publish
  the output to that same URL (a new URL means the old link goes stale).
