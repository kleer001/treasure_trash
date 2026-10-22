// The recycling box seen straight from the side: upright with its trash sticking up over the rim,
// or lying on its side once a shove has tipped it, which way it lies telling which way it fell.
// Lying fallen toward the viewer it shows its open mouth; fallen away, its base.
import { mulberry32 } from '../../../src/rng.js';
import { chooser, sizes } from './pile.js';
import { hash } from './spread.js';
import { paint, tipper, INK } from './tip.js';

export const BOX = { W: 22, H: 16, D: 14 };   // px: rim width, height, depth front to back
const FOLD = 12;                              // px the box's foot moves as it falls toward the viewer or away
const DEEP = '#2b2d55', DARK = '#244287', MID = '#3169b0', LIGHT = '#7dafb3', MARK = '#f1eccb';

/** Upright, from the front: the rim's lip, the wall narrowing to the base, the recycling mark. */
export const front = (() => {
  const { W, H } = BOX, lo = r => r <= 3 ? 0 : 1 + Math.floor((r - 4) / 5);
  const inMask = (c, r) => r >= 0 && r < H && c >= lo(r) && c <= W - 1 - lo(r) && !(r === 0 && (c === 0 || c === W - 1));
  const MARKED = { 7: [10, 11], 8: [9, 12], 9: [8, 13], 10: [8, 9, 10, 11, 12, 13] };
  return paint(W, H, inMask, (c, r) => MARKED[r]?.includes(c) ? MARK : r === 1 ? LIGHT : r === 2 ? MID
    : r === 3 || r === H - 2 ? DARK : c === lo(r) + 1 ? LIGHT : c === W - 2 - lo(r) ? DARK : MID);
})();

const ring = (c, r, w, h) => Math.min(c, r, w - 1 - c, h - 1 - r);
const square = (w, h) => (c, r) => c >= 0 && r >= 0 && c < w && r < h && !((c === 0 || c === w - 1) && (r === 0 || r === h - 1));
/** Fallen toward the viewer: looking into the empty box past its rim. */
const mouth = paint(BOX.W, BOX.D, square(BOX.W, BOX.D), (c, r) => {
  const k = ring(c, r, BOX.W, BOX.D);
  return k === 1 ? (r === 1 ? LIGHT : MID) : k === 2 ? MID : k === 3 ? DARK : k === 4 ? DEEP : INK;
});
/** Fallen away: the box's base, the rim's lip showing round it. */
const base = paint(BOX.W, BOX.D, square(BOX.W, BOX.D), (c, r) => {
  const k = ring(c, r, BOX.W, BOX.D);
  return k === 1 ? (r === 1 ? LIGHT : MID) : k === 2 ? INK : r === 3 ? LIGHT : r === 5 || r === BOX.D - 6 ? DARK : MID;
});
export const { rest, restAt, frame } = tipper(front, mouth, base, FOLD);

/** What a full box holds, from its own `seed`: a count between `min` and `max`, each piece's look
 *  from its own hash (or one set of accent hues for the box when `hues` is 'cell'), `bx, by`, where
 *  its centre sits in the upright box, heaped over the rim and highest in the middle, and `d`, how
 *  far back from the front. */
export function contents(T, seed, { min, max }, hues) {
  const { W, D } = BOX, HEAP = 5, rnd = mulberry32(hash(seed, 1)), n = min + Math.floor(rnd() * (max - min + 1));
  const shared = hues === 'cell' ? chooser(T, mulberry32(hash(seed, 7))) : null;
  return sizes(n).map((size, i) => {
    const r = mulberry32(hash(seed, 2, i));
    const p = shared ? shared(size, r) : chooser(T, r)(size, r);
    const bx = 3 + r() * (W - 6), across = (bx - W / 2) / (W / 2 - 3);
    return { ...p, bx, by: 1 - r() * (1 + HEAP * (1 - across * across)), d: 2 + r() * (D - 4) };
  });
}
