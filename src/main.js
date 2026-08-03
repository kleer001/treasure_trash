// Presentation and input only — the rules live in src/rules.js.
// ES modules need http://, so run ./run.sh rather than opening the file.
import {
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY, JUG, FURNITURE,
  MOVE, PUSH, TEAR, DIRS,
  explain, isWon, bagsLeft, fan, inGrid, cell, cloneState, pieceCells, isMultiCell,
} from './rules.js';
import { parseLevelPack, toState } from './format.js';

const CANF = CAN_FULL, CANE = CAN_EMPTY;
const CS=76, PAD=9;
const C = { red:"#ff4b3e", yel:"#ffcf00", blu:"#2d7dd2", tea:"#17c3b2", pnk:"#ff5da2", ink:"#1a1a1a",
  grn:"#2e9e5b" };   // exit-sign green — ISO 3864 "safe condition", not a Memphis accent

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
// An accepted action is already committed to `state` by the time this runs; the animation
// only remembers where the pieces WERE, so nothing ever teleports between cells. `hide`
// names the cells whose occupant the animation draws itself, so nothing is painted twice.
const MV = { [MOVE]:120, [PUSH]:175, [TEAR]:230 };
const easeOut = t => 1 - Math.pow(1 - t, 3);
let mv = null;

function startMv(prev, kind, dir){
  const [dx,dy] = DIRS[dir];
  const bx = prev.rac.x + dx, by = prev.rac.y + dy;      // the cell he acts into
  const m = { t0: performance.now(), dur: MV[kind], hide: new Set(), parts: [],
              rac: [prev.rac.x, prev.rac.y, state.rac.x, state.rac.y] };
  if(kind === TEAR){
    m.parts.push({ what:'bag', from:[bx,by], to:[bx,by], burst:true });
    for(const [tx,ty] of fan(bx,by,dx,dy)){
      m.hide.add(`${tx},${ty}`);
      m.parts.push({ what:'trash', from:[tx,ty], to:[tx,ty], src:[bx,by] });
    }
  } else if(kind === PUSH && isMultiCell(cell(prev,bx,by).o)){
    // A multi-cell piece is one body, so it slides as one. The per-cell diff below would
    // read a translated couch as several unrelated pieces all flying out of the shove cell,
    // which is the one shape it cannot describe.
    const pc = cell(prev,bx,by), own = pieceCells(prev, pc.pid);
    for(const [x,y] of own){ m.hide.add(`${x},${y}`); m.hide.add(`${x+dx},${y+dy}`); }
    m.parts.push({ what:'body', o:pc.o, cells:own, dx, dy });
  } else if(kind === PUSH){
    // Whatever the shove produced, slide it out of the cell that was shoved. Reading the
    // two boards rather than naming the piece keeps this correct for every pushable —
    // a can and its ejected bag, a bin and the trash it drops, a wheelie bin that rolls
    // clean across the room and leaves its bag behind.
    for(let y=0; y<state.rows; y++) for(let x=0; x<state.cols; x++){
      const now = cell(state,x,y).o;
      if(now === NONE || now === cell(prev,x,y).o) continue;
      m.hide.add(`${x},${y}`);
      m.parts.push({ what:'piece', o:now, from:[bx,by], to:[x,y] });
    }
  }
  mv = m;
  if(!raf) raf = requestAnimationFrame(tick);
}
/** Eased progress of the running move, or null once it has played out. */
function mvT(){ const e = (performance.now() - mv.t0) / mv.dur; return e >= 1 ? null : easeOut(e); }

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
  if(mv && mvT() === null) mv = null;
  if(party && performance.now() - party.t0 >= WIN_MS){ handOver(); return; }
  render();
  if(fx || mv || party) raf = requestAnimationFrame(tick);
}

// The blast ends and the next room loads; the chime is not consulted and keeps ringing.
function handOver(){
  party = null;
  if(cur < LEVELS.length - 1) load(cur + 1); else render();
}
const cancelAnim = () => { if(raf) cancelAnimationFrame(raf); raf = 0; fx = null; mv = null; party = null; };

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
// Arming (`:arm on`, per level) makes every board-changing action ask twice; walking is
// never armed, because it is the only verb that writes nothing to the board. See format.js.
const arming = () => LEVELS[cur].arm === true;

function act(dir){
  audio(); primeWinChime();              // first input is the gesture that unlocks audio
  if(won){ handOver(); return; }         // done admiring it? go straight to the next room
  if(fx || mv){ cancelAnim(); render(); }   // any input skips an animation already playing
  const r = explain(state, dir);

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
  startMv(prev, r.kind, dir);
  if(isWon(state)){ won = true; startParty(); }
  render();
}
function undo(){ cancelAnim(); if(history.length){ state=history.pop(); moves--; won=false; blocked=null; armed=null; render(); } }
function restart(){ load(cur); }
function load(i){
  cancelAnim(); fxSeen = new Set();         // a new room earns the full explanation again
  cur=(i+LEVELS.length)%LEVELS.length;
  state=toState(LEVELS[cur]); start=state; history=[]; moves=0; won=false;
  blocked=null; armed=null;
  render();
}

// ---- render ----
const cv=document.getElementById('cv'), ctx=cv.getContext('2d');
function render(){
  const s=state;
  const ph = fx ? fxPhase() : null;
  const fxCells = new Set((ph && fx.showBurst ? fx.cells : []).map(([x,y])=>`${x},${y}`));
  cv.width=s.cols*CS; cv.height=s.rows*CS;
  ctx.clearRect(0,0,cv.width,cv.height);
  for(let y=0;y<s.rows;y++) for(let x=0;x<s.cols;x++){
    const c=cell(s,x,y); if(c.wall) continue;
    // Three terrains, and the occupant draws on top of whichever it is. A filled cell is
    // floor now — things rest on it, he walks it — but it keeps the canal's dark rim so you
    // can still see where the water was and what it cost to cross.
    if(c.water)       drawWater(x,y,false);
    else if(c.bridge) drawWater(x,y,true);
    else              drawFloor(x,y);
    if(c.exit) drawExit(x,y, bagsLeft(s)===0);
    if(mv && mv.hide.has(`${x},${y}`)) continue;   // in flight — the move animation draws it
    if(isMultiCell(c.o)) continue;                 // drawn whole, after the loop
    // a bag mid-refusal deflates; everything else draws at rest
    drawOccupant(c.o, x, y, ph && fx.bx===x && fx.by===y ? 1-ph.burst : 1);
  }
  // Multi-cell pieces are drawn per PIECE rather than per cell, so a couch comes out as one
  // slab with no seam down the middle — which is the only way "one couch" reads differently
  // from "two couches touching", and the rules very much tell them apart.
  for(const pid of new Set(s.cells.flat().filter(c => c.pid !== undefined).map(c => c.pid))){
    const own = pieceCells(s, pid);
    if(mv && own.some(([x,y]) => mv.hide.has(`${x},${y}`))) continue;
    drawFurniture(own);
  }
  // the debris of a burst that is being refused: it flies out, reaches the cell that
  // won't take it, and retracts. None of it is board state.
  if(ph) for(const [fxx,fxy] of (fx.showBurst ? fx.cells : []))
    if(inGrid(s,fxx,fxy) && !cell(s,fxx,fxy).wall) drawTrash(fxx,fxy, ph.burst, [fx.bx,fx.by]);

  // Pieces in flight: a torn bag deflating as its fan grows, a shoved can crossing the gap,
  // an ejected bag sailing past it. Drawn from where they were toward where they now are.
  if(mv){
    const t = mvT() ?? 1;
    for(const p of mv.parts){
      if(p.what==='body'){ drawFurniture(p.cells, p.dx*t, p.dy*t); continue; }  // one body, one offset
      const x = p.from[0]+(p.to[0]-p.from[0])*t, y = p.from[1]+(p.to[1]-p.from[1])*t;
      if(p.what==='trash')      drawTrash(p.from[0], p.from[1], t, p.src);  // integer cell: stable colours
      else if(p.what==='bag')   drawBag(x, y, p.burst ? 1-t : 1);
      else if(p.what==='piece') drawOccupant(p.o, x, y);
    }
  }

  if(ph){
    const k = ph.lunge*0.42;
    drawRaccoon(s.rac.x+fx.dx*k, s.rac.y+fx.dy*k);
  } else if(mv){
    const t = mvT() ?? 1, [ax,ay,bx,by] = mv.rac;
    drawRaccoon(ax+(bx-ax)*t, ay+(by-ay)*t);
  } else drawRaccoon(s.rac.x,s.rac.y);

  // Fan preview, over everything including the exit sign. Always pale yellow: it answers
  // "where would this land", which has the same answer whether or not the strike is legal.
  // Red belongs to the blocking cell alone, and only once you have tried. Arming narrows
  // the preview to the aimed direction so two adjacent bags do not light ten cells at once.
  const red = new Set((blocked?.cells ?? []).map(([x,y])=>`${x},${y}`));
  for(const dir of (ph || mv ? [] : armed ? [armed] : ['u','d','l','r'])){
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

// One place that draws an occupant, shared by the board loop and the move animation.
// Coordinates may be fractional.
function drawOccupant(o, x, y, k=1){
  if(o===TRASH)              drawTrash(x,y);
  else if(o===BAG)           drawBag(x,y,k);
  else if(o===CANF)          drawCan(x,y,true);
  else if(o===CANE)          drawCan(x,y,false);
  else if(o===BIN)           drawRecycleBin(x,y);
  else if(o===STACK)         drawStack(x,y);
  else if(o===WHEELIE)       drawWheelie(x,y,true);
  else if(o===WHEELIE_EMPTY) drawWheelie(x,y,false);
  else if(o===JUG)           drawJug(x,y);
}

function px(x){return x*CS}
function drawFloor(x,y){ ctx.fillStyle="#fff"; ctx.strokeStyle="#e6e6e2"; ctx.lineWidth=1;
  ctx.fillRect(px(x)+1,px(y)+1,CS-2,CS-2); ctx.strokeRect(px(x)+1.5,px(y)+1.5,CS-3,CS-3); }
// Open water is drawn darker than anything else on the board, with ripples, so it reads as
// not-walkable. A filled cell keeps the dark rim and takes the ordinary trash glyph.
function drawWater(x,y,filled){
  const x0=px(x), y0=px(y);
  ctx.fillStyle = filled ? "#7fb7c4" : "#2e6f8e";
  ctx.fillRect(x0+1,y0+1,CS-2,CS-2);
  if(filled){ drawTrash(x,y); return; }
  ctx.strokeStyle="rgba(255,255,255,.45)"; ctx.lineWidth=2; ctx.lineCap="round";
  for(let i=1;i<=2;i++){
    const yy=y0+CS*(i/3);
    ctx.beginPath();
    ctx.moveTo(x0+6,yy);
    ctx.quadraticCurveTo(x0+CS/3,yy-4, x0+CS/2,yy);
    ctx.quadraticCurveTo(x0+2*CS/3,yy+4, x0+CS-6,yy);
    ctx.stroke();
  }
}
// The way out, drawn as what it is: an emergency exit sign. White-on-green is the ISO 3864
// "safe condition" coding (ISO 7010 E002). Lit = every bag torn; unlit = work left to do.
// The arrow points at the nearest board edge — the direction he's actually leaving in.
function exitArrowDir(s,x,y){
  const d=[[y,[0,-1]],[s.rows-1-y,[0,1]],[x,[-1,0]],[s.cols-1-x,[1,0]]];
  return d.reduce((a,b)=>b[0]<a[0]?b:a)[1];
}
function drawExit(x,y,lit){
  const s=state, [dx,dy]=exitArrowDir(s,x,y);
  const x0=px(x), y0=px(y), m=8, w=CS-2*m, cx=x0+CS/2, cy=y0+CS/2;
  ctx.save();
  // the sign plate
  ctx.fillStyle = lit ? C.grn : "rgba(46,158,91,.12)";
  ctx.fillRect(x0+m, y0+m, w, w);
  if(!lit){
    ctx.strokeStyle="rgba(46,158,91,.6)"; ctx.lineWidth=2; ctx.setLineDash([5,4]);
    ctx.strokeRect(x0+m+1, y0+m+1, w-2, w-2); ctx.setLineDash([]);
  }
  const fg = lit ? "#fff" : "rgba(46,158,91,.55)";
  // legend
  ctx.fillStyle=fg;
  ctx.font="700 12px -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
  ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText("EXIT", cx, y0+m+11);
  // arrow, rotated to point out of the room
  ctx.translate(cx, cy+7); ctx.rotate(Math.atan2(dy,dx));
  const a=w*0.30, H=w*0.24, h=w*0.09;
  ctx.beginPath();
  ctx.moveTo(a,0); ctx.lineTo(0,-H); ctx.lineTo(0,-h); ctx.lineTo(-a,-h);
  ctx.lineTo(-a,h); ctx.lineTo(0,h); ctx.lineTo(0,H); ctx.closePath();
  ctx.fill();
  ctx.restore();
}
function hash(x,y){ return ((x*73856093)^(y*19349663))>>>0; }
// `src` is the cell of the bag this debris came out of. While k<1 every speck is in
// flight from that bag's centre to its resting place, so a burst throws its mess outward
// across the board instead of fading up in place. At rest (k=1) src is irrelevant.
function drawTrash(x,y,k=1,src=null){
  if(k<=0) return;
  const cols=[C.red,C.yel,C.blu,C.tea,C.pnk]; let h=hash(x,y);
  const x0=px(x), y0=px(y), M=16, R=CS-2*M;   // M = margin from cell edge; dot centers stay inside [M, CS-M]
  const flying = k<1 && src;
  ctx.save();
  // Settled trash is clipped to its own cell — a hard guarantee it never bleeds. Debris
  // still in the air must cross the cells between the bag and where it lands, so the clip
  // comes off for exactly as long as it is flying.
  if(!flying){ ctx.beginPath(); ctx.rect(x0+2, y0+2, CS-4, CS-4); ctx.clip(); }
  const sx = flying ? px(src[0])+CS/2 : x0+CS/2;
  const sy = flying ? px(src[1])+CS/2 : y0+CS/2;
  for(let i=0;i<6;i++){ h=(h*1103515245+12345)>>>0;
    const ox=M+(h%R), oy=M+((h>>8)%R), r=3+((h>>16)%3);          // center in [16,59], radius 3–5 -> span [11,64] of 76
    ctx.fillStyle=cols[(h>>4)%5];
    const ax=sx+(x0+ox-sx)*k, ay=sy+(y0+oy-sy)*k;
    ctx.beginPath(); ctx.arc(ax, ay, r*Math.max(.25,k), 0, 7); ctx.fill();
  }
  ctx.restore();
}
function drawBag(x,y,k=1){
  if(k<=0) return;
  const cx0=px(x)+CS/2, cy0=px(y)+CS/2;
  ctx.save(); ctx.translate(cx0,cy0); ctx.scale(k,k); ctx.translate(-cx0,-cy0);
  drawBagBody(x,y);
  ctx.restore();
}
function drawBagBody(x,y){
  const cx=px(x)+CS/2, top=px(y)+PAD+8, w=CS-2*PAD-6, h=CS-2*PAD-8;
  ctx.fillStyle="#161616";
  ctx.beginPath();
  ctx.moveTo(cx-w/2, top+8);
  ctx.quadraticCurveTo(cx-w/2, top+h, cx, top+h);
  ctx.quadraticCurveTo(cx+w/2, top+h, cx+w/2, top+8);
  ctx.lineTo(cx+w/2-4, top+2); ctx.lineTo(cx+6, top+6);
  ctx.lineTo(cx-6, top+6); ctx.lineTo(cx-w/2+4, top+2); ctx.closePath(); ctx.fill();
  // shiny glint
  ctx.fillStyle=C.yel; drawStar(cx+6, top+h*0.5, 5);
}
function drawStar(cx,cy,r){ ctx.beginPath();
  for(let i=0;i<8;i++){ const a=i*Math.PI/4, rr=i%2?r*.4:r; ctx.lineTo(cx+Math.cos(a)*rr,cy+Math.sin(a)*rr);} ctx.closePath(); ctx.fill(); }
function drawCan(x,y,full){
  const cx=px(x)+CS/2, w=CS-2*PAD-8, top=px(y)+PAD+6, h=CS-2*PAD-6;
  // body
  ctx.fillStyle="#b9c0c7"; ctx.strokeStyle="#7d858c"; ctx.lineWidth=2;
  ctx.fillRect(cx-w/2, top, w, h); ctx.strokeRect(cx-w/2, top, w, h);
  // ridges
  ctx.strokeStyle="#9aa2a9"; ctx.lineWidth=1;
  for(let i=1;i<3;i++){ ctx.beginPath(); ctx.moveTo(cx-w/2, top+i*h/3); ctx.lineTo(cx+w/2, top+i*h/3); ctx.stroke(); }
  // rim / top
  ctx.fillStyle="#cfd5da"; ctx.strokeStyle="#7d858c"; ctx.lineWidth=2;
  ctx.beginPath(); ctx.ellipse(cx, top, w/2, 6, 0,0,7); ctx.fill(); ctx.stroke();
  if(full){ // black bag bulging out
    ctx.fillStyle="#161616";
    ctx.beginPath(); ctx.ellipse(cx, top-3, w/2-3, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle=C.yel; drawStar(cx+5, top-4, 4);
  } else { // open dark mouth
    ctx.fillStyle="#3a4046"; ctx.beginPath(); ctx.ellipse(cx, top, w/2-3, 4, 0,0,7); ctx.fill();
  }
}
// The recycle bin: blue, with the chasing-arrows triangle. Blue reads as "recycling" the
// world over, and it keeps the bin from being mistaken for the grey metal can.
function drawRecycleBin(x,y){
  const cx=px(x)+CS/2, w=CS-2*PAD-6, top=px(y)+PAD+6, h=CS-2*PAD-8;
  ctx.save();
  ctx.fillStyle="#2d7dd2"; ctx.strokeStyle="#1b4f86"; ctx.lineWidth=2;
  ctx.fillRect(cx-w/2, top, w, h); ctx.strokeRect(cx-w/2, top, w, h);
  ctx.fillStyle="#4a95e0"; ctx.fillRect(cx-w/2, top, w, 7);        // lid
  ctx.strokeStyle="#1b4f86"; ctx.strokeRect(cx-w/2, top, w, 7);
  // chasing arrows, drawn as a plain triangle outline — legible at 76px, unlike the real mark
  ctx.strokeStyle="#fff"; ctx.lineWidth=3; ctx.lineJoin="round";
  const r=w*0.26, my=top+h*0.62;
  ctx.beginPath();
  for(let i=0;i<3;i++){ const a=-Math.PI/2 + i*2*Math.PI/3;
    ctx[i?'lineTo':'moveTo'](cx+Math.cos(a)*r, my+Math.sin(a)*r); }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

// The couch is drawn from its whole footprint, not a cell at a time: only the outer edges
// are stroked, because an internal seam would read as two couches. `ox`/`oy` offset the slide.
function drawFurniture(cells, ox=0, oy=0){
  const has = new Set(cells.map(([x,y])=>`${x},${y}`));
  const at = (x,y) => has.has(`${x},${y}`);
  const M = 6;
  ctx.save();
  ctx.fillStyle="#9c6249";
  for(const [cx,cy] of cells){
    const x0=px(cx+ox), y0=px(cy+oy);
    const l=at(cx-1,cy), r=at(cx+1,cy), u=at(cx,cy-1), d=at(cx,cy+1);
    ctx.fillRect(x0+(l?0:M), y0+(u?0:M), CS-(l?0:M)-(r?0:M), CS-(u?0:M)-(d?0:M));
  }
  ctx.fillStyle="rgba(255,255,255,.13)";           // one cushion per cell
  for(const [cx,cy] of cells)
    ctx.fillRect(px(cx+ox)+M+6, px(cy+oy)+M+6, CS-2*M-12, CS-2*M-12);
  ctx.strokeStyle="#5c382a"; ctx.lineWidth=2.5; ctx.lineCap="round";
  ctx.beginPath();
  for(const [cx,cy] of cells){
    const x0=px(cx+ox), y0=px(cy+oy), a=M, b=CS-M;
    if(!at(cx,cy-1)){ ctx.moveTo(x0+a,y0+a); ctx.lineTo(x0+b,y0+a); }
    if(!at(cx,cy+1)){ ctx.moveTo(x0+a,y0+b); ctx.lineTo(x0+b,y0+b); }
    if(!at(cx-1,cy)){ ctx.moveTo(x0+a,y0+a); ctx.lineTo(x0+a,y0+b); }
    if(!at(cx+1,cy)){ ctx.moveTo(x0+b,y0+a); ctx.lineTo(x0+b,y0+b); }
  }
  ctx.stroke();
  ctx.restore();
}

// The water jug, drawn as a cooler bottle. Its water uses the canal's exact blue; the thin
// white inner rim keeps it reading as translucent plastic against both floor and canal.
function drawJug(x,y){
  const bx=px(x)+CS/2-4, w=CS-2*PAD-16, top=px(y)+PAD+5, h=CS-2*PAD-8;
  const neck=w*0.32, shoulder=top+10, wl=top+h*0.34, bot=top+h;
  const L=bx-w/2, R=bx+w/2;
  const body=()=>{                                       // shoulders in to a short neck
    ctx.beginPath();
    ctx.moveTo(bx-neck/2, top); ctx.lineTo(bx+neck/2, top);
    ctx.lineTo(bx+neck/2, shoulder-4); ctx.lineTo(R, shoulder);
    ctx.lineTo(R, bot); ctx.lineTo(L, bot);
    ctx.lineTo(L, shoulder); ctx.lineTo(bx-neck/2, shoulder-4);
    ctx.closePath();
  };
  ctx.save();
  ctx.lineJoin="round"; ctx.lineCap="round";
  ctx.strokeStyle="#1b4f86"; ctx.lineWidth=2;
  // the handle first, so the body's fill covers where it meets the shoulder
  ctx.beginPath(); ctx.moveTo(R-2, shoulder+8);
  ctx.quadraticCurveTo(R+12, top+h*0.48, R-2, top+h*0.74); ctx.stroke();
  ctx.fillStyle="#1b4f86";                               // the cap, sitting on the neck
  ctx.fillRect(bx-neck/2-2, top-4, neck+4, 5);

  body();
  ctx.fillStyle="#cdeef9"; ctx.fill();                   // the air above the water: the light bit
  ctx.save(); ctx.clip();
  ctx.fillStyle="#2e6f8e"; ctx.fillRect(L, wl, w, bot-wl);
  // two moulded ribs, the way a ten-gallon bottle is banded
  ctx.strokeStyle="rgba(255,255,255,.65)"; ctx.lineWidth=2;
  for(const t of [0.60, 0.82]){
    const yy=top+h*t;
    ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke();
  }
  ctx.strokeStyle="rgba(255,255,255,.9)"; ctx.lineWidth=2;   // the waterline, brightest
  ctx.beginPath(); ctx.moveTo(L, wl+2); ctx.quadraticCurveTo(bx, wl-4, R, wl+2); ctx.stroke();
  ctx.strokeStyle="rgba(255,255,255,.85)"; ctx.lineWidth=4;  // clipped, so only the inner half lands
  body(); ctx.stroke();
  ctx.restore();
  ctx.strokeStyle="#1b4f86"; ctx.lineWidth=2;
  body(); ctx.stroke();
  ctx.restore();
}

// A loose bag riding a still-full can: the can sits low, the bag perches on top.
function drawStack(x,y){
  const cx=px(x)+CS/2, w=CS-2*PAD-14, top=px(y)+CS*0.46, h=CS*0.36;
  ctx.save();
  ctx.fillStyle="#b9c0c7"; ctx.strokeStyle="#7d858c"; ctx.lineWidth=2;
  ctx.fillRect(cx-w/2, top, w, h); ctx.strokeRect(cx-w/2, top, w, h);
  ctx.fillStyle="#cfd5da"; ctx.beginPath(); ctx.ellipse(cx, top, w/2, 5, 0,0,7); ctx.fill(); ctx.stroke();
  // the bag on top
  ctx.fillStyle="#161616";
  ctx.beginPath(); ctx.ellipse(cx, top-11, w/2+3, 11, 0, 0, 7); ctx.fill();
  ctx.fillStyle=C.yel; drawStar(cx+6, top-13, 4);
  ctx.restore();
}

// The wheelie bin: taller than the can, on wheels. Full = lid propped open by the bag inside.
function drawWheelie(x,y,full){
  const cx=px(x)+CS/2, w=CS-2*PAD-10, top=px(y)+PAD+9, h=CS-2*PAD-16;
  ctx.save();
  ctx.fillStyle="#3f7d4f"; ctx.strokeStyle="#255034"; ctx.lineWidth=2;
  ctx.fillRect(cx-w/2, top, w, h); ctx.strokeRect(cx-w/2, top, w, h);
  ctx.strokeStyle="#2f6a40"; ctx.lineWidth=1;
  for(let i=1;i<3;i++){ ctx.beginPath(); ctx.moveTo(cx-w/2, top+i*h/3); ctx.lineTo(cx+w/2, top+i*h/3); ctx.stroke(); }
  // wheels
  ctx.fillStyle="#22252a";
  ctx.beginPath(); ctx.arc(cx-w/2+5, top+h+4, 5, 0,7); ctx.arc(cx+w/2-5, top+h+4, 5, 0,7); ctx.fill();
  // lid, tilted open when there is a bag under it
  ctx.save();
  ctx.translate(cx-w/2, top);
  if(full) ctx.rotate(-0.42);
  ctx.fillStyle="#4f9a63"; ctx.strokeStyle="#255034"; ctx.lineWidth=2;
  ctx.fillRect(-2, -8, w+4, 8); ctx.strokeRect(-2, -8, w+4, 8);
  ctx.restore();
  if(full){                                    // the bag showing through the gap
    ctx.fillStyle="#161616";
    ctx.beginPath(); ctx.ellipse(cx+3, top-2, w/2-4, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle=C.yel; drawStar(cx+8, top-3, 4);
  }
  ctx.restore();
}

function drawRaccoon(x,y){
  const cx=x*CS+CS/2, cy=y*CS+CS/2, r=CS/2-PAD-4;   // x,y may be fractional mid-lunge
  // tail hint
  ctx.fillStyle="#8b8f95"; ctx.beginPath(); ctx.arc(cx+r*0.7, cy+r*0.6, r*0.5, 0,7); ctx.fill();
  ctx.fillStyle="#4a4e54"; ctx.beginPath(); ctx.arc(cx+r*0.95, cy+r*0.75, r*0.28, 0,7); ctx.fill();
  // ears
  ctx.fillStyle="#6b7076"; ctx.beginPath(); ctx.arc(cx-r*0.6,cy-r*0.7,r*0.32,0,7); ctx.arc(cx+r*0.6,cy-r*0.7,r*0.32,0,7); ctx.fill();
  // head
  ctx.fillStyle="#9aa0a6"; ctx.beginPath(); ctx.arc(cx,cy,r,0,7); ctx.fill();
  // mask band
  ctx.fillStyle="#2b2f34"; ctx.beginPath(); ctx.ellipse(cx,cy-r*0.05,r*0.95,r*0.42,0,0,7); ctx.fill();
  // muzzle
  ctx.fillStyle="#eceef0"; ctx.beginPath(); ctx.ellipse(cx,cy+r*0.45,r*0.5,r*0.35,0,0,7); ctx.fill();
  // eyes
  ctx.fillStyle="#fff"; ctx.beginPath(); ctx.arc(cx-r*0.35,cy-r*0.05,r*0.2,0,7); ctx.arc(cx+r*0.35,cy-r*0.05,r*0.2,0,7); ctx.fill();
  ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(cx-r*0.35,cy-r*0.02,r*0.1,0,7); ctx.arc(cx+r*0.35,cy-r*0.02,r*0.1,0,7); ctx.fill();
  // nose
  ctx.fillStyle="#111"; ctx.beginPath(); ctx.arc(cx,cy+r*0.35,r*0.12,0,7); ctx.fill();
}

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
