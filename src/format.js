// Treasure Trash — the file formats. Parse and serialise levels (.tt) and solutions (.sol).
// Text in, data out; data in, byte-identical text out. See FORMATS.md for the spec.

import {
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, BIN_EMPTY, STACK, WHEELIE, WHEELIE_EMPTY, JUG,
  JUG_EMPTY, SPONGE, CARDBOARD, PANE, TIRE_H, TIRE_V, BICYCLE, RUG, CHAIR, BROOM,
  CABC_U, CABC_D, CABC_L, CABC_R, CABO_U, CABO_D, CABO_L, CABO_R, DRAWER,
  GREASE, TAR, GLASS, COVERED,
  FURNITURE, DIRS, MOVE, PUSH, TEAR, isMultiCell,
} from './rules.js';

// --- glyphs -----------------------------------------------------------------
// Canonical writer emits exactly one glyph per cell state. The reader also accepts
// the floor aliases, because ' ' loses to trailing-whitespace stripping and '.' reads
// better inside a markdown doc. Everything else is strict — unknown glyph = throw.
export const FLOOR_ALIASES = new Set([' ', '-', '.']);
const READ = {
  '#': { wall: true },
  '-': {}, ' ': {}, '.': {},
  '@': { rac: true },
  '$': { o: BAG },
  'C': { o: CAN_FULL },
  'c': { o: CAN_EMPTY },
  'x': { o: TRASH },
  'S': { o: STACK },
  'W': { o: WHEELIE },
  'w': { o: WHEELIE_EMPTY },
  'B': { o: BIN },
  'b': { o: BIN_EMPTY },
  'j': { o: JUG },
  'i': { o: JUG_EMPTY },
  's': { o: SPONGE },
  'd': { o: CARDBOARD },
  'g': { o: PANE },
  'o': { o: TIRE_H },
  'O': { o: TIRE_V },
  'h': { o: CHAIR },
  'r': { o: BROOM },
  // A filing cabinet: the glyph carries the facing, because nothing else does. Lower case is
  // closed and one cell; upper case is open and two, the drawer lying in the facing direction.
  'a': { o: CABC_U }, 'e': { o: CABC_D }, 'k': { o: CABC_L }, 'm': { o: CABC_R },
  'A': { o: CABO_U }, 'D': { o: CABO_D }, 'I': { o: CABO_L }, 'J': { o: CABO_R },
  'X': { o: DRAWER },        // the drawer; which cabinet it belongs to is read off its facing
  'E': { exit: true },
  // Furniture glyphs name a PIECE, not a kind of thing: a 4-connected blob of one letter is
  // one couch, so two flush couches need two letters. Hence a pool — see FURN_POOL.
  ...Object.fromEntries([...'FGHKMN'].map(ch => [ch, { o: FURNITURE }])),
  ...Object.fromEntries([...'YZ'].map(ch => [ch, { o: BICYCLE }])),
  ...Object.fromEntries([...'UV'].map(ch => [ch, { o: RUG }])),
  '+': { exit: true, rac: true },     // raccoon standing on the exit (XSB's player-on-goal)
  // No glyph for water or for an occupied exit — see FORMATS.md for why each is absent.
};

// The `:water` mask alphabet. One character per terrain, and the floor aliases read as dry so a
// mask can be written with `-` or `.` like any other block. The directive keeps its old name
// because sixty-one shipped rooms spell it that way; what it carries is every terrain lane.
export const WET = '~';   // open canal
const FILLED = '=';     // a canal cell somebody filled in: floor, and drawn as the plank it is

// Terrain reaches a cell one of two ways, and which one decides whether `stateKey` carries it.
// MUTABLE lanes ride in `ter`, one exclusive value, because a move can change them. STATIC lanes
// are their own flags and stay out of the key, for the reason `wall` always did: they cannot
// differ between two states of one room.
const TER_GLYPHS = {
  '%': { ter: GREASE }, 'T': { ter: TAR }, '*': { ter: GLASS }, '_': { ter: COVERED },
  'O': { grate: true },
  '^': { oneway: 'u' }, 'v': { oneway: 'd' }, '<': { oneway: 'l' }, '>': { oneway: 'r' },
};
const TER_WRITE = { [GREASE]: '%', [TAR]: 'T', [GLASS]: '*', [COVERED]: '_' };
const ONEWAY_WRITE = { u: '^', d: 'v', l: '<', r: '>' };
// The pool of letters furniture pieces are written with. The writer hands them out in raster
// order of each piece's first cell, so a board's lettering is canonical and the grid
// round-trips. Past the end of the pool, throw rather than wrap.
export const FURN_POOL = [...'FGHKMN'];
// Each multi-cell KIND needs a pool of its own, for the reason furniture does: a blob of one
// letter is one piece, so two flush bicycles need two letters between them.
export const BIKE_POOL = [...'YZ'];
export const RUG_POOL = [...'UV'];
const MULTI_POOLS = [
  { pool: FURN_POOL, o: FURNITURE, what: 'furniture', bad: n => (n < 2 ? 'is a single cell; use a can, or give it a second cell' : null) },
  { pool: BIKE_POOL, o: BICYCLE, what: 'bicycle', bad: n => (n !== 2 ? `covers ${n} cell${n === 1 ? '' : 's'}; a bicycle is exactly two` : null) },
  { pool: RUG_POOL, o: RUG, what: 'rug', bad: n => (n < 2 ? 'is a single cell; a rug is at least two' : null) },
];
// Carts are written in their own aligned `:cart` block rather than the occupant grid, for the
// same reason water is: a cart cell holds cargo, and one character cannot say "empty cart
// cell", "cart holding a can" and "cart Q holding trash" at once. Same blob rule, own pool.
export const CART_POOL = [...'PQR'];

export const LEGEND = [
  '# wall', '- floor', '@ raccoon', '$ bag', 'C full can', 'c empty can',
  'x spilled trash', 'E exit', '+ raccoon on exit',
  'S bag-on-can stack', 'W wheelie bin (full)', 'w wheelie bin (empty)',
  'B recycle bin (full)', 'b recycle bin (empty)', 'j water jug', 'i empty jug', 's sponge', 'd flattened cardboard', 'g pane of glass',
  'o tyre lying across the alley — rolls left and right', 'O tyre rolls up and down', 'h office chair on castors', 'r broom',
  'a/e/k/m filing cabinet, closed — drawer faces up/down/left/right',
  'A/D/I/J the same cabinet open — its drawer is the X beside it',
  'X a cabinet drawer, out',
  `${FURN_POOL.join('/')} furniture — one letter per piece, a touching same-letter blob is one couch`,
  'terrain lives in its own :water block — ~ open canal, = filled in (floor), - dry',
  `carts live in their own :cart block — ${CART_POOL.join('/')}, two cells each, cargo reads from :grid`,
];

/**
 * Number the multi-cell pieces on a freshly-read board, in `field`. Each 4-connected run of
 * the SAME glyph is one piece; a different letter starts a different piece even flush against
 * it, and the same letter used in two places that do not touch is simply two pieces. Ids are
 * handed out in raster order of each piece's first cell, which is what makes the writer
 * reproduce the lettering it was given. `wrongSize` names the complaint, or returns null.
 */
function labelBlobs(cells, glyphs, id, field, what, wrongSize, first = 0) {
  const rows = cells.length, cols = cells[0].length;
  let next = first;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!glyphs[y][x] || cells[y][x][field] !== undefined) continue;
    const pid = next++, ch = glyphs[y][x], stack = [[x, y]], size = [];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      if (glyphs[cy][cx] !== ch || cells[cy][cx][field] !== undefined) continue;
      cells[cy][cx][field] = pid; size.push([cx, cy]);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    const bad = wrongSize(size.length);
    if (bad) throw new Error(`${id}: ${what} '${ch}' at (${x + 1},${y + 1}) ${bad}`);
  }
  return next;
}

/** Letters for the multi-cell pieces, each kind drawn from its own pool. Handed out in raster
 *  order of a piece's first cell, so a board's lettering is canonical and round-trips. */
function pieceLetters(s) {
  const letters = new Map(), used = new Map();
  for (const row of s.cells) for (const c of row) {
    if (c.pid === undefined || letters.has(c.pid)) continue;
    const spec = MULTI_POOLS.find(m => m.o === c.o);
    if (!spec) throw new Error(`occupant ${c.o} carries a piece id but has no glyph pool`);
    const n = used.get(spec.what) ?? 0;
    if (n >= spec.pool.length)
      throw new Error(`more than ${spec.pool.length} ${spec.what} pieces: the glyph pool is ${spec.pool.join('')}`);
    letters.set(c.pid, spec.pool[n]);
    used.set(spec.what, n + 1);
  }
  return letters;
}

function poolLetters(s, field, pool, what) {
  const letters = new Map();
  for (const row of s.cells) for (const c of row) {
    if (c[field] === undefined || letters.has(c[field])) continue;
    if (letters.size >= pool.length)
      throw new Error(`more than ${pool.length} ${what}: the glyph pool is ${pool.join('')}`);
    letters.set(c[field], pool[letters.size]);
  }
  return letters;
}

// Terrain rides in the masks, not in this grid.
function glyphFor(c, isRac, letters) {
  if (c.wall) return '#';
  if (!c.exit) {
    if (isRac) return '@';
    if (isMultiCell(c.o)) return letters.get(c.pid);
    return { [NONE]: '-', [BAG]: '$', [CAN_FULL]: 'C', [CAN_EMPTY]: 'c', [TRASH]: 'x',
             [STACK]: 'S', [WHEELIE]: 'W', [WHEELIE_EMPTY]: 'w', [BIN]: 'B', [BIN_EMPTY]: 'b',
             [JUG]: 'j', [JUG_EMPTY]: 'i', [SPONGE]: 's', [CARDBOARD]: 'd',
             [PANE]: 'g', [TIRE_H]: 'o', [TIRE_V]: 'O',
             [CHAIR]: 'h', [BROOM]: 'r',
             [CABC_U]: 'a', [CABC_D]: 'e', [CABC_L]: 'k', [CABC_R]: 'm',
             [CABO_U]: 'A', [CABO_D]: 'D', [CABO_L]: 'I', [CABO_R]: 'J',
             [DRAWER]: 'X' }[c.o];
  }
  if (isRac) return '+';
  if (c.o === NONE) return 'E';
  // Unreachable by the rules — if we ever get here, a rule broke. Fail loudly.
  throw new Error(`occupant ${c.o} on an exit cell: the exit must never hold an object`);
}

// --- level pack -------------------------------------------------------------
// A directive line starts with ':'. A comment line starts with ';'. Everything
// between ':grid' and ':end' is taken verbatim, so no glyph can collide with a key.

const INT_KEYS = new Set(['par', 'traps', 'solves', 'lead', 'tail']);
// `:arm on` is input-layer only: it never reaches the rules engine or the solver.
const BOOL_KEYS = new Set(['arm']);
const BOOLS = { on: true, off: false, true: true, false: false };

// Three directives open a verbatim block, each closed by `:end`: the occupant `:grid`, and
// the optional `:water` and `:cart` masks laid over it.
const BLOCK_KEYS = new Set(['grid', 'water', 'cart']);

/**
 * One grammar, two files. `sectionKey` is 'level' or 'solution'; entries collect every
 * other directive as a field, plus an optional verbatim :grid/:end block.
 */
export function parseSections(text, sectionKey) {
  const pack = { meta: {}, entries: [] };
  let cur = null, block = null, blockKey = null;

  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\r$/, '');
    const at = `line ${i + 1}`;

    if (block !== null) {
      if (line.trim() === ':end') {
        if (!block.length) throw new Error(`${at}: empty :${blockKey} in ${cur.id}`);
        cur[blockKey] = block; block = null; blockKey = null;
      } else block.push(line);
      return;
    }
    if (!line.trim() || line.startsWith(';')) return;
    if (!line.startsWith(':')) throw new Error(`${at}: expected a ':key' directive, got ${JSON.stringify(line)}`);

    const m = /^:(\w+)[ \t]*(.*)$/.exec(line);
    if (!m) throw new Error(`${at}: malformed directive ${JSON.stringify(line)}`);
    const [, key, rest] = m;
    const val = rest.trim();

    if (BLOCK_KEYS.has(key)) {
      if (!cur) throw new Error(`${at}: :${key} outside a :${sectionKey}`);
      if (cur[key] !== undefined) throw new Error(`${at}: duplicate :${key}`);
      block = []; blockKey = key; return;
    }
    if (key === 'end') throw new Error(`${at}: :end without ${[...BLOCK_KEYS].map(k => `:${k}`).join(', ')}`);
    if (key === sectionKey) { cur = { id: val }; pack.entries.push(cur); return; }
    if (key === 'level' || key === 'solution') throw new Error(`${at}: :${key} in a :${sectionKey} file`);

    const target = cur || pack.meta;
    if (target[key] !== undefined) throw new Error(`${at}: duplicate :${key}`);
    if (INT_KEYS.has(key)) {
      if (!/^\d+$/.test(val)) throw new Error(`${at}: :${key} wants an integer, got ${JSON.stringify(val)}`);
      target[key] = Number(val);
    } else if (BOOL_KEYS.has(key)) {
      if (!(val in BOOLS)) throw new Error(`${at}: :${key} wants on|off, got ${JSON.stringify(val)}`);
      target[key] = BOOLS[val];
    } else target[key] = val;
  });

  if (block !== null) throw new Error(`:${blockKey} never closed with :end`);
  return pack;
}

export function parseLevelPack(text) {
  const pack = parseSections(text, 'level');
  for (const l of pack.entries) {
    if (!l.grid) throw new Error(`level ${l.id}: no :grid`);
    if (l.par === undefined) throw new Error(`level ${l.id}: no :par`);
    if (!l.solve) throw new Error(`level ${l.id}: no :solve`);
  }
  return { meta: pack.meta, levels: pack.entries };
}

export function parseSolutionPack(text) {
  const pack = parseSections(text, 'solution');
  for (const s of pack.entries) {
    if (!s.moves) throw new Error(`solution ${s.id}: no :moves`);
    if (s.grid || s.water || s.cart) throw new Error(`solution ${s.id}: a solution has no map blocks`);
  }
  return { meta: pack.meta, solutions: pack.entries };
}

export function formatLevelPack(pack) {
  const out = [];
  if (pack.meta.pack) out.push(`:pack   ${pack.meta.pack}`);
  if (pack.meta.format) out.push(`:format ${pack.meta.format}`);
  out.push(';', `; legend  ${LEGEND.join('  ')}`, ';', '');
  for (const l of pack.levels) {
    out.push(`:level  ${l.id}`);
    for (const k of ['name', 'teach', 'arm', 'par', 'traps', 'solves', 'lead', 'tail', 'solve', 'note']) {
      if (l[k] === undefined) continue;
      if (BOOL_KEYS.has(k) && !l[k]) continue;                 // off is the default: don't write it
      const v = BOOL_KEYS.has(k) ? 'on' : l[k];
      out.push(`:${k}${' '.repeat(Math.max(1, 7 - k.length))}${v}`);
    }
    out.push(':grid', ...l.grid, ':end');
    if (l.water) out.push(':water', ...l.water, ':end');
    if (l.cart) out.push(':cart', ...l.cart, ':end');
    out.push('');
  }
  return out.join('\n').replace(/\n+$/, '\n');
}

/** Validates structure at the boundary, so everything downstream can trust the result. */
export function toState(level) {
  const rows = level.grid.length;
  const cols = Math.max(...level.grid.map(r => r.length));
  const cells = [], glyphs = [];
  let rac = null, exits = 0;

  for (let y = 0; y < rows; y++) {
    const row = [], grow = [];
    for (let x = 0; x < cols; x++) {
      const ch = level.grid[y][x] ?? '-';        // short rows pad with floor
      const spec = READ[ch];
      if (!spec) throw new Error(`${level.id}: unknown glyph ${JSON.stringify(ch)} at (${x + 1},${y + 1})`);
      const c = { wall: !!spec.wall, exit: !!spec.exit, water: false, o: spec.o ?? NONE };
      if (spec.rac) {
        if (rac) throw new Error(`${level.id}: more than one raccoon`);
        rac = { x, y };
      }
      if (c.exit) exits++;
      row.push(c);
      grow.push(isMultiCell(c.o) ? ch : null);    // which letter wrote this cell, for grouping
    }
    cells.push(row); glyphs.push(grow);
  }
  if (!rac) throw new Error(`${level.id}: no raccoon`);
  if (exits !== 1) throw new Error(`${level.id}: needs exactly one exit, found ${exits}`);
  // One counter across every kind. `pieceCells` finds a piece by id alone, so a couch and a rug
  // that shared one would be read as a single piece and shoved as one.
  let nextPid = 0;
  for (const { o, what, bad } of MULTI_POOLS)
    nextPid = labelBlobs(cells,
      glyphs.map((row, y) => row.map((ch, x) => (cells[y][x].o === o ? ch : null))),
      level.id, 'pid', what, bad, nextPid);

  // The water mask, laid over the occupant grid. Optional — a room with no canal omits it.
  if (level.water) {
    if (level.water.length > rows)
      throw new Error(`${level.id}: :water has ${level.water.length} rows, :grid has ${rows}`);
    const alphabet = [WET, FILLED, ...Object.keys(TER_GLYPHS)].join('');
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const ch = level.water[y]?.[x] ?? '-';
      if (FLOOR_ALIASES.has(ch)) continue;
      const spec = ch === WET ? { water: true } : ch === FILLED ? { bridge: true } : TER_GLYPHS[ch];
      if (!spec) throw new Error(`${level.id}: :water takes one of '${alphabet}' or floor, got ${JSON.stringify(ch)} at (${x + 1},${y + 1})`);
      const c = cells[y][x];
      if (c.wall) throw new Error(`${level.id}: (${x + 1},${y + 1}) is both wall and terrain`);
      if (c.exit) throw new Error(`${level.id}: the exit cannot carry terrain at (${x + 1},${y + 1})`);
      Object.assign(c, spec);
    }
    const start = cells[rac.y][rac.x];
    if (start.water) throw new Error(`${level.id}: the raccoon starts in open water at (${rac.x + 1},${rac.y + 1})`);
    if (start.ter === GLASS) throw new Error(`${level.id}: the raccoon starts on broken glass at (${rac.x + 1},${rac.y + 1})`);
  }

  // The cart mask, laid over the occupant grid the same way. A cart cell's occupant IS the
  // cargo in that slot, so the mask is the only thing that says which cells are cart cells —
  // and, when two carts stand flush, which cart each cell belongs to.
  if (level.cart) {
    if (level.cart.length > rows)
      throw new Error(`${level.id}: :cart has ${level.cart.length} rows, :grid has ${rows}`);
    const marks = [];
    for (let y = 0; y < rows; y++) {
      const row = [];
      for (let x = 0; x < cols; x++) {
        const ch = level.cart[y]?.[x] ?? '-';
        if (FLOOR_ALIASES.has(ch)) { row.push(null); continue; }
        if (!CART_POOL.includes(ch))
          throw new Error(`${level.id}: :cart takes ${CART_POOL.join('')} or floor, got ${JSON.stringify(ch)} at (${x + 1},${y + 1})`);
        const c = cells[y][x];
        if (c.wall) throw new Error(`${level.id}: (${x + 1},${y + 1}) is both wall and cart`);
        if (c.exit) throw new Error(`${level.id}: the exit cannot hold a cart at (${x + 1},${y + 1})`);
        if (c.o === FURNITURE) throw new Error(`${level.id}: a cart cannot hold furniture at (${x + 1},${y + 1})`);
        if (rac.x === x && rac.y === y)
          throw new Error(`${level.id}: the raccoon cannot start in a cart at (${x + 1},${y + 1})`);
        row.push(ch);
      }
      marks.push(row);
    }
    labelBlobs(cells, marks, level.id, 'cart', 'cart',
      n => n !== 2 ? `covers ${n} cell${n === 1 ? '' : 's'}; a cart is exactly two` : null);
  }
  return { cols, rows, cells, rac };
}

/** Used for traces and for the round-trip checks in `verify.mjs`. */
export function toGrid(s) {
  const letters = pieceLetters(s);
  return s.cells.map((row, y) =>
    row.map((c, x) => glyphFor(c, s.rac.x === x && s.rac.y === y, letters)).join(''));
}

/** The matching cart mask, or null if the board has no carts. Cargo is not in here — it is
 *  an ordinary occupant sitting in an ordinary cell, and `toGrid` writes it. */
export function toCart(s) {
  if (!s.cells.some(row => row.some(c => c.cart !== undefined))) return null;
  const letters = poolLetters(s, 'cart', CART_POOL, 'carts');
  return s.cells.map(row =>
    row.map(c => (c.cart === undefined ? '-' : letters.get(c.cart))).join(''));
}

const terGlyph = c =>
  c.water ? WET : c.bridge ? FILLED
  : c.grate ? 'O' : c.oneway !== undefined ? ONEWAY_WRITE[c.oneway]
  : TER_WRITE[c.ter] ?? '-';

/** Null only when the board carries no terrain at all — a fully filled canal still gets a mask. */
export function toWater(s) {
  if (!s.cells.some(row => row.some(c => terGlyph(c) !== '-'))) return null;
  return s.cells.map(row => row.map(terGlyph).join(''));
}

// --- solutions --------------------------------------------------------------
// LURD, extended for a third action class:
//   lowercase l u r d = move
//   uppercase L U R D = push
//   uppercase + '!'   = pounce-tear

export function parseLurd(str, where = 'solution') {
  const actions = [];
  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    if (/\s/.test(ch)) continue;
    const lower = ch.toLowerCase();
    if (!DIRS[lower]) throw new Error(`${where}: unexpected character ${JSON.stringify(ch)} at offset ${i}`);
    const isUpper = ch !== lower;
    if (str[i + 1] === '!') {
      if (!isUpper) throw new Error(`${where}: a tear must be uppercase, got ${JSON.stringify(ch + '!')} at offset ${i}`);
      actions.push({ dir: lower, kind: TEAR }); i++;
    } else actions.push({ dir: lower, kind: isUpper ? PUSH : MOVE });
  }
  return actions;
}

export const formatLurd = actions => actions.map(({ dir, kind }) =>
  kind === MOVE ? dir : kind === PUSH ? dir.toUpperCase() : dir.toUpperCase() + '!').join('');

export function formatSolutionPack(pack) {
  const out = [];
  if (pack.meta.pack) out.push(`:pack   ${pack.meta.pack}`);
  if (pack.meta.format) out.push(`:format ${pack.meta.format}`);
  out.push('');
  for (const s of pack.solutions) {
    out.push(`:solution ${s.id}`);
    for (const k of ['label', 'moves', 'note']) {
      if (s[k] !== undefined) out.push(`:${k}${' '.repeat(Math.max(1, 7 - k.length))}${s[k]}`);
    }
    out.push('');
  }
  return out.join('\n').replace(/\n+$/, '\n');
}
