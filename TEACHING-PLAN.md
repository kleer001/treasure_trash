# Teaching plan — temporary

**This file is scaffolding and it gets deleted when the last room lands.** It names rules,
because a build plan has to; `src/rules.js` outranks it the moment a room is written.

Every room in the game is rebuilt from here. The order is a dependency order, not a schedule.

## The one design rule

**Difficulty does not climb. Every room is a lesson.**

The pieces are difficult and interesting on their own — a barrow that only takes what it is
already touching, a cart that goes heavy the moment you fill it, a rug that rolls the way you
do not push it. None of that needs a puzzle wrapped round it to be worth meeting. A room that
also asks the player to be clever is a room where a failure to understand and a failure to solve
look identical, and the lesson is the casualty.

So: **one new idea per room, and nothing else on the board that can be got wrong.**

## What a teaching room looks like

- **Short par.** Long enough to do the thing and reach the exit. Walking is not content.
- **One new piece, lane or rule.** Everything else present has already had its own room.
- **The lesson is unavoidable.** If the exit can be reached without meeting the thing, the room
  teaches nothing — `inertPieces` already refuses a piece that does not earn its cell, and that
  check is the floor here, not the goal.
- **The lesson is survivable.** A first meeting should not be losable. Where a piece can strand
  the room, its own room is not where that is taught — see *The losing rooms* below.
- **One shape at a time.** A piece with an axis or a facing gets its directions in consecutive
  rooms, not folded into one.

Each room carries a `:teach` line, and the line is the test: if the sentence needs a clause
about anything but the new thing, the room is doing too much.

## The losing rooms

A few rules can only be understood by watching them cost something: tar keeps what enters it,
a bag on broken glass tears, a barrow that scoops cannot un-scoop, a loaded cart end-on in a
corridor cannot be emptied. These get rooms of their own, AFTER the piece is known, and they are
built so the loss is **visible, immediate and one move from a restart** — never a soft lock the
player discovers twenty moves later. The solvability indicator already tells the truth; these
rooms are where it earns the player's trust.

---

## Chapter 1 — the verbs

Nothing here is a piece. These teach what a shove is and what the room wants.

1. Walk to the exit.
2. The exit waits on the bags.
3. Push: one thing, one cell.
4. A shove needs somewhere for the thing to go.
5. A bag tears, and the trash is the fan.
6. Undo and restart exist.

## Chapter 2 — the containers

The shape every container shares: it slides, it stops, it sheds, and what is left is a different
thing with a different glyph.

7. The full can, and the bag it puts down.
8. The empty can: the same thing, done.
9. The recycle bin, and the trash it sheds.
10. The bag-on-can stack, two sheds deep.
11. Only the leading thing in a line can shed.

## Chapter 3 — the floor

One lane per room, each against a piece already known.

12. The canal: what falls in, and what it becomes.
13. Trash fills a canal, and the crossing is permanent.
14. Grease: a slider runs to the end of the slick.
15. Grease changes nothing for a roller.
16. Tar keeps what enters it — and the raccoon walks it freely. **(losing room)**
17. Broken glass: he may not step on it; objects cross it.
18. A bag swept onto glass tears. **(losing room)**
19. The grate: what goes down it is gone.
20. The grate's fit rule: a longer thing spans the hole.
21. The one-way, each of its four facings, one room each.
22. Cardboard covers a hazard and is spent doing it.
23. The sponge dries the cell it lands on, and is not spent.
24. The sponge will not skate on grease.
25. The jug pours once, and the water washes the cell.

## Chapter 4 — the rollers

26. The wheelie bin rolls until something stops it.
27. The tyre has an axis: along it rolls, across it shifts.
28. The other tyre, turned.
29. Transfer on impact: a roller strikes a roller and hands its motion on.
30. Two rollers already touching are one thing to shove.
31. A slider is not a roller, and passes nothing on.
32. A cascade ends.
33. The office chair, and the trash that knocks it exactly one cell.

## Chapter 5 — the bodies

34. The couch: two cells, one thing, one cell a shove.
35. The bicycle rolls along its own length.
36. The rug is a cylinder: shoved end-on it slides.
37. The rug rolls when shoved against its SIDE.
38. A rolling rug hands off to a bicycle lying across it.
39. A body a grate takes whole, and a body that spans it.

## Chapter 6 — the tools

40. The pane shatters into the cell beyond and leaves glass.
41. A pane with nowhere to break rides intact.
42. The broom moves a whole line, of any kinds, one cell.
43. The broom on grease takes its line the length of the slick.
44. Only the head of a swept line can shed.

## Chapter 7 — the machines

45. The closed cabinet: one cell, shoved like anything else.
46. Struck on the back, the drawer shoots out the front.
47. Shoved on the drawer, the shove is spent closing it.
48. An object pushed into an open drawer closes it.
49. The cabinet at each of its four facings, one room each.
50. The magnet: the nearest metal on its line closes to adjacent.
51. Reach is three cells, and four is out of reach.
52. A wall blocks the line; an object does not.
53. The chain follows, and breaks when it leaves the line.
54. Pushing the metal drags the magnet.
55. A magnet capturing a magnet.

## Chapter 8 — the wheels

The largest chapter, and the one whose ideas most need separating.

56. The shopping cart: open-mouthed, it takes what it rolls over.
57. What it takes in pushes the old load out the back.
58. Weight: a cart carrying anything moves one cell instead of rolling.
59. A wheelie bin is light full or empty — its trash is not cargo.
60. Grease beats weight.
61. A loaded cart with nowhere to go sheds out the back.
62. It never sheds into the cell the raccoon is standing in. **(losing room)**
63. The barrow faces the way its tub points.
64. Shoved that way, it takes what it is ALREADY touching.
65. Shoved back along the same line it rolls, and takes nothing.
66. Shoved across the line it tips, and the load lands one cell on.
67. A barrow carries a loaded barrow.
68. Depth costs an empty barrow, and the stack is built from the inside out.
69. A barrow tows a piece too big to scoop.
70. Pushing the towed piece brings the barrow along.

## Chapter 9 — where the momentum goes

Everything here needs two pieces the player already knows. These are the rooms that make the
roster feel like one system rather than a list.

71. A knock moves a wheeled thing, the way it moves any other roller.
72. A heavy one does not move — it takes the blow and rattles.
73. Pinned, with nowhere to move, it takes the thing that hit it INSIDE instead.
74. A barrow catches only through its mouth; its back is a wall.
75. A run of touching things is one thing to push, and the heaviest sets the pace.
76. A cart set rolling by a knock keeps its mouth shut.

---

## Where the rooms come from

The pipeline finds rooms; it does not know what a lesson is. So these are **drafted by hand and
then proved**, rather than searched for:

- Write the board, declare the `:teach` line first and the board second.
- `node tools/verify.mjs` proves the par is minimal and the solve replays — a teaching room with
  a wrong par teaches the wrong thing.
- Play it. A room whose lesson does not survive being played is not a room.

`tools/pick.mjs` and the fertility work stay where they are: they are for rooms that have to be
*interesting*, which is a later act's problem. Nothing in this file is chosen by score.

## What is deliberately not here

- **No difficulty ramp.** Deciding where one belongs is a separate question, asked once every
  piece has been met and not before.
- **No act boundaries.** How this is cut into acts is a presentation decision, and cutting it
  wrongly early would push rooms together for the wrong reason.
- **The stack (`S`) is on probation.** It has a room here because it is in the roster; whether it
  survives the roster is an open question and this plan does not settle it.
