// The pane of glass seen straight from the side, and the shards it leaves on the floor.
import { paint, tipper } from './tip.js';
import { hash } from './spread.js';

export const PANE = { W: 18, H: 20 };
const FOLD = 20;                              // px the pane's foot moves
const FRAME = '#67819e', TINT = '#7dafb3', GLINT = '#f1eccb', PALE = '#d6d3b0';

const face = (w, h) => {
  const s = paint(w, h, (c, r) => c >= 0 && r >= 0 && c < w && r < h, (c, r) => {
    if (c === 1 || r === 1 || c === w - 2 || r === h - 2) return (c + r) % 3 ? TINT : FRAME;
    const d = c + r;
    return d === Math.round(h * 0.55) || d === Math.round(h * 0.55) + 1 ? GLINT : d === Math.round(h * 0.55) + 4 ? PALE
      : (c * 7 + r * 3) % 11 === 0 ? TINT : null;
  });
  return { ...s, px: s.px.filter(p => p[2]) };
};
export const front = face(PANE.W, PANE.H);
export const { frame, restAt } = tipper(front, face(PANE.W, PANE.H), face(PANE.W, PANE.H), FOLD);

const SHAPES = [
  [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [0, 2]],
  [[0, 0], [1, 0], [1, 1], [2, 1], [2, 2]],
  [[0, 0], [1, 0], [2, 0], [3, 0], [1, 1], [2, 1]],
  [[0, 0], [0, 1], [1, 1], [0, 2], [1, 2], [2, 2], [0, 3]],
  [[0, 0], [1, 1], [2, 2]],
  [[0, 0], [1, 0], [0, 1]],
];
/** The shards on the floor of glass cell (cx, cy): each one's top-left `x, y` in px from the board's
 *  top-left, and its pixels `px` from there. */
export function shards(cx, cy, C) {
  const n = 9 + hash(cx, cy, 11) % 5;
  return Array.from({ length: n }, (_, i) => {
    const h = hash(cx, cy, 12, i), shape = SHAPES[h % SHAPES.length], flip = (h >>> 4) & 3;
    const pts = shape.map(([x, y]) => [flip & 1 ? 3 - x : x, flip & 2 ? 3 - y : y]);
    const glint = (h >>> 6) % pts.length;
    return { x: cx * C + 2 + (h >>> 9) % (C - 7), y: cy * C + 2 + (h >>> 15) % (C - 7),
             px: pts.map(([x, y], k) => [x, y, k === glint ? GLINT : k % 2 ? TINT : PALE]) };
  });
}
