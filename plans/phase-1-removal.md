# Phase 1 — every removal in one lane

Read `README.md` in this directory first.

## The fault

"This thing left the board" is currently said two ways.

An occupant that leaves is an entry in `gone`. A body that leaves is an ADJECTIVE: an `effect`
string on the entry that moved it, which the renderer translates into removal by testing that
string against a set. A body was brought into `gone` in an earlier pass; occupants that fall
through a grate were not, so the asymmetry survives pointing the other way — a can sliding into a
grate is a `moved` entry with `effect: 'falls'` and an empty `gone`.

The tell is two sets in two files answering the same question with overlapping membership, kept
equal by hand. Adding an effect means remembering both.

## The change

Every removal is a `gone` entry, occupants included. `effect` stops meaning "it left" and means
only HOW it leaves — dropping through a hole reads differently from deflating in place, and that
difference is real and worth keeping.

A thing that travels and is then taken keeps both facts: the movement entry says it travelled,
the `gone` entry says it did not survive. That is already how a body over a grate is reported, and
it is what stops the renderer deflating a sprite on the cell it started from instead of the cell
that took it.

Both sets die. The renderer stops deciding what an effect means, and the predicate that scans
three lanes looking for one effect string becomes one scan of one lane.

## Watch for

- A removal that is currently implied by an effect and nothing else. Grep every effect string
  emitted anywhere and account for each one: which of them mean a thing left, which are only
  animation. `rest` means nothing happened and should probably not be emitted at all.
- The trace specs assert exact entry shapes. Several will need the new `gone` entry added to
  their expectations. A red spec here is the expected result of the change, not a veto — but read
  each one before editing it, because a spec that fails for a second reason is hiding in the batch.
- The renderer must not deflate a sprite twice when a step both moves and removes it.

## Done when

- no set of effect strings decides removal anywhere;
- `effect` appears only where an animation differs;
- every gate reproduces its baseline.

## Risk

An occupant removal that nothing currently reports, discovered only because the sprite now
survives the step. The matrix invariant catches this — a sprite the board has not got is exactly
what the census compares — so run it early and often rather than at the end.
