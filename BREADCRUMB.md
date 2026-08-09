fresh

## Summary

Act 1 closed at 31 rooms (L0–L30). **Act 2 is now 27 rooms (L31–L57), nine sets of three** —
re-cut this session after three design faults were found in the shipped thirty: exits parked far
past the last decision, pieces sealed in pockets, and pieces doing nothing at all. Each fault is
now a gate rather than a fix, so it cannot come back.

The open work is still **writing**: every Act 2 room carries a `TODO name L31`-style placeholder
and the HUD shows it to the player.

## Todos

### Parallel
- [ ] #11 **Name Act 2.** 27 rooms need a `:name` and a `:note` in `levels/act2.tt`, and the
      matching name in the `levels.md` Act 2 table. Each `:note` already records the set and its
      ramp, which is the context to write from. `verify.mjs` does not require a name, so nothing
      fails today — it just reads wrong.
- [ ] #16 **Act 2 is a set short of ten, and the bin cap is why.** 21 of the 22 fully-clean
      candidate sets carry a recycle bin; the bin hits its 0.8 share at nine sets. Two ways out,
      both one command: `node tools/act2.mjs --maxpiece 0.9` (tenth set, bin in 27 of 30 rooms),
      or a wider `sets.mjs` search — but only one candidate set in the file is bin-free, so that
      is unlikely to be the cheap one. Deliberately not decided for you.
- [ ] #17 **Port the engine — staged, and stage 1 is the point.** See *The port* below.
- [ ] #10 **Decide the stack's fate.** `S` is last in the roster by an order of magnitude — 5.1
      solvable rooms per 1000 placements against 62.5 for every group without it. It appears in
      no shipped Act 2 room. Cut it, or keep it as an expert-act piece; it will not carry an
      introduction.
- [ ] #5 **A cart rolls into open water and comes to rest there.** Nothing stops it, the water is
      unchanged, and the raccoon can neither follow it nor stand on it — a cart can be lost
      permanently, by accident, with no warning. Undesigned rather than broken; costs nothing
      until a room holds both a canal and a cart.
- [ ] #12 **`tools/build-artifact.mjs` does not build**, and did not before any of this work: the
      win-chime `fetch` in `main.js` survives bundling and trips the tool's own CSP guard. The
      served game is unaffected; only the single-file publish path is.
- [ ] #15 **Workers in `survey` and `harvest` still push results in completion order**, so their
      output files reorder themselves run to run. `tools/set-pass.mjs` is now the fixed shape —
      carry the input index through and reassemble by it. (`sets.mjs` still needs it too.)
- [ ] #13 **Render through the compositor.** `main.js` draws straight to the canvas; the house
      pattern is ordered layers via `src/compositor.js`, which the game still does not import.
      Worth doing before the art pass.
- [ ] #18 **`draft-room.mjs`'s `rooms()` is the redundancy `reroot` was written for.** It yields
      the product of every exit cell × every raccoon cell and each is enumerated from scratch,
      but for a fixed board and exit every raccoon start shares one graph. Nothing hot goes
      through it today, which is the only reason it is still there.

## Context

### This session: three faults, three gates

Each was found by looking, then turned into something that fails a build.

1. **Dead travel.** `placeOn` threw the exit and the raccoon at random cells and nothing ever
   looked again — par counts the walk, `walks` counts it wherever it falls, `onPath` is a rate
   over a par the walk inflates. L31 shipped at par 23 with ten moves after its last decision.
   → `deadTravel(a)` in `metrics.mjs` names it (`lead`/`tail`, over the whole shortest-solve DAG).
   `tools/resite.mjs` fixes it at the cause, per set, before `shrink`. `verify.mjs` bounds both
   at `WALK_MAX` (4); over the bound a room declares `:lead`/`:tail` and the number is checked
   exactly. Act 1's L12 "The Far Side" declares — distance is its teach line.
   **Result: worst lead 11→3, worst tail 12→3.**
2. **Sealed pieces.** Only bare floor is ever walled, so a wall pass cannot wall a piece away —
   it walls *around* it. L52 had a cart in a sealed pocket, L58–60 a trash pile in a hole.
   → `isOneRoom` in `metrics.mjs`; `verify`, `shrink` and `draft` all refuse it.
3. **Inert pieces** — the real fault, of which #2 was only the visible half. A piece can sit in
   the open, on a route, reachable, and do nothing. → `inertPieces`. A piece earns its cell by
   being **HANDLED** (some shortest solve touches it) or **BINDING** (remove it and par, solves
   or traps change). Either suffices, and both halves are load-bearing: load-bearing-only would
   fail L22, a tutorial whose can is shoved into its cart with par 5 either way; handled-only
   would pass a wheelie parked where nothing goes. **Act 1's 73 pieces clear it untouched** —
   that is the evidence the definition is right. Enforced in `sets`, `harvest`, `shrink`,
   `draft`, `chooseSets` and `verify`. The wall pass was the biggest *source*: 18 dirty sets of
   56 became 34; guarding `shrink` puts it back to 24.

### The port

Decided: **Rust**, unless C++ is already your daily language — then C++, and the harness does not
care. One reason decides it. The canonical `:solve` is a tie-break on *discovery order*. Rust's
`HashMap` is randomly seeded per process, so the naive version emits a different `:solve` on
every run and conformance fails on day one, pushing you to the `Vec` + index table you needed
anyway. C++'s `unordered_map` is deterministic within a build but shifts with libstdc++ version
and load factor — passes locally, drifts later on CI or a compiler upgrade. Same bug; Rust fails
loudly, C++ quietly.

Stages, in order:

1. **`step` only.** Reply `{unsupported:true}` to `answer`. `conform.mjs` handles that — it
   reports the skips loudly and **still runs the full step-grain sweep**, so you get ~38k
   validated rule vectors before writing any search. The rules are the hard part. Do not invert.
2. **`answer`.** 97 rooms on par/solves/traps/reachable/exitRefusals. `traps` is the subtle one:
   it means liveness is exactly right.
3. **Make the pipeline use it** — the step people skip. Conformance *proves* a port; it does not
   speed anything up, because `resite`/`shrink` call `analyze()` in process. Point them at the
   engine over the protocol instead (`answer` is coarse — one request per candidate against
   ~70ms of JS work today, so JSON overhead vanishes). The one thing the protocol cannot express
   is `reroot`; extend it: `{op:'open', grid}` → handle, `{op:'root', handle, at}` → answer.
   Keeps the graph engine-side and the design policy in JS.
4. **`SANCTIONED` in `verify.mjs` + CI** — `cargo build --release`, then the existing conform
   step with `--engine`.

Traps, from having built the JS side: **do not clone the board on a plain move** (sharing it was
1.9× here; a naive port throws it away and wonders why it is only 8×); same `maxStates` bound,
sent in the request, reported as `error` not as an answer; `blame` is out of contract, so a
conforming port is proven for the pipeline but not enough to drive the browser renderer.

Expect 20×+ (JS does ~57k states/s; a packed-board BFS with open addressing should do 1–5M).
Pipeline 21 min → 1–2 min. Estimate from the profile shape, not a measurement.

### One engine, and how a second becomes affordable

`CLAUDE.md` → **One engine** is now split by audience: agents may not write a second
implementation at all; the owner may, and the bill is stated. `verify.mjs` walks the whole tree
and fails on a second copy of any engine module anywhere (it used to scan root `.html` only — a
`tools/fast-rules.mjs` sailed straight through).

`tools/conform.mjs` is the gate that makes a port affordable. Two grains: **ANSWER** (whole room)
and **STEP** (one board, one direction). An ANSWER failure is re-run at STEP grain over every
state, so the report is the shallowest board where the two engines part — and a room that answers
wrong while every step agrees is reported as the port's *search*, not its rules.
`tools/conform-ref.mjs` speaks the protocol on top of `src/` and is what runs with no `--engine`,
so the gate is exercised every build. `tests/fixtures/bent-engine.mjs` bends one rule at a time
and the tests require each bend to be caught — a harness that cannot fail is a green light wired
to nothing.

### Performance work (all output byte-identical, proved)

- **Plain moves no longer copy the board.** `stepOnto` shares `s.cells`; sound because every
  writing path clones first. 27% of runtime was GC. **1.9×.**
- **`reroot` in `src/solver.js`.** Where the raccoon starts picks the search's root, not the
  graph — so `resite` was paying a full enumeration per candidate for an answer differing only
  in where counting began. Returns null when the new root reaches fewer states (then `dead`,
  `traps`, `exitRefusals` were counted over states the room no longer has).
  `tests/reroot.test.js` checks it against `analyze` on every start in every shipped room: 726
  agree exactly, 336 refuse and fall back.
- Measured: `analyze` 7425→3549ms · `resite` 3230→971s · `shrink` 572→258s.

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
- **Minicosmos pairs a layout with itself plus a stone** "as a nice way of providing hints" — the
  UPGRADE ramp translated for a game where an extra body chokes the board.

### Rebuilding the act

`sets.mjs` → **`resite.mjs`** → `shrink.mjs` → `act2.mjs`, then splice the emitted
`levels/act2.md` rows over the Act 2 table in `levels.md`, then `node tools/verify.mjs`.
Runtimes: resite ~16 min, shrink ~4 min, on 4 cores.

**The discipline that caught every refactor this session: any pipeline change must be proved
byte-identical** against `levels/sets.jsonl` and `levels/act2.tt`. Regenerate and `diff`. Do not
trust a green test suite alone for tool changes.

`levels/fertility.jsonl` (group map), `levels/harvest.jsonl` (6,651 rooms), `levels/sets.jsonl`
(56 candidate sets, re-sited and shrunk). Re-ranking is a query over these.

### Run it

`./run.sh` · `npm test` (246) · `node tools/verify.mjs` (both acts, 1,414 checks) ·
`node tools/conform.mjs` (97 rooms, 38k steps). All green at `da51a1e`.
Spot-check the gate itself: `node tools/conform.mjs --engine "node tests/fixtures/bent-engine.mjs miscall"`
must FAIL, and `... silent` must pass.

Branch `claude/level-design-exit-placement-gb3f04`, everything pushed, tree clean.

## Next Step

Name Act 2 (#11) — 27 rooms in `levels/act2.tt`, each with a `:note` recording its set and ramp,
same names into the `levels.md` table. Decide #16 first if you want the act to be thirty rooms,
since that changes which rooms need names.

/home/user/treasure_trash
