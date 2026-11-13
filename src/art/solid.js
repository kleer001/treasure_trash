// `solid.js` makes a solid from a drawing and says how it meets the water. A solid is 1 px voxels
// [x, h, z]: px right, px up from its lowest point, and px toward the viewer. The eye looks down at it
// `EYE.eye` degrees with heights kept 1:1, so a point shows z × tan(eye) − h px down the picture.

/** How far down the eye looks, in degrees. */
export const EYE = { eye: 30 };

export const SHAPES = ['round', 'square', 'drum', 'front', 'top'];

/**
 * How each thing's solid is made from its upright drawing, keyed by what it is. `shape` is one of `SHAPES`:
 * 'round' and 'square' turn each run of a row about its middle, as a disc or as a square; 'drum' turns each
 * run of a column about its middle; 'front' pushes the drawing back `size` px; 'top' reads the drawing as
 * a thing lying flat, seen from the eye, and raises it `size` px.
 */
export const SOLIDS = {
  bag: { shape: 'round', size: 0 },
  can: { shape: 'square', size: 0 },
  bin: { shape: 'front', size: 14 },
  jug: { shape: 'square', size: 0 },
  wheelie: { shape: 'front', size: 20 },
  pane: { shape: 'front', size: 2 },
  chair: { shape: 'front', size: 14 },
  broom: { shape: 'front', size: 3 },
  tyreH: { shape: 'front', size: 8 },
  tyreV: { shape: 'round', size: 0 },
  magnet: { shape: 'front', size: 6 },
  barrow: { shape: 'front', size: 14 },
  cabinet: { shape: 'front', size: 24 },
  drawer: { shape: 'square', size: 16 },
  couch: { shape: 'front', size: 20 },
  couchUp: { shape: 'top', size: 18 },
  bicycle: { shape: 'front', size: 4 },
  bicycleUp: { shape: 'top', size: 24 },
  rug: { shape: 'drum', size: 0 },
  rugUp: { shape: 'top', size: 14 },
  sponge: { shape: 'front', size: 10 },
  cardboard: { shape: 'top', size: 1 },
  skateboard: { shape: 'top', size: 4 },
  skateboardUp: { shape: 'top', size: 4 },
};

const cellsOf = px => [...new Map(px.map(([x, y]) => [`${x},${y}`, [x, y]])).values()];
const runs = ns => ns.sort((a, b) => a - b).reduce((out, n) => {
  const last = out.at(-1);
  if (last && n === last[1] + 1) last[1] = n; else out.push([n, n]);
  return out;
}, []);
const lines = (cells, by) => {
  const m = new Map();
  for (const c of cells) { if (!m.has(c[by])) m.set(c[by], []); m.get(c[by]).push(c[1 - by]); }
  return m;
};
const lowest = v => v.reduce((m, p) => Math.min(m, p[1]), Infinity);

/** Returns the voxels recipe `r` makes from the cells of a drawing, its lowest row at h = 0, with `k` the eye's slope. */
function build(r, cells, k) {
  const bottom = cells.reduce((m, c) => Math.max(m, c[1]), -Infinity), out = [];
  /** Turns the run from `a` to `b` about its middle, giving each cell `i` of it and each `z` it reaches to `put`. */
  const turn = (a, b, round, put) => {
    const c = (a + b + 1) / 2, R = (b - a + 1) / 2;
    for (let i = a; i <= b; i++) for (let z = -Math.ceil(R); z < Math.ceil(R); z++)
      if (!round || (i + 0.5 - c) ** 2 + (z + 0.5) ** 2 <= R * R + 1e-9) put(i, z);
  };
  if (r.shape === 'round' || r.shape === 'square')
    for (const [y, xs] of lines(cells, 1)) for (const [a, b] of runs(xs)) turn(a, b, r.shape === 'round', (x, z) => out.push([x, bottom - y, z]));
  else if (r.shape === 'drum')
    for (const [x, ys] of lines(cells, 0)) for (const [a, b] of runs(ys)) turn(a, b, true, (y, z) => out.push([x, bottom - y, z]));
  else if (r.shape === 'front')
    for (const [x, y] of cells) for (let z = -Math.floor(r.size / 2); z < Math.ceil(r.size / 2); z++) out.push([x, bottom - y, z]);
  else if (r.shape === 'top') {
    const seen = new Set();
    for (const [x, y] of cells) for (let z = Math.floor(-(bottom - y + 1) / k); z < Math.ceil(-(bottom - y) / k); z++)
      if (!seen.has(`${x},${z}`)) { seen.add(`${x},${z}`); for (let h = 0; h < r.size; h++) out.push([x, h, z]); }
  } else throw new Error(`no solid shape '${r.shape}'`);
  return out;
}

// A thing lying `lie` has its top toward that side: right, left, toward the viewer, or away.
const LIES = { r: ([x, h, z]) => [h, -x - 1, z], l: ([x, h, z]) => [-h - 1, x, z], d: ([x, h, z]) => [x, -z - 1, h], u: ([x, h, z]) => [x, z, -h - 1] };
const laid = (v, lie) => {
  if (!lie) return v;
  const t = v.map(LIES[lie]), low = lowest(t);
  return t.map(([x, h, z]) => [x, h - low, z]);
};

/** Returns where voxels `v` show from the slope `k`: for each 'x,y' of the picture, `{ t, p }`, the voxel `p` nearest the eye there. */
function project(v, k) {
  const seen = new Map();
  for (const p of v) {
    const [x, h, z] = p, t = z + k * h;
    for (let y = Math.ceil(k * z - h - 1.5); y < Math.ceil(k * (z + 1) - h - 0.5); y++) {
      const id = `${x},${y}`, q = seen.get(id);
      if (!q || t > q.t) seen.set(id, { t, p });
    }
  }
  return seen;
}

/** Returns a lookup of the values `m` holds by 'x,y': `near(x, y)`, the value nearest (x, y), in its column if it has one. */
function columns(m) {
  const cols = new Map();
  for (const [id, v] of m) { const [x, y] = id.split(',').map(Number); if (!cols.has(x)) cols.set(x, []); cols.get(x).push([y, v]); }
  const xs = [...cols.keys()];
  const near = (x, y) => {
    const col = cols.get(x) ?? cols.get(xs.reduce((b, c) => (Math.abs(c - x) < Math.abs(b - x) ? c : b)));
    return col.reduce((b, c) => (Math.abs(c[0] - y) < Math.abs(b[0] - y) ? c : b))[1];
  };
  return { cols, near };
}

const frame = cells => cells.reduce((b, [x, y]) => ({ x0: Math.min(b.x0, x), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) }),
  { x0: Infinity, x1: -Infinity, y1: -Infinity });

/** Returns how one part of a drawing meets the water. See `meets`. */
function part(s, { name, upright, lie = null, at = null, base = 0 }, k, deep, rows) {
  const r = SOLIDS[name];
  if (!r) throw new Error(`no solid for '${name}'`);
  const idx = at ?? s.px.map((_, i) => i), px = idx.map(i => s.px[i]);
  const v = laid(build(r, cellsOf(upright?.px ?? px), k), lie).map(([x, h, z]) => [x, h + base, z]);
  const shown = project(v, k), drawn = new Map(px.map(([x, y, col]) => [`${x},${y}`, col]));
  // The solid sits where its picture's lowest row and middle meet the drawing's.
  const a = frame([...shown.keys()].map(id => id.split(',').map(Number))), b = frame(cellsOf(px));
  const dx = Math.round((b.x0 + b.x1 - a.x0 - a.x1) / 2), dy = b.y1 - a.y1;
  const solid = columns(shown), sprite = columns(drawn);

  const under = idx.map(i => solid.near(s.px[i][0] - dx, s.px[i][1] - dy).p[1] < deep);
  const line = new Map();
  for (const [x, col] of solid.cols) {
    const wet = col.filter(([, q]) => q.p[1] < deep);
    if (wet.length && sprite.cols.has(x + dx)) line.set(x + dx, Math.min(...wet.map(([y]) => y)) + dy);
  }

  const above = v.filter(([, h]) => h >= deep), hides = project(above, k), mirror = new Map();
  const mirrored = above.filter(([, h]) => h < deep + rows);
  for (const [id, { p: [x, h, z] }] of project(mirrored.map(([x, h, z]) => [x, 2 * deep - h - 1, z]), k)) {
    if (hides.has(id)) continue;
    const [sx, sy] = id.split(',').map(Number);
    mirror.set(`${sx + dx},${sy + dy}`, sprite.near(x + dx, Math.floor(k * (z + 0.5) - (2 * deep - h - 0.5)) + dy));
  }
  return { idx, under, line, mirror };
}

const hash = px => px.reduce((h, [x, y, col]) => {
  h = Math.imul(h ^ (x * 73856093) ^ (y * 19349663), 16777619);
  for (let i = 0; i < col.length; i++) h = Math.imul(h ^ col.charCodeAt(i), 16777619);
  return h;
}, 2166136261);
const MET = new Map();

/**
 * Returns how drawing `s` meets the water `deep` px over its lowest point. `parts` say what solid shows each
 * part of it: `name`, its key in `SOLIDS`; `upright`, the drawing that solid is made from, when it is not the
 * part itself; `lie`, how it is laid down; `at`, the indices of the part's px in `s`, when it is not all of
 * them; and `base`, how many px over the thing's lowest point the part's own lowest point is.
 * The result: `under[i]`, whether `s.px[i]` is under water; `line`, the first row under water in each column
 * that meets the water; and `mirror`, the [x, y, colour] of the reflection of the solid's first `rows` px over
 * the water. All in px from the drawing's top-left.
 */
export function meets(s, parts, { deep, rows }) {
  const id = JSON.stringify([parts.map(p => [p.name, SOLIDS[p.name], p.lie, p.base, p.at?.length, p.upright && hash(p.upright.px)]),
    hash(s.px), EYE.eye, deep, rows]);
  if (!MET.has(id)) {
    if (MET.size > 400) MET.clear();
    const k = Math.tan(EYE.eye * Math.PI / 180), under = s.px.map(() => false), line = new Map(), mirror = new Map();
    for (const p of parts.map(q => part(s, q, k, deep, rows))) {
      p.idx.forEach((i, j) => { under[i] = p.under[j]; });
      for (const [x, y] of p.line) line.set(x, Math.min(y, line.get(x) ?? Infinity));
      for (const [at, col] of p.mirror) if (!mirror.has(at)) mirror.set(at, col);
    }
    MET.set(id, { under, line, mirror: [...mirror].map(([at, col]) => [...at.split(',').map(Number), col]) });
  }
  return MET.get(id);
}
