# LEVELS — Treasure Trash (raccoon-only, working scratch)

> Speculative / working. Cell-exact where marked **[verified]**; **[sketch]** rooms
> are concept-only, not yet checked solvable. Crow is **pinned** — every room here
> must be beatable by the raccoon alone. Goal of a room: **open all bags, then get
> out.** Coordinates: **(x,y), top-left = (1,1)**, x → right, y ↓ down.

> **The data is canonical, this doc is commentary.** Every room below lives as a level
> file in [`levels/act1.tt`](./levels/act1.tt), and every par and solve here
> is checked against the rules engine by `tools/verify.mjs` — including a check that the
> solve strings quoted below appear verbatim, so the prose can't drift from the game.
> Formats and API: [`FORMATS.md`](./FORMATS.md).
>
> Solutions are written in **extended LURD**: lowercase = move, UPPERCASE = push,
> UPPERCASE + `!` = pounce-tear. `uU!dr` is *step up, tear upward, step down, step right*,
> and the token count **is** the par.

## Legend
These are the letters the **diagrams in this doc** use, chosen to be readable in prose.
The level files use the XSB-compatible glyph set instead (`-` floor, `@` raccoon, `$` bag,
`+` raccoon on the exit) — see [`FORMATS.md`](./FORMATS.md). Same cells, two
notations; the files are canonical. **Water is the one that diverges properly:** these
diagrams overlay it on the occupant, and the files cannot, because water takes any occupant
and one character per cell cannot say which. There it is a separate `:water` block.
```
.  floor            R  raccoon (start)      B  garbage bag
#  wall             x  spilled trash (permanent obstacle)
E  the exit (always walkable by the raccoon, never occupiable by anything else;
   counts only when every bag is torn)
C  full can (has a bag)                     c  empty can (pushable)
~  water (the raccoon won't cross it)       =  a filled-in canal cell (floor now)
b  recycle bin (drops a cell of trash)      j  water jug (spills a cell of water)
F  furniture — one letter per piece; a touching same-letter blob is ONE couch, so two
   couches shoved flush together are written F and G (the level files use F G H K M N)
```
The raccoon's starting cell is **plain floor** — there is no entry-stub terrain. A room
may wall it in on either side to make the entrance read as an entrance (L1 does), but the
cell itself has no special rules, and nothing on the board ever *removes* trash: there is
no chute and no disposal object anywhere in the game.

## Rules / vocabulary (⚠ = confirm)
1. **Move** — raccoon steps one cell orthogonally per input. **No pull** — Sokoban's
   root law, and the one that governs everything below. Walking is the *only* reversible
   verb: the cell you came from is empty, so you can always step back into it.
2. **Pounce-tear (directional!)** — stepping *into* a bag in direction **D** tears it,
   spraying a **2×3 fan forward**: the bag's two **side** cells (perpendicular to D)
   **plus the three cells one step ahead in D**. Nothing sprays *backward*. The
   raccoon ends on the bag's cell (which stays clear — only the fan cells get trash).
   ```
   strike ↑ onto B:     before        after
                        . . .         x x x
                        . B .    →     x R x
                        . R .         . . .   (came-from cell stays clear)
   ```
3. **Clearance** — a bag opens only if its **2×3 fan is all free ground** at strike
   time. Fan blocked (wall / off-grid / **spilled trash** / **a can, full or empty** /
   **the exit**) → the strike is **refused**, and the move isn't spent. *Yes — a can in
   the fan blocks a tear. That is the side-cell corollary and the whole of L2's lesson:
   relocate the can first.*

   **A refusal is performed, not reported.** The raccoon lunges, the bag bursts, the
   debris flies out and reaches the cell that won't take it, that cell flashes red and
   buzzes — and then the whole thing **rewinds itself**. The board is exactly where it
   was, the move isn't spent, and the red ✕ and the reason stay on screen afterwards as
   the explanation.

   **The distinction that matters:** the invalid overlap is a *frame in a rejection*,
   never a *position on the board*. There is no state the player has to undo out of and
   no mode where undo is the only legal input — that would be a modal dialog wearing a
   grid costume, and the industry pattern for an invalid move is a soft bounce-back, not
   a dialog. You get the whole visceral "no" without ever rendering a board that the
   rules say cannot exist.

   It is also **scaled and self-effacing**: a refused burst gets the full sequence, a
   refused shove a short lunge, a refused step a quick knock — and the second time you
   make the same mistake in the same room, you get the short version, because by then
   you know. Any keypress skips it.
4. **Mess stays** — the 5 fan cells become **permanent trash obstacles**. Opening a
   bag reshapes the board; your own garbage can wall you in. *(Fork resolved: yes.)*
5. **Full can, when pushed** — slides **one cell** in the push direction **and ejects
   its bag one further cell ahead**; the can is now **empty**. (Raccoon ends in the
   can's old cell, Sokoban-style.)
6. **Empty can** — a normal pushable Sokoban block.

**Arming — a per-room scaffold, `:arm on`, default OFF.** A room that *introduces a
piece* can ask twice before a board-changing action: the first press **aims** (the fan
lights up, or the cells where a can and its bag will land) and **nothing happens yet**;
the second press commits. Aiming costs no move, so you can look down all four directions
for free. Any other direction, or undo, cancels.

**It is off by default and comes off after the room that teaches the verb.** The bag's
directional burst is a genuinely unusual piece — nothing in the Sokoban family sprays
*new permanent obstacles* — so it earns one room of ceremony while the player learns
what it does. After that the game is a block-pusher and plays like one: one press, one
action, free undo. Currently on in **L1** (introduces the bag) and **L2** (introduces
the can), off in L0 and L3.

*When a room does arm, it arms every board-changing action, not just the tear* — because
there is no pull, a push is exactly as permanent. Measured over the shipped pack by
replaying each whole state graph and asking whether the previous state is reachable again:

| verb | reversible by play |
|---|---|
| **move** | 474 / 474 — **100%** |
| **tear** | 0 / 15 — **0%** |
| **push a full can** | 0 / 1 — **0%** (nothing ever re-fills a can) |
| **push an empty can** | 4 / 9 — **44%**, and only by walking round to the far side |

So the line is **move vs. everything else**, never tear vs. everything else.

**Arming is not the fan preview, and they have different lifetimes.** The preview is
*information* — "where would this land" — and a full-information puzzle owes the player
that answer forever; it is on in every room. Arming is *ceremony*, and ceremony is a
teaching aid you remove. Aiming only **focuses** the preview: while armed, just the aimed
direction draws, instead of every adjacent bag at once.

*(All input-layer: the rules engine and the solver never see arming, and `:par` counts
committed actions, so no flag can change a par.)*
7. **The exit `E`** — one per room. It is **plain floor you can always walk over**;
   it just *counts* when you're standing on it and every bag is torn. **Nothing else may
   ever occupy it.** A strike whose fan would land on the exit, or a push that would
   shove a can onto it, is **refused** — the move simply doesn't happen. You cannot bury
   your own way out.
8. **Free undo / restart.** Deterministic. **Win = every bag torn *and* the raccoon
   standing on the exit.**
9. **Water `~`** — terrain, like the wall and the exit. **It takes anything. What it refuses
   is the raccoon.** A can, a bag, a bin, a jug, a couch: shove it off the bank and in it
   goes. Two things follow, and neither is a rule about water:
   - **Whatever goes in cannot come back.** A push finishes with him standing where the thing
     was — which, once it is one cell out, is open canal. He shoves from the bank and stays
     on it, so shoving something into the water is a decision with no second half. A bag that
     lands in the canal can never be opened at all, because opening one means stepping onto
     it, and the room is lost the moment it lands.
   - **What crosses, crosses because he doesn't have to follow.** A wheelie bin rolls clean
     across: it leaves from under the shove and he never moves. A long couch crosses because
     its back end is still on the bank while its front end is afloat, so he always has
     somewhere to stand for the next shove. Nothing in the rules names either case.

   **Filled:** trash that lands in water is *spent filling it*, and the cell stops being
   water — it becomes **ordinary floor**, permanently. Not trash sitting on a hole: the
   garbage IS the ground now, which is why a can can be shoved across a crossing and why a
   later fan can bury one. So trash means *blocked* on the floor and *ground* on the water,
   and that inversion is the whole piece. Only two things fill it — a bag's fan (five cells
   spent, however many happen to be water) and the recycle bin's drop (one for one). A filled
   cell is floor, so a **later fan can bury one** and wall your own crossing off again; what it
   refuses is the *jug*, which pours on bare ground only. The exit is never water.
   Introduced alone in **L14**.
10. **The water jug `j`** — the recycle bin's mirror, and the only piece that writes
   *terrain*. Shove it and it slides one cell and **spills a single cell of water directly
   ahead of itself**, exactly where the bin would have dropped trash. Three things follow,
   and they are the whole piece:
   - **It pours onto bare floor or not at all.** Water already there, spilled trash, a can,
     the exit — all **refused**. The one that matters is the trash: letting water land on
     trash would turn a permanent blocker back into walkable ground, and nothing in this
     game un-blocks a cell.
   - **Shoved twice running the same way, it drowns itself.** The cell it must slide into
     next is the water it just poured — and since the canal takes anything, in it goes, where
     nothing can reach it again. The bin parks itself past its own drop; the jug wades into
     its own. Same adjacency tax, and the only one in the game a piece inflicts on itself.
   - **Its obstacle is the only one you can take back** — and it is the *softer* obstacle
     besides. Trash refuses a fan that would land on it; water **accepts** one, and is
     bridged by it. So the bin bills you a cell of floor permanently, and the jug bills you
     a cell of floor that a bag can buy back. It never runs dry, for the same reason the
     bin never does: the question is where you put the obstacle, not how many you have left.

11. **Furniture `F`** — the first piece that **spans cells**: a rigid polyomino (straight, L,
   Z, T) that shoves **one cell as a unit**. **Translate only — nothing in this game rotates.**
   Two rules, and the second is the whole reason the piece is interesting:
   - **It asks for a clear *edge*, not a clear cell.** Every cell it moves *into* must be
     ordinary empty floor; one blocked cell anywhere along the leading edge refuses the whole
     shove. The exit and open water refuse it like anything else.
   - **The ground it moves *out of* does not count against it.** So a three-long couch shoved
     along its own length asks for exactly one new cell, while the same couch shoved broadside
     asks for three. Long pieces are cheap the way they point and expensive across it, and
     since you cannot turn them, which way a couch lies is a fact about the room rather than
     a thing you fix.

**Core proposition:** *choose each strike's direction and order so your persistent
trash never blocks your path, your way out, or another bag's fan.*

**Design identity — "maximum mess, nothing gets cleaned up."** The raccoon only ever
*adds* or *relocates* mess, never removes it. **No disposal/removal objects** (this is
why the dumpster is cut, and why the raccoon's entrance is an ordinary floor cell rather
than a chute).
Spilled trash, empty cans, every obstacle — all permanent. Boards only get messier; you
win by routing *through* the accumulation, never by tidying it.

**The side-cell corollary (load-bearing):** because the fan includes the bag's two
*perpendicular side cells* and striking means standing *opposite* the fan, an object
directly beside a bag falls in either the fan or the launch cell for **every** strike
direction — it can't be dodged, it must be relocated. Corollary: a bag flush against a
wall can't be opened at all; bags need interior room.

**The exit (fork resolved — was smuggled in unannounced).** The exit first appeared
in a sketch for L4 ("leaves you *and the exit* un-trapped") without ever being
defined. It's now a first-class element, retrofitted through every room, and the
rules above are the whole of it. Three calls, made explicitly:

- **It's terrain, not an object.** Always walkable, never pushable, no state of its
  own. Two different questions get two different answers about it: *can the raccoon
  stand here?* — yes, always. *Can an object come to rest here?* — never.
- **It cannot be buried — the attempt is refused.** *(Reversed on your call, and the
  reversal is the better rule.)* The first draft let trash and cans land on the exit and
  called the result a soft-lock. It's now impossible: the exit is walkable by the raccoon
  and by nothing else, so any action that would put an object there is refused at the
  keypress. The engine enforces it, not the level design — `verify.mjs` checks across
  **every reachable state** of every room that the exit is unoccupied.
  *What it cost:* an entire class of soft-lock disappeared (L1 2 traps → 0, L2 13 → 1,
  L3 10 → 2), and with it the "legal but fatal" beat L1 was built around. *What it
  bought:* the lesson is now taught by refusal instead of by regret, which is the
  cheapest possible failure and squarely what Law 2.4 asks for. The rooms' pars and
  solutions were unaffected — every one still solves in the same moves.
- **It removes the raccoon, never the trash.** He leaves empty-pawed. The exit is
  egress, not disposal — the "maximum mess, nothing gets cleaned up" pillar holds.

**How it reads on screen:** an **emergency exit sign** — white legend and arrow on
green, **unlit while bags remain, lit when the last one tears.** The arrow points at
the nearest board edge, so the tile also tells you which way he's leaving. Green is
borrowed, not invented: ISO 3864 codes green as *"safe condition,"* which is why
ISO 7010's emergency-exit signs are white-on-green worldwide (the US is the odd one
out — NFPA's Life Safety Code has long permitted red as well, hence the red signs
Americans picture first). Using the real convention means the tile needs no tutorial:
everyone over the age of six has already been taught what a lit green EXIT sign
means. It is the one non-Memphis color on the board, and it's a signal color on
purpose — nothing else in the palette should be that green.

**Why it earns its slot:** without an exit, a room ends the instant the last bag
tears, so the last strike is free — you can bury the whole board and still win.
Every room here got easier at exactly the moment it should have gotten hardest.
With an exit, every strike is now also a question about your own way out, and the
game's one lesson — *fire your mess away from where you still need to walk* —
finally applies to the final move too. Cost: one terrain type, no new object (the
budget stays at 3 of ~8).

**The authoring law that comes with it** (against the obvious objection —
that an exit degrades into a walk-back tax): **if the exit's position doesn't rule
out at least one strike direction or push direction, it's a tax — move it.** Ten
extra steps of unopposed walking is not a puzzle. L1's exit forbids the down-strike
(2 refusals); L2's forbids pushing the can left (12); L3's sits in the corridor the
room already taught you to protect (12). Every room must pay that toll, and
`verify.mjs` counts the refusals to prove it does.

**Precedent (this part is real, not invention):** "clear the objective, *then* reach
the exit" is the standard single-screen puzzle structure, and the two ancestors
already cited in `rules.html` both use it — *Adventures of Lolo* (HAL Laboratory,
1989, NES): collect every heart framer, the chest opens, you leave by the door;
*Chip's Challenge* (Epyx, 1989): collect the required chips, clear the socket, reach
the exit tile. *Sokoban* (Thinking Rabbit, 1982) is the counter-example — no exit at
all, the level ends the moment the last crate lands on a goal. We're taking Lolo's
shape, not Sokoban's, and the reason is the paragraph above.

**Precedent check (the scatter mechanic) — [searched 2026-07, no direct match].**
A search for a Sokoban-like using *this* burst (interact → directional multi-cell
spray of **permanent new obstacles**, where the self-made mess is the constraint)
turned up nothing that does both traits together. Nearest cousins, all distinct:
- **Destructive** bomb-Sokoban — *Sokobomb*, *Chop and Bomb*, *Ziggurat*, *Push
  Dungeon*, *Marcos' Mysterious Maze* — explosions **clear** tiles. Ours is additive.
- **Transform-to-terrain** — *A Monster's Expedition* (tree→log→bridge): a controlled
  transform of the pushed object into something *useful*, not a scatter of blockers.
- **Additive-but-deliberate** — classic hole-filling Sokoban (place one box in one
  hole), not a burst.
So the scatter is **uncommon, plausibly novel** (caveat: the PuzzleScript/itch long
tail is huge and unindexed — can't prove absence). *Design consequence:* players
expect "explosion = opens space"; our burst *closes* space, so the **fan preview +
free undo** are load-bearing — they teach the inversion, not just polish.

**Object budget (aim ~8):** `bag`, `can` (full/empty), `spilled trash`, `recycle bin`,
`wheelie bin`, `water jug`, `furniture` = **7 used**, plus the `bag-on-can stack` — built and
unit-tested, but it earns no room yet (see the note at the end of this file), so call it
**7 spent and an eighth parked**. The exit and water are terrain and cost nothing against the budget — but
note that the jug *is* an object, and water itself is the terrain it writes.
Reserved: the crow's pieces (pinned).

---

## L0 — "Out" **[verified]**
*New idea:* move · **the exit**. Nothing else on the board — no bag, so the exit is
live from move one.
```
   x=1 2 3
y1  #  E  #
y2  #  .  #
y3  #  R  #
```
**Solve — `uu`** (par 2): Up, Up → standing on E with zero bags left → win.
That's the entire room: *walk forward, leave.* One idea, taught in isolation, with
nothing to fail at (Witness rule — teach the piece before you combine it). It also
plants the shape every later room inherits: **the last move of a level is stepping
onto E**, so from here on the player is already asking "can I still get there?"

---

## L1 — "Pounce" **[verified]**
*New idea:* directional pounce · the fan · mess is permanent — bolted onto L0's exit.
```
   x=1 2 3
y1  .  .  .
y2  .  B  .
y3  .  .  E
       R      (start cell at (2,4), floor, walls either side)
```
**Solve — `uU!dr`** (par 4): Up → (2,3). Up → strikes B(2,2) going **up**; fan fills
all of y1 plus the side cells (1,2)/(3,2); all clear → bag opens, R ends on (2,2).
Down → (2,3). Right → (3,3) = E, no bags left → win.
**The refusal (and this is the point of adding the exit):** the bag can also be
approached from above — loop up the left side to (2,1) and try to pounce Down. That
fan would land on (1,3)/(2,3)/**(3,3)**, and (3,3) is the exit, so **the strike is
refused**: the exit tile goes red, the HUD says *that's your way out — you can't dump
on it*, and the move isn't spent. One bag, two approaches, and the room quietly tells
you which one it will accept. *Lesson: the fan is not just about your path, it's about
your way out — and the game will not let you get that one wrong.*

---

## L2 — "Heavy Can" **[verified]**
*New idea:* the can — push-to-dump (rule 5) — and the side-cell corollary in action
(an adjacent can must be relocated).
```
   x=1 2 3
y1  .  .  .
y2  .  .  .
y3  E  .  .
y4  .  C  .
y5  .  R  .
```
**Push Up:** can (2,4)→(2,3), **bag ejects to (2,2)**, can now empty at (2,3),
R→(2,4). The empty can now sits directly below the bag — so it blocks **every** strike
(it's in the fan for down/left/right, and it's the launch cell for up). It must move,
and — with only the bag above it and the raccoon below — the only two directions it
*can* move are left and right.
**Solve — `UluRU!dl`** (par 7): Up (push the can) → (2,4). Left → (1,4). Up → (1,3); you're standing **on** the exit
with a bag still out, and nothing happens — that's the second thing this room teaches.
Right → pushes the empty can (2,3)→(3,3), R→(2,3). Up → strike bag (2,2) upward; fan
(sides of y2 + all of y1) is clear → opens. Down → (2,3). Left → (1,3) = E → win.
**Refused — the can is in the way:** try to open the bag before clearing the can and
*every* direction is refused, because the can is either in the fan or on the launch cell.
That's the side-cell corollary saying no out loud.
**Refused — and it kills the mirror solve:** try to shove the can **left** instead —
up the right side to (3,3), push Left — and the push is **refused**, because (1,3) is
the exit and the exit will not take it. The old room accepted either mirror; now
exactly one of them is available, and the board says so the moment you try rather than
ten moves later. *Lesson: relocating your junk is half the job — where you put it is
the other half.*

---

## L3 — "Fire Away From the Path" **[verified — your room]**
*New idea:* direction + mess-stays as a real puzzle. Two bags, one corridor.
```
   x=1 2 3
y1  .  .  .
y2  .  B  .      bag A
y3  .  R  E      corridor — and the way out
y4  .  B  .      bag B
y5  .  .  .
```
Raccoon starts on the corridor at (2,3); the exit is the corridor's right end.
**Solve — `U!dD!ur`** (par 5): at (2,3) push **Up** → strike A(2,2) up (fan fills y1 +
sides of y2); step back **Down** to (2,3); push **Down** → strike B(2,4) down (fan
fills y5 + sides of y4), R ends on (2,4). Corridor y3 never touched → **Up** to
(2,3), **Right** to (3,3) = E → win. (Striking B first works too, same par.)
**The refusal:** strike *either* bag toward the corridor (A down, or B up) and the
fan would put a full 3-wide trash row across y3 — which contains the exit at (3,3). So
both are **refused**. The room's lesson is now enforced rather than discovered: you
cannot seal the corridor, because sealing it means burying the way out. Lesson:
**fire your mess away from where you still need to walk.**
**What the exit adds here:** after both correct strikes the corridor is the *only*
clear row left on the board — the room already made you protect it, and now it's
also the thing you're protecting it *for*. The exit didn't change the solution; it
gave the existing lesson a reason.

---

## L4 — "Right Beside the Door" **[verified]**
*New idea:* a bag parked next to the exit has exactly **one** legal direction — away.
```
   x=1 2 3 4
y1  .  .  .  .
y2  .  E  B  .    bag A, orthogonally adjacent to the way out
y3  .  R  .  .
y4  .  B  .  .    bag B
y5  .  .  .  .
```
**Solve — `D!uuR!l`** (par 5): Down → strike B(2,4) downward (fan fills y5 plus the side
cells (1,4)/(3,4)); R ends on (2,4). Up, Up → (2,2), which **is** the exit — one bag still
out, so nothing happens, exactly as L2 taught. Right → strike A(3,2) **rightward**: the fan
is the x=4 column plus (3,1)/(3,3), all clear. Left → back onto E → win.
**The refusals:** A is orthogonally adjacent to E, so three of its four directions put trash
on the exit — up and down land E in the *side* cells, left lands it in the leading row. All
three are refused, and the room registers **13** exit refusals in total, the most in the pack.
What's left is the one direction that fires A away from the door, and the only cell you can
throw it from is the exit itself. *Lesson: standing on the exit isn't the win, it's the
vantage point — and a bag beside the door can only ever be fired away from it.*

---

## L5 — "Recycling Day" **[verified]**
*New object:* the **recycle bin** `b` — push it and it slides one cell **and drops a single
cell of permanent trash directly ahead of itself**. It is the precise obstacle placer, which
in a game with no targets means it is a piece that *charges you floor* to get it out of the way.
```
   x=1 2 3 4 5
y1  .  .  .  .  .
y2  .  .  B  .  .
y3  .  E  b  .  .
y4  .  .  R  .  .
y5  .  .  .  .  .
```
The bin is parked on (3,3) — the cell you have to stand on to strike the bag upward. It has
to move, and there are only two ways it can go.
**Solve — `luRU!dl`** (par 6): Left, Up onto the exit at (2,3). Right → shove the bin to
(4,3); it drops trash at (5,3) as it goes, and R takes the launch cell. Up → strike the bag,
fan filling y1 plus (2,2)/(4,2). Down, Left → E → win.
**The refusals:** shoving the bin **up** is refused before you spend it — the bag is in the
way. Shoving it **left** is refused too: the exit at (2,3) will not take it. The room logs
**8** exit refusals, and what's left is the one direction that works.
*Lesson: the bin is not an obstacle you remove, it's an obstacle you relocate — and it bills
you a cell of floor for the service.*

---

## L6 — "Runaway Bin" **[verified]**
*New object:* the **wheelie bin** `W` — it **rolls until something stops it** and dumps its
bag **out the back** on impact. Emptied (`w`) it still rolls. You choose which wall it hits;
you do not choose where it stops.
```
   x=1 2 3 4 5
y1  .  .  .  .  .
y2  .  .  W  .  .
y3  .  .  R  .  .
y4  .  .  .  .  .
y5  .  E  .  .  .
```
**Solve — `UluuRdR!lddd`** (par 11): Up → the bin rolls to (3,1), the top edge stops it, and
its bag drops into (3,2) — the cell it just vacated. **The raccoon does not follow it**: it
leaves from under the shove, which is the one thing about this piece you have to unlearn from
the can. Left, Up, Up to (2,1). Right → the emptied bin rolls clear to (5,1). Down. Right →
strike the freed bag rightward; its side cells are (3,1) and (3,3), and (3,1) is only clear
because you rolled the bin off it. Left, Down, Down, Down → E → win.
**Why it is the longest room in the pack:** every container in this game ends up adjacent to
the bag it produces, so the bag is never immediately strikeable — the bin that dropped it is
standing in its side cell. The wheelie bin makes you clear the same obstacle twice, once
loaded and once empty. **Zero traps**: nothing here can be lost, only lengthened.
*Lesson: a piece that keeps moving after you stop pushing is aimed, not placed.*

---

## L7–L13 — the ladder **[verified, found by search]**

These seven were not composed the way L0–L6 were. Each of those rooms exists to teach one
thing, and the prose above can say what that thing is. These were **found**: a seeded
generator threw random layouts at the rules engine across 24 parallel workers, 1,474 came
back solvable inside the target band, and these seven were selected against three
measurable properties — a rising par, the fewest optimal lines, and the fewest ways to
quietly lose.

So the honest description is a **difficulty ladder, not a lesson plan.** Par climbs by two
a room, from 13 to 25, and each room re-uses pieces the pack has already taught rather than
introducing anything. Four different piece mixes keep them from reading as one room
stretched seven ways.

| Room | Par | Pieces | Optimal lines | Traps | States |
|---|---|---|---|---|---|
| **L7** — Three Bags Full | 13 | three bags | 1 | 13 | 297 |
| **L8** — Bin Night | 15 | a bag, a full can, a recycle bin | 1 | 7 | 3089 |
| **L9** — Tight Corner | 17 | two bags, a recycle bin | 2 | 3 | 258 |
| **L10** — Long Way Round | 19 | a bag, a wheelie bin | 1 | 16 | 1260 |
| **L11** — Crosstown | 21 | two bags, a wheelie bin | 1 | 34 | 2626 |
| **L12** — The Far Side | 23 | a bag, a wheelie bin | 3 | 12 | 1537 |
| **L13** — Closing Time | 25 | two bags, a wheelie bin | 2 | 43 | 2492 |

Two numbers in that table are worth reading. **Optimal lines** is how many distinct
shortest solutions exist — 1 means the room has exactly one intended answer, and every
room here has 1, 2 or 3. **Traps** is how many legal actions take a winnable board to an
unwinnable one; the search turned up rooms with over 1,600 of them, which is a board that
has stopped telling the player anything, so the selection capped it at 60.

**L7 — "Three Bags Full"** · par 13 · `lldR!ldD!ulluR!l`
```
----@
E$-$-
-----
--$--
-----
```
**L8 — "Bin Night"** · par 15 · `lDldL!rurrdLLdR!l`
```
-b--@
---C-
-$---
--E--
-----
-----
```
**L9 — "Tight Corner"** · par 17 · `uruullDurrddD!ulU!d`
```
------
------
b$----
-E----
-@$---
------
```
**L10 — "Long Way Round"** · par 19 · `uuulDdddlU!drrddLuL!r`
```
-----
---W-
--$--
----@
----E
-----
```
**L11 — "Crosstown"** · par 21 · `rrUuurD!ulluuRdR!lulD!ul`
```
E-----
-$----
------
---W$-
-@----
------
```
**L12 — "The Far Side"** · par 23 · `uuuurrDdL!rddrddLuL!ruuuu`
```
----E-
--$W--
------
------
-@----
------
```
**L13 — "Closing Time"** · par 25 · `uuuulDddlU!ddddRrU!dlllluR!l`
```
------
---$W-
------
------
E$---@
------
```

**A caveat worth keeping.** A searched room is verified, not designed. Every claim above is
machine-checked — the par is provably minimal, the solve replays to a win, the trap and
refusal counts are exact — but nothing checks that a room is *interesting*, and no search
can. If any of these plays flat, it should be swapped out rather than defended: the bank of
candidates it came from is in `levels/bank.jsonl`, several hundred rooms deep.

**Measured since, and the news is bad.** `tools/metrics.mjs` scores these seven on what they
cost the player rather than on par, and they do not hold up: par climbs 13 → 25 while the number
of board-changing *decisions* stays flat at 3–5, so the ladder is built out of walking; L11 and
L13 have zero coupling between their bags (independent puzzles sharing a grid); and L11 lets you
keep playing for 34 moves after the room is already unwinnable. The bank cannot supply
replacements — 0 of its 226 rooms pass the same filters — so these need regenerating rather than
re-sorting. The laws and the generator design are in
[`LEVEL-GENERATION.md`](./LEVEL-GENERATION.md). Note also that **the generator that produced
these rooms is not in the repo** — only the bank survived it.

---

## L14 — "Wet Paws" **[verified]**
*New terrain:* **water** `~` — the raccoon will not cross it, but he will happily walk on
what he throws into it. **Trash landing in water fills it permanently, and a filled cell is
ordinary walkable ground.** This is the one place in the game where making a mess buys you
something, and it does not dent the pillar: nothing is cleaned up, a hole is filled in.
```
   x=1 2 3 4
y1  .  .  .  .
y2  .  E  B  .    bag A, beside the exit
y3  .  .  .  .
y4  ~  ~  ~  ~    the canal — the only thing between him and the way out
y5  .  R  B  .    bag B
y6  .  .  .  .
```
**Solve — `R!uuluR!l`** (par 7): Right → strike B(3,5) **rightward**. Its fan is the side
cells (3,4)/(3,6) plus the x=4 column at (4,4)/(4,5)/(4,6) — and (3,4) and (4,4) are canal,
so those two cells fill in and become floor. R ends on (3,5). Up onto the bridge at (3,4),
Up to (3,3), Left to (2,3), Up to (2,2) — which **is** the exit, with a bag still out, so
nothing happens. Right → strike A(3,2) rightward, away from the door, exactly as L4 taught.
Left → back onto E → win.
**The refusal that opens the room:** the exit is straight up from the start, and the first
move anyone tries walks into the canal. It is **refused at move zero** — *he's not wetting
his paws — fill it in first* — which is the cheapest possible way to teach a new piece: it
costs no move, and the answer is on screen. **Zero traps in the whole room**; nothing here
can be lost, only lengthened.
*Lesson: your mess is a wall on the floor and a floor on the water.*

**Two rules fall out of the geometry, and both are load-bearing:**
- **Only a bag can bridge a canal.** The raccoon ends a tear standing on the *bag's* cell,
  which is behind the fan — so the bridge is in front of him with nothing in between. Every
  other piece parks itself on the only dry cell that approaches the bridge it just built (a
  water cell's only dry neighbours are the two banks), and seals it. The recycle bin *can*
  fill one cell of water — one spent for one gained, the cheapest bridge in the game — but
  it can never do so for its own benefit. That is the adjacency tax in its purest form, and
  it is unit-tested.
- **Water takes anything, and gives nothing back.** A can shoved at the canal goes in. So does
  a bag ejected from a full can — and that bag can then never be opened, which loses the room
  on the spot. What stops any of this becoming a second way to bridge is the same adjacency
  tax as above: only *trash* fills a cell, and he still has to be able to stand somewhere to
  put it there. So there remains exactly one way to build a bridge you can use.

---

## L15 — "Two Crossings" **[verified — but see the note below: this room changed]**
*What it is now:* three bags, two of them spent on the canal, so the fans you have left are
the whole budget.
```
   x=1 2 3 4 5
y1  .  .  .  .  .
y2  .  B  E  .  .    bag A, beside the exit on the far bank
y3  ~  ~  ~  ~  ~    the canal
y4  .  B  R  B  .    bags B (left) and C (right)
y5  .  .  .  .  .
```
**Solve — `L!rR!uulL!r`** (par 8): Left → strike **B**(2,4) *leftward*; two of its five fan
cells land in the canal at (1,3)/(2,3) and the west crossing exists. Right → (3,4). Right →
strike **C**(4,4) rightward, dropping two more cells into the canal at (4,3)/(5,3): the east
crossing. Up onto it, Up to (4,2), Left onto the exit at (3,2) with a bag still out. Left →
strike **A**(2,2) *leftward*, away from the door as L4 taught — and its fan lands squarely on
the west crossing you built four moves ago, burying it. Right → E → win.
*Lesson: the crossing you build first is the one you can afford to wreck.*

**Where it sits against its own laws, and what it lost.** This room was built to ask **order**
— *which bag first* — and it no longer does. It was the pack's only room that did.

The cause is a deliberate rules change, recorded here rather than quietly absorbed: a filled
canal cell used to be *water carrying trash*, which meant a later fan could not land on it. It
is now **ordinary floor**, so a later fan can, and burying your own crossing became legal. That
is what opened the eight-move line above, and with it the order metric went **1/2 → 2/2**:
both reachable bags can now go first and both leave a winnable board.

What the room kept: `coupling` 0.89, `solves` 1, `walkRatio` improved 2.33 → 1.67, `pm` down
12 → 10, `bridges` 4. It is a decent path-and-orientation room. It is not an order room, and
`R` is an open gap in the pack again — the sweep that produced this one (46,428 layouts) would
have to be re-run against the new rules to fill it.


---

## L16 — "Wet the Landing" **[verified — found by a targeted search]**
*New object:* the **water jug** `j` — shove it and it slides one cell and **spills a single
cell of water directly ahead**, exactly where the recycle bin would have dropped trash. Same
delivery, opposite material: the bin's obstacle is permanent, and the jug's is the only one
in the game you can take back.
```
   x=1 2 3 4 5
y1  .  .  .  .  .
y2  .  E  .  B  .    the exit and the bag, three cells apart along the top
y3  .  .  .  .  .
y4  .  .  j  .  .    the jug
y5  .  .  R  .  .
```
**Solve — `UruU!ll`** (par 6): Up → shove the jug from (3,4) to (3,3); it spills a cell of
water at (3,2) as it goes, and you take the cell it left. Right, Up to (4,3). Up → strike the
bag at (4,2) upward; its fan is the side cells (3,2)/(5,2) plus the y1 row — and **(3,2) is
the water you just poured, so that fan cell lands as a bridge instead of a wall**. Left onto
it, Left → E → win.

**The room turns on one cell, and you cannot avoid spending it.** (3,2) sits between the bag
and the door, and every way of opening that bag consumes it: three of the four strike
directions drop fan trash on it, and the fourth is struck from it. So the question is never
*whether* to spend (3,2) — it is **what it is made of when the trash arrives.** Dry, it
becomes a wall and you detour round through y3: **8 moves, measured**, against the jug line's
6. Wet first, and the same trash lands as floor.

*Lesson: the bin decides where your mess goes. The jug decides what your mess is worth.*

**The refusals and the traps.** The exit refuses **8** actions across the room. There are
**6** ways to lose it, and two of them are about the jug rather than the bag. Shove it
**right**, into (4,3), and it blocks the only cell the bag can be struck from. Shove it
**up twice**, and the second shove walks it into the puddle the first one made, where nothing
can reach it — and it is standing in the bag's side cell, so that bag is beyond opening too.
The other four are the pack's oldest mistake in new clothing: fire the bag before you have
poured, and its own trash walls you off from the door.

**What the search found, stated plainly.** This is the *only* room of its kind on a 5×5 open
board: of 303,600 four-piece layouts, exactly one — up to its 8 rotations and reflections —
has a unique shortest solve that pours water, bridges it, walks it, and still leaves the exit
forbidding something. On 6×4, **255,024 layouts produced none at all.** So the room is not a
pick among many; it is the shape the piece admits. Its 5 traps are high for an introduction
(L5 introduces the bin with 1, L14 introduces water with 0), and that is the honest cost of
the constraint being this tight. Flagged for playtest alongside L15.

---

## L17 — "Both Ends" **[verified — found by a targeted search]**
*New object:* **furniture** `F` — the first piece that **spans cells**. A rigid polyomino that
shoves one cell as a unit, translate-only, and its whole leading edge must be clear. It places
nothing and spends no floor; what it costs you is that it takes up more room than you can see
from the end you are standing at.
```
   x=1 2 3 4 5
y1  .  E  .  .  .
y2  .  F  B  .  .    the couch lies north–south; the bag is beside its top end
y3  R  F  .  .  .
y4  .  .  .  .  .
```
**Solve — `uurDR!lu`** (par 7): Up, Up to (1,1). Right onto the exit at (2,1), with the bag
still out. Down → shove the couch from (2,2)/(2,3) to (2,3)/(2,4); it asks for **one** new
cell, (2,4), and you take (2,2). Right → strike the bag at (3,2) rightward, fan filling the
x=4 column plus (3,1)/(3,3). Left, Up → E → win.

**The refusal is the lesson, and it is one no single-cell piece can give you.** The first thing
anyone tries from the start is Right — shove the couch out of the way. The cell in front of the
end he actually touched, (3,3), is **empty**. The shove is refused anyway, because the couch's
*other* end needs (3,2) and the bag is sitting in it. You pressed a direction, looked at the
cell in front of you, and the game said no about somewhere else.

What works is pushing it **the way it lies**. North–south, the couch is stepping into ground it
already occupies except for one cell at the far end — one cell instead of two. Since nothing in
this game rotates, that asymmetry is a fact about the room rather than something you can fix.
*Lesson: a couch is cheap along its length and dear across it, and both ends have to fit.*

**Zero traps in the whole room**, 16 refusals caused by the exit. Like L14, nothing here can be
lost — only lengthened.

---

## Proposed next rooms **[sketch — not verified]**
- **L2-redux — the can, rebuilt** per the rework note above.
- **A room that fences you in on the long axis.** L5 cuts the board because it is three
  cells wide and a fan spans it. On a wider board that needs walls, and walls are awkward:
  a fan cell that lands on a wall is *not occupiable*, so the strike is refused rather
  than cramped. A fencing room on a wide board therefore has to be built out of **trash**
  the player has already laid down, not out of level geometry.
- ~~**A bag that must be opened last.**~~ **Built — L15 "Two Crossings"**, in its mirror
  form: a bag that must be opened *first*, because its fan is the only route to the rest of
  the room. But note what this sketch asked for and L15 does not deliver — it forces the
  order by *punishing the wrong one after the fact*, exactly the thing the last line here
  warned against. A room that **refuses** the wrong first tear outright is still unbuilt,
  and would be the better teacher; it is also the fix for L15's `pm` of 12.

**A constraint worth knowing before designing another room.** The verifier requires the
exit to forbid at least one action, and a bag's fan only ever reaches cells that are
Chebyshev-adjacent to that bag — its two side cells and the three cells one step ahead.
So **the exit has to sit next to a piece** or it forbids nothing. In a *one-bag* room that
turns out to be mutually exclusive with a fencing trap: the raccoon always ends a tear on
the bag's cell, and the exit is adjacent to that cell, so he is never sealed away from it.
That is why L5 needs two bags to do what it does. A can also satisfies the gate, since a
push that would put the can — or its ejected bag — on the exit is refused the same way.

**Act 1 spine:** L0 → L1 → L2 → L3 → L4 → L5 → L6, **one new object per room** from L5 on.
Par runs 2, 4, 7, 5, 5, 6, 11. Still no crow needed — the honest test of the raccoon-alone game.

**The adjacency tax, and what it costs a room.** Every container in this game puts the bag it
produces in a cell *next to itself* — the full can ejects one cell past where it lands, the
wheelie bin dumps directly out the back, the stack launches past the can it slides. A bag
adjacent to a solid piece cannot be struck in any direction: the piece is either in the fan's
side cells or standing on the launch cell. So **every container costs two relocations, not
one** — move it to free the bag, then move it again to free the strike. That is the floor
under these rooms' pars, and it is why the wheelie bin's room is par 11 rather than 6.

## Authoring checklist (every new room)
**Items 1, 3, 4 and 5 are now enforced by `tools/verify.mjs` — a room that violates
them fails the build rather than reaching a player.**

1. Exactly **one** `E`, and nothing starts on it (no bag, no can, no raccoon). *(checked)*
2. The raccoon start and the exit are **different cells** — otherwise L0's lesson
   ("walk to the way out") reads as "do nothing." *(checked)*
3. The room is solvable *and* E is still reachable after the last strike — a room
   that opens every bag but strands you is a bug, not a difficulty setting (Law 1.8).
   *(checked: solvability + provably minimal par)*
4. The exit's placement rules out at least one strike or push direction. If it
   doesn't, it's a walk-back tax — move it. *(checked: the exit must cause ≥1 refusal
   in any room that has a bag)*
5. State the par as the **full** solve, including the walk to E. *(checked: the LURD
   token count must equal `:par`, and the solve must replay to a win)*
6. **No silent traps.** A plain *move* must never take a winnable board to a dead one —
   only a push or a tear may lose the room, because only those visibly change the
   board. This is Block-Pusher Law 1.7 ("foreseeable dead-ends") turned into an
   assertion; it is the check the Laws always implied and never had. *(checked)*

---

## Item set (raccoon-only — going forward)
Pillar: **maximum mess, nothing gets cleaned up** — only *add* / *relocate*, never remove.
**No shiny, no collecting, no RNG.** Win = **every bag torn open** (a transformation
goal) **and the raccoon standing on the exit** (get out of the alley you just wrecked).

| Object | On push / strike | Constraints |
|---|---|---|
| **Garbage bag** | step into it in dir D → tears open, sprays a **2×3 fan of permanent trash** (2 side cells + the 3 cells one row ahead in D); raccoon ends on the bag's cell | opens only if the whole fan is clear floor **and free of the exit**, else the strike is refused; can't be pushed — only *launched* via a stack; needs interior room |
| **Metal can** (full) | push → **slides 1**, ejects its bag **1 further ahead**, becomes an empty can; raccoon advances into its old cell | both the can's destination *and* the bag's landing cell must be clear |
| **Empty can / plain block** | push → slides 1 (plain Sokoban block) | destination clear; **never removable**; may start on the board as a plain block |
| **Exit** | — (terrain, not an occupant) | walkable at all times; **wins the room** only while standing on it with zero bags left; **protected by the engine** — any strike or push that would land trash, a can or a bag on it is refused, so it can never be sealed; exactly one per room |
| **Spilled trash** | — (inert) | **permanent** obstacle; never moves, never clears — **except in water, where the same trash is walkable ground** |
| **Water** | — (terrain, not an occupant) | **anything may rest in it; the raccoon may not.** Whatever he shoves in is gone for good — a push leaves him standing where the thing was, and that is now canal. Rollers cross it (he doesn't follow them) and a long couch crosses it (its back end keeps the bank). Trash that lands in it is spent **filling** it: the cell stops being water and becomes ordinary floor, which anything may then rest on and a later fan may bury. Only a bag's fan or the recycle bin's drop fills it. Never the exit. Terrain, but **not static** — the water jug writes more of it mid-room |
| **Bag-on-can stack** | push → top bag **launches 2** ahead (loose), can **slides 1** (still full); raccoon advances 1 | landing cells clear; launched bag must still be struck; only way to **reposition** a bag |
| **Recycle bin** | push → slides 1, **drops 1 cell of trash** directly ahead | destination clear (precise obstacle placer) |
| **Water jug** | push → slides 1, **spills 1 cell of water** directly ahead | the spill needs **bare floor** — water, trash, an object or the exit all refuse it. Never runs dry. Shoved twice running the same way it drives itself into the puddle it just poured, where nothing can reach it again — legal, and a permanent loss of the piece. Its obstacle is the **soft** one — trash blocks a fan, water accepts one and is bridged by it |
| **Furniture** (couch/mattress) | rigid **polyomino** (L / Z / T / straight); push → shoves as a unit 1 cell | only if **all** leading cells clear — the cells it *vacates* don't count, so it is cheap along its length and dear across it; **translate-only** (no rotation); multi-cell footprint |
| **Wheelie bin** | holds a bag; push → **rolls until it hits a wall**, then dumps its bag **1 cell in reverse** (out the back); empty bin still rolls | won't stop unless stopped; reverse cell must be clear (else no-op) |
| **Shopping cart** | a **2-cell wheelie bin** (rolls + holds a bag + reverse-dump on impact) | as wheelie bin, ×2 footprint |

**Global rules:** step 1 cell/move · no pull · actions resolve on push/strike · all mess
**permanent** · free undo/restart · deterministic, **no RNG, no collecting** · win = every
bag open **and** the raccoon on the exit.

**Cut:** shiny/treasure & any collecting · aerosol · leaky sack/bag · cardboard box (= empty can)
· dumpster · gum/tar · oil slick · glass bottle.

**Implemented and verified in `src/`:** bag, metal can, exit, spilled trash, **recycle
bin**, **wheelie bin**, **water**, **water jug** — L0–L6 at pars 2/4/7/5/5/6/11, L14 at par 7
and L16 at par 6, every one a provably minimal solve.
The two failure classes stay separate: **refusals** (an action the exit or a blocked fan
will not accept, played out and rewound at no cost) and **stranding traps** (legal, and
they lose you the room). Each piece's rule has a unit test in `tests/items.test.js`.

**Implemented but with no room yet — the bag-on-can stack.** The engine supports it and it
is unit-tested, but it does not currently earn a level. A stack holds **two** bags (the
loose one on top and the one still in the can beneath), and both of them pay the adjacency
tax above, so every solvable room built around it comes out at **par 20 with 5–10 distinct
optimal lines and 300+ soft-locks** — measured across wall-free and walled layouts from 5×5
up to 7×6. That is an expert-act piece, not an introduction. It would want either a late
slot or a rules change (a stack whose can is *empty* underneath would cost one bag and one
relocation instead of two).

**The multi-cell state model is built.** Cells belonging to a piece that spans cells carry a
`pid` naming which piece they are part of, `stateKey` encodes the partition as well as the
codes, and the `.tt` format writes one letter per piece so `FFFF` (one long couch) and `FFGG`
(two short ones flush together) are different boards rather than the same one. **Furniture is
implemented and unit-tested on it.** The **shopping cart** — a 2-cell wheelie bin, so rolling
and a reverse-dump on top of a footprint — is no longer blocked on the model; it is just not
built yet.
