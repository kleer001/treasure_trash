# LEVELS — Treasure Trash

Room-by-room reference for the shipped pack. Every room here lives as data in
[`levels/act1.tt`](./levels/act1.tt); `tools/verify.mjs` proves each par minimal against
the rules engine and checks that the solve strings quoted below appear verbatim, so this
file cannot drift from the game. Formats and API: [`FORMATS.md`](./FORMATS.md).

Coordinates are **(x,y), top-left = (1,1)**, x → right, y ↓ down.

Solves are **extended LURD**: lowercase = move, UPPERCASE = push, UPPERCASE + `!` =
pounce-tear. `uU!dr` is *step up, tear upward, step down, step right*, and the token count
is the par.

## Legend

The letters below are for the diagrams in this file. The level files use the
XSB-compatible glyph set (`-` floor, `@` raccoon, `$` bag, `+` raccoon on the exit) — see
[`FORMATS.md`](./FORMATS.md). Same cells, two notations. Water diverges: these diagrams
overlay it on the occupant, and the files cannot, because water takes any occupant and one
character per cell cannot say which — there it is a separate `:water` block.

```
.  floor            R  raccoon (start)      B  garbage bag
#  wall             x  spilled trash (permanent obstacle)
E  the exit (walkable by the raccoon, never occupiable by anything else;
   counts only when every bag is torn)
C  full can (has a bag)                     c  empty can (pushable)
W  wheelie bin (has a bag)                  w  wheelie bin, emptied — still rolls
~  water (the raccoon won't cross it)       =  a filled-in canal cell (floor now)
b  recycle bin (drops a cell of trash)      j  water jug (spills a cell of water)
F  furniture — one letter per piece; a touching same-letter blob is ONE couch, so two
   couches shoved flush together are written F and G (the level files use F G H K M N)
```

---

## L0 — "Out"
Introduces: move, the exit. No bag, so the exit is live from move one.
```
   x=1 2 3
y1  #  E  #
y2  #  .  #
y3  #  R  #
```
**Solve — `uu`** (par 2): Up, Up → standing on E with zero bags left → win.

---

## L1 — "Pounce"
Introduces: the directional pounce, the fan, permanent mess.
```
   x=1 2 3
y1  .  .  .
y2  .  B  .
y3  .  .  E
       R      (start cell at (2,4), floor, walls either side)
```
**Solve — `uU!dr`** (par 4): Up → (2,3). Up → strikes B(2,2) going **up**; fan fills all
of y1 plus the side cells (1,2)/(3,2); all clear → bag opens, R ends on (2,2). Down →
(2,3). Right → (3,3) = E, no bags left → win.

**Refusal:** the bag can also be approached from above — loop up the left side to (2,1)
and pounce Down. That fan would land on (1,3)/(2,3)/**(3,3)**, and (3,3) is the exit, so
the strike is refused and the move is not spent.

---

## L2 — "Heavy Can"
Introduces: the full can — push slides it one and ejects its bag one further.
```
   x=1 2 3
y1  .  .  .
y2  .  .  .
y3  E  .  .
y4  .  C  .
y5  .  R  .
```
Pushing the can Up moves it (2,4)→(2,3), ejects the bag to (2,2), leaves the can empty at
(2,3) and R at (2,4). The empty can now sits directly below the bag, so it blocks every
strike — it is in the fan for down/left/right and is the launch cell for up. With the bag
above it and the raccoon below, it can only move left or right.

**Solve — `UluRU!dl`** (par 7): Up (push the can) → (2,4). Left → (1,4). Up → (1,3),
standing on the exit with a bag still out, so nothing happens. Right → pushes the empty
can (2,3)→(3,3), R→(2,3). Up → strike bag (2,2) upward; fan (sides of y2 + all of y1) is
clear → opens. Down → (2,3). Left → (1,3) = E → win.

**Refusals:** opening the bag before clearing the can is refused in every direction — the
can is either in the fan or on the launch cell. Shoving the can **left** from (3,3) is
also refused, because (1,3) is the exit; that removes the mirror solve.

---

## L3 — "Fire Away From the Path"
Two bags, one corridor.
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
sides of y2); step back **Down** to (2,3); push **Down** → strike B(2,4) down (fan fills
y5 + sides of y4), R ends on (2,4). Corridor y3 never touched → **Up** to (2,3), **Right**
to (3,3) = E → win. Striking B first works too, same par.

**Refusals:** striking either bag toward the corridor (A down, or B up) would put a
full 3-wide trash row across y3, which contains the exit at (3,3). Both are refused.

---

## L4 — "Right Beside the Door"
A bag parked next to the exit has exactly one legal direction — away.
```
   x=1 2 3 4
y1  .  .  .  .
y2  .  E  B  .    bag A, orthogonally adjacent to the way out
y3  .  R  .  .
y4  .  B  .  .    bag B
y5  .  .  .  .
```
**Solve — `D!uuR!l`** (par 5): Down → strike B(2,4) downward (fan fills y5 plus the side
cells (1,4)/(3,4)); R ends on (2,4). Up, Up → (2,2), which is the exit — one bag still
out, so nothing happens. Right → strike A(3,2) **rightward**: the fan is the x=4 column
plus (3,1)/(3,3), all clear. Left → back onto E → win.

**Refusals:** A is orthogonally adjacent to E, so three of its four directions put trash
on the exit — up and down land E in the side cells, left lands it in the leading row. The
room registers **13** exit refusals. The one remaining direction fires A away from the
door, and the only cell it can be thrown from is the exit itself.

---

## L5 — "Recycling Day"
Introduces: the **recycle bin** `b` — push it and it slides one cell and drops a single
cell of permanent trash directly ahead.
```
   x=1 2 3 4 5
y1  .  .  .  .  .
y2  .  .  B  .  .
y3  .  E  b  .  .
y4  .  .  R  .  .
y5  .  .  .  .  .
```
The bin is parked on (3,3) — the cell you have to stand on to strike the bag upward.

**Solve — `luRU!dl`** (par 6): Left, Up onto the exit at (2,3). Right → shove the bin to
(4,3); it drops trash at (5,3) as it goes, and R takes the launch cell. Up → strike the
bag, fan filling y1 plus (2,2)/(4,2). Down, Left → E → win.

**Refusals:** shoving the bin **up** is refused — the bag is in the way. Shoving it
**left** is refused — the exit at (2,3) will not take it. The room logs **8** exit
refusals.

---

## L6 — "Runaway Bin"
Introduces: the **wheelie bin** `W` — it rolls until something stops it and dumps its bag
out the back on impact. Emptied (`w`) it still rolls.
```
   x=1 2 3 4 5
y1  .  .  .  .  .
y2  .  .  W  .  .
y3  .  .  R  .  .
y4  .  .  .  .  .
y5  .  E  .  .  .
```
**Solve — `UluuRdR!lddd`** (par 11): Up → the bin rolls to (3,1), the top edge stops it,
and its bag drops into (3,2) — the cell it just vacated. The raccoon does not follow it;
the bin leaves from under the shove. Left, Up, Up to (2,1). Right → the emptied bin rolls
clear to (5,1). Down. Right → strike the freed bag rightward; its side cells are (3,1) and
(3,3), and (3,1) is only clear because you rolled the bin off it. Left, Down, Down, Down →
E → win.

Par 11 is the longest in the early pack because every container ends up adjacent to the
bag it produces, so the bag is never immediately strikeable — the bin that dropped it is
standing in its side cell. The wheelie bin makes you clear the same obstacle twice, once
loaded and once empty. **Zero traps.**

---

## L7–L13 — the ladder

These seven were found rather than composed: a seeded generator threw random layouts at
the rules engine across 24 parallel workers, 1,474 came back solvable inside the target
band, and these seven were selected on a rising par, the fewest optimal lines, and the
fewest ways to quietly lose. Par climbs by two a room, from 13 to 25, and each re-uses
pieces the pack has already taught. The generator itself is not in the repo — only the
bank of candidates it produced, in `levels/bank.jsonl`.

| Room | Par | Pieces | Optimal lines | Traps | States |
|---|---|---|---|---|---|
| **L7** — Three Bags Full | 13 | three bags | 1 | 13 | 297 |
| **L8** — Bin Night | 15 | a bag, a full can, a recycle bin | 1 | 7 | 3089 |
| **L9** — Tight Corner | 17 | two bags, a recycle bin | 2 | 3 | 258 |
| **L10** — Long Way Round | 19 | a bag, a wheelie bin | 1 | 16 | 1260 |
| **L11** — Crosstown | 21 | two bags, a wheelie bin | 1 | 34 | 2626 |
| **L12** — The Far Side | 23 | a bag, a wheelie bin | 3 | 12 | 1537 |
| **L13** — Closing Time | 25 | two bags, a wheelie bin | 2 | 43 | 2492 |

**Optimal lines** is how many distinct shortest solutions exist. **Traps** is how many
legal actions take a winnable board to an unwinnable one; the search turned up rooms with
over 1,600, so the selection capped it at 60.

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

A searched room is verified, not designed. Every claim above is machine-checked, but
nothing checks that a room is interesting. `tools/metrics.mjs` scores these seven on what
they cost the player: par climbs 13 → 25 while the number of board-changing decisions
stays flat at 3–5, L11 and L13 have zero coupling between their bags, and L11 lets you
keep playing for 34 moves after the room is unwinnable. The bank cannot supply
replacements — 0 of its 226 rooms pass the same filters. See `TODO.md`.

---

## L14 — "Wet Paws"
Introduces: **water** `~`. The raccoon will not cross it, but he will walk on what he
throws into it — trash landing in water fills the cell permanently, and a filled cell is
ordinary walkable ground.
```
   x=1 2 3 4
y1  .  .  .  .
y2  .  E  B  .    bag A, beside the exit
y3  .  .  .  .
y4  ~  ~  ~  ~    the canal
y5  .  R  B  .    bag B
y6  .  .  .  .
```
**Solve — `R!uuluR!l`** (par 7): Right → strike B(3,5) **rightward**. Its fan is the side
cells (3,4)/(3,6) plus the x=4 column at (4,4)/(4,5)/(4,6) — and (3,4) and (4,4) are
canal, so those two cells fill in and become floor. R ends on (3,5). Up onto the bridge at
(3,4), Up to (3,3), Left to (2,3), Up to (2,2), which is the exit, with a bag still out.
Right → strike A(3,2) rightward. Left → back onto E → win.

**Refusal:** the exit is straight up from the start, and the first move anyone tries walks
into the canal. It is refused at move zero, at no cost. **Zero traps.**

---

## L15 — "Two Crossings"
Three bags, two of them spent on the canal.
```
   x=1 2 3 4 5
y1  .  .  .  .  .
y2  .  B  E  .  .    bag A, beside the exit on the far bank
y3  ~  ~  ~  ~  ~    the canal
y4  .  B  R  B  .    bags B (left) and C (right)
y5  .  .  .  .  .
```
**Solve — `L!rR!uulL!r`** (par 8): Left → strike **B**(2,4) leftward; two of its five fan
cells land in the canal at (1,3)/(2,3) and the west crossing exists. Right → (3,4). Right
→ strike **C**(4,4) rightward, dropping two more cells into the canal at (4,3)/(5,3): the
east crossing. Up onto it, Up to (4,2), Left onto the exit at (3,2) with a bag still out.
Left → strike **A**(2,2) leftward, and its fan lands on the west crossing you built four
moves ago, burying it. Right → E → win.

This room was built to ask *which bag first* and no longer does. A filled canal cell is
ordinary floor, so a later fan can land on one and bury it — both reachable bags can go
first and both leave a winnable board (order metric 2/2). It keeps `coupling` 0.89,
`solves` 1, `walkRatio` 1.67, `pm` 10, `bridges` 4. Re-picking it is in `TODO.md`.

---

## L16 — "Wet the Landing"
Introduces: the **water jug** `j` — shove it and it slides one cell and spills a single
cell of water directly ahead, exactly where the recycle bin would have dropped trash.
```
   x=1 2 3 4 5
y1  .  .  .  .  .
y2  .  E  .  B  .    the exit and the bag, three cells apart along the top
y3  .  .  .  .  .
y4  .  .  j  .  .    the jug
y5  .  .  R  .  .
```
**Solve — `UruU!ll`** (par 6): Up → shove the jug from (3,4) to (3,3); it spills a cell of
water at (3,2) as it goes, and you take the cell it left. Right, Up to (4,3). Up → strike
the bag at (4,2) upward; its fan is the side cells (3,2)/(5,2) plus the y1 row — and
(3,2) is the water you just poured, so that fan cell lands as a bridge instead of a wall.
Left onto it, Left → E → win.

(3,2) sits between the bag and the door, and every way of opening that bag consumes it:
three of the four strike directions drop fan trash on it, and the fourth is struck from
it. Dry, it becomes a wall and the detour through y3 is **8 moves, measured**, against the
jug line's 6.

**Refusals and traps:** the exit refuses **8** actions. There are **6** ways to lose the
room, two of them about the jug. Shove it **right**, into (4,3), and it blocks the only
cell the bag can be struck from. Shove it **up twice** and the second shove walks it into
the puddle the first one made, where nothing can reach it — and it is standing in the
bag's side cell, so that bag is beyond opening too. The other four are firing the bag
before pouring, so its own trash walls you off from the door.

Of 303,600 four-piece layouts on a 5×5 open board, exactly one — up to its 8 rotations and
reflections — has a unique shortest solve that pours, bridges, walks it and still leaves
the exit forbidding something. On 6×4, 255,024 layouts produced none. Its 6 traps are high
for an introduction (L5 introduces the bin with 1, L14 introduces water with 0).

---

## L17 — "Both Ends"
Introduces: **furniture** `F` — the first piece that spans cells. A rigid polyomino that
shoves one cell as a unit, translate-only, and its whole leading edge must be clear.
```
   x=1 2 3 4 5
y1  .  E  .  .  .
y2  .  F  B  .  .    the couch lies north–south; the bag is beside its top end
y3  R  F  .  .  .
y4  .  .  .  .  .
```
**Solve — `uurDR!lu`** (par 7): Up, Up to (1,1). Right onto the exit at (2,1), with the
bag still out. Down → shove the couch from (2,2)/(2,3) to (2,3)/(2,4); it asks for **one**
new cell, (2,4), and you take (2,2). Right → strike the bag at (3,2) rightward, fan
filling the x=4 column plus (3,1)/(3,3). Left, Up → E → win.

**Refusal:** the first thing anyone tries from the start is Right — shove the couch out of
the way. The cell in front of the end he touched, (3,3), is empty. The shove is refused
anyway, because the couch's *other* end needs (3,2) and the bag is sitting in it.

Pushed the way it lies, north–south, the couch steps into ground it already occupies
except for one cell at the far end — one cell instead of two. Nothing in this game
rotates, so that asymmetry is fixed by the room. **Zero traps**, 16 exit refusals.
