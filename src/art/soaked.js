// The cardboard and the sponge marked by what they met.
// Marks are mixed into the colour under them, so each pixel stays solid.
import { mulberry32 } from '../rng.js';
import { CARDBOARD_ROWS, CARDBOARD_PALETTE } from './cardboard.js';
import { SPONGE_LOOK, SPONGE_PALETTE, spongeRows } from './sponge.js';

const MARKS = { soak: 1, edge: '#000000', edgeAmt: 0, count: 0, rmin: 1, rmax: 2, blot: '#000000', blotAmt: 0, ring: 0, specks: 0, speck: '#ffffff' };
export const SOAKED_LOOK = {
  cardboard: {
    water: { ...MARKS, seed: 1, tint: '#6a4430', tintAmt: 0.45, edge: '#5a3a28', edgeAmt: 0.25, count: 4, rmin: 2, rmax: 4, blot: '#5a3a28', blotAmt: 0.55,
      ooze: 0, oozeSize: 2, oozeColour: '#1d1a22', oozeLit: '#3a3644' },
    tar: { ...MARKS, seed: 1, tint: '#2a2228', tintAmt: 0.25, soak: 2, edge: '#1d1a22', edgeAmt: 0.6, count: 3, rmin: 1.5, rmax: 3, blot: '#1d1a22', blotAmt: 0.8,
      specks: 2, speck: '#b9c6d6', ooze: 5, oozeSize: 2, oozeColour: '#1d1a22', oozeLit: '#3a3644' },
    grease: { ...MARKS, seed: 1, tint: '#4a3f2e', tintAmt: 0.2, edge: '#4a3f2e', edgeAmt: 0.35, count: 5, rmin: 1.5, rmax: 3.5, blot: '#4a3f2e', blotAmt: 0.5, ring: 0.3,
      specks: 3, speck: '#f6efc9', ooze: 0, oozeSize: 2, oozeColour: '#2e2619', oozeLit: '#6a5a40' },
  },
  sponge: {
    water: { ...MARKS, seed: 1, tint: '#8a6a1e', tintAmt: 0.35, specks: 2, speck: '#ffffff',
      low: '#6f5a2e', lowH: 5, lowAmt: 0.4, lowJag: 1, coat: 0, coatJag: 1.5, coatColour: '#1d1a22', coatLit: '#3a3644' },
    grease: { ...MARKS, seed: 1, tint: '#4a3f2e', tintAmt: 0.45, count: 4, rmin: 1, rmax: 2.5, blot: '#2e2619', blotAmt: 0.5, specks: 4, speck: '#f6efc9',
      low: '#2e2619', lowH: 4, lowAmt: 0.4, lowJag: 1, coat: 0, coatJag: 1.5, coatColour: '#1d1a22', coatLit: '#3a3644' },
    tar: { ...MARKS, seed: 1, tint: '#1d1a22', tintAmt: 0, soak: 0, edgeAmt: 0.45, count: 4, rmin: 1, rmax: 2, blot: '#1d1a22', blotAmt: 0.7,
      low: '#1d1a22', lowH: 4, lowAmt: 0.4, lowJag: 1, coat: 6, coatJag: 1.5, coatColour: '#1d1a22', coatLit: '#3a3644' },
  },
};

export const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)
  .toString(16).padStart(2, '0')).join('');
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];

/** `rows` marked to look `L`, as { w, h, px: [x, y, colour] }; `ooze` and `coat` say which of the
 *  outside marks this thing takes. */
function marked(rows, palette, L, { ooze = false, coat = false }) {
  const h = rows.length, w = rows[0].length, rand = mulberry32(L.seed);
  const body = (x, y) => x >= 0 && y >= 0 && x < w && y < h && !'.k'.includes(rows[y][x]);
  const cells = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (body(x, y)) cells.push([x, y]);
  const pick = () => cells[Math.floor(rand() * cells.length)];
  // How many steps in from the edge each pixel is, out to `soak`.
  const depth = new Map(), key = (x, y) => x * 1000 + y;
  let ring = cells.filter(([x, y]) => N4.some(([dx, dy]) => !body(x + dx, y + dy)));
  for (let d = 1; d <= L.soak && ring.length; d++) {
    ring.forEach(([x, y]) => depth.set(key(x, y), d));
    ring = cells.filter(([x, y]) => !depth.has(key(x, y)) && N4.some(([dx, dy]) => depth.get(key(x + dx, y + dy)) === d));
  }
  const blots = Array.from({ length: Math.round(L.count) }, () => {
    const [cx, cy] = pick();
    return [cx + 0.5, cy + 0.5, L.rmin + rand() * Math.max(0, L.rmax - L.rmin)];
  });
  const specks = new Set(Array.from({ length: Math.round(L.specks) }, () => key(...pick())));
  const rise = (n, jag) => Array.from({ length: w }, () => (n > 0 ? n + Math.round((rand() - 0.5) * 2 * jag) : 0));
  const low = coat ? rise(L.lowH, L.lowJag) : [], tar = coat ? rise(L.coat, L.coatJag) : [];
  const out = new Map();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const ch = rows[y][x];
    if (ch === '.') continue;
    if (ch === 'k') { out.set(key(x, y), [x, y, palette.k]); continue; }
    let c = mix(palette[ch], L.tint, L.tintAmt);
    if (depth.has(key(x, y))) c = mix(c, L.edge, L.edgeAmt);
    const up = h - 1 - y;
    if (coat && up < low[x]) c = mix(c, L.low, L.lowAmt);
    for (const [bx, by, r] of blots) {
      const d = Math.hypot(x + 0.5 - bx, y + 0.5 - by);
      if (d <= r) c = mix(c, L.blot, Math.min(1, L.blotAmt + (d > r - 1 ? L.ring : 0)));
    }
    if (specks.has(key(x, y))) c = L.speck;
    out.set(key(x, y), [x, y, c]);
  }
  if (coat) for (let x = 0; x < w; x++) for (let up = 0; up < tar[x]; up++) {
    const y = h - 1 - up;
    if (out.has(key(x, y))) out.set(key(x, y), [x, y, up === tar[x] - 1 ? L.coatLit : L.coatColour]);
  }
  if (ooze) for (let k = 0; k < Math.round(L.ooze); k++) {
    const edge = [...out.values()].filter(([x, y]) => rows[y][x] === 'k');
    const [cx, cy] = edge[Math.floor(rand() * edge.length)], r = L.oozeSize * (0.6 + rand() * 0.8);
    const blob = [];
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
      if (x >= 0 && y >= 0 && x < w && y < h && Math.hypot(x - cx, y - cy) <= r) blob.push([x, y]);
    const inBlob = new Set(blob.map(([x, y]) => key(x, y)));
    for (const [x, y] of blob) out.set(key(x, y), [x, y, inBlob.has(key(x, y - 1)) ? L.oozeColour : L.oozeLit]);
  }
  return { w, h, px: [...out.values()] };
}

/** The sheet, one cell from its top-left corner, after lying over `kind`: water, tar or grease. */
export const soakedCardboard = (kind, look = SOAKED_LOOK.cardboard[kind]) => marked(CARDBOARD_ROWS, CARDBOARD_PALETTE, look, { ooze: true });
/** The sponge at `size`, its bottom row on the ground, after soaking up water or grease, or sticking in tar. */
export const soakedSponge = (kind, look = SOAKED_LOOK.sponge[kind], size = SPONGE_LOOK) =>
  ({ ...marked(spongeRows(size), SPONGE_PALETTE, look, { coat: true }), dx: size.dx, dy: size.dy });
