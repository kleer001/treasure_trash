# TODO / Handoff — Treasure Trash

Snapshot to continue on a local machine. Read `levels.md` for the exact ruleset,
`SPEC-SHEET.md` for what gets built, and `GAME-SHEET.md` for the pitch. (`DESIGN-BIBLE.md`
is superseded — history only, do not implement from it.)

## Where we are
- Genre + core loop **decided**; the raccoon's core mechanic is **designed and
  verified** in `spike/` (L0–L6 solvable in provably-minimal par, proven by an
  exhaustive solver, not asserted).
- Crow is **pinned** — deliberately parked until the raccoon-alone game proves fun.
- **No real game code yet.** `spike/` is a throwaway prototype (the studio gate's one
  allowed pre-gate artifact). `src/` does not exist on purpose.
- **Levels are data with a real toolchain** — `spike/levels/*.tt` + `*.sol`, one rules
  module (`spike/rules.mjs`) shared by the player and the verifier, and a solver that
  proves par minimal rather than trusting it. Spec: `spike/FORMATS.md`.

## Locked mechanics (verified in the spike)
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
- **Deterministic**, no RNG. Object budget **3 of ~8 used** (bag, can, trash) — the
  exit is terrain, so it costs nothing against the budget; reserved: water/gap + the
  crow's pieces.

## Gate 1 — CLOSED 2026-07-29
`SPEC-SHEET.md` (Panel gate block filled) and `REVIEW-LOG.md` (Session 1, four
personas) are written. **Code may begin.**

What the panel changed:
- **Slice cut to the 3 verified objects** (bag, can, trash). The other six each need
  their own spike — see `SPEC-SHEET.md` → Vertical slice.
- **Solvability check is in the slice** — the positional soft-lock is currently
  silent, and a dead board must announce itself.
- **Act 1 opens on L3**, not L1; L1 teaches nothing about direction.
- **Unresolved, blocks release only:** the title. Treasure was cut, so the name
  promises loot the game refuses.
- `GAME-SHEET.md` rewritten and `DESIGN-BIBLE.md` marked superseded — both described
  the retired real-time two-animal game.

## NEXT MOVE — build the slice
The house scaffolding is in place: `index.html`, `run.sh`, `package.json`, `styles.css`,
`src/` (compositor, logo, rng), `tests/`, and the test + Pages workflows, all running
green (`npm test`, `cd spike && ./run.sh`). What's left is the game itself, per
`SPEC-SHEET.md` → *Systems*:
- `src/` modules: `rules` (port `spike/rules.mjs` — do not write a second engine),
  `board`, `format`, `solver` (port `spike/solver.mjs`), `undo`, `render` via
  `compositor.js` ordered layers, `input` (owns arming), `audio`.
- `tests/*.test.js` (`node --test`) — port `spike/verify.mjs`: every shipped room
  provably solvable in its stated par, the exit unoccupied across every reachable state,
  and the refusal/trap counts the level files declare.
- Levels stay **data** — the `.tt`/`.sol` pack in `spike/levels/`, per `spike/FORMATS.md`.
- Delete `spike/` only once `src/` covers it; until then it is the reference engine.

## Open decisions (need a call)
- **The crow.** Un-pin and design its powers — the "separation of powers" wasn't
  satisfying yet. What can the crow do that the raccoon can't (reach gaps, fly over
  low trash, grab the shiny the burst reveals)?
- ~~**Game aesthetic.**~~ **DECIDED 2026-07-29 — Memphis for the game surface.**
  Bright flat geometry, chosen for legibility: the mess must read at a glance or the
  puzzle isn't fair. The Critic objected that it argues against a game about grime and
  decay; consciously accepted, revisited at the MVP gate with a full board of trash on
  screen. Phosphor/CRT is dead here — `DESIGN-BIBLE.md` is superseded. Studio docs
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
  in the spike and see if the last move is ever a decision.
- New objects toward the ~8 budget: **cans as bridges** (non-dump use), **water/gap**.
- Audio (procedural WebAudio), art pass, more rooms → Act 1.

## How to run / verify (local)
```
# play the prototype (ES modules need http://, so serve it)
cd trash_treasure/spike && ./run.sh 8000   # then open http://localhost:8000

# check every claim the level files make
cd trash_treasure/spike && node verify.mjs
```

## Handy links
- Playable spike (Artifact): https://claude.ai/code/artifact/10ed938d-a736-4251-a501-cafa78653bda
  Rebuild + republish after any spike change: `cd trash_treasure/spike && node build-artifact.mjs`,
  then publish the output to that same URL (a new URL means the old link goes stale).
- Block-Pusher Laws (Artifact): https://claude.ai/code/artifact/438adc6f-d6f1-470e-b273-97b084ba2a71
