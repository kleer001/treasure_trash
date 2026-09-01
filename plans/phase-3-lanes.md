# Phase 3 — one lane per fact, keyed by handle

Read `README.md` in this directory first, and phase 2, which supplies the handle.

## The change

Three lanes, and only three: a thing arrived, a thing left, a thing moved. Every entry carries a
handle and a SPAN of cells. A single-cell occupant has a one-cell span. A couch has a four-cell
span. Nothing about the entry says which sort of citizen it is, because after phase 2 nothing
needs to ask.

`piece` folds into the movement lane. Its only remaining job was to name a body by id and offset,
which is what a handle and a span now do for everything.

The test that this landed: a consumer that wants to know which cells an action disturbed reads
three lanes and is correct by construction. It cannot read half of them and get a plausible wrong
answer, because there is no half to read.

## What this deletes

- the `ref`/`o` branching on entries, and the predicate that tells one from the other;
- the `piece` lane;
- whatever remains of one-lane-per-kind-of-thing anywhere in `src/` or `tools/`.

## Identity change, while the lanes are open

`becomes` says an occupant turned into a different occupant. Cart transitions said the same thing
in their own vocabulary and were deleted in phase 2. Check, once the lanes are one, whether a
single `becomes` on a handled entry covers every case. It probably does, and it should not be
forced if it does not — a cart transition rewrites a sprite's kind, its cells and its cargo
reference, and if that genuinely needs more than a new code, say so in the entry rather than
flattening a real difference to make a field count look tidy.

## Watch for

- The renderer draws a body as ONE sprite over several cells and an occupant as one sprite on
  one. That stays. It is a fact about drawing and this phase does not touch it: a span of four
  cells and four sprites are different things, and the stage decides which it is holding by what
  it minted, not by the shape of the entry.
- `shapeOf` and the census include several fields that default on read. With entries uniform,
  set them at construction so nothing has to remember what an absent one meant.

## Done when

- three lanes, every entry with a handle and a span;
- no consumer branches on which kind of thing an entry describes;
- the phase 0 assertions pass unchanged;
- every gate reproduces its baseline.

## Risk

Scope. The lanes touching everything is what makes this valuable and also what makes it easy to
carry an unrelated tidy-up along on the same diff. Keep `becomes` as the only identity question
opened here, and let anything else that looks tempting wait for its own pass with its own gates.
