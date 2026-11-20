// Presentation and input only — the rules live in src/rules.js.
// ES modules need http://, so run ./run.sh rather than opening the file.
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
import { FRAME_MS, FRAME_RATE } from './art/timing.js';
import { tracings } from './art/canTip.js';
import { createWipeTune } from './wipeTune.js';
import { createSound } from './sound.js';
import { createLostScan } from './lostScan.js';
import { createHud, pad } from './hud.js';
import { createPicker } from './picker.js';
import { createCrowPanel } from './crowPanel.js';
import { createBoardPaint } from './boardPaint.js';
import { createRewind } from './rewind.js';
import { createWinWipe, WIPE } from './winWipe.js';
import { createMotion } from './motion.js';
import { stageFrom } from './stage.js';

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
let raf = 0;

let wipeSet = WIPE;
const winWipe = createWinWipe({ pixel: PIXEL, settings: () => wipeSet, room: () => play.cur, crow: () => crow, now,
  clock: clockMs, since, chime: () => sound.chime(), kick: () => kick() });

const sendNote = note => fetch('/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(note) }).then(r => { if(!r.ok) throw new Error(`HTTP ${r.status}`); });
if(new URLSearchParams(location.search).has('wipe'))
  wipeSet = createWipeTune(document.getElementById('wtune'), WIPE, {
    replay: () => { if(!play.won && !motion.moving && !winWipe.live) winWipe.start(true); },
    snap: () => ({ level: LEVELS[play.cur].id, room: play.cur, last: winWipe.last }),
    send: sendNote,
  });

// One ticker for every animation, so a rejection, a slide and the wipe cannot
// fight over `raf`.
const kick = () => { raf ||= requestAnimationFrame(tick); };
function tick(){
  raf = 0;
  if(rewind.playing) rewind.step();
  motion.step();
  if(winWipe.step(motion.moving) === 'handover'){ handOver(true); return; }
  clips.prune();
  render();
  if(!animating()) rewind.still();
  if(animating({ shimmer: true })) kick();
}
/** Whether anything drawn is still changing. `shimmer` also counts the lit door, which never stops. */
const animating = ({ shimmer = false } = {}) =>
  motion.live({ shimmer }) || winWipe.live || rewind.playing || clips.anyLive();

function handOver(keep = false){
  const w = winWipe.detach();
  if(play.cur < LEVELS.length - 1) load(play.cur + 1); else render();
  // Drawn again before the frame is shown: the load drew the new room with no wall over it.
  if(keep && w){
    winWipe.attach(w);
    render(); kick();
  }
}
const cancelAnim = () => {
  if(raf) cancelAnimationFrame(raf); raf = 0;
  motion.cancel(); winWipe.cancel(); rewind.end();
};

// ---- input ----
function act(dir){
  sound.unlock();
  if(play.won){ handOver(); return; }
  rewind.end();
  if(winWipe.live){ winWipe.cancel(); render(); }
  if(motion.refusing){ cancelAnim(); render(); }
  const res = play.press(dir, motion.moving);
  const r = res.r;
  if(res.kind === 'busy'){ motion.markBusy(); render(); }
  else if(res.kind === 'refused'){
    motion.refuse(dir, r);
    dbg?.refused(dir, r);
    dbg?.decor(play.decor);
    blocked = { cells:r.blame, reason:r.reason, dir };
    render();
  }
  else if(res.kind === 'armed'){ blocked = null; sound.beep(true); render(); }
  else {
    // A cut move ends its tape on the landed drawing, so its rewind jumps where this play did.
    if(motion.moving){ motion.land(); render(); }
    const kept = structuredClone(motion.stage);
    motion.play(dir, res);
    dbg?.action(play.moves, dir, res.prev.rac, r);
    dbg?.decor(play.decor);
    blocked = null;
    rewind.start(kept);
    if(play.won){ beat = res.beat; winWipe.start(); dbg?.note(`won in ${play.moves}`); }
    readLost();
    render();
  }
  tell(watch, now(), res);
}
function undo(){
  cancelAnim();
  const res = play.undo();
  if(res.kind === 'none') return;
  const tape = rewind.pop();
  blocked=null; motion.restore(tape.stage); clips.reset();
  if(tape.steps.length){ motion.snapDoor(); rewind.play(tape); }
  readLost(); render(); dbg?.note(`undo -> ${play.moves}`);
  tell(watch, now(), res);
}
function restart(){ load(play.cur, true); }
function load(i, again = false){
  cancelAnim(); motion.newRoom(); rewind.reset(); clips.reset();
  const res = play.load(i, again);
  blocked=null; beat=false;
  lostScan.start(play.state);
  dbg?.note(`-- ${pad(LEVELS[play.cur].id)} ${LEVELS[play.cur].name ?? ''} --`);
  motion.rest(play.cur + 1, play.decor); render();
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

// ---- render ----
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const SP = PIXEL ? createPixelSprites({ ctx, art: await loadPixelArt(new URL('./art/', import.meta.url)) })
  : createSprites({ ctx, cell: CS, pad: PAD });
const clips = createClips({ pixel: PIXEL, art: SP, stage: () => motion.stage, clock: clockMs, since, frame: FRAME_MS });
const motion = createMotion({ clips, pixel: PIXEL, state: () => play.state, clock: clockMs, since, kick: () => kick(),
  onFlash: () => sound.beep(false) });
// In the pixel art the room is drawn off screen, and the screen frames it.
const screenCv = document.getElementById('screen');
const screen = PIXEL ? createScreen({ canvas: screenCv, art: await loadScreenArt(new URL('./art/', import.meta.url)), C: CS }) : null;
// Sized in device pixels: a canvas squeezed by a ratio that is not whole drops and doubles pixel columns.
const fitScreen = () => Object.assign(screenCv.style, { width: `${screenCv.width / devicePixelRatio}px`, height: `${screenCv.height / devicePixelRatio}px` });
if(PIXEL){ document.body.classList.add('pixel'); fitScreen(); addEventListener('resize', fitScreen); }
if(PIXEL) for(const job of tracings()) askIdle(job);
const rewind = createRewind({ ctx, pixel: PIXEL, clock: clockMs, since, kick: () => kick() });
const painter = createBoardPaint({ ctx, art: SP, clips, cs: CS, pad: PAD, pixel: PIXEL });

function render(){
  if(rewind.playing){ paintHud(); return; }
  const s=play.state;
  if(PIXEL) motion.syncDoor();
  cv.width=s.cols*CS; cv.height=s.rows*CS;
  painter.paint({
    state:s, board:motion.board, stage:motion.stage, sprites:motion.stage.sprites,
    ...motion.view(), moving: motion.moving,
    armed: play.armed, blocked,
    w:cv.width, h:cv.height, cs:CS,
    leaving: winWipe.leaving(), leave: winWipe.live ? winWipe.style : null, wall: winWipe.live ? winWipe.drawWall : null,
  });
  if(rewind.recording) rewind.record(winWipe.started);
  paintHud();
  if(PIXEL) present();
}

function paintHud(){
  hud.paint({ level: LEVELS[play.cur], state: play.state, moves: play.moves, won: play.won, armed: play.armed,
    busy: motion.busy, blocked, beat, lost: lostScan.lost });
}

function present(){
  const L = LEVELS[play.cur];
  screen.paint({ room: cv, cols: play.state.cols, rows: play.state.rows, left: `${pad(L.id)}  ${L.name ?? ''}`, right: `Moves ${play.moves}  Par ${L.par}`,
    ...crowPanel.screenView(),
    wall: winWipe.live ? (c, w, h) => winWipe.drawWall(c, { w, h }) : null });
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
  stage: () => motion.stage,
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
  run: () => { heldMs = null; kick(); },
  step: (n = 1) => { heldMs += n * 1000 / FRAME_RATE; cancelAnimationFrame(raf); tick(); },
});
load(0);
crowPanel.start({ crow, watch, debug: crowDbg, state: () => play.state });
