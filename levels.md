# LEVELS — Treasure Trash (raccoon-only, working scratch)

> Speculative / working. Cell-exact where marked **[verified]**; **[sketch]** rooms
> are concept-only, not yet checked solvable. Crow is **pinned** — every room here
> must be beatable by the raccoon alone. Goal of a room: **open all bags, then get
> out.** Coordinates: **(x,y), top-left = (1,1)**, x → right, y ↓ down.

> **The data is canonical, this doc is commentary.** Every room below lives as a level
> file in [`spike/levels/act1.tt`](./spike/levels/act1.tt), and every par and solve here
> is checked against the rules engine by `spike/verify.mjs` — including a check that the
> solve strings quoted below appear verbatim, so the prose can't drift from the game.
> Formats and API: [`spike/FORMATS.md`](./spike/FORMATS.md).
>
> Solutions are written in **extended LURD**: lowercase = move, UPPERCASE = push,
> UPPERCASE + `!` = pounce-tear. `uU!dr` is *step up, tear upward, step down, step right*,
> and the token count **is** the par.

## Legend
```
.  floor            R  raccoon (start)      B  garbage bag
#  wall             _  entry stub (raccoon start / parking — NOT a disposal chute)
E  the exit (the way out — always walkable; counts only when every bag is torn)
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
7. **The exit `E`** — one per room. It is **plain floor you can always walk over**;
   it just *counts* when you're standing on it and every bag is torn. It is **not**
   protected: trash, a can, or any other occupant can land on it and **seals it
   permanently** → soft-lock (undo).
8. **Free undo / restart.** Deterministic. **Win = every bag torn *and* the raccoon
   standing on the exit.**

**Core proposition:** *choose each strike's direction and order so your persistent
trash never blocks your path, your way out, or another bag's fan.*

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

**The exit (fork resolved — was smuggled in unannounced).** The exit first appeared
in a sketch for L4 ("leaves you *and the exit* un-trapped") without ever being
defined. It's now a first-class element, retrofitted through every room, and the
rules above are the whole of it. Three calls, made explicitly:

- **It's terrain, not an object.** Always walkable, never pushable, no state of its
  own. This keeps the clearance rule (rule 3) unchanged — the exit tile reads as
  clear floor, so a fan can land on it, which is the point.
- **It's buriable, and burying it is a soft-lock.** Trash on the exit is permanent
  like all trash; a can pushed onto it can never be pulled back off. Both are
  visible before you commit (the fan preview tints the cells; a can moves one cell
  at a time), so this stays a *foreseeable* dead-end, not a hindsight trap.
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

**The authoring law that comes with it** (against the Critic's obvious objection —
that an exit degrades into a walk-back tax): **if the exit's position doesn't rule
out at least one strike direction or push direction, it's a tax — move it.** Ten
extra steps of unopposed walking is not a puzzle. L1's exit forbids the down-strike;
L2's forbids pushing the can left; L3's is inside the corridor the room already
taught you to protect. Every room must pay that toll.

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

**Object budget (aim ~8):** `bag`, `can` (full/empty), `spilled trash` = **3 used.**
Reserved: water/gap, and the crow's pieces (pinned).

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
       R      (entry stub at (2,4), walls either side)
```
**Solve — `uU!dr`** (par 4): Up → (2,3). Up → strikes B(2,2) going **up**; fan fills
all of y1 plus the side cells (1,2)/(3,2); all clear → bag opens, R ends on (2,2).
Down → (2,3). Right → (3,3) = E, no bags left → win.
**The trap (optional, and this is the point of adding the exit):** the bag can also
be struck **downward** — loop up the left side to (2,1) and pounce Down. The fan is
clear, so it *opens*, and the trash lands on (1,3)/(2,3)/**(3,3)** — the exit is
buried, the bag is gone, and the room is unwinnable with nothing left to do. Same
board, same bag, two legal strikes, one of them fatal. Before the exit existed, both
strikes won. *Lesson: the fan preview isn't just about your path, it's about your
way out.*

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
**Trap 1 (old):** try to open the bag before clearing the can — every direction
soft-locks (can in the fan or on the launch cell).
**Trap 2 (new, and it kills the mirror solve):** shove the can **left** instead — up
the right side to (3,3), push Left, and the can parks on (1,3) = **E**. No pull, and
one more push would take it off-grid, so the exit is sealed for good. The bag still
opens; the room is still lost. The old room accepted either mirror; the exit makes
exactly one of them right. *Lesson: relocating your junk is half the job — where you
put it is the other half.*

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
**The trap:** strike *either* bag toward the corridor (A down, or B up) → a full
3-wide trash row lands on y3 → corridor sealed, the other bag unreachable, **and the
exit buried under the same row.** Lesson: **fire your mess away from where you still
need to walk.**
**What the exit adds here:** after both correct strikes the corridor is the *only*
clear row left on the board — the room already made you protect it, and now it's
also the thing you're protecting it *for*. The exit didn't change the solution; it
gave the existing lesson a reason.

---

## Proposed next rooms **[sketch — not verified]**
- **L4 — "Corner Yourself":** one bag, but only one of four strike directions leaves
  you **and** the exit un-trapped by the fan. The two failure modes are now distinct
  and both live: the fan can *bury* the exit (L1's trap) or it can *fence you off*
  from an exit that's still perfectly clear (new — you're alive, the exit is intact,
  and there's no path). Teaches reading the fan before you commit.
- **L5 — "Interference":** two bags whose fans *compete* for the same cells — order
  and direction must be chosen so neither fan is pre-blocked by the other's trash,
  and so the last strike doesn't strand you from E.
- **L2-redux — the can, rebuilt** per the rework note above.
- **Candidate (exit-specific):** a room where the only safe strike **fires toward
  the exit tile itself but stops one cell short** — the fan's leading row lands on
  the row before E. Teaches that the exit is not magically protected; you just have
  to count.

**Act 1 spine:** L0 → L1 → L3 → L4 → L5 (all on direction + mess + egress), fold the
reworked can in when it's solid. Still no crow needed — the honest test of the
raccoon-alone game.

## Authoring checklist (every new room)
**Items 1, 3, 4 and 5 are now enforced by `spike/verify.mjs` — a room that violates
them fails the build rather than reaching a player.**

1. Exactly **one** `E`, and nothing starts on it (no bag, no can, no raccoon). *(checked)*
2. The raccoon start and the exit are **different cells** — otherwise L0's lesson
   ("walk to the way out") reads as "do nothing." *(checked)*
3. The room is solvable *and* E is still reachable after the last strike — a room
   that opens every bag but strands you is a bug, not a difficulty setting (Law 1.8).
   *(checked: solvability + provably minimal par)*
4. The exit's placement rules out at least one strike or push direction. If it
   doesn't, it's a walk-back tax — move it. *(checked: ≥1 exit-burying trap in any
   room that has a bag)*
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
| **Garbage bag** | step into it in dir D → tears open, sprays a **2×3 fan of permanent trash** (2 side cells + the 3 cells one row ahead in D); raccoon ends on the bag's cell | opens only if the whole fan is clear floor, else soft-lock; can't be pushed — only *launched* via a stack; needs interior room |
| **Metal can** (full) | push → **slides 1**, ejects its bag **1 further ahead**, becomes an empty can; raccoon advances into its old cell | both the can's destination *and* the bag's landing cell must be clear |
| **Empty can / plain block** | push → slides 1 (plain Sokoban block) | destination clear; **never removable**; may start on the board as a plain block |
| **Exit** | — (terrain, not an occupant) | walkable at all times; **wins the room** only while standing on it with zero bags left; **not protected** — trash or a pushed can lands on it and seals it permanently; exactly one per room |
| **Spilled trash** | — (inert) | **permanent** obstacle; never moves, never clears |
| **Bag-on-can stack** | push → top bag **launches 2** ahead (loose), can **slides 1** (still full); raccoon advances 1 | landing cells clear; launched bag must still be struck; only way to **reposition** a bag |
| **Recycle bin** | push → slides 1, **drops 1 cell of trash** directly ahead | destination clear (precise obstacle placer) |
| **Furniture** (couch/mattress) | rigid **polyomino** (L / Z / T / straight); push → shoves as a unit 1 cell | only if **all** leading cells clear; **translate-only** (no rotation); multi-cell footprint |
| **Wheelie bin** | holds a bag; push → **rolls until it hits a wall**, then dumps its bag **1 cell in reverse** (out the back); empty bin still rolls | won't stop unless stopped; reverse cell must be clear (else no-op) |
| **Shopping cart** | a **2-cell wheelie bin** (rolls + holds a bag + reverse-dump on impact) | as wheelie bin, ×2 footprint |

**Global rules:** step 1 cell/move · no pull · actions resolve on push/strike · all mess
**permanent** · free undo/restart · deterministic, **no RNG, no collecting** · win = every
bag open **and** the raccoon on the exit.

**Cut:** shiny/treasure & any collecting · aerosol · leaky sack/bag · cardboard box (= empty can)
· dumpster · gum/tar · oil slick · glass bottle.

**Verified in `spike/`:** bag + metal can + exit (L0–L3), pars 2/4/7/5, and three
soft-locks — L1's exit-burying down-strike, L2's can-on-exit push, L3's sealed
corridor. **Needs a spike:** wheelie-bin roll (fun / redundancy vs plain can),
furniture polyomino pushes, bag-on-can launch.
