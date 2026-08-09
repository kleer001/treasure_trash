fresh

## Summary

Act 1 is 31 rooms (L0–L30). **Act 2 is 30 rooms (L31–L60), ten sets of three, and it is named.**
Nothing placeholder now reaches the player.

The rules have **two implementations**, on purpose and under proof: `src/rules.js` is the engine
of record, and `engine/` is a sanctioned Rust port that answers `step`. Stage 1 of the port is
done and green; stages 2–4 are the open thread and the reason to pick this up.

## Todos

### Sequential
- [ ] #17b **Port stage 2 — `answer`.** The search: par, distinct shortest solves, traps,
      reachable, exitRefusals, over 97 rooms. `traps` is the subtle one — it means liveness is
      exactly right. Today `answer` replies `unsupported` and conform.mjs reports the skips.
      **The canonical `:solve` tie-breaks on DISCOVERY ORDER**, so a `HashMap` iteration will
      not do it: keep a `Vec` of states plus an index table and BFS in insertion order. Rust's
      per-process hash seed makes the wrong version fail on run two rather than on CI in March.
- [ ] #17c (needs: #17b) **Make the pipeline actually use it** — the step everyone skips.
      Conformance *proves* a port; it does not speed anything up, because `resite`/`shrink` call
      `analyze()` in process. Point them at the engine over the protocol instead. `answer` is
      coarse — one request per candidate against ~70ms of JS work — so JSON overhead vanishes.
      The one thing the protocol cannot express is `reroot`; extend it: `{op:'open', grid}` →
      handle, `{op:'root', handle, at}` → answer. Graph engine-side, design policy in JS.
- [ ] #17d (needs: #17c) **Retire the JS `maxStates` ceiling if the port earns it.** Bound is
      50,000 states because `analyze` holds every one as a cloned board.

### Parallel
- [ ] #13 **Render through the compositor.** `main.js` draws straight to the canvas; the house
      pattern is ordered layers via `src/compositor.js`, which the game still does not import.
      Worth doing before the art pass, and it is a real refactor of the draw loop — start it
      with a full context rather than at the end of one.
- [ ] #5 **A cart rolls into open water and comes to rest there.** Nothing stops it, the water is
      unchanged, and the raccoon can neither follow it nor stand on it — a cart can be lost
      permanently, by accident, with no warning. Undesigned rather than broken; costs nothing
      until a room holds both a canal and a cart. **Owner's call.**
- [ ] #10 **The stack's fate — left open, deliberately, this session.** `S` is last in the roster
      by an order of magnitude: 5.1 solvable rooms per 1000 placements against 62.5 for every
      group without it. It appears in no shipped room. Cut it or keep it as an expert-act piece;
      it will not carry an introduction either way.
- [ ] #18 **`draft-room.mjs`'s `rooms()` is the redundancy `reroot` was written for.** Lowest
      value on this list and it is not the ten-minute job it looks like: `rac` is the *second*
      loop, so consecutive yields do not share a board. Exploiting `reroot` means reordering the
      loops so `rac` is innermost (same set of rooms, different order — changes what `hunt`
      finds first) AND teaching `draft` to accept an analysis it did not run. Nothing hot goes
      through it, which is the only reason it is still there.

## Context

### The port — where it stands

**Stage 1 is done, and the shape of the proof matters more than the code.** `engine/` is Rust,
zero dependencies (it must build in CI from a checkout with no network, beside a game that has
no build step). It answers `step` and replies `unsupported` to `answer`, which conform.mjs
reports as a skip and never as agreement.

- **Agreement measured:** 6,106,104 board-and-direction vectors over 1,227 rooms, four seeds
  (7, 101, 2718, 31337), zero disagreements.
- **The check can fail, demonstrated:** delete the raccoon's line in `tip_fits` — he is the one
  occupant `is_occupiable` cannot see — and conform.mjs names `act1.tt:L23`, the direction, and
  the board. Do this again after any change to the harness; a gate nobody has seen fail is a
  green light wired to nothing.
- Registered in `SANCTIONED` in `verify.mjs`, which prints both files on every run.
- CI builds it and runs `--steps 1000000 --random 120` against it.

**Traps for stage 2+**, from having built the JS side: do not clone the board on a plain move
(sharing it was 1.9× in JS; a naive port throws that away and wonders why it is only 8×); same
`maxStates` bound, sent in the request, reported as `error` not as an answer; `blame` and the
traced frames are out of contract, so a conforming port is proven for the pipeline and is *not*
enough to drive the browser renderer. Expect 20×+ overall (JS does ~57k states/s; a packed-board
BFS with open addressing should do 1–5M). Pipeline 21 min → 1–2 min, estimated from the profile
shape, not measured.

**RNG, if the port ever generates rooms:** `src/rng.js` is mulberry32 and it is the only source
of randomness in the pipeline. It ports exactly — `wrapping_add`/`wrapping_mul` on `u32`,
`Math.imul` is `wrapping_mul`, divide by `4294967296.0`. Integer all the way to the last
division, so no float drift and a seeded corpus reproduces bit for bit across both engines.

### One engine

`CLAUDE.md` → **One engine** is split by audience: agents may not write a second implementation
at all; the owner may, and the bill is stated. A second port is the same conversation again.
`verify.mjs` walks the whole tree and fails on a copy of any engine module anywhere.
`tools/conform.mjs` is the gate: two grains, **ANSWER** (whole room) and **STEP** (one board, one
direction). An ANSWER failure re-runs at STEP grain over every state, so the report is the
shallowest board where the two part — and a room that answers wrong while every step agrees is
reported as the port's *search*, not its rules. `tests/fixtures/bent-engine.mjs` bends one rule
at a time and the tests require each bend to be caught.

### Decided this session

- **Act 2 is ten sets, cap 0.9.** The cost is the recycle bin in 27 of 30 rooms, and it is on the
  label in `levels.md` and in `act2.mjs`'s comment. The default moved with the decision rather
  than living in a flag. Note the tenth set does not append — it sorts second on `onPath`, so it
  entered at position 2 and shifted everything after it by three rooms.
- **The stack stays undecided** (#10). Not an oversight.

### The three gates that hold the level design

Each was a fault found by looking, then turned into something that fails a build.

1. **Dead travel.** `deadTravel(a)` in `metrics.mjs` names it (`lead`/`tail`, over the whole
   shortest-solve DAG). `tools/resite.mjs` fixes it at the cause, per set, before `shrink`.
   `verify.mjs` bounds both at `WALK_MAX` (4); over the bound a room declares `:lead`/`:tail`
   and the number is checked exactly. Act 1's L12 "The Far Side" declares — distance is its
   teach line. Worst lead was 11, worst tail 12; both are 3 now.
2. **Sealed pieces.** Only bare floor is ever walled, so a wall pass cannot wall a piece away —
   it walls *around* it. `isOneRoom`; `verify`, `shrink` and `draft` all refuse it.
3. **Inert pieces** — the real fault, of which #2 was the visible half. A piece earns its cell by
   being **HANDLED** (some shortest solve touches it) or **BINDING** (remove it and par, solves
   or traps change). Both halves are load-bearing: binding-only fails L22, a tutorial whose can
   is shoved into its cart with par 5 either way; handled-only passes a wheelie parked where
   nothing goes. Act 1's 73 pieces clear it untouched — that is the evidence the definition is
   right.

### Still worth trusting

- **Trap position beats trap count.** L29 shipped 17 traps all off the solution line. Score on
  `onPath`/`firstOnPath`, never on `:traps`.
- **Losable and self-announcing pull against each other.** Of 5,578 eligible harvested rooms,
  exactly one both lets optimal play go wrong at 15% of steps and ends within 12 moves of the
  mistake; median `onPath` is 0. Causal — the mess is permanent. This is why the solvability
  indicator is enabling, not a nicety.
- **Only H passes the open-floor rule** among L/U/H outlines; 48 variants, every one with a
  two-cell neck.
- **Fertility, solvable per 1000:** `B` 86.6, `P` 62.0, `x` 50.4, `j` 45.7, `$` 42.6, `F` 41.9,
  `w` 40.4, `c` 32.6, `W` 30.8, `C` 14.0, `S` 5.1.

### Rebuilding the act

`sets.mjs` → **`resite.mjs`** → `shrink.mjs` → `act2.mjs`, then splice the emitted
`levels/act2.md` rows over the Act 2 table in `levels.md`, then `node tools/verify.mjs`.
Names and notes do not survive a regenerate — they are re-emitted as placeholders and have to be
put back. `levels/fertility.jsonl` (group map), `levels/harvest.jsonl` (6,651 rooms),
`levels/sets.jsonl` (56 candidate sets, re-sited and shrunk).

**The discipline that has caught every refactor: any pipeline change must be proved
byte-identical** against `levels/sets.jsonl` and `levels/act2.tt`. Regenerate and `diff`. Do not
trust a green test suite alone for tool changes. `tools/pool.mjs` (was `set-pass.mjs`) is the
shared worker pool and it hands results back at the index they were dealt — `sets.mjs` is the one
pass that cannot use it, because `search` draws a whole chunk from one seeded stream.

### Run it

`./run.sh` · `npm test` (246) · `node tools/verify.mjs` (both acts, 1,486 checks) ·
`node tools/conform.mjs` (the reference) · `cargo build --release --manifest-path
engine/Cargo.toml && node tools/conform.mjs --engine engine/target/release/tt-engine` ·
`node tools/build-artifact.mjs`. All green at `29a487b`.

Branch `claude/level-design-exit-placement-gb3f04`, everything pushed, tree clean.

## Next Step

Port stage 2 (#17b): implement `answer` in `engine/`, BFS in insertion order over a `Vec` +
index table so the canonical `:solve` tie-break survives. Then
`node tools/conform.mjs --engine engine/target/release/tt-engine` should report 97 answers and
0 skips.

/home/user/treasure_trash
