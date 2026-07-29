# LEVELS — Treasure Trash (raccoon-only, working scratch)

> Speculative / working. Cell-exact where marked **[verified]**; **[sketch]** rooms
> are concept-only, not yet checked solvable. Crow is **pinned** — every room here
> must be beatable by the raccoon alone. Goal of a room: **open all bags.**
> Coordinates: **(x,y), top-left = (1,1)**, x → right, y ↓ down.

## Legend
```
.  floor            R  raccoon (start)      B  garbage bag
#  wall             _  entry stub (raccoon start / parking — NOT a disposal chute)
x  spilled trash (permanent obstacle)
C  full can (has a bag)                     c  empty can (pushable)
```

## Rules / vocabulary (⚠ = confirm)
1. **Move** — raccoon steps one cell orthogonally per input. No pull (Sokoban law).
2. **Pounce-tear (directional!)** — stepping *into* a bag in direction **D** tears it.
   It sprays a **2×3 fan forward**: the bag's two **side** cells (perpendicular to D)
   **plus the three cells one step ahead in D**. Nothing sprays *backward*. The
   raccoon ends on the bag's cell (which stays clear — only the fan cells get trash).
   ```
   strike ↑ onto B:     before        after
                        . . .         x x x
                        . B .    →     x R x
                        . R .         . . .   (came-from cell stays clear)
   ```
3. **Clearance** — a bag opens only if its **2×3 fan is all clear floor** at strike
   time. Fan blocked (wall / off-grid / trash / can) → **soft-lock** (undo).
4. **Mess stays** — the 5 fan cells become **permanent trash obstacles**. Opening a
   bag reshapes the board; your own garbage can wall you in. *(Fork resolved: yes.)*
5. **Full can, when pushed** — slides **one cell** in the push direction **and ejects
   its bag one further cell ahead**; the can is now **empty**. (Raccoon ends in the
   can's old cell, Sokoban-style.)
6. **Empty can** — a normal pushable Sokoban block.
7. **Free undo / restart.** Deterministic. Win = all bags opened.

**Core proposition:** *choose each strike's direction and order so your persistent
trash never blocks your path or another bag's fan.*

**Design identity — "maximum mess, nothing gets cleaned up."** The raccoon only ever
*adds* or *relocates* mess, never removes it. **No disposal/removal objects** (this is
why the dumpster is cut, and why the entry stub is a start/parking cell, not a chute).
Spilled trash, empty cans, every obstacle — all permanent. Boards only get messier; you
win by routing *through* the accumulation, never by tidying it.

**The side-cell corollary (load-bearing):** because the fan includes the bag's two
*perpendicular side cells* and striking means standing *opposite* the fan, an object
directly beside a bag falls in either the fan or the launch cell for **every** strike
direction — it can't be dodged, it must be relocated. Corollary: a bag flush against a
wall can't be opened at all; bags need interior room.

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

**Object budget (aim ~8):** `bag`, `can` (full/empty), `spilled trash` = **3 used.**
Reserved: water/gap, and the crow's pieces (pinned).

---

## L1 — "Pounce" **[verified]**
*New idea:* move · directional pounce · fan · (win by opening).
```
   x=1 2 3
y1  .  .  .
y2  .  B  .
y3  .  .  .
       R      (entry stub under x=2)
```
**Solve (2 moves):** Up, Up → R strikes B(2,2) going up; fan fills y1 + sides of y2;
all clear → win. (Doesn't yet exercise direction/mess; pure teach.)

---

## L2 — "Heavy Can" **[verified]**
*New idea:* the can — push-to-dump (rule 5) — and the side-cell corollary in action
(an adjacent can must be relocated).
```
   x=1 2 3
y1  .  .  .
y2  .  .  .
y3  .  .  .
y4  .  C  .
y5  .  R  .
```
**Push Up:** can (2,4)→(2,3), **bag ejects to (2,2)**, can now empty at (2,3),
R→(2,4). The empty can now sits directly below the bag — so it blocks **every** strike
(it's in the fan for down/left/right, and it's the launch cell for up). It must move.
**Solve:** loop up the side — (2,4)→(3,4)→(3,3) — and push the can **left**:
c (2,3)→(1,3), R→(2,3). Now R is below the bag with a clear up-fan → push **Up** →
strike bag (2,2) → opens → win. *(Mirror image works: come up the left side, shove the
can right.)*
**The trap:** try to open the bag before clearing the can — every direction soft-locks
(can in the fan or on the launch cell). That's the lesson.

---

## L3 — "Fire Away From the Path" **[verified — your room]**
*New idea:* direction + mess-stays as a real puzzle. Two bags, one corridor.
```
   x=1 2 3
y1  .  .  .
y2  .  B  .      bag A
y3  .  .  .      corridor
y4  .  B  .      bag B
y5  .  .  .
```
Raccoon starts on the corridor at (2,3).
**Solve:** at (2,3) push **Up** → strike A(2,2) up (fan fills y1 + sides of y2);
step back **Down** to (2,3); push **Down** → strike B(2,4) down (fan fills y5 + sides
of y4). Corridor (y3) never touched → win.
**The trap:** strike *either* bag toward the corridor (A down, or B up) → a full
3-wide trash row lands on y3 → corridor sealed → the other bag is unreachable →
soft-lock. Lesson: **fire your mess away from where you still need to walk.**

---

## Proposed next rooms **[sketch — not verified]**
- **L4 — "Corner Yourself":** one bag, but only one of four strike directions leaves
  you (and the exit) un-trapped by the fan. Teaches reading the fan before you commit.
- **L5 — "Interference":** two bags whose fans *compete* for the same cells — order
  and direction must be chosen so neither fan is pre-blocked by the other's trash.
- **L2-redux — the can, rebuilt** per the rework note above.

**Act 1 spine:** L1 → L3 → L4 → L5 (all on direction + mess), fold the reworked can in
when it's solid. Still no crow needed — the honest test of the raccoon-alone game.

---

## Item set (raccoon-only — going forward)
Pillar: **maximum mess, nothing gets cleaned up** — only *add* / *relocate*, never remove.
**No shiny, no collecting, no RNG.** Win = **every bag torn open** (a transformation goal).

| Object | On push / strike | Constraints |
|---|---|---|
| **Garbage bag** | step into it in dir D → tears open, sprays a **2×3 fan of permanent trash** (2 side cells + the 3 cells one row ahead in D); raccoon ends on the bag's cell | opens only if the whole fan is clear floor, else soft-lock; can't be pushed — only *launched* via a stack; needs interior room |
| **Metal can** (full) | push → **slides 1**, ejects its bag **1 further ahead**, becomes an empty can; raccoon advances into its old cell | both the can's destination *and* the bag's landing cell must be clear |
| **Empty can / plain block** | push → slides 1 (plain Sokoban block) | destination clear; **never removable**; may start on the board as a plain block |
| **Spilled trash** | — (inert) | **permanent** obstacle; never moves, never clears |
| **Bag-on-can stack** | push → top bag **launches 2** ahead (loose), can **slides 1** (still full); raccoon advances 1 | landing cells clear; launched bag must still be struck; only way to **reposition** a bag |
| **Recycle bin** | push → slides 1, **drops 1 cell of trash** directly ahead | destination clear (precise obstacle placer) |
| **Furniture** (couch/mattress) | rigid **polyomino** (L / Z / T / straight); push → shoves as a unit 1 cell | only if **all** leading cells clear; **translate-only** (no rotation); multi-cell footprint |
| **Wheelie bin** | holds a bag; push → **rolls until it hits a wall**, then dumps its bag **1 cell in reverse** (out the back); empty bin still rolls | won't stop unless stopped; reverse cell must be clear (else no-op) |
| **Shopping cart** | a **2-cell wheelie bin** (rolls + holds a bag + reverse-dump on impact) | as wheelie bin, ×2 footprint |

**Global rules:** step 1 cell/move · no pull · actions resolve on push/strike · all mess
**permanent** · free undo/restart · deterministic, **no RNG, no collecting** · win = every bag open.

**Cut:** shiny/treasure & any collecting · aerosol · leaky sack/bag · cardboard box (= empty can)
· dumpster · gum/tar · oil slick · glass bottle.

**Verified in `spike/`:** bag + metal can (L1–L3). **Needs a spike:** wheelie-bin roll (fun /
redundancy vs plain can), furniture polyomino pushes, bag-on-can launch.
