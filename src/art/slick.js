// A slick on the floor — grease or tar — as a field of lobes thresholded into a blob. Every slick
// cell seeds its own lobes, and a bridge lobe sits on each edge it shares with another slick cell,
// so a run of cells comes out as one blob that is different every time. Each cell draws only its
// own pixels, but the field is in floor pixels, so the pieces meet without a seam.
import { mulberry32 } from '../rng.js';
import { C } from './flight.js';

export const LOOKS = {
  grease: { seed: 94902, lobes: 5, size: 5.5, lump: 0.6, fill: 1.6, shine: 0.55, sheen: 0.32, band: 4.5,
    body: '#4a3f2e', edge: '#2e2619', glint: '#f6efc9', hues: ['#6a4e63', '#4f6a4c', '#4c5a7a'] },
  tar: { seed: 12207, lobes: 4, size: 5.5, lump: 0.25, fill: 1.6, shine: 0.55, sheen: 0.18, band: 5,
    body: '#1d1a22', edge: '#0d0b10', glint: '#b9c6d6', hues: ['#2f2638', '#22302c', '#232b3c'] },
};

const hash = (a, b, c) => {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b ^ 0xc2b2ae35, 0x27d4eb2f) ^ Math.imul(c, 0x165667b1);
  h ^= h >>> 15; h = Math.imul(h, 0x2c1b3c6d); h ^= h >>> 12;
  return (h >>> 0) / 4294967296;
};
// Value noise on a 4-pixel lattice, so the outline wobbles in lumps rather than in single pixels.
const noise = (x, y, seed) => {
  const ix = Math.floor(x / 4), iy = Math.floor(y / 4), fx = x / 4 - ix, fy = y / 4 - iy;
  const n = (a, b) => hash(ix + a, iy + b, seed);
  const top = n(0, 0) + (n(1, 0) - n(0, 0)) * fx, bot = n(0, 1) + (n(1, 1) - n(0, 1)) * fx;
  return top + (bot - top) * fy;
};

/** The lobes of cell (cx, cy): [x, y, r] in floor pixels. */
function lobes(cx, cy, has, look) {
  const rnd = mulberry32(hash(cx, cy, look.seed) * 4294967296);
  const out = [], m = Math.min(look.size, C / 2 - 1);
  for (let k = 0; k < look.lobes; k++)
    out.push([cx * C + m + rnd() * (C - 2 * m), cy * C + m + rnd() * (C - 2 * m), look.size * (0.6 + rnd() * 0.6)]);
  if (has(cx + 1, cy)) out.push([(cx + 1) * C, cy * C + C / 2 + (rnd() - 0.5) * 6, look.size]);
  if (has(cx, cy + 1)) out.push([cx * C + C / 2 + (rnd() - 0.5) * 6, (cy + 1) * C, look.size]);
  return out;
}

/** The pixels of the slick in cell (cx, cy), as [x, y, colour] within the cell. `has(x, y)` says
 *  whether a cell holds the same slick. */
export function slickCell(cx, cy, has, look) {
  const near = [];
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++)
    if (has(cx + dx, cy + dy)) near.push(...lobes(cx + dx, cy + dy, has, look));
  const x0 = cx * C, y0 = cy * C;
  const inCell = (x, y) => x >= x0 && x < x0 + C && y >= y0 && y < y0 + C;
  // A pixel outside every slick cell is never slick, so a blob is cut flat where the run ends.
  const field = (x, y) => {
    if (!has(Math.floor(x / C), Math.floor(y / C))) return 0;
    let f = 0;
    for (const [lx, ly, r] of near) f += (r * r) / ((x + 0.5 - lx) ** 2 + (y + 0.5 - ly) ** 2 + 1);
    return f * (1 + look.lump * (noise(x, y, look.seed) - 0.5) * 2);
  };
  const memo = new Map();
  const on = (x, y) => {
    const k = x * 100003 + y;
    if (!memo.has(k)) memo.set(k, field(x, y) >= look.fill);
    return memo.get(k);
  };
  const px = [];
  for (let y = y0; y < y0 + C; y++) for (let x = x0; x < x0 + C; x++) {
    if (!inCell(x, y) || !on(x, y)) continue;
    let c = look.body;
    if (!on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) c = look.edge;
    // A glint is the pixel just inside an edge that faces up or left, kept in runs.
    else if ((!on(x - 2, y) || !on(x, y - 2)) && noise(x * 2, y * 2, look.seed + 7) < look.shine) c = look.glint;
    else {
      // Thin bands across the slick, bent by the same lumps as its outline.
      const s = Math.sin((x * 0.8 + y * 0.45) / look.band + noise(x, y, look.seed + 3) * 4);
      if (Math.abs(s) < look.sheen) c = look.hues[Math.floor((x + y) / 3) % look.hues.length];
    }
    px.push([x - x0, y - y0, c]);
  }
  return px;
}
