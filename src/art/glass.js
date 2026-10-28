// Broken glass on the floor, seen from above: a pile of shards about as much glass as the pane
// that fell, a few long slivers and many small bits, heaped toward the middle of the cell. Each
// cell seeds its own pile, and a pile may spill a little into a neighbouring glass cell, so the
// field is in floor pixels and each cell draws only its own.
import { mulberry32 } from '../rng.js';
import { C } from './flight.js';

export const GLASS_LOOK = { seed: 97637, area: 452, big: 7, bigMin: 8, bigMax: 15.5, smallMax: 4, width: 0.5, spread: 7.5, visible: 276,
  glint: 0.35, edge: '#7dafb3', fill: '#97908f', glare: '#f1eccb', dark: '#5f7f88' };

const hash = (a, b, c) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f) ^ Math.imul(c, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return h >>> 0;
};

/** The shards of cell (cx, cy), each a list of its pixels in floor pixels, back to front. */
function pile(cx, cy, look) {
  const rnd = mulberry32(hash(cx, cy, look.seed));
  const gauss = () => (rnd() + rnd() + rnd() - 1.5) * 1.4;
  const out = [], x0 = cx * C, y0 = cy * C, seen = new Set();
  let left = look.area;
  // After the glass budget is spent, more bits go on until `visible` px of the cell show glass.
  for (let k = 0; (left > 0 || seen.size < look.visible) && k < 5000; k++) {
    const big = k < look.big;
    const L = big ? look.bigMin + rnd() * (look.bigMax - look.bigMin) : 1 + rnd() * (look.smallMax - 1);
    // Big slivers lie further out than the crumbs, which heap where the pane landed.
    const r = look.spread * (big ? 1.4 : 1);
    const mx = cx * C + C / 2 + gauss() * r, my = cy * C + C / 2 + gauss() * r;
    const a = rnd() * Math.PI, dx = Math.cos(a), dy = Math.sin(a), w = Math.max(0.6, L * look.width);
    const corners = [[mx + dx * L / 2, my + dy * L / 2],
      [mx - dx * L / 2 - dy * w * (0.4 + rnd() * 0.6), my - dy * L / 2 + dx * w * (0.4 + rnd() * 0.6)],
      [mx - dx * L / 2 + dy * w * rnd() * 0.8, my - dy * L / 2 - dx * w * rnd() * 0.8]];
    const xs = corners.map(p => p[0]), ys = corners.map(p => p[1]), px = [];
    for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++)
        if (inside(corners, x + 0.5, y + 0.5)) px.push([x, y]);
    if (!px.length) px.push([Math.round(mx), Math.round(my)]);
    out.push(px);
    left -= px.length;
    for (const [x, y] of px) if (x >= x0 && x < x0 + C && y >= y0 && y < y0 + C) seen.add(x * 100003 + y);
  }
  return out;
}
const inside = (poly, x, y) => {
  let c = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};

/** The shards of the pile cell (cx, cy) drops, back to front, each a list of [x, y, colour] in floor
 *  pixels. `has(x, y)` says whether a cell is glass. */
export function glassShards(cx, cy, has, look) {
  const rnd = mulberry32(hash(cx, cy, look.seed + 1));
  return pile(cx, cy, look).map(shard => {
    const own = new Set(shard.map(([x, y]) => x * 100003 + y));
    const at = (x, y) => own.has(x * 100003 + y);
    const lit = rnd() < look.glint, out = [];
    for (const [x, y] of shard) {
      // Only glass cells hold glass: a pile is cut where the glass ends.
      if (!has(Math.floor(x / C), Math.floor(y / C))) continue;
      let c = look.fill;
      if (!at(x - 1, y) || !at(x, y - 1)) c = lit ? look.glare : look.edge;   // the edge facing the light
      else if (!at(x + 1, y) || !at(x, y + 1)) c = look.dark;
      if (shard.length <= 2) c = lit ? look.glare : look.edge;
      out.push([x, y, c]);
    }
    return out;
  });
}

/** The pixels of the glass in cell (cx, cy), as [x, y, colour] within the cell. */
export function glassCell(cx, cy, has, look) {
  const x0 = cx * C, y0 = cy * C, paint = new Map();
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
    if (has(cx + dx, cy + dy))
      for (const shard of glassShards(cx + dx, cy + dy, has, look)) for (const p of shard) paint.set(p[0] * 100003 + p[1], p);
  const px = [];
  for (const [x, y, c] of paint.values()) if (x >= x0 && x < x0 + C && y >= y0 && y < y0 + C) px.push([x - x0, y - y0, c]);
  return px;
}
