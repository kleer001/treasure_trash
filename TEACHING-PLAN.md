# Teaching plan — temporary

**This file is scaffolding and it gets deleted when the last room lands.** It names rules,
because a build plan has to; `src/rules.js` outranks it the moment a room is written.

Every room in the game is rebuilt from here. The order is a dependency order, not a schedule.

## This is a puzzle game

It is meant to be a pleasure to beat, which means it is meant to be capable of beating the
player first. Undo is free and unbounded, so nothing here is protecting anyone from a wrong
move: a trap walked into and thought back out of is the product. The rule below bounds what a
teaching room is hard ABOUT. It does not make one easy.

## The one design rule

**Every room is a lesson, and nothing in it is harder than its lesson.**

A room may be as hard as its piece is; what it may not be is hard about anything else. With a
second unknown on the board, a failure to understand and a failure to solve look identical, and
the lesson is the casualty.

So: **one new idea per room, and nothing else on the board that has to be worked out.**

## What a teaching room looks like

- **Short par.** Long enough to do the thing and reach the exit. Walking is not content.
- **One new piece, lane or rule.** Everything else present has already had its own room.
- **The exit stays shut until the lesson is done.** Each room declares a `:gate` naming what
  covers its lesson; `verify.mjs` takes that away and proves nothing is left to solve. Three
  covers, because three kinds of thing get taught: `erase` a piece, `wall` a lane, or name the
  action `kind` no solution can avoid. `none` is a claim too, not an omission — the rooms that
  open the game gate on themselves, and a losing room cannot hold its exit shut until the
  player has lost.
- **One shape at a time.** A piece with an axis or a facing gets its directions in consecutive
  rooms, not folded into one.

Each room carries a `:teach` line, and the line is the test: if the sentence needs a clause
about anything but the new thing, the room is doing too much.

## The losing rooms

A few rules can only be understood by watching them cost something: tar keeps what enters it, a
bag on broken glass tears, a barrow that scoops cannot un-scoop, a loaded skateboard end-on in a
corridor cannot be emptied. These get rooms of their own, AFTER the piece is known. A room cannot
hold its exit shut until the player has lost, so the gate rule does not reach them.

---

## Chapter 1 — the verbs

These teach what a shove is and what the room wants. The can turns up here because a push
needs something to shove; what a can IS belongs to chapter 2.

1. Walk to the exit.
2. The exit waits on the bags.
3. Push: one thing, one cell.
4. A shove needs somewhere for the thing to go.
5. A bag tears, and the trash is the fan.
6. Undo and restart exist.

## Chapter 2 — the containers

7. The full can, and the bag it puts down.
8. The empty can: the same thing, done.
9. The recycle bin, and the trash it sheds.
10. A container needs room for what it puts down.

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
20. The one-way `^`: through it, and no way back.
21. The one-way `v`.
22. The one-way `<`.
23. The one-way `>`.
24. Cardboard covers a hazard and is spent doing it.
25. The sponge dries the cell it lands on, and is not spent.
26. The sponge will not skate on grease.
27. The jug pours once, and the water washes the cell.

## Chapter 4 — the rollers

28. The wheelie bin rolls until something stops it.
29. The tyre has an axis: along it rolls, across it shifts.
30. The other tyre, turned.
31. Transfer on impact: a roller strikes a roller and hands its motion on.
32. Two rollers already touching are one thing to shove.
33. A slider is not a roller, and passes nothing on.
34. A cascade ends.
35. The office chair, and the trash that knocks it exactly one cell.

## Chapter 5 — the bodies

36. The couch: two cells, one thing, one cell a shove.
37. The bicycle rolls along its own length.
38. The rug is a cylinder: shoved end-on it slides.
39. The rug rolls when shoved against its SIDE.
40. A rolling rug hands off to a bicycle lying across it.
41. A body a grate takes whole, and a body that spans it.

## Chapter 6 — the tools

42. The pane shatters into the cell beyond and leaves glass.
43. A pane with nowhere to break rides intact.
44. The broom moves a whole line, of any kinds, one cell.
45. The broom on grease takes its line the length of the slick.
46. Only the head of a swept line can shed.

## Chapter 7 — the machines

47. The closed cabinet: one cell, shoved like anything else.
48. Struck on the back, the drawer shoots out the front.
49. Shoved on the drawer, the shove is spent closing it.
50. An object pushed into an open drawer closes it.
51. The cabinet facing up.
52. The cabinet facing down.
53. The cabinet facing left.
54. The cabinet facing right.
55. The magnet: the nearest metal on its line closes to adjacent.
56. Reach is three cells, and four is out of reach.
57. A wall blocks the line; an object does not.
58. The chain follows, and breaks when it leaves the line.
59. Pushing the metal drags the magnet.
60. A magnet capturing a magnet.

## Chapter 8 — the wheels

61. The skateboard: an open deck, it takes what it rolls over.
62. What it takes in pushes the old load out the back.
63. Weight: a skateboard carrying anything moves one cell instead of rolling.
64. A wheelie bin is light full or empty — its trash is not cargo.
65. Grease beats weight.
66. A loaded skateboard with nowhere to go sheds out the back.
67. It never sheds into the cell the raccoon is standing in. **(losing room)**
68. The barrow faces the way its tub points.
69. Shoved that way, it takes what it is ALREADY touching.
70. Shoved back along the same line it rolls, and takes nothing.
71. Shoved across the line it tips, and the load lands one cell on.
72. A barrow carries a loaded barrow.
73. Depth costs an empty barrow, and the stack is built from the inside out.
74. A barrow tows a piece too big to scoop.
75. Pushing the towed piece brings the barrow along.

## Chapter 9 — where the momentum goes

Everything here needs two pieces the player already knows.

76. A knock moves a wheeled thing, the way it moves any other roller.
77. A heavy one does not move — it takes the blow and rattles.
78. Pinned, with nowhere to move, it takes the thing that hit it INSIDE instead.
79. A barrow catches only through its mouth; its back is a wall.
80. A run of touching things is one thing to push, and the heaviest sets the pace.
81. A skateboard set rolling by a knock takes nothing aboard.

---

## Where the rooms come from

Drafted by hand and then proved, not searched for. `tools/pick.mjs` and the fertility work stay
where they are: they are for rooms that have to be *interesting*, which is a later act's problem.

- Declare the `:teach` line first and the board second.
- `node tools/verify.mjs` proves the par is minimal and the solve replays.
- Play it.

## What is deliberately not here

- **No difficulty ramp.** Where one belongs is a separate question, asked once every piece has
  been met.
- **No act boundaries.** How this is cut into acts is a presentation decision, and cutting it
  wrongly early would push rooms together for the wrong reason.
