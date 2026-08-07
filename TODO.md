# TODO / Handoff — Treasure Trash

`levels.md` indexes the shipped rooms; `FORMATS.md` is the file syntax; `GAME-SHEET.md` is
the pitch. **None of them say what the pieces do — `src/rules.js` does.**

## Where we are
- The raccoon's core mechanic is built and playable — every shipped room solvable in a
  provably-minimal par found by exhaustive search rather than asserted.
- Crow is pinned, parked until the raccoon-alone game proves fun.
- **The game lives in `src/`.** `rules.js` is the engine of record, `format.js` the
  `.tt`/`.sol` parser, `solver.js` the exhaustive search, `stage.js` the objects and their
  positions, `sprites.js` the drawings, `main.js` presentation and input. `tools/` is
  offline only — `verify.mjs`, `metrics.mjs`, `survey.mjs`, `build-artifact.mjs` — and
  `src/` never imports it.
- Levels are data: `levels/*.tt` + `*.sol`, one rules module shared by the player, the
  solver and the tests, and a verifier that proves par minimal rather than trusting it.
- Objects built and unit-tested: bag, metal can, spilled trash, recycle bin, wheelie bin,
  water jug, furniture, the bag-on-can stack and the shopping cart.
- The stand-in art lives in `src/sprites.js`, bound to a canvas and a cell size at the
  boundary, so the game and the mechanic bench draw the same raccoon.
- **One engine, one motion system.** `bench-cart.html` is presentation only and imports `src/`,
  and the game animates from the motion `explain(…, {trace:true})` reports rather than from a
  board diff. Motion is paced per CELL. Nothing may carry its own copy of a module —
  `verify.mjs` fails the build if a page does.

## NEXT MOVE — everything around the mechanic
`./run.sh`, then pick a room. `npm test` and `node tools/verify.mjs` are green.
- **The solvability indicator.** `solver.js` already detects a dead board offline; wire it
  to run after each state change and surface a non-blocking "can no longer be won." The
  positional soft-lock is currently silent, and a dead board should announce itself.
- **Render through the compositor.** `main.js` draws straight to the canvas; the house
  pattern is ordered layers via `src/compositor.js`. Worth doing before the art pass. It
  already draws sprites in layer order — that ordering is the thing the compositor should own.
- **Audio** — procedural WebAudio. The only sound today is the win chime.
- **Art pass**, and more rooms toward a full Act 1.
- `src/logo.js` and `src/compositor.js` are still scaffolding the game does not import;
  `main.js` uses its own inline LCG for confetti rather than `mulberry32`. Wire them in or
  drop them. (`src/rng.js` is now in use — `stage.js` seeds sprites with it.)

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
- **L15 lost its question.** It was the pack's only room that asked *which bag first*, and a
  rules change took that away. Re-picking it needs a sweep against the current rules; run
  `tools/metrics.mjs` for where its order metric stands now.
- **Passive fan preview can be ambiguous.** With arming off and the raccoon between two
  bags (L3), both previews light and the player can't tell them apart. Options: preview only
  the last-moved direction, or tint the two differently.
- **Playtest the exit.** Mechanically verified but not felt — is the walk to `E` tension
  or filler? Cheapest test: play L1–L3 and see if the last move is ever a decision.
- **The cart tutorial is part-built** — L18 is in, 019–031 are not. The arc, the tool that
  drafts rooms against the verifier, and what the verifier actually requires are all in
  [`BREADCRUMB.md`](./BREADCRUMB.md). Play the bench before designing more; the bench, not this
  file, is where the behavior is legible.
- **Leave a lane behind a cart you want parked reachable**, and check it on the bench before
  the room goes in.
- **A room that pins a loaded cart in a dead end keeps what is in it.** Either give it a lane
  to shed along, or design the room not to want the cargo back.
- **The bag-on-can stack has no room, and now there is a number on it.** Every solvable room
  built around it came out long, with many optimal lines and heavy soft-locking. The
  fertility survey puts it last in the roster by an order of magnitude — 5.1 solvable rooms
  per 1000 placements against 62.5 for every group without it, at the same enumeration-cap
  rate, so it is the piece and not the measurement. Cut it or accept it as an expert-act
  piece; there is no third reading left.
- **The cart is worth its state graph.** Second most fertile piece in the survey. The open
  question about whether it belongs in the real act is answered on the evidence side; what
  is left is taste.

## How to run / verify (local)
```
# play it (ES modules need http://, so serve it)
./run.sh 8000                 # then open http://localhost:8000

# check every claim the level files make
node tools/verify.mjs
```

## Handy links
- Feasibility spike, L0–L3, July, historical:
  https://claude.ai/code/artifact/10ed938d-a736-4251-a501-cafa78653bda
  It predates `src/` — the rules are inlined in the page. Not the game; do not publish
  over it.
- **No current build is published.** `./run.sh` is the way to play this branch.
  `node tools/build-artifact.mjs` bundles one self-contained page when a build is wanted.
