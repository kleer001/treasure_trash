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

## The roster, and the axes it has not got

Nothing in this section is chosen. It is the candidate pile, kept so the same ideas are not
re-derived and the same dead ends not re-walked.

### Twelve glyphs, eight mechanics

`explain` branches once per mechanic, and several glyphs share a branch: tear (`$`),
shed-a-bag (`C`/`S`/`W`), shed-trash (`B`), pour (`j`), slide-inert (`c`/`b`), roll
(`W`/`w`), rigid multi-cell (`FGHKMN`), carry (`PQR`). Four glyphs are one idea at three
sizes.

**That is why the pipeline keeps offering the same room in a different costume**, and it is the
caveat on the fertility table above: that table ranks costumes, and a costume's score is mostly
its branch's score. A roster grows by adding branches, not glyphs.

### The axes nothing has

- Nothing removes trash.
- Nothing removes water.
- Nothing pulls.
- Nothing toggles — a piece's behavior is a function of its occupant code alone, so no piece
  can be put into a second mode and left there.
- Only bags are consumed.
- No piece treats another piece's *kind* as different from any other.
- Every push costs the same, and distance costs nothing.
- The push direction is the travel direction.
- A cell holds one occupant, so nothing rests on anything.
- The raccoon holds nothing.

### What a new kind costs

The bill, so the list below reads as axis-added over price. An occupant code and a behavior
branch in `src/rules.js`; a glyph in both directions in `src/format.js`; a draw in
`src/sprites.js`; the same code, glyph and branch again in `engine/src/board.rs` and
`engine/src/rules.rs`; a roster entry for `tools/draft-room.mjs`; a re-run of the conformance
proof.

Three price tiers, and they are far apart:

- **A terrain lane is the cheapest thing on the page.** Terrain coexists with an occupant
  instead of excluding one, so one lane multiplies against all eight mechanics at once.
- **An occupant code is the middle tier** — one branch, one glyph, one sprite, twice over.
  The codes have a ceiling near 30: `engine/src/solver.rs` packs a cell into a `u8`, and the packed byte for the
  code above it wraps to zero without a word. Glyphs are not the constraint;
  printable ASCII gives about ninety.
- **A new `stateKey` lane is the dear tier**, because it is a permanent widening of the
  identity of a board, and every state the solver ever generates pays for it.

### Terrain lanes

- **Grease.** Anything shoved onto it slides until blocked. One lane, and it multiplies
  against every mechanic there is — the cheapest interaction multiplier available.
- **Sewer grate.** The mirror of water: the raccoon walks over, objects fall in. Runs of N
  cells, so `canals()`'s run enumerator serves it unchanged. On an edge it reads as disposal;
  in the middle as a hazard — one piece, two roles, decided by placement. Rollers vanish into
  it; a rigid multi-cell piece spans a one-wide grate and neutralises it; a tear's fan across
  one disposes of trash for free. A container pushed in takes its bags out of `bagsLeft`,
  which is a second way to spend a bag that costs travel instead of floor.
- **Tar, or wet paint.** A pushed object that enters stops there forever. Grease's opposite on
  the same machinery, and the pair is legible precisely because they are opposites.
- **Kitty litter.** Pours onto grease and cancels it. Terrain cancelling terrain, and a reskin
  of the shed-a-load mechanic, which is what makes it cheap.
- **A one-way cell.** Passable in one direction only. It would make *position* permanent,
  where today the only permanence is trash and water — which is the same objection that is
  usually raised against pull, arriving from the other side.
- **A draught.** Grease with a direction: what enters keeps going the way the cell says, not
  the way it was shoved. Splits push direction from travel direction, one of the absent axes,
  without touching any piece.

### Containers, and what they shed

- **Sponge.** The jug's mirror — `{slides, soaks:true}` against `{slides, pours:true}` — and
  one more `tipOut` branch. It has to be bounded or it is an eraser; making a soaked sponge
  stay soaked is the cheapest bound.
- **Vacuum.** Eats trash and fills up. The bounded version of fire: same job, a natural limit,
  no cascade. It is the exact inverse of the recycle bin, and it gives trash a sink, which
  turns the act's core tension into an economy.
- **A lid.** Shoved onto a container, it stops the container shedding. The first *toggle*, and
  a cheap one — it converts a container's tipping bill from a constraint the room imposes into
  a decision the player makes.
- **A cardboard box.** An ordinary slider on dry floor; shoved into water it soaks and becomes
  a permanent bridge cell. A deliberate one-cell crossing that costs you the box, spending the
  water and bridge lanes that already exist rather than a new multi-cell piece.
- **A leaking sack.** Sheds one trash into each cell it passes, so travel costs floor. The
  only candidate that makes *distance* a resource.
- **A pane of glass.** Shove it and it shatters into the next cell — a bag's tear with a
  one-cell footprint instead of a five-cell fan, triggered by a push instead of a tear. The
  precise instrument: one cell of trash exactly where aimed, which over water is exactly one
  bridge cell.
- **A nesting bin.** Accepts a smaller container and holds it, two occupied cells becoming
  one. The cart already does this while rolling and spanning several cells; the interest in a
  one-cell version is that it makes *floor* recoverable, which nothing else does.

### Shape and orientation

- **A rolled rug.** Shoved along its axis it rolls; shoved broadside it moves one cell. A new
  axis for free, because a rigid multi-cell piece already knows its long axis from `pid` — no
  orientation field and no new `stateKey` lane, which is exactly what a turnstile would need.
- **A bicycle wheel and a bicycle.** The wheel rolls; the two-cell bicycle is anisotropic,
  rolling along its length and dragging sideways. The two-cell version gets its axis free from
  `pid`, like the rug.
- **A filing cabinet.** One cell closed; shoved, the drawer slides out one cell in a fixed
  direction and it becomes two cells blocking a lane it was not blocking. Directional
  footprint mutation, and self-telegraphing, because the drawer's facing is visible.
- **An umbrella.** One cell closed, three open. Footprint mutation with several possible
  unfold shapes, which makes narrow lanes matter. It overlaps the cabinet enough that one of
  the two is probably redundant.
- **A ladder.** A rigid 1×3 laid across water. The placeable-bridge idea that does not collide
  with the sponge.
- **A wheelbarrow.** One cell, with a fixed push direction. The turnstile's directionality
  carried on an object instead of a terrain lane, so it needs no new cell field — and the
  shape says it out loud.
- **A trolley with a bad wheel.** Veers a fixed cell sideways as it travels. Where the
  wheelbarrow constrains the input, this warps the output; both attack the same absent axis
  from opposite ends.

### Pieces that act on other pieces

- **An office chair on castors.** It moves when hit by burst trash — one cell, fleeing directly
  away from the bag. **This is the one that changes what tearing *is*:** the fan stops being
  purely a cost and becomes an aimed action. The direction is already unambiguous in the data
  model, because the tear branch stamps every `spawned` entry with the bag's own cell, so a
  five-cell spray still yields one ray. Telegraph it by extending the existing fan preview to
  show the knock-on — no new HUD vocabulary. One hop per hit and no chaining: a knocked piece
  knocking another destroys the predictability the preview promises. Deliberately furniture and
  not an animal — a cat here would quietly answer the crow question, and a castored chair
  telegraphs "this rolls" in its own sprite while opening no doors.
- **A magnet.** Attracts metal, ignores everything else. The first piece that treats other
  pieces as different kinds.
- **A tire with momentum.** Rolls, and shoves whatever it stops against one further cell.
  Action at a distance, on the roller branch that already exists.
- **A coupled pair.** Two pieces chained within N cells of each other: push one and the other
  follows to stay in range. Action at a distance with a memory, and it wants a link lane, which
  puts it in the dear tier.

### Grammar changes

These are not pieces. Each is a second verb applied to all eight mechanics at once, which is
what makes them the largest items on the page and the largest payoffs.

- **Pull.** The usual objection — that pull makes deadlocks reversible and puzzles soft — does
  not bite here, because the permanence is trash and water, not piece position.
- **Carry.** The raccoon holds one thing. It adds a `stateKey` lane and multiplies the state
  space by the size of the roster, and it argues with the genre's identity, which is that you
  push.
- **Stacking.** Something rests on something else. It breaks the one-occupant-per-cell
  representation the whole engine is built on, and should be costed as a rewrite rather than a
  feature.
- **Weight.** A piece that needs two shoves to move one cell. Cheap to write and it wants a
  counter lane, but it reads as tedium rather than difficulty, which is the same trap push
  count already fell into.

### Open representation questions

Three candidates are blocked on a question about what a cell *is*, and each should be answered
before it is built, not during.

- **A fence, or a railing** — nothing may rest on it; the raccoon may cross. It splits "where I
  can walk" from "where anything can sit", which is one predicate doing two jobs today, and one
  flag buys cells that forbid particular tear *directions* while leaving the route untouched.
  **But "cross without staying" has no representation while every move lands on a cell.** Either
  he may stand on it, or it is a wall to him too, or movement gains a step-through rule.
- **A counter, or a hedge** — the fence's mirror: things may be shoved across it and rest on it,
  the raccoon may not walk on it. It forces the route to go round while the push line goes
  straight. It falls out of the same predicate split, and it needs no new movement rule, which
  makes it the cheaper half of the pair.
- **Tar** — the theme and the rule disagree. The raccoon should be able to walk on tar, which is
  exactly what tar argues against. Either the theme changes or the rule does.

### Declined, and why

- **Rope** — wants to be looser than a grid.
- **Broken glass as a floor hazard** — bags never travel, so nothing would ever meet it. The
  pane of glass is the idea from this family that survives.
- **A mattress** — a sponge in bigger clothes, and its genuinely interesting properties are
  volumetric.
- **A cat, or any creature** — agency is parked until the raccoon-alone game proves fun, and a
  creature here would answer the crow question sideways. See the office chair.
- **A conveyor** — a lane that moves what stands on it needs a tick, and the game has no time
  in it. Every board is static between inputs, and that is load-bearing for the solver.
- **Sorting destinations** — blue-bin items to the blue bin. It would make the game read as
  sorting rather than clearing, and it is a goal-structure change touching `isWon`, `bagsLeft`,
  the solver's win detection and every level file at once.

### Where to mine for more

The trash encyclopedias are the wrong shape: *Encyclopedia of Consumption and Waste* (Zimring
& Rathje, SAGE 2012) and *Trash Talk* (Collin) are garbology-as-sociology — attitudes and
policy, not object catalogues. Municipal sorting wizards are better; Vancouver's runs to 1,486
items. **Bulky-item and large-item pickup lists are better still**, because those are precisely
the objects too big for a bin, which is to say the ones you push.

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
