# Roster build plan — temporary

**This file is scaffolding and it gets deleted when the last stage lands.** It states rules
because a build plan has to, which is the one thing `CLEAN_PROSE.md` otherwise forbids —
so it is fenced off here rather than leaking into `src/`, and `src/rules.js` outranks it the
moment a stage is written.

Nothing here is a schedule. It is an order, and the order exists because some of these break
storage, some break `isWon`, and two of them fail silently if built in the wrong sequence.

## How a stage is done

Every stage carries the same gate, and no stage starts before the one it depends on is green:

1. **A test that fails before the change and passes after** — the house rule, and here it does
   double duty, because most of these stages have a silent failure mode rather than a loud one.
2. `npm test` green.
3. `node tools/verify.mjs` green — every declared par in `levels/` still proved.
4. A **byte-identical** regeneration check for any stage that touches a pipeline tool: regenerate
   and `diff` against a same-flags baseline, not against the committed file.

## The port, while this is happening

`engine/` stays on the current roster until Stage K. That is a deliberate cost, not an oversight:

- `tools/conform.mjs` compares the two engines over shipped and generated rooms, so it keeps
  passing only as long as no room in its corpus holds a new piece. **Do not add a new piece to a
  shipped pack until Stage K.** New pieces live in test fixtures.
- The discovery pipeline runs on the port, so a new piece is **playable long before it is
  generatable**. Act 3 gets built from the roster that exists today.
- `board.rs` throws on an unknown glyph, so the failure is loud rather than quiet. That is the
  property to preserve — do not teach the Rust reader to skip glyphs it does not know.

---

## Stage A — storage groundwork

No new behavior. Everything downstream needs the room, and two of the fixes are silent bugs
today.

- Move `stateKey`'s field separator below character 65. Every emitted character is >= 65, so any
  separator under it is collision-proof; `/` is already safe.
- Widen the cell encoding so occupant code, terrain and cart membership stop sharing one byte.
  The target is 36 codes x 8 terrain values x cart — 576 states, ten bits.
- Teach the carts lane to record each cart's **kind**, not only its cells.

**Tests.** Two boards differing only in a cart's kind must key differently — this is the one that
fails silently without it. A board whose packed cell would have been the separator character must
still round-trip. Existing key-injectivity specs stay green.

## Stage B — terrain lanes

One exclusive terrain value per cell, resolved as a moving thing enters it. Build in this order;
each is independent of the pieces and they accumulate cheaply.

- **B1 Grease** — a slider entering keeps going until blocked. Rollers unaffected.
- **B2 Tar** — anything entering stops permanently. The raccoon walks freely.
- **B3 One-way** — passable one direction only, by objects and by the raccoon.
- **B4 Sewer grate** — the raccoon crosses; objects fall in by the fit rule. `layTrash` grows its
  third case here. Watch `bagsLeft` and `trashHeld`: a container that falls in takes its bags
  with it, so the grate is a legitimate win path.
- **B5 Broken glass** — the raccoon may not step on it; objects rest on it and cross it. The
  bag-tearing half is inert until Stage G, because nothing moves a bag yet. Build the terrain
  now, the tear interaction with the broom.

**Tests.** Per lane: a thing that must stop, a thing that must pass, and the raccoon. For B4, the
fit rule at three sizes — smaller than the object, equal, larger — plus a cart spanning a smaller
grate with its cargo intact. For B3, a room the raccoon can strand himself in, and the dead-state
scan agreeing that he has.

## Stage C — the jug

The jug carries one cell of water, pours once and empties. Poured water washes grease or tar off
the cell; poured into a grate it drains away.

Needs a `JUG_EMPTY` code, a glyph, a sprite, and the same shape `CAN_FULL -> CAN_EMPTY` already
uses. **This is the only stage that touches existing content**: six rooms carry a jug — L16, L24,
L30, L46, L47, L48 — and their declared pars were measured against a jug that never empties.
`verify.mjs` fails loudly on them, which is the point; re-measure, regenerate their `.sol`
entries and their `levels.md` rows in the same commit.

**Tests.** A jug pours once and is empty. An empty jug is inert and slides. Water onto grease and
onto tar. Water into a grate. Then the six rooms, re-proved.

## Stage D — transfer on impact

A cross-cutting motion rule, and the rollers in Stage E are the first pieces that need it.

A rolling object striking a stationary rolling object stops and passes its motion on; the struck
object rolls until stopped. Objects already in contact and pushed together roll together.

**Tests.** Wheelie into wheelie transfers. Two wheelies shoved as a pair roll together and do not
transfer. A can into a wheelie does not transfer, because a can is not a roller. A cascade of
three terminates.

## Stage E — the plain new pieces

Nothing here needs a new system. Order is by how little they touch.

- **E1 Sponge** — soaks water and grease off the cell it lands on, **on landing**, so it never
  slides on grease. Unlimited, never consumed. Sticks in tar and on broken glass.
- **E2 Flattened cardboard** — a one-cell slider. Covers water, tar and broken glass and is
  consumed. Slides over grease. Falls into a grate.
- **E3 Pane of glass** — set in motion by anything, it shatters into the next cell and leaves
  broken glass; rides intact when the cell beyond is occupied; cannot shatter onto water.
- **E4 Car tire, bicycle, rolled rug** — anisotropic, and NOT all on the same axis, which is the
  part that catches people. A tire and a bicycle run on their wheels, so they roll along their
  own length. A rolled rug is a cylinder lying on the floor: shoved end-on it only slides, and it
  is the shove against its side that sets it rolling. Either way, the axis a piece does not roll
  on moves it one cell. The two-cell and multi-cell ones take their axis from `pid`; the car tire
  pays a code per orientation.

**Tests.** E1: sponge onto grease dries one cell and does not travel; sponge into tar is lost.
E2: each of the three coverings, and the grate. E3: shatters with room, rides without, refuses at
water, and is set off by a transfer as well as by a push. E4: each piece along and across its
axis, and one of them rolling into a grate of its own size.

## Stage F — the office chair

Burst trash knocks it exactly one cell, fleeing the bag. Everything else rolls it. Cornered, the
push is refused — which the roller branch already does, so only the trash case is new.

Needs the `fanBlockers` exception: a chair in the fan is admitted when it has somewhere to flee,
so the fan's legality now depends on a cell beyond the fan, and the flee cell goes in `blame`.

**Tests.** A tear knocks a chair exactly one cell. A tear against a cornered chair is refused and
blames the flee cell, not the chair. A raccoon's shove rolls it. A rolling object transfers into
it. And the one that guards the exception: a tear whose fan holds a chair with room is legal,
where today it is refused.

## Stage G — the broom

Pushed, it moves the whole contiguous line ahead of it, of any kinds, one cell. On grease it
slides its whole train until blocked.

**This is the stage where bags start to travel**, which nothing else in the game does, so it is
also where Stage B5 wakes up. A bag anywhere but the head of a train refuses to move onto broken
glass.

Only the leading item of a line can shed, and that falls out of `tipFits` rather than needing a
rule — every interior item has its neighbour in the cell beyond.

**Tests.** A line of mixed kinds moves one cell. A line into a wall does not move and nothing
sheds. A line whose leader is a container sheds once, and an interior container does not. A bag
swept over open floor survives. A head bag swept onto broken glass tears. A non-head bag swept
toward broken glass is refused. A broom on grease sweeps its train the full run.

## Stage H — the filing cabinet

The hardest representation change on the list, which is why it is late: **the cabinet is two cells
open and one closed**, and `isMultiCell` is a flat predicate on the occupant code today. Decide
whether the drawer is part of a `pid` footprint or its own code before writing anything —
`pieceCells`, the multi-cell push branch and `stateKey`'s pid lane all read that predicate.

A shove that moves it also opens the drawer one cell in the facing direction, and the drawer
opening is itself a push. If the drawer's target cannot be cleared, the move is refused. Shoved
from the drawer side the drawer closes and the cabinet stays put; the next shove moves it. An
object pushed into an open drawer closes it and lands where the drawer was. A level may start one
open or closed, so the format needs both states per facing.

**Tests.** Opening shoves an object perpendicular to the push. A blocked drawer refuses the move.
Closing from the drawer side does not move the cabinet, and the next shove does. An object pushed
into the drawer closes it and lands in the vacated cell. An open cabinet falls into a two-cell
grate; closed, it spans it. A pack round-trips a cabinet in both states at all four facings.

## Stage I — the wheelbarrow

Needs Stage A's cart-kind lane, and the **link lane** lands here.

One cell, fixed axis, never rotates. Along its axis into a thing it scoops it — cargo held
cart-style, so it stays visible and `bagsLeft` and `trashHeld` keep counting it untouched. Across
its axis it travels one cell and sheds its load one further cell forward, then rights itself. A
multi-cell piece is **towed** by a link instead, rigidly, keeping its footprint. Loaded, a shove
along the axis is an ordinary push.

**Tests.** Scoop, and the bag still counts in `bagsLeft`. Dump forward, and the barrow rights
itself. Tow a couch and move it rigidly; a tow whose path is blocked refuses. Push the towed
couch directly and the barrow follows. A loaded barrow shoved along its axis pushes instead of
scooping. Two barrows on different axes that swap positions key differently — the Stage A test,
now with a real piece behind it.

## Stage J — the magnet

Shares Stage I's link lane, which is what makes it affordable.

One cell, fixed facing, four orientations. Shoved, the nearest metal within three cells along its
facing closes to adjacent — up to two cells — and chains. Walls block the line; objects do not.
Chained metal follows the magnet; the chain breaks when the metal leaves the facing line or the
gap exceeds three. The magnet never moves itself to close a gap. Pushing the magnet into its
chained metal is an ordinary push; pushing the metal drags the magnet.

**Tests.** Capture at one, two and three cells, and no capture at four. A wall on the line blocks
capture; an object on the line does not, and the metal stops against it and chains anyway. A
captured roller ends adjacent, because the magnet blocks it. Following, then breaking off-line,
then breaking past three. Pushing the metal drags the magnet. A magnet capturing a magnet. And a
non-metal piece on the line that is never captured at all.

## Stage K — the port, and the pipeline

Only now, and only once the JS side is settled — a rules change costs double while both engines
are live, and this roster is a large one.

Rewrite the cell encoding in `engine/` to match Stage A, teach `board.rs` the new glyphs and
`rules.rs` the new branches, then earn the port's place back through `tools/conform.mjs` at both
grains — whole rooms, and single boards a direction at a time. Re-run the standing proof across
its seeds. Only then do new pieces enter a shipped pack, and only then can `survey`, `harvest`
and the rest measure them.

**Tests.** The conformance harness, unchanged, over a corpus that now includes every new piece;
both bend fixtures still caught; the standing multi-seed proof at zero disagreements.

---

## The two that fail silently

Everything else on this page announces itself. These do not, so they are worth naming twice:

- **The carts lane without kinds** (Stage A) hands the solver two different boards under one key.
  Wrong par, no error. It must land before Stage I, not with it.
- **A barrow that does not use cart membership** stops `bagsLeft` counting a bag it carries, and
  the room becomes winnable with a bag still on the board. The visible-cargo requirement and the
  correct win condition are the same decision.
