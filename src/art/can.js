// The galvanized can seen straight from the side: open at the top, a tied bag standing in it with
// its neck over the rim, or lying on its side once a shove has tipped the bag out. Lying fallen
// toward the viewer it shows its open mouth; fallen away, its base.
import { paint, tipper, INK } from './tip.js';

export const CAN = { W: 20, H: 21, R: 9 };    // px: width with the handles, height, radius of the rim
const FOLD = 10;                              // px the can's foot moves as it falls toward the viewer or away
const DEEP = '#262440', DARK = '#453d51', MID = '#67819e', LIGHT = '#7dafb3', SHINE = '#d6d3b0';

/** Upright, from the front: the rolled rim, two ribs round the body, a handle each side, the body
 *  narrowing a step toward its foot, lit from the left like the box. */
export const front = (() => {
  const { W, H } = CAN, lo = r => r <= 2 ? 1 : r <= 11 ? 2 : 3;
  const handle = (c, r) => (c === 0 || c === W - 1) && r >= 5 && r <= 8 || (c === 1 || c === W - 2) && (r === 5 || r === 8);
  const inMask = (c, r) => r >= 0 && r < H && (c >= lo(r) && c <= W - 1 - lo(r) && !(r === 0 && (c === 1 || c === W - 2)) || handle(c, r));
  return paint(W, H, inMask, (c, r) => {
    if (handle(c, r) && (c < lo(r) || c > W - 1 - lo(r))) return INK;
    if (r === 1) return LIGHT;
    if (r === 2 || r === 9 || r === 16) return DARK;          // under the rim, under each rib
    if (r === 8 || r === 15) return LIGHT;                     // the ribs
    const f = (c - lo(r)) / (W - 1 - 2 * lo(r));
    return f > 0.2 && f < 0.3 ? SHINE : f >= 0.3 && f < 0.42 ? LIGHT : f > 0.78 ? DARK : MID;
  });
})();

const { W, R } = CAN, D = 2 * R, MID_C = (W - 1) / 2, MID_R = (D - 1) / 2;
const dist = (c, r) => Math.hypot(c - MID_C, r - MID_R);
const lug = (c, r) => (c === 0 || c === W - 1) && Math.abs(r - MID_R) < 1.5;   // a handle seen end on
const round = rad => (c, r) => dist(c, r) <= rad || lug(c, r);
/** Fallen toward the viewer: looking into the empty can past its rim. */
const mouth = paint(W, D, round(R), (c, r) => {
  const k = R - dist(c, r);
  return lug(c, r) ? INK : k < 2 ? (r < MID_R ? LIGHT : MID) : k < 3 ? DARK : k < 6 ? DEEP : INK;
});
/** Fallen away: the can's base, the rim's lip showing round it, a ring pressed into the middle. */
const base = paint(W, D, round(R), (c, r) => {
  const k = R - dist(c, r);
  return lug(c, r) ? INK : k < 1.6 ? (r < MID_R ? LIGHT : MID) : k < 2.6 ? INK : Math.abs(k - 5) < 0.6 ? (r < MID_R ? DARK : LIGHT) : MID;
});
export const { rest, restAt, frame } = tipper(front, mouth, base, FOLD);

/** Where the bag stands in the upright can: its top-left, in px from the can's, its neck over the rim. */
export const bagIn = bag => [Math.floor((W - bag.w) / 2), -7];

const trig = deg => {
  const d = ((deg % 360) + 360) % 360;
  return d === 0 ? [1, 0] : d === 90 ? [0, 1] : d === 180 ? [-1, 0] : d === 270 ? [0, -1]
    : [Math.cos(d * Math.PI / 180), Math.sin(d * Math.PI / 180)];
};
const SPUN = new Map();
/** Sprite `spr` turned `deg` degrees clockwise about the centre of its w×h box: its pixels in px
 *  from that box's top-left, some of them outside it. */
export function spun(spr, deg) {
  const key = `${spr.w},${spr.h},${spr.px.length},${deg}`;
  if (SPUN.has(key)) return SPUN.get(key);
  const [cos, sin] = trig(deg), cx = spr.w / 2, cy = spr.h / 2, m = new Map(spr.px.map(([x, y, col]) => [`${x},${y}`, col]));
  const reach = Math.ceil(Math.hypot(spr.w, spr.h) / 2) + 1, px = [];
  for (let y = Math.floor(cy) - reach; y <= Math.ceil(cy) + reach; y++)
    for (let x = Math.floor(cx) - reach; x <= Math.ceil(cx) + reach; x++) {
      const u = x + 0.5 - cx, v = y + 0.5 - cy, col = m.get(`${Math.floor(u * cos + v * sin + cx)},${Math.floor(-u * sin + v * cos + cy)}`);
      if (col) px.push([x, y, col]);
    }
  const out = { w: spr.w, h: spr.h, px };
  SPUN.set(key, out);
  return out;
}
