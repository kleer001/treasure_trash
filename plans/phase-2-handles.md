# Phase 2 — the derived handle

Read `README.md` in this directory first, and phase 0, which builds the helper this phase starts
using.

## What a handle is

A pure function of the board a step ran on: the cell a thing occupies, plus which depth lane it
sits in, in raster order. Nothing else. It is not a counter, it is not stored on the board, and it
is not carried between steps.

Two properties follow, and both matter:

- **It cannot drift.** There is no second copy of it to fall out of step with the board, because
  it is not a copy of anything — it is a reading of the board, taken the same way by everyone who
  takes it.
- **It is reproducible.** A replay, an undo, and a fresh session all compute the same handles for
  the same board, because nothing about it depends on session history. A counter would not have
  this, which is why it is not a counter.

## Who calls the helper

Exactly two callers, and the whole point is that they are two:

- the ENGINE, stamping each event with the handle of the thing it is about, at the moment the
  account is settled — where both the before-board and the after-board are in hand;
- the STAGE BUILDER, stamping each sprite as it mints it.

The renderer then holds a handle-to-sprite map for the action and looks entries up. It does not
search, and there is no case in which it cannot tell.

## What this deletes

- `find()` and its tie-breaking on kind, cell and depth;
- `wasDepth`, whose only job was to say where the stage is holding a thing as against where it
  lands;
- `fromCart`, whose only job was to say "the sprite you are looking for changed kind, so do not
  search by kind" — a handle does not care what a thing turned into;
- the five throw sites that mean "I searched and could not tell". One assertion replaces them:
  a handle that does not resolve.

`depth` survives, demoted. It stops being an identifier and goes back to being what it always
described: how deep inside a cell's contents a thing rests. The renderer still needs it to draw.

## The honest cost

Every branch in `src/rules.js` that emits an event has to name WHICH participant it means.
Several of them currently get to be vague and let the renderer work it out — the scoop, the
shed, a thing that becomes another thing. Those branches are where the defects were, so naming
them is the work rather than a tax on it. Expect this to be the widest edit of the four phases,
and expect it to be in the engine of record.

## Done when

- one helper, exported from `src/`, is the only definition of a handle anywhere;
- the renderer resolves by map and contains no search;
- `wasDepth` and `fromCart` are gone;
- the phase 0 assertions still pass, having been written before this phase existed;
- every gate reproduces its baseline.

## Risk

That the assertions from phase 0 become self-satisfying now that both sides call one helper. They
were written to survive this, and assertion 3 — handle continuity across a step — is the one that
still bites, because it compares the account against the BOARD rather than against the stage. If
that assertion ever has to be weakened to make this phase pass, stop: the weakening is the bug.
