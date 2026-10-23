// The skateboard: a deck two cells long on two trucks of two wheels, built once as a model of
// blocks and drawn from it. Lying across the picture it is seen straight from the side. Lying up
// and down the picture it is seen in one of three views, so that the same board can be compared
// in each: from straight in front, end on; from 45° above, as the fallen jug lies; or with its
// top at the floor's own scale, the way the floor is drawn.
import { INK } from './tip.js';

export const LIFT = 10;                        // px from the floor to the deck's top, where a load stands
export const VIEWS = { end: 'end on, from straight in front', tilt: 'from 45° above', top: 'top at the floor’s scale' };
const LEN = 44, HALF = 6;                      // px: the deck's length, and half its width
const TRUCKS = [10, 33];                       // px along the deck: where each truck is
const FOOT = 22;                               // the bottom row of a cell, from the cell's top
const K = Math.SQRT1_2;                        // what 45° above does to a length along the floor and to a height
const GRIP = '#262440', PLY = '#d9ac87', GRAPHIC = '#a84f38', PLATE = '#453d51', HANGER = '#67819e', AXLE = '#d6d3b0',
  WHEEL = '#d6d3b0', GLINT = '#f1eccb', HUB = '#a8826e', MARK = '#765c62', SHADOW = '#765c62';
// The eight places round a wheel's hub that its mark can be, clockwise from the top: (along, up).
const RING = [[0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1], [-1, 0], [-1, 1]];

const end = u => Math.min(u, LEN - 1 - u);
/** How far the deck has risen at `u` px along it: the kick of its nose and of its tail. */
const rise = u => end(u) < 6 ? [3, 3, 2, 1, 1, 0][end(u)] : 0;
/** Half the deck's width at `u` px along it: rounded at the nose and the tail. */
const halfAt = u => end(u) === 0 ? HALF - 2 : end(u) === 1 ? HALF - 1 : HALF;

/** The deck as blocks `{u, v, h, col, part}`: `u` px along it, `v` px across it (positive toward
 *  the viewer when it lies across the picture), `h` px up from the floor. */
const BLOCKS = (() => {
  const b = [], add = (u, v, h, col, part) => b.push({ u, v, h, col, part });
  for (let u = 0; u < LEN; u++) for (let v = -halfAt(u); v < halfAt(u); v++) {
    [GRAPHIC, PLY, GRIP].forEach((col, l) => add(u, v, 7 + rise(u) + l, col, 'deck'));
    add(u, v, 0, SHADOW, 'shadow');
  }
  TRUCKS.forEach((t, i) => {
    for (let u = t - 2; u <= t + 2; u++) for (let v = -2; v <= 1; v++) add(u, v, 6, PLATE, 'truck');
    for (let u = t - 1; u <= t + 1; u++) for (let v = -2; v <= 1; v++) add(u, v, 5, HANGER, 'truck');
    for (let v = -3; v <= 2; v++) add(t, v, 4, HANGER, 'truck');
    for (let v = -5; v <= 4; v++) add(t, v, 3, HANGER, 'truck');
    for (let v = -6; v <= 5; v++) add(t, v, 2, AXLE, 'truck');
    for (const [v0, outer] of [[-8, -8], [5, 7]]) for (let v = v0; v < v0 + 3; v++)
      for (let u = t - 2; u <= t + 2; u++) for (let h = 0; h <= 4; h++) {
        if (Math.abs(u - t) === 2 && (h === 0 || h === 4)) continue;
        const col = v !== outer ? WHEEL : u === t && h === 2 ? HUB : u === t - 1 && h === 3 ? GLINT : WHEEL;
        add(u, v, h, col, `wheel${i}${outer}`);
      }
  });
  return b;
})();

/** Where block `b` shows in each view, in px from the top-left of the two cells the deck covers,
 *  and `key`, how near the viewer it is: a nearer block is drawn over a farther one. */
const PROJECT = {
  side: b => ({ x: 2 + b.u, y: FOOT - b.h, key: b.v }),
  end: b => ({ x: 12 + b.v, y: 24 + FOOT - b.h, key: b.u }),
  tilt: b => ({ x: 12 + b.v, y: Math.round(24.5 + (3 + b.u - 24.5) * K - b.h * K), key: b.u + b.h }),
  top: b => ({ x: 12 + b.v, y: 3 + b.u - b.h, key: b.u + b.h }),
};

const CACHE = new Map();
/** The deck lying across the picture (`lie` 'x') or up and down it ('y', seen in `view`), its
 *  wheels turned `turn` eighths of a turn: px in px from the top-left of the two cells it covers.
 *  Its floor shadow is under everything; each wheel is inked round its outline. */
export function deck(lie, view, turn = 0) {
  const name = lie === 'x' ? 'side' : view, k = `${name},${name === 'side' ? ((turn % 8) + 8) % 8 : 0}`;
  if (CACHE.has(k)) return CACHE.get(k);
  const at = new Map();
  // Seen from above, the steps the model's kicks are built from would show their layers, where the
  // real deck curves and shows grip; only its near end shows the ply.
  const above = name === 'tilt' || name === 'top';
  for (const b of BLOCKS) {
    const p = PROJECT[name](b), key = b.part === 'shadow' ? -Infinity : p.key, was = at.get(`${p.x},${p.y}`);
    const col = above && b.part === 'deck' && b.u < LEN - 1 ? GRIP : b.col;
    if (!was || key >= was.key) at.set(`${p.x},${p.y}`, { ...p, key, col, part: b.part });
  }
  const px = [];
  for (const [, p] of at) {
    const ring = p.part.startsWith('wheel') && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => at.get(`${p.x + dx},${p.y + dy}`)?.part !== p.part);
    px.push([p.x, p.y, ring ? INK : p.col]);
  }
  // A wheel's turn shows as a mark on the face of each near wheel, round its hub.
  if (name === 'side') {
    const [du, dh] = RING[((turn % 8) + 8) % 8];
    for (const t of TRUCKS) {
      const x = 2 + t + du, y = FOOT - 2 - dh, i = px.findIndex(p => p[0] === x && p[1] === y);
      px[i] = [x, y, MARK];
    }
  }
  CACHE.set(k, px);
  return px;
}

/** The row a load's bottom stands on when it rides the deck in the cell whose bottom row is
 *  `foot`, the deck's two cells starting at row `y0`. */
export function standRow(lie, view, foot, y0) {
  if (lie === 'y' && view === 'tilt') return Math.round(y0 + 24.5 + (foot - y0 - 24.5) * K - LIFT * K);
  return foot - LIFT;
}
