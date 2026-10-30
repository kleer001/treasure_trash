# Teaching plan — temporary

**This file is scaffolding and it gets deleted when the last room lands.** `src/rules.js` outranks
it the moment a room is written.

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
- **The exit stays shut until the lesson is done.** Each room declares a `:gate` naming what covers
  its lesson; `verify.mjs` takes that away and proves nothing is left to solve. Covers can `erase` a
  piece, `wall` a lane the route has to cross, `dry` a lane whose behaviour is what matters, or name
  the action `kind` no solution can avoid. `none` is a claim too, not an omission — the rooms that
  open the game gate on themselves, and a losing room cannot hold its exit shut until the player has
  lost.
- **One shape at a time.** A piece with an axis or a facing gets its directions in consecutive
  rooms, not folded into one.

Each room carries a `:teach` line, and the line is the test: if the sentence needs a clause
about anything but the new thing, the room is doing too much.

## The losing rooms

A few rules can only be understood by watching them cost something. These get rooms of their own,
AFTER the piece is known. A room cannot hold its exit shut until the player has lost, so the gate
rule does not reach them.

---

## What constrains a room

Found by building, and each one has cost a room already:

- Tear rooms are open ground, never corridors.
- **A room with no piece action spends its whole par walking**. A lesson with nothing to do in it
  has to be tiny.
- **A gate needs the lesson to be NECESSARY, not merely present.** A barrier fails that on its own —
  take it away and the room only gets easier — so it earns its room by being on the route (`wall`).

## Chapter 1 — the verbs

These teach what a shove is and what the room wants. The can turns up here; what a can IS belongs to
chapter 2.

1. Walk to the exit.
2. The exit and the bags.
3. Push.
4. The shove.
5. The bag and the trash.
6. Undo and restart exist.

## Chapter 2 — the containers

7. The full can.
8. The spent can.
9. The recycle bin.
10. A container.

## Chapter 3 — the floor

One lane per room, each against a piece already known. The tools come before the lanes.

11. The canal and the trash.
12. Grease and the slider.
13. The grate.
14. Cardboard and the hazard.
15. The sponge.
16. The sponge and the grease.
17. Tar. **(losing room)**
18. Broken glass. **(losing room)**
19. The jug.
20. The one-way `^`.
21. The one-way `v`.
22. The one-way `<`.
23. The one-way `>`.

## Chapter 4 — the rollers

24. The wheelie bin.
25. Two rollers already touching.
26. A roller strikes a roller.
27. A cascade.
28. A slider and a roller.
29. Grease and a roller.
30. The tyre.
31. The other tyre, turned.
32. The office chair and the trash.

## Chapter 5 — the bodies

33. The couch.
34. The bicycle.
35. The rug, shoved end-on.
36. The rug, shoved against its SIDE.
37. A rug shoved end-on, and a bicycle lying along its path.
38. A body and a grate.
39. A body that spans a grate.

## Chapter 6 — the tools

40. The pane.
41. A pane with nowhere to break.
42. The broom.
43. The broom on grease.
44. A swept line.
45. A bag swept onto glass. **(losing room)**

## Chapter 7 — the machines

46. The closed cabinet.
47. The drawer, struck on the back.
48. Shoved on the drawer.
49. An object pushed into an open drawer.
50. The cabinet facing up.
51. The cabinet facing down.
52. The cabinet facing left.
53. The cabinet facing right.
54. The magnet and the metal.
55. Reach.
56. A wall and an object.
57. The chain.
58. Pushing the metal.
59. A magnet capturing a magnet.

## Chapter 8 — the wheels

60. The skateboard.
61. What it takes in.
62. Weight and the skateboard.
63. The wheelie bin, full or empty.
64. Grease and weight.
65. A loaded skateboard with nowhere to go.
66. The raccoon in the shed cell. **(losing room)**
67. The barrow.
68. Shoved that way.
69. Shoved back along the same line.
70. Shoved across the line.
71. A barrow and a loaded barrow.
72. Depth and the stack.
73. A barrow and a piece too big to scoop.
74. Pushing the towed piece.

## Chapter 9 — where the momentum goes

Everything here needs two pieces the player already knows.

75. A knock on a wheeled thing.
76. A heavy one.
77. Pinned, with nowhere to move.
78. A barrow.
79. A run of touching things.
80. A skateboard set rolling by a knock.

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
