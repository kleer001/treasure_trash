// Presentation and input only — the rules live in src/rules.js.
// ES modules need http://, so run ./run.sh rather than opening the file.
import {
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, BIN_EMPTY, WHEELIE, WHEELIE_EMPTY, JUG,
  JUG_EMPTY, SPONGE, CARDBOARD, PANE, TIRE_H, TIRE_V, BICYCLE, RUG, CHAIR, BROOM,
  CABC_U, CABC_D, CABC_L, CABC_R, CABO_U, CABO_D, CABO_L, CABO_R,
  MAG_U, MAG_D, MAG_L, MAG_R,
  FURNITURE,
  DIRS,
  exitLit, fan, inGrid, cell, isMultiCell, stateKey,
  GREASE, TAR, GLASS, COVERED, isBarrow, barrowFace, gripTarget, OCCUPANTS as CODES,
} from './rules.js';
import { parseLevelPack, toGrid } from './format.js';
import { deadScan } from './solver.js';
import { createProgress } from './progress.js';
import { installFocusReclaim } from './focus.js';
import { createDebugLog, createProbe } from './debug.js';
import { createCrow, createCrowMemory, TUNING } from './crow.js';
import { createCrowDebug } from './crowDebug.js';
import { createWatch, refusal } from './crowWatch.js';
import { createPlay, tell } from './play.js';
import { mulberry32 } from './rng.js';
import { createSprites, drawOccupant, exitArrowDir, PALETTE as C } from './sprites.js';
import { createCompositor } from './compositor.js';
import { P, PATTERNS, KINDS, layWall, drawWipe, holdEnds, wallFrom } from './wipe.js';
import { createWipeTune } from './wipeTune.js';
// stage owns the objects, their motion and its envelopes
import {
  CART, COUCH, RACCOON, SPLASH, advance, applyStep, cellSeed, easeOut, rollEase, settle,
  stageFrom, timeline, face, CELL_MS,
} from './stage.js';

const CANF = CAN_FULL, CANE = CAN_EMPTY;
// A room is shown by its own id, zero-padded, so the picker, the pack and levels.md all call
// it the same thing. Three digits because the pack is meant to grow: L0 -> 000, L18 -> 018.
const pad = id => String(id).replace(/\D+/g,'').padStart(3,'0');
const CS=76, PAD=9;
// The occupant codes the sprite dispatcher needs; it takes them rather than importing the
// rules, so the art has no idea a rulebook exists.


const WHY = {
  edge:    "that's the edge of the alley",
  wall:    "wall",
  trash:   "your own trash — permanent",
  fan:     "no room to burst",
  canRoom: "no room to shove it",
  exit:    "that's your way out — you can't dump on it",
  water:   "he's not wetting his paws — fill it in first",
  afloat:  "that's out in the canal — he's not wading in after it",
  pour:    "it only pours on dry ground",
  glass:   "broken glass — he's not standing in that",
  tar:     "stuck in the tar for good",
  oneway:  "that only goes one way, and it isn't this one",
};
// Name the thing in the way rather than saying "blocked": the red cell already carries that.
const OBSTACLE = { [BAG]:"a bag", [CANF]:"a full can", [CANE]:"a can", [TRASH]:"your own trash",
  [BIN]:"a full recycle bin", [BIN_EMPTY]:"an empty recycle bin",
  [WHEELIE]:"a wheelie bin",
  [WHEELIE_EMPTY]:"an empty wheelie bin", [JUG]:"the water jug", [JUG_EMPTY]:"the empty jug",
  [SPONGE]:"the sponge", [CARDBOARD]:"the cardboard", [PANE]:"the pane of glass",
  [TIRE_H]:"the tyre", [TIRE_V]:"the tyre", [BICYCLE]:"the bicycle", [RUG]:"the rolled rug", [CHAIR]:"the office chair", [BROOM]:"the broom",
  [CABC_U]:"the filing cabinet", [CABC_D]:"the filing cabinet",
  [CABC_L]:"the filing cabinet", [CABC_R]:"the filing cabinet",
  [CABO_U]:"the open cabinet", [CABO_D]:"the open cabinet",
  [CABO_L]:"the open cabinet", [CABO_R]:"the open cabinet",
  [MAG_U]:"the magnet", [MAG_D]:"the magnet", [MAG_L]:"the magnet", [MAG_R]:"the magnet",
  [FURNITURE]:"the couch" };
function whyText(b){
  const base = WHY[refusal(state, b)];
  if(b.reason !== 'fan' && b.reason !== 'canRoom') return base;
  const [x,y] = b.cells[0] ?? [];
  if(x === undefined || !inGrid(state,x,y)) return `${base} — the wall's in the way`;
  const c = cell(state,x,y);
  const what = c.wall ? "the wall" : (OBSTACLE[c.o] ?? "something");
  return `${base} — ${what} is in the way`;
}

let LEVELS = [], cur=0, state=null, moves=0, won=false;
// Which way things face: decoration the board does not hold. Null is the room as its file lays it out.
let decor=null;
// One entry per act: { label, from, to } as indices into LEVELS. The picker folds on it.
const ACT_OF = [], CELLS = [];
const progress = createProgress(window.localStorage);
// The play-by-play, on `?debug` and nowhere else: the artifact has no query string, so the
// panel it ships is a hidden element nothing ever fills. Null when it is off, and every call
// site is optional — the log is downstream of the game and may not be there at all.
const dbg = new URLSearchParams(location.search).has('debug')
  ? createDebugLog(document.getElementById('dbglog')) : null;
if(dbg){
  document.getElementById('dbg').hidden = false; document.body.classList.add('debugging');
  // The probe reaches the game through questions, not variables: it must not be able to build a
  // reference stage on a seed the game did not use, or read a board mid-animation and call the
  // difference a fault.
  window.__tt = createProbe({
    stage: () => stage,
    refStage: () => stageFrom(state, cur + 1, decor),
    decor: () => decor,
    grid: () => toGrid(state),
    idle: () => !anim && !busy && !fx && !wipe,
    level: () => LEVELS[cur].id,
    moves: () => moves,
    won: () => won,
    mute: v => { muted = v; },
  });
}
// The crow: `crow` says the lines, `watch` notices what he would say them about. Both are built
// once the packs have loaded, since what he notices depends on the running order.
let crow = null, watch = null, play = null;
let crowDbg = null;    // his inner workings, on `?debug`
// His clock. A hidden tab stops the frames but not `performance.now()`, and a clock that jumped
// the whole absence would land every line due in it unseen. So no frame advances it by more than
// a tenth of a second.
let crowT = 0, crowLast = performance.now();
const now = () => { const p = performance.now(); crowT += Math.min(p - crowLast, 100); crowLast = p; return crowT; };
let beat = false;      // this run set a new record for the room, and the win screen says so
let blocked = null;   // { cells, reason, dir } — cleared by the next legal action
// Set when the player shoves during a move and cleared the instant that move lands, so the
// notice is never on screen for longer than the thing it is apologising for.
let busy = false;
// The solvability indicator. `deadKeys` is every board this room can no longer be won from —
// a property of the ROOM, so it is computed once when the room opens and then only looked up.
// Until it arrives `lost` stays false: an indicator that has not finished thinking says
// nothing rather than guessing.
let deadKeys = null, scan = null, scanRaf = 0, lost = false;
let armed = null;     // direction of a tear that is aimed but not yet committed

// ---- the rejection animation ---------------------------------------------------------
// The state never changes here: the sequence plays out and rewinds itself, so the invalid
// overlap is a frame in an animation and never a board state. Durations are per action
// kind, and drop to `bump` on a repeat of the same mistake in the same room.
const FX = {
  tear: { lunge:150, burst:190, hold:260, rewind:240 },
  push: { lunge:130, burst:0,   hold:170, rewind:140 },
  bump: { lunge:70,  burst:0,   hold:110, rewind:80  },
};
let fx = null, fxSeen = new Set(), raf = 0;

function startFx(dir, r){
  const [dx,dy] = ({u:[0,-1],d:[0,1],l:[-1,0],r:[1,0]})[dir];
  const tx = state.rac.x+dx, ty = state.rac.y+dy;
  const o = inGrid(state,tx,ty) ? cell(state,tx,ty).o : NONE;
  let kind = o===BAG ? 'tear' : (o===CANF||o===CANE||isMultiCell(o)) ? 'push' : 'bump';
  const key = `${kind}:${r.reason}`;
  if(fxSeen.has(key)) kind = 'bump';          // you've seen it; don't make you sit through it
  fxSeen.add(key);
  fx = { kind, dx, dy, bx:tx, by:ty, showBurst: kind==='tear',
         cells: kind==='tear' ? fan(tx,ty,dx,dy) : [], blame:r.blame, t0:performance.now(), beeped:false };
  if(!raf) raf = requestAnimationFrame(tick);
}
function fxPhase(){
  const d = FX[fx.kind], e = performance.now() - fx.t0;
  const t1=d.lunge, t2=t1+d.burst, t3=t2+d.hold, t4=t3+d.rewind;
  if(e < t1)  return { lunge:e/t1, burst:0, flash:0 };
  if(e < t2)  return { lunge:1, burst:d.burst ? (e-t1)/d.burst : 1, flash:0 };
  if(e < t3)  return { lunge:1, burst:1, flash:1 };
  if(e < t4){ const k = 1-(e-t3)/d.rewind; return { lunge:k, burst:k, flash:0 }; }
  return null;                                 // done
}
// ---- the move animation --------------------------------------------------------------
// Driven by what the rules REPORT moved, not by diffing two boards. A diff cannot tell a
// wheelie bin's dropped bag from the bin itself — both simply appear — so it had to fly
// everything out of the shove cell. `stage` owns the objects and their fractional positions,
// `timeline` cuts the traced action into segments, and this only keeps the clock.
let stage = null, board = null, anim = null;
const slow = matchMedia('(prefers-reduced-motion: reduce)');

// The stage is NOT rebuilt per action. It is already standing on `prev` — `rest()` built it
// when the room loaded and every action since has taken it forward — and rebuilding would
// re-seed every sprite, which is how a pile of trash changed appearance when the board around
// it shifted.
function startMv(prev, r){
  board = prev;
  anim = { segs: timeline(r, CELL_MS), si: 0, k: -1, t0: performance.now() };
  if(!raf) raf = requestAnimationFrame(tick);
}

/** Returns false once the whole action has played out. */
function stepMv(){
  const seg = anim.segs[anim.si];
  const t = Math.min(1, (performance.now() - anim.t0) / seg.dur);
  // Progress is measured in CELLS, so the whole part names the step and the fraction is the
  // progress inside it. That is what keeps velocity continuous across a step boundary: the
  // envelope spans the whole roll, and the steps are just where it crosses an edge.
  const d = (seg.roll ? rollEase(t, seg.cells) : easeOut(t)) * seg.items.length;
  const k = Math.min(seg.items.length - 1, Math.floor(d));
  while(anim.k < k){
    if(anim.k >= 0) settle(stage);
    anim.k++;
    const it = seg.items[anim.k];
    board = it.board;
    applyStep(stage, it.step, it.racTo);
  }
  advance(stage, slow.matches ? 0 : d - k, seg.pace);
  if(t < 1) return true;
  settle(stage);
  board = state;
  if(++anim.si >= anim.segs.length) return false;
  anim.k = -1; anim.t0 = performance.now();
  return true;
}

/** Land the whole action at once — an input cutting an animation short still has to finish it. */
function landMv(){
  // The step that was in flight first: `applyStep` finds a sprite by its ANCHOR, so leaving one
  // part-way through a beat makes every step after it fail to find what it names.
  if(anim.k >= 0) settle(stage);
  for(let s = anim.si; s < anim.segs.length; s++){
    const items = anim.segs[s].items;
    for(let i = (s === anim.si ? anim.k + 1 : 0); i < items.length; i++){
      applyStep(stage, items[i].step, items[i].racTo);
      settle(stage);
    }
  }
  anim = null; board = state;
}

// ---- the win: he leaves by the door, a wall goes up over the board, the next room loads behind
// it and the wall comes down again. The covered board is the crow's moment to talk.
// Frames at 60 Hz, each phase after the one before; `lay` is one brick's drop into its course.
// `wait`: 'fixed' holds for `hold` frames; 'end' holds at least `hold` and, while he talks, up to
// `holdMax`; 'both' also holds the new room under the wall until his line there is done.
const WIPE = { exit: 12, empty: 30, cover: 40, hold: 50, holdMax: 360, wait: 'fixed', reveal: 30, lay: 8, order: 'same',
  leave: 'hop', pattern: 'room', kind: 'room' };
const FRAME_MS = 1000 / 60;
let wipe = null, wipeSet = WIPE, lastWipe = null;
let wall = null;      // laid once a board size and kind: a wall is hundreds of bricks

/** The pattern and the bricks are seeded from the level index, so a room always ends the same way. */
function startWipe(replay = false){
  if(!replay) playWinChime();
  const h = ((cur + 1) * 2654435761) >>> 0, s = wipeSet, kinds = Object.keys(KINDS);
  wipe = { t0: null, replay, loaded: false, set: s, t: { ...s, hold: Infinity }, hold: holdFrom(wallFrom(s) + s.cover, s),
    pattern: s.pattern === 'room' ? PATTERNS[h % PATTERNS.length] : s.pattern,
    kind: s.kind === 'room' ? kinds[(h >>> 8) % kinds.length] : s.kind };
  lastWipe = { pattern: wipe.pattern, kind: wipe.kind };
  if(!raf) raf = requestAnimationFrame(tick);
}
/** A hold that began at frame `from`. The wall is open (`t.hold` is Infinity) until it closes. */
const holdFrom = (from, s) => s.wait === 'fixed'
  ? { from, min: s.hold, max: s.hold, wait: false } : { from, min: s.hold, max: s.holdMax, wait: true };
/** Ends the hold at frame `f`: the brick-out is timed from here. */
function closeHold(f){ wipe.t.hold = f - wallFrom(wipe.t) - wipe.t.cover; wipe.hold = null; }
/** He has a line on screen, or one queued or due. */
function crowBusy(){ const v = crow.view(now()); return v.talking || v.waiting; }
/** Frames since he started to leave; negative while the winning step is still on its way. */
const wipeAt = () => wipe.t0 === null ? -1 : (performance.now() - wipe.t0) / FRAME_MS;
function drawWall(ctx, f){
  const fr = wipeAt() - wallFrom(wipe.t);
  if(fr < 0) return;
  if(wall?.kind !== wipe.kind || wall.w !== f.w || wall.h !== f.h)
    wall = Object.assign(layWall(wipe.kind, f.w, f.h, 1), { w: f.w, h: f.h });
  drawWipe(ctx, wall, wipe.pattern, wipe.t, fr);
}

/** How far gone he is, 0 to 1, until the wall comes down; null when he is simply there. */
function leaving(){
  if(!wipe || wipe.t0 === null) return null;
  const f = wipeAt(), t = wipe.t;
  return f >= wallFrom(t) + t.cover + t.hold ? null : Math.min(1, f / t.exit);
}
// A 4x4 ordered dither: pixel art is all there or not there, so he goes a few pixels at a time.
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function leave(sp, k){
  const x0 = sp.x * CS, y0 = sp.y * CS;
  ctx.save();
  if(wipe.t.leave === 'fade') ctx.globalAlpha = 1 - k;
  else if(wipe.t.leave === 'hop'){
    // A crouch for the first quarter, let go as he jumps; in the air he stretches and shrinks
    // into the middle of the door.
    const u = Math.max(0, (k - .25) / .75), c = k < .25 ? k / .25 : Math.max(0, 1 - u / .15);
    const air = Math.sin(Math.PI * u), sc = 1 - u;
    ctx.translate(x0 + CS / 2, y0 + CS - u * CS / 2 - air * .4 * CS);
    ctx.scale((1 + .2 * c) * sc, (1 - .2 * c) * sc * (1 + .25 * air));
    ctx.translate(-(x0 + CS / 2), -(y0 + CS));
  }
  else {
    const clip = new Path2D();
    for(let y = 0; y < CS + 2 * PAD; y += P) for(let x = 0; x < CS + 2 * PAD; x += P)
      if((BAYER[(y / P & 3) * 4 + (x / P & 3)] + .5) / 16 > k) clip.rect(x0 - PAD + x, y0 - PAD + y, P, P);
    ctx.clip(clip);
  }
  SP.raccoon(sp.x, sp.y);
  ctx.restore();
}

const sendNote = note => fetch('/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(note) }).then(r => { if(!r.ok) throw new Error(`HTTP ${r.status}`); });
if(new URLSearchParams(location.search).has('wipe'))
  wipeSet = createWipeTune(document.getElementById('wtune'), WIPE, {
    replay: () => { if(!won && !anim && !wipe) startWipe(true); },
    snap: () => ({ level: LEVELS[cur].id, room: cur, last: lastWipe }),
    send: sendNote,
    // He starts a wait after the win, and the wipe's clock starts when the winning step lands.
    crowFrame: TUNING.preWaitMs / FRAME_MS - CELL_MS / FRAME_MS,
  });

// One ticker for all three animations, so a rejection, a slide and the wipe cannot
// fight over `raf`.
function tick(){
  raf = 0;
  if(fx){
    const ph = fxPhase();
    if(ph && ph.flash && !fx.beeped){ fx.beeped = true; beep(false); }
    if(!ph) fx = null;
  }
  if(anim && !stepMv()){ anim = null; busy = false; }
  if(wipe){
    if(wipe.t0 === null && !anim) wipe.t0 = performance.now();
    const f = wipeAt(), t = wipe.t, h = wipe.hold;
    if(h && holdEnds(f - h.from, h.min, h.max, h.wait && crowBusy())){
      closeHold(f);
      if(!wipe.replay && !wipe.loaded){ handOver(true); return; }
    }
    if(f >= wallFrom(t) + t.cover + t.hold + t.reveal) wipe = null;
  }
  render();
  if(fx || anim || wipe) raf = requestAnimationFrame(tick);
}

// The next room loads behind the wall, which then comes down over it; a key press goes straight
// there. The chime is not consulted and keeps ringing.
function handOver(keep = false){
  const w = keep ? wipe : null;
  wipe = null;
  if(cur < LEVELS.length - 1) load(cur + 1); else render();
  // Drawn again before the frame is shown: the load drew the new room with no wall over it.
  if(w){
    wipe = w; w.loaded = true;
    if(w.set.wait === 'both'){ w.t.hold = Infinity; w.hold = holdFrom(wipeAt(), w.set); }
    render(); raf ||= requestAnimationFrame(tick);
  }
}
// Cutting an action short still has to LAND it: the board was committed the moment the shove
// was legal, so the stage has to be walked through whatever steps are left or it would keep
// drawing pieces on cells they have already left.
const cancelAnim = () => {
  if(raf) cancelAnimationFrame(raf); raf = 0; fx = null; wipe = null;
  if(anim) landMv();
};

// ---- audio: a procedural two-tone "no" for a refused input.
let ac = null;
// A driver walks thousands of beats and every refusal in them buzzes. Muting is the harness's
// business rather than the audio's, so the flag lives here and the probe is what sets it.
let muted = false;
/** The context, created on first input — browsers refuse to start one before a gesture. */
function audio(){
  ac ??= new (window.AudioContext || window.webkitAudioContext)();
  if(ac.state === 'suspended') ac.resume();
  return ac;
}
function beep(ok){
  if(muted) return;
  try {
    audio();
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = ok ? 'triangle' : 'square';
    o.frequency.setValueAtTime(ok ? 520 : 190, t);
    if(!ok) o.frequency.setValueAtTime(140, t + .07);          // the downward "nope"
    g.gain.setValueAtTime(ok ? .045 : .09, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + (ok ? .07 : .16));
    o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + (ok ? .08 : .17));
  } catch { /* audio is a nicety; never let it break input */ }
}

// The win chime is the one recorded sample. Fire and forget: nothing holds a handle to it,
// so it is never cancelled or waited on and rings over the hand-over into the next room.
const WIN_GAIN = 0.35;                 // sits above the beeps without shouting
let winBytes = null, winBuf = null;

/** Decode once, on first input, so the buffer is ready long before anyone wins. */
function primeWinChime(){
  if(winBuf || !winBytes) return;
  const bytes = winBytes; winBytes = null;     // decodeAudioData detaches it — only one go
  audio().decodeAudioData(bytes).then(b => { winBuf = b; });
}
function playWinChime(){
  if(muted || !winBuf) return;                          // not decoded yet: the room still hands over
  const src = audio().createBufferSource(), g = audio().createGain();
  src.buffer = winBuf;
  g.gain.value = WIN_GAIN;
  src.connect(g); g.connect(ac.destination);
  src.start();                                 // no handle kept: it finishes on its own
}

// ---- input ----
function act(dir){
  audio(); primeWinChime();              // first input is the gesture that unlocks audio
  if(won){ handOver(); return; }         // done admiring it? go straight to the next room
  if(wipe){ wipe = null; render(); }     // the wall coming down, or a replay: a key ends it
  if(fx){ cancelAnim(); render(); }           // a refusal is not travel: cut it short
  // While a shove plays out, his PAWS are busy and a press that would move a piece waits; a
  // walk goes through and lands the shove it interrupted.
  const res = play.press(dir, !!anim); sync();
  const r = res.r;
  if(res.kind === 'busy'){ busy = true; render(); }
  else if(res.kind === 'refused'){       // refused — play the whole no, then rewind it
    face(stage, dir);
    dbg?.refused(dir, r);
    dbg?.decor(decor);
    blocked = { cells:r.blame, reason:r.reason, dir };
    startFx(dir, r); render();
  }
  else if(res.kind === 'armed'){ blocked = null; beep(true); render(); }   // aimed, not committed
  else {
    if(anim){ landMv(); busy = false; }
    face(stage, dir);
    dbg?.action(moves, dir, res.prev.rac, r);
    dbg?.decor(decor);
    blocked = null;
    startMv(res.prev, r);
    if(won){ beat = res.beat; startWipe(); dbg?.note(`won in ${moves}`); }
    readLost();
    render();
  }
  tell(watch, now(), res);
}
function undo(){
  cancelAnim(); busy = false;
  const res = play.undo(); sync();
  if(res.kind === 'none') return;
  blocked=null; rest(); readLost(); render(); dbg?.note(`undo -> ${moves}`);
  tell(watch, now(), res);
}
function restart(){ load(cur, true); }
function load(i, again = false){
  cancelAnim(); busy = false; fxSeen = new Set();         // a new room earns the full explanation again
  const res = play.load(i, again); sync();
  blocked=null; beat=false;
  startScan();
  dbg?.note(`-- ${pad(LEVELS[cur].id)} ${LEVELS[cur].name ?? ''} --`);
  rest(); render();
  tell(watch, now(), res);
}
// The loop's books are `play`'s; these are what the screen last read of them.
function sync(){ ({ cur, state, decor, moves, won, armed } = play); }

// ---- the solvability indicator ----
// The mess here is permanent, so a room can be lost long before it ends, and Sokoban's
// documented frustration is exactly that: a long solution with no way to tell whether you
// already derailed it. The whole graph is walked once per room to answer it.

/** Whether the board he is standing on can still be won. Silent until the scan lands. */
function readLost(){ lost = !!deadKeys && !won && deadKeys.has(stateKey(state)); }

// How long the answer is worth waiting for. Every shipped room lands inside a small fraction of
// this — the slowest is under half a second of work and the average is a couple of frames — so
// what the budget actually bounds is the rooms that were never going to finish: a board with
// thirty movable pieces has a graph that runs to tens of millions, and scanning it took half a
// minute of taking a bite out of every frame. The player feels that as a game that will not
// answer the arrow key, which is a bad trade for a verdict that is not coming.
const SCAN_BUDGET_MS = 1200;
let scanSpent = 0;

// Driven on IDLE time, not on the frame. The verdict is wanted once per room and then never
// again — every move after it is a lookup — so there is no reason for it to compete with the
// arrow key. `requestIdleCallback` hands back how long the browser expects to be doing nothing,
// which is the longest wait available and the only honest answer to "when should this run".
// The timeout is what stops a page that is never idle from never answering at all.
const askIdle = window.requestIdleCallback
  ? cb => requestIdleCallback(cb, { timeout: 400 })
  : cb => requestAnimationFrame(() => cb({ timeRemaining: () => 6 }));
const dropIdle = window.cancelIdleCallback
  ? h => cancelIdleCallback(h)
  : h => cancelAnimationFrame(h);

function startScan(){
  if(scanRaf) dropIdle(scanRaf);
  deadKeys = null; lost = false; scanSpent = 0;
  scan = deadScan(state);
  scanRaf = askIdle(pumpScan);
}

// A slice per frame rather than one blocking pass: the rooms this pack is growing toward
// reach tens of thousands of boards, and the player is owed a responsive first move more
// than an instant verdict.
function pumpScan(deadline){
  scanRaf = 0;
  const t0 = performance.now();
  // What the browser says it has spare, held to a frame at the top so one generous deadline
  // cannot turn into a stutter, and to a trickle at the bottom so a page that is never idle
  // still gets there.
  const slice = Math.min(12, Math.max(3, deadline?.timeRemaining?.() ?? 6));
  while(performance.now() - t0 < slice){
    const r = scan.next();
    if(!r.done) continue;
    // Null is the scan giving up on a room too big to enumerate. Either way, stop driving it:
    // the slice is charged to every frame the room is open, and there is no answer coming.
    deadKeys = r.value; scan = null;
    if(deadKeys){                            // the room may already have been lost while it thought
      const dead = deadKeys;
      readLost(); render();
      watch.scanned(now(), k => dead.has(k));
    }
    return;
  }
  scanSpent += performance.now() - t0;
  if(scanSpent >= SCAN_BUDGET_MS){ scan = null; return; }   // silent, and out of the way
  scanRaf = askIdle(pumpScan);
}
/** The stage at rest on the current board — every jump that is not an action goes through here. */
function rest(){ anim = null; board = state; stage = stageFrom(state, cur + 1, decor); }

// ---- render ----
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const SP = createSprites({ ctx, cell: CS, pad: PAD });
// Couches under carts, carts under loose things, cargo over the cart it rides, him on top.
const BANDS = ['couch','cart','loose','carried','raccoon'];
const bandOf = sp => sp.kind === COUCH ? 0 : sp.kind === CART ? 1
  : sp.kind === RACCOON ? 4 : (sp.parent === null ? 2 : 3);

// A thing riding INSIDE another thing is drawn over it and nudged clear of it: two pixels right
// and two down for every level down the stack it is. Here rather than in each drawing, because
// every kind can end up inside a barrow and none of them knows how deep it is.
function drawSprite(sp, f){
  if(!sp.depth) return paintSprite(sp, f);
  ctx.save();
  ctx.translate(sp.depth * 2, sp.depth * 2);
  paintSprite(sp, f);
  ctx.restore();
}

// Everything but the ground is a sprite with a position of its own, so a couch comes out as one
// slab with no seam, cargo is carried rather than redrawn, and a bin's bag leaves the bin.
function paintSprite(sp, f){
  const { state:s, ph, fx } = f;
  // Struck and too heavy to shift: it leans about its own bottom edge and comes back. Wrapped
  // round the whole draw rather than pushed into one sprite, so it costs the drawings nothing.
  if(sp.tilt){
    // The carrier's bottom edge when it has one, so cargo swings with the cart rather than
    // spinning on its own middle; its own otherwise.
    const [pvx, pvy] = sp.pivot ?? [sp.x + 0.5, sp.y + 1];
    const px = pvx * CS, py = pvy * CS;
    ctx.save();
    ctx.translate(px, py); ctx.rotate((sp.tilt * Math.PI) / 180); ctx.translate(-px, -py);
    const t = sp.tilt; sp.tilt = 0;
    paintSprite(sp, f);
    sp.tilt = t;
    ctx.restore();
    return;
  }
  if(sp.kind === RACCOON){
    const k = leaving();
    if(k !== null){ if(k < 1) leave(sp, k); return; }
    // A refusal is a lunge from where he stands, not travel — the stage knows nothing of it.
    if(ph){ const k = ph.lunge*0.42; SP.raccoon(s.rac.x+fx.dx*k, s.rac.y+fx.dy*k); }
    else SP.raccoon(sp.x, sp.y);
  }
  else if(sp.kind === COUCH){
    if(sp.o === BICYCLE) SP.bicycle(sp.cells, sp.x, sp.y);
    else if(sp.o === RUG) SP.rug(sp.cells, sp.x, sp.y);
    // An open cabinet is one piece and two drawings: the cabinet, and the drawer standing out of
    // it. Which end is which is the facing, and the anchor is whichever of the two the stage
    // reached first, so it is asked rather than assumed.
    else if(CODES.cabinetFace(sp.o)){
      const f = DIRS[CODES.cabinetFace(sp.o)];
      const other = sp.cells.find(([ox,oy]) => ox || oy);
      const lead = other[0] === f[0] && other[1] === f[1];
      const bx = lead ? sp.x : sp.x + other[0], by = lead ? sp.y : sp.y + other[1];
      SP.cabinet(bx, by, CODES.cabinetFace(sp.o), true);
      SP.drawer(bx + f[0], by + f[1], f);
    }
    else SP.furniture(sp.cells, sp.x, sp.y);
  }
  else if(sp.kind === CART){
    if(isBarrow(sp.ck)) SP.barrow(sp.x, sp.y, barrowFace(sp.ck));
    else SP.skateboard(sp.cells, sp.x, sp.y);
  }
  else if(sp.kind === SPLASH) SP.splash(sp.x, sp.y);
  else drawOccupant(SP, CODES, sp.kind, sp.x, sp.y, {
    seed: sp.seed, face: sp.face, wet: sp.soaks ? (sp.soak ?? 1) : 0,
    // a bag mid-refusal deflates where it stands; a torn one deflates as its fan grows
    k: sp.dying ? (sp.deflate ?? 1)
      : ph && fx.bx===Math.round(sp.x) && fx.by===Math.round(sp.y) ? 1-ph.burst : 1,
  });
}

/** Whatever goes down a grate, drawn going down it: smaller and fainter as it drops.
 *
 *  Here rather than in each drawing, because `k` is a scale only some of them take and every
 *  kind can end up over a grate — a bag out of a can, a can out of a cart, a tyre that rolled
 *  onto one. Vanishing between frames instead reads as the sprite being forgotten. */
function drawFalling(sp, f){
  const k = sp.deflate ?? 1;
  if(k <= 0) return;
  const cx = (sp.x + 0.5) * CS, cy = (sp.y + 0.5) * CS;
  ctx.save();
  ctx.globalAlpha = k;
  ctx.translate(cx, cy); ctx.scale(k, k); ctx.translate(-cx, -cy);
  drawSprite(sp, f);
  ctx.restore();
}

/**
 * Every hold as its two ends, holder first. Read off the board the animation is on, as the ground
 * is; each end rides on the sprite standing there, so a hold stretches and shrinks over the beat
 * instead of jumping after it.
 */
function holdsOn(f){
  const b=f.board, shift=new Map(), out=[];
  for(const sp of f.sprites){
    if(sp.kind===RACCOON) continue;
    for(const [ox,oy] of sp.cells ?? [[0,0]]) shift.set(`${sp.ax+ox},${sp.ay+oy}`, [sp.x-sp.ax, sp.y-sp.ay]);
  }
  const at=(x,y)=>{ const [dx,dy]=shift.get(`${x},${y}`) ?? [0,0]; return [x+dx, y+dy]; };
  for(let y=0;y<b.rows;y++) for(let x=0;x<b.cols;x++){
    const t=gripTarget(b,x,y);
    if(t) out.push([at(x,y), at(...t)]);
  }
  return out;
}

const comp = createCompositor([
  { name:'clear', draw:(ctx,f)=>ctx.clearRect(0,0,f.w,f.h) },

  // Terrain only — the ground is the one thing that is still a property of the square. Read
  // from the board the animation is currently on, so a canal fills as the trash lands in it.
  { name:'terrain', draw:(ctx,f)=>{
    const s=f.state, b=f.board;
    // A canal fills over the beat the trash crosses into it, and the trash is a sprite while
    // that is happening — so how far along it is, is the sprite's to say, not the board's.
    const filling=new Map();
    for(const sp of f.sprites)
      if(sp.soaks) filling.set(`${Math.round(sp.tx)},${Math.round(sp.ty)}`, sp.fill ?? 1);
    for(let y=0;y<b.rows;y++) for(let x=0;x<b.cols;x++){
      const c=cell(b,x,y); if(c.wall) continue;
      // A filled cell keeps the canal's dark rim, so you can still see where the water was and
      // what it cost to cross.
      if(c.water)                   SP.water(x,y,false,0,filling.get(`${x},${y}`)??0);
      else if(c.bridge)             SP.water(x,y,true,cellSeed(x,y));
      else if(c.grate)              SP.grate(x,y);
      else if(c.oneway!==undefined) SP.oneway(x,y,c.oneway);
      else if(c.ter===GREASE)       SP.grease(x,y);
      else if(c.ter===TAR)          SP.tar(x,y);
      else if(c.ter===GLASS)        SP.glass(x,y);
      else if(c.ter===COVERED)      SP.covered(x,y);
      else                          SP.floor(x,y);
      if(c.exit) SP.exit(x,y, exitLit(s), exitArrowDir(s.cols,s.rows,x,y));
    }
  }},

  { name:'holds', draw:(ctx,f)=>{ for(const [a,b] of holdsOn(f)) SP.hold(...a, ...b); } },

  // the debris of a burst that is being refused: it flies out, reaches the cell that
  // won't take it, and retracts. None of it is board state.
  { name:'debris', draw:(ctx,f)=>{
    if(!f.ph) return;
    const s=f.state;
    for(const [x,y] of (f.fx.showBurst ? f.fx.cells : []))
      if(inGrid(s,x,y) && !cell(s,x,y).wall)
        SP.trash(x,y,{ seed:cellSeed(x,y), k:f.ph.burst, src:[f.fx.bx,f.fx.by] });
  }},

  ...BANDS.map((name,band)=>({ name, draw:(ctx,f)=>{
    for(const sp of f.sprites) if(bandOf(sp)===band) (sp.falls ? drawFalling : drawSprite)(sp,f);
  }})),

  // Fan preview, over everything including the exit sign. Always pale yellow: it answers
  // "where would this land", which has the same answer whether or not the strike is legal.
  // Red belongs to the blocking cell alone, and only once you have tried. Arming narrows
  // the preview to the aimed direction so two adjacent bags do not light ten cells at once.
  { name:'grips', draw:(ctx,f)=>{
    for(const [[ax,ay],[bx,by]] of holdsOn(f)){
      const n=Math.hypot(bx-ax, by-ay) || 1;
      SP.grip(bx-(bx-ax)/n*0.5, by-(by-ay)/n*0.5);
    }
  }},

  { name:'fan', draw:(ctx,f)=>{
    const s=f.state, cs=f.cs;
    const red = new Set((f.blocked?.cells ?? []).map(([x,y])=>`${x},${y}`));
    for(const dir of (f.ph || f.moving ? [] : f.armed ? [f.armed] : ['u','d','l','r'])){
      const [dx,dy]=({u:[0,-1],d:[0,1],l:[-1,0],r:[1,0]})[dir];
      const bx=s.rac.x+dx, by=s.rac.y+dy;
      if(!inGrid(s,bx,by) || cell(s,bx,by).o!==BAG) continue;   // fan preview: bags only
      for(const [fx,fy] of fan(bx,by,dx,dy)){
        if(!inGrid(s,fx,fy) || red.has(`${fx},${fy}`)) continue;   // never tint under the red
        ctx.fillStyle="rgba(255,207,0,.45)";
        ctx.fillRect(fx*cs+1,fy*cs+1,cs-2,cs-2);
        ctx.strokeStyle="rgba(224,170,0,.85)"; ctx.lineWidth=2;
        ctx.strokeRect(fx*cs+2,fy*cs+2,cs-4,cs-4);
      }
    }
  }},

  // The armed bag gets a ring + a direction arrow, so "what am I about to do" is on the
  // board and not only in the HUD.
  { name:'armed', draw:(ctx,f)=>{
    if(!f.armed) return;
    const s=f.state;
    const [dx,dy]=({u:[0,-1],d:[0,1],l:[-1,0],r:[1,0]})[f.armed];
    const ax=s.rac.x+dx, ay=s.rac.y+dy, o=cell(s,ax,ay).o;
    // A push is as permanent as a tear, so it gets the same look-before-you-commit.
    if(o===CANE||o===CANF){
      drawLanding(ax+dx, ay+dy);
      if(o===CANF) drawLanding(ax+2*dx, ay+2*dy);
    }
    drawAim(ax, ay, dx, dy);
  }},

  // Blocked: mark the exact cells to blame, in red.
  { name:'blocked', draw:(ctx,f)=>{
    const b=f.blocked;
    if(!b || (f.ph && !f.ph.flash)) return;
    for(const [bx,by] of b.cells) drawBlocked(bx,by);
    if(!b.cells.length) drawEdgeBar(f.state.rac.x, f.state.rac.y, b.dir);
  }},

  { name:'wipe', draw:(ctx,f)=>{ if(f.wipe) drawWall(ctx, f); } },
]);

function render(){
  const s=state;
  cv.width=s.cols*CS; cv.height=s.rows*CS;
  comp.render(ctx, {
    state:s, board:board ?? state, sprites:stage.sprites,
    fx, ph: fx ? fxPhase() : null, moving: !!anim,
    armed, blocked, wipe,
    w:cv.width, h:cv.height, cs:CS,
  });
  paintHud();
}

// The HUD is DOM, not canvas, so it is not a layer.
function paintHud(){
  document.getElementById('moves').textContent=moves;
  document.getElementById('par').textContent=LEVELS[cur].par;
  document.getElementById('lvlname').textContent=LEVELS[cur].name;
  document.getElementById('picknum').textContent=pad(LEVELS[cur].id);
  const w=document.getElementById('warn');
  // The busy notice outranks a stale refusal: it is about right now, and it is about to go.
  w.textContent = busy ? '⏳ one thing at a time — he only has the two paws'
    : blocked ? `✕ ${whyText(blocked)}` : '';
  w.className = 'warn'+(busy?' show busy':blocked?' show':'');
  const am=document.getElementById('arm');
  am.textContent = armed ? `${({u:'↑',d:'↓',l:'←',r:'→'})[armed]} again to ${armedVerb()}` : '';
  am.className = 'arm'+(armed?' show':'');
  const sc=document.getElementById('score');
  const st=progress.stars(LEVELS[cur].id, LEVELS[cur].par), bestMoves=progress.best(LEVELS[cur].id);
  // Par is the proven minimum, so "over par" is an exact number rather than a designer's guess.
  sc.textContent = won ? `${'★'.repeat(st)}${'☆'.repeat(3-st)}${beat?' new best!':''}`
    : bestMoves !== null ? `${'★'.repeat(st)}${'☆'.repeat(3-st)} best ${bestMoves}` : '';
  sc.className = 'score'+(bestMoves!==null||won?' show':'')+(beat?' beat':'');
  const lo=document.getElementById('lost');
  // Short enough to sit on the moves row: a standing notice that pushes the board down the
  // page every time it appears is a bigger interruption than the thing it is reporting. It
  // still names the way back, because the point of saying it is that you can act on it.
  lo.innerHTML = lost ? '<b>✕</b> unwinnable — undo or restart' : '';
  lo.className = 'lost'+(lost?' show':'');
  document.querySelectorAll('.tab').forEach((t,i)=>t.className='tab'+(i===cur?' on':''));
}

// His panel is DOM, like the HUD. Text only until the portrait is in: the face is named.
const crowBox = document.getElementById('crow'), veil = document.getElementById('veil');
const crowFace = document.getElementById('crowface'), crowLine = document.getElementById('crowline');
// A speech has the screen to itself, and the board waits for it. When it ends the panel drops to
// its dock and bounces; the board comes up behind it.
const SETTLE_MS = 40 * 1000 / 60;
let speaking = false, shownFace = '', shownText = '';
function paintCrow(v){
  if(v.speech !== speaking) v.speech ? toSpeech() : toDock();
  const face = v.talking || v.face !== 'closed' ? v.face : '';
  if(face !== shownFace) crowFace.textContent = shownFace = face;
  if(v.text !== shownText) crowLine.textContent = shownText = v.text;
}
function toSpeech(){ speaking = true; document.body.classList.add('speech'); }
function toDock(){
  const a = crowBox.getBoundingClientRect();
  speaking = false; document.body.classList.remove('speech');
  const b = crowBox.getBoundingClientRect();
  // From where the speech left it, at its speech size, down onto the dock.
  const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
  crowBox.animate([
    { transform: `translate(${dx}px,${dy}px) scale(${a.width / b.width},${a.height / b.height})`, easing: 'cubic-bezier(.5,0,.9,.5)' },
    { transform: 'translate(0,0) scale(1.06,.88)', offset: .55, easing: 'cubic-bezier(.2,.6,.4,1)' },
    { transform: 'translate(0,-14px) scale(.98,1.04)', offset: .75, easing: 'cubic-bezier(.6,0,.8,.4)' },
    { transform: 'translate(0,0) scale(1.03,.96)', offset: .9 },
    { transform: 'none' },
  ], { duration: SETTLE_MS });
  veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SETTLE_MS * .6, easing: 'ease-out' });
}

function drawLanding(x,y){
  if(!inGrid(state,x,y)) return;
  ctx.save();
  ctx.fillStyle="rgba(255,207,0,.32)"; ctx.fillRect(x*CS+1,y*CS+1,CS-2,CS-2);
  ctx.strokeStyle="rgba(224,170,0,.9)"; ctx.lineWidth=3; ctx.setLineDash([6,4]);
  ctx.strokeRect(x*CS+3,y*CS+3,CS-6,CS-6); ctx.setLineDash([]);
  ctx.restore();
}
function armedVerb(){
  const [dx,dy]=({u:[0,-1],d:[0,1],l:[-1,0],r:[1,0]})[armed];
  const c = cell(state, state.rac.x+dx, state.rac.y+dy);
  return c.o===BAG ? 'tear' : 'shove';
}
function drawAim(x,y,dx,dy){
  const x0=px(x), y0=px(y), cx=x0+CS/2, cy=y0+CS/2;
  ctx.save();
  ctx.strokeStyle="#e0aa00"; ctx.lineWidth=4; ctx.setLineDash([7,5]);
  ctx.strokeRect(x0+3,y0+3,CS-6,CS-6); ctx.setLineDash([]);
  ctx.strokeStyle="#e0aa00"; ctx.lineWidth=5; ctx.lineCap="round"; ctx.lineJoin="round";
  const a=CS*0.24;
  ctx.beginPath();
  ctx.moveTo(cx-dx*a, cy-dy*a); ctx.lineTo(cx+dx*a, cy+dy*a);
  ctx.moveTo(cx+dx*a-(dx+dy)*8, cy+dy*a-(dy+dx)*8);
  ctx.lineTo(cx+dx*a, cy+dy*a);
  ctx.lineTo(cx+dx*a-(dx-dy)*8, cy+dy*a-(dy-dx)*8);
  ctx.stroke();
  ctx.restore();
}
function drawBlocked(x,y){
  const x0=px(x), y0=px(y);
  ctx.save();
  ctx.fillStyle="rgba(255,75,62,.42)"; ctx.fillRect(x0+1,y0+1,CS-2,CS-2);
  ctx.strokeStyle=C.red; ctx.lineWidth=4; ctx.strokeRect(x0+3,y0+3,CS-6,CS-6);
  ctx.lineCap="round"; ctx.lineWidth=7; ctx.strokeStyle="#c8321f";
  const m=CS*0.30;
  ctx.beginPath();
  ctx.moveTo(x0+m,y0+m); ctx.lineTo(x0+CS-m,y0+CS-m);
  ctx.moveTo(x0+CS-m,y0+m); ctx.lineTo(x0+m,y0+CS-m);
  ctx.stroke();
  ctx.restore();
}
// off-grid: there is no cell to paint, so mark the wall of the alley itself
function drawEdgeBar(x,y,dir){
  const [dx,dy]=({u:[0,-1],d:[0,1],l:[-1,0],r:[1,0]})[dir];
  const x0=px(x), y0=px(y), T=9;
  ctx.save(); ctx.fillStyle=C.red;
  if(dy<0) ctx.fillRect(x0+2,y0+1,CS-4,T);
  if(dy>0) ctx.fillRect(x0+2,y0+CS-1-T,CS-4,T);
  if(dx<0) ctx.fillRect(x0+1,y0+2,T,CS-4);
  if(dx>0) ctx.fillRect(x0+CS-1-T,y0+2,T,CS-4);
  ctx.restore();
}

// Cell coordinates to pixels. The overlays below draw in the same space as the sprites.
function px(x){return x*CS}


// ---- wire up ----
const KEY={ArrowUp:'u',ArrowDown:'d',ArrowLeft:'l',ArrowRight:'r',
  w:'u',s:'d',a:'l',d:'r',W:'u',S:'d',A:'l',D:'r'};
// The itch embed runs in an iframe on another origin, and its fullscreen button leaves focus on
// the parent document — `keydown` simply stops arriving. Clicking back in normally heals it, but
// focusing the frame is the default action of the very press this game cancels.
installFocusReclaim(window);

addEventListener('keydown',e=>{
  // Words typed into a field are not moves.
  if(e.target.closest?.('input,textarea')) return;
  // While the sheet is up it owns the keyboard: Escape closes, and nothing reaches the board.
  if(!document.getElementById('sheet').hidden){
    if(e.key==='Escape'){ e.preventDefault(); closePicker(); }
    return;
  }
  const skipKey = e.key==='Escape'||e.key===' '||e.key==='Enter';
  if(speaking){ if(skipKey || e.key in KEY) e.preventDefault(); if(skipKey) crow.press(now()); return; }
  if(e.key in KEY){ e.preventDefault(); act(KEY[e.key]); }
  else if(skipKey){ e.preventDefault(); watch.key(now()); crow.press(now()); }
  else if(e.key==='u'||e.key==='U'){ undo(); }
  else if(e.key==='r'||e.key==='R'){ restart(); }
  // Same wrap-around the Prev/Next buttons get, since `load` takes the index modulo the pack.
  else if(e.key==='<'){ load(cur-1); }
  else if(e.key==='>'){ load(cur+1); }
});
// One delegated listener for every button under the board, so the layout is markup-only.
const MOVEACT={up:'u',down:'d',left:'l',right:'r'};
document.getElementById('controls').addEventListener('click',e=>{
  const btn=e.target.closest('[data-act]'); if(!btn || speaking) return;
  const a=btn.dataset.act;
  if(a in MOVEACT){ act(MOVEACT[a]); }
  else if(a==='undo')undo(); else if(a==='restart')restart();
  else if(a==='next')load(cur+1); else if(a==='prev')load(cur-1);
});

// Levels are data on disk, in the same pack the verifier checks. Fail loudly.
// Acts are separate files, played end to end. The list is the running order; a room's id is
// unique across the whole game, so nothing downstream has to know which act it came from.
// A scratch pack can be named on the query string. That is how a new piece gets played in the
// real game before it belongs in a shipped act: the bench pages import `src/` and prove the
// rules, but only this path exercises input, refusal painting, the HUD and the sprites. Inert
// in the built artifact, which has no query string and serves its packs from inside itself.
const ACTS = new URLSearchParams(location.search).get('acts')?.split(',') ?? ['act1.tt', 'act2.tt'];
// Which rooms came from which act. The pack names itself; the file name is the fallback so a
// pack with no `:pack` line still gets a heading rather than an empty one.
// Short enough to sit on one line beside the room range: the pack's own trailing name, with
// any parenthetical dropped. "Treasure Trash — Act 1 (raccoon only, crow pinned)" -> "Act 1".
const actLabel = (name, file) =>
  (name ?? '').split('—').pop().replace(/\s*\(.*\)\s*$/, '').trim()
  || file.replace(/\.tt$/, '');
// THE ONE PLACE THE GAME READS A FILE, and it is a seam: `tools/build-artifact.mjs` replaces
// this whole function so a single-file artifact serves the same bytes from inside itself,
// with no request for the CSP to block. Keep every load going through here — the bundler
// checks that the function is still findable, but it cannot see a fetch that grew somewhere
// else, and the CSP will.
async function loadAsset(path, as){
  // Resolved against this module, not the document: on a project Pages site the page sits a
  // directory down, so a document-relative '../' climbs out of the deployment entirely. It
  // lives in here because `import.meta` is module-only syntax and the bundle is one script —
  // replacing this function has to take the last mention of it with it.
  const res = await fetch(new URL(`../${path}`, import.meta.url));
  if(!res.ok) throw new Error(`cannot load ${path} (${res.status}) — serve with ./run.sh`);
  return as === 'bytes' ? res.arrayBuffer() : res.text();
}
for(const act of ACTS){
  const pack = parseLevelPack(await loadAsset(`levels/${act}`));
  const from = LEVELS.length;
  LEVELS.push(...pack.levels);
  ACT_OF.push({ label: actLabel(pack.meta.pack, act), from, to: LEVELS.length - 1 });
}
winBytes = await loadAsset('sfx/win-chime.mp3', 'bytes');
{
  const memory = createCrowMemory(window.localStorage);
  // Which variant he picks is cosmetic, so it may differ from one sitting to the next.
  const rng = mulberry32(Date.now());
  const events = JSON.parse(await loadAsset('dialogue/crow.json'));
  crowDbg = dbg && createCrowDebug(document.getElementById('cdbg'), { events, tuning: TUNING,
    snap: () => ({ query: location.search, level: LEVELS[cur].id, room: cur, moves, won, armed, path: play.path,
      board: toGrid(state) }),
    send: sendNote });
  crow = createCrow({ events, rng, memory,
    onLog: r => { if(r.type === 'say') dbg?.note(`crow ${r.key}`); crowDbg?.note(r); } });
  watch = createWatch({ crow, levels: LEVELS, acts: ACT_OF, progress, memory, rng });
  play = createPlay({ levels: LEVELS, progress });
}
// One fold per act, one square per room. Built once; only the current-room marker and which
// fold is open change as you play. `<details>` rather than a hand-rolled accordion, so the
// keyboard and the screen reader get the behaviour for free.
const grid=document.getElementById('lvlgrid'), sheet=document.getElementById('sheet');
for(const a of ACT_OF){
  const fold=document.createElement('details'); fold.className='act-group';
  const head=document.createElement('summary');
  head.append(a.label);
  const range=document.createElement('span'); range.className='range';
  range.textContent=`${pad(LEVELS[a.from].id)}–${pad(LEVELS[a.to].id)}`;
  const tag=document.createElement('span'); tag.className='tally';
  head.append(range,tag);
  fold.append(head);
  const g=document.createElement('div'); g.className='grid';
  for(let i=a.from;i<=a.to;i++){
    const b=document.createElement('button');
    b.className='cell';
    const n=document.createElement('span'); n.className='no'; n.textContent=pad(LEVELS[i].id);
    const s=document.createElement('span'); s.className='stars';
    b.append(n,s);
    b.onclick=()=>{ closePicker(); load(i); };
    g.append(b); CELLS[i]=b;
  }
  fold.append(g);
  grid.append(fold);
  a.fold=fold; a.tag=tag;
}

/** Paint what the player has done. Called on open, so it is never stale. */
function paintProgress(){
  LEVELS.forEach((L,i)=>{
    const b=CELLS[i]; if(!b) return;
    const n=progress.stars(L.id, L.par), done=progress.done(L.id);
    b.className='cell'+(done?' done':'');
    b.setAttribute('aria-current',String(i===cur));
    // Filled stars only. At this size a hollow star reads as a filled one, so the count has
    // to be legible by LENGTH rather than by shape.
    b.querySelector('.stars').textContent = '★'.repeat(n);
    const bestMoves=progress.best(L.id);
    b.title = `${L.name ?? L.id} — par ${L.par}`
      + (done ? ` · best ${bestMoves} (${n}/3)` : ' · not finished');
  });
  for(const a of ACT_OF){
    const t=progress.tally(LEVELS.slice(a.from,a.to+1));
    a.done=t.complete;
    a.tag.textContent = t.complete
      ? `✓ ${t.earned}/${t.possible}★`
      : `${t.done}/${t.total} · ${t.earned}★`;
    a.fold.classList.toggle('finished', t.complete);
  }
}

function openPicker(){
  paintProgress();
  // Open the act you are in — unless you have finished it, in which case the useful thing to
  // show is the first act you have not. A finished act folds itself away.
  const here = ACT_OF.findIndex(a => cur>=a.from && cur<=a.to);
  const next = ACT_OF.findIndex(a => !a.done);
  const show = (ACT_OF[here]?.done && next !== -1) ? next : here;
  ACT_OF.forEach((a,k)=>{ a.fold.open = k===show; });
  sheet.hidden=false;
  document.getElementById('picker').setAttribute('aria-expanded','true');
  CELLS[cur]?.scrollIntoView({block:'nearest'});
  CELLS[cur]?.focus();
}
function closePicker(){
  sheet.hidden=true;
  const p=document.getElementById('picker');
  p.setAttribute('aria-expanded','false'); p.focus();
}
document.getElementById('picker').onclick=openPicker;
document.getElementById('pickclose').onclick=closePicker;
// Click the backdrop, not the box, to dismiss.
sheet.addEventListener('click',e=>{ if(e.target===sheet) closePicker(); });

load(0);
requestAnimationFrame(function crowFrame(){
  const t = now();
  // A speech is not the player idling.
  speaking ? watch.key(t) : watch.tick(t, state);
  paintCrow(crow.view(t));
  crowDbg?.paint(crow.peek(), watch.peek(t));
  requestAnimationFrame(crowFrame);
});
