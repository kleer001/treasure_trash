// Draw primitives for everything on the board. Grid coordinates, fractional allowed.

import { mulberry32 } from './rng.js';
import {
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY, DIRS,
} from './rules.mjs';
import { BOARD, CONFETTI_COLOURS, SKIN } from './theme.js';

const CS = BOARD.cell, PAD = BOARD.pad;
const px = n => n * CS;

export function drawFloor(ctx, x, y) {
  ctx.fillStyle = SKIN.floor.fill; ctx.strokeStyle = SKIN.floor.edge; ctx.lineWidth = 1;
  ctx.fillRect(px(x) + 1, px(y) + 1, CS - 2, CS - 2);
  ctx.strokeRect(px(x) + 1.5, px(y) + 1.5, CS - 3, CS - 3);
}

/** Open canal, or a filled cell keeping the dark rim under its trash. */
export function drawWater(ctx, x, y, filled) {
  const x0 = px(x), y0 = px(y);
  ctx.fillStyle = filled ? SKIN.water.filled : SKIN.water.open;
  ctx.fillRect(x0 + 1, y0 + 1, CS - 2, CS - 2);
  if (filled) { drawTrash(ctx, x, y); return; }
  ctx.strokeStyle = SKIN.water.ripple; ctx.lineWidth = 2; ctx.lineCap = 'round';
  for (let i = 1; i <= 2; i++) {
    const yy = y0 + CS * (i / 3);
    ctx.beginPath();
    ctx.moveTo(x0 + 6, yy);
    ctx.quadraticCurveTo(x0 + CS / 3, yy - 4, x0 + CS / 2, yy);
    ctx.quadraticCurveTo(x0 + 2 * CS / 3, yy + 4, x0 + CS - 6, yy);
    ctx.stroke();
  }
}

/** The nearest board edge, as a unit vector. */
export function exitArrowDir(cols, rows, x, y) {
  const gap = { u: y, d: rows - 1 - y, l: x, r: cols - 1 - x };
  return DIRS[Object.keys(gap).reduce((a, b) => (gap[b] < gap[a] ? b : a))];
}

/** ISO 7010 E002 emergency-exit sign; lit once every bag is torn. */
export function drawExit(ctx, x, y, lit, [dx, dy]) {
  const x0 = px(x), y0 = px(y), m = 8, w = CS - 2 * m, cx = x0 + CS / 2, cy = y0 + CS / 2;
  ctx.save();
  ctx.fillStyle = lit ? SKIN.exit.lit : SKIN.exit.dim;
  ctx.fillRect(x0 + m, y0 + m, w, w);
  if (!lit) {
    ctx.strokeStyle = SKIN.exit.dimEdge; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
    ctx.strokeRect(x0 + m + 1, y0 + m + 1, w - 2, w - 2); ctx.setLineDash([]);
  }
  ctx.fillStyle = lit ? SKIN.exit.litInk : SKIN.exit.dimInk;
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

/** Dispatch on occupant code, so no caller needs to know the pieces. */
export function drawOccupant(ctx, o, x, y, k = 1) {
  if (o === TRASH) drawTrash(ctx, x, y);
  else if (o === BAG) drawBag(ctx, x, y, k);
  else if (o === CAN_FULL) drawCan(ctx, x, y, true);
  else if (o === CAN_EMPTY) drawCan(ctx, x, y, false);
  else if (o === BIN) drawRecycleBin(ctx, x, y);
  else if (o === STACK) drawStack(ctx, x, y);
  else if (o === WHEELIE) drawWheelie(ctx, x, y, true);
  else if (o === WHEELIE_EMPTY) drawWheelie(ctx, x, y, false);
  else if (o !== NONE) throw new Error(`no sprite for occupant ${o}`);
}

const cellSeed = (x, y) => ((Math.round(x) * 73856093) ^ (Math.round(y) * 19349663)) >>> 0;

/**
 * Specks seeded by the cell, so a square looks the same on every frame.
 * `k` < 1 with `src` set flies the debris out from that bag's centre.
 */
export function drawTrash(ctx, x, y, k = 1, src = null) {
  if (k <= 0) return;
  const cols = CONFETTI_COLOURS;
  const rnd = mulberry32(cellSeed(x, y));
  const x0 = px(x), y0 = px(y), M = 16, R = CS - 2 * M;
  const flying = k < 1 && src;
  ctx.save();
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

/** `k` scales the bag about its centre, so a tear deflates it. */
export function drawBag(ctx, x, y, k = 1) {
  if (k <= 0) return;
  const cx0 = px(x) + CS / 2, cy0 = px(y) + CS / 2;
  ctx.save();
  ctx.translate(cx0, cy0); ctx.scale(k, k); ctx.translate(-cx0, -cy0);
  const cx = px(x) + CS / 2, top = px(y) + PAD + 8, w = CS - 2 * PAD - 6, h = CS - 2 * PAD - 8;
  ctx.fillStyle = SKIN.bag.body;
  ctx.beginPath();
  ctx.moveTo(cx - w / 2, top + 8);
  ctx.quadraticCurveTo(cx - w / 2, top + h, cx, top + h);
  ctx.quadraticCurveTo(cx + w / 2, top + h, cx + w / 2, top + 8);
  ctx.lineTo(cx + w / 2 - 4, top + 2); ctx.lineTo(cx + 6, top + 6);
  ctx.lineTo(cx - 6, top + 6); ctx.lineTo(cx - w / 2 + 4, top + 2); ctx.closePath(); ctx.fill();
  ctx.fillStyle = SKIN.bag.glint; star(ctx, cx + 6, top + h * 0.5, 5);
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
  ctx.fillStyle = SKIN.can.body; ctx.strokeStyle = SKIN.can.edge; ctx.lineWidth = 2;
  ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
  ctx.strokeStyle = SKIN.can.ridge; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(cx - w / 2, top + i * h / 3); ctx.lineTo(cx + w / 2, top + i * h / 3); ctx.stroke();
  }
  ctx.fillStyle = SKIN.can.rim; ctx.strokeStyle = SKIN.can.edge; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.ellipse(cx, top, w / 2, 6, 0, 0, 7); ctx.fill(); ctx.stroke();
  if (full) {
    ctx.fillStyle = SKIN.bag.body;
    ctx.beginPath(); ctx.ellipse(cx, top - 3, w / 2 - 3, 9, 0, 0, 7); ctx.fill();
    ctx.fillStyle = SKIN.bag.glint; star(ctx, cx + 5, top - 4, 4);
  } else {
    ctx.fillStyle = SKIN.can.mouth;
    ctx.beginPath(); ctx.ellipse(cx, top, w / 2 - 3, 4, 0, 0, 7); ctx.fill();
  }
}

export function drawRecycleBin(ctx, x, y) {
  const cx = px(x) + CS / 2, w = CS - 2 * PAD - 6, top = px(y) + PAD + 6, h = CS - 2 * PAD - 8;
  ctx.save();
  ctx.fillStyle = SKIN.bin.body; ctx.strokeStyle = SKIN.bin.edge; ctx.lineWidth = 2;
  ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
  ctx.fillStyle = SKIN.bin.lid; ctx.fillRect(cx - w / 2, top, w, 7);
  ctx.strokeStyle = SKIN.bin.edge; ctx.strokeRect(cx - w / 2, top, w, 7);
  ctx.strokeStyle = SKIN.bin.mark; ctx.lineWidth = 3; ctx.lineJoin = 'round';
  const r = w * 0.26, my = top + h * 0.62;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + i * 2 * Math.PI / 3;
    ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, my + Math.sin(a) * r);
  }
  ctx.closePath(); ctx.stroke();
  ctx.restore();
}

/** A loose bag riding a still-full can. */
export function drawStack(ctx, x, y) {
  const cx = px(x) + CS / 2, w = CS - 2 * PAD - 14, top = px(y) + CS * 0.46, h = CS * 0.36;
  ctx.save();
  ctx.fillStyle = SKIN.can.body; ctx.strokeStyle = SKIN.can.edge; ctx.lineWidth = 2;
  ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
  ctx.fillStyle = SKIN.can.rim;
  ctx.beginPath(); ctx.ellipse(cx, top, w / 2, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = SKIN.bag.body;
  ctx.beginPath(); ctx.ellipse(cx, top - 11, w / 2 + 3, 11, 0, 0, 7); ctx.fill();
  ctx.fillStyle = SKIN.bag.glint; star(ctx, cx + 6, top - 13, 4);
  ctx.restore();
}

/** Full = lid propped open by the bag inside; empty = lid down. */
export function drawWheelie(ctx, x, y, full) {
  const cx = px(x) + CS / 2, w = CS - 2 * PAD - 10, top = px(y) + PAD + 9, h = CS - 2 * PAD - 16;
  ctx.save();
  ctx.fillStyle = SKIN.wheelie.body; ctx.strokeStyle = SKIN.wheelie.edge; ctx.lineWidth = 2;
  ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
  ctx.strokeStyle = SKIN.wheelie.ridge; ctx.lineWidth = 1;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(cx - w / 2, top + i * h / 3); ctx.lineTo(cx + w / 2, top + i * h / 3); ctx.stroke();
  }
  ctx.fillStyle = SKIN.wheelie.wheel;
  ctx.beginPath(); ctx.arc(cx - w / 2 + 5, top + h + 4, 5, 0, 7); ctx.arc(cx + w / 2 - 5, top + h + 4, 5, 0, 7); ctx.fill();
  ctx.save();
  ctx.translate(cx - w / 2, top);
  if (full) ctx.rotate(-0.42);
  ctx.fillStyle = SKIN.wheelie.lid; ctx.strokeStyle = SKIN.wheelie.edge; ctx.lineWidth = 2;
  ctx.fillRect(-2, -8, w + 4, 8); ctx.strokeRect(-2, -8, w + 4, 8);
  ctx.restore();
  if (full) {
    ctx.fillStyle = SKIN.bag.body;
    ctx.beginPath(); ctx.ellipse(cx + 3, top - 2, w / 2 - 4, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = SKIN.bag.glint; star(ctx, cx + 8, top - 3, 4);
  }
  ctx.restore();
}

export function drawRaccoon(ctx, x, y) {
  const cx = px(x) + CS / 2, cy = px(y) + CS / 2, r = CS / 2 - PAD - 4;
  ctx.fillStyle = SKIN.raccoon.tail; ctx.beginPath(); ctx.arc(cx + r * 0.7, cy + r * 0.6, r * 0.5, 0, 7); ctx.fill();
  ctx.fillStyle = SKIN.raccoon.tailTip; ctx.beginPath(); ctx.arc(cx + r * 0.95, cy + r * 0.75, r * 0.28, 0, 7); ctx.fill();
  ctx.fillStyle = SKIN.raccoon.ear;
  ctx.beginPath(); ctx.arc(cx - r * 0.6, cy - r * 0.7, r * 0.32, 0, 7); ctx.arc(cx + r * 0.6, cy - r * 0.7, r * 0.32, 0, 7); ctx.fill();
  ctx.fillStyle = SKIN.raccoon.head; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
  ctx.fillStyle = SKIN.raccoon.mask; ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.05, r * 0.95, r * 0.42, 0, 0, 7); ctx.fill();
  ctx.fillStyle = SKIN.raccoon.muzzle; ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.45, r * 0.5, r * 0.35, 0, 0, 7); ctx.fill();
  ctx.fillStyle = SKIN.raccoon.eye;
  ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.05, r * 0.2, 0, 7); ctx.arc(cx + r * 0.35, cy - r * 0.05, r * 0.2, 0, 7); ctx.fill();
  ctx.fillStyle = SKIN.raccoon.pupil;
  ctx.beginPath(); ctx.arc(cx - r * 0.35, cy - r * 0.02, r * 0.1, 0, 7); ctx.arc(cx + r * 0.35, cy - r * 0.02, r * 0.1, 0, 7); ctx.fill();
  ctx.beginPath(); ctx.arc(cx, cy + r * 0.35, r * 0.12, 0, 7); ctx.fill();
}

/** Where a strike would land. */
export function drawFanTint(ctx, x, y) {
  ctx.fillStyle = SKIN.guide.fill;
  ctx.fillRect(px(x) + 1, px(y) + 1, CS - 2, CS - 2);
  ctx.strokeStyle = SKIN.guide.edge; ctx.lineWidth = 2;
  ctx.strokeRect(px(x) + 2, px(y) + 2, CS - 4, CS - 4);
}

/** Where a shoved piece comes to rest. */
export function drawLanding(ctx, x, y) {
  ctx.save();
  ctx.fillStyle = SKIN.guide.landFill; ctx.fillRect(px(x) + 1, px(y) + 1, CS - 2, CS - 2);
  ctx.strokeStyle = SKIN.guide.landEdge; ctx.lineWidth = 3; ctx.setLineDash([6, 4]);
  ctx.strokeRect(px(x) + 3, px(y) + 3, CS - 6, CS - 6); ctx.setLineDash([]);
  ctx.restore();
}

/** Ring and arrow on the cell an armed action would hit. */
export function drawAim(ctx, x, y, dx, dy) {
  const x0 = px(x), y0 = px(y), cx = x0 + CS / 2, cy = y0 + CS / 2;
  ctx.save();
  ctx.strokeStyle = SKIN.guide.aim; ctx.lineWidth = 4; ctx.setLineDash([7, 5]);
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

/** The cell that forbade the action. */
export function drawBlocked(ctx, x, y) {
  const x0 = px(x), y0 = px(y), m = CS * 0.30;
  ctx.save();
  ctx.fillStyle = SKIN.blocked.fill; ctx.fillRect(x0 + 1, y0 + 1, CS - 2, CS - 2);
  ctx.strokeStyle = SKIN.blocked.edge; ctx.lineWidth = 4; ctx.strokeRect(x0 + 3, y0 + 3, CS - 6, CS - 6);
  ctx.lineCap = 'round'; ctx.lineWidth = 7; ctx.strokeStyle = SKIN.blocked.cross;
  ctx.beginPath();
  ctx.moveTo(x0 + m, y0 + m); ctx.lineTo(x0 + CS - m, y0 + CS - m);
  ctx.moveTo(x0 + CS - m, y0 + m); ctx.lineTo(x0 + m, y0 + CS - m);
  ctx.stroke();
  ctx.restore();
}

/** Off-grid refusal: mark the board edge itself. */
export function drawEdgeBar(ctx, x, y, [dx, dy]) {
  const x0 = px(x), y0 = px(y), T = 9;
  ctx.save(); ctx.fillStyle = SKIN.blocked.bar;
  if (dy < 0) ctx.fillRect(x0 + 2, y0 + 1, CS - 4, T);
  if (dy > 0) ctx.fillRect(x0 + 2, y0 + CS - 1 - T, CS - 4, T);
  if (dx < 0) ctx.fillRect(x0 + 1, y0 + 2, T, CS - 4);
  if (dx > 0) ctx.fillRect(x0 + CS - 1 - T, y0 + 2, T, CS - 4);
  ctx.restore();
}

/** One confetti bit, positioned in canvas pixels. */
export function drawConfettiBit(ctx, bit, cx, cy, rot) {
  ctx.save();
  ctx.translate(cx, cy); ctx.rotate(rot);
  ctx.fillStyle = bit.colour; ctx.fillRect(-bit.w / 2, -bit.h / 2, bit.w, bit.h);
  ctx.restore();
}
