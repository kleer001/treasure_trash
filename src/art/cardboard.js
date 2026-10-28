// The cardboard: a square panel torn from a box, lying flat, seen from above. Over its left half
// the face paper is torn away and the bare flutes show; along the torn edges, the fibre.
//   c face, r rib, l lit crease, s shade crease, x bare flute, y paper between flutes, f torn fibre
import { mulberry32 } from '../rng.js';

export const CARDBOARD_PALETTE = { c: '#dcc6a2', r: '#cfb791', l: '#ecdcbf', s: '#b59c78', x: '#a9957a', y: '#c9b79a', f: '#f3ead8', k: '#19152b' };
export const CARDBOARD_ROWS = [
  '........................',
  '...kk..kkkkkkk...kkkk...',
  '..kxykkxyxyfcckkkcccyk..',
  '.kyxyxyxyxfccccccccccxk.',
  '..kxyxyxyfccccccccccyfk.',
  '..kxyxyxyxfcsssssssssk..',
  '.kyxyxyxyxyfccccccccyfk.',
  '.kyxyxyxyxyxfccccccccxk.',
  '..kxyxyxyxyfccccccccyk..',
  '..kxyxyxyxfccccccccxfk..',
  '.kyxyxyxyxfcccccccccyk..',
  '.kyxyxyxyfccccccccccyxk.',
  '..kxyxyxyxfcccccccccyk..',
  '.kyxyxyxyxyfcccccccccxk.',
  '.kyxyxyxyxyfccccccccyfk.',
  '..kxyxyxyxfcccccccccfk..',
  '..kxyxyxyxfcccccccccyfk.',
  '.kyxyxyxyxyfcccccccccxk.',
  '.kyxyxyxyxyxfcccccccyk..',
  '..kxyxyxyxyfccccccccyxk.',
  '..kxyxyxyxfcccccccccyk..',
  '...kyxyxyxfcckkcccyxk...',
  '....kkkkkkkkk..kkkkk....',
  '........................',
];

/** { w, h, px: [x, y, colour] }, one cell, from its top-left corner. */
export const CARDBOARD = { w: CARDBOARD_ROWS[0].length, h: CARDBOARD_ROWS.length,
  px: CARDBOARD_ROWS.flatMap((r, y) => [...r].flatMap((c, x) => (c === '.' ? [] : [[x, y, CARDBOARD_PALETTE[c]]]))) };

/** The sheet soaked through: each part in its wet colour, darker in from the torn edges, and dark
 *  circles where the water came up through it. `seed` places the circles. */
export const WET_LOOK = { count: 4, rmin: 2, rmax: 4, soak: 1,
  wet: { c: '#a8865e', r: '#9a7a54', l: '#b89870', s: '#7e6142', x: '#7c6a54', y: '#93806a', f: '#c2ac8a',
    w: '#6a4430', W: '#5a3a28', e: '#7a5a3c' } };
export function wetCardboard(seed, look = WET_LOOK) {
  const N = CARDBOARD_ROWS.length, rand = mulberry32(seed);
  const on = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !'.k'.includes(CARDBOARD_ROWS[y][x]);
  const cells = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (on(x, y)) cells.push([x, y]);
  const circles = Array.from({ length: look.count }, () => {
    const [cx, cy] = cells[Math.floor(rand() * cells.length)];
    return [cx + 0.5, cy + 0.5, look.rmin + rand() * Math.max(0, look.rmax - look.rmin)];
  });
  // How many steps in from the sheet's edge each pixel is, out to `soak`.
  const depth = new Map(), key = (x, y) => x * 100 + y, SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  let ring = cells.filter(([x, y]) => SIDES.some(([dx, dy]) => !on(x + dx, y + dy)));
  for (let d = 1; d <= look.soak && ring.length; d++) {
    ring.forEach(([x, y]) => depth.set(key(x, y), d));
    ring = cells.filter(([x, y]) => !depth.has(key(x, y)) && SIDES.some(([dx, dy]) => depth.get(key(x + dx, y + dy)) === d));
  }
  const px = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ch = CARDBOARD_ROWS[y][x];
    if (ch === '.') continue;
    if (ch === 'k') { px.push([x, y, CARDBOARD_PALETTE.k]); continue; }
    const inCircle = circles.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
    px.push([x, y, inCircle ? look.wet[ch === 'x' || ch === 'y' ? 'W' : 'w'] : depth.has(key(x, y)) ? look.wet.e : look.wet[ch]]);
  }
  return { w: N, h: N, px };
}
