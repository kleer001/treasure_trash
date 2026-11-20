// Draws the room on the board canvas, in compositor layers.
import {
  BAG, CAN_FULL, CAN_EMPTY, BICYCLE, RUG, DIRS, exitLit, fan, inGrid, cell,
  GREASE, TAR, GLASS, COVERED, isBarrow, barrowFace, gripTarget, OCCUPANTS as CODES,
} from './rules.js';
import { drawOccupant, exitArrowDir, PALETTE as C } from './sprites.js';
import { segAt, travelAt } from './art/press.js';
import { radians } from './art/timing.js';
import { BAYER } from './art/spread.js';
import { createCompositor } from './compositor.js';
import { P } from './wipe.js';
import { CART, COUCH, RACCOON, SPLASH, cellSeed } from './stage.js';

const BANDS = ['couch','cart','loose','carried','raccoon'];
const bandOf = sp => sp.kind === COUCH ? 0 : sp.kind === CART ? 1
  : sp.kind === RACCOON ? 4 : (sp.parent === null ? 2 : 3);

/**
 * `art` is the sprite set, `clips` the clip player, `cs` the cell size and `pad` the margin a sprite
 * may draw past its cell, both in canvas px.
 *
 * A frame is `{ state, board, sprites, fx, ph, moving, armed, blocked, w, h, cs, pose, door,
 * leaving, leave, wall }`: `pose` is his press pose with `at`, its frame; `door` the door's roll;
 * `leaving` how far gone he is on a win and `leave` how he goes; `wall(ctx, f)` draws the wipe.
 */
export function createBoardPaint({ ctx, art: SP, clips, cs: CS, pad: PAD, pixel: PIXEL }){
  const CANF = CAN_FULL, CANE = CAN_EMPTY;
  const px = x => x*CS;

  // A 4x4 ordered dither: pixel art is all there or not there, so he goes a few pixels at a time.
  function leave(sp, k, style){
    const x0 = sp.x * CS, y0 = sp.y * CS;
    ctx.save();
    if(style === 'fade') ctx.globalAlpha = 1 - k;
    else if(style === 'hop'){
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

  // The nudge that clears a thing riding inside another is done here rather than in each drawing,
  // because no drawing knows how deep it is.
  function drawSprite(sp, f){
    const [jx, jy] = jolt(sp, f.pose);
    if(!sp.depth && !jx && !jy) return paintSprite(sp, f);
    ctx.save();
    ctx.translate(sp.depth * 2 + jx, sp.depth * 2 + jy);
    paintSprite(sp, f);
    ctx.restore();
  }

  // Returns the [x, y] offset in px for a sprite that a refused push has struck. Other sprites get [0, 0].
  function jolt(sp, pose){
    if(pose?.act !== 'stuck' || sp.kind === RACCOON) return [0, 0];
    const [dx, dy] = DIRS[pose.dir], tx = pose.x + dx, ty = pose.y + dy;
    if(!(sp.cells ?? [[0, 0]]).some(([cx, cy]) => sp.tx + cx === tx && sp.ty + cy === ty)) return [0, 0];
    const d = travelAt(pose.segs, pose.at) * CS;
    return [dx * d, dy * d];
  }

  // Everything but the ground is a sprite with a position of its own.
  function paintSprite(sp, f){
    const { state:s, ph, fx, pose } = f;
    // The tilt wraps the whole draw rather than being pushed into one sprite, so it costs the drawings nothing.
    if(sp.tilt){
      const [pvx, pvy] = sp.pivot ?? [sp.x + 0.5, sp.y + 1];
      const px = pvx * CS, py = pvy * CS;
      ctx.save();
      ctx.translate(px, py); ctx.rotate(radians(sp.tilt)); ctx.translate(-px, -py);
      const t = sp.tilt; sp.tilt = 0;
      paintSprite(sp, f);
      sp.tilt = t;
      ctx.restore();
      return;
    }
    if(sp.kind === RACCOON){
      const k = f.leaving;
      if(k !== null){ if(k < 1) leave(sp, k, f.leave); return; }
      if(pose){ SP.pressing(segAt(pose.segs, pose.at), pose.dir, pose.x, pose.y, { stay: pose.stay }); return; }
      // A refusal is a lunge from where he stands, not travel — the stage knows nothing of it.
      if(ph){ const k = ph.lunge*0.42; SP.raccoon(s.rac.x+fx.dx*k, s.rac.y+fx.dy*k, sp.heading); }
      else SP.raccoon(sp.x, sp.y, sp.heading);
    }
    else if(sp.kind === COUCH){
      if(sp.o === BICYCLE) SP.bicycle(sp.cells, sp.x, sp.y);
      else if(sp.o === RUG) SP.rug(sp.cells, sp.x, sp.y);
      // An open cabinet is one piece and two drawings: the cabinet, and the drawer standing out of it.
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
    else {
      const own = () => drawOccupant(SP, CODES, sp.kind, sp.x, sp.y, {
        seed: sp.seed, lie: sp.lie, wet: sp.soaks ? (sp.soak ?? 1) : 0, scraps: sp.scraps, soaked: sp.soaked,
        k: sp.dying ? (sp.deflate ?? 1)
          : ph && fx.bx===Math.round(sp.x) && fx.by===Math.round(sp.y) ? 1-ph.burst : 1,
      });
      if(clips.paint(sp, own)) return;
      if(sp.kind === SPLASH) SP.splash(sp.x, sp.y);
      else own();
    }
  }

  /** A falling sprite is scaled here rather than in each drawing, because `k` is a scale only some
   *  of them take. Vanishing between frames instead reads as the sprite being forgotten. */
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

  function drawLanding(s, x,y){
    if(!inGrid(s,x,y)) return;
    ctx.save();
    ctx.fillStyle="rgba(255,207,0,.32)"; ctx.fillRect(x*CS+1,y*CS+1,CS-2,CS-2);
    ctx.strokeStyle="rgba(224,170,0,.9)"; ctx.lineWidth=3; ctx.setLineDash([6,4]);
    ctx.strokeRect(x*CS+3,y*CS+3,CS-6,CS-6); ctx.setLineDash([]);
    ctx.restore();
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
  // Off the grid there is no cell to paint, so the wall of the alley itself is marked.
  function drawEdgeBar(x,y,dir){
    const [dx,dy]=DIRS[dir];
    const x0=px(x), y0=px(y), T=9;
    ctx.save(); ctx.fillStyle=C.red;
    if(dy<0) ctx.fillRect(x0+2,y0+1,CS-4,T);
    if(dy>0) ctx.fillRect(x0+2,y0+CS-1-T,CS-4,T);
    if(dx<0) ctx.fillRect(x0+1,y0+2,T,CS-4);
    if(dx>0) ctx.fillRect(x0+CS-1-T,y0+2,T,CS-4);
    ctx.restore();
  }

  const comp = createCompositor([
    { name:'clear', draw:(ctx,f)=>ctx.clearRect(0,0,f.w,f.h) },

    // Terrain only: the ground is the one thing that is still a property of the square. It is read
    // from the board the animation is currently on.
    { name:'terrain', draw:(ctx,f)=>{
      const s=f.state, b=f.board;
      if(PIXEL) SP.setBoard(b);
      const filling=new Map();
      for(const sp of f.sprites)
        if(sp.soaks) filling.set(`${Math.round(sp.tx)},${Math.round(sp.ty)}`, sp.fill ?? 1);
      for(let y=0;y<b.rows;y++) for(let x=0;x<b.cols;x++){
        const c=cell(b,x,y);
        if(c.wall){ if(PIXEL) SP.wall(x,y); continue; }
        const laid = clips.groundOn(x,y);
        if(laid){ SP.floor(x,y); laid(); }
        else if(c.water)              SP.water(x,y,false,0,filling.get(`${x},${y}`)??0);
        else if(c.bridge)             SP.water(x,y,true,cellSeed(x,y));
        else if(c.grate)              SP.grate(x,y);
        else if(c.oneway!==undefined) SP.oneway(x,y,c.oneway);
        else if(c.ter===GREASE)       SP.grease(x,y);
        else if(c.ter===TAR)          SP.tar(x,y);
        else if(c.ter===GLASS)        SP.glass(x,y);
        else if(c.ter===COVERED)      SP.covered(x,y);
        else                          SP.floor(x,y);
        if(c.exit) SP.exit(x,y, exitLit(s), exitArrowDir(s.cols,s.rows,x,y), f.door);
      }
    }},

    { name:'holds', draw:(ctx,f)=>{ for(const [a,b] of holdsOn(f)) SP.hold(...a, ...b); } },

    // The debris belongs to the animation: none of it is board state.
    { name:'debris', draw:(ctx,f)=>{
      if(!f.ph) return;
      const s=f.state;
      for(const [x,y] of (f.fx.showBurst ? f.fx.cells : []))
        if(inGrid(s,x,y) && !cell(s,x,y).wall)
          SP.trash(x,y,{ seed:cellSeed(x,y), k:f.ph.burst, src:[f.fx.bx,f.fx.by] });
    }},

    // Pixel sprites stand taller than their cell, so they are drawn back to front by the row their
    // foot is on, the band breaking a tie.
    // While he tears he is sorted on the row he pushes from, so the bag stays in front of him unless
    // he pushes it up.
    ...(PIXEL ? [{ name:'things', draw:(ctx,f)=>{
      const foot = sp => sp.kind === RACCOON && f.pose?.act === 'tear' ? f.pose.y + 0.03
        : sp.y + Math.max(0, ...(sp.cells ?? [[0,0]]).map(c => c[1])) + bandOf(sp) * 0.01;
      const items = f.sprites.filter(sp => !clips.owns(sp))
        .map(sp => [foot(sp), () => (sp.falls ? drawFalling : drawSprite)(sp,f)]);
      items.push(...clips.layers());
      for(const [, paint] of items.sort((a,b) => a[0] - b[0])) paint();
    }}, { name:'over', draw:(ctx,f)=>{
      const pose = f.pose;
      if(pose && pose.act !== 'tear' && f.leaving === null) SP.pressing(segAt(pose.segs, pose.at), pose.dir, pose.x, pose.y, { stay: pose.stay, over: true });
    }}] : BANDS.map((name,band)=>({ name, draw:(ctx,f)=>{
      for(const sp of f.sprites) if(bandOf(sp)===band) (sp.falls ? drawFalling : drawSprite)(sp,f);
    }}))),

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
        const [dx,dy]=DIRS[dir];
        const bx=s.rac.x+dx, by=s.rac.y+dy;
        if(!inGrid(s,bx,by) || cell(s,bx,by).o!==BAG) continue;
        for(const [fx,fy] of fan(bx,by,dx,dy)){
          if(!inGrid(s,fx,fy) || red.has(`${fx},${fy}`)) continue;
          ctx.fillStyle="rgba(255,207,0,.45)";
          ctx.fillRect(fx*cs+1,fy*cs+1,cs-2,cs-2);
          ctx.strokeStyle="rgba(224,170,0,.85)"; ctx.lineWidth=2;
          ctx.strokeRect(fx*cs+2,fy*cs+2,cs-4,cs-4);
        }
      }
    }},

    { name:'armed', draw:(ctx,f)=>{
      if(!f.armed) return;
      const s=f.state;
      const [dx,dy]=DIRS[f.armed];
      const ax=s.rac.x+dx, ay=s.rac.y+dy, o=cell(s,ax,ay).o;
      // A pending push shows its landing cells. A pending tear shows its fan.
      if(o===CANE||o===CANF){
        drawLanding(s, ax+dx, ay+dy);
        if(o===CANF) drawLanding(s, ax+2*dx, ay+2*dy);
      }
      drawAim(ax, ay, dx, dy);
    }},

    { name:'blocked', draw:(ctx,f)=>{
      const b=f.blocked;
      if(!b || (f.ph && !f.ph.flash)) return;
      for(const [bx,by] of b.cells) drawBlocked(bx,by);
      if(!b.cells.length) drawEdgeBar(f.state.rac.x, f.state.rac.y, b.dir);
    }},

    { name:'wipe', draw:(ctx,f)=>{ if(f.wall && !PIXEL) f.wall(ctx, f); } },
  ]);

  return { paint: f => comp.render(ctx, f) };
}
