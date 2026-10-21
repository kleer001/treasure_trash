// The recycling box seen straight from the side: upright with its trash sticking up over the rim,
// or lying on its side once a shove has tipped it, which way it lies telling which way it fell.
//
// A fall left or right turns the box in the picture about its bottom corner. A fall toward the
// viewer or away folds it instead: the front face shortens as the face it falls onto the view
// grows in — the open mouth falling toward the viewer, the base falling away.
import { mulberry32 } from '../../../src/rng.js';
import { chooser, sizes } from './pile.js';
import { hash } from './spread.js';

export const BOX = { W: 22, H: 16, D: 14 };   // px: rim width, height, depth front to back
const FOLD = 12;                              // px the box's foot moves as it falls toward the viewer or away
const INK = '#19152b', DEEP = '#2b2d55', DARK = '#244287', MID = '#3169b0', LIGHT = '#7dafb3', MARK = '#f1eccb';

/** A w×h drawing of the pixels `inMask` holds: ink where one touches the outside, `colour` within. */
function paint(w, h, inMask, colour) {
  const px = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (inMask(c, r)) {
    const edge = !inMask(c + 1, r) || !inMask(c - 1, r) || !inMask(c, r + 1) || !inMask(c, r - 1);
    px.push([c, r, edge ? INK : colour(c, r)]);
  }
  return { w, h, px };
}

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
/** The front turned a quarter: clockwise lays its rim to the right. */
const quarter = cw => ({ w: front.h, h: front.w,
  px: front.px.map(([x, y, col]) => cw ? [front.h - 1 - y, x, col] : [y, front.w - 1 - x, col]) });
const RESTS = { r: quarter(true), l: quarter(false), d: mouth, u: base };

/** The empty box lying where it fell toward `dir`. */
export const rest = dir => RESTS[dir];

/** The top-left of the box in cell (cx, cy), upright, or lying where it fell toward `fell`. Its foot
 *  stands one pixel above the cell's bottom edge, as every sprite's does. */
export function restAt(cx, cy, C, fell = null) {
  const s = fell ? RESTS[fell] : front;
  return [cx * C + Math.floor((C - s.w) / 2), cy * C + C - s.h - 1];
}

const trig = deg => deg === 0 ? [1, 0] : deg === 90 ? [0, 1] : [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
const at = spr => { const m = new Map(spr.px.map(([x, y, col]) => [`${x},${y}`, col])); return (x, y) => m.get(`${x},${y}`); };
const FRONT = at(front);

/** A drawing from `px` in px from the upright box's top-left: `s`, and `ox, oy`, where it goes. */
function placed(px) {
  const ox = Math.min(...px.map(p => p[0])), oy = Math.min(...px.map(p => p[1]));
  return { s: { w: Math.max(...px.map(p => p[0])) - ox + 1, h: Math.max(...px.map(p => p[1])) - oy + 1,
    px: px.map(([x, y, col]) => [x - ox, y - oy, col]) }, ox, oy };
}

/** A fall left or right, `deg` degrees over: the front turned about its bottom corner on that side. */
function turned(dir, deg) {
  const { W, H } = BOX, [cos, sin] = trig(deg), sg = dir === 'r' ? 1 : -1, pv = [dir === 'r' ? W : 0, H];
  const fwd = (u, v) => [u * cos - sg * v * sin, sg * u * sin + v * cos];
  const back = (u, v) => [u * cos + sg * v * sin, -sg * u * sin + v * cos];
  const toBox = (x, y) => { const [u, v] = back(x + 0.5 - pv[0], y + 0.5 - pv[1]); return [u + pv[0], v + pv[1]]; };
  const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => fwd(x - pv[0], y - pv[1]));
  const xs = corners.map(p => p[0] + pv[0]), ys = corners.map(p => p[1] + pv[1]), px = [];
  for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++)
    for (let x = Math.floor(Math.min(...xs)); x < Math.ceil(Math.max(...xs)); x++) {
      const [bx, by] = toBox(x, y), col = FRONT(Math.floor(bx), Math.floor(by));
      if (col) px.push([x, y, col]);
    }
  return { ...placed(px),
    place: (bx, by) => { const [u, v] = fwd(bx - pv[0], by - pv[1]); return [u + pv[0], v + pv[1]]; },
    shows: (x, y) => { const [bx, by] = toBox(x, y); return by < 0 && bx >= 1 && bx < W - 1; } };
}

/** A fall toward the viewer ('d') or away ('u'), `deg` degrees over: two faces stacked from the
 *  foot up, each squeezed to the height it shows at that angle. */
function folded(dir, deg) {
  const { W, H, D } = BOX, [cos, sin] = trig(deg), toward = dir === 'd';
  const bottom = H + Math.round((toward ? 1 : -1) * FOLD * (1 - cos));
  const faces = toward ? [[at(front), H, H * cos], [at(mouth), D, D * sin]] : [[at(base), D, D * sin], [at(front), H, H * cos]];
  const rim = faces[0][2] + (toward ? 0 : faces[1][2]);        // how high the front face's top edge stands
  const px = [];
  for (let y = bottom - (H + D); y < bottom; y++) {
    let up = bottom - y - 0.5, src = null;
    for (const [face, h, shown] of faces) {
      if (up < shown) { src = [face, h - 1 - Math.floor(up / (shown / h))]; break; }
      up -= shown;
    }
    if (src) for (let x = 0; x < W; x++) { const col = src[0](x, src[1]); if (col) px.push([x, y, col]); }
  }
  return { ...placed(px),
    place: (bx, by, d) => [bx, bottom - ((H - by) * cos + (toward ? d : D - d) * sin)],
    shows: (x, y) => x >= 1 && x < W - 1 && bottom - y - 0.5 >= rim };
}

const FRAMES = new Map();
/** The box `deg` degrees into a fall toward `dir`, 0 upright and 90 lying where it fell: its
 *  drawing `s` at `ox, oy`, `place(bx, by, d)`, where a point of the upright box `d` px back from
 *  its front has gone, and `shows(x, y)`, whether the box's contents show at that pixel or the box
 *  hides them. All in px from the upright box's top-left. */
export function frame(dir, deg) {
  const key = `${dir},${deg}`;
  if (!FRAMES.has(key)) FRAMES.set(key, dir === 'l' || dir === 'r' ? turned(dir, deg) : folded(dir, deg));
  return FRAMES.get(key);
}

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
