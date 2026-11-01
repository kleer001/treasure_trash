# Undo rewind — plan

**This file is scaffolding. Delete it when the rewind is built or dropped.**

## The ask (owner)

Undo plays the undone move's animation backward, in place of the snap to the board before the
move. Each animation is recorded on twos as it plays, and the recording plays backward. Speed
floated by the owner: −2x.

## Behaviour

| Input | What the room does |
|---|---|
| U after a move is at rest | The recording of the move plays backward, last drawing to first. Then the board before the move is at rest. |
| U while the move still plays | The rewind starts from the last drawing recorded. |
| U during a rewind | The running rewind jumps to its end, and the next rewind starts. Held U steps back one move at a time. |
| An arrow during a rewind | The rewind jumps to its end, and the move starts. |
| U during the win wipe | The wipe stops, and the winning move rewinds. |
| R, the picker, `<` and `>` | No rewind. The room snaps, as now. |

**What plays backward:** everything the recording holds of the room canvas. That includes a clip
from an earlier move that was still playing during this move.

**What does not:** the HUD, the crow and the lost-board readout change at the key press, as they
do now. The rewind has no sound. Endless motion, such as the lit door's shimmer, holds still
during the rewind.

**Speed:** −2x on twos. The rewind shows every second recorded drawing, and holds each one for
two frames.

## Approach

1. **Keep a copy of the stage with each move.** Before a move starts, `main.js` keeps a copy of
   the live stage, beside the history entry that `play.js` keeps. After an undo, that copy is the
   stage, in place of `rest()`.
2. **Record on twos.** While anything with an end still moves, each new drawing of the room
   canvas is compared with the drawing before it. The recording keeps the rectangle that changed,
   its position, and the pixels that the rectangle held in the drawing before. That is a reverse
   step: painted back, it turns a drawing into the one before it.
3. **Stop on the motion, not on the screen.** A move's recording stops when the move, the pose,
   every running clip and the door roll are at rest, or when the next move starts. It does not
   wait for the screen to stop changing: the door shimmer never stops.
4. **Record a cut.** When an input lands a move early, the landed drawing goes on the recording as
   that move's last drawing. The rewind then jumps where the forward play jumped.
5. **Play the reverse steps last to first** onto the room canvas, at the rewind speed. Then draw
   the kept stage at rest.

Why the stage copy: the live stage keeps each sprite's draw seed for life, and a stage built again
from a board deals the seeds again, in board order. So `rest()` after an undo redraws every pile
spawned since the room loaded with a new look. The copy carries the seeds, so the screen after
the rewind is the screen before the move.

Why only the changed rectangle: a whole drawing is large, and a long room keeps many. PNG keeps it
small, but the encoder is slower than the time between two drawings. The changed rectangle is
small, and it costs a canvas read and a compare per drawing.

Alternatives not taken:

- **Play the move again off screen at the key press.** It needs no memory for drawings. But it
  must run the animation state of `main.js` a second time on a held clock, it stalls the key
  press, and it misses an earlier clip that still played during the move.
- **Make the move animation a function of time, and run time backward.** It is the cleanest
  design, and the largest change. Nothing else needs it.

## Evidence

Measured headless in Firefox on a 26 × 19 room of 30 bags: every bag torn, 252 moves recorded on
twos, then 252 undos.

| How a drawing is kept | One drawing | The whole run |
|---|---|---|
| Raw RGBA | 1.1 MB | 2,011 MB |
| PNG | about 51 KB, 95 ms to encode | 93.5 MB |
| Changed rectangle | 2.5 KB for a walk, 7.7 KB for a tear; 2 ms to read, compare and crop | 5.6 MB |

After 250 of the 252 undos, the screen differed from the screen before the move. In each one, the
torn piles had new looks.

## Order of work

1. The stage copy. It stops the pile repaint on undo by itself.
2. The recorder.
3. The rewind player.

## Done when

- A test shows that the last rewind drawing equals the screen before the move: for a walk, a
  push, a tear, each kind of clip, and a cut move.
- On a long room with many tears, the whole recording stays in megabytes.
- `__tt.walk` with U in the keys gives a stage census that matches the board after each undo.
- `__tt.hold()` and `__tt.step(n)` step a rewind drawing by drawing.
- It is played in the browser: each clip undone, and held U across a long run of moves.

## Owner decisions

1. Build it, with the approach above.
2. Speed: 2x or more, to be tuned. It is `REWIND_SPEED` in `src/main.js`.
3. Restart snaps.
