fresh

## Summary

**The hold rework is the live thread.** `lk` — one colour painted across a holder and everything
it held — is gone. A hold is now an EDGE written on the holder: `grip`, the signed offset along
its own axis to what it has hold of. Nothing is written on the held body, so several holders can
have hold of one thing and the complex is derived rather than stored.

Steps one and two are landed and green. Sharing needed no work at all: the refusal that blocked it
existed to protect a field on the target, and the target has no field any more. A real bug went
with it — a magnet captured by another magnet used to be released inside the same settle sweep,
because it read its holder as its own load. Measured before and after; it holds now.

Before this: the shopping cart became the SKATEBOARD everywhere including the Rust port, with new
art; `TODO.md` was deleted and its live items moved here; the studio pin reached v0.25.0 carrying
a directive written from this repo.

## Todos

### Parallel

- [ ] #60 **Open rule: should a slider carried by grease hand off momentum?** A roller
      crossing a slick into another roller transfers correctly. A can skating three cells into
      a tyre transfers nothing — consistent with a can never handing off on dry, but "momentum
      always lands somewhere" reads otherwise.

- [ ] #51 **The crow is still pinned.** Un-pin and design its powers, or leave it. Naming it
      lands occupant codes, refusals and `stateKey` lanes on every implementation at once.

- [ ] #71 **A PARALLEL SESSION IS EDITING THIS REPO — read the tree before trusting a number.**
      `levels/act1.tt`, `act2.tt`, both `.sol` files and `levels.md` were rewritten outside this
      session: pars and solves repaired, `L19` from par 9 to 17 and traps 1 to 3. `research/`
      arrived alongside it — competitive and marketing notes. All of it is UNCOMMITTED and must
      stay that way until its author says otherwise; every commit made here was path-scoped so
      none of it was swept in. It also explains a number that looked like a win: `verify.mjs`
      went from 63 failures to 7, and that was the par repair, not any change made here — proved
      by stashing and re-running, which gave 7 both ways. `verify.mjs` has no write path, so
      nothing automated could have done it. **`git status` before attributing any gate result.**

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

- [ ] #67 **Parked idea, not approved work: the roller skate.** A ROLLER SKATE is the
      one-cell version of the skateboard — the slot the barrow already occupies structurally
      but not fictionally. On the record before the vocabulary settles; nobody is asking for
      it yet.

## The link rework — approved design, in progress

**The problem with `lk`.** It is a group COLOUR: one id painted on the magnet's cell and on every
cell of what it holds, recovered by scanning. A colour cannot express sharing (one cell, one
scalar) and cannot express structure (no edges, so `towOrBreak` can only clear the WHOLE group and
re-decide). Both of the asks — several magnets on one object, and scraping one connection off
against a blocker — are blocked by that single fact. `lk` is also the lane the barrow's tow rides
in, and the direction of the hold is not recorded, which is where the observed bug below comes
from.

**The representation.** Drop `lk`. A holder stores `grip` — the distance along its own facing to
what it holds, an integer 1..`MAGNET_REACH`. Nothing is written on the held object at all.

- **Sharing is free.** Two magnets each carry their own `grip`; both resolve to the same cell.
- **Direction is explicit.** `grip` lives on the holder, so a held magnet reads its own `grip`
  (what IT holds) and never mistakes its holder for its load.
- **The complex is derived**, the way `bodyCells`, `pieceCells` and `cartCells` already derive
  theirs: from each gripping holder, the held cell is `holder + facing * grip`, expanded through
  `bodyCells`, and recursed for a held magnet that grips something itself.
- **`towMove` needs no change.** It already takes a cell list, computes the blame frontier and
  moves everything in lockstep; feed it the derived component instead of `linkCells`.
- **Scrape is the blame set.** `towMove` already reports WHICH cells could not travel. Walk back
  from those to the holders gripping them, clear only those grips, keep the rest, retry.
- **The let-go check collapses.** `held.every(onLine)` plus a wholesale clear becomes: is there
  still metal at `holder + facing * grip`? Same predicate the scrape uses.
- **`stateKey` gets simpler, not riskier.** The link lane today is a label map canonicalised by
  first appearance. A small integer per holder cell is canonical for free — the map goes away.

**The anchor rule.** Capture currently drags the metal to the magnet, which changes every other
magnet's field and is what makes the settle sweep order-dependent. Instead: metal already held by
someone is an ANCHOR — a loose magnet coming into range travels to IT. Only loose magnets move, they
move toward, and the distance is bounded by the reach, so the sweep becomes monotone and no pass can
undo an earlier one. That is what makes iterating to closure affordable, and it has a sentence a
player can read off the board: **metal only moves when something shoves it; a loose magnet walks to
the metal.** Settle becomes a worklist of the magnets that moved rather than one raster pass.

Still order-dependent in one place, by design: two loose magnets reaching the same loose metal on
the same sweep, where whoever is reached first becomes the anchor.

### Open, and needed before the scrape lands

- [ ] #69 **Does a scraped grip stay cleared for the rest of the beat?** Objects do not stop the
      field — a magnet grips through a two-cell couch, verified — so a scraped magnet is usually
      still looking straight at what it lost. If the settle re-grips on the same beat, scraping is
      a no-op by construction and nothing on screen ever shows it. If the cut persists, dragging a
      load past a blocker to strip a magnet off it becomes a technique. Same question as #59 for
      the barrow's hook, and it should be answered once for both.

### Magnets holding magnets — was broken, now works

Measured before the swap and after it. Before, a magnet captured by another was released inside the
same settle sweep: the held one read its holder as its own load, found it behind its facing and
cleared the group. `grip` records direction, so it cannot happen.

| board | before | after |
|---|---|---|
| `q` x2, `q` x3 — adjacent, same facing | no hold at all | holds |
| `q` x2, `q` x4, can x6 | the first loses the second | chain: first → second → can |
| `q` x2, `p` x4 — held magnet faces back | held, the only case that survived | mutual hold, both ends |

Two magnets facing each other now hold each other. `complexCells` walks cycles safely; whether a
mutual hold is the rule is the owner's, and nobody has played one yet.

### Order of work

1. ~~Swap `lk` for `grip`; derive the complex.~~ **Done.** All gates green: 367/367 rules specs,
   `npm test` 402/2 at its `deadscan` baseline, `matrix.mjs` 1820 unchanged, `conform.mjs`
   reference ALL AGREE, `verify.mjs` identical with and without the change, and the browser sweep
   clean at 63 runs / 153 meetings through the real input path.
2. ~~Sharing.~~ **Done, by construction** — the refusal it needed was a field on the target, and
   the target has no field now. A magnet takes hold of a barrow that is already towing and the
   tow survives; the spec asserts it.
3. **Next: the anchor rule and the settle worklist.** Capture still drags the metal to the magnet,
   which is what keeps the sweep order-dependent.
4. Scrape, once #69 is answered. `towOrBreak` still clears every grip in the complex rather than
   the ones holding the blocked cells — which was invisible while a complex had one edge in it and
   is not any more.
5. Draw the connection — see #70.

- [ ] #70 **The hold is invisible.** `lk` appears nowhere in `stage.js` or `sprites.js`: the magnet
      has a sprite, the hold has none. Survivable while a complex is one magnet and one can; the
      moment complexes are shared and scrape-able the player is being asked to reason about a
      structure the screen does not show, and a scrape reads as the game dropping things at random.

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

**The anchor rule — step 3 of the hold rework.** Capture still drags the metal to the magnet,
which is the thing that keeps the settle sweep order-dependent. The owner's rule: metal already
held is an ANCHOR, and a loose magnet coming into range travels to IT. Only loose magnets move,
they move toward, and the reach bounds the distance — so the sweep becomes monotone, no pass can
undo an earlier one, and iterating to closure stops being the unreadable rule it is today. Settle
becomes a worklist of the magnets that moved.

Then #69 has to be answered before the scrape can land, and it is no longer theoretical:
`towOrBreak` clears EVERY grip in the complex rather than the ones holding the blocked cells. That
was invisible while a complex had one edge in it, and complexes now have more.

**#48 — rebuild the rooms.** It is the root of the red build, and #47 and #64 both resolve
behind it. Everything else on this list is a design decision with no dependents.

/home/menser/Dropbox/ai/code/treasure_trash
