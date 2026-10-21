// Room furniture the trash benches share.
import { cellSeed } from '../../../src/stage.js';

/** A brick wall filling cell (cx, cy) of side C. */
export function wallTile(g, cx, cy, C) {
  const x0 = cx * C, y0 = cy * C;
  g.fillStyle = '#34192b'; g.fillRect(x0, y0, C, C);
  for (let r = 0; r < C / 4; r++) for (let k = -1; k <= C / 8; k++) {
    const bx = x0 + k * 8 + (r % 2) * 4, x1 = Math.max(bx, x0), x2 = Math.min(bx + 7, x0 + C);
    if (x2 <= x1) continue;
    g.fillStyle = cellSeed(cx * 7 + k, cy * 9 + r) % 3 ? '#6f383a' : '#a84f38';
    g.fillRect(x1, y0 + r * 4, x2 - x1, 3);
  }
}
