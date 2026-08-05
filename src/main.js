// Presentation and input only — the rules live in src/rules.js.
// ES modules need http://, so run ./run.sh rather than opening the file.
import {
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY, JUG, FURNITURE,
  MOVE, DIRS,
  explain, isWon, bagsLeft, trashHeld, fan, inGrid, cell, cloneState, isMultiCell,
} from './rules.js';
import { parseLevelPack, toState } from './format.js';
import { createSprites, drawOccupant, exitArrowDir, PALETTE as C } from './sprites.js';
// stage owns the objects, their motion and its envelopes
import {
  CART, COUCH, RACCOON, SPLASH, advance, applyStep, easeOut, rollEase, settle, stageFrom,
  timeline,
} from './stage.js';

const CANF = CAN_FULL, CANE = CAN_EMPTY;
const CS=76, PAD=9;
// The occupant codes the sprite dispatcher needs; it takes them rather than importing the
// rules, so the art has no idea a rulebook exists.
const CODES = { BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY, JUG };

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
};
// Name the thing in the way rather than saying "blocked": the red cell already carries that.
const OBSTACLE = { [BAG]:"a bag", [CANF]:"a full can", [CANE]:"a can", [TRASH]:"your own trash",
  [BIN]:"the recycle bin", [STACK]:"a bag on a can", [WHEELIE]:"a wheelie bin",
  [WHEELIE_EMPTY]:"an empty wheelie bin", [JUG]:"the water jug", [FURNITURE]:"the couch" };
function whyText(b){
  const base = WHY[b.reason];
  // 'water' covers three different noes now that the canal takes objects: he won't wade in,
  // he won't wade in AFTER something, and the jug won't pour on anything but dry ground.
  // Which one it is depends on where the blame landed and what is sitting there.
  if(b.reason === 'water'){
    const [bx,by] = b.cells[0] ?? [];
    if(bx === undefined || !inGrid(state,bx,by)) return base;
    const [dx,dy] = DIRS[b.dir];
    if(bx !== state.rac.x+dx || by !== state.rac.y+dy) return WHY.pour;
    return cell(state,bx,by).o === NONE ? WHY.water : WHY.afloat;
  }
  if(b.reason !== 'fan' && b.reason !== 'canRoom') return base;
  const [x,y] = b.cells[0] ?? [];
  if(x === undefined || !inGrid(state,x,y)) return `${base} — the wall's in the way`;
  const c = cell(state,x,y);
  const what = c.wall ? "the wall" : (OBSTACLE[c.o] ?? "something");
  return `${base} — ${what} is in the way`;
}

let LEVELS = [], cur=0, state=null, start=null, history=[], moves=0, won=false;
let blocked = null;   // { cells, reason, dir } — cleared by the next legal action
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
//
// Time is milliseconds per CELL of travel, so a bin crossing five cells takes five times as
// long as one crossing a single cell rather than being crammed into the same beat.
const CELL_MS = 110;
let stage = null, board = null, anim = null;
const slow = matchMedia('(prefers-reduced-motion: reduce)');

function startMv(prev, r){
  stage = stageFrom(prev, cur + 1);
  board = prev;
  anim = { segs: timeline(r, CELL_MS), si: 0, k: -1, t0: performance.now() };
  if(!raf) raf = requestAnimationFrame(tick);
}

/** Walk the clock; returns false once the whole action has played out. */
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
  advance(stage, slow.matches ? 0 : d - k);
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

// ---- the win: a short confetti blast, then straight on to the next room ----------------
// Seeded from the level index, so a replay of the same room throws the same confetti.
const WIN_MS = 1400, GRAV = 1500;
let party = null;

function startParty(){
  playWinChime();
  let h = ((cur + 1) * 2654435761) >>> 0;
  const rnd = () => ((h = (h * 1103515245 + 12345) >>> 0) / 4294967296);
  const cols = [C.red, C.yel, C.blu, C.tea, C.pnk];
  party = {
    t0: performance.now(), cx: (state.rac.x + .5) * CS, cy: (state.rac.y + .5) * CS,
    bits: Array.from({ length: 90 }, () => {
      const a = rnd() * Math.PI * 2, sp = 90 + rnd() * 330;
      return { vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 260, col: cols[(rnd() * 5) | 0],
               w: 4 + rnd() * 7, h: 3 + rnd() * 6, rot: rnd() * 6.3, vr: (rnd() - .5) * 16 };
    }),
  };
  if(!raf) raf = requestAnimationFrame(tick);
}
function drawParty(){
  const t = (performance.now() - party.t0) / 1000;
  ctx.save();
  ctx.globalAlpha = Math.min(1, Math.max(0, (WIN_MS / 1000 - t) / .45));   // fade on the way out
  for(const b of party.bits){
    ctx.save();
    ctx.translate(party.cx + b.vx * t, party.cy + b.vy * t + .5 * GRAV * t * t);
    ctx.rotate(b.rot + b.vr * t);
    ctx.fillStyle = b.col; ctx.fillRect(-b.w/2, -b.h/2, b.w, b.h);
    ctx.restore();
  }
  ctx.restore();
}

// One ticker for all three animations, so a rejection, a slide and a win blast cannot
// fight over `raf`.
function tick(){
  raf = 0;
  if(fx){
    const ph = fxPhase();
    if(ph && ph.flash && !fx.beeped){ fx.beeped = true; beep(false); }
    if(!ph) fx = null;
  }
  if(anim && !stepMv()) anim = null;
  if(party && performance.now() - party.t0 >= WIN_MS){ handOver(); return; }
  render();
  if(fx || anim || party) raf = requestAnimationFrame(tick);
}

// The blast ends and the next room loads; the chime is not consulted and keeps ringing.
function handOver(){
  party = null;
  if(cur < LEVELS.length - 1) load(cur + 1); else render();
}
// Cutting an action short still has to LAND it: the board was committed the moment the shove
// was legal, so the stage has to be walked through whatever steps are left or it would keep
// drawing pieces on cells they have already left.
const cancelAnim = () => {
  if(raf) cancelAnimationFrame(raf); raf = 0; fx = null; party = null;
  if(anim) landMv();
};

// ---- audio: a procedural two-tone "no" for a refused input.
let ac = null;
/** The context, created on first input — browsers refuse to start one before a gesture. */
function audio(){
  ac ??= new (window.AudioContext || window.webkitAudioContext)();
  if(ac.state === 'suspended') ac.resume();
  return ac;
}
function beep(ok){
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
  if(!winBuf) return;                          // not decoded yet: the room still hands over
  const src = audio().createBufferSource(), g = audio().createGain();
  src.buffer = winBuf;
  g.gain.value = WIN_GAIN;
  src.connect(g); g.connect(ac.destination);
  src.start();                                 // no handle kept: it finishes on its own
}

// ---- input ----
// Arming (`:arm on`, per level). Input layer only — see format.js.
const arming = () => LEVELS[cur].arm === true;

function act(dir){
  audio(); primeWinChime();              // first input is the gesture that unlocks audio
  if(won){ handOver(); return; }         // done admiring it? go straight to the next room
  if(fx || anim){ cancelAnim(); render(); }   // any input skips an animation already playing
  const r = explain(state, dir, { trace: true });

  if(!r.ok){                       // refused — play the whole no, then rewind it
    blocked = { cells:r.blame, reason:r.reason, dir };
    armed = null; startFx(dir, r); render(); return;
  }
  if(arming() && r.kind !== MOVE && armed !== dir){
    armed = dir; blocked = null;    // aimed, not committed
    beep(true); render(); return;
  }
  const prev = state;
  history.push(cloneState(state)); state = r.next; moves++;
  blocked = null; armed = null;
  startMv(prev, r);
  if(isWon(state)){ won = true; startParty(); }
  render();
}
function undo(){
  cancelAnim();
  if(history.length){ state=history.pop(); moves--; won=false; blocked=null; armed=null; rest(); render(); }
}
function restart(){ load(cur); }
function load(i){
  cancelAnim(); fxSeen = new Set();         // a new room earns the full explanation again
  cur=(i+LEVELS.length)%LEVELS.length;
  state=toState(LEVELS[cur]); start=state; history=[]; moves=0; won=false;
  blocked=null; armed=null;
  rest(); render();
}
/** The stage at rest on the current board — every jump that is not an action goes through here. */
function rest(){ anim = null; board = state; stage = stageFrom(state, cur + 1); }

// ---- render ----
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
const SP = createSprites({ ctx, cell: CS, pad: PAD });
// Couches under carts, carts under loose things, cargo over the cart it rides, him on top.
const LAYER = sp => sp.kind === COUCH ? 0 : sp.kind === CART ? 1
  : sp.kind === RACCOON ? 4 : (sp.parent === null ? 2 : 3);

function render(){
  const s=state, b=board ?? state;
  const ph = fx ? fxPhase() : null;
  const fxCells = new Set((ph && fx.showBurst ? fx.cells : []).map(([x,y])=>`${x},${y}`));
  cv.width=s.cols*CS; cv.height=s.rows*CS;
  ctx.clearRect(0,0,cv.width,cv.height);
  // Terrain only — the ground is the one thing that is still a property of the square. Read
  // from the board the animation is currently on, so a canal fills as the trash lands in it.
  for(let y=0;y<b.rows;y++) for(let x=0;x<b.cols;x++){
    const c=cell(b,x,y); if(c.wall) continue;
    // A filled cell is floor now — things rest on it, he walks it — but it keeps the canal's
    // dark rim so you can still see where the water was and what it cost to cross.
    if(c.water)       SP.water(x,y,false);
    else if(c.bridge) SP.water(x,y,true,hash(x,y));
    else              SP.floor(x,y);
    if(c.exit) SP.exit(x,y, bagsLeft(s)===0 && trashHeld(s)===0, exitArrowDir(s.cols,s.rows,x,y));
  }
  // the debris of a burst that is being refused: it flies out, reaches the cell that
  // won't take it, and retracts. None of it is board state.
  if(ph) for(const [fxx,fxy] of (fx.showBurst ? fx.cells : []))
    if(inGrid(s,fxx,fxy) && !cell(s,fxx,fxy).wall)
      SP.trash(fxx,fxy,{ seed:hash(fxx,fxy), k:ph.burst, src:[fx.bx,fx.by] });

  // Everything else is a sprite with a position of its own, so a couch comes out as one slab
  // with no seam, cargo is carried rather than redrawn, and a bin's bag leaves the bin.
  for(const sp of [...stage.sprites].sort((a,b)=>LAYER(a)-LAYER(b))){
    if(sp.kind === RACCOON){
      // A refusal is a lunge from where he stands, not travel — the stage knows nothing of it.
      if(ph){ const k = ph.lunge*0.42; SP.raccoon(s.rac.x+fx.dx*k, s.rac.y+fx.dy*k); }
      else SP.raccoon(sp.x, sp.y);
    }
    else if(sp.kind === COUCH) SP.furniture(sp.cells, sp.x, sp.y);
    else if(sp.kind === CART)  SP.cart(sp.cells, sp.x, sp.y);
    else if(sp.kind === SPLASH) SP.splash(sp.x, sp.y);
    else drawOccupant(SP, CODES, sp.kind, sp.x, sp.y, {
      seed: sp.seed,
      // a bag mid-refusal deflates where it stands; a torn one deflates as its fan grows
      k: sp.dying ? (sp.deflate ?? 1)
        : ph && fx.bx===Math.round(sp.x) && fx.by===Math.round(sp.y) ? 1-ph.burst : 1,
    });
  }

  // Fan preview, over everything including the exit sign. Always pale yellow: it answers
  // "where would this land", which has the same answer whether or not the strike is legal.
  // Red belongs to the blocking cell alone, and only once you have tried. Arming narrows
  // the preview to the aimed direction so two adjacent bags do not light ten cells at once.
  const red = new Set((blocked?.cells ?? []).map(([x,y])=>`${x},${y}`));
  for(const dir of (ph || anim ? [] : armed ? [armed] : ['u','d','l','r'])){
    const [dx,dy]=({u:[0,-1],d:[0,1],l:[-1,0],r:[1,0]})[dir];
    const bx=s.rac.x+dx, by=s.rac.y+dy;
    if(!inGrid(s,bx,by) || cell(s,bx,by).o!==BAG) continue;   // fan preview: bags only
    for(const [fx,fy] of fan(bx,by,dx,dy)){
      if(!inGrid(s,fx,fy) || red.has(`${fx},${fy}`)) continue;   // never tint under the red
      ctx.fillStyle="rgba(255,207,0,.45)";
      ctx.fillRect(fx*CS+1,fy*CS+1,CS-2,CS-2);
      ctx.strokeStyle="rgba(224,170,0,.85)"; ctx.lineWidth=2;
      ctx.strokeRect(fx*CS+2,fy*CS+2,CS-4,CS-4);
    }
  }

  // The armed bag gets a ring + a direction arrow, so "what am I about to do" is on the
  // board and not only in the HUD.
  if(armed){
    const [dx,dy]=({u:[0,-1],d:[0,1],l:[-1,0],r:[1,0]})[armed];
    const ax=s.rac.x+dx, ay=s.rac.y+dy, o=cell(s,ax,ay).o;
    // For a push, show where the can lands (and, for a full can, where its bag lands) —
    // the push is as permanent as the tear, so it gets the same look-before-you-commit.
    if(o===CANE||o===CANF){
      drawLanding(ax+dx, ay+dy);
      if(o===CANF) drawLanding(ax+2*dx, ay+2*dy);
    }
    drawAim(ax, ay, dx, dy);
  }

  // Blocked: mark the exact cells to blame, in red, and say why.
  if(blocked && (!ph || ph.flash)){
    for(const [bx,by] of blocked.cells) drawBlocked(bx,by);
    if(!blocked.cells.length) drawEdgeBar(s.rac.x, s.rac.y, blocked.dir);
  }

  if(party) drawParty();   // over everything

  document.getElementById('moves').textContent=moves;
  document.getElementById('par').textContent=LEVELS[cur].par;
  document.getElementById('lvlname').textContent=`${LEVELS[cur].id} — ${LEVELS[cur].name}`;
  const w=document.getElementById('warn');
  w.textContent = blocked ? `✕ ${whyText(blocked)}` : '';
  w.className = 'warn'+(blocked?' show':'');
  const am=document.getElementById('arm');
  am.textContent = armed ? `${({u:'↑',d:'↓',l:'←',r:'→'})[armed]} again to ${armedVerb()}` : '';
  am.className = 'arm'+(armed?' show':'');
  document.querySelectorAll('.tab').forEach((t,i)=>t.className='tab'+(i===cur?' on':''));
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
// A stand-in seed per cell, until main.js runs off the stage and every pile carries its own.
function hash(x,y){ return ((x*73856093)^(y*19349663))>>>0; }


// ---- wire up ----
const KEY={ArrowUp:'u',ArrowDown:'d',ArrowLeft:'l',ArrowRight:'r',
  w:'u',s:'d',a:'l',d:'r',W:'u',S:'d',A:'l',D:'r'};
addEventListener('keydown',e=>{
  if(e.key in KEY){ e.preventDefault(); act(KEY[e.key]); }
  else if(e.key==='u'||e.key==='U'){ undo(); }
  else if(e.key==='r'||e.key==='R'){ restart(); }
});
// One delegated listener for every button under the board, so the layout is markup-only.
const MOVEACT={up:'u',down:'d',left:'l',right:'r'};
document.getElementById('controls').addEventListener('click',e=>{
  const btn=e.target.closest('[data-act]'); if(!btn) return;
  const a=btn.dataset.act;
  if(a in MOVEACT){ act(MOVEACT[a]); }
  else if(a==='undo')undo(); else if(a==='restart')restart();
  else if(a==='next')load(cur+1); else if(a==='prev')load(cur-1);
});

// Levels are data on disk, in the same pack the verifier checks. Fail loudly.
const res = await fetch('../levels/act1.tt');
if(!res.ok) throw new Error(`cannot load levels/act1.tt (${res.status}) — serve with ./run.sh`);
LEVELS = parseLevelPack(await res.text()).levels;
const sfx = await fetch('../sfx/win-chime.mp3');
if(!sfx.ok) throw new Error(`cannot load sfx/win-chime.mp3 (${sfx.status}) — serve with ./run.sh`);
winBytes = await sfx.arrayBuffer();
const tabs=document.getElementById('tabs');
LEVELS.forEach((L,i)=>{ const b=document.createElement('button'); b.className='tab'; b.textContent=L.id;
  b.onclick=()=>load(i); tabs.appendChild(b); });
load(0);
