// The atlas: one place that knows what each thing on the board looks like. Every function
// takes the 2D context in and draws in GRID coordinates, which may be fractional — a piece
// mid-slide is the same sprite at x = 3.4 as it is at rest on x = 3.
//
// Nothing here reads game state. That is deliberate: the board loop and the move animation
// draw through the same functions, so they can never disagree about what a can looks like.

import { mulberry32 } from './rng.js';
import {
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY,
} from './rules.mjs';
import { BOARD, PALETTE } from './theme.js';

// Local shorthands, declared rather than aliased at the import: the publishing bundler
// concatenates these modules into one scope, where an import alias would have nothing left
// to bind to. See tools/build-artifact.mjs.
const C = PALETTE;
const CS = BOARD.cell, PAD = BOARD.pad;
const px = n => n * CS;

// ---------------------------------------------------------------- terrain
export function drawFloor(ctx, x, y) {
  ctx.fillStyle = '#fff'; ctx.strokeStyle = '#e6e6e2'; ctx.lineWidth = 1;
  ctx.fillRect(px(x) + 1, px(y) + 1, CS - 2, CS - 2);
  ctx.strokeRect(px(x) + 1.5, px(y) + 1.5, CS - 3, CS - 3);
}

// Open water reads as a hole in the floor — darker than anything else on the board, with
// ripples, because the one thing the player must believe on sight is "not walkable". A
// filled cell keeps the dark rim so you can still see it WAS water, and takes the same
// trash glyph the rest of the board uses: the mess is the bridge.
export function drawWater(ctx, x, y, filled) {
  const x0 = px(x), y0 = px(y);
  ctx.fillStyle = filled ? C.waterFilled : C.water;
  ctx.fillRect(x0 + 1, y0 + 1, CS - 2, CS - 2);
  if (filled) { drawTrash(ctx, x, y); return; }
  ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 1; i <= 2; i++) {
    const yy = y0 + CS * (i / 3);
    ctx.beginPath();
    ctx.moveTo(x0 + 6, yy);
    ctx.quadraticCurveTo(x0 + CS / 3, yy - 4, x0 + CS / 2, yy);
    ctx.quadraticCurveTo(x0 + 2 * CS / 3, yy + 4, x0 + CS - 6, yy);
    ctx.stroke();
  }
}

/** The board edge the exit points at — the direction he is actually leaving in. Pure. */
export function exitArrowDir(cols, rows, x, y) {
  const d = [[y, [0, -1]], [rows - 1 - y, [0, 1]], [x, [-1, 0]], [cols - 1 - x, [1, 0]]];
  return d.reduce((a, b) => (b[0] < a[0] ? b : a))[1];
}

// The way out, drawn as what it is: an emergency exit sign. White-on-green is the ISO 3864
// "safe condition" coding (ISO 7010 E002). Lit = every bag torn; unlit = work left to do.
export function drawExit(ctx, x, y, lit, [dx, dy]) {
  const x0 = px(x), y0 = px(y), m = 8, w = CS - 2 * m, cx = x0 + CS / 2, cy = y0 + CS / 2;
  ctx.save();
  ctx.fillStyle = lit ? C.grn : 'rgba(46,158,91,.12)';
  ctx.fillRect(x0 + m, y0 + m, w, w);
  if (!lit) {
    ctx.strokeStyle = 'rgba(46,158,91,.6)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.strokeRect(x0 + m + 1, y0 + m + 1, w - 2, w - 2); ctx.setLineDash([]);
  }
  ctx.fillStyle = lit ? '#fff' : 'rgba(46,158,91,.55)';
  ctx.font = "700 12px -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('EXIT', cx, y0 + m + 11);
  ctx.translate(cx, cy + 7); ctx.rotate(Math.atan2(dy, dx));
  const a = w * 0.30, H = w * 0.24, h = w * 0.09;
  ctx.beginPath();
  ctx.moveTo(a, 0); ctx.lineTo(0, -H); ctx.lineTo(0, -h); ctx.lineTo(-a, -h);
  ctx.lineTo(-a, h); ctx.lineTo(0, h); ctx.lineTo(0, H); ctx.closePath();
  ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- occupants
/** One switch, so nothing outside this module has to know a piece's code to draw it. */
export function drawOccupant(ctx, o, x, y, k = 1) {
  if (o === TRASH) drawTrash(ctx, x, y);
  else if (o === BAG) drawBag(ctx, x, y, k);
  else if (o === CAN_FULL) drawCan(ctx, x, y, true);
  else if (o === CAN_EMPTY) drawCan(ctx, x, y, false);
  else if (o === BIN) drawRecycleBin(ctx, x, y);
  else if (o === STACK) drawStack(ctx, x, y);
  else if (o === WHEELIE) drawWheelie(ctx, x, y, true);
  else if (o === WHEELIE_EMPTY) drawWheelie(ctx, x, y, false);
  else if (o !== NONE) throw new Error(`no sprite for occupant ${o}`); // fail loudly
}

// Trash is drawn from a stream seeded by the cell, so a given square's specks are the same
// specks on every frame and every reload without any of it being stored. `src` is the bag
// this debris came out of: while k < 1 every speck is in flight from that bag's centre to
// its resting place, so a burst throws its mess outward instead of fading up in place.
const cellSeed = (x, y) => ((Math.round(x) * 73856093) ^ (Math.round(y) * 19349663)) >>> 0;

export function drawTrash(ctx, x, y, k = 1, src = null) {
  if (k <= 0) return;
  const cols = [C.red, C.yel, C.blu, C.tea, C.pnk];
  const rnd = mulberry32(cellSeed(x, y));
  const x0 = px(x), y0 = px(y), M = 16, R = CS - 2 * M;   // centres stay inside [M, CS-M]
  const flying = k < 1 && src;
  ctx.save();
  // Settled trash is clipped to its own cell — a hard guarantee it never bleeds. Debris
  // still in the air has to cross the cells between the bag and where it lands, so the clip
  // comes off for exactly as long as it is flying.
  if (!flying) { ctx.beginPath(); ctx.rect(x0 + 2, y0 + 2, CS - 4, CS - 4); ctx.clip(); }
  const sx = flying ? px(src[0]) + CS / 2 : x0 + CS / 2;
  const sy = flying ? px(src[1]) + CS / 2 : y0 + CS / 2;
  for (let i = 0; i < 6; i++) {
    const ox = M + rnd() * R, oy = M + rnd() * R, r = 3 + Math.floor(rnd() * 3);
    ctx.fillStyle = cols[Math.floor(rnd() * cols.length)];
    ctx.beginPath();
    ctx.arc(sx + (x0 + ox - sx) * k, sy + (y0 + oy - sy) * k, r * Math.max(.25, k), 0, 7);
    ctx.fill();
  }
  ctx.restore();
}

export function drawBag(ctx, x, y, k = 1) {
  if (k <= 0) return;
  const cx0 = px(x) + CS / 2, cy0 = px(y) + CS / 2;
  ctx.save();
  ctx.translate(cx0, cy0); ctx.scale(k, k); ctx.translate(-cx0, -cy0);
  const cx = px(x) + CS / 2, top = px(y) + PAD + 8, w = CS - 2 * PAD - 6, h = CS - 2 * PAD - 8;
  ctx.fillStyle = '#161616';
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top + 8);
  ctx.quadraticCurveTo(cx - w / 2, top + h, cx, top + h);
  ctx.quadraticCurveTo(cx + w / 2, top + h, cx + w / 2, top + 8);
  ctx.lineTo(cx + w / 2 - 4, top + 2); ctx.lineTo(cx + 6, top + 6);
  ctx.lineTo(cx - 6, top + 6); ctx.lineTo(cx - w / 2 + 4, top + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = C.yel; star(ctx, cx + 6, top + h * 0.5, 5);   // shiny glint
  ctx.restore();
}

function star(ctx, cx, cy, r) {
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, rr = i % 2 ? r * .4 : r;
    ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

export function drawCan(ctx, x, y, full) {
  const cx = px(x) + CS / 2, w = CS - 2 * PAD - 8, top = px(y) + PAD + 6, h = CS - 2 * PAD - 6;
  ctx.fillStyle = '#b9c0c7'; ctx.strokeStyle = '#7d858c'; ctx.lineWidth = 2;
  ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
  ctx.strokeStyle = '#9aa2a9'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(cx - w / 2, top + i * h / 3); ctx.lineTo(cx + w / 2, top + i * h / 3); ctx.stroke();
  }
  ctx.fillStyle = '#cfd5da'; ctx.strokeStyle = '#7d858c'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, top, w / 2, 6, 0, 0, 7); ctx.fill(); ctx.stroke();
  if (full) {                                    // black bag bulging out
    ctx.fillStyle = '#161616';
    ctx.beginPath(); ctx.ellipse(cx, top - 3, w / 2 - 3, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = C.yel; star(ctx, cx + 5, top - 4, 4);
  } else {                                       // open dark mouth
    ctx.fillStyle = '#3a4046';
    ctx.beginPath(); ctx.ellipse(cx, top, w / 2 - 3, 4, 0, 0, 7); ctx.fill();
  }
}

// The recycle bin: blue, with the chasing-arrows triangle. Blue reads as "recycling" the
// world over, and it keeps the bin from being mistaken for the grey metal can.
export function drawRecycleBin(ctx, x, y) {
  const cx = px(x) + CS / 2, w = CS - 2 * PAD - 6, top = px(y) + PAD + 6, h = CS - 2 * PAD - 8;
  ctx.save();
  ctx.fillStyle = '#2d7dd2'; ctx.strokeStyle = '#1b4f86'; ctx.lineWidth = 2;
  ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
  ctx.fillStyle = '#4a95e0'; ctx.fillRect(cx - w / 2, top, w, 7);        // lid
  ctx.strokeStyle = '#1b4f86'; ctx.strokeRect(cx - w / 2, top, w, 7);
  // the mark, as a plain triangle outline — legible at 76px, unlike the real chasing arrows
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  const r = w * 0.26, my = top + h * 0.62;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 3;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, my + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

// A loose bag riding a still-full can. Drawn as exactly that — the can sits low and the bag
// perches on top, so "two bags in one square" reads before you push it.
export function drawStack(ctx, x, y) {
  const cx = px(x) + CS / 2, w = CS - 2 * PAD - 14, top = px(y) + CS * 0.46, h = CS * 0.36;
  ctx.save();
  ctx.fillStyle = '#b9c0c7'; ctx.strokeStyle = '#7d858c'; ctx.lineWidth = 2;
  ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
  ctx.fillStyle = '#cfd5da';
  ctx.beginPath(); ctx.ellipse(cx, top, w / 2, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = '#161616';
  ctx.beginPath(); ctx.ellipse(cx, top - 11, w / 2 + 3, 11, 0, 0, 7); ctx.fill();
  ctx.fillStyle = C.yel; star(ctx, cx + 6, top - 13, 4);
  ctx.restore();
}

// The wheelie bin: taller than the can, on wheels, with a hinged lid. Full = lid propped
// open by the bag inside; empty = lid down, and it still rolls.
export function drawWheelie(ctx, x, y, full) {
  const cx = px(x) + CS / 2, w = CS - 2 * PAD - 10, top = px(y) + PAD + 9, h = CS - 2 * PAD - 16;
  ctx.save();
  ctx.fillStyle = '#3f7d4f'; ctx.strokeStyle = '#255034'; ctx.lineWidth = 2;
  ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
  ctx.strokeStyle = '#2f6a40'; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(cx - w / 2, top + i * h / 3); ctx.lineTo(cx + w / 2, top + i * h / 3); ctx.stroke();
  }
  ctx.fillStyle = '#22252a';   // wheels — the reason it does not stop where you stop pushing
  ctx.beginPath(); ctx.arc(cx - w / 2 + 5, top + h + 4, 5, 0, 7); ctx.arc(cx + w / 2 - 5, top + h + 4, 5, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(cx - w / 2, top);
  if (full) ctx.rotate(-0.42);                   // lid propped open by the bag under it
  ctx.fillStyle = '#4f9a63'; ctx.strokeStyle = '#255034'; ctx.lineWidth = 2;
  ctx.fillRect(-2, -8, w + 4, 8); ctx.strokeRect(-2, -8, w + 4, 8);
  ctx.restore();
  if (full) {
    ctx.fillStyle = '#161616';
    ctx.beginPath(); ctx.ellipse(cx + 3, top - 2, w / 2 - 4, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = C.yel; star(ctx, cx + 8, top - 3, 4);
  }
  ctx.restore();
}

export function drawRaccoon(ctx, x, y) {
  const cx = px(x) + CS / 2, cy = px(y) + CS / 2, r = CS / 2 - PAD - 4;   // may be fractional
  ctx.fillStyle = '#8b8f95'; ctx.beginPath(); ctx.arc(cx + r * 0.7, cy + r * 0.6, r * 0.5, 0, 7); ctx.fill();
  ctx.fillStyle = '#4a4e54'; ctx.beginPath(); ctx.arc(cx + r * 0.95, cy + r * 0.75, r * 0.28, 0, 7); ctx.fill();
  ctx.fillStyle = '#6b7076';
  ctx.beginPath(); ctx.arc(cx - r * 0.6, cy - r * 0.7, r * 0.32, 0, 7); ctx.arc(cx + r * 0.6, cy - r * 0.7, r * 0.32, 0, 7); ctx.fill();
  ctx.fillStyle = '#9aa0a6'; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.fillStyle = '#2b2f34'; ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.05, r * 0.95, r * 0.42, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#eceef0'; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.45, r * 0.5, r * 0.35, 0, 0, 7); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.05, r * 0.2, 0, 7); ctx.arc(cx + r * 0.35, cy - r * 0.05, r * 0.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#111';
  ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.02, r * 0.1, 0, 7); ctx.arc(cx + r * 0.35, cy - r * 0.02, r * 0.1, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.35, r * 0.12, 0, 7); ctx.fill();
}

// ---------------------------------------------------------------- guides
/** Where a strike would land. Always pale yellow: it answers "where?", not "may I?". */
export function drawFanTint(ctx, x, y) {
  ctx.fillStyle = 'rgba(255,207,0,.45)';
  ctx.fillRect(px(x) + 1, px(y) + 1, CS - 2, CS - 2);
  ctx.strokeStyle = 'rgba(224,170,0,.85)'; ctx.lineWidth = 2;
  ctx.strokeRect(px(x) + 2, px(y) + 2, CS - 4, CS - 4);
}

/** Where a shoved piece comes to rest — the push is as permanent as the tear. */
export function drawLanding(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = 'rgba(255,207,0,.32)'; ctx.fillRect(px(x) + 1, px(y) + 1, CS - 2, CS - 2);
  ctx.strokeStyle = 'rgba(224,170,0,.9)'; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
  ctx.strokeRect(px(x) + 3, px(y) + 3, CS - 6, CS - 6); ctx.setLineDash([]);
  ctx.restore();
}

/** The armed cell: a ring and the direction you are about to commit to. */
export function drawAim(ctx, x, y, dx, dy) {
  const x0 = px(x), y0 = px(y), cx = x0 + CS / 2, cy = y0 + CS / 2;
  ctx.save();
  ctx.strokeStyle = '#e0aa00'; ctx.lineWidth = 4; ctx.setLineDash([7, 5]);
  ctx.strokeRect(x0 + 3, y0 + 3, CS - 6, CS - 6); ctx.setLineDash([]);
  ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const a = CS * 0.24;
  ctx.beginPath();
  ctx.moveTo(cx - dx * a, cy - dy * a); ctx.lineTo(cx + dx * a, cy + dy * a);
  ctx.moveTo(cx + dx * a - (dx + dy) * 8, cy + dy * a - (dy + dx) * 8);
  ctx.lineTo(cx + dx * a, cy + dy * a);
  ctx.lineTo(cx + dx * a - (dx - dy) * 8, cy + dy * a - (dy - dx) * 8);
  ctx.stroke();
  ctx.restore();
}

/** The exact cell to blame. A refused input that looks like no input is a bug. */
export function drawBlocked(ctx, x, y) {
  const x0 = px(x), y0 = px(y), m = CS * 0.30;
  ctx.save();
  ctx.fillStyle = 'rgba(255,75,62,.42)'; ctx.fillRect(x0 + 1, y0 + 1, CS - 2, CS - 2);
  ctx.strokeStyle = C.red; ctx.lineWidth = 4; ctx.strokeRect(x0 + 3, y0 + 3, CS - 6, CS - 6);
  ctx.lineCap = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = '#c8321f';
  ctx.beginPath();
  ctx.moveTo(x0 + m, y0 + m); ctx.lineTo(x0 + CS - m, y0 + CS - m);
  ctx.moveTo(x0 + CS - m, y0 + m); ctx.lineTo(x0 + m, y0 + CS - m);
  ctx.stroke();
  ctx.restore();
}

/** Off-grid: there is no cell to paint, so mark the wall of the alley itself. */
export function drawEdgeBar(ctx, x, y, [dx, dy]) {
  const x0 = px(x), y0 = px(y), T = 9;
  ctx.save(); ctx.fillStyle = C.red;
  if (dy < 0) ctx.fillRect(x0 + 2, y0 + 1, CS - 4, T);
  if (dy > 0) ctx.fillRect(x0 + 2, y0 + CS - 1 - T, CS - 4, T);
  if (dx < 0) ctx.fillRect(x0 + 1, y0 + 2, T, CS - 4);
  if (dx > 0) ctx.fillRect(x0 + CS - 1 - T, y0 + 2, T, CS - 4);
  ctx.restore();
}

/** One bit of confetti, already positioned by `anim.confettiAt`. Canvas pixels, not cells. */
export function drawConfettiBit(ctx, bit, cx, cy, rot) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = bit.colour; ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
  ctx.restore();
}
