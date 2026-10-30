// The galvanized can seen from the side and a little above: open at the top, its rim an ellipse round
// the dark inside, a tied bag standing in it with its neck over the rim, or lying on its side once a
// shove has tipped the bag out. Lying fallen toward the viewer it shows its open mouth; fallen away,
// its base.
import { tipper } from './tip.js';

export const CAN = { W: 22, H: 26, R: 10 };   // px: width with the handles, height, radius of the rim
const FOLD = 10;                              // px the can's foot moves as it falls toward the viewer or away

export const ZINC = { ink: '#1e2128', deep: '#3e434d', dark: '#5d646f', mid: '#868d97', light: '#adb3bb', shine: '#dde0e3' };
const HANDLE = 3;                             // px a side handle stands out from the body
/** The galvanized can upright, from the side, no lid: a rolled rim, a smooth band under it with a
 *  wire handle each side, fluted between a rib above and a rib below, a smooth foot band. `r` is
 *  the body's half-width at the top, `h` its height, `taper` how many px each side it narrows to its
 *  foot, `flutes` how many go round it. The rim, the bands and the handles keep their size. */
export function galvanized({ r, h, taper, flutes }) {
  const W = 2 * r + 2 * HANDLE, Z = ZINC, px = [];
  const left = y => y < 2 ? HANDLE - 1 : HANDLE + Math.round(taper * (y - 2) / Math.max(1, h - 3));
  const inBody = (x, y) => y >= 0 && y < h && x >= left(y) && x <= W - 1 - left(y);
  const handle = (x, y) => { const c = Math.min(x, W - 1 - x); return (y === 2 || y === 6) && c < HANDLE || c === 0 && y > 2 && y < 6; };
  const ribs = { 2: Z.deep, 3: Z.light, 6: Z.light, 7: Z.deep, [h - 6]: Z.deep, [h - 5]: Z.light, [h - 4]: Z.dark };
  for (let y = 0; y < h; y++) for (let x = 0; x < W; x++) {
    if (!inBody(x, y)) { if (handle(x, y)) px.push([x, y, y === 2 ? Z.light : Z.dark]); continue; }
    if (!inBody(x - 1, y) || !inBody(x + 1, y) || !inBody(x, y - 1) || !inBody(x, y + 1)) { px.push([x, y, Z.ink]); continue; }
    const L = left(y), u = (x + 0.5 - L) / (W - 2 * L);       // 0 at the left edge, 1 at the right
    const lit = u < 0.18 ? Z.mid : u < 0.3 ? Z.shine : u < 0.45 ? Z.light : u > 0.8 ? Z.dark : Z.mid;
    if (y === 1) { px.push([x, y, Z.shine]); continue; }
    if (ribs[y]) { px.push([x, y, u > 0.8 && ribs[y] === Z.light ? Z.mid : ribs[y]]); continue; }
    const fluted = y > 7 && y < h - 6 && flutes > 0;
    // A flute's place round the can, seen from the side: crowded toward the edges.
    const turn = fluted ? (Math.asin(2 * u - 1) / Math.PI + 0.5) * flutes / 2 : 0, k = turn - Math.floor(turn);
    px.push([x, y, !fluted ? lit : k < 0.3 ? (u > 0.8 ? Z.mid : Z.light) : k > 0.6 && k < 0.85 ? (u > 0.8 ? Z.deep : Z.dark) : lit]);
  }
  return { w: W, h, px };
}

/** Upright: drawn by hand over the painted can wrapped round a cylinder and seen 30° from above.
 *  One letter a pixel, '.' for none. */
const ROWS = [
  ".......kkkkkkkk.......",
  "....kkksssssssskkk....",
  "..kksssddddddddssskk..",
  ".kssdddDDDDDDDDdddssk.",
  ".ksddDDDDDDDDDDDDddsk.",
  ".ksdDDDDDDDDDDDDDDdsk.",
  "mlssDDDDDDDDDDDDDDsslm",
  "mDkksssDDDDDDDDssskkDm",
  "m.kskkksssssssskkksk.m",
  "mDkDssskkkkkkkksssDkDm",
  ".dklDDDssssssssDDDmkd.",
  "..kmlllDDDDDDDDmmmdk..",
  "...kmsslllllllmmddk...",
  "...kDsslllmmmmmmdDk...",
  "...klDDDllmmllDDDDk...",
  "...klmslDDDDDDmldDk...",
  "...klmslldmlmdmldDk...",
  "...klmslldmlmdmldDk...",
  "...klmslldmlmdmldDk...",
  "...klmslldmlmdmldDk...",
  "....kmslldmlmdmldk....",
  "....kllDldmlmdDmmk....",
  "....kddllllllllddk....",
  "....kmmsddddddmddk....",
  ".....kmsllmmmmmdk.....",
  "......kkkkkkkkkk......",
];
const LETTERS = { k: ZINC.ink, D: ZINC.deep, d: ZINC.dark, m: ZINC.mid, l: ZINC.light, s: ZINC.shine };
// What a bag standing in the can shows over: everything above the near rim, so the far rim and the
// inside. Down each column to the last row of the inside, or the top of the far rim where none shows.
const INSIDE = x => Math.max(2, ...ROWS.slice(0, 8).flatMap((r, y) => ('dD'.includes(r[x]) ? [y] : [])));
const OPEN = new Set(ROWS[0].split('').flatMap((_, x) => Array.from({ length: INSIDE(x) + 1 }, (_, y) => `${x},${y}`)));
/** Letter rows as a drawing. */
const drawn = rows => ({ w: rows[0].length, h: rows.length,
  px: rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === '.' ? [] : [[x, y, LETTERS[c]]]))) });
/** Fallen toward the viewer: its open mouth, seen past the rim, the side above it running back to
 *  the foot: the painted can traced as a solid and turned 120° about X. */
const mouth = drawn([
  "........kkkkkk........",
  "......kklDDDDmkk......",
  ".....kmDldmlmdDdk.....",
  ".....kslldmlmdmlk.....",
  "....kmslldmlmdmldk....",
  "....kmslllmmllmldk....",
  "...klmllllmmmmmldDk...",
  "...klssskkkkkksmdmk...",
  "...kmssssssssssssdk...",
  "...kksskkkkkkkksskk...",
  "..kkskkkkkkkkkkkkskk..",
  "..kskkkkkkkkkkkkkksk..",
  ".dsDkkkkkkkkkkkkkkDsd.",
  "mkskkkkkkkkkkkkkkkkskm",
  "mskkkkkkkkkkkkkkkkkksm",
  "msDDkkkkkkkkkkkkkkDDsm",
  ".kDDkkkkkkkkkkkkkkDDk.",
  ".kDDDkkkkkkkkkkkkDDDk.",
  ".ksDDDkkkkkkkkkkDDDsk.",
  "..kDDDDDkkkkkkDDDDDk..",
  "..ksDDDDDDDDDDDDDDsk..",
  "...ksdDDDDDDDDDDdsk...",
  "....kkdDDDDDDDDdkk....",
  "......kkddddddkk......",
  "........kkkkkk........",
]);
/** Fallen away: its base, pressed with a ring, the side above it running back to the rim. Drawn by
 *  hand over the same solid turned −60° about X. */
const base = drawn([
  "........kkkkkk........",
  "......kksssssskk......",
  "....kkssDDDDDDsskk....",
  "...kssDlllmmmmlDssk...",
  "..ksDllllllllllmmDsk..",
  "..kDmsllllDDllllddDk..",
  ".ksllllDldmlmdDlmmmsk.",
  ".kkllDslldmlmdmlDmmkk.",
  ".kklDmslldmlmdmldDmkk.",
  "mlkllmsllDDDDdmldDmklm",
  "mDkklmsDDDDDDDDldDkkDm",
  "mdkklDDDlddddlDDDDkkdm",
  ".dkkDDDddddddddDDDkkd.",
  "..kkDDkkkkkkkkkkDDkk..",
  "..kkDkmmmmmmmmmmkDkk..",
  "...kkmmmllllllmmmkk...",
  "...kmmlllmmmmlllmmk...",
  "...kmmlmmddddmmlmmk...",
  "...kmlmmddddddmmlmk...",
  "....kmlmddddddmlmk....",
  "....kmlmmddddmmlmk....",
  ".....kmllmmmmllmk.....",
  ".....kmmllllllmmk.....",
  "......kkmmmmmmkk......",
  "........kkkkkk........",
]);
export const front = drawn(ROWS);

/** The can as it was painted, straight from the side: the solid a fall toward the viewer or away is
 *  traced from. Each row a slice of the round can, from its first ink pixel to its last; what lies
 *  outside that is a handle. */
const PAINTED = [
  "....kkkkkkkkkkkkkkkkkkkk....",
  "....kssssssssssssssssssk....",
  "...mlkDDDDDDDDDDDDDDDDklm...",
  "...mDklllllllllllllmmmkDm...",
  "...m.kmmsslllmmmmmmdddk.m...",
  "...mDkmmsslllmmmmmmdddkDm...",
  "....dklllllllllllllmmmkd....",
  "......kDDDDDDDDDDDDDDk......",
  "......klmslldmlmdmldDk......",
  "......klmslldmlmdmldDk......",
  "......klmslldmlmdmldDk......",
  "......klmslldmlmdmldDk......",
  "......klmslldmlmdmldDk......",
  "......klmslldmlmdmldDk......",
  "......klmslldmlmdmldDk......",
  "......kDDDDDDDDDDDDDDk......",
  ".......kllllllllllmmk.......",
  ".......kddddddddddddk.......",
  ".......kmmsllmmmmmddk.......",
  ".......kmmsllmmmmmddk.......",
  ".......kkkkkkkkkkkkkk.......",
];
const PH = PAINTED.length, PCX = PAINTED[0].length / 2, VIEW = 30;   // VIEW: degrees the eye looks down
const SLICES = PAINTED.map(r => { const a = r.indexOf('k'), b = r.lastIndexOf('k'); return { a, b, hw: (b - a + 1) / 2 }; });
const HANDLES = PAINTED.flatMap((r, k) => [...r].flatMap((ch, c) => (ch === '.' || (c >= SLICES[k].a && c <= SLICES[k].b) ? []
  : [{ x: c - PCX, h: PH - 1 - k, ch }])));
const FOOT = SLICES[PH - 1].hw, FX = (CAN.W) / 2;
// px down the upright drawing to the level of the foot's centre: its front edge is its bottom row.
const BASE_Y = CAN.H + FOOT * Math.sin(VIEW * Math.PI / 180);
/** Turns (h, z) by `deg` about the x axis: up the can and toward the viewer. */
const turnX = (h, z, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a); return [h * c - z * s, h * s + z * c]; };

/** The can `deg` degrees into a fall toward the viewer ('d') or away ('u'), about the edge of its
 *  foot on that side, traced pixel by pixel from the painted solid as the eye sees it, VIEW degrees
 *  down. Upright and lying it is the hand-drawn can. In px from the upright drawing's top-left. */
function fall(dir, deg) {
  const sg = dir === 'd' ? 1 : -1, zp = sg * FOOT, a = VIEW + sg * deg;
  // Where a point of the can, `x` across, `h` up and `z` toward the viewer, shows: px from the top-left.
  const seen = (x, h, z) => { const [u, w] = turnX(h, z - zp, sg * deg), [up] = turnX(u, w + zp, VIEW); return [x + FX, BASE_Y - up]; };
  const place = (bx, by, d) => {
    const z = CAN.R - d, h = (BASE_Y - by + z * Math.sin(VIEW * Math.PI / 180)) / Math.cos(VIEW * Math.PI / 180);
    return seen(bx - FX, h, z);
  };
  if (deg === 0) return { px: front.px, place, shows: (x, y) => OPEN.has(`${x},${y}`) || y < 0 && x >= 1 && x < CAN.W - 1 };
  const hits = traced(seen, sg, zp, deg);
  if (deg === 90) {
    // Lying: the hand-drawn end, where the traced one lies.
    const d = dir === 'd' ? mouth : base, xs = [...hits.keys()].map(k => +k.split(',')[0]), ys = [...hits.keys()].map(k => +k.split(',')[1]);
    const x0 = Math.round((Math.min(...xs) + Math.max(...xs) + 1 - d.w) / 2), y0 = Math.max(...ys) + 1 - d.h;
    return { px: d.px.map(([x, y, c]) => [x + x0, y + y0, c]), place };
  }
  const px = [];
  for (const [key, ch] of hits) {
    const [x, y] = key.split(',').map(Number);
    const edge = ch[0] !== 'h' && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([p, q]) => !hits.has(`${x + p},${y + q}`));
    px.push([x, y, LETTERS[edge ? 'k' : ch.length > 1 ? ch[1] : ch]]);
  }
  // The inside and the rim's lip show what the can holds over them, as does the air round it.
  return { px, place, shows: (x, y) => { const ch = hits.get(`${x},${y}`); return !ch || ch[0] === 'i'; } };
}

/** What each pixel sees of the can tipped `deg` about the foot edge at `zp`: a letter for its
 *  outside, 'h' or 'i' and a letter for a handle or for the inside and the rim's lip. Rays march into the screen through its sheet metal, a
 *  pixel thick. */
function traced(seen, sg, zp, deg) {
  const corners = [];
  for (const x of [-PCX, PCX]) for (const h of [0, PH]) for (const z of [-PCX, PCX]) corners.push(seen(x, h, z));
  const xs = corners.map(c => c[0]), ys = corners.map(c => c[1]), hits = new Map();
  const back = (sx, sy, depth) => {
    // The screen point (sx, sy) at `depth` toward the viewer, in the can's own x, h, z.
    const up = BASE_Y - sy, [u, w] = turnX(up, depth, -VIEW), [h, z] = turnX(u, w - zp, -sg * deg);
    return [sx - FX, h, z + zp];
  };
  for (let y = Math.floor(Math.min(...ys)) - 1; y <= Math.ceil(Math.max(...ys)) + 1; y++)
    for (let x = Math.floor(Math.min(...xs)) - 1; x <= Math.ceil(Math.max(...xs)) + 1; x++) {
      let prev = null, hit = null;
      for (let depth = 40; depth > -40 && !hit; depth -= 0.2) {
        const [px_, h, z] = back(x + 0.5, y + 0.5, depth);
        if (Math.abs(z) < 0.5 && px_ < -FX + 3 || Math.abs(z) < 0.5 && px_ > FX - 3) {
          const q = HANDLES.find(q => px_ >= q.x && px_ < q.x + 1 && h >= q.h && h < q.h + 1);
          if (q) { hit = 'h' + q.ch; break; }
        }
        if (h >= 0 && h < PH) {
          const row = PH - 1 - Math.floor(h), { a, b, hw } = SLICES[row], r = Math.hypot(px_, z);
          if (h < 1 && r <= hw) hit = prev && prev[1] < 0 ? (Math.abs(r - (hw - 3)) < 0.7 ? 'l' : r < 2.5 ? 'd' : 'm') : 'ik';
          else if (r <= hw && r >= hw - 1.2) {
            const [, , dz] = back(x + 0.5, y + 0.5, depth - 1), dx = 0;
            const inward = (px_ * dx + z * (dz - z)) < 0;
            if (prev && prev[1] >= PH) hit = 'is';
            else if (inward) { const u = Math.max(-1, Math.min(1, px_ / hw)); hit = PAINTED[row][a + Math.min(b - a, Math.floor((u + 1) / 2 * (b - a + 1)))]; }
            else hit = PH - h < 1.5 ? 'id' : PH - h < 6 ? 'iD' : 'ik';    // darker deeper down
          }
        }
        prev = [px_, h, z];
      }
      if (hit) hits.set(`${x},${y}`, hit);
    }
  return hits;
}

export const { rest, restAt, frame } = tipper(front, mouth, base, FOLD, fall, (x, y) => OPEN.has(`${x},${y}`));

/** Where the bag stands in the upright can: its top-left, in px from the can's, its neck over the rim. */
export const bagIn = bag => [Math.floor((CAN.W - bag.w) / 2), -5];

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
