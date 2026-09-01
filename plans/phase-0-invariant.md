# Phase 0 — extend the invariant before anything can hide behind it

Read `README.md` in this directory first.

## Why this is first

`tools/matrix.mjs` asks one question: landing an action's steps on a stage must leave the same
sprites as building a stage from the board that action produced. It is the only check that reads
the ACCOUNT rather than the board, and it works today because the two sides of the comparison
reach their answer by different routes.

Phases 2 and 3 make both sides call one helper. From then on they agree by construction, and the
census — which compares a SORTED SET of sprite shapes — cannot see two handles swapped between
two sprites that draw alike.

So the check that survives the rework has to be written while the old routes still disagree, and
it has to fail on a fault deliberately introduced. A check that has never failed is a hope.

## What to add

Three assertions, all about handles, all cheap:

1. **Total.** Every sprite on a stage resolves to a handle.
2. **Injective.** No two sprites on one stage share a handle.
3. **Continuous.** Every handle named by an event exists in the board the step ran on, and every
   handle on the after-stage either traces to a handle on the before-stage or is named by an
   arrival entry.

The third is the one that catches the swap. The first two catch a helper that collides or that
misses a case — a body riding in a cart, a barrow inside a barrow, cargo at depth.

## Where it goes

In `tools/matrix.mjs`, beside the census comparison, so one harness carries the whole invariant
and there is no second place to remember. `tests/matrix.test.js` drives it over the shipped rooms;
the tool drives it over the forced meetings, which is where the odd pairings live.

Run it over the generated batch as well as the shipped rooms. The shipped rooms are a thin slice
of the interaction space, and the pairings that break identity are exactly the ones no level
author would think to build.

## The order this creates

Phase 0 can only assert 1 and 2 in a form that means something once a handle helper exists, and
the helper arrives in phase 2. Resolve that by writing the helper FIRST, in phase 0, with no
caller but the assertions:

- add the helper;
- add the three assertions, driven by the helper alone;
- prove they fail: hand-edit a step so two entries swap handles, watch assertion 3 fire, revert.

Nothing in `src/` changes shape in this phase. The engine and the renderer are untouched. That is
what makes the assertions independent of the thing they will later police.

## Done when

- the helper exists and is exported from `src/`;
- the three assertions run in `tools/matrix.mjs` over shipped rooms and generated ones;
- assertion 3 has been SEEN to fail on a deliberately swapped pair, and passes after revert;
- every gate in `README.md` reproduces its recorded baseline.

## Risk

The helper's definition of a depth lane is the whole of its correctness. A barrow riding in a
barrow is the same occupant code on the same cell, separated only by how deep it sits; if the
helper flattens that, assertion 2 fails immediately and loudly, which is the outcome to want. If
it flattens it in a way that still yields distinct handles for the wrong reason, nothing fires.
Test that case by hand before trusting the assertions.
