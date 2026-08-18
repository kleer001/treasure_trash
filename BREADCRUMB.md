stale

## Summary

The decision backlog is worked. The two build plans are deleted, the studio pin is at
v0.25.0, the stale Rust binary is gone, and the clause that was missing upstream is now a
studio CONTRACT directive. Two open rules were answered "leave it as is". T5, the bench room
that afforded nothing, now has a piece to shove into its one-way.

Six commits here, one in the studio. **Nothing is pushed yet** — both repos are ahead of
their remotes.

What is left is the crow, one open rule, and the rooms rebuild that everything else waits on.

## Todos

### Parallel

- [ ] #60 **Open rule: should a slider carried by grease hand off momentum?** A roller
      crossing a slick into another roller transfers correctly. A can skating three cells into
      a tyre transfers nothing — consistent with a can never handing off on dry, but "momentum
      always lands somewhere" reads otherwise.

- [ ] #51 **The crow is still pinned.** Un-pin and design its powers, or leave it. Naming it
      lands occupant codes, refusals and `stateKey` lanes on every implementation at once.

- [ ] #64 **The port's sanction is nominally CI-gated, and the gate is not executing.**
      `test.yml` runs verify, conformance, the port build and the port's conformance AFTER
      `npm test` — which fails, so CI stops before reaching any of them. Resolves behind #48.

- [ ] #65 **The solver's representation change, inside `src/`.** About half of a discovery
      run's work is `analyze` itself and a sixth is garbage collection: string state keys
      hashed into a `Map`, one object per node, one per edge, one per back-pointer. Integer
      keys over a flat edge array plausibly buys another 2-4x — the same hours a second engine
      would buy, at none of its cost, and `CLAUDE.md` names it as the thing to spend first.

- [ ] #66 **Act 3 gets searched with the piece cap off.** `--maxpiece` is the last constraint
      in the chooser nobody has measured; it was set to keep one piece from owning an act, and
      then the recycle bin turned out to deserve the rooms it takes. Half buys 24 rooms, 0.8
      buys 27, 0.9 buys 30 — on the evidence so far the cap only ever costs sets. Run Act 3 at
      `--maxpiece 1` and judge the two acts on ramp mix, outline count, par band and `onPath`
      spread. If the unbounded pool wins, delete the flag rather than picking a new number.

### Sequential

- [ ] #48 **Rebuild the rooms from `TEACHING-PLAN.md`** (75 of them, renumbered after the
      stack). This is the root of the red build: the act1 pars are stale against the current
      ruleset, which is what `npm test` and `verify.mjs` are failing on, which is what stops
      CI before the conformance steps.

- [ ] #47 (needs: #48) **The Rust port is GATED — do not touch `engine/` without an explicit
      okay for that specific change.** It owes: the weight ruleset, the cabinet swap, the live
      magnet field, the stack cut, bodies on grease, the leading-cell rule, settle-at-load and
      the breaking hold. Its conformance run cannot report until #48 greens the build.

- [ ] #67 **Parked idea, not approved work: the roller skate.** If a skateboard is the
      two-cell rolling deck, a ROLLER SKATE is the one-cell version of the same thing — which
      is the slot the barrow already occupies structurally but not fictionally. Worth having
      on the record before the vocabulary settles; nobody is asking for it yet.

## Context

### The gates, and what "green" means here

- `npm run test_rules` — 367/367, the specs that never read a file.
- `npm test` — 402/2. Both failures are `deadscan` against stale act1 pars. BASELINE.
- `node tools/verify.mjs` — 63 failures, all act1 par/solve staleness. BASELINE.
- `node --test tests/bench.test.js` — green; it asserts every bench pack's declared solve
  still plays and that `:par` equals its length.
- `tools/matrix.mjs` green at 1820 cases. `tools/conform.mjs` reference ALL AGREE.
- CI (`test.yml`) is red at `npm test` and has been for months, so its four later steps —
  verify, conformance, the port build, the port's conformance — never run.

### The harness

- `tools/sweep.mjs` plans a bench pack's MEETINGS — piece against piece, piece onto lane —
  filtered to what a board can be driven to. **For a rules change, never a verdict on a room.**
  `levels/scratch.tt` now plans 28/32 rooms, 153 meetings; the four unplanned are over the
  board bound.
- `?debug` gives a play-by-play panel and `window.__tt`: `walk(keys)` presses through the
  game's own handler and compares the stage's sprites to a stage rebuilt from the board;
  `sweep(plan)` runs a whole plan. Screenshots are the failure artifact, not the check.

### Governance

- **`CLAUDE.md` § NO PROSE IS EVER A RULE** — no comment, doc, test name, `:teach` line or
  commit message decides what a piece does. A red test is the expected result of a rules
  change, not a veto. Never invent a rationale for prose you find.
- **NOTHING IS SHIPPED.** Never cite authored levels as the cost of a rules change.
- **Rules before levels.** The exception is `tests/bench.test.js` — satisfy it quietly.
- **The dead-board indicator stays a bare state.** Owner's call: it says the board is dead and
  does not name the move that killed it, and that is the answer, not a thin one.
- **A blocked barrow hook keeps re-taking.** Owner's call: the magnet field breaks when the
  group cannot travel and the hook does not, and the asymmetry stands.

### Studio

Pin is `.trace_rom_studio.toml` at **0.25.0**, level with the studio at
`/home/menser/Dropbox/ai/code/trace_rom_studio`. The 0.25.0 directive was written from here
and the brief already states every clause of it. The studio commit is local only.

## Next Step

**#48 — rebuild the rooms.** It is the root of the red build, and #47 and #64 both resolve
behind it. Everything else on this list is a design decision with no dependents.

/home/menser/Dropbox/ai/code/treasure_trash
