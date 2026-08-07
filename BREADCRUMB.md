fresh

## Summary

The cart's teaching act is built, verified and committed — L18–L30. The next job is the
**fertility survey**: sample mixed groups of pieces to find which combinations of the roster
make good rooms at all, then build the first real act out of the fertile ones.

The pack has only ever searched *homogeneous* piece sets — "one bag", "two bags", "three bags".
That is Sokoban's assumption, imported by accident: Sokoban has one piece type, so its whole
literature treats difficulty as a box-count question. This game has a roster, and the roster is
the game. The survey is the correction.

## Todos

### Parallel
- [ ] #1 **The fertility survey.** ~715 multisets of four pieces from the roster × ~500 random
      placements each (~360k boards; minutes on 32 cores), on an 8×4. Output is a map of which
      groups yield solvable, interesting rooms at all — not levels. Two filters on the multiset
      *before* placing anything:
      **(a)** at least one bag-carrier (`$ C W S`), or `bagsLeft` is 0 and the room is won by
      walking to the exit; **(b)** at least one permanent emitter (`$ b j`), or it plays like
      generic Sokoban. `C` and `S` eject a bag but emit nothing permanent, so they do not
      satisfy (b). Sample randomly — `rooms()` enumerates, and this placement space is far too
      large to walk.
- [ ] #2 **A scorer worth the compute.** Rank candidates on where the traps sit, not how many;
      on distinctness from the rooms already chosen; and on order-sensitivity. Each is
      expensive per room, which is what the cores are for. Existing pieces: `hardness()` in the
      scratchpad notes below, and `tighten` in `tools/draft-room.mjs`.
- [ ] #3 **The solvability indicator** (also in `TODO.md`). `solver.js` computes deadness
      offline already; wire it to run after each state change and surface a non-blocking "can
      no longer be won". Best done before any long room ships — see the frustration note in
      Context.
- [ ] #4 Decide whether the cart appears in the real act at all. It multiplies the state graph
      about tenfold, which now costs scoring time rather than search time.
- [ ] #5 **A cart rolls into open water and comes to rest there.** Nothing stops it, the water
      is unchanged, and the raccoon can neither follow it nor stand on it — so a cart can be
      lost permanently, by accident, with no warning. Undesigned rather than broken. Costs
      nothing until a room holds both a canal and a cart.
- [ ] #6 The bag-on-can stack has no room. Every board found is par 14 with two solves at both
      5×4 and 6×4, and the cart's answer to a stack is identical to its answer to a full can.
      Cut unless a reason appears.

### Sequential
- [ ] #7 (needs: #1) Harvest deep on the groups that map as fertile. 500 samples ranks groups
      against each other; it surfaces only two or three solvable rooms for a good group, which
      is nowhere near enough to pick a level from.
- [ ] #8 (needs: #7) Build the act. Target ~20 rooms on a deliberate par curve, 14 climbing to
      35 — Microban's band, and roughly double the current ceiling of 23.

## Context

### Measured, and worth trusting

- **Not compute-bound; selection-bound.** A stratified sample of the 7×5 three-bag space:
  1.95% solvable, and 0.58% clear "par ≥ 14, ≤ 2 solves, ≥ 1 trap" — about 2.4 million
  interesting rooms in that one slice, one every 0.2s on 32 cores. Finding rooms is not the
  problem. Choosing twenty is.
- **Yields must be sampled stratified.** `rooms()` loops the exit position outermost, so the
  first N boards all share one exit. The same plan read 1.6% over the first 4000 boards and
  0.0% over the first 1500. Both were measuring one corner.
- **An exhaustive sweep is never required.** Par-minimality is proven per room by `analyze`;
  the search does not have to be exhaustive for the pack's guarantees to hold.
- **Verification scales; enumeration does not.** 8×8 with four bags and a cart is 42,662
  states and 4.2s to verify — but 2.4×10¹¹ boards to enumerate, about nine years on 32 cores.
  Hand-design plus `tighten` plus verify is the method above roughly 6×4.
- **An exact static pre-filter is worth ~2.2×.** Two tests — no bag can be struck on the
  opening board, and a bag whose every fan direction hits wall/exit/off-grid — reject ~55-59%
  at 0.017ms against a 14ms full draft, with zero solvable boards wrongly rejected. The second
  fires on 57% of *open* boards: edge and corner bags are usually untearable.

### Where difficulty actually lives

- **Trap position beats trap count.** L29 shipped with 17 traps and every one of them off the
  par line — the first way to lose was eight moves down a branch a player would have restarted
  from. Its replacement has six traps and bites on move one, with five of nineteen steps
  holding a losing option. Score rooms on `biteSteps` and `firstBite`, not on `:traps`.
- **`tighten` strips teeth if allowed to.** Its default now refuses to remove a room's last
  trap. Walls cannot lower par — they only remove options — but they can and do remove ways to
  lose, and they can also create new ones (L27 gained a trap when walled).
- **The documented Sokoban frustration is not length.** It is a long solution with no way to
  tell whether you already derailed it — "negative freedom, where a lack of constraints sows
  doubt" (Electron Dance, *Claustrophobia*). This game has an answer Sokoban lacks, because its
  mess is permanent and visible, and `solver.js` already computes deadness. That is what makes
  todo #3 a prerequisite for long rooms rather than a nicety.
- **Comparator, measured from source.** Microban's 155 levels: median 10×8 including the wall
  border, median 4 boxes (90 of 155 have 3 or 4), early solutions 33–41 moves. This pack sits
  at median area 20, median par 8, one or two bags — roughly 2.5× smaller and half the boxes.

### Pinned, for after the first rooms exist

- **Backward generation.** Walking back from a win is how most Sokoban generators work, and it
  half-applies here. Pushes invert cleanly, emitters too if the history is being constructed
  rather than read. Tearing does not: all trash is identical, so the board cannot say which
  cells came from which tear, and trash laid into water became a bridge. The inverse is
  one-to-many — which suits generation, since the choice of which five cells revert to floor
  *is* the construction. It saves the ~98% of forward samples that were never solvable, but not
  the `analyze` call, which every candidate needs either way. **The real reason to want it is
  that it is the only way to aim at a par directly** rather than fish for one.
- **Odd outlines** — an L, an H, a river through the middle. `plan` in `tools/draft-room.mjs`
  takes an arbitrary wall mask, and water is its own `~` terrain lane (L14–L16 use it), so a
  river is a plan plus a water mask. Open question worth measuring rather than assuming: which
  walls make a room harder. Walls near the pieces create deadlock; walls near the route only
  remove choices.
- **Bag count is monotone.** Only a tear reduces it, and by one. A full can, a stack and a
  wheelie all conserve it — a full can becomes an empty can plus a loose bag, net zero. The
  state graph is layered in that dimension, which gives backward generation a stopping rule and
  is probably exploitable in the forward solver.

### Tools

`tools/draft-room.mjs` — `draft` (every check `verify.mjs` will apply), `cartMustMove`,
`rooms({w,h,pieces,exitAt,plan})`, `tighten`, `ttBlock`. `plan` takes a wall mask so outlines
need not be rectangles; `tighten` derives walls from the solve, filling in floor the room never
needed. Arrangements enumerate lazily, so board size has no ceiling.

Adding a room: draft or search → `tighten` → paste `ttBlock` output into `levels/act1.tt` →
add the `:solution` entry to `levels/act1.sol` → add the row to the `levels.md` table →
`node tools/verify.mjs` and `npm test`.

### Watch for

Groups that are duplicates in disguise. A full can and a stack ask the cart almost the same
question; a fertility map will rank both highly while they teach one thing.

## Next Step

Build the fertility survey (#1). Random placement sampling on an 8×4, multisets filtered for a
bag-carrier and a permanent emitter, ~500 samples per group, output a fertility map rather than
levels. 8×4 over 7×3 because a horizontal tear needs a row above and below the bag, so on three
rows only the middle one can ever be struck sideways.

/home/menser/Dropbox/ai/code/treasure_trash
