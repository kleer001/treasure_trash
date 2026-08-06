# Breadcrumb — pick the cart tutorial back up here

`TODO.md` is the standing backlog. This file is the trail for one job in progress: giving the
shopping cart a set of rooms that teach it.

---

## What `verify.mjs` actually requires of a room

Worth reading before designing rooms, because most of what it prints is not a constraint on the
room at all. Everything below arrived in `5334bb3` (2026-08-02, the spike → `src/` promotion)
except the last two lines, which are newer.

**Only two are design rules a room can genuinely fail:**

| Rule | What it wants |
|---|---|
| **the exit forbids at least one action** | In any room holding a bag, the exit's position must rule out at least one otherwise-legal action. An exit that is only a destination is not doing work. Skipped entirely when the room has no bags. |
| **an arming room declares what it teaches** | `:arm on` requires a `:teach` line. A room that introduces a piece has to say which. |

**These are the engine testing itself, using the pack as a fixture.** A room cannot fail them
unless `rules.js` is broken, so they are not something to design around:

- *the exit is never occupied, in any reachable state* — `isOccupiable` excludes exit cells, so
  nothing can ever come to rest on one. The check walks the whole state graph rather than the
  solve path precisely so that it tests the engine and not the level. Its own comment says so.
- *guard: no lethal plain move* — documented as vacuous while walking writes nothing to the
  board. It is a tripwire for some future verb (a conveyor, a trapdoor) that would make a plain
  step change the board.

**These are claims the level file makes about itself, which the solver then proves.** They are
not judgements — write them wrong and the room is rejected, so compute them rather than guess:
`solvable`, `par is provably minimal`, `:solve` is a shortest solve / replays / replays to a win
/ is exactly par, `:solves` (distinct shortest count), `:traps` (stranding traps).

**And these are the files agreeing with each other:** both packs parse and round-trip, LURD
round-trips and rejects junk, the grid/water/cart masks survive the serialiser, `act1.sol` has a
matching entry, `levels.md` quotes both the solve and the par, and no page carries its own copy
of a `src/` module.

**Structural sanity:** the exit starts empty, and the raccoon does not start on it.

---

## The tool

`node tools/draft-room.mjs` — drafts a candidate room against every check above and searches the
space of rooms of a given shape. Import `draft`, `cartMustMove`, `ttBlock`, `hunt`.

The filter that matters when designing a cart room is **`cartMustMove`**: freeze the cart's cells
into wall and the room must become unsolvable. If it still solves, the cart is scenery the player
walks around — it may lengthen the route, but the room teaches nothing about the piece. A first
attempt tested whether the cart *helps*; that is the wrong question, because in most rooms it is
an obstacle.

Searching is cheap — a few hundred boards a second on small shapes — so prefer searching a shape
over hand-placing pieces and being told the par is wrong.

---

## Where the rooms are

**Done:** `L18 Out of the Way` — par 6, one shortest solve, no traps, 32 states. The cart stands
on the square he has to strike from; shoving it shows that it runs until something stops it.

**The arc still to build.** Text goes in each room's `:teach`, so the verifier holds it to
declaring what it introduces.

Behaviours, 019–024:

| Room | The beat |
|---|---|
| 019 | it loads whatever it rolls onto — the thing goes in, it does not get shoved along |
| 020 | one shove is one nudge: only what reaches the back of the basket comes out |
| 021 | a file is the cart's depth along the shove, so it takes one end-on and two broadside |
| 022 | what it swallows it carries, and a newcomer rides until something moves it on |
| 023 | trash in the basket is still trash: park it before you leave or the exit stays dark |
| 024 | you can load it by hand — shoving something in is the same collision from the other side |

Objects, 025–031: bag, empty can, full can, recycle bin, wheelie bin, water jug, bag-on-can
stack — one room each, meeting the cart.

Two things to expect:

- **019–024 need richer boards than 018.** Teaching that the cart loads means the loading has to
  be *necessary* — something that cannot be shoved directly but can be carried. Each wants its
  own targeted search rather than a rerun of the 018 shape.
- **The object arc may thin out.** Bag, can and full can risk being the same cart lesson with a
  different sprite. Build them, then cut any that do not change the cart's answer; a room that
  teaches nothing new is worse than a shorter act.

## Adding a room, start to finish

1. Search or draft it with `tools/draft-room.mjs`; keep only rooms where `cartMustMove` holds.
2. Paste the `ttBlock` output into `levels/act1.tt`. Each block closes itself — `:grid`/`:end`,
   then `:cart`/`:end`.
3. Add the matching `:solution` / `:moves` entry to `levels/act1.sol`.
4. Add the row to the `levels.md` table — both the solve and the par are checked.
5. `node tools/verify.mjs` and `npm test`.
