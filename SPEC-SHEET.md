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

Working notes, and the least binding thing on an already non-binding page. **Nothing here is
chosen and nothing here is a rule.** It is kept so the same ideas are not re-derived and the
same dead ends not re-walked — and the ambiguities at the end are the part that still wants an
owner's answer.

### The constraint everything else hangs off

**Push is the only verb.** Pull, carry and stacking are not merely expensive; they are a
*direction*, and the direction is the 3D puzzle-platformer Sokoban grew into. That is not what
this is. Three absent axes are therefore closed on purpose — *nothing pulls*, *the raccoon holds
nothing*, *a cell holds one occupant* — which is worth more than leaving them open and unfilled.

### Twelve glyphs, eight mechanics

`explain` branches once per mechanic, and several glyphs share a branch: tear (`$`), shed-a-bag
(`C`/`S`/`W`), shed-trash (`B`), pour (`j`), slide-inert (`c`/`b`), roll (`W`/`w`), rigid
multi-cell (`FGHKMN`), carry (`PQR`). Four glyphs are one idea at three sizes.

That is why the pipeline keeps offering the same room in a different costume, and it is the
caveat on the fertility table above: **that table ranks costumes, and a costume's score is mostly
its branch's score.** A roster grows by adding branches, not glyphs.

### The three price tiers

- **A terrain lane is the cheapest in design terms.** Terrain coexists with an occupant instead
  of excluding one, so one lane multiplies against all eight mechanics at once. It is also — see
  the ambiguities — the most expensive in *storage* terms, for exactly the same reason.
- **An occupant code is the middle tier**: a branch, a glyph and a sprite, twice over, plus a
  `tools/draft-room.mjs` roster entry and a conformance re-run.
- **A new `stateKey` lane is the dear tier.** It permanently widens what a board's identity *is*,
  and every state the solver generates pays for it.

### Terrain lanes

| candidate | what it does | axis it opens |
|---|---|---|
| **Grease** | pushed things slide until blocked | the cheapest interaction multiplier available |
| **Sewer grate** | the raccoon walks over, objects fall in | **the roster's only sink.** A container pushed in takes its bags out of `bagsLeft`; it is where the broom sweeps trash, and the only way to retire a sponge |
| **Tar** | a pushed object that enters stops there forever; the raccoon walks on it freely | grease's opposite on the same machinery, and the pair is legible because they *are* opposites |
| **A draught** | what enters keeps going the way the *cell* says | splits push direction from travel direction, with no piece at all |
| **A one-way cell** | passable in one direction only | makes **position** permanent, where today only trash and water are |

### Occupant codes

| candidate | what it does | axis it opens |
|---|---|---|
| **Broom** | pushes trash — any number of trash cells in a line | **makes trash mobile.** It stops being a permanent scar and becomes something to consolidate. It also reads *kind*: it moves trash and nothing else. Broom into a grate is disposal; broom into water is a bridge |
| **Sponge** | soaks water and grease; persists, unconsumed, never becomes a surface | **removes water and grease.** Trades a fixed blocker for a mobile one that must then be managed — bounded by its own presence, needing no capacity rule. The jug's exact mirror |
| **Wheelbarrow** | fixed orientation, never rotates. Pushed **along** its axis into a thing, it scoops it up — **including a multi-cell piece, hooked by any one of its cells.** Pushed **across** its axis, it travels one cell and sheds its load one further cell forward, then rights itself | **carrying without a carry verb** — the barrow carries and you push it. Cheap twice over: it is a one-cell cart, reusing the `cart` membership already in `stateKey`, and its dump is the recycle bin's `tipOut` shape exactly. Scooping multi-cell pieces makes a couch or a bicycle steerable by a one-cell handle |
| **Office chair on castors** | moves one cell when **anything** is pushed into it, fleeing directly away — burst trash, a shoved can, a rolling bin | **makes every pushed object a pusher.** The chair conducts a shove onward. Against a tear it is sharper still: the fan stops being purely a cost and becomes aimed, and the direction is already unambiguous, because the tear branch stamps every `spawned` entry with the bag's own cell |
| **Magnet** | attracts metal, ignores everything else | the only piece that reads another piece's **kind** |
| **Pane of glass** | shove it and it shatters into the *next* cell | a tear with a one-cell footprint, triggered by a push instead of a tear — one cell of trash exactly where aimed, which over water is exactly one bridge cell |
| **Flattened cardboard** | a flat square, pushed like anything else; in water it goes soggy and stays as a bridge | a **second consumable** — today only bags are spent. Pairs against the sponge: the sponge is reusable-with-baggage, the cardboard is one-shot-and-gone |
| **Bicycle wheel** | one cell, anisotropic — rolls along its axis, balks broadside | anisotropy at one cell. A multi-cell piece takes its axis free from `pid`; a one-cell piece pays a code per orientation, but no `stateKey` lane, as long as it never turns |
| **Bicycle** | two cells — the same piece at full size | axis free from `pid` |
| **Rolled rug** | rolls along its axis, moves one cell broadside | the cheapest way into anisotropy |
| **Tire with momentum** | anisotropic, and shoves whatever it stops against one further cell | anisotropy **plus** action at a distance |
| **Filing cabinet** | the drawer slides out one cell in a fixed direction | directional footprint mutation, and self-telegraphing, because the drawer's facing is visible |
| **Umbrella** | one cell closed, three open | footprint mutation; it overlaps the cabinet enough that one of the two is probably redundant |
| **Nesting bin** — *thin* | accepts a smaller container; two occupied cells become one | makes **floor** recoverable. It thickens if it is the only way to get two containers through a one-wide gap |

Two pairs are deliberate opposites, which is what makes each legible: **grease and tar**,
**sponge and cardboard**.

### Declined, with the reason

**Pull · carry · stacking** — push is the only verb.
**Counter / hedge** (things rest on it, the raccoon may not stay) — too close to tar to earn a
second lane, notwithstanding that both halves of the pair ship elsewhere: Sokenban has *spikes*,
which boxes cross and the pusher cannot, and *posts*, which the pusher crosses and boxes cannot.
**Lid** — the garbage should go out, not be hidden.
**Vacuum** — superseded by the broom, which relocates rather than erases.
**Kitty litter** — the sponge does it, and it was the sponge in a costume anyway.
**Leaking sack** (sheds one trash per cell travelled) — no way to make it work.
**Ladder** — vetoed.
**Trolley with a bad wheel** — no.
**Coupled pair** — couches with extra machinery; multi-cell pieces are better designed by hand.
**Weight** (two shoves per cell) — reads as tedium, the same trap push-count fell into.
**Turnstile** — superseded by the rug: same anisotropy, and the rug pays for no orientation lane.
**Rope** — wants to be looser than a grid.
**Broken glass as a floor hazard** — bags never travel, so nothing would meet it; the pane of
glass is what survives from that family.
**Mattress** — a sponge in bigger clothes, and its interesting properties are volumetric.
**A cat, or any creature** — agency is parked until the raccoon-alone game proves fun, and a
creature here would answer the crow question sideways.
**Conveyor** — it needs a tick, and every board is static between inputs; that staticness is
load-bearing for the solver.
**Sorting destinations** — would read as sorting rather than clearing, and touches `isWon`,
`bagsLeft`, win detection and every level file at once.

### Ambiguities the combinatorics turn up

Three are mechanical and checkable against the code as it stands. The rest are decisions.

**M1. The terrain lane is the cheapest tier to design and the first tier to break storage.**
`stateKey` packs a cell as `65 + (o*3 + terrain)*2 + cart`, and `engine/src/solver.rs` casts that
to `u8`. For `T` terrain values and a top occupant code `O`, the largest byte is `64 + 2T(O+1)`,
so the port holds only while `T(O+1) <= 95`. Today that is `3 x 12 = 36`. The five lanes above
take `T` to 8, which at the **present** roster is `8 x 12 = 96` — over by one, before a single new
occupant is added. Terrain multiplies against the occupant count, which is the same property
that makes it cheap to design.

**M2. A tear cannot reach the office chair.** `fanBlockers` refuses a tear when any fan cell
fails `isOccupiable`, and a chair occupies its cell — so the tear is refused and the chair is
never struck. The chair-and-trash interaction requires the fan rule to admit a chair that has
somewhere to flee to, which is a change to the tear branch and not only a new piece.

**M3. More terrain values make the `stateKey` separator hazard denser.** The kinds section can
already emit `|`, which is the field separator; widening the terrain lane puts more
`(occupant, terrain, cart)` triples on that character.

**D1. The magnet pulls.** Push is the only verb, and the magnet is a pulling mechanism wearing a
piece's costume. Does the ban govern the raccoon, or the whole board?

**D2. The sponge is the anti-lake, and the lake is the family Act 3 is built on.** Unlimited
soaking, with travel as the only cost, drains a pool a cell at a time. What bounds it is the
shore — a sponge can only be shoved from a cell the raccoon can stand on — and whether that is
bound enough is a playtest, not an argument.

**D3. A sponge shoved onto grease.** Grease says slide until blocked; the sponge says soak what
it lands on. Does it skate across, drying every cell it crosses, or stop on the first and soak
one?

**D4. The wheelbarrow and a multi-cell piece — tow or lift?** *Tow* keeps the couch's footprint
and makes the barrow a handle, but two pieces moving as one wants a link lane, which is the
coupled pair under another name. *Lift* collapses the couch into the barrow's single cell, which
costs no link — but the dump has to put it back, so the piece's shape and orientation must be
remembered somewhere, and a couch needs its cells free in the right arrangement to land.

**D5. Does the chair chain?** A chair knocked into a second chair either stops, or passes the
shove on. Chaining destroys the predictability a fan preview promises; not chaining means a
chair is sometimes an ordinary blocker for reasons the board does not show.

**D6. A roller that knocks a chair.** A wheelie travels until blocked. Meeting a chair, does it
stop and displace it, or displace it and roll on into the freed cell?

**D7. The tire and the chair both act at a distance.** The tire shoves what it stops against one
cell; the chair flees anything pushed into it. Together that is either one displacement or two.

**D8. The broom against everything that is not trash.** It reads kind and moves trash. Shoved
into a can, is it refused, or is it an ordinary shove?

**D9. Barrow capacity.** Loaded, and shoved along its axis into a second object — a second scoop,
or refused?

**D10. "Balks broadside."** A wheel shoved across its axis moves zero cells or one. The rug says
one; a wheel that says zero is a different piece.

**D11. A loaded barrow shoved into tar** is a permanent loss of both the barrow and its cargo.
That is a trap with no tell, unless the tar reads as one.

**D12. Grease, draught and a one-way cell all govern motion**, and a room may hold all three.
Composition order has to be stated once, in one place, or the three of them will disagree
per-caller.

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
