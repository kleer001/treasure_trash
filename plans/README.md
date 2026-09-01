# The account rework — shared context

**This directory is scaffolding and it gets deleted when phase 3 lands.** It exists because the
work is four passes long, each pass is verified by a gate that takes a quarter of an hour, and
the reasoning that justifies the design is worth more than the diff.

Read this file before any phase file. The phase files assume it.

## What is wrong

`src/rules.js` emits an ACCOUNT — a per-action record of what happened, built only when a caller
asks for `{ trace: true }`, and consumed by the renderer, by `tools/metrics.mjs`, by
`tools/matrix.mjs` and by the debug panel.

The board names things POSITIONALLY: a cell carries an occupant code, and that is the whole of a
single-cell thing's identity. Multi-cell pieces and carts additionally carry an id, because their
codes do not determine the partition — four furniture cells are one couch or two.

The account inherited that. It describes occupants positionally and pieces by id. So every
consumer that needs to know WHICH THING an entry refers to has to re-derive it, and each one
re-derives it differently:

- the renderer searches its sprites by kind, cell and depth, and throws in five places when the
  search cannot tell;
- `depth`, `wasDepth` and `fromCart` exist only to make that search resolve — `fromCart` most
  plainly, because a barrow that is scooped up stops being a cart, so a search by kind finds the
  wrong sprite;
- a metric that collected disturbed cells read only the occupant lanes, so a bicycle sent four
  cells down a corridor by a rolling rug counted as scenery, and rooms were rejected for a reason
  that was not true.

The last one is the point. This is not a rendering inconvenience. The account has several
consumers, it is lossy about half its participants, and each consumer gets a different wrong
answer, silently.

## What is NOT being changed

**The board.** Ids stay exactly where the codes underdetermine it, and nowhere else. Two cans in
two cells are two cans in either order; giving them ids would add state the solver must then
canonicalise away, on the hot path of an enumeration that is most of the offline pipeline's
compute. That criterion is correct and it stays.

The argument that had to be refused is a step longer than it looks: *the solver must not carry
identity* is true, and *therefore the account must not* does not follow from it. There are as
many accounts as there are steps on a path, not as many as there are states. The cost that
governs the board has no purchase here.

## The decision: handles are DERIVED, not stored

Every participant in an account gets a HANDLE. A handle is a pure function of the board the step
ran on — cell and depth lane, raster order — computed by one helper in `src/` that both the
engine and the stage builder call. It is never a counter, and it is never stored on the board.

The rejected alternative was a room-scoped identity overlay: a side table mapping handle to cells,
created at room load and threaded through every mutation. It is more powerful — it would give
identity that survives a whole solution — and it is the wrong trade here, because it is a second
representation of what the board already knows, and a second representation can silently disagree
with the first. Every defect this rework is answering was of exactly that shape. A derived handle
cannot drift: there is nothing to keep in sync.

What that forfeits, stated plainly so nobody has to rediscover it: handles are addresses, not
identities. They do not survive across steps, so nothing here supports a per-object metric across
a whole solution, or a replay scrubber that follows one object. Neither is wanted. If one becomes
wanted, this decision is the one to revisit, and the overlay is what to revisit it with.

## The order, and why phase 0 is first

0. Extend the invariant.
1. Every removal in one lane.
2. The derived handle.
3. One lane per fact, keyed by handle.

Phase 0 is not preparation, it is a precondition. `tools/matrix.mjs` currently holds the only
independent check on the account, and it holds BECAUSE the two sides derive identity by different
routes: the account describes, the stage searches, and a disagreement shows up. Once both call the
same handle helper they agree by construction — the invariant keeps passing while both sides are
wrong together.

The failure it goes blind to is specific and nasty: the census compares the SET of sprites a step
produces against a stage rebuilt from the board, so two handles swapped between two sprites that
draw alike yields an identical set. The board comparison cannot see it, the sprite comparison
cannot see it, and what reaches a player is a piece that animates out of the wrong cell —
cosmetic, intermittent, and impossible to attribute later.

So the detector is extended before the thing it must detect is built.

## The gates, and what they cost

Every phase is finished only when all of these are green. The browser sweep is the expensive one
at roughly a quarter of an hour, which is why phases are batched rather than landed one at a time.

| gate | command | what it proves |
|---|---|---|
| rules specs | `npm run test_rules` | the engine still decides what it decided |
| suite | `npm test` | as above plus the file-reading specs |
| matrix | `node tools/matrix.mjs` | the ACCOUNT of a move matches the board it produced |
| conformance | `node tools/conform.mjs` | every implementation of the rules still agrees |
| pack | `node tools/verify.mjs levels/teach.tt` | every claim the teaching rooms make |
| acts | `node tools/verify.mjs` | the shipped packs, against their recorded baseline |
| sweep | `__tt.sweep(plan)` in the browser | the real input path, on screen |

The sweep needs a served page and a plan:

```sh
./run.sh                                   # note which port it lands on
node tools/sweep.mjs scratch.tt --write    # writes levels/sweep-scratch.json
# then, on index.html?acts=scratch.tt&debug :
#   const plan = await (await fetch('/levels/sweep-scratch.json')).json();
#   await window.__tt.sweep(plan);
```

A baseline is not a target to beat, it is a number to reproduce. Record what each gate says before
a phase starts and compare after; a gate that moves is the phase's doing until proved otherwise.
