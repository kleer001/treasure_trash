// The cardboard is a square panel torn from a box, lying flat, seen from above.
//   Palette: k ink, c face, r rib, l lit crease, s shade crease, x bare flute, y paper between flutes, f torn fibre.
import { mulberry32 } from '../rng.js';
import { drawingOf } from './pile.js';
import { soakMarks } from './spread.js';

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
export const CARDBOARD = drawingOf(CARDBOARD_ROWS, CARDBOARD_PALETTE);

export const WET_LOOK = { count: 4, rmin: 2, rmax: 4, soak: 1,
  wet: { c: '#a8865e', r: '#9a7a54', l: '#b89870', s: '#7e6142', x: '#7c6a54', y: '#93806a', f: '#c2ac8a',
    w: '#6a4430', W: '#5a3a28', e: '#7a5a3c' } };
/** Returns the cardboard cell soaked through, as `{ w, h, px: [x, y, colour] }`. `seed` places its dark circles. */
export function wetCardboard(seed, look = WET_LOOK) {
  const N = CARDBOARD_ROWS.length, rand = mulberry32(seed);
  const on = (x, y) => x >= 0 && y >= 0 && x < N && y < N && !'.k'.includes(CARDBOARD_ROWS[y][x]);
  const { dots: circles, nearEdge } = soakMarks(rand, N, N, on, look);
  const px = [];
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const ch = CARDBOARD_ROWS[y][x];
    if (ch === '.') continue;
    if (ch === 'k') { px.push([x, y, CARDBOARD_PALETTE.k]); continue; }
    const inCircle = circles.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
    px.push([x, y, inCircle ? look.wet[ch === 'x' || ch === 'y' ? 'W' : 'w'] : nearEdge(x, y) ? look.wet.e : look.wet[ch]]);
  }
  return { w: N, h: N, px };
}
