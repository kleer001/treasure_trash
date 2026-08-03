# TODO / Handoff — Treasure Trash

Snapshot to continue on a local machine. Read `levels.md` for the exact ruleset,
`SPEC-SHEET.md` for what gets built, and `GAME-SHEET.md` for the pitch. (`DESIGN-BIBLE.md`
is superseded — history only, do not implement from it.)

## Where we are
- Genre + core loop **decided**; the raccoon's core mechanic is **built and playable**
  (L0–L17 solvable in provably-minimal par, proven by an exhaustive solver, not
  asserted).
- Crow is **pinned** — deliberately parked until the raccoon-alone game proves fun.
- **The game lives in `src/`.** `rules.js` is the engine of record, `format.js` the
  `.tt`/`.sol` parser, `solver.js` the exhaustive search, `main.js` presentation and
  input. `tools/` is offline only — `verify.mjs`, `metrics.mjs`, `build-artifact.mjs`
  — and `src/` never imports it.
- **Levels are data with a real toolchain** — `levels/*.tt` + `*.sol`, one rules module
  shared by the player, the solver and the tests, and a verifier that proves par
  minimal rather than trusting it. Spec: `FORMATS.md`.

## Locked mechanics (verified against the engine)
- Untimed, **grid step-move**; one raccoon controlled directly.
- **Pounce-tear:** step into a bag = tear it. Bursts a **2×3 directional fan** — the
  bag's two perpendicular **side** cells + the **three cells one row ahead** in the
  strike direction. **Not backward.**
- **Mess stays:** fan cells become **permanent trash obstacles**.
- **Side-cell corollary:** because the fan includes the side cells (and you strike
  from opposite the fan), an object directly beside a bag can't be dodged — it must be
  relocated. Corollary: a bag flush against a wall can't be opened (bags need room).
- **Cans:** pushing a *full* can slides it one cell **and** ejects its bag one further
  ahead; the can becomes **empty** (a normal pushable Sokoban block).
- **The exit `E`:** one per room, **terrain not object** — always walkable by the
  raccoon, **never occupiable by anything else**. Any strike or push that would put
  trash, a can or a bag on it is **refused**; you cannot bury your way out. Enforced by
  the engine and checked over every reachable state. **L0 "Out"** teaches it alone.
- **No pull, so everything but walking is permanent.** Measured on the shipped pack:
  moves are 100% reversible by play, tears 0%, full-can pushes 0%, empty-can pushes 44%
  (and only by walking round to the far side).
- **Arming (`:arm on`) is a per-room teaching scaffold, default OFF.** In a room that
  *introduces a piece*, board-changing actions ask twice — first press aims and previews,
  second commits. On in L1 (the bag) and L2 (the can); off elsewhere, where the game plays
  like the block-pusher it is. Input-layer only: it can never change a par.
- **Refusal, not punishment — and it's performed.** An illegal action plays out and
  rewinds: raccoon lunges, bag bursts, debris reaches the cell that won't take it, red
  flash + buzz, then the whole sequence reverses. The board never changes and no move is
  spent, so the invalid overlap is a frame in an animation, never a state to escape.
  Scaled by what there is to show, degrades to a short version on repeat, skippable. What remains as a
  genuine soft-lock is **stranding** — your trash walls you off from a clear exit —
  recoverable with **free undo/restart**. **Win = every bag opened *and* the raccoon
  on the exit.**
- **Deterministic**, no RNG. Object budget **7 of ~8 used** (bag, can, trash, recycle bin,
  wheelie bin, water jug, furniture), plus the bag-on-can stack built but with no room — the
  exit and water are terrain and cost nothing against the budget. Reserved: the crow's pieces.

## Design decisions — recorded 2026-07-29
`SPEC-SHEET.md` → *Design decisions* is filled.

What the review changed:
- **Slice cut to the 3 verified objects** (bag, can, trash). The other six each need
  their own prototype — see `SPEC-SHEET.md` → Vertical slice.
- **Solvability check is in the slice** — the positional soft-lock is currently
  silent, and a dead board must announce itself.
- **Act 1 opens on L3**, not L1; L1 teaches nothing about direction.
- **Unresolved, blocks release only:** the title. Treasure was cut, so the name
  promises loot the game refuses.
- `GAME-SHEET.md` rewritten and `DESIGN-BIBLE.md` marked superseded — both described
  the retired real-time two-animal game.

## NEXT MOVE — everything around the mechanic
The mechanic is built and plays: `./run.sh`, then L0–L17. `npm test` and
`node tools/verify.mjs` are green. What's left, per `SPEC-SHEET.md` → *Systems*:
- **The solvability indicator.** `solver.js` already detects a dead board offline; wire
  it to run after each state change and surface a non-blocking "can no longer be won."
  This is the one slice commitment not yet built.
- **Render through the compositor.** `main.js` draws straight to the canvas; the house
  pattern is ordered layers via `src/compositor.js`. Worth doing before the art pass,
  not after.
- **Audio** — procedural WebAudio. The only sound today is the win chime.
- **Art pass**, and more rooms toward a full Act 1.
- `src/rng.js`, `src/logo.js` and `src/compositor.js` are template scaffolding the game
  does not import yet. They are tested and harmless; wire them in or drop them
  deliberately, but don't leave the question open forever.

## Open decisions (need a call)
- **The crow.** Un-pin and design its powers — the "separation of powers" wasn't
  satisfying yet. What can the crow do that the raccoon can't (reach gaps, fly over
  low trash, grab the shiny the burst reveals)?
- ~~**Game aesthetic.**~~ **DECIDED 2026-07-29 — Memphis for the game surface.**
  Bright flat geometry, chosen for legibility: the mess must read at a glance or the
  puzzle isn't fair. It argues against a game about grime and decay; accepted
  anyway, worth revisiting with a full board of trash on screen. Phosphor/CRT is dead here — `DESIGN-BIBLE.md` is superseded. Studio docs
  keep the house doc style either way.
- **Verb/skill tree.** Deferred by decision (scope). Layer it *after* the base loop
  proves out. See the addendum in `rules.html`.

## Backlog (rooms & content)
- Verify/cell-exact the sketches: **L4 "Corner Yourself"**, **L5 "Interference"**,
  and rebuild the can room variants. Each must satisfy the **authoring checklist** at
  the end of `levels.md` (one exit, exit reachable after the last strike, and the exit
  must forbid at least one strike/push direction — otherwise it's a walk-back tax).
- **Passive fan preview can be ambiguous.** With arming off and the raccoon between two
  bags (L3), both fans light and the player can't tell which cell belongs to which strike.
  In L3 it happens to *be* the lesson — the corridor is the only unlit row — but that's
  luck, not design. If it misleads in a later room, options are to preview only the last-
  moved direction, or to tint the two fans differently.
- **Playtest the exit.** It's mechanically verified but not *felt* — the open question
  is whether the walk to `E` reads as tension or as filler. Cheapest test: play L1–L3
  and see if the last move is ever a decision.
- New objects toward the ~8 budget: the **shopping cart** (a 2-cell wheelie bin) is the
  only one still specified and unbuilt; the multi-cell state model it needed now exists.
- Audio (procedural WebAudio), art pass, more rooms → Act 1.

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
- Block-Pusher Laws (Artifact): https://claude.ai/code/artifact/438adc6f-d6f1-470e-b273-97b084ba2a71
