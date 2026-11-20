// Presentation and input only — the rules live in src/rules.js.
// ES modules need http://, so run ./run.sh rather than opening the file.
import { NONE, BAG, CAN_FULL, CAN_EMPTY, DIRS, exitLit, fan, inGrid, cell, isMultiCell } from './rules.js';
import { parseLevelPack, toGrid } from './format.js';
import { createProgress } from './progress.js';
import { installFocusReclaim } from './focus.js';
import { createDebugLog, createProbe } from './debug.js';
import { createCrow, createCrowMemory, TUNING } from './crow.js';
import { createCrowDebug } from './crowDebug.js';
import { createWatch } from './crowWatch.js';
import { createPlay, tell } from './play.js';
import { mulberry32 } from './rng.js';
import { createSprites } from './sprites.js';
import { createPixelSprites, loadPixelArt, PIXEL_CELL } from './pixel.js';
import { createScreen, loadScreenArt } from './screen.js';
import { createClips } from './clips.js';
import { press, moveStart, moveStop, travelAt } from './art/press.js';
import { FRAME_MS, FRAME_RATE } from './art/timing.js';
import { RECOVERIES } from './art/cartoon.js';
import { tracings } from './art/canTip.js';
import { tearPress } from './art/bagRip.js';
import { LOOK as DOOR } from './art/door.js';
import { reverseStep } from './tape.js';
import { P, PATTERNS, KINDS, layWall, drawWipe, wallFrom, roomBeats } from './wipe.js';
import { createWipeTune } from './wipeTune.js';
import { createSound } from './sound.js';
import { createLostScan } from './lostScan.js';
import { createHud, pad } from './hud.js';
import { createPicker } from './picker.js';
import { createCrowPanel } from './crowPanel.js';
import { createBoardPaint } from './boardPaint.js';
// The stage owns the objects, their motion and their envelopes.
import { advance, applyStep, easeOut, rollEase, settle, stageFrom, timeline, face, CELL_MS } from './stage.js';

const CANF = CAN_FULL, CANE = CAN_EMPTY;
// `?pixel` draws the board in the pixel art, one canvas pixel to an art pixel, scaled up whole.
const PIXEL = new URLSearchParams(location.search).has('pixel');
const CS = PIXEL ? PIXEL_CELL : 76, PAD=9;
// The animation clock, in ms. `?debug` can hold it and step it a frame at a time.
let heldMs = null;
const clockMs = () => heldMs ?? performance.now();
const TWOS = 2 * 1000 / FRAME_RATE;
const since = t0 => Math.floor((clockMs() - t0) / TWOS) * TWOS;

const LEVELS = [];
// One entry per act: { label, from, to } as indices into LEVELS. The picker folds on it.
const ACT_OF = [];
const progress = createProgress(window.localStorage);
const sound = createSound(window.AudioContext || window.webkitAudioContext);
const hud = createHud(id => document.getElementById(id), progress);
// The play-by-play is null without `?debug`, and every call site is optional: the log is
// downstream of the game and may not be there at all.
const dbg = new URLSearchParams(location.search).has('debug')
  ? createDebugLog(document.getElementById('dbglog')) : null;
if(dbg){ document.getElementById('dbg').hidden = false; document.body.classList.add('debugging'); }
// The crow: `crow` says the lines, `watch` notices what he would say them about. Both are built
// once the packs have loaded, since what he notices depends on the running order.
let crow = null, watch = null, play = null;
let crowDbg = null;
const crowPanel = createCrowPanel({ pixel: PIXEL, clock: clockMs, since, present: () => present(),
  els: { box: document.getElementById('crow'), veil: document.getElementById('veil'),
    face: document.getElementById('crowface'), line: document.getElementById('crowline') } });
const now = crowPanel.now;
let beat = false;      // this run set a new record for the room, and the win screen says so
let blocked = null;   // { cells, reason, dir }
let busy = false;

// ---- the rejection animation ---------------------------------------------------------
// The state never changes here: the sequence plays out and rewinds itself, so the invalid
// overlap is a frame in an animation and never a board state.
const FX = {
  tear: { lunge:150, burst:190, hold:260, rewind:240 },
  push: { lunge:130, burst:0,   hold:170, rewind:140 },
  bump: { lunge:70,  burst:0,   hold:110, rewind:80  },
};
let fx = null, fxSeen = new Set(), raf = 0;

function startFx(dir, r){
  const [dx,dy] = DIRS[dir];
  const tx = play.state.rac.x+dx, ty = play.state.rac.y+dy;
  const o = inGrid(play.state,tx,ty) ? cell(play.state,tx,ty).o : NONE;
  let kind = o===BAG ? 'tear' : (o===CANF||o===CANE||isMultiCell(o)) ? 'push' : 'bump';
  const key = `${kind}:${r.reason}`;
  if(fxSeen.has(key)) kind = 'bump';          // you've seen it; don't make you sit through it
  fxSeen.add(key);
  fx = { kind, dx, dy, bx:tx, by:ty, showBurst: kind==='tear',
         cells: kind==='tear' ? fan(tx,ty,dx,dy) : [], blame:r.blame, t0:clockMs(), beeped:false };
  if(!raf) raf = requestAnimationFrame(tick);
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
// ---- the move animation --------------------------------------------------------------
// Driven by what the rules REPORT moved, not by diffing two boards. A diff cannot tell a piece
// that moved from one that appeared in its place. `stage` owns the
// objects and their fractional positions, `timeline` cuts the traced action into segments, and
// this only keeps the clock.
let stage = null, board = null, anim = null;

// In the pixel art he is drawn press by press: the drawings of one action, played from the cell he
// pressed from.
let pose = null, refusals = 0;
function startPose(act, dir, from, stay){
  if(!PIXEL) return;
  const segs = act === 'tear' ? tearPress(dir)
    : press(act, dir, { lead: false, recovery: act === 'stuck' ? RECOVERIES[refusals++ % RECOVERIES.length] : undefined });
  pose = { act, segs, dir, x: from.x, y: from.y, stay, t0: clockMs() };
}
const poseAt = () => since(pose.t0) / FRAME_MS;
let door = null;
function syncDoor(){
  const lit = exitLit(play.state);
  if(!door) door = { lit, t0: -Infinity };
  else if(lit !== door.lit && !anim) door = { lit, t0: clockMs() };
  if(doorLive()) raf ||= requestAnimationFrame(tick);
}
function doorRoll(){
  const k = Math.min(1, since(door.t0) / (DOOR.roll * FRAME_MS));
  return { open: door.lit ? k : 1 - k, frame: Math.floor(clockMs() / FRAME_MS) };
}
const doorRolling = () => !!door && since(door.t0) < DOOR.roll * FRAME_MS;
const doorLive = () => PIXEL && !!door && (door.lit || doorRolling());

const slow = matchMedia('(prefers-reduced-motion: reduce)');

// The stage is NOT rebuilt per action. It stands on `prev`: `rest()` builds it when the room
// loads, and each action takes it forward. A rebuild would re-seed every sprite, so a pile of
// trash would change its look when the board around it shifts.
function startMv(prev, r){
  board = prev;
  const segs = timeline(r, CELL_MS), wind = pose ? moveStart(pose.segs) * FRAME_MS : 0;
  anim = { segs, si: 0, k: -1, t0: clockMs() + wind,
           drawn: !!pose && segs[0].items.length === 1 && !segs[0].roll };
  if(!raf) raf = requestAnimationFrame(tick);
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
  if(++anim.si >= anim.segs.length){ board = play.state; return false; }
  board = seg.items.at(-1).next;
  anim.k = -1; anim.t0 = clockMs();
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
  anim = null; board = play.state;
}

// ---- the undo rewind ----
const REWIND_SPEED = 2;
// Each move keeps a tape: the stage from before it, and its drawings as reverse steps
// (`src/tape.js`). The stage is kept because one built again from a board deals the draw seeds
// again, and every pile spawned since the room loaded would come back with a new look.
let tapes = [], rec = null, rewind = null;

function startTape(kept){
  const tape = { stage: kept, t0: clockMs(), steps: [] };
  tapes.push(tape);
  if(PIXEL) rec = { tape, on: true, prev: ctx.getImageData(0, 0, cv.width, cv.height) };
}
function record(){
  if(wipe?.t0 != null){ rec.on = false; return; }
  const next = ctx.getImageData(0, 0, cv.width, cv.height), step = reverseStep(rec.prev, next);
  if(step) rec.tape.steps.push({ t: clockMs() - rec.tape.t0, ...step });
  rec.prev = next;
}

function startRewind(tape){
  // A wipe or the shimmer may have drawn over the screen since the tape stopped.
  if(rec?.tape === tape) ctx.putImageData(rec.prev, 0, 0);
  rec = null;
  door = { lit: exitLit(play.state), t0: -Infinity };
  rewind = { steps: tape.steps, i: tape.steps.length - 1, end: tape.steps.at(-1).t, t0: clockMs() };
  raf ||= requestAnimationFrame(tick);
}
const putBack = s => ctx.putImageData(new ImageData(s.old, s.w, s.h), s.x, s.y);
/** Returns false once the screen is back to the drawing before the move. */
function stepRewind(){
  const t = rewind.end - since(rewind.t0) * REWIND_SPEED;
  while(rewind.i >= 0 && rewind.steps[rewind.i].t > t) putBack(rewind.steps[rewind.i--]);
  return rewind.i >= 0;
}
function endRewind(){
  while(rewind.i >= 0) putBack(rewind.steps[rewind.i--]);
  rewind = null;
}

// ---- the win ----
// Frames at 60 Hz. `lay` is one brick's drop into its course.
const WIPE = { exit: 12, empty: 30, cover: 40, roomHold: 60, roomHoldMax: 120, reveal: 30, revealMax: 90, tail: 60,
  lay: 8, order: 'same', leave: 'hop', pattern: 'room', kind: 'room' };
let wipe = null, wipeSet = WIPE, lastWipe = null;
let wall = null;      // laid once per board size and kind, since laying one is costly

function startWipe(replay = false){
  if(!replay) sound.chime();
  const h = ((play.cur + 1) * 2654435761) >>> 0, s = wipeSet, kinds = Object.keys(KINDS);
  wipe = { t0: null, replay, loaded: false, set: s, t: { ...s, hold: Infinity },
    pattern: s.pattern === 'room' ? PATTERNS[h % PATTERNS.length] : s.pattern,
    kind: s.kind === 'room' ? kinds[(h >>> 8) % kinds.length] : s.kind };
  lastWipe = { pattern: wipe.pattern, kind: wipe.kind };
  if(!raf) raf = requestAnimationFrame(tick);
}
function roomIn(w){
  crow.cue(now());
  const { hold, reveal } = roomBeats((crow.peek().line?.lineLeft ?? 0) / FRAME_MS, w.set);
  w.loaded = true;
  w.t.hold = wipeAt() - wallFrom(w.t) - w.t.cover + hold; w.t.reveal = reveal;
}
/** Frames since he started to leave; negative while the winning step is still on its way. */
const wipeAt = () => wipe.t0 === null ? -1 : since(wipe.t0) / FRAME_MS;
function drawWall(ctx, f){
  const fr = wipeAt() - wallFrom(wipe.t);
  if(fr < 0) return;
  if(wall?.kind !== wipe.kind || wall.w !== f.w || wall.h !== f.h)
    wall = Object.assign(layWall(wipe.kind, f.w, f.h, 1, PIXEL ? 1 : P), { w: f.w, h: f.h });
  drawWipe(ctx, wall, wipe.pattern, wipe.t, fr);
}

/** How far gone he is, 0 to 1, until the wall comes down; null when he is simply there. */
function leaving(){
  if(!wipe || wipe.t0 === null) return null;
  const f = wipeAt(), t = wipe.t;
  return f >= wallFrom(t) + t.cover + t.hold ? null : Math.min(1, f / t.exit);
}

const sendNote = note => fetch('/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(note) }).then(r => { if(!r.ok) throw new Error(`HTTP ${r.status}`); });
if(new URLSearchParams(location.search).has('wipe'))
  wipeSet = createWipeTune(document.getElementById('wtune'), WIPE, {
    replay: () => { if(!play.won && !anim && !wipe) startWipe(true); },
    snap: () => ({ level: LEVELS[play.cur].id, room: play.cur, last: lastWipe }),
    send: sendNote,
  });

// One ticker for every animation, so a rejection, a slide and the wipe cannot
// fight over `raf`.
function tick(){
  raf = 0;
  if(rewind && !stepRewind()) rewind = null;
  if(fx){
    const ph = fxPhase();
    if(ph && ph.flash && !fx.beeped){ fx.beeped = true; sound.beep(false); }
    if(!ph) fx = null;
  }
  if(anim && !stepMv()){ anim = null; busy = false; }
  if(pose && poseAt() >= pose.segs.at(-1).t1) pose = null;
  if(wipe){
    if(wipe.t0 === null && !anim){ wipe.t0 = clockMs(); crow.cue(now()); }
    const f = wipeAt(), t = wipe.t;
    if(!wipe.loaded && f >= wallFrom(t) + t.cover && !crow.view(now()).talking){
      if(!wipe.replay){ handOver(true); return; }
      roomIn(wipe);
    }
    if(f >= wallFrom(t) + t.cover + t.hold + t.reveal) wipe = null;
  }
  clips.prune();
  render();
  if(rec?.on && !animating()) rec.on = false;
  if(animating({ shimmer: true })) raf ||= requestAnimationFrame(tick);
}
/** Whether anything drawn is still changing. `shimmer` also counts the lit door, which never stops. */
const animating = ({ shimmer = false } = {}) =>
  !!(anim || pose || fx || wipe || rewind || clips.anyLive() || (shimmer ? doorLive() : doorRolling()));

function handOver(keep = false){
  const w = keep ? wipe : null;
  wipe = null;
  if(play.cur < LEVELS.length - 1) load(play.cur + 1); else render();
  // Drawn again before the frame is shown: the load drew the new room with no wall over it.
  if(w){
    wipe = w; roomIn(w);
    render(); raf ||= requestAnimationFrame(tick);
  }
}
// Cutting an action short still has to LAND it: the board was committed the moment the shove
// was legal, so the stage has to be walked through whatever steps are left or it would keep
// drawing pieces on cells they have already left.
const cancelAnim = () => {
  if(raf) cancelAnimationFrame(raf); raf = 0; fx = null; wipe = null; pose = null;
  if(anim) landMv();
  if(rewind) endRewind();
};

// ---- input ----
function act(dir){
  sound.unlock();
  if(play.won){ handOver(); return; }
  if(rewind) endRewind();
  if(wipe){ wipe = null; render(); }
  if(fx){ cancelAnim(); render(); }
  const res = play.press(dir, !!anim);
  const r = res.r;
  if(res.kind === 'busy'){ busy = true; render(); }
  else if(res.kind === 'refused'){
    face(stage, dir);
    dbg?.refused(dir, r);
    dbg?.decor(play.decor);
    blocked = { cells:r.blame, reason:r.reason, dir };
    startPose('stuck', dir, play.state.rac, true);
    startFx(dir, r); render();
  }
  else if(res.kind === 'armed'){ blocked = null; sound.beep(true); render(); }
  else {
    // A cut move ends its tape on the landed drawing, so its rewind jumps where this play did.
    if(anim){ landMv(); busy = false; pose = null; render(); }
    const kept = structuredClone(stage);
    face(stage, dir);
    dbg?.action(play.moves, dir, res.prev.rac, r);
    dbg?.decor(play.decor);
    blocked = null;
    const stay = play.state.rac.x === res.prev.rac.x && play.state.rac.y === res.prev.rac.y;
    startPose(r.kind === 'tear' ? 'tear' : r.steps[0].moved.length || stay ? 'push' : 'crawl', dir, res.prev.rac, stay);
    startMv(res.prev, r);
    if(r.kind === 'tear') clips.startRip(dir, r.steps[0], pose);
    startTape(kept);
    if(play.won){ beat = res.beat; startWipe(); dbg?.note(`won in ${play.moves}`); }
    readLost();
    render();
  }
  tell(watch, now(), res);
}
function undo(){
  cancelAnim(); busy = false;
  const res = play.undo();
  if(res.kind === 'none') return;
  const tape = tapes.pop();
  blocked=null; anim = null; board = play.state; stage = tape.stage; clips.reset();
  if(tape.steps.length) startRewind(tape);
  readLost(); render(); dbg?.note(`undo -> ${play.moves}`);
  tell(watch, now(), res);
}
function restart(){ load(play.cur, true); }
function load(i, again = false){
  cancelAnim(); busy = false; door = null; fxSeen = new Set(); tapes = []; rec = null; clips.reset();
  const res = play.load(i, again);
  blocked=null; beat=false;
  lostScan.start(play.state);
  dbg?.note(`-- ${pad(LEVELS[play.cur].id)} ${LEVELS[play.cur].name ?? ''} --`);
  rest(); render();
  tell(watch, now(), res);
}

// The verdict is wanted once per room, and every move after it is a lookup, so it runs on idle
// time rather than competing with the arrow key. `requestIdleCallback` reports the idle time left.
// The timeout stops a page that is never idle from never answering at all.
const askIdle = window.requestIdleCallback
  ? cb => requestIdleCallback(cb, { timeout: 400 })
  : cb => requestAnimationFrame(() => cb({ timeRemaining: () => 6 }));
const dropIdle = window.cancelIdleCallback
  ? h => cancelIdleCallback(h)
  : h => cancelAnimationFrame(h);
const lostScan = createLostScan({ askIdle, dropIdle, onVerdict: dead => {
  readLost(); render();
  watch.scanned(now(), dead);
} });
const readLost = () => lostScan.check(play.state, play.won);
function rest(){ anim = null; board = play.state; stage = stageFrom(play.state, play.cur + 1, play.decor); }

// ---- render ----
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const SP = PIXEL ? createPixelSprites({ ctx, art: await loadPixelArt(new URL('./art/', import.meta.url)) })
  : createSprites({ ctx, cell: CS, pad: PAD });
const clips = createClips({ pixel: PIXEL, art: SP, stage: () => stage, clock: clockMs, since, frame: FRAME_MS });
// In the pixel art the room is drawn off screen, and the screen frames it.
const screenCv = document.getElementById('screen');
const screen = PIXEL ? createScreen({ canvas: screenCv, art: await loadScreenArt(new URL('./art/', import.meta.url)), C: CS }) : null;
// Sized in device pixels: a canvas squeezed by a ratio that is not whole drops and doubles pixel columns.
const fitScreen = () => Object.assign(screenCv.style, { width: `${screenCv.width / devicePixelRatio}px`, height: `${screenCv.height / devicePixelRatio}px` });
if(PIXEL){ document.body.classList.add('pixel'); fitScreen(); addEventListener('resize', fitScreen); }
if(PIXEL) for(const job of tracings()) askIdle(job);
const painter = createBoardPaint({ ctx, art: SP, clips, cs: CS, pad: PAD, pixel: PIXEL });

function render(){
  if(rewind){ paintHud(); return; }
  const s=play.state;
  if(PIXEL) syncDoor();
  cv.width=s.cols*CS; cv.height=s.rows*CS;
  painter.paint({
    state:s, board:board ?? play.state, sprites:stage.sprites,
    fx, ph: fx ? fxPhase() : null, moving: !!anim,
    armed: play.armed, blocked,
    w:cv.width, h:cv.height, cs:CS,
    pose: pose && { ...pose, at: poseAt() }, door: PIXEL ? doorRoll() : null,
    leaving: leaving(), leave: wipe?.t.leave, wall: wipe ? drawWall : null,
  });
  if(rec?.on) record();
  paintHud();
  if(PIXEL) present();
}

function paintHud(){
  hud.paint({ level: LEVELS[play.cur], state: play.state, moves: play.moves, won: play.won, armed: play.armed,
    busy, blocked, beat, lost: lostScan.lost });
}

function present(){
  const L = LEVELS[play.cur];
  screen.paint({ room: cv, cols: play.state.cols, rows: play.state.rows, left: `${pad(L.id)}  ${L.name ?? ''}`, right: `Moves ${play.moves}  Par ${L.par}`,
    ...crowPanel.screenView(),
    wall: wipe ? (c, w, h) => drawWall(c, { w, h }) : null });
}


// ---- wire up ----
const KEY={ArrowUp:'u',ArrowDown:'d',ArrowLeft:'l',ArrowRight:'r',
  w:'u',s:'d',a:'l',d:'r',W:'u',S:'d',A:'l',D:'r'};
// The itch embed runs in an iframe on another origin, and its fullscreen button leaves focus on
// the parent document — `keydown` simply stops arriving. Clicking back in normally heals it, but
// focusing the frame is the default action of the very press this game cancels.
installFocusReclaim(window);

// The listeners go on before the art and the crow have loaded; until then a key has nothing to act on.
addEventListener('keydown',e=>{
  if(!play || e.ctrlKey || e.altKey || e.metaKey || e.target.closest?.('input,textarea')) return;
  if(picker.isOpen()){
    if(e.key==='Escape'){ e.preventDefault(); picker.close(); }
    return;
  }
  const skipKey = e.key==='Escape'||e.key===' '||e.key==='Enter';
  if(crowPanel.speaking){ if(skipKey || e.key in KEY) e.preventDefault(); if(skipKey) crow.press(now()); return; }
  if(e.key in KEY){ e.preventDefault(); act(KEY[e.key]); }
  else if(skipKey){ e.preventDefault(); watch.key(now()); crow.press(now()); }
  else if(e.key==='u'||e.key==='U'){ undo(); }
  else if(e.key==='r'||e.key==='R'){ restart(); }
  else if(e.key==='<'){ load(play.cur-1); }
  else if(e.key==='>'){ load(play.cur+1); }
});
// One delegated listener for every button under the board, so the layout is markup-only.
const MOVEACT={up:'u',down:'d',left:'l',right:'r'};
document.getElementById('controls').addEventListener('click',e=>{
  const btn=e.target.closest('[data-act]'); if(!play || !btn || crowPanel.speaking) return;
  const a=btn.dataset.act;
  if(a in MOVEACT){ act(MOVEACT[a]); }
  else if(a==='undo')undo(); else if(a==='restart')restart();
  else if(a==='next')load(play.cur+1); else if(a==='prev')load(play.cur-1);
});

// `?acts=` names the packs to load, comma-separated. A scratch pack loads the same way, so a new
// piece runs in the real game before it belongs in an act.
const ACTS = new URLSearchParams(location.search).get('acts')?.split(',') ?? ['act1.tt', 'act2.tt'];
// The pack names itself. The file name is the fallback, so a pack with no `:pack` line still gets
// a heading rather than an empty one. The label is short enough to sit on one line beside the
// room range.
const actLabel = (name, file) =>
  (name ?? '').split('—').pop().replace(/\s*\(.*\)\s*$/, '').trim()
  || file.replace(/\.tt$/, '');
async function loadAsset(path, as){
  // Resolved against this module, not the document: on a project Pages site the page sits a
  // directory down, so a document-relative '../' climbs out of the deployment entirely.
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
sound.setChime(await loadAsset('sfx/win-chime.mp3', 'bytes'));
{
  const memory = createCrowMemory(window.localStorage);
  // Which variant he picks is cosmetic, so it may differ from one sitting to the next.
  const rng = mulberry32(Date.now());
  const events = JSON.parse(await loadAsset('dialogue/crow.json'));
  crowDbg = dbg && createCrowDebug(document.getElementById('cdbg'), { events, tuning: TUNING,
    snap: () => ({ query: location.search, level: LEVELS[play.cur].id, room: play.cur, moves: play.moves, won: play.won, armed: play.armed, path: play.path,
      board: toGrid(play.state) }),
    send: sendNote });
  crow = createCrow({ events, rng, memory,
    onLog: r => { if(r.type === 'say') dbg?.note(`crow ${r.key}`); crowDbg?.note(r); } });
  watch = createWatch({ crow, levels: LEVELS, acts: ACT_OF, progress, memory, rng });
  play = createPlay({ levels: LEVELS, progress });
}
const $ = id => document.getElementById(id);
const picker = createPicker({
  els: { grid: $('lvlgrid'), sheet: $('sheet'), button: $('picker'), close: $('pickclose') },
  levels: LEVELS, acts: ACT_OF, progress, current: () => play.cur, choose: i => load(i),
});

// The probe reaches the game through questions, not variables: it must not be able to build a
// reference stage on a seed the game did not use, or read a board mid-animation and call the
// difference a fault. It is built after boot, since `idle` reads the clips.
if(dbg) window.__tt = createProbe({
  stage: () => stage,
  refStage: () => stageFrom(play.state, play.cur + 1, play.decor),
  decor: () => play.decor,
  grid: () => toGrid(play.state),
  idle: () => !animating(),
  level: () => LEVELS[play.cur].id,
  moves: () => play.moves,
  won: () => play.won,
  armed: () => play.armed,
  mute: v => sound.mute(v),
  hold: () => { heldMs = performance.now(); },
  run: () => { heldMs = null; raf ||= requestAnimationFrame(tick); },
  step: (n = 1) => { heldMs += n * 1000 / FRAME_RATE; cancelAnimationFrame(raf); tick(); },
});
load(0);
crowPanel.start({ crow, watch, debug: crowDbg, state: () => play.state });
