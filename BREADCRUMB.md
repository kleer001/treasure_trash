fresh

## Summary

**Building the new roster, stage by stage, against `ROSTER-BUILD-PLAN.md`.** That file is the
order and the gate for each step; `SPEC-SHEET.md` -> *The candidate roster* is the design it
builds toward. Stages A-D are done and E is half done. Everything committed is green: 301 tests,
`verify.mjs`, and conformance against both engines.

Act 1 (31 rooms) and Act 2 (30) still ship unchanged. `levels/scratch.tt` is a bench pack, never
shipped, played in the real game via `index.html?acts=scratch.tt`.

## Todos

### Sequential — the build plan, in order

- [x] #25 **Stage A — storage groundwork.** Separator below 65; cell packs against a named
      terrain width; carts carry their kind in the key.
- [x] #26 **Stage B — five terrain lanes.** Grease, tar, one-way, sewer grate, broken glass.
      Only MUTABLE terrain reaches `stateKey`.
- [x] #27 **Stage C — the jug carries one cell.** `JUG_EMPTY`, glyph `i`. Six rooms re-declared
      their trap counts; no par moved. The port learned it too.
- [x] #28 **Stage D — transfer on impact.** Rollers move as a train; motion hands off. Proved at
      2.4M board-and-direction vectors over two seeds.
- [ ] #29 **Stage E4 — the anisotropic rollers**, the half of Stage E still open: car tire (one
      cell, a code per axis), bicycle (two cells), rolled rug (multi-cell). **`isRoller` has to
      become direction-aware** — a `rollsAlong(c, dx, dy)` — and that predicate is what the
      Stage D train is built on, so the train code changes with it. The two multi-cell kinds also
      want glyph pools of their own, like `FURN_POOL`.
- [ ] #30 (needs: #29) **Stage F — the office chair.** Trash knocks it one cell; everything else
      rolls it. Needs the `fanBlockers` exception for a chair that has somewhere to flee, with
      the flee cell in `blame`.
- [ ] #31 **Stage G — the broom.** Line push of any kinds; slides its whole train on grease; the
      only way a bag ever travels, which is what wakes broken glass up.
- [ ] #32 **Stage H — the filing cabinet.** Two cells open, one closed — `isMultiCell` becomes
      state-dependent, and that predicate is read by `pieceCells`, the push branch and
      `stateKey`'s pid lane. Decide the representation before writing any of it.
- [ ] #33 **Stage I — the wheelbarrow.** Needs Stage A's cart-kind lane, and the LINK lane lands
      here. Cargo rides cart-style so `bagsLeft` and `trashHeld` keep counting it.
- [ ] #34 (needs: #33) **Stage J — the magnet.** Shares the link lane, which is what makes it
      affordable.
- [ ] #35 **Stage K — the port and the pipeline.** `engine/` catches up on everything from E4
      on, earns conformance back at both grains, and only then do new pieces enter a shipped
      pack or get harvested.

## Context

### Act 3 — the design as it stands

**Shape: ten sets of three, pool growth as the ramp, par band ~40–80, `solves <= 4`.**
Act 2's 8–32 band is far too short for the act that follows it.

**The lake family (`lakeFamily()` in `tools/shapes.mjs`).** A rectangle with a water pool inside
and margins of 1–2 cells on each side. 972 variants over 63 room sizes, floor 18–84. It shares
`blockPlacements()` with `ringFamily()` — the two are the SAME silhouettes, one made of wall and
one of water, and enumerating them once is what keeps that true.

**Why a lake and not a wall block, which is the whole finding.** `isOccupiable` — what
`fanBlockers` tests — refuses a wall and never checks water. So a tear aimed at a block is
refused, and the same tear aimed at a pool lands in it and `layTrash` turns three cells to
bridge. Measured on the ring (the wall version): of 624 barrier canals NOT ONE admits a bridging
tear, dry rings tear in 28% of solves against the H family's 55%, and only 3% of ring keepers
come from a group carrying a loose bag against 19% — a bag with no clear fan is statically dead,
so those rooms are refused before anything measures them. A tear's fan is three cells across and
two deep; a ring's lanes are one or two. The lake fixes all of it: tears 63%, loose-bag groups
25%, and it is the most fertile family measured.

**So the water is a SHORTCUT, not a barrier.** The shore always goes round. A bag spent on the
pool buys a way through the middle; the same bag spent on dry floor lays five cells of permanent
trash. The room's question is where to spend a tear, not whether to.

**Measured, 372,000 placements on the 14x11 family:** 25,465 keepers, par median 29 / p90 47 /
max 171, 8.0% at par 50+, `onPath > 0` in 45%, `blind` median 52. Shortlists: par>=50 with
solves<=4 and losable gives 126 rooms over 113 outlines; **par>=40 with solves<=4 and losable
gives 41 room sizes that can host a three-rung pool-growth set**, against the ten Act 3 needs.
Strong sizes: 14x9 (par 42–63), 13x8 (41–80), 11x10 (40–82).

**The pool is used and it is optional** — replaying all solves: 78% bridge it, and of those only
2% at move 0, median move 13; 22% walk round entirely. That optionality is what makes it a
decision, and it is why the earlier canal design failed: forcing the crossing produced rooms
whose first and only interesting move was mandatory.

**Longer is not automatically harder.** Solution length correlates ρ 0.47 with human solve time
and state-space size not at all. Treat the par band as a shape constraint, not a difficulty claim.

### Water in the pipeline

`format.js` always read and wrote a `:water` mask; no GENERATOR ever emitted one. Now:
- `canals(plan)` — every contiguous run of 3+ cells along a wall-free row or column. A line
  carrying a wall is not offered, because a wall would break the run into two canals.
- `puddles(plan, n, rnd)` — n single cells, no two touching. Sampled, not enumerated: the
  choose-n space dwarfs the canal's and nothing about where one puddle sits is structural.
- `isBarrier(plan)` — severs the dry floor into exactly two banks, far one >= 6. **Do not pass
  it to `.filter` bare**: its second parameter is the minimum bank size and `.filter` supplies
  the array index.
- `bridgeSeats(plan)` / `placeOn(..., {across:true})` — aims a draw at a barrier: seats a bag on
  a seat whose tear joins the banks, strands the exit on the far bank, reserves the five fan
  cells. Took barrier rooms from 1 per 2000 draws to 47. Only relevant to canals; a lake needs
  none of it.
- `judge(wall, w, h, water)` judges on the DRY floor, which is what lets terrain carry structure.
- `bankOf` and `bridgeSeats` are cached per plan in a `WeakMap` — both are flood fills and a run
  asks the same plan thousands of times.
- `harvest.mjs --family h|ring|lake [--water]`, on `pool.mjs` and the Rust engine.

### The roster is eight mechanics in twelve costumes

`explain` branches: tear (`$`), shed-a-bag (`C`/`S`/`W`), shed-trash (`B`), pour (`j`),
slide-inert (`c`/`b`), roll (`W`/`w`), rigid multi-cell (`F`–`N`), carry (`P`–`R`). Four glyphs
are one mechanic. That is why the pipeline keeps producing one idea at three sizes.

**Absent axes:** nothing removes trash; nothing removes water; nothing pulls; nothing toggles;
only bags are consumed; no piece treats another piece's KIND as different.

**Candidate pieces, ranked by axis-added over cost:**
- **Grease** — floor terrain; anything pushed onto it slides until blocked. One terrain lane,
  multiplies against all eight mechanics. Cheapest interaction multiplier available.
- **Sewer grate** — terrain, and the mirror of water: the raccoon walks over, objects fall in.
  Runs of N cells, so `canals()`'s run enumerator serves it unchanged. On an edge it reads as
  disposal; in the middle as hazard — same piece, two roles by placement. Rollers vanish into it;
  a multi-cell piece SPANS a one-wide grate and neutralises it; a tear's fan over it disposes of
  trash for free. Containers pushed in take their bags out of `bagsLeft`, which is a second way
  to clear a bag that costs travel instead of floor. Bags themselves cannot be pushed there —
  `BAG` is not in `SLIDES`.
- **Vacuum** — eats trash and fills up. The bounded version of fire: same job, natural limit, no
  cascade, and the exact inverse of the recycle bin. Gives trash a sink and makes the act's core
  tension an economy.
- **Rolled rug** — anisotropic: shoved along its axis it rolls, broadside it moves one cell.
  A new axis for FREE, because a multi-cell piece already knows its long axis from `pid` — no
  orientation field and no new `stateKey` lane, unlike a turnstile.
- **Magnet** — attracts metal, ignores everything else. First piece that treats other pieces as
  different kinds.
- **Umbrella** — closed one cell, open three; footprint mutation, and several unfold shapes are
  possible. Makes narrow lanes matter.
- **Kitty litter** — pours onto grease and cancels it. Terrain cancelling terrain; a reskin of
  the shed-a-load mechanic, which is what makes it cheap.
- **Sponge** — mirror of the jug (`{slides, soaks:true}` against `{slides, pours:true}`), one
  `tipOut` branch. Bound it by making a soaked sponge stay soaked, or it is an eraser.
- **Tire with momentum** — rolls, and shoves whatever it hits one cell. Action at a distance.
- **Ladder** — rigid 1x3 laid across water. The placeable-bridge idea that does not collide with
  the sponge, unlike a mattress (whose interesting properties are volumetric).
- **Office chair on castors** — MOVES WHEN HIT BY TRASH, one cell, fleeing directly away from the
  bag that burst. This is the one that changes what tearing IS: the fan stops being purely a cost
  and becomes an aimed action. The direction is already unambiguous in the data model — the tear
  branch pushes `spawned` entries carrying `from: [tx, ty]` under the comment "one origin for the
  whole fan" — so a five-cell spray still yields one ray. Telegraph it by extending the existing
  pale-yellow fan preview to show the knock-on; no new HUD vocabulary. One hop per hit, and NO
  chaining — a knocked piece knocking another destroys the predictability the preview promises.
  Deliberately not an animal: `TODO.md` parks agency until the raccoon-alone game proves fun, and
  a cat would quietly answer the crow question. A castored chair telegraphs "this rolls" in its
  sprite and opens no doors. Not a way across water.
- **Fence / railing** — nothing may REST on it, raccoon may cross. Separates "where I can walk"
  from "where anything can sit", which is currently one predicate (`isOccupiable`) doing two
  jobs; splitting it for one flag gives cells that forbid particular tear DIRECTIONS while
  leaving the route untouched. **Open question: "cross but do not stay on" has no representation
  while every move lands on a cell.** Either he may stand on it, or it is a wall to him too, or
  movement gains a step-through rule. Decide before building.
- **Tar / wet paint** — a pushed object that enters stops forever; grease's opposite, same
  machinery, and the pair is legible because they are opposites. **Open question: the raccoon
  should be able to walk on it, which is exactly what tar and wet paint argue against.** Either
  the theme changes or the rule does.
- **Filing cabinet** — closed it is one cell; shoved, the drawer slides out one cell in a FIXED
  direction and it becomes two cells blocking a lane it was not blocking. Directional footprint
  mutation, and self-telegraphing in a way the umbrella is not, because the drawer's facing is
  visible. Overlaps the umbrella enough that one of the two is probably redundant.
- **Bicycle wheel (one cell) and bicycle (two cells)** — the wheel rolls; the bicycle is
  anisotropic, rolling along its length and dragging one cell sideways. The two-cell version gets
  its axis free from `pid`, like the rug.
- **Pane of glass** — one cell. Shove it and it SHATTERS into the next cell: a bag's tear with a
  single-cell footprint instead of a five-cell fan, triggered by a push rather than a tear. The
  precise instrument — one cell of trash exactly where aimed, which over water is exactly one
  bridge cell.
- **Wheelbarrow** — one cell, with a FIXED push direction. The turnstile's directionality carried
  on an object instead of a terrain lane, so it needs no new cell field, and the shape says it.
- **Pull, as a verb** — a second grammar for all eight mechanics at once, and the largest rules
  change on the list. The usual objection (pull makes deadlocks reversible) does not bite here:
  our permanence is trash and water, not piece position.

Rejected: rope (wants to be looser than a grid), broken glass as a floor hazard (bags never
travel — `BAG` is not pushable at all; the pane of glass above is the idea that survives),
mattress (a sponge in bigger clothes; its real properties need 3D), a cat or any creature (see
the office chair), **sorting destinations** (blue-bin items to the blue bin — it would make the
game read as sorting rather than clearing, and it is a goal-structure change touching `isWon`,
`bagsLeft`, the solver's win detection and every level file; declined).

**Where to mine for more.** The trash encyclopedias are the wrong shape — *Encyclopedia of
Consumption and Waste* (Zimring & Rathje, SAGE 2012) and *Trash Talk* (Collin) are
garbology-as-sociology, about attitudes and policy, not object catalogues. Municipal sorting
wizards are better (Vancouver's lists 1,486 items), and **bulky-item / large-item pickup lists
are better still** — those are precisely the objects too big for a bin, which is to say the ones
you push.

### One engine

`CLAUDE.md` -> **One engine** is split by audience: agents may not write a second implementation
at all; the owner may, and the bill is stated. `verify.mjs` fails on a copy of any engine module
anywhere. `tools/conform.mjs` is the gate, at two grains — ANSWER (whole room) and STEP (one
board, one direction) — and an ANSWER failure re-runs at STEP grain so the report is the
shallowest board where the two part. A room that answers wrong while every step agrees is
reported as the port's SEARCH, not its rules. `tests/fixtures/bent-engine.mjs` bends one rule at
a time and the tests require each bend to be caught. **What the harness cannot catch is a bug
both engines share — see #20.**

### The three gates that hold the level design

1. **Dead travel.** `deadTravel(a)` in `metrics.mjs` (`lead`/`tail`, over the whole shortest-solve
   DAG). `resite.mjs` fixes it at the cause, per set, before `shrink`. `verify.mjs` bounds both
   at `WALK_MAX` (4); over the bound a room declares `:lead`/`:tail` and the number is checked.
2. **Sealed pieces.** Only bare floor is ever walled, so a wall pass walls AROUND a piece rather
   than away. `isOneRoom`; `verify`, `shrink` and `draft` all refuse it.
3. **Inert pieces.** A piece earns its cell by being HANDLED (some shortest solve touches it) or
   BINDING (remove it and par, solves or traps change). Both halves are load-bearing:
   binding-only fails L22, a tutorial whose can is shoved into its cart with par 5 either way;
   handled-only passes a wheelie parked where nothing goes.

A fourth is wanted for water rooms: **a forced crossing is a cutscene.** Gate on how deep into
the solve the first bridge is laid, and on how many bridging seats the opening board offers.

### Still worth trusting

- **Trap position beats trap count.** Score on `onPath`/`firstOnPath`, never on `:traps`.
- **Losable and self-announcing pull against each other**, and the lake makes it worse: `blind`
  median 52 against the H family's 37. Only 3 lake rooms in 25,600 have `onPath >= 0.15` with
  `blind <= 12`. This is why the solvability indicator is load-bearing rather than a nicety —
  it announces death immediately, so a long `blind` is a pointless walk rather than a cruelty.
- **The recycle bin is not a problem.** It tops the fertility map (86.6 solvable per 1000) because
  one shove slides it, sheds permanent trash beyond it, and leaves an empty bin. Act 2 carries it
  in 27 of 30 rooms and that is a finding. Piece share is `:traps` all over again — a count
  standing in for an experience.
- **Fertility, solvable per 1000:** `B` 86.6, `P` 62.0, `x` 50.4, `j` 45.7, `$` 42.6, `F` 41.9,
  `w` 40.4, `c` 32.6, `W` 30.8, `C` 14.0, `S` 5.1. By family, at equal settings: lake 68.8,
  H 46.8, ring 28.1.
- **A cart shoved into open water is NOT a problem** and the item is struck. Undo is free and
  unbounded, and the indicator prints `✕ unwinnable — undo or restart` the moment the board dies.
  A move you can take back after being told it was fatal is a puzzle. Do not re-open it.

### Discipline that has caught every refactor

**Any pipeline change must be proved byte-identical.** Regenerate and `diff` — `sets.mjs` against
`levels/sets.jsonl`, `harvest.mjs` against a same-flags baseline. Do not trust a green test suite
alone for tool changes. Every change this session was proved this way. Note `levels/harvest.jsonl`
(6,651 rows) was NOT generated with default flags — defaults produce 1,811 — so diff against a
fresh baseline, not against the committed file.

`tools/pool.mjs` is the shared worker pool and hands results back at the index they were dealt;
`sets.mjs` is the one pass that cannot use it, because `search` draws a whole chunk from one
seeded stream.

### Run it

`./run.sh` · `npm test` (268) · `node tools/verify.mjs` · `node tools/conform.mjs` ·
`cargo build --release --manifest-path engine/Cargo.toml && node tools/conform.mjs --engine
engine/target/release/tt-engine` · `node tools/build-artifact.mjs`.
`engine/target/` is gitignored — **build the port before any discovery run** or every tool
silently falls back to `src/solver.js` at ~10x the cost. Each run prints which engine it used.

The port's standing proof, five seeds (7, 101, 2718, 31337, 424242) at
`--steps 1000000 --random 250`: 1,548 rooms, 7,597,380 board-and-direction vectors, zero
disagreements. Re-run after any change to `engine/`, and re-run both bends after any change to
the harness.

`main`, everything committed, tree clean.

## Next Step

**Stage E4, the anisotropic rollers** — and the first move is not a piece, it is the predicate.
`isRoller(c)` has to become `rollsAlong(c, dx, dy)`, because the car tire rolls along one axis
and moves a single cell across it. The Stage D train is built on that predicate, so the train
becomes direction-aware in the same change; do that first, with the transfer specs green, and
the three pieces are then ordinary.

Watch two things a piece added late will otherwise trip over: an occupant with no drawing throws
rather than rendering nothing, and a consumed piece names itself in `gone` by the cell the STAGE
holds it at, which is where it started.

/home/menser/Dropbox/ai/code/treasure_trash
