// Trash piles from palette-indexed item sprites. A pile's layout is a function of its seed
// alone, so a board still and the last frame of a spill can draw the same pixels.
import { mulberry32 } from '../../../src/rng.js';

const SLOT_KEYS = { A: '1234', B: 'abcd', C: 'wxyz' };
export const SHADOW = '#765c62';

/** A palette-index grid (an array of equal-length strings, '.' empty) mirrored if `o & 4`,
 *  then turned clockwise `o & 3` quarter turns. */
function dihedral(grid, o) {
  let g = o & 4 ? grid.map(r => [...r].reverse().join('')) : grid;
  for (let k = 0; k < (o & 3); k++) g = [...g[0]].map((_, x) => g.map(r => r[x]).reverse().join(''));
  return g;
}

/** Scale2x on a palette-index grid: corners take a neighbour's index where two edges agree. */
function scale2x(g) {
  const h = g.length, w = g[0].length, at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? '.' : g[y][x]);
  const out = Array.from({ length: h * 2 }, () => []);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = at(x, y), a = at(x, y - 1), b = at(x + 1, y), c = at(x - 1, y), d = at(x, y + 1);
    out[2 * y][2 * x] = c === a && c !== d && a !== b ? a : p;
    out[2 * y][2 * x + 1] = a === b && a !== c && b !== d ? b : p;
    out[2 * y + 1][2 * x] = d === c && d !== b && c !== a ? c : p;
    out[2 * y + 1][2 * x + 1] = b === d && b !== a && d !== c ? d : p;
  }
  return out.map(r => r.join(''));
}

/** A grid turned 45° clockwise the RotSprite way: Scale2x three times, sample the 8× grid at
 *  each turned pixel centre, crop the empty edge. Indices stay indices, so palettes still swap. */
function turn45(grid) {
  const big = scale2x(scale2x(scale2x(grid))), w = grid[0].length, h = grid.length;
  const side = Math.ceil((w + h) / Math.SQRT2) + 2, k = Math.SQRT1_2;
  let g = [];
  for (let j = 0; j < side; j++) {
    let row = '';
    for (let i = 0; i < side; i++) {
      const dx = i + 0.5 - side / 2, dy = j + 0.5 - side / 2;
      const sx = Math.floor((k * (dx + dy) + w / 2) * 8), sy = Math.floor((k * (dy - dx) + h / 2) * 8);
      row += sx >= 0 && sy >= 0 && sx < w * 8 && sy < h * 8 ? big[sy][sx] : '.';
    }
    g.push(row);
  }
  const used = (r) => /[^.]/.test(r);
  g = g.filter(used);
  const cols = [...g[0]].map((_, x) => g.some(r => r[x] !== '.'));
  const x0 = cols.indexOf(true), x1 = cols.lastIndexOf(true);
  return g.map(r => r.slice(x0, x1 + 1));
}

/** Sprites for every item in `D` (items.json), with accent ramps or their gold stand-ins.
 *  `diagonals` adds the 45° turns to each item's quarter turns and mirrors. */
export function createTrash(D, { accents = true, diagonals = true } = {}) {
  const ramp = name => name in D.ramps ? D.ramps[name]
    : accents ? D.accents[name].ramp : D.ramps[D.accents[name].gold];
  const cache = new Map(), turnCache = new Map(), t45Cache = new Map();
  const diag = name => diagonals && D.items[name].turn45 !== false;
  const t45 = name => { if (!t45Cache.has(name)) t45Cache.set(name, turn45(D.items[name].px)); return t45Cache.get(name); };

  function colours(item, alt) {
    const slots = { ...item.slots, ...item.alts[alt] }, m = { k: D.ink, h: D.highlight };
    for (const [slot, keys] of Object.entries(SLOT_KEYS)) {
      if (!slots[slot]) continue;
      const r = ramp(slots[slot]);
      [...keys].forEach((ch, i) => { m[ch] = r[i]; });
    }
    return m;
  }

  /** Every distinct grid an item can lie as. A symmetric item has fewer than an asymmetric one. */
  function turnsOf(name) {
    if (turnCache.has(name)) return turnCache.get(name);
    const seen = new Map();
    for (const g0 of diag(name) ? [D.items[name].px, t45(name)] : [D.items[name].px])
      for (let o = 0; o < 8; o++) { const g = dihedral(g0, o); seen.set(g.join('/'), g); }
    const list = [...seen.values()];
    list.index = new Map([...seen.keys()].map((k, i) => [k, i]));
    turnCache.set(name, list);
    return list;
  }

  /** The turn an item lies in when mirrored if `m`, then turned `k` eighths clockwise. Without
   *  its 45° grid, an odd `k` lies at the eighth before it. */
  function pose(name, m, k) {
    k = ((k % 8) + 8) % 8;
    if (!diag(name)) k &= ~1;
    const g = k % 2 === 0 ? dihedral(D.items[name].px, m * 4 + k / 2)
      : dihedral(t45(name), m * 4 + (m ? ((k + 1) / 2) % 4 : (k - 1) / 2));
    return turnsOf(name).index.get(g.join('/'));
  }

  /** The `{ m, k }` of a turn: pose(name, m, k) === turn. */
  function poseOf(name, turn) {
    for (let m = 0; m < 2; m++) for (let k = 0; k < 8; k++) if (pose(name, m, k) === turn) return { m, k };
    throw new Error(`${name} turn ${turn} is no pose`);
  }

  /** Item `name` in palette `alt`, lying as its `turn`-th distinct grid. */
  function sprite(name, alt = 0, turn = 0) {
    const key = `${name}/${alt}/${turn}`;
    if (cache.has(key)) return cache.get(key);
    const grid = turnsOf(name)[turn], m = colours(D.items[name], alt), px = [];
    grid.forEach((row, y) => [...row].forEach((ch, x) => { if (ch !== '.') px.push([x, y, m[ch]]); }));
    const s = { w: grid[0].length, h: grid.length, px };
    cache.set(key, s);
    return s;
  }

  const names = Object.keys(D.items);
  const bySize = size => names.filter(n => D.items[n].size === size);
  return { D, sprite, names, pose, poseOf, turns: name => turnsOf(name).length,
           hero: bySize('hero'), mid: bySize('mid'), bit: bySize('bit') };
}

const REACH = { hero: 2, mid: 5, bit: 7 };          // px from the pile's centre a piece may sit
const MARGIN = 1;                                    // floor left clear inside the cell's edge
// Ramps any pile may use. A pile adds `ACCENTS` more from the rest, so it reads as one heap
// and not as every colour in the catalog at once.
const NEUTRAL = new Set(['paper', 'news', 'kraft', 'foam', 'cream', 'slate', 'brown', 'black', 'peach', 'plum']);
const ACCENTS = 2;
export const ORDER = { flat: 0, mid: 1, hero: 2, bit: 3 };  // draw order, bottom first
const PICKS = new WeakMap();                         // per trash set: its accent hues, and the item pool for each pair of them

/** The item picker for one pile: `ACCENTS` hues drawn from `rnd`, then `choose(size, r, avoid)`
 *  draws a piece `{ name, alt, turn, size, layer }` of that size from `r` (default `rnd`) in the
 *  neutral ramps and those hues, never a name in `avoid`. */
export function chooser(T, rnd) {
  const pickWith = r => list => list[Math.floor(r() * list.length)];
  const items = T.D.items;
  if (!PICKS.has(T)) PICKS.set(T, { pools: new Map(), hues: [...new Set(T.names.flatMap(nm =>
    items[nm].alts.flatMap(a => Object.values({ ...items[nm].slots, ...a }))))].filter(r => !NEUTRAL.has(r)) });
  const memo = PICKS.get(T), accents = new Set();
  while (accents.size < ACCENTS) accents.add(pickWith(rnd)(memo.hues));
  const key = [...accents].sort().join('/');
  if (!memo.pools.has(key)) {
    const fits = Object.fromEntries(T.names.map(nm => [nm, items[nm].alts.map((a, k) => k)
      .filter(k => Object.values({ ...items[nm].slots, ...items[nm].alts[k] }).every(r => NEUTRAL.has(r) || accents.has(r)))]));
    const pool = Object.fromEntries(['hero', 'mid', 'bit'].map(s => [s, T[s].filter(nm => fits[nm].length)]));
    memo.pools.set(key, { fits, pool });
  }
  const { fits, pool } = memo.pools.get(key);
  return (size, r = rnd, avoid = null) => {
    const pick = pickWith(r);
    let name = pick(pool[size]);
    while (avoid?.has(name)) name = pick(pool[size]);
    const alt = pick(fits[name]), turn = Math.floor(r() * T.turns(name));
    return { name, alt, turn, size, layer: items[name].layer === 'flat' ? 'flat' : size };
  };
}

/** The size classes of a pile of `n` pieces, heroes first. */
export function sizes(n) {
  const heroes = n >= 16 ? 2 : 1, mids = Math.round((n - heroes) * 0.45);
  return [...Array(heroes).fill('hero'), ...Array(mids).fill('mid'), ...Array(n - heroes - mids).fill('bit')];
}

/** One pile: its centre `cx, cy` and its pieces `{ name, alt, turn, size, x, y }`, x and y the
 *  sprite's top-left in a cell of side `C`, listed bottom first. `spill` is how far past the
 *  cell's edge the pile may reach, as a fraction of the cell; the pile spreads out to fill it. */
export function pileLayout(T, seed, { min = 9, max = 25, C = 24, spill = 0 } = {}) {
  const rnd = mulberry32(seed >>> 0);
  const choose = chooser(T, rnd);
  const n = min + Math.floor(rnd() * (max - min + 1));
  const want = sizes(n);
  const cx = C / 2 + (rnd() - 0.5) * 2, cy = C / 2 + (rnd() - 0.5) * 2;
  // Inside the cell keeps MARGIN clear of its seams; a spill reaches that far past them.
  const over = Math.round(spill * C), grow = 1 + spill * 4.8;
  const lo = over ? -1 - over : MARGIN, hi = over ? C - 1 + over : C - 2 - MARGIN;  // first and last pixel a piece may cover
  const P = C, G = C + 2 * P;                          // the owner grid runs a cell past every edge
  const owner = new Int8Array(G * G).fill(-1);         // which size class covers each pixel
  const at = (x, y) => (y + P) * G + x + P;
  const placed = [], usedHeroes = new Set();
  for (const size of want) {
    const piece = choose(size, rnd, size === 'hero' ? usedHeroes : null);
    if (size === 'hero') usedHeroes.add(piece.name);
    const s = T.sprite(piece.name, piece.alt, piece.turn);
    let best = null;
    for (let t = 0; t < 6; t++) {
      const a = rnd() * Math.PI * 2, r = REACH[size] * grow * Math.sqrt(rnd());
      const x = Math.max(lo, Math.min(hi + 1 - s.w, Math.round(cx + Math.cos(a) * r - s.w / 2)));
      const y = Math.max(lo, Math.min(hi + 1 - s.h, Math.round(cy + Math.sin(a) * r - s.h / 2)));
      let cost = 0;
      for (const [px, py] of s.px) {
        const o = owner[at(x + px, y + py)];
        if (o >= 0) cost += o === ORDER.hero ? 4 : 1;
      }
      if (!best || cost < best.cost) best = { x, y, cost };
    }
    for (const [px, py] of s.px) owner[at(best.x + px, best.y + py)] = ORDER[size];
    placed.push({ ...piece, x: best.x, y: best.y });
  }
  return { cx, cy, pieces: placed.sort((a, b) => ORDER[a.layer] - ORDER[b.layer]) };
}

/** The pile with each piece pulled back toward the pile's centre until none of its pixels is
 *  `blocked(x, y)` (cell-local), as if it flew out and stopped against what is there. */
export function settle(T, pile, blocked) {
  const pieces = pile.pieces.map(p => {
    const s = T.sprite(p.name, p.alt, p.turn);
    const dx = p.x + s.w / 2 - pile.cx, dy = p.y + s.h / 2 - pile.cy, len = Math.ceil(Math.hypot(dx, dy));
    for (let k = 0; k <= len; k++) {
      const t = len ? 1 - k / len : 0;
      const x = Math.round(pile.cx + dx * t - s.w / 2), y = Math.round(pile.cy + dy * t - s.h / 2);
      if (!s.px.some(([px, py]) => blocked(x + px, y + py))) return { ...p, x, y };
    }
    throw new Error(`${p.name} has no room at the centre of its pile`);
  });
  return { ...pile, pieces };
}

/** Draw a pile laid out by pileLayout() with its cell's top-left at (ox, oy). Pieces past the
 *  cell's edge draw over the neighbouring cells.
 *  outline: 'none' | 'pile' (ink round the whole pile) | 'piece' (ink round every piece)
 *  shadow:  'none' | 'drop' (each piece one pixel down-right) | 'base' (the pile grown by one pixel) */
export function drawPile(ctx, T, pile, ox, oy, { outline = 'pile', shadow = 'base' } = {}) {
  const sprites = pile.pieces.map(p => [T.sprite(p.name, p.alt, p.turn), p.x, p.y]);
  const mask = new Set();
  for (const [s, x0, y0] of sprites) for (const [px, py] of s.px) mask.add(`${x0 + px},${y0 + py}`);
  const xs = sprites.flatMap(([s, x0]) => [x0, x0 + s.w]), ys = sprites.flatMap(([s, , y0]) => [y0, y0 + s.h]);
  const [x0b, x1b, y0b, y1b] = [Math.min(...xs) - 1, Math.max(...xs), Math.min(...ys) - 1, Math.max(...ys)];
  const dot = (x, y, col) => { ctx.fillStyle = col; ctx.fillRect(ox + x, oy + y, 1, 1); };
  const ring = (has, x, y, diag) => [[1, 0], [-1, 0], [0, 1], [0, -1], ...(diag ? [[1, 1], [-1, -1], [1, -1], [-1, 1]] : [])]
    .some(([dx, dy]) => has(x + dx, y + dy));
  const inMask = (x, y) => mask.has(`${x},${y}`);
  const around = fn => { for (let y = y0b; y <= y1b; y++) for (let x = x0b; x <= x1b; x++) if (!inMask(x, y)) fn(x, y); };

  if (shadow === 'base') around((x, y) => { if (ring(inMask, x, y, true)) dot(x, y, SHADOW); });
  if (shadow === 'drop') for (const [s, x0, y0] of sprites) for (const [px, py] of s.px) {
    const x = x0 + px + 1, y = y0 + py + 1;
    if (!inMask(x, y)) dot(x, y, SHADOW);
  }
  if (outline === 'pile') around((x, y) => { if (ring(inMask, x, y, false)) dot(x, y, T.D.ink); });
  for (const [s, x0, y0] of sprites) {
    if (outline === 'piece') {
      const own = new Set(s.px.map(([px, py]) => `${x0 + px},${y0 + py}`));
      const has = (x, y) => own.has(`${x},${y}`);
      for (let y = y0 - 1; y <= y0 + s.h; y++) for (let x = x0 - 1; x <= x0 + s.w; x++)
        if (!has(x, y) && ring(has, x, y, false)) dot(x, y, T.D.ink);
    }
    for (const [px, py, col] of s.px) dot(x0 + px, y0 + py, col);
  }
}
