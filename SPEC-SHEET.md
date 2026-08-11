# SPEC-SHEET — Treasure Trash

A sketchpad. Notes toward a build: what you're thinking, what you tried, what you
decided and why you decided it. It **supports** development and never drives it.

**Nothing here is binding.** This is not a contract, not a task list, not a
schedule, and not a mirror of the code. No section has to be filled in. Nothing on
this page blocks a commit, a refactor, or a release. The running game is the source
of truth — when the code and this page disagree, **the code is right and this page
is just old.**

Write here when thinking on the page is faster than thinking in your head, and when
you'd otherwise re-derive the same decision in three months. Then close it and go
build.

## How to work it

- **Don't sync it.** Reconciling the spec to the code is not work — it is the
  appearance of work. Ship the change; leave the page stale.
- **Rewrite a section only when the old note actively misleads you**, not because
  the implementation moved.
- **A stale note is not a defect**, and finding one is not a reason to stop what
  you're doing. Fix it if it's in your way; otherwise ignore it.
- **Delete freely.** A section you never used is noise. A decision that's now
  obvious in the code doesn't need a paragraph.
- **Use the headings you want** and cut the rest. They're prompts, not a schema.
- If you ever find yourself building something *because the spec sheet says so*,
  the spec sheet is wrong. Build what the game needs and change the page after — or
  don't.

## Design decisions

What you settled on, in your own voice: what the design does, and why. Written from
the playable slice, once it plays. Write it so it still makes sense to someone who
was not in the room — that's the whole point of the section, and the only reason it
earns its space.

- **Scope & core loop:** _…_
- **What it's about, and where that lives in the mechanics:** _…_
- **Lineage, and what's actually new:** _…_
- **The genre's players, and what they get:** _…_
- **Direction** — keep going / re-scope / pivot / shelve: _…_

## Vertical slice

The smallest playable thing that proves the loop is fun. What's in; what you're
deliberately not doing yet. An aim, not a commitment.

## Systems

Whatever's worth writing down: what a system does, its inputs and outputs, the data
it owns. Sketch the ones you're still figuring out; skip the ones the code already
explains.

## Data

Key data shapes — the ones you keep having to look up.

## RNG & determinism

What's seeded and what a seed reproduces. House rule (this one *is* a rule, and it
lives in `CLAUDE.md`, not here): `mulberry32`, never `Math.random()` in game logic.

## The fertility survey

`tools/survey.mjs` samples 200 random placements of every legal group of four pieces on an
8×4, and writes one row per group to `levels/fertility.jsonl`. It answers one question —
which mixtures of the roster make rooms at all — and it is a map, not a source of levels.

Run: 586 groups, 117,200 placements, 74 minutes on 30 workers. 4,783 solvable, 907 that
also clear par ≥ 12, ≤ 2 shortest solves and ≥ 1 trap. 289 groups never yielded a single
solvable room.

**Homogeneous bag sets are barren.** Every group whose only carrier is the loose bag —
`$$$$` through `$$$P` — came in at or near zero. The roster, not the box count, is where
the rooms are. That is the assumption the survey was built to test, and it does not hold
here.

**Marginal fertility, per 1000 placements of every group containing the piece:**

| piece | solvable | interesting |
|---|---|---|
| `B` full recycle bin | 86.6 | 14.5 |
| `P` cart | 62.0 | 11.5 |
| `x` spilled trash | 50.4 | 9.1 |
| `j` water jug | 45.7 | 9.0 |
| `$` bag | 42.6 | 9.7 |
| `F` couch | 41.9 | 8.4 |
| `w` empty wheelie | 40.4 | 8.2 |
| `c` empty can | 32.6 | 6.2 |
| `W` wheelie | 30.8 | 7.6 |
| `C` full can | 14.0 | 4.2 |
| `S` bag-on-can stack | 5.1 | 1.0 |

**The stack is the barren one, by an order of magnitude.** 5.1 against 62.5 for every group
without it — and not a measurement artifact: stack groups hit the enumeration cap at 21%,
against 19% for the rest, so they were not discarded more often, they simply do not make
rooms. Its best group manages 5 interesting rooms in 200.

**The cart earns its cost.** Second most fertile piece in the roster. It multiplies the
state graph, but the rooms are there.

**What the map cannot see.** 19.8% of placements exceeded the 50,000-state enumeration
bound and were counted rather than analysed. Fertility is flat across the groups that hit
that bound 0–39% of the time (43.8, 43.4 and 42.2 solvable per 1000), so the ranking is not
an artifact of the cap; only the 63 groups above 40% fall off, and those are the loosest
boards in the set. Sampling is random placement on an open rectangle: nothing here says
anything about outlines, and walls are the untested axis.

## The harvest, and the wall it hit

`tools/harvest.mjs` samples the groups the map calls fertile, builds them on OUTLINES rather
than open rectangles, and stores every metric per room to `levels/harvest.jsonl`.
`tools/score.mjs` ranks that file, so changing the weights is a query and not another run.

Two metrics come from Taylor & Parberry (GAMEON-NA 2011). **Box lines** — a run of shoves on
one piece in one direction counts once — is the one they find tracks difficulty; **box
changes** — how often the solution puts one piece down and picks another up — they suspect is
better still. Both are indifferent to walking, which is the point: push and move counts
measure tedium, not difficulty.

The same paper's structural rejects apply here, and one of them was load-bearing. A room
holding a 3×4 clear block has "very bushy, but not very deep state spaces". The survey's open
8×4 is nothing but such blocks; one placement in five blew past the state cap and returned
nothing for the cost. Outlined, that fell to one in fourteen and the keep rate roughly tripled.

Run: 62 groups, 74,400 outlined placements, 25 minutes, 6,651 rooms kept.

**The generated rooms beat the shipped pack on solution shape.** Top candidates reach 11 lines
and 8 changes; the shipped pack tops out at 5 and 4, and L12 spends par 23 on 4 lines — which
is the same thing `metrics.mjs` has been saying about L7–L13 all along, now with a number.

### The tradeoff that selection cannot fix

Two properties matter and they turn out to be nearly incompatible:

- **`onPath`** — the fraction of the solve's depths at which *optimal* play can still throw the
  room away. A trap off the line is a trap nobody meets.
- **`blind`** — how far the room stays playable after it has already been lost.

| | blind ≤ 5 | ≤ 10 | ≤ 15 | ≤ 20 | ≤ 30 |
|---|---|---|---|---|---|
| onPath ≥ 0.05 | 4 | 29 | 81 | 178 | 474 |
| onPath ≥ 0.10 | 0 | 1 | 15 | 41 | 128 |
| onPath ≥ 0.15 | 0 | 0 | 6 | 11 | 42 |
| onPath ≥ 0.20 | 0 | 0 | 1 | 1 | 10 |
| onPath ≥ 0.30 | 0 | 0 | 0 | 0 | 0 |

Of 5,578 eligible rooms, **one** both bites the road at 15% and ends within 12 moves of the
mistake. Median `onPath` is 0 — half of all eligible rooms are rooms optimal play cannot lose.

This is causal, not bad luck. The mess is permanent, so a room where the good line can go
wrong is a room with many live-to-dead edges, and every dead state is still *playable* — you
can keep shoving things around forever. Losable and self-announcing pull against each other by
construction. And it worsens with length: median `blind` runs 27 at par 12–17 and 47 at par
30–45, so the ambition of a par-35 room makes it worse, not better.

**So the solvability indicator is not a nicety, it is the enabling feature.** No amount of
sampling buys a pack of long, losable, self-announcing rooms, because the rules make them
nearly incompatible; a room that announces its own death is the only way to have both.

## The candidate roster

Working notes on a page that already declares itself non-binding. **Nothing here is built and
nothing here is a rule** — `src/rules.js` decides, and when the two disagree the code is right.
Kept so the same ground is not walked twice.

### The constraint everything hangs off

**Push is the raccoon's only verb.** Pull, carry and stacking are a direction — the 3D puzzle
platformer Sokoban grew into — and that is not this. Three absent axes are therefore closed on
purpose rather than left open and unfilled: *nothing pulls*, *the raccoon holds nothing*, *a cell
holds one occupant*.

Pull at the *board* level is legal, which is what lets the magnet exist.

### Why a roster grows by branches and not glyphs

`explain` branches once per mechanic, and several glyphs share a branch: tear (`$`), shed-a-bag
(`C`/`S`/`W`), shed-trash (`B`), pour (`j`), slide-inert (`c`/`b`), roll (`W`/`w`), rigid
multi-cell (`FGHKMN`), carry (`PQR`). Four glyphs are one idea at three sizes. **That is the
caveat on the fertility table above: it ranks costumes, and a costume's score is mostly its
branch's score.**

### Cross-cutting rules

These govern several pieces at once, so they belong in one place rather than in each entry.

- **Transfer on impact.** A rolling object that strikes a stationary rolling object stops and
  passes its motion on; the struck object then rolls until it is stopped. Objects already in
  contact and pushed together roll together — transfer fires on impact, not inside a pushed line.
- **What rolls.** A rolling object is one that, given the space, keeps going: the wheelie bin,
  the car tire, the bicycle, the rolled rug, the office chair. The pane of glass is in the class
  for the purpose of being set in motion, and transforms instead of travelling.
- **Every path is straight.** No lane redirects anything, so a slide, a roll and a transfer
  cascade are all straight runs bounded by the board. Termination needs no travel budget and no
  generation-time check.
- **Terrain is one exclusive value per cell**, resolved as a moving thing enters it.
- **The grate's fit rule.** An object falls in when its footprint fits inside the grate's
  contiguous cells; otherwise it spans them. A rug longer than a one-cell grate rolls over it and
  drops into one its own size or bigger. A cart spans a smaller grate and its cargo rides.
- **Metal**, for the magnet: can, bin, wheelie, filing cabinet, wheelbarrow, car tire, bicycle,
  office chair, magnet. Not metal: bag, trash, sponge, cardboard, broom, couch, rug, pane of
  glass, jug.

### Terrain lanes

| lane | rule |
|---|---|
| **Grease** | A slider entering it keeps going until blocked. No effect on a roller, which already does that — so grease multiplies over the slide and shed branches, not over all eight |
| **Tar** | Anything that enters stops there permanently. The raccoon walks on it freely |
| **Sewer grate** | The raccoon crosses. Objects fall in by the fit rule. Poured water drains away. **The roster's only sink**: bags leave `bagsLeft`, swept trash goes, a sponge is retired |
| **One-way** | Passable in one direction only, by objects **and** by the raccoon — the first terrain that can strand him by walking rather than pushing |
| **Broken glass** | The raccoon may not step on it. Objects rest on it and cross it. A bag moved onto it tears. The sponge sticks. Cardboard covers it. Authored in a level, and also what a shattered pane leaves |

Broken glass separates "where he can walk" from "where anything can sit" — one predicate doing
two jobs today. That property was wanted under other fictions and refused; a floor of glass is
the fiction that carries it.

### Occupant codes

| piece | rule | codes |
|---|---|---|
| **Broom** | Pushed, it moves the whole contiguous line ahead of it, of any kinds, one cell. On grease it slides its whole train until blocked. **It is the only way a bag ever travels.** A bag anywhere but the head of a train refuses to move onto broken glass | 1 |
| **Sponge** | Soaks water and grease off the cell it lands on — on landing, so it never slides on grease. Unlimited, never consumed, never becomes a surface: it trades a fixed blocker for a mobile one. Sticks in tar and on broken glass. Retired only by a grate | 1 |
| **Empty jug** | The jug carries one cell of water, pours once and empties. Poured water washes grease or tar off the cell it lands on; poured into a grate it drains away | 1 |
| **Flattened cardboard** | A one-cell slider. Covers water, tar and broken glass, making the cell walkable, and is consumed doing it. Slides over grease. Falls into a grate | 1 |
| **Pane of glass** | Set in motion by anything, it shatters into the next cell and leaves broken glass. When the cell beyond is occupied it rides intact — **so it is protected by being boxed in and broken by being given room.** It cannot shatter onto water | 1 |
| **Office chair** | Burst trash knocks it exactly one cell, fleeing the bag; **everything else rolls it.** Cornered, the push that would move it is refused, which is the roller branch's existing shape | 1 |
| **Bicycle** | Two cells, anisotropic: along its axis it rolls, across it, one cell. Axis free from `pid` | 1 |
| **Rolled rug** | Multi-cell, anisotropic, same rule. The cheapest way into anisotropy | 1 |
| **Car tire** | One cell, anisotropic. A one-cell piece cannot take an axis from `pid`, so it pays a code per orientation | 2 |
| **Wheelbarrow** | One cell, fixed axis, never rotates. Pushed **along** its axis into a thing it scoops it — cargo visible and counted, cart-style. Pushed **across** its axis it travels one cell and sheds its load one further cell forward, then rights itself. A multi-cell piece is **towed** by a link instead, rigidly, keeping its footprint. Loaded, a shove along the axis is an ordinary push. Carrying without a carry verb | 2 |
| **Magnet** | One cell, fixed facing. Shoved, the nearest metal within three cells **along its facing** closes to adjacent — up to two cells — and chains. Walls block the line; objects do not. Chained metal follows the magnet, and the chain breaks when the metal leaves the facing line or the gap exceeds three. **The magnet never moves itself to close a gap**, so nothing on the board moves unbidden. Pushing the magnet into its chained metal is an ordinary push; pushing the metal drags the magnet | 4 |
| **Filing cabinet** | Fixed facing. A shove that moves it also opens the drawer one cell in the facing direction, and **the drawer opening is itself a push** — so the cabinet is a second aimed action, shoving something perpendicular to the direction you pushed. If the drawer's target cannot be cleared, the move is refused. Shoved from the drawer side the drawer closes and the cabinet stays put; the next shove moves it. An object pushed into an open drawer closes it and lands where the drawer was. Two cells open, one closed, and a level may start it either way | 8 |

**24 new codes, 36 total. Five terrain lanes, eight terrain values with none, water and bridge.**

Three pairs are deliberate opposites, which is what makes each legible: **grease and tar**,
**sponge and cardboard**, **the bag's outward fan and the magnet's inward pull**.

### What this costs the port

The design tier ordering and the storage tier ordering are **inverted**: a terrain lane is the
cheapest thing to design, because it coexists with an occupant instead of excluding one — and it
is the first thing to break storage, for exactly that reason, because it multiplies against the
occupant count.

- `stateKey` packs a cell as `65 + (o*3 + terrain)*2 + cart` and `engine/src/solver.rs` casts
  that to `u8`. For `T` terrain values and top occupant code `O` the largest byte is
  `64 + 2T(O+1)`, so the port holds only while `T(O+1) <= 95`. Today that is `3 x 12 = 36`.
  This roster is `8 x 36 = 288`. **The cell needs ten bits and has eight** — 36 x 8 x 2 = 576
  distinct cell states. Widen the encoding so kinds, terrain and cart membership stop sharing
  one byte, rather than raising a number.
- **The carts lane has to record each cart's kind, not just its cells.** It labels carts by
  first appearance in raster order, which is sound only while every cart is interchangeable. Two
  wheelbarrows on different axes that swap positions key identically — the same board twice, and
  the solver skips one it has never seen. This is the pattern already used for furniture, applied
  to carts, and it must land *with* the barrow because the failure is silent.
- **`fanBlockers` needs an exception for the office chair.** It refuses a tear when any fan cell
  fails `isOccupiable`, and a chair occupies its cell — so as things stand the tear is refused and
  the chair is never struck. The exception admits a chair that has somewhere to flee, which makes
  the fan's legality depend on a cell beyond the fan, and puts the flee cell in `blame`.
- **`layTrash` grows a third case.** It has one branch for water and one for everywhere else;
  trash laid on a grate falls through. It is "the one place trash is laid down", so every caller
  inherits it.
- **`stateKey`'s field separator is a character a cell can emit.** At jug, bridge, in-cart the
  packed byte is 124, which is `|`. Not a live collision — the key is used whole, per room, and
  every section is fixed-length there — but the injectivity rests on an invariant nothing checks,
  and a kind created or destroyed mid-solve breaks it. Every emitted character is >= 65, so any
  separator below 65 is collision-proof.
- **The port is where the discovery pipeline runs**, so until it is rewritten, a room holding a
  new piece cannot be harvested or measured and `board.rs` throws on the unknown glyph. New
  pieces are playable long before they are generatable.

### Declined, with the reason

**Pull · carry · stacking** — push is the raccoon's only verb.
**Umbrella** — the filing cabinet's job, and the cabinet reads its own direction off its sprite.
**Nesting bin** — the wheelbarrow does it, and you can steer the barrow.
**Bicycle wheel** — the car tire, at the same price.
**A tire with a special power** — "shoves what it stops against" became the universal transfer
rule, which is worth more than the piece was.
**Draught** (travel the cell's way) — the only lane that redirects, and redirect is what makes
motion able to loop. Cutting it retired the termination problem outright.
**Counter / hedge** — too close to tar under that fiction; the property arrived instead as
broken glass.
**Lid** — the garbage should go out, not be hidden.
**Vacuum** — the broom relocates trash rather than erasing it, which is more.
**Kitty litter** — the sponge does it, and it was the sponge in a costume anyway.
**Leaking sack** · **trolley with a bad wheel** · **ladder** — no.
**Coupled pair** — couches with extra machinery; multi-cell pieces are better designed by hand.
**Weight** (two shoves per cell) — reads as tedium, the trap push-count already fell into.
**Turnstile** — the rug, without an orientation lane.
**Rope** — wants to be looser than a grid.
**Mattress** — a sponge in bigger clothes; its interesting properties are volumetric.
**A cat, or any creature** — agency is parked until the raccoon-alone game proves fun, and a
creature would answer the crow question sideways.
**Conveyor** — needs a tick, and every board is static between inputs.
**Sorting destinations** — would read as sorting rather than clearing, and touches `isWon`,
`bagsLeft`, win detection and every level file at once.

## Open questions

What you don't know yet, and what would answer it — usually a playtest. Scratch them
out as they resolve.

## Scratch

Half-thoughts, dead ends, things you tried that didn't work and why. Keeping the
dead ends saves you from walking back into them.

---

Shipping is gated by `RELEASE-CHECKLIST.md`, not by this file. That's the only hard
stop in the studio, it deliberately lives somewhere else, and it doesn't open until
after beta — so while you're prototyping and growing the game, neither document is
telling you what to do.
