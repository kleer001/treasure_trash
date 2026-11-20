// An action played out on the stage: the refusal lunge, his press pose, the move, and the door roll.
import { NONE, BAG, CAN_FULL, CAN_EMPTY, DIRS, exitLit, fan, inGrid, cell, isMultiCell } from './rules.js';
import { press, moveStart, moveStop, travelAt } from './art/press.js';
import { FRAME_MS } from './art/timing.js';
import { RECOVERIES } from './art/cartoon.js';
import { tearPress } from './art/bagRip.js';
import { LOOK as DOOR } from './art/door.js';
import { advance, applyStep, easeOut, rollEase, settle, stageFrom, timeline, face, CELL_MS } from './stage.js';

// The state never changes in a refusal: the sequence plays out and rewinds itself, so the invalid
// overlap is a frame in an animation and never a board state.
const FX = {
  tear: { lunge:150, burst:190, hold:260, rewind:240 },
  push: { lunge:130, burst:0,   hold:170, rewind:140 },
  bump: { lunge:70,  burst:0,   hold:110, rewind:80  },
};

/**
 * `state()` is the board in hand. `clock()` is the animation clock and `since(t0)` its time on
 * twos. `kick()` asks for an animation frame. `onFlash()` hears a refusal reach its flash.
 */
export function createMotion({ clips, pixel, state, clock, since, kick, onFlash }){
  let fx = null, fxSeen = new Set();
  // Driven by what the rules REPORT moved, not by diffing two boards. A diff cannot tell a piece
  // that moved from one that appeared in its place. `stage` owns the objects and their fractional
  // positions, `timeline` cuts the traced action into segments, and this only keeps the clock.
  let stage = null, board = null, anim = null;
  // In the pixel art he is drawn press by press: the drawings of one action, played from the cell he
  // pressed from.
  let pose = null, refusals = 0;
  let door = null;
  let busy = false;
  const slow = matchMedia('(prefers-reduced-motion: reduce)');

  function startFx(dir, r){
    const s = state(), [dx,dy] = DIRS[dir];
    const tx = s.rac.x+dx, ty = s.rac.y+dy;
    const o = inGrid(s,tx,ty) ? cell(s,tx,ty).o : NONE;
    let kind = o===BAG ? 'tear' : (o===CAN_FULL||o===CAN_EMPTY||isMultiCell(o)) ? 'push' : 'bump';
    const key = `${kind}:${r.reason}`;
    if(fxSeen.has(key)) kind = 'bump';          // you've seen it; don't make you sit through it
    fxSeen.add(key);
    fx = { kind, dx, dy, bx:tx, by:ty, showBurst: kind==='tear',
           cells: kind==='tear' ? fan(tx,ty,dx,dy) : [], blame:r.blame, t0:clock(), beeped:false };
    kick();
  }
  function fxPhase(){
    const d = FX[fx.kind], e = since(fx.t0);
    const t1=d.lunge, t2=t1+d.burst, t3=t2+d.hold, t4=t3+d.rewind;
    if(e < t1)  return { lunge:e/t1, burst:0, flash:0 };
    if(e < t2)  return { lunge:1, burst:d.burst ? (e-t1)/d.burst : 1, flash:0 };
    if(e < t3)  return { lunge:1, burst:1, flash:1 };
    if(e < t4){ const k = 1-(e-t3)/d.rewind; return { lunge:k, burst:k, flash:0 }; }
    return null;                                 // done
  }

  function startPose(act, dir, from, stay){
    if(!pixel) return;
    const segs = act === 'tear' ? tearPress(dir)
      : press(act, dir, { lead: false, recovery: act === 'stuck' ? RECOVERIES[refusals++ % RECOVERIES.length] : undefined });
    pose = { act, segs, dir, x: from.x, y: from.y, stay, t0: clock() };
  }
  const poseAt = () => since(pose.t0) / FRAME_MS;

  const rolling = () => !!door && since(door.t0) < DOOR.roll * FRAME_MS;
  const doorLive = () => pixel && !!door && (door.lit || rolling());
  function doorRoll(){
    const k = Math.min(1, since(door.t0) / (DOOR.roll * FRAME_MS));
    return { open: door.lit ? k : 1 - k, frame: Math.floor(clock() / FRAME_MS) };
  }

  // The stage is NOT rebuilt per action. It stands on `prev`: `rest()` builds it when the room
  // loads, and each action takes it forward. A rebuild would re-seed every sprite, so a pile of
  // trash would change its look when the board around it shifts.
  function startMv(prev, r){
    board = prev;
    const segs = timeline(r, CELL_MS), wind = pose ? moveStart(pose.segs) * FRAME_MS : 0;
    anim = { segs, si: 0, k: -1, t0: clock() + wind,
             drawn: !!pose && segs[0].items.length === 1 && !segs[0].roll };
    kick();
  }
  function applyItem(it, frames){
    applyStep(stage, it.step, it.racTo, it.board);
    clips.note(it.step, it.next, frames);
  }
  /** Returns false once the whole action has played out. */
  function stepMv(){
    const seg = anim.segs[anim.si], e = since(anim.t0);
    if(e < 0) return true;
    const t = Math.min(1, e / seg.dur);
    const d = (drawnBeat(seg) ? travelAt(pose.segs, poseAt())
      : seg.roll ? rollEase(t, seg.cells) : easeOut(t)) * seg.items.length;
    const k = Math.min(seg.items.length - 1, Math.floor(d));
    while(anim.k < k){
      if(anim.k >= 0) settle(stage);
      anim.k++;
      const it = seg.items[anim.k];
      board = it.board;
      applyItem(it, moveFrames(seg));
    }
    advance(stage, slow.matches ? 0 : d - k, seg.pace);
    if(t < 1) return true;
    settle(stage);
    if(++anim.si >= anim.segs.length){ board = state(); return false; }
    board = seg.items.at(-1).next;
    anim.k = -1; anim.t0 = clock();
    return true;
  }
  const drawnBeat = seg => anim.drawn && seg === anim.segs[0];
  /** How many screen frames a beat of `seg` moves things for. */
  function moveFrames(seg){
    if(drawnBeat(seg)) return moveStop(pose.segs) - moveStart(pose.segs);
    return Math.round(seg.dur / seg.items.length / FRAME_MS);
  }
  function landMv(){
    // The step in flight must land first: `applyStep` finds a sprite by its ANCHOR, so a step left
    // part-way through a beat makes every later step fail to find what it names.
    if(anim.k >= 0) settle(stage);
    for(let s = anim.si; s < anim.segs.length; s++){
      const items = anim.segs[s].items;
      for(let i = (s === anim.si ? anim.k + 1 : 0); i < items.length; i++){
        applyItem(items[i], 0);
        settle(stage);
      }
    }
    anim = null; board = state();
  }

  return {
    /** A press the rules refused: `r` is the explain result. */
    refuse(dir, r){
      face(stage, dir);
      startPose('stuck', dir, state().rac, true);
      startFx(dir, r);
    },
    /** A press that landed: `res` is what `play.press` answered. */
    play(dir, res){
      const r = res.r, s = state();
      face(stage, dir);
      const stay = s.rac.x === res.prev.rac.x && s.rac.y === res.prev.rac.y;
      startPose(r.kind === 'tear' ? 'tear' : r.steps[0].moved.length || stay ? 'push' : 'crawl', dir, res.prev.rac, stay);
      startMv(res.prev, r);
      if(r.kind === 'tear') clips.startRip(dir, r.steps[0], pose);
    },
    /** Cuts the move in play short, landed. */
    land(){ landMv(); busy = false; pose = null; },
    // Cutting an action short still has to LAND it: the board was committed the moment the shove
    // was legal, so the stage has to be walked through whatever steps are left or it would keep
    // drawing pieces on cells they have already left.
    cancel(){ fx = null; pose = null; if(anim){ landMv(); busy = false; } },
    /** The stage built fresh from the board in hand. `seed` deals the draw seeds. */
    rest(seed, decor){ anim = null; board = state(); stage = stageFrom(state(), seed, decor); },
    /** Puts back a stage kept from before a move. */
    restore(kept){ anim = null; board = state(); stage = kept; },
    newRoom(){ door = null; fxSeen = new Set(); },
    /** One frame: the refusal, the move and the pose each move on. */
    step(){
      if(fx){
        const ph = fxPhase();
        if(ph && ph.flash && !fx.beeped){ fx.beeped = true; onFlash(); }
        if(!ph) fx = null;
      }
      if(anim && !stepMv()){ anim = null; busy = false; }
      if(pose && poseAt() >= pose.segs.at(-1).t1) pose = null;
    },
    syncDoor(){
      const lit = exitLit(state());
      if(!door) door = { lit, t0: -Infinity };
      else if(lit !== door.lit && !anim) door = { lit, t0: clock() };
      if(doorLive()) kick();
    },
    /** The door shown as it stands, with no roll. */
    snapDoor(){ door = { lit: exitLit(state()), t0: -Infinity }; },
    /** A press came while a move plays. */
    markBusy(){ busy = true; },
    /** Whether anything here still changes. `shimmer` also counts the lit door, which never stops. */
    live({ shimmer = false } = {}){ return !!(anim || pose || fx || (shimmer ? doorLive() : rolling())); },
    /** What the painter needs of the action in play. */
    view(){
      return { fx, ph: fx ? fxPhase() : null, pose: pose && { ...pose, at: poseAt() },
        door: pixel ? doorRoll() : null };
    },
    get stage(){ return stage; },
    get board(){ return board ?? state(); },
    get moving(){ return !!anim; },
    get busy(){ return busy; },
    get refusing(){ return !!fx; },
  };
}
