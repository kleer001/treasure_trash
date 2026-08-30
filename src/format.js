// Treasure Trash — the file formats. Parse and serialise levels (.tt) and solutions (.sol).
// Text in, data out; data in, byte-identical text out. See FORMATS.md for the spec.

import {
  SKATE, BARROW_U, BARROW_D, BARROW_L, BARROW_R,
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, BIN_EMPTY, WHEELIE, WHEELIE_EMPTY, JUG,
  JUG_EMPTY, SPONGE, CARDBOARD, PANE, TIRE_H, TIRE_V, BICYCLE, RUG, CHAIR, BROOM,
  CABC_U, CABC_D, CABC_L, CABC_R, CABO_U, CABO_D, CABO_L, CABO_R,
  BAR_U, BAR_D, BAR_L, BAR_R, isCarriedBarrow,
  MAG_U, MAG_D, MAG_L, MAG_R,
  GREASE, TAR, GLASS, COVERED,
  FURNITURE, DIRS, MOVE, PUSH, TEAR, isMultiCell, settleAtRest,
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
  // closed and one cell. Upper case is open and names a PIECE of two cells lying along that
  // facing — the drawer is the end the facing points at — so, like the couch, each facing needs
  // a pool of letters and a blob of one letter is one cabinet.
  'a': { o: CABC_U }, 'e': { o: CABC_D }, 'k': { o: CABC_L }, 'm': { o: CABC_R },
  ...Object.fromEntries([...'AL'].map(ch => [ch, { o: CABO_U }])),
  ...Object.fromEntries([...'DT'].map(ch => [ch, { o: CABO_D }])),
  ...Object.fromEntries([...'IP'].map(ch => [ch, { o: CABO_L }])),
  ...Object.fromEntries([...'JQ'].map(ch => [ch, { o: CABO_R }])),
  // The magnet, by the way its field points. It never turns, so the glyph is the whole of it.
  'f': { o: MAG_U }, 'l': { o: MAG_D }, 'p': { o: MAG_L }, 'q': { o: MAG_R },
  // A barrow riding in something, still facing the way it faces. Only ever found in a cart
  // cell — set down anywhere it is a barrow again, and written in the `:cart` mask instead.
  '^': { o: BAR_U }, 'v': { o: BAR_D }, '<': { o: BAR_L }, '>': { o: BAR_R },
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
export const CAB_POOLS = { [CABO_U]: [...'AL'], [CABO_D]: [...'DT'],
                           [CABO_L]: [...'IP'], [CABO_R]: [...'JQ'] };
// An open cabinet is two cells lying along its facing, and only the count is free: a vertical
// blob written with a left-facing letter parses as a piece and is then read wrong by everything
// that asks which end the drawer is. So the shape is checked where the complaint can name a cell.
const cabinetShape = axis => (n, cells) => {
  if (n !== 2) return `covers ${n} cell${n === 1 ? '' : 's'}; an open cabinet is exactly two`;
  const [a, b] = [...cells].sort((p, q) => p[1] - q[1] || p[0] - q[0]);
  const along = axis === 'v' ? b[0] === a[0] && b[1] === a[1] + 1 : b[1] === a[1] && b[0] === a[0] + 1;
  return along ? null : 'lies across its own facing; its drawer is the cell the facing points at';
};
const MULTI_POOLS = [
  { pool: FURN_POOL, o: FURNITURE, what: 'furniture', bad: n => (n < 2 ? 'is a single cell; use a can, or give it a second cell' : null) },
  { pool: BIKE_POOL, o: BICYCLE, what: 'bicycle', bad: n => (n !== 2 ? `covers ${n} cell${n === 1 ? '' : 's'}; a bicycle is exactly two` : null) },
  { pool: RUG_POOL, o: RUG, what: 'rug', bad: n => (n < 2 ? 'is a single cell; a rug is at least two' : null) },
  { pool: CAB_POOLS[CABO_U], o: CABO_U, what: 'open cabinet', bad: cabinetShape('v') },
  { pool: CAB_POOLS[CABO_D], o: CABO_D, what: 'open cabinet', bad: cabinetShape('v') },
  { pool: CAB_POOLS[CABO_L], o: CABO_L, what: 'open cabinet', bad: cabinetShape('h') },
  { pool: CAB_POOLS[CABO_R], o: CABO_R, what: 'open cabinet', bad: cabinetShape('h') },
];
// Carts are written in their own aligned `:cart` block rather than the occupant grid, for the
// same reason water is: a cart cell holds cargo, and one character cannot say "empty cart
// cell", "cart holding a can" and "cart Q holding trash" at once. Same blob rule, own pool.
export const SKATE_POOL = [...'PQR'];
// A barrow is a cart of ONE cell, and its axis is in the glyph because nothing else carries it.

const CART_KINDS_IN_MASK = [
  { glyphs: [...'PQR'], ck: SKATE, size: 2, word: 'two', what: 'skateboard' },
  // A barrow faces the way its tub points, and the mask says so outright: the direction it
  // faces, and the NEXT LETTER ALONG for a second one facing the same way. Not its capital,
  // which would want `R` — and `R` is a two-cell skateboard, which the reader would match first.
  { glyphs: [...'uvw'], ck: BARROW_U, size: 1, word: 'one', what: 'barrow (facing up)' },
  { glyphs: [...'def'], ck: BARROW_D, size: 1, word: 'one', what: 'barrow (facing down)' },
  { glyphs: [...'lmn'], ck: BARROW_L, size: 1, word: 'one', what: 'barrow (facing left)' },
  { glyphs: [...'rst'], ck: BARROW_R, size: 1, word: 'one', what: 'barrow (facing right)' },
];

export const LEGEND = [
  '# wall', '- floor', '@ raccoon', '$ bag', 'C full can', 'c empty can',
  'x spilled trash', 'E exit', '+ raccoon on exit',
  'W wheelie bin (full)', 'w wheelie bin (empty)',
  'B recycle bin (full)', 'b recycle bin (empty)', 'j water jug', 'i empty jug', 's sponge', 'd flattened cardboard', 'g pane of glass',
  'o tyre lying across the alley — rolls left and right', 'O tyre rolls up and down', 'h office chair on castors', 'r broom',
  'a/e/k/m filing cabinet, closed — drawer faces up/down/left/right',
  'A/L, D/T, I/P, J/Q the same cabinet open — two cells along that facing, one letter per piece',
  'f/l/p/q magnet — its field runs up/down/left/right',
  `${FURN_POOL.join('/')} furniture — one letter per piece, a touching same-letter blob is one couch`,
  'terrain lives in its own :water block — ~ open canal, = filled in (floor), - dry',
  `skateboards live in their own :cart block — ${SKATE_POOL.join('/')}, two cells each, cargo reads from :grid`,
  'barrows live there too, one cell each — u/d/l/r face up/down/left/right, and the next '
    + 'letters along are further barrows facing the same way',
  ':hold says what a carried barrow has inside it — "x,y glyphs", outermost first',
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
    const bad = wrongSize(size.length, size);
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
    const n = used.get(spec.o) ?? 0;
    if (n >= spec.pool.length)
      throw new Error(`more than ${spec.pool.length} ${spec.what} pieces: the glyph pool is ${spec.pool.join('')}`);
    letters.set(c.pid, spec.pool[n]);
    used.set(spec.o, n + 1);
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

// One occupant code, one character. Out here rather than inside `glyphFor` because `:hold`
// writes bare codes with no cell around them, and two tables would drift.
const WRITE = { [NONE]: '-', [BAG]: '$', [CAN_FULL]: 'C', [CAN_EMPTY]: 'c', [TRASH]: 'x',
                [WHEELIE]: 'W', [WHEELIE_EMPTY]: 'w', [BIN]: 'B', [BIN_EMPTY]: 'b',
                [JUG]: 'j', [JUG_EMPTY]: 'i', [SPONGE]: 's', [CARDBOARD]: 'd',
                [PANE]: 'g', [TIRE_H]: 'o', [TIRE_V]: 'O',
                [CHAIR]: 'h', [BROOM]: 'r',
                [CABC_U]: 'a', [CABC_D]: 'e', [CABC_L]: 'k', [CABC_R]: 'm',
                [MAG_U]: 'f', [MAG_D]: 'l', [MAG_L]: 'p', [MAG_R]: 'q',
                [BAR_U]: '^', [BAR_D]: 'v', [BAR_L]: '<', [BAR_R]: '>' };

// A code with no glyph writes NOTHING and shortens the row, which reads downstream as a board
// of a different shape rather than as a piece nobody taught the writer about.
const glyphOf = o => WRITE[o] ?? (() => {
  throw new Error(`no glyph for occupant ${o}`);
})();

// Terrain rides in the masks, not in this grid.
function glyphFor(c, isRac, letters) {
  if (c.wall) return '#';
  if (!c.exit) {
    if (isRac) return '@';
    if (isMultiCell(c.o)) return letters.get(c.pid);
    return glyphOf(c.o);
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

// Four directives open a verbatim block, each closed by `:end`: the occupant `:grid`, the
// optional `:water` and `:cart` masks laid over it, and `:hold` — which is a LIST rather than a
// mask, because what it says is not one character per cell. A cell that is carrying a barrow
// that is itself carrying something has a chain in it, and a chain is as long as it is.
const BLOCK_KEYS = new Set(['grid', 'water', 'cart', 'hold']);

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
    for (const k of ['name', 'teach', 'gate', 'arm', 'par', 'traps', 'solves', 'lead', 'tail', 'solve', 'note']) {
      if (l[k] === undefined) continue;
      if (BOOL_KEYS.has(k) && !l[k]) continue;                 // off is the default: don't write it
      const v = BOOL_KEYS.has(k) ? 'on' : l[k];
      out.push(`:${k}${' '.repeat(Math.max(1, 7 - k.length))}${v}`);
    }
    out.push(':grid', ...l.grid, ':end');
    if (l.water) out.push(':water', ...l.water, ':end');
    if (l.cart) out.push(':cart', ...l.cart, ':end');
    if (l.hold) out.push(':hold', ...l.hold, ':end');
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
        const kind = CART_KINDS_IN_MASK.find(k => k.glyphs.includes(ch));
        if (!kind) {
          const all = CART_KINDS_IN_MASK.flatMap(k => k.glyphs).join('');
          throw new Error(`${level.id}: :cart takes ${all} or floor, got ${JSON.stringify(ch)} at (${x + 1},${y + 1})`);
        }
        cells[y][x].ck = kind.ck;
        const c = cells[y][x];
        if (c.wall) throw new Error(`${level.id}: (${x + 1},${y + 1}) is both wall and cart`);
        if (c.exit) throw new Error(`${level.id}: the exit cannot hold a cart at (${x + 1},${y + 1})`);
        if (isMultiCell(c.o)) throw new Error(`${level.id}: a cart cannot hold a multi-cell piece at (${x + 1},${y + 1})`);
        if (rac.x === x && rac.y === y)
          throw new Error(`${level.id}: the raccoon cannot start in a cart at (${x + 1},${y + 1})`);
        row.push(ch);
      }
      marks.push(row);
    }
    // One counter across the kinds, and a size rule per kind: a skateboard is two cells and a barrow
    // is one, so the two cannot share a single check.
    let nextCid = 0;
    for (const k of CART_KINDS_IN_MASK)
      nextCid = labelBlobs(cells,
        marks.map(row => row.map(ch => (ch !== null && k.glyphs.includes(ch) ? ch : null))),
        level.id, 'cart', k.what,
        n => (n !== k.size ? `covers ${n} cell${n === 1 ? '' : 's'}; a ${k.what} is exactly ${k.word}` : null),
        nextCid);
  }
  // A carried barrow is cargo, and cargo needs something to be in. On the floor it would be a
  // code no branch can shove and no writer can put back — `:cart` is where a barrow that is
  // standing on its own wheel is written.
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (isCarriedBarrow(cells[y][x].o) && cells[y][x].cart === undefined)
      throw new Error(`${level.id}: a carried barrow at (${x + 1},${y + 1}) with no cart to ride in`);
  }

  // What a carried barrow has inside it. One line per loaded cell, `x,y` in grid indices
  // followed by the chain from the outside in — so `4,2 >C` is a barrow facing right with a
  // full can in it, riding in whatever stands at (4,2).
  //
  // A list and not a mask, and read last: it names cells the grid and the cart mask have
  // already settled, and everything it can say is a statement ABOUT one of them.
  if (level.hold) {
    const seen = new Set();
    for (const raw of level.hold) {
      const line = raw.trim();
      if (!line || line.startsWith(';')) continue;
      const m = /^(\d+),(\d+)[ \t]+(\S+)$/.exec(line);
      if (!m) throw new Error(`${level.id}: :hold wants 'x,y glyphs', got ${JSON.stringify(raw)}`);
      const [, sx, sy, chain] = m;
      const x = Number(sx), y = Number(sy);
      if (x >= cols || y >= rows) throw new Error(`${level.id}: :hold names (${x},${y}), off a ${cols}x${rows} grid`);
      if (seen.has(`${x},${y}`)) throw new Error(`${level.id}: :hold names (${x},${y}) twice`);
      seen.add(`${x},${y}`);
      // Only a carried barrow has anywhere to put one. Anything else with a `:hold` line is a
      // board that cannot exist, and one nothing downstream would be able to read back out.
      if (!isCarriedBarrow(cells[y][x].o))
        throw new Error(`${level.id}: (${x},${y}) is not a carried barrow, so it holds nothing`);
      const codes = [...chain].map(ch => {
        const spec = READ[ch];
        if (!spec || spec.o === undefined || spec.o === NONE)
          throw new Error(`${level.id}: :hold at (${x},${y}) takes occupant glyphs, got ${JSON.stringify(ch)}`);
        return spec.o;
      });
      codes.forEach((o, i) => {
        if (i < codes.length - 1 && !isCarriedBarrow(o))
          throw new Error(`${level.id}: :hold at (${x},${y}) puts something inside ${JSON.stringify(chain[i])}, which is not a barrow`);
        if (isMultiCell(o))
          throw new Error(`${level.id}: :hold at (${x},${y}) holds ${JSON.stringify(chain[i])}, which is bigger than one cell`);
      });
      cells[y][x].hold = codes;
    }
  }
  // A room opens with its fields already holding. Here rather than at each caller: the game, the
  // solver and every tool build their start board through this function, and a board that reached
  // one of them unsettled would be a different room from the one the others were reading.
  return settleAtRest({ cols, rows, cells, rac });
}

/** The `:hold` lines for a board, or null when nothing on it is carrying a loaded barrow. */
export function toHold(s) {
  const out = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) {
    const h = s.cells[y][x].hold;
    if (h?.length) out.push(`${x},${y} ${h.map(glyphOf).join('')}`);
  }
  return out.length ? out : null;
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
  const letters = new Map(), used = new Map();
  for (const row of s.cells) for (const c of row) {
    if (c.cart === undefined || letters.has(c.cart)) continue;
    const k = CART_KINDS_IN_MASK.find(m => m.ck === (c.ck ?? CART));
    const n = used.get(k.what) ?? 0;
    if (n >= k.glyphs.length)
      throw new Error(`more than ${k.glyphs.length} of ${k.what}: the glyph pool is ${k.glyphs.join('')}`);
    letters.set(c.cart, k.glyphs[n]);
    used.set(k.what, n + 1);
  }
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
