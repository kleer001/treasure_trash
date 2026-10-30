// The couch, drawn from a 3D model.
//   k ink, and the leather from deepest to highlight: d e f g h i
import { mulberry32 } from '../rng.js';

const RAMP = 'defghi';
export const COUCH_LOOK = {
  seed: 50347, hue: 15, sat: 35, light: 40, step: 9, shift: 3, ink: '#19152b',
  minShade: 4,
  stainsOn: true, stainsCushion: true, stains: 1.5, stainMin: 1.5, stainMax: 4.5, stainDensity: 0.8, stainRing: 0.35, stainOpacity: 0.45, stainColour: '#3d2a1f', ringColour: '#2a1d16',
  mouldOn: true, mouldCushion: true, mould: 3.5, mouldSize: 3.5, mouldDensity: 1, mouldLit: 0.2, mouldOpacity: 0.5, mouldColour: '#8fa8a0', mouldLight: '#cfe0d6',
  cracksOn: true, cracksCushion: true, cracks: 11, crackLen: 6, crackWiggle: 0.2, crackDepth: 1,
  ripsOn: true, ripsCushion: true, rips: 3, ripMin: 1, ripMax: 3, ripAspect: 1.4, ripJag: 0.55, hole: 0.25, rim: 0.45, flap: 0.45, flapLen: 5,
  stuffing: '#efe6cf', stuffShade: '#c9b994', holeColour: '#1c1412', rimColour: '#c79a74',
};
const ROWS = {
  front: [
    '.....kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk.....',
    '.....kggggggggggggggggggggggggggggggggggggggk.....',
    '.....kggggggggggggggggggggggggggggggggggggggk.....',
    '.....kggggggggggggggggggggggggggggggggggggggk.....',
    'kkkkkffffffffffffeeffffffffffffeefffffffffffekkkkk',
    'kggfeghhhhhhhhhhgeehhhhhhhhhhhgefhhhhhhhhhhhefgggk',
    'kggfegihhhhhhhhhgeehhhhhhhhhhhfefihhhhhhhhhhefgggk',
    'kggfeffffffffffffeefffffffffffeeffffffffffffefgggk',
    'kggfefffffffffffeeefffffffffffeefffffffffffeefgggk',
    'kggfefffffffffffeeefffffffffffeefffffffffffeefgggk',
    'kggfffffffffffffeffffffffffffffffffffffffffeffgggk',
    'kggffhhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhffgggk',
    'kggffhhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhffgggk',
    'kggffhhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhffgggk',
    'kggffhhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhffgggk',
    'kggffhhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhffgggk',
    'kggffhhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhffgggk',
    'kggffhhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhffgggk',
    'kggffhhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhffgggk',
    'kggfehhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhfeggfk',
    'keeeehhhhhhhhhhhhfgihhhhhhhhhhgfhhhhhhhhhhhhfefeek',
    'keeeeffffffffffffegfffffffffffefffffffffffffeefeek',
    'keeeeggggggggggggggggggggggggggggggggggggggggefeek',
    'keeeeffffffffffffffffffffffffffffffffffffffffefeek',
    'keeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefeek',
    'keeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefeek',
    'keeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefeek',
    'keekkeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekkeek',
    '.kk..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..kk.',
    '.kk............................................kk.',
  ],
  back: [
    'kkkk..........................................kkk.',
    'kggfk........................................kgggk',
    'kggfekkkkkkkkkkkkk.kkkkkkkkkkkk.kkkkkkkkkkkkkggggk',
    'kggfehhhhhhhhhhhhfkhhhhhhhhhhhgkhhhhhhhhhhhhffgggk',
    'kggfehhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhffgggk',
    'kggffhhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhffgggk',
    'kggffhhhhhhhhhhhhfghhhhhhhhhhhgfhhhhhhhhhhhhffgggk',
    'kggffhhhhhhhhhhhhfgiihhhhhhhhhgfgihhhhhhhhhhffgggk',
    'kggffgggggggggggggggggggggggggggggggggggggggffgggk',
    'kggffgggggggggggggggggggggggggggggggggggggggffgggk',
    'kggffgggggggggggggggggggggggggggggggggggggggffgggk',
    'kggfegggggggggggggggggggggggggggggggggggggggffgggk',
    'kggfefeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefgggk',
    'kggfefeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefgggk',
    'kggfefeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefgggk',
    'kggfefeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeggfk',
    'kfeeefeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefeek',
    'keeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefeek',
    'keeeegfffffffffffffffffffffffffffffffffffffffefeek',
    'keeeeffffffffffffffffffffffffffffffffffffffffefeek',
    'keeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefeek',
    'keeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefeek',
    'keeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeefeek',
    'keekkeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeekkeek',
    '.kk..kkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkkk..kk.',
    '.kk............................................kk.',
  ],
  left: [
    '.kkkkkkkkkkkkkkkkkkkkk.',
    'khhhhhhhhhhhhhhhhhhgggk',
    'kihhhhhhhhhhhhhhhhggggk',
    'kfffffffffffffhhgghhhgk',
    'kddddddddddddeiigfhhhgk',
    'kfffffffffffffiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihffefhhhgk',
    'kiiiiiiiiiiiiheedfhhhgk',
    'kiiiiiiiiiiiiighffhhhgk',
    'kgggggggggggggiigfhhhgk',
    'kfffffffffffffiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihggffhhhgk',
    'kiiiiiiiiiiiiheeffhhhgk',
    'kiiiiiiiiiiiiifgffhhhgk',
    'khhhhhhhhhhhhhiigfhhhgk',
    'kfeeeeeeeeeeefiigfhhhgk',
    'kihhhhhhhhhhhhiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihiigfhhhgk',
    'kiiiiiiiiiiiihhhffhgggk',
    'kiiiiiiiiiiiiheeeeeeeek',
    'kiiiiiiiiiiiiheddeddddk',
    'khhhhhhhhhhhhhgffeeeedk',
    'kgggggggggggggggggggggk',
    'khhhhhhhhhhhhhhhhhhhhgk',
    'khhhhhhhhhhhhhhhhhhhhgk',
    'kffffffffffffffffffffek',
    'kdddddddddddddddddddddk',
    'kdddddddddddddddddddddk',
    'kdddddddddddddddddddddk',
    'kdddddddddddddddddddddk',
    '.kkkkkkkkkkkkkkkkkkkkk.',
  ],
  right: [
    '.kkkkkkkkkkkkkkkkkkkkk.',
    'khgghhhhhhhhhhhhhhhhhgk',
    'kggggghhhhhhhhhhhhhhhgk',
    'khhhgfhhgfffffffffffffk',
    'khhhgfihgdddddddddddddk',
    'khhhgfihgffffffffffffek',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfiifgiiiiiiiiiiigk',
    'khhhgegfegiiiiiiiiiiigk',
    'khhhgeeedhiiiiiiiiiiigk',
    'khhhgfhhfiiiiiiiiiiiigk',
    'khhhgfihgfgggggggggggfk',
    'khhhgfihgeffffffffffffk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfiiggiiiiiiiiiiigk',
    'khhhgeggegiiiiiiiiiiigk',
    'khhhgeeeegiiiiiiiiiiigk',
    'khhhgffgfiiiiiiiiiiiigk',
    'khhhgfihgghhhhhhhhhhhfk',
    'khhhgfihgeeeeeeeeeeeefk',
    'khhhgfihgghhhhhhhhhhhgk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'khhhgfihggiiiiiiiiiiigk',
    'kihhgfiiggiiiiiiiiiiigk',
    'kgggfehhfgiiiiiiiiiiigk',
    'keeeeeeeegiiiiiiiiiiigk',
    'kddddeeeehiiiiiiiiiiigk',
    'keeedeggghhhhhhhhhhhhgk',
    'kgggggggggggggggggggggk',
    'khhhhhhhhhhhhhhhhhhhhgk',
    'khhhhhhhhhhhhhhhhhhhhgk',
    'kffffffffffffffffffffek',
    'kdddddddddddddddddddddk',
    'kdddddddddddddddddddddk',
    'kdddddddddddddddddddddk',
    'kdddddddddddddddddddddk',
    '.kkkkkkkkkkkkkkkkkkkkk.',
  ],
};
const hex = (h, sat, l) => {
  const S = sat / 100, L = Math.min(100, Math.max(0, l)) / 100, a = S * Math.min(L, 1 - L);
  const f = n => { const k = (n + h / 30) % 12, c = L - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(255 * c).toString(16).padStart(2, '0'); };
  return `#${f(0)}${f(8)}${f(4)}`;
};
const palette = L => ({
  ...Object.fromEntries([...RAMP].map((c, i) => [c, hex(((L.hue + (i - 3) * L.shift) % 360 + 360) % 360, L.sat, L.light + (i - 3) * L.step)])),
  k: L.ink, s: L.stainColour, S: L.ringColour, m: L.mouldColour, M: L.mouldLight,
  w: L.stuffing, W: L.stuffShade, x: L.holeColour, r: L.rimColour,
});

/** The view's rows with the wear laid on, as rows of palette letters, and where stains and mould lie over them. */
function wear(rows, L, salt) {
  const base = rows.map(r => [...r]), g = rows.map(r => [...r]), h = g.length, w = g[0].length;
  const stain = rows.map(r => Array(r.length).fill('')), mould = rows.map(r => Array(r.length).fill(''));
  // Each kind of wear draws from its own stream, so switching one off leaves the others where they were.
  const stream = kind => mulberry32((Math.imul(L.seed, 0x9e3779b1) ^ Math.imul(salt, 0x85ebca6b) ^ Math.imul(kind, 0xc2b2ae35)) >>> 0);
  let rnd;
  const shade = (x, y) => (y >= 0 && y < h && x >= 0 && x < w ? RAMP.indexOf(base[y][x]) : -1);
  const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  const faces = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++)
    if (shade(x, y) >= L.minShade && N4.every(([dx, dy]) => shade(x + dx, y + dy) >= 0)) faces.push([x, y]);
  const pick = (from = faces) => from[Math.floor(rnd() * from.length)];
  const cushion = rows.map(r => Array(r.length).fill(-1)), size = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (cushion[y][x] >= 0 || shade(x, y) < 0) continue;
    const id = size.length, stack = [[x, y]];
    cushion[y][x] = id; size.push(0);
    while (stack.length) {
      const [a, b] = stack.pop(); size[id]++;
      for (const [dx, dy] of N4) {
        const X = a + dx, Y = b + dy;
        if (Y >= 0 && Y < h && X >= 0 && X < w && cushion[Y][X] < 0 && base[Y][X] === base[b][a]) { cushion[Y][X] = id; stack.push([X, Y]); }
      }
    }
  }
  const on = id => (x, y) => y >= 0 && y < h && x >= 0 && x < w && cushion[y][x] === id;
  const within = (respect, x, y) => (respect ? on(cushion[y][x]) : (X, Y) => shade(X, Y) >= 0);
  const roomy = faces.filter(([x, y]) => size[cushion[y][x]] >= 16);
  const count = n => Math.floor(n) + (rnd() < n % 1 ? 1 : 0);
  const between = (a, b) => a + rnd() * Math.max(0, b - a);
  /** A blob with a ragged edge: [x, y, d], d its distance out from the middle (1 at the edge). */
  const blob = (cx, cy, rx, ry, jag) => {
    const out = [];
    for (let y = Math.floor(cy - ry - 1); y <= Math.ceil(cy + ry + 1); y++)
      for (let x = Math.floor(cx - rx - 1); x <= Math.ceil(cx + rx + 1); x++) {
        const d = Math.hypot((x - cx) / Math.max(0.5, rx), (y - cy) / Math.max(0.5, ry));
        if (shade(x, y) >= 0 && d <= 1 + (rnd() - 0.5) * 2 * jag) out.push([x, y, d]);
      }
    return out;
  };
  const edgeOf = px => { const in_ = new Set(px.map(([x, y]) => x * 1000 + y)); return px.filter(([x, y]) => N4.some(([dx, dy]) => !in_.has((x + dx) * 1000 + y + dy))); };
  if (!faces.length) return { rows: g.map(r => r.join('')), stain, mould };

  rnd = stream(1);
  for (let k = L.stainsOn ? count(L.stains) : 0; k--;) {
    const [cx, cy] = pick(), own = within(L.stainsCushion, cx, cy), r = between(L.stainMin, L.stainMax);
    const px = blob(cx, cy, r * (0.8 + rnd() * 0.6), r, 0.25).filter(([x, y]) => own(x, y));
    for (const [x, y] of px) if (rnd() < L.stainDensity) stain[y][x] = 's';
    for (const [x, y] of edgeOf(px)) if (rnd() < L.stainRing) stain[y][x] = 'S';
  }
  rnd = stream(2);
  for (let k = L.mouldOn ? count(L.mould) : 0; k--;) {
    const [cx, cy] = pick(), own = within(L.mouldCushion, cx, cy), r = L.mouldSize;
    for (const [x, y, d] of blob(cx, cy, r, r, 0.5)) if (own(x, y) && rnd() < L.mouldDensity * (1 - d * 0.7)) mould[y][x] = rnd() < L.mouldLit ? 'M' : 'm';
  }
  rnd = stream(3);
  for (let k = L.cracksOn ? count(L.cracks) : 0; k--;) {
    let [x, y] = pick(), a = rnd() * Math.PI * 2;
    const own = within(L.cracksCushion, x, y);
    for (let i = 0; i < L.crackLen; i++) {
      const q = shade(Math.round(x), Math.round(y));
      if (!own(Math.round(x), Math.round(y))) break;
      g[Math.round(y)][Math.round(x)] = RAMP[Math.max(0, q - L.crackDepth)];
      a += (rnd() - 0.5) * 2 * L.crackWiggle; x += Math.cos(a); y += Math.sin(a);
    }
  }
  rnd = stream(4);
  for (let k = L.ripsOn ? count(L.rips) : 0; k-- && (L.ripsCushion ? roomy : faces).length;) {
    const [cx, cy] = pick(L.ripsCushion ? roomy : faces), own = within(L.ripsCushion, cx, cy), r = between(L.ripMin, L.ripMax);
    const px = blob(cx, cy, r * L.ripAspect, r, L.ripJag).filter(([x, y]) => own(x, y));
    const inside = new Set(px.map(([x, y]) => x * 1000 + y)), deep = rnd() < L.hole;
    for (const [x, y, d] of px)
      g[y][x] = deep && d < 0.55 ? 'x' : inside.has(x * 1000 + y - 1) ? 'w' : 'W';
    for (const [x, y] of px) for (const [dx, dy] of N4) {
      const X = x + dx, Y = y + dy;
      if (!inside.has(X * 1000 + Y) && own(X, Y) && rnd() < L.rim) g[Y][X] = 'r';
    }
    if (px.length && rnd() < L.flap) {
      const bottom = Math.max(...px.map(p => p[1])), xs = px.filter(p => p[1] === bottom).map(p => p[0]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs);
      for (let x = x0; x <= x1; x++) {
        const len = Math.round(L.flapLen * (1 - Math.abs((x - (x0 + x1) / 2) / (x1 - x0 + 1))));
        for (let y = bottom + 1; y <= bottom + len && own(x, y); y++) g[y][x] = 'r';
      }
    }
  }
  return { rows: g.map(r => r.join('')), stain, mould };
}

const mix = (a, b, t) => '#' + [1, 3, 5].map(i => Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t)
  .toString(16).padStart(2, '0')).join('');
const sprite = ({ rows, stain, mould }, pal, L) => ({ w: rows[0].length, h: rows.length,
  px: rows.flatMap((r, y) => [...r].flatMap((c, x) => {
    if (c === '.') return [];
    let col = pal[c];
    if (RAMP.includes(c)) {
      if (stain[y][x]) col = mix(col, pal[stain[y][x]], L.stainOpacity);
      if (mould[y][x]) col = mix(col, pal[mould[y][x]], L.mouldOpacity);
    }
    return [[x, y, col]];
  })) });
/** Each view worn to `look`: { w, h, px }. */
export function couchViews(look) {
  const pal = palette(look);
  return Object.fromEntries(Object.entries(ROWS).map(([k, r], i) => [k, sprite(wear(r, look, i + 1), pal, look)]));
}
export const COUCH = couchViews(COUCH_LOOK);
