// A water cell seen from above.
import { mulberry32 } from '../rng.js';
import { hash, noise } from './spread.js';
import { chooser } from './pile.js';

const EDGE = '#2b2d55', DEEP = '#244287', MID = '#3169b0', LIGHT = '#7dafb3', SHINE = '#f1eccb';
/** The water's colours: its rim, its shaded edge, its body, its ripples and its brightest glint. */
export const WATER = { EDGE, DEEP, MID, LIGHT, SHINE };
const SLUDGE = '#67819e';                     // the packed crossing between its scraps
const ROUND = 4;                              // px
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** Whether cell-local pixel (x, y) of cell (cx, cy) is in its water, and whether it is the rim
 *  where the water meets dry ground. `wet(x, y)` says whether a neighbouring cell is water too. */
export function outline(cx, cy, C, wet) {
  const dry = { l: !wet(cx - 1, cy), r: !wet(cx + 1, cy), u: !wet(cx, cy - 1), d: !wet(cx, cy + 1) };
  const lo = [dry.l ? 1 : 0, dry.u ? 1 : 0], hi = [dry.r ? C - 2 : C - 1, dry.d ? C - 2 : C - 1];
  const inside = (x, y) => {
    if (x < 0 || x >= C || y < 0 || y >= C) return !dry[x < 0 ? 'l' : x >= C ? 'r' : y < 0 ? 'u' : 'd'];
    if (x < lo[0] || y < lo[1] || x > hi[0] || y > hi[1]) return false;
    for (const [sx, sy, ax, ay] of [['l', 'u', lo[0], lo[1]], ['r', 'u', hi[0], lo[1]], ['l', 'd', lo[0], hi[1]], ['r', 'd', hi[0], hi[1]]]) {
      if (!dry[sx] || !dry[sy]) continue;
      const kx = ax + (sx === 'l' ? ROUND : -ROUND), ky = ay + (sy === 'u' ? ROUND : -ROUND);
      if ((sx === 'l' ? x < kx : x > kx) && (sy === 'u' ? y < ky : y > ky) && Math.hypot(x - kx, y - ky) > ROUND) return false;
    }
    return true;
  };
  const rim = (x, y) => !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
  return { inside, rim };
}

/** The pixels of the puddle in cell (cx, cy), in px from the board's top-left. */
export function puddle(cx, cy, C, wet) {
  const { inside, rim } = outline(cx, cy, C, wet);
  const glint = [2, 3, 4].map(k => { const h = hash(cx, cy, k); return [3 + h % (C - 9), 3 + (h >>> 8) % (C - 7)]; });
  const px = [];
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
    if (!inside(x, y)) continue;
    const ripple = glint.findIndex(([gx, gy]) => y === gy && x >= gx && x < gx + 4);
    px.push([cx * C + x, cy * C + y, rim(x, y) ? EDGE : ripple >= 0 ? (x === glint[ripple][0] + 1 && ripple === 0 ? SHINE : LIGHT)
      : !inside(x, y - 1) || !inside(x - 1, y) ? DEEP : MID]);
  }
  return px;
}

const SOAKED = [[0.06, '#262440'], [0.15, '#453d51'], [0.3, '#67819e'], [0.55, LIGHT], [Infinity, '#d6d3b0']];
const SOAKS = new Map();
export function soaked(hex) {
  if (!SOAKS.has(hex)) {
    const lin = [1, 3, 5].map(i => { const c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; });
    const lum = 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
    SOAKS.set(hex, SOAKED.find(([top]) => lum < top)[1]);
  }
  return SOAKS.get(hex);
}

/** The pixels of the crossing trash has packed water cell (cx, cy) into, in px from the board's top-left. */
export function crossing(T, cx, cy, C, wet, bits) {
  const { inside, rim } = outline(cx, cy, C, wet), rnd = mulberry32(hash(cx, cy, 21)), choose = chooser(T, rnd);
  const at = new Map();
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) if (inside(x, y)) at.set(`${x},${y}`, rim(x, y) ? EDGE : SLUDGE);
  const side = Math.ceil(Math.sqrt(bits)), step = C / side;
  for (let i = 0; i < bits; i++) {
    const p = choose(rnd() < 0.75 ? 'bit' : 'mid'), s = T.sprite(p.name, p.alt, p.turn);
    const x0 = Math.round((i % side + rnd()) * step - s.w / 2), y0 = Math.round((Math.floor(i / side) + rnd()) * step - s.h / 2);
    for (const [px, py, col] of s.px) {
      const k = `${x0 + px},${y0 + py}`;
      if (at.has(k) && !rim(x0 + px, y0 + py)) at.set(k, soaked(col));
    }
  }
  return [...at].map(([k, col]) => { const [x, y] = k.split(',').map(Number); return [cx * C + x, cy * C + y, col]; });
}

/** A threshold in [0, 1) at board pixel (x, y): ordered 'dither', soft 'noise' blobs `look.scale`
 *  px across, or 'speckle'. */
const threshold = (look, x, y) => look.pattern === 'dither' ? (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16
  : look.pattern === 'speckle' ? hash(x, y, 41) / 4294967296 : noise(43, x, y, look.scale);

/** Every pixel of the water and crossing cells of an N×N board, keyed 'x,y' from its top-left: `water`, its colour as open water; `packed`, its colour where a crossing reaches it, else null; and `owner`, the crossing cell that reaches it. `kind(x, y)` is 'water', 'crossing' or dry. */
export function canal(T, N, C, kind, look) {
  const wet = (x, y) => kind(x, y) === 'water' || kind(x, y) === 'crossing';
  const seams = [];
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) if (kind(cx, cy) === 'crossing')
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (kind(cx + dx, cy + dy) === 'water') {
      const x = (cx + (dx > 0)) * C, y = (cy + (dy > 0)) * C;
      seams.push({ cell: [cx, cy], x0: dx ? x : cx * C, x1: dx ? x : (cx + 1) * C, y0: dy ? y : cy * C, y1: dy ? y : (cy + 1) * C });
    }
  const width = look.inside + look.outside;
  /** How surely a pixel `d` px inside a crossing (outside it when negative) is packed. */
  const reach = d => (width ? Math.max(0, Math.min(1, (d + look.outside) / width)) : d > 0 ? 1 : 0) ** (look.curve / 10);
  const px = new Map();
  for (let cy = 0; cy < N; cy++) for (let cx = 0; cx < N; cx++) {
    if (!wet(cx, cy)) continue;
    const own = kind(cx, cy) === 'crossing', { rim } = outline(cx, cy, C, wet);
    const mat = new Map(crossing(T, cx, cy, C, wet, look.bits).map(([x, y, col]) => [`${x},${y}`, col]));
    for (const [x, y, col] of puddle(cx, cy, C, wet)) {
      let near = Infinity, owner = own ? [cx, cy] : null;
      for (const s of seams) {
        const d = Math.hypot(Math.max(s.x0 - x - 0.5, 0, x + 0.5 - s.x1), Math.max(s.y0 - y - 0.5, 0, y + 0.5 - s.y1));
        if (d < near) { near = d; if (!own) owner = s.cell; }
      }
      const k = `${x},${y}`, m = mat.get(k), d = (own ? near : -near) + (m === SLUDGE ? 0 : look.outlast);
      const packed = rim(x - cx * C, y - cy * C) || !owner ? (own ? m : null) : reach(d) > threshold(look, x, y) ? m : null;
      px.set(k, { water: col, packed, owner });
    }
  }
  return px;
}
