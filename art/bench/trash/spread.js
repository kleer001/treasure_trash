// Three ways to lay trash over a board's TRASH cells, next to pileLayout's mound per cell. Each
// returns a Map 'x,y' -> pile { cx, cy, pieces } with cell-local pieces, as pileLayout does, so
// settle() and drawPile() take them unchanged.
import { mulberry32 } from '../../../src/rng.js';
import { cellSeed } from '../../../src/stage.js';
import { ORDER, sizes, pileLayout, chooser } from './pile.js';

/** The piles `method` ('mound' | 'flat' | 'edges' | 'field') lays over a board's TRASH `cells`,
 *  from `o` as the Trash Spread page saves it. With `hues` 'cell', each cell draws one set of
 *  accent hues for all its pieces; otherwise each piece draws its own. */
export function spreadPiles(T, method, o, { C, W, H, cells, isTrash, seed, hues }) {
  const rndOf = (x, y) => mulberry32(cellSeed(x + seed * 131, y));
  const pickers = new Map(), ownHues = (size, r, avoid) => chooser(T, r)(size, r, avoid);
  const chooseOf = (x, y) => {
    if (hues !== 'cell') return ownHues;
    const k = `${x},${y}`;
    if (!pickers.has(k)) pickers.set(k, chooser(T, mulberry32(hash(seed, x, y, 7))));
    return pickers.get(k);
  };
  const opt = optOf(o, C, seed);
  if (method === 'mound') return new Map(cells.map(([x, y]) => [`${x},${y}`, pileLayout(T, cellSeed(x + seed * 131, y), opt)]));
  if (method === 'flat') return flatLayout(T, cells, chooseOf, rndOf, opt);
  if (method === 'edges') return edgeLayout(T, cells, isTrash, chooseOf, rndOf, opt);
  return fieldLayout(T, { W, H, isTrash }, chooseOf, opt);
}

/** The Trash Spread page's settings `o` as the layouts read them. */
const optOf = (o, C, seed) => ({ ...o, C, spill: o.spill / 100, falloff: (o.falloff ?? 10) / 10, jitter: (o.jitter ?? 0) / 100, seed: hash(seed, 99) });

/** The pieces `given` poured into TRASH cell `[x, y]` by B, with the Trash Spread page's settings `o`. */
export const pourPile = (T, o, { C, cell: [x, y], given, isTrash, seed, key }) => pourLayout(T, x, y, given, isTrash, optOf(o, C, seed), key);

export function hash(...v) {
  let h = 0x811c9dc5;
  for (const x of v) { h = Math.imul(h ^ (x | 0), 0x01000193); h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); }
  return (h ^ (h >>> 15)) >>> 0;
}

/** Smooth value noise in [0, 1] at world pixel (x, y), on a lattice `scale` px apart. */
function noise(seed, x, y, scale = 6) {
  const gx = x / scale, gy = y / scale, ix = Math.floor(gx), iy = Math.floor(gy);
  const v = (i, j) => hash(seed, i, j) / 4294967296, s = t => t * t * (3 - 2 * t);
  const fx = s(gx - ix), fy = s(gy - iy);
  const a = v(ix, iy) + (v(ix + 1, iy) - v(ix, iy)) * fx, b = v(ix, iy + 1) + (v(ix + 1, iy + 1) - v(ix, iy + 1)) * fx;
  return a + (b - a) * fy;
}

/** The chance a piece centred `d` px past the trash's edge lands: 1 inside, 0 at `reach`. */
const fringe = (d, reach, gamma) => d <= 0 ? 1 : d >= reach ? 0 : (1 - d / reach) ** gamma;

const byLayer = pieces => pieces.sort((a, b) => ORDER[a.layer] - ORDER[b.layer]);

/** A piece centred on (x, y), as a top-left in the same frame. */
function centred(T, p, x, y) {
  const s = T.sprite(p.name, p.alt, p.turn);
  return { ...p, x: Math.round(x - s.w / 2), y: Math.round(y - s.h / 2) };
}

/** A. Each cell on its own, its pieces spread evenly over the cell and `spill` past it: one
 *  piece to each square of a jittered grid. */
export function flatLayout(T, cells, chooseOf, rndOf, { C, min, max, spill, jitter }) {
  const out = new Map(), over = Math.round(spill * C), span = C + 2 * over;
  for (const [x, y] of cells) {
    const rnd = rndOf(x, y), choose = chooseOf(x, y);
    const n = min + Math.floor(rnd() * (max - min + 1)), k = Math.ceil(Math.sqrt(n)), step = span / k;
    const slots = [...Array(k * k).keys()];
    for (let i = slots.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [slots[i], slots[j]] = [slots[j], slots[i]]; }
    const pieces = sizes(n).map((size, i) => {
      const p = choose(size, rnd), s = T.sprite(p.name, p.alt, p.turn);
      const px = -over + (slots[i] % k + 0.5 + jitter * (rnd() - 0.5)) * step;
      const py = -over + (Math.floor(slots[i] / k) + 0.5 + jitter * (rnd() - 0.5)) * step;
      const c = centred(T, p, px, py);
      return { ...c, x: Math.max(-over, Math.min(C + over - s.w, c.x)), y: Math.max(-over, Math.min(C + over - s.h, c.y)) };
    });
    out.set(`${x},${y}`, { cx: C / 2, cy: C / 2, pieces: byLayer(pieces) });
  }
  return out;
}

/** B's test for cell (x, y): `ext`, how far past each edge its grid reaches, and `weigh(piece,
 *  px, py)`, the chance the piece centred on (px, py) lands. Toward trash the two cells' piece
 *  centres cross-fade over `knit` px each side of the seam; toward anything else the pieces thin
 *  out until no pixel of theirs reaches `spill` past it, the edge eaten up to `rough` px in. */
function edgeTest(T, x, y, isTrash, { C, spill, knit, falloff, rough, seed }) {
  const over = spill * C;
  const toTrash = [isTrash(x - 1, y), isTrash(x + 1, y), isTrash(x, y - 1), isTrash(x, y + 1)];
  // Edge k's share of a piece: by its centre `centre` px past a seam to trash, or by its
  // outermost pixel, `pixel` px past an edge to anything else.
  const side = (k, centre, pixel, bite) => toTrash[k]
    ? (knit ? Math.max(0, Math.min(1, 0.5 - centre / (2 * knit))) : centre < 0 ? 1 : 0)
    : fringe(pixel + bite, over, falloff);
  function weigh(piece, px, py) {
    const s = T.sprite(piece.name, piece.alt, piece.turn);
    const xs = s.px.map(p => piece.x + p[0]), ys = s.px.map(p => piece.y + p[1]);
    const past = [-Math.min(...xs), Math.max(...xs) - C + 1, -Math.min(...ys), Math.max(...ys) - C + 1];
    const bite = rough * noise(seed, x * C + px, y * C + py);
    // The farthest any pixel lands from the nearest TRASH cell, which the edges alone miss at
    // an inside corner: two edges to trash, the cell between them not.
    let far = 0;
    for (const [a, b] of s.px) {
      const X = x * C + piece.x + a, Y = y * C + piece.y + b, gx = Math.floor(X / C), gy = Math.floor(Y / C);
      if (isTrash(gx, gy)) continue;
      let d = Infinity;
      for (let ty = gy - 1; ty <= gy + 1; ty++) for (let tx = gx - 1; tx <= gx + 1; tx++) if (isTrash(tx, ty))
        d = Math.min(d, Math.max(X < tx * C ? tx * C - X : X - tx * C - C + 1, Y < ty * C ? ty * C - Y : Y - ty * C - C + 1, 0));
      far = Math.max(far, d);
    }
    return far && far + bite >= over ? 0
      : side(0, -px, past[0], bite) * side(1, px - C, past[1], bite) * side(2, -py, past[2], bite) * side(3, py - C, past[3], bite);
  }
  return { ext: toTrash.map(t => t ? knit : over), weigh };
}

/** B. Each cell on its own, but each of its four edges reads the cell beyond it, as `edgeTest`
 *  says. The cell's count comes from its seed; each square of its grid draws its piece from its
 *  own hash. */
export function edgeLayout(T, cells, isTrash, chooseOf, rndOf, o) {
  const { C, min, max, jitter, seed } = o, out = new Map();
  for (const [x, y] of cells) {
    const rnd = rndOf(x, y), choose = chooseOf(x, y);
    const n = min + Math.floor(rnd() * (max - min + 1)), step = C / Math.sqrt(n);
    const mix = sizes(n), pHero = mix.filter(s => s === 'hero').length / n, pMid = mix.filter(s => s === 'mid').length / n;
    const { ext, weigh } = edgeTest(T, x, y, isTrash, o);
    const nx = Math.ceil((C + ext[0] + ext[1]) / step), ny = Math.ceil((C + ext[2] + ext[3]) / step);
    const pieces = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const r = mulberry32(hash(seed, x, y, i, j));
      const px = -ext[0] + (i + 0.5 + jitter * (r() - 0.5)) * step, py = -ext[2] + (j + 0.5 + jitter * (r() - 0.5)) * step;
      const u = r(), size = u < pHero ? 'hero' : u < pHero + pMid ? 'mid' : 'bit';
      const piece = centred(T, choose(size, r), px, py);
      if (r() < weigh(piece, px, py)) pieces.push(piece);
    }
    out.set(`${x},${y}`, { cx: C / 2, cy: C / 2, pieces: byLayer(pieces) });
  }
  return out;
}

/** Every piece of `given` laid in cell (x, y) by B's test, in the order given: each takes the
 *  next square of a jittered grid, in an order hashed from `key`, that its test lets it land on.
 *  The grid has one square a piece, and is laid again with new jitter until every piece is down. */
export function pourLayout(T, x, y, given, isTrash, o, key) {
  const { C, jitter, seed } = o, step = C / Math.sqrt(given.length);
  const { ext, weigh } = edgeTest(T, x, y, isTrash, o);
  const nx = Math.ceil((C + ext[0] + ext[1]) / step), ny = Math.ceil((C + ext[2] + ext[3]) / step);
  const pieces = [];
  let k = 0;
  for (let pass = 0; k < given.length; pass++) {
    if (pass === 50) throw new Error(`pourLayout: ${given.length - k} of ${given.length} pieces found no square in 50 passes`);
    const squares = [...Array(nx * ny).keys()].map(q => [hash(seed, key, pass, q), q]).sort((a, b) => a[0] - b[0]);
    for (const [, q] of squares) {
      if (k === given.length) break;
      const r = mulberry32(hash(seed, key, pass, q, 1));
      const px = -ext[0] + (q % nx + 0.5 + jitter * (r() - 0.5)) * step, py = -ext[2] + (Math.floor(q / nx) + 0.5 + jitter * (r() - 0.5)) * step;
      const piece = centred(T, given[k], px, py);
      if (r() < weigh(piece, px, py)) { pieces.push(piece); k++; }
    }
  }
  return { cx: C / 2, cy: C / 2, pieces: byLayer(pieces) };
}

/** C. One field of points over the whole board, a jittered grid per size class, that knows no
 *  cells: a point inside a TRASH cell lands and belongs to it; a point past the trash's edge
 *  lands with a chance that thins to nothing `spill` out, and belongs to the nearest TRASH cell. */
export function fieldLayout(T, board, chooseOf, { C, n, spill, falloff, rough, jitter, seed }) {
  const { W, H, isTrash } = board, over = spill * C, out = new Map();
  const R = Math.ceil((over + rough) / C) + 1;
  const toSquare = (px, py, x, y) => Math.hypot(Math.max(x * C - px, 0, px - x * C - C), Math.max(y * C - py, 0, py - y * C - C));
  /** The signed distance from (px, py) to the trash's edge, negative inside, and its owner cell. */
  function edge(px, py) {
    const gx = Math.floor(px / C), gy = Math.floor(py / C);
    let d = Infinity, owner = null;
    if (isTrash(gx, gy)) {
      for (let y = gy - 1; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++)
        if (!isTrash(x, y)) d = Math.min(d, toSquare(px, py, x, y));
      return { d: -d, owner: [gx, gy] };
    }
    for (let y = gy - R; y <= gy + R; y++) for (let x = gx - R; x <= gx + R; x++) {
      if (!isTrash(x, y)) continue;
      const e = toSquare(px, py, x, y);
      if (e < d) { d = e; owner = [x, y]; }
    }
    return { d, owner };
  }
  const mix = sizes(Math.round(n));
  for (const size of ['hero', 'mid', 'bit']) {
    const count = mix.filter(s => s === size).length;
    if (!count) continue;
    const step = C / Math.sqrt(count), phase = hash(seed, ORDER[size]) / 4294967296 * step;
    for (let j = -1; phase + j * step < H * C; j++) for (let i = -1; phase + i * step < W * C; i++) {
      const r = mulberry32(hash(seed, ORDER[size], i, j));
      const px = phase + (i + 0.5 + jitter * (r() - 0.5)) * step, py = phase + (j + 0.5 + jitter * (r() - 0.5)) * step;
      const { d, owner } = edge(px, py);
      if (!owner) continue;
      if (r() >= fringe(d + rough * (2 * noise(seed, px, py) - 1), over, falloff)) continue;
      const key = `${owner[0]},${owner[1]}`;
      if (!out.has(key)) out.set(key, { cx: C / 2, cy: C / 2, pieces: [] });
      out.get(key).pieces.push(centred(T, chooseOf(...owner)(size, r), px - owner[0] * C, py - owner[1] * C));
    }
  }
  for (const pile of out.values()) byLayer(pile.pieces);
  return out;
}
