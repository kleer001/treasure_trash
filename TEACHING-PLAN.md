# Teaching plan — temporary

**This file is scaffolding and it gets deleted when the last room lands.** It names rules,
because a build plan has to; `src/rules.js` outranks it the moment a room is written.

Every room in the game is rebuilt from here. The order is a dependency order, not a schedule.

## The one design rule

**Difficulty does not climb. Every room is a lesson.**

The pieces are difficult and interesting on their own — a barrow that only takes what it is
already touching, a skateboard that goes heavy the moment you fill it, a rug that rolls the way you
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
a bag on broken glass tears, a barrow that scoops cannot un-scoop, a loaded skateboard end-on in a
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
10. Only the leading thing in a line can shed.

## Chapter 3 — the floor

One lane per room, each against a piece already known.

11. The canal: what falls in, and what it becomes.
12. Trash fills a canal, and the crossing is permanent.
13. Grease: a slider runs to the end of the slick.
14. Grease changes nothing for a roller.
15. Tar keeps what enters it — and the raccoon walks it freely. **(losing room)**
16. Broken glass: he may not step on it; objects cross it.
17. A bag swept onto glass tears. **(losing room)**
18. The grate: what goes down it is gone.
19. The grate's fit rule: a longer thing spans the hole.
20. The one-way, each of its four facings, one room each.
21. Cardboard covers a hazard and is spent doing it.
22. The sponge dries the cell it lands on, and is not spent.
23. The sponge will not skate on grease.
24. The jug pours once, and the water washes the cell.

## Chapter 4 — the rollers

25. The wheelie bin rolls until something stops it.
26. The tyre has an axis: along it rolls, across it shifts.
27. The other tyre, turned.
28. Transfer on impact: a roller strikes a roller and hands its motion on.
29. Two rollers already touching are one thing to shove.
30. A slider is not a roller, and passes nothing on.
31. A cascade ends.
32. The office chair, and the trash that knocks it exactly one cell.

## Chapter 5 — the bodies

33. The couch: two cells, one thing, one cell a shove.
34. The bicycle rolls along its own length.
35. The rug is a cylinder: shoved end-on it slides.
36. The rug rolls when shoved against its SIDE.
37. A rolling rug hands off to a bicycle lying across it.
38. A body a grate takes whole, and a body that spans it.

## Chapter 6 — the tools

39. The pane shatters into the cell beyond and leaves glass.
40. A pane with nowhere to break rides intact.
41. The broom moves a whole line, of any kinds, one cell.
42. The broom on grease takes its line the length of the slick.
43. Only the head of a swept line can shed.

## Chapter 7 — the machines

44. The closed cabinet: one cell, shoved like anything else.
45. Struck on the back, the drawer shoots out the front.
46. Shoved on the drawer, the shove is spent closing it.
47. An object pushed into an open drawer closes it.
48. The cabinet at each of its four facings, one room each.
49. The magnet: the nearest metal on its line closes to adjacent.
50. Reach is three cells, and four is out of reach.
51. A wall blocks the line; an object does not.
52. The chain follows, and breaks when it leaves the line.
53. Pushing the metal drags the magnet.
54. A magnet capturing a magnet.

## Chapter 8 — the wheels

The largest chapter, and the one whose ideas most need separating.

55. The skateboard: an open deck, it takes what it rolls over.
56. What it takes in pushes the old load out the back.
57. Weight: a skateboard carrying anything moves one cell instead of rolling.
58. A wheelie bin is light full or empty — its trash is not cargo.
59. Grease beats weight.
60. A loaded skateboard with nowhere to go sheds out the back.
61. It never sheds into the cell the raccoon is standing in. **(losing room)**
62. The barrow faces the way its tub points.
63. Shoved that way, it takes what it is ALREADY touching.
64. Shoved back along the same line it rolls, and takes nothing.
65. Shoved across the line it tips, and the load lands one cell on.
66. A barrow carries a loaded barrow.
67. Depth costs an empty barrow, and the stack is built from the inside out.
68. A barrow tows a piece too big to scoop.
69. Pushing the towed piece brings the barrow along.

## Chapter 9 — where the momentum goes

Everything here needs two pieces the player already knows. These are the rooms that make the
roster feel like one system rather than a list.

70. A knock moves a wheeled thing, the way it moves any other roller.
71. A heavy one does not move — it takes the blow and rattles.
72. Pinned, with nowhere to move, it takes the thing that hit it INSIDE instead.
73. A barrow catches only through its mouth; its back is a wall.
74. A run of touching things is one thing to push, and the heaviest sets the pace.
75. A skateboard set rolling by a knock takes nothing aboard.

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
