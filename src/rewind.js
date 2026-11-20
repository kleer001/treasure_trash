// The undo rewind, in the pixel art: each move's drawing is recorded, and an undo plays it backwards.
import { reverseStep } from './tape.js';

const REWIND_SPEED = 2;

/**
 * `ctx` is the board canvas's context. `clock()` is the animation clock and `since(t0)` its time
 * on twos. `kick()` asks for an animation frame. `pixel` false keeps the tapes but draws nothing.
 */
export function createRewind({ ctx, pixel, clock, since, kick }){
  const cv = ctx.canvas;
  // Each move keeps a tape: the stage from before it, and its drawings as reverse steps
  // (`src/tape.js`). The stage is kept because one built again from a board deals the draw seeds
  // again, and every pile spawned since the room loaded would come back with a new look.
  let tapes = [], rec = null, rewind = null;
  const putBack = s => ctx.putImageData(new ImageData(s.old, s.w, s.h), s.x, s.y);

  return {
    /** Starts the tape of a move. `kept` is the stage from before it. */
    start(kept){
      const tape = { stage: kept, t0: clock(), steps: [] };
      tapes.push(tape);
      if(pixel) rec = { tape, on: true, prev: ctx.getImageData(0, 0, cv.width, cv.height) };
    },
    get recording(){ return !!rec?.on; },
    /** Records the frame just drawn. `wiping`: the win's wall has started, and the tape ends. */
    record(wiping){
      if(wiping){ rec.on = false; return; }
      const next = ctx.getImageData(0, 0, cv.width, cv.height), step = reverseStep(rec.prev, next);
      if(step) rec.tape.steps.push({ t: clock() - rec.tape.t0, ...step });
      rec.prev = next;
    },
    /** The drawing has come to rest, so the tape is done. */
    still(){ if(rec?.on) rec.on = false; },
    pop: () => tapes.pop(),
    /** Plays `tape` backwards. */
    play(tape){
      // A wipe or the shimmer may have drawn over the screen since the tape stopped.
      if(rec?.tape === tape) ctx.putImageData(rec.prev, 0, 0);
      rec = null;
      rewind = { steps: tape.steps, i: tape.steps.length - 1, end: tape.steps.at(-1).t, t0: clock() };
      kick();
    },
    /** Returns false once the screen is back to the drawing before the move. */
    step(){
      const t = rewind.end - since(rewind.t0) * REWIND_SPEED;
      while(rewind.i >= 0 && rewind.steps[rewind.i].t > t) putBack(rewind.steps[rewind.i--]);
      if(rewind.i >= 0) return true;
      rewind = null;
      return false;
    },
    end(){
      if(!rewind) return;
      while(rewind.i >= 0) putBack(rewind.steps[rewind.i--]);
      rewind = null;
    },
    reset(){ tapes = []; rec = null; },
    get playing(){ return !!rewind; },
  };
}
