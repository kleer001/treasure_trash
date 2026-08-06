fresh

## Summary

Giving the shopping cart a set of rooms that teach it. `L18 Out of the Way` is in the pack and
playable; rooms 019–031 are not built yet.

Read **What `verify.mjs` actually requires** below before designing any of them. Most of what
the verifier prints is not a constraint on the room — only two of its checks are design rules a
room can genuinely fail, and knowing which two is the difference between designing rooms and
being told off by CI.

## Todos

### Parallel
- [ ] #1 Room 019 — it loads whatever it rolls onto: the thing goes in, it does not get shoved
      along. The loading has to be *necessary* — something that cannot be shoved directly but
      can be carried — or the room does not teach it.
- [ ] #2 Room 020 — one shove is one nudge: only what reaches the back of the basket comes out
- [ ] #3 Room 021 — a file is the cart's depth along the shove, so it takes one end-on and two
      broadside
- [ ] #4 Room 022 — what it swallows it carries, and a newcomer rides until something moves it on
- [ ] #5 Room 023 — trash in the basket is still trash: park it before you leave or the exit
      stays dark
- [ ] #6 Room 024 — you can load it by hand: shoving something in is the same collision from the
      other side
- [ ] #7 Rooms 025–031 — one room each for the cart meeting a bag, an empty can, a full can, the
      recycle bin, the wheelie bin, the water jug, the bag-on-can stack
- [ ] #8 Decide whether `bench-cart.html` should be served by GitHub Pages. It is public now:
      the workflow deploys `path: '.'` and withholds only `publishing/`. Unlinked and harmless,
      but unintended. One line beside the existing `rm -rf publishing` excludes it.

### Sequential
- [ ] #9 (needs: #7) Cut any object room that does not change the cart's answer. Bag, empty can
      and full can are the likeliest duplicates — the same cart lesson in three costumes. A
      shorter act beats filler.

## Context

### What `verify.mjs` actually requires — read this first

Everything below arrived in `5334bb3` (2026-08-02) except the doc-drift and one-engine checks,
which are newer.

**Only two are design rules a room can genuinely fail:**

| Rule | What it wants |
|---|---|
| the exit forbids at least one action | In any room holding a bag, the exit's position must rule out at least one otherwise-legal action. An exit that is only a destination is not doing work. Skipped when the room has no bags. |
| an arming room declares what it teaches | `:arm on` requires a `:teach` line. A room introducing a piece has to say which. |

**Two are the engine testing itself, with the pack as a fixture.** A room cannot fail these
unless `rules.js` is broken, so they are not something to design around:

- *the exit is never occupied, in any reachable state* — `isOccupiable` excludes exit cells, so
  nothing can ever come to rest on one. It walks the whole state graph rather than the solve
  path precisely so that it tests the engine and not the level. Its own comment says so.
- *guard: no lethal plain move* — documented as vacuous while walking writes nothing to the
  board. A tripwire for some future verb (a conveyor, a trapdoor) that would change that.

**Seven are claims the level file makes about itself, which the solver then proves.** Not
judgements — write them wrong and the room is rejected, so compute them rather than guess:
`solvable`, `par is provably minimal`, `:solve` is a shortest solve / replays / replays to a win
/ is exactly par, `:solves` (distinct shortest count), `:traps` (stranding traps).

**The rest are the files agreeing with each other:** both packs parse and round-trip, LURD
round-trips and rejects junk, the grid/water/cart masks survive the serialiser, `act1.sol` has a
matching entry, `levels.md` quotes both the solve and the par, no page carries its own copy of a
`src/` module. Plus two structural: the exit starts empty, the raccoon does not start on it.

### The tool

`node tools/draft-room.mjs` — drafts a candidate against every check above and searches the
space of rooms of a given shape. Import `draft`, `cartMustMove`, `ttBlock`, `hunt`.

The filter that matters for a cart room is **`cartMustMove`**: freeze the cart's cells into wall
and the room must become unsolvable. If it still solves, the cart is scenery the player walks
around — it may lengthen the route, but the room teaches nothing about the piece. A first
attempt asked whether the cart *helps*; that is the wrong question, because in most rooms it is
an obstacle.

Searching is cheap — a few hundred boards a second on small shapes — so search a shape rather
than hand-placing pieces and being told the par is wrong. Rooms use no wall border; the grid
edge already blocks.

### Adding a room, start to finish

1. Search or draft with `tools/draft-room.mjs`; keep only rooms where `cartMustMove` holds.
2. Paste the `ttBlock` output into `levels/act1.tt`. Every block closes itself — `:grid`/`:end`,
   then `:cart`/`:end`.
3. Add the matching `:solution` / `:moves` entry to `levels/act1.sol`.
4. Add the row to the `levels.md` table — both the solve and the par are checked.
5. `node tools/verify.mjs` and `npm test`.

### Shape of a good teaching room

`L18` is the standard to match: par 6, exactly one shortest solve, no stranding traps, 32
reachable states, and impossible with the cart frozen. Short, forced, one lesson.

### Standing backlog

`TODO.md` holds everything that is not this job — the solvability indicator, rendering through
the compositor, audio, the art pass, the rooms that need regenerating.

## Next Step

Build room 019 (todo #1). Search a shape where something must be carried because it cannot be
shoved — a piece with no room behind it, which the cart can roll onto and take away — then run
it through `draft-room.mjs` and keep it only if `cartMustMove` holds.

/home/menser/Dropbox/ai/code/treasure_trash
