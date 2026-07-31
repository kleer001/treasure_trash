# TODO / Handoff — Treasure Trash

Snapshot to continue on a local machine. Read `levels.md` for the exact ruleset and
`DESIGN-BIBLE.md` for the wider design.

## Where we are
- Genre + core loop **decided**; the raccoon's core mechanic is **designed and
  verified** in `spike/` (L0–L3 solvable in provably-minimal par; three soft-locks
  fire).
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
- **The exit `E`:** one per room, **terrain not object** — always walkable, wins the
  room only while you stand on it with zero bags left, and is **not protected** (trash
  or a pushed can seals it permanently). Retrofitted through every room; **L0 "Out"**
  teaches it alone. See the fork-resolution block in `levels.md`.
- **Soft-lock** is the only failure — self-inflicted, avoidable, foreseeable; **free
  undo/restart**. **Win = every bag opened *and* the raccoon on the exit.**
- **Deterministic**, no RNG. Object budget **3 of ~8 used** (bag, can, trash) — the
  exit is terrain, so it costs nothing against the budget; reserved: water/gap + the
  crow's pieces.

## NEXT MOVE — close Gate 1 (before any `src/` code)
Per the studio process, authoring real game logic is gated. To proceed:
1. Distill `levels.md` + `DESIGN-BIBLE.md` into a lean **`SPEC-SHEET.md`** with a
   filled **Panel gate** block (each persona's concern + resolution, dated).
2. Write **`REVIEW-LOG.md` Session 1** — the four personas' first-impression notes as
   the baseline the MVP gate measures against. (The panel has already been run in
   chat; this just records it against the current design.)
3. Only then: build on the house stack.

## Then — build on the house stack
Copy `../template/` into place and implement for real:
- `src/` modules: `rng` (mulberry32), `board`/`rules` (pure, testable — the sim from
  `spike/verify.mjs` is a starting point), `render` via `compositor.js` ordered
  layers, `input`, `audio`.
- `tests/*.test.js` (`node --test`) — port `spike/verify.mjs` into real tests:
  every shipped room must be provably solvable (Law 1.8), and assert the par solves.
- Levels as **data** (JSON/data module), not hard-coded — see `levels.md` legend.
- `index.html`, `run.sh`, `package.json`, `.github/workflows/`, `GAME-SHEET.md`
  (done), `CLAUDE.md`, `.trace_rom_studio_version` (stamp from studio `VERSION`).

## Open decisions (need a call)
- **The crow.** Un-pin and design its powers — the "separation of powers" wasn't
  satisfying yet. What can the crow do that the raccoon can't (reach gaps, fly over
  low trash, grab the shiny the burst reveals)?
- **Game aesthetic.** Docs use the Memphis house doc style (correct). The *game
  surface* aesthetic is still officially TBD — the spike uses Memphis by your
  preference, but `DESIGN-BIBLE.md` still says phosphor as default. Pick one for the
  game itself.
- **Verb/skill tree.** Deferred by decision (scope). Layer it *after* the base loop
  proves out (Into the Breach model: ship the loop, then the unlocks). See the
  addendum in `rules.html`.

## Backlog (rooms & content)
- Verify/cell-exact the sketches: **L4 "Corner Yourself"**, **L5 "Interference"**,
  and rebuild the can room variants. Each must satisfy the **authoring checklist** at
  the end of `levels.md` (one exit, exit reachable after the last strike, and the exit
  must forbid at least one strike/push direction — otherwise it's a walk-back tax).
- **Playtest the exit.** It's mechanically verified but not *felt* — the open question
  is whether the walk to `E` reads as tension or as filler. Cheapest test: play L1–L3
  in the spike and see if the last move is ever a decision.
- The linked spike Artifact below predates the exit — republish it before showing it
  to anyone.
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
- Playable spike (Artifact): https://claude.ai/code/artifact/3fc191a1-4c78-4b55-b112-416f3770bac6
- Block-Pusher Laws (Artifact): https://claude.ai/code/artifact/438adc6f-d6f1-470e-b273-97b084ba2a71
- Branch: `claude/crows-raccoons-game-5b2yjy`
