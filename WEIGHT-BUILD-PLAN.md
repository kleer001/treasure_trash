# Weight build plan — temporary

**This file is scaffolding and it gets deleted when the last stage lands.** It states rules
because a build plan has to, which is the one thing `CLEAN_PROSE.md` otherwise forbids — so it is
fenced off here rather than leaking into `src/`, and `src/rules.js` outranks it the moment a stage
is written.

Nothing here is a schedule. It is an order, and the order exists because the later stages read
predicates the earlier ones define.

## The rule

**A wheeled thing is HEAVY while it is carrying objects. Everything else is light.**

Carrying objects means a cart cell with a non-empty chain — a barrow or a shopping cart with
something riding in it. A wheelie bin is light full or empty: its trash is a STATE of the bin, not
cargo, and nothing is riding in it. The tyre, the bicycle and the office chair can never hold
anything and so are always light.

Weight is read when the shove BEGINS. That is what lets an empty cart keep its open mouth: it
starts light, rolls its whole run, and takes in everything it passes — and is heavy from the next
shove on.

**Light things roll. Heavy things move one cell.**

- A train moves as far as its heaviest member allows: one heavy thing in it and the whole train
  moves one cell.
- Grease overrides weight. Anything moving on a slick keeps moving, heavy or not.

**What can move a wheeled thing**

- A push from the raccoon — directly, or through a run of touching things — moves it, heavy or
  light.
- A knock from something that rolled in moves a LIGHT thing. A heavy thing does not move: it
  RATTLES, which is a report the stage animates and the board never sees.

**Picking up takes a direct push.** Neither the cart nor the barrow takes anything in while
rolling from a knock. They differ in what a direct push buys:

- The **cart** keeps its mouth open for the length of its roll, taking in what it passes.
- The **barrow** takes in only what it was ALREADY touching when the shove began, only along its
  facing, and only while empty. The scoop is one cell and ends the shove.

**Unloading**

- A **cart** empties two ways: taking something new in pushes the old contents of that slot out
  the back, and a blocked push sheds from whichever file has a free cell behind it — never the one
  the raccoon is standing behind. With no free cell behind any file, the push is refused and it
  rattles.
- A **barrow** empties only by being tipped across its axis. It has no blocked-push shed: shoved
  along its line there is no unambiguous side to dump toward, and shoved across it the raccoon is
  standing where the load would go.

## How a stage is done

1. A test that fails before the change and passes after.
2. `npm test` green.
3. `node tools/verify.mjs` green — or, for the stages that change how far a cart travels, a
   recorded list of the rooms that stop being solvable. Those get REBUILT, not re-measured.
4. Played in the browser on a bench room in `levels/scratch.tt` before the stage is called done.

## Stage 1 — weight, and how far a thing goes

`isHeavy` on a cart cell, read once at the top of a shove. Heavy carts and barrows move one cell;
light ones roll as they do today. The train takes its distance from its heaviest member.

**Tests.** A loaded cart moves one cell where an empty one rolls. A full wheelie bin still rolls,
struck and pushed — it is the case the rule must NOT catch. A train with one loaded cart in it
moves one cell entire. A heavy cart on grease runs the slick.

## Stage 2 — carts join the transfer system

Today `isRoller` opens with `!isCart(c)`, so a cart is neither a source nor a target of a hand-off,
and a rolling bin stops dead against the one piece in the game with wheels in its name.

The work is an extraction, not a new branch: `shoveCart` owns cart movement — files, loads,
repaint, shed — and `handOff` moves things by swapping occupant codes between cells. One routine
that moves a cart `k` cells, called by both, is the only version of this that does not end in two
implementations of the same piece.

**Tests.** A tyre rolls into an empty cart and the cart rolls off. Into a loaded one, and it does
not move. A struck cart takes in nothing it rolls over. The bicycle and the wheelie bin keep the
behaviour they already have.

## Stage 3 — the rattle

A heavy thing that is struck does not move, and the step says so. The board is unchanged, so the
solver never sees it and it costs nothing in the state graph; it rides the path a cabinet's blow
already takes.

Drawn as a wobble about the bottom-middle of the sprite: ten degrees away from the blow, back
through five toward it, then at rest.

**Tests.** A struck heavy cart reports the rattle and the board is untouched. `stateKey` is
identical across it. The stage census agrees before and after — a rattle moves no sprite anywhere.

## Stage 4 — taking things in needs the raccoon

Swallowing is gated on the shove being raccoon-driven rather than on which beat of a roll it is.
A knocked cart rolls with its mouth shut.

**Tests.** A cart set rolling by a tyre passes over a can and leaves it. The same cart shoved by
the raccoon over the same can takes it in.

## Stage 5 — the cart's blocked-push shed

A heavy cart with nowhere to go sheds one item out the back of a file whose back cell is free,
which is never the file the raccoon is pushing. Nothing free anywhere: refused, and it rattles.

**Tests.** A loaded cart flush against a wall sheds from the far file. A two-cell cart with the
raccoon behind one file and a wall behind the other refuses. A barrow in the same position refuses
and sheds nothing.

## Stage 6 — the port

`engine/` copies every stage above, and earns its place back through `tools/conform.mjs` at both
grains across its seeds. The port follows: nothing here is decided in Rust.

## Stage 7 — the rooms

Every shipped room is rebuilt. A cart that shuffles cannot solve a room designed around a cart
that crosses the map, so the verifier will fail those outright rather than re-par them. Run the
pipeline — `survey` → `harvest` → `score` → `sets` → `resite` → `shrink` → `act2` — against the
new rules and rebuild both acts from what it finds.

---

## The one that fails silently

Everything else here announces itself. This does not:

- **Weight read per beat instead of per shove** turns the cart into a barrow. It starts light,
  swallows the first thing it passes, becomes heavy mid-roll and stops — picking up one item per
  push, which is the barrow's rule wearing the cart's hat. The two pieces then have no difference
  left worth a code. Read it once, at the top of the shove.
