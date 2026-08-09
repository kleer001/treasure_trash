fresh

## Summary

Act 1 is 31 rooms (L0–L30). **Act 2 is 30 rooms (L31–L60), ten sets of three, and it is named.**
Nothing placeholder now reaches the player.

The rules have **two implementations**, on purpose and under proof: `src/rules.js` is the engine
of record, and `engine/` is a sanctioned Rust port. **It answers every op the protocol has, and
the discovery pipeline now runs on it.** The survey was 31.5 CPU-hours and is ~3; the whole
pipeline is about 32 CPU-hours down to about 3.6. Stages 1–3 are done where they paid.

## Todos

### Sequential
- [ ] #17c **`resite` and `shrink` are still on JS, and that is now a small number.** 16 min and
      4 min, against a pipeline that is ~3.6 CPU-hours. Wiring them is the EXPENSIVE one:
      `read()` → `readsAt` → `costAt` → the sweeps → `resiteSet` → `serve` is synchronous end to
      end, so a pipe makes all of it async in the most correctness-critical tool there is, and
      the proof cycle is a ~16-minute byte-identical run. It also wants two more protocol ops
      ({op:'open'} → handle, {op:'root'} → measure) because `reroot` is most of what `resite`
      does. Worth ~15 minutes a rebuild. Do it when it annoys you, not before.
- [ ] #17d (needs: #17c) **`:solve` is not in the protocol**, and only `resite`/`shrink` want it.
      It is a tie-break on DISCOVERY ORDER — the first shortest win the search reached. The Rust
      side already holds states in a `Vec` in insertion order behind an index table, precisely so
      this costs nothing to add; what it needs is back-pointers and a `formatLurd`. Do NOT reach
      for `HashMap` iteration order: Rust seeds its hasher per process, so it would emit a
      different tied solve every run.
- [ ] #17e **Retire the JS `maxStates` ceiling if the port earns it.** Bound is 50,000 states
      because `analyze` holds every one as a cloned board. Raising it lets the survey keep rooms
      it currently throws away — one placement in twenty on outlines, one in five on open
      rectangles — which is now affordable in a way it was not.

### Parallel
- [ ] #19 **Act 3: search with the piece cap OFF.** `--maxpiece` in `tools/act2.mjs` (default 0.9,
      passed through to `chooseSets` in `pick.mjs`) is the last unmeasured constraint in the
      chooser. It was kept as a backstop, not because an unbounded pool was tried and found bad —
      nothing has ever run without it. Half buys 24 rooms, 0.8 buys 27, 0.9 buys 30; the trend
      says the cap only ever costs sets. Run Act 3's chooser at `--maxpiece 1` and compare the
      acts on what a player can feel — ramp mix, outline count, par band, `onPath` spread — not on
      piece counts, which is the metric that set the cap in the first place. If an unbounded pool
      wins, drop the flag rather than re-tuning it.
- [ ] #13 **Render through the compositor.** `main.js` draws straight to the canvas; the house
      pattern is ordered layers via `src/compositor.js`, which the game still does not import.
      Worth doing before the art pass, and it is a real refactor of the draw loop — start it
      with a full context rather than at the end of one.
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

**Stages 1 and 2 are done, and the shape of the proof matters more than the code.** `engine/` is
Rust, zero dependencies (it must build in CI from a checkout with no network, beside a game that
has no build step). It answers `step`, `answer` and `measure`, and skips nothing.

- **Agreement measured:** see *Run it* for the current sweep. Every op, five seeds.
- **`measure` exists because `answer` is not what the pipeline decides on.** `resite`'s guard
  reads eight numbers; `answer` carries five. The missing four — `silentTraps`, `onPath`, `lead`,
  `tail` — are linear walks of a graph the enumeration already paid for, so they moved
  engine-side rather than the graph being shipped over the pipe for JS to finish. None of them is
  declared in a pack, which is exactly why `conform.mjs` asks `measure` of every room: nothing
  else in the tree would ever notice them being wrong.
- **Both bends demonstrated, not assumed.** Break a RULE — delete the raccoon's line in
  `tip_fits`, he is the one occupant `is_occupiable` cannot see — and conform.mjs names
  `act1.tt:L23`, the direction and the board. Break the SEARCH — count boards you can lose from
  instead of ways to lose — and it says *"traps: 16 vs 14, and every step of it agrees. The
  search differs, not the rules."* Do both again after any change to the harness. A third,
  `walk-off-by`, is a permanent test: it lies about `lead` and nothing else, and has to be caught.
- Registered in `SANCTIONED` in `verify.mjs`, which prints both files on every run. CI builds it
  and runs `--steps 1000000 --random 120` against it.

**Speed: 14.5× over `src/solver.js`** on the 61 shipped rooms at answer grain, including JSON and
a pipe round trip per room. **The earlier 20×+ estimate was wrong** — treat it as retired. Three
things got it from 6.3×, and callgrind picked all three: `explain`, the actual rules, was THREE
PERCENT of instructions, while `state_key` was 33.6% and the allocator serving it another 22%.
The port was slow at its own bookkeeping, not at the game. Fixes: share the board on a plain move
(`State.cells` is an `Rc`, `at_mut` is the one door in); reuse the key buffers instead of
allocating per call, and drop the `format!` that rendered two coordinates as text; and stop
describing wall cells in the key, since nothing ever writes one.

**Measured and rejected:** swapping SipHash for FNV-1a. Best-of-five, interleaved: 154 ms vs
155 ms. Hashing is not the bottleneck, so that code does not ship. What is left is probably the
`Vec<u8>` allocated per key and a full `State` held per node.

**Still true from the JS side:** same `maxStates` bound, sent in the request, reported as `error`
and not as an answer; `blame` and the traced frames are out of contract, so a conforming port is
proven for the pipeline and is *not* enough to drive the browser renderer. `Rc` is not `Send` — a
threaded stage 3 wants `Arc`, which is a one-word change.

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

### The bin is not a problem, and the hunt for bin-free sets is called off

**Act 2 has the recycle bin in 27 of its 30 rooms and that is right.** The 0.9 cap was read as a
compromise; it is not. One shove slides the bin a cell, sheds PERMANENT trash a cell beyond it,
and leaves an empty bin behind — a body moves, an obstacle lands where the player chose to put it,
and the piece changes state. Nothing else in the roster does that much at once, which is why it
tops the fertility map at 86.6 solvable per 1000 against 62.0 for the next piece.

**Measured, not argued.** A bin-free search ten times deeper than the one that built this act
returned eight sets, all with viable pars — and NOT ONE of them an upgrade. The upgrade ramp fills
a container each rung (`c`→`C`, `w`→`W`, `b`→`B`), and the bin is the container that reliably
makes a room. Among eligible candidates the split is 6 upgrade-with-bin to 1 without. Squeezing
the bin does not flatten the act; it deletes its best device, the Minicosmos one the code itself
calls the hardest ramp to find.

**The mistake worth remembering: piece share is `:traps` all over again** — a count standing in
for an experience. This repo already knows to score on `onPath` rather than trap count, and the
same reasoning applies here. Variety the player can feel is ramp, outline and where the trap
sits, all of which Act 2 already spreads: ten outlines, three ramps, pars 8–32, onPath 0–17%.

Also corrected: `act2.mjs` and `levels.md` both claimed "only ONE candidate set is bin-free". It
is five (two carry no bin of either kind). Both now say what was measured.

The cap stays at 0.9 for the shipped act rather than being pulled out from under it, and
`act2.mjs` prints the piece counts every run so the spread stays visible. Taking it off is #19,
and it is Act 3's job — a chooser change is not worth re-emitting thirty named rooms for.

### Closed, so it does not get raised a third time

**A cart shoved into open water is NOT a problem, and #5 is struck.** It was filed as "a cart can
be lost permanently, by accident, with no warning," and every clause of that is false. Undo is
free and unbounded — `main.js` pushes a cloned state on every move, `u` and a button pop it. And
the room does warn: the solvability indicator prints `✕ unwinnable — undo or restart` the moment
the board goes dead. A move you can take back after being told it was fatal is a puzzle, not a
trap. Do not re-open this as a rules change.

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

### Where the pipeline's hours went, and where they are now

Measured, not guessed — the survey records its own `ms` per group and the file adds up.

| step | was | now |
|---|---|---|
| `survey` — 586 groups × 200 placements | **31.5 CPU-hours** | ~3 CPU-hours (10.4× measured) |
| `harvest` — 62 groups × 400, on outlines | ~37 CPU-min | ~15 CPU-min (2.4×) |
| `resite` | 16 min | 16 min, still JS |
| `shrink` | 4 min | 4 min, still JS |

**Survey was the whole problem and it needed no new engine work** — it judges a room on five
numbers the protocol already carried. Harvest is different: a full row wants the solve string,
trap depths, box-line shape and the inert test, none of it on the wire, so the engine SCREENS
there instead. Nine draws in ten never reach a full row, and the JS enumeration is paid a second
time only for the survivors.

Both tools draw their whole batch off the seeded stream first and ask afterwards — no draw
depends on how the last one scored — which is what lets two hundred boards go over in one breath
instead of two hundred round trips.

**Proved equal both ways.** Harvest is byte-identical. Survey matches on every field including
the `pars` arrays in order, excluding `ms`, which is a stopwatch reading and cannot match across
any two runs on any engine.

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
`node tools/build-artifact.mjs`. All green — 247 tests.
`survey` and `harvest` print which engine they used; `--no-engine` forces `src/solver.js`.

**The port's standing proof**, five seeds (7, 101, 2718, 31337, 424242) at
`--steps 1000000 --random 250`: 1,548 rooms, 1,548 answers, 7,597,380 board-and-direction
vectors, zero disagreements. Re-run it after any change to `engine/`, and re-run both bends
after any change to the harness.

Branch `claude/level-design-exit-placement-gb3f04`, everything pushed, tree clean.

## Next Step

The port has paid for itself and the pipeline thread can rest. **Go hunting, for Act 3**: `cargo
build --release --manifest-path engine/Cargo.toml`, then run `survey` deeper than 200 placements
a group — that is now hours instead of days, and a thicker fertility map is what feeds everything
downstream. Act 2's pool was thin, not broken; a deeper one and #19's unbounded piece pool are
the two things that change what the chooser has to work with.

On the game side the next thing with a deadline attached is #13, the compositor, which is
explicitly worth doing BEFORE the art pass.

/home/user/treasure_trash
