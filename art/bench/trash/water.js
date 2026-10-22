// A water cell seen from above: a puddle out to the cell's edge where the next cell is dry, run
// into its neighbour where that one is wet, its ripples placed from the cell's own hash.
import { hash } from './spread.js';

const EDGE = '#2b2d55', DEEP = '#244287', MID = '#3169b0', LIGHT = '#7dafb3', SHINE = '#f1eccb';
const ROUND = 4;                              // px: the radius of a corner where both sides are dry

/** The pixels of the puddle in cell (cx, cy), in px from the board's top-left. `wet(x, y)` says
 *  whether a neighbouring cell is water too. */
export function puddle(cx, cy, C, wet) {
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
  const glint = [2, 3, 4].map(k => { const h = hash(cx, cy, k); return [3 + h % (C - 9), 3 + (h >>> 8) % (C - 7)]; });
  const px = [];
  for (let y = 0; y < C; y++) for (let x = 0; x < C; x++) {
    if (!inside(x, y)) continue;
    const rim = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
    const ripple = glint.findIndex(([gx, gy]) => y === gy && x >= gx && x < gx + 4);
    px.push([cx * C + x, cy * C + y, rim ? EDGE : ripple >= 0 ? (x === glint[ripple][0] + 1 && ripple === 0 ? SHINE : LIGHT)
      : !inside(x, y - 1) || !inside(x - 1, y) ? DEEP : MID]);
  }
  return px;
}
