// Treasure Trash — the file formats. Parse and serialise levels (.tt) and solutions (.sol).
// Text in, data out; data in, byte-identical text out. See FORMATS.md for the spec.

import {
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY, JUG, FURNITURE,
  DIRS, MOVE, PUSH, TEAR,
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
  // Case carries load, as it does for the can: UPPER holds a bag, lower does not.
  'S': { o: STACK },          // a loose bag riding a still-full can
  'W': { o: WHEELIE },        // wheelie bin with a bag in it
  'w': { o: WHEELIE_EMPTY },  // wheelie bin, emptied — still rolls
  'b': { o: BIN },            // recycle bin: drops one cell of trash per shove
  'j': { o: JUG },            // water jug: spills one cell of water per shove
  'E': { exit: true },
  // Furniture glyphs name a PIECE, not a kind of thing: a 4-connected blob of one letter is
  // one couch, so two flush couches need two letters. Hence a pool — see FURN_POOL.
  ...Object.fromEntries([...'FGHKMN'].map(ch => [ch, { o: FURNITURE }])),
  '+': { exit: true, rac: true },     // raccoon standing on the exit (XSB's player-on-goal)
  // No water glyph: water is terrain and sits under any occupant, and one character per
  // cell cannot say "empty canal", "a can in the canal" and "couch G in the canal" at once.
  // It gets its own aligned `:water` block, which needs no new glyph for any combination.
  //
  // No glyph for anything on an exit either. The rules refuse any action that would put an
  // object there, so those states are unreachable and a file that writes one is invalid.
};

// The `:water` mask alphabet. Three terrains, one character each, and the floor aliases read
// as dry so a mask can be written with `-` or `.` like any other block.
const WET = '~';        // open canal
const FILLED = '=';     // a canal cell somebody filled in: floor, and drawn as the plank it is
// The pool of letters furniture pieces are written with. The writer hands them out in raster
// order of each piece's first cell, so a board's lettering is canonical and the grid
// round-trips. Past the end of the pool, throw rather than wrap.
export const FURN_POOL = [...'FGHKMN'];

export const LEGEND = [
  '# wall', '- floor', '@ raccoon', '$ bag', 'C full can', 'c empty can',
  'x spilled trash', 'E exit', '+ raccoon on exit',
  'S bag-on-can stack', 'W wheelie bin (full)', 'w wheelie bin (empty)', 'b recycle bin',
  'j water jug',
  `${FURN_POOL.join('/')} furniture — one letter per piece, a touching same-letter blob is one couch`,
  'terrain lives in its own :water block — ~ open canal, = filled in (floor), - dry',
];

/**
 * Number the multi-cell pieces on a freshly-read board. Each 4-connected run of the SAME
 * glyph is one piece; a different letter starts a different piece even flush against it, and
 * the same letter used in two places that do not touch is simply two pieces. Ids are handed
 * out in raster order of each piece's first cell, which is what makes `toGrid` reproduce the
 * lettering it was given.
 */
function labelPieces(cells, glyphs, id) {
  const rows = cells.length, cols = cells[0].length;
  let next = 0;
  for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
    if (!glyphs[y][x] || cells[y][x].pid !== undefined) continue;
    const pid = next++, ch = glyphs[y][x], stack = [[x, y]], size = [];
    while (stack.length) {
      const [cx, cy] = stack.pop();
      if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
      if (glyphs[cy][cx] !== ch || cells[cy][cx].pid !== undefined) continue;
      cells[cy][cx].pid = pid; size.push([cx, cy]);
      stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
    }
    // A one-cell couch behaves exactly like an empty can, so the reader rejects it.
    if (size.length < 2)
      throw new Error(`${id}: furniture '${ch}' at (${x + 1},${y + 1}) is a single cell; use a can, or give it a second cell`);
  }
}

/** Raster-order piece ids → the pool letters the writer spells them with. */
function furnitureLetters(s) {
  const letters = new Map();
  for (const row of s.cells) for (const c of row) {
    if (c.pid === undefined || letters.has(c.pid)) continue;
    if (letters.size >= FURN_POOL.length)
      throw new Error(`more than ${FURN_POOL.length} furniture pieces: the glyph pool is ${FURN_POOL.join('')}`);
    letters.set(c.pid, FURN_POOL[letters.size]);
  }
  return letters;
}

// The occupant grid says nothing about terrain except walls and the exit, which never carry
// an occupant. Water rides in the mask, so `x` is trash whether it blocks floor or bridges
// a canal.
function glyphFor(c, isRac, letters) {
  if (c.wall) return '#';
  if (!c.exit) {
    if (isRac) return '@';
    if (c.o === FURNITURE) return letters.get(c.pid);
    return { [NONE]: '-', [BAG]: '$', [CAN_FULL]: 'C', [CAN_EMPTY]: 'c', [TRASH]: 'x',
             [STACK]: 'S', [WHEELIE]: 'W', [WHEELIE_EMPTY]: 'w', [BIN]: 'b', [JUG]: 'j' }[c.o];
  }
  if (isRac) return '+';
  if (c.o === NONE) return 'E';
  // Unreachable by the rules — if we ever get here, a rule broke. Fail loudly.
  throw new Error(`occupant ${c.o} on an exit cell: the exit must never hold an object`);
}

// --- level pack -------------------------------------------------------------
// A directive line starts with ':'. A comment line starts with ';'. Everything
// between ':grid' and ':end' is taken verbatim, so no glyph can collide with a key.

const INT_KEYS = new Set(['par', 'traps', 'solves']);
// `:arm on` makes board-changing actions ask twice in this room — a scaffold for a room
// that introduces a new piece. Absent means off. Input-layer only: it never reaches the
// rules engine or the solver, so it cannot change a par.
const BOOL_KEYS = new Set(['arm']);
const BOOLS = { on: true, off: false, true: true, false: false };

// Two directives open a verbatim block, each closed by `:end`: the occupant `:grid`, and
// the optional `:water` mask laid over it.
const BLOCK_KEYS = new Set(['grid', 'water']);

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
    if (key === 'end') throw new Error(`${at}: :end without :grid or :water`);
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
    if (s.grid || s.water) throw new Error(`solution ${s.id}: a solution has no :grid or :water`);
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
    for (const k of ['name', 'teach', 'arm', 'par', 'traps', 'solves', 'solve', 'note']) {
      if (l[k] === undefined) continue;
      if (BOOL_KEYS.has(k) && !l[k]) continue;                 // off is the default: don't write it
      const v = BOOL_KEYS.has(k) ? 'on' : l[k];
      out.push(`:${k}${' '.repeat(Math.max(1, 7 - k.length))}${v}`);
    }
    out.push(':grid', ...l.grid, ':end');
    if (l.water) out.push(':water', ...l.water, ':end');
    out.push('');
  }
  return out.join('\n').replace(/\n+$/, '\n');
}

/** Build a runnable state from a parsed level. Validates structure at the boundary. */
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
      grow.push(c.o === FURNITURE ? ch : null);   // which letter wrote this cell, for grouping
    }
    cells.push(row); glyphs.push(grow);
  }
  if (!rac) throw new Error(`${level.id}: no raccoon`);
  if (exits !== 1) throw new Error(`${level.id}: needs exactly one exit, found ${exits}`);
  labelPieces(cells, glyphs, level.id);

  // The water mask, laid over the occupant grid. Optional — a room with no canal omits it.
  if (level.water) {
    if (level.water.length > rows)
      throw new Error(`${level.id}: :water has ${level.water.length} rows, :grid has ${rows}`);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      const ch = level.water[y]?.[x] ?? '-';
      if (ch !== WET && ch !== FILLED) {
        if (!FLOOR_ALIASES.has(ch)) throw new Error(`${level.id}: :water takes '${WET}', '${FILLED}' or floor, got ${JSON.stringify(ch)} at (${x + 1},${y + 1})`);
        continue;
      }
      const c = cells[y][x];
      if (c.wall) throw new Error(`${level.id}: (${x + 1},${y + 1}) is both wall and water`);
      if (c.exit) throw new Error(`${level.id}: the exit cannot be water at (${x + 1},${y + 1})`);
      if (ch === WET) c.water = true; else c.bridge = true;
    }
    if (cells[rac.y][rac.x].water)
      throw new Error(`${level.id}: the raccoon starts in open water at (${rac.x + 1},${rac.y + 1})`);
  }
  return { cols, rows, cells, rac };
}

/** Serialise a live state back to occupant glyphs — used for traces and round-trip checks. */
export function toGrid(s) {
  const letters = furnitureLetters(s);
  return s.cells.map((row, y) =>
    row.map((c, x) => glyphFor(c, s.rac.x === x && s.rac.y === y, letters)).join(''));
}

/** The matching terrain mask, or null if the board never had a canal at all. */
export function toWater(s) {
  if (!s.cells.some(row => row.some(c => c.water || c.bridge))) return null;
  return s.cells.map(row =>
    row.map(c => (c.water ? WET : c.bridge ? FILLED : '-')).join(''));
}

// --- solutions --------------------------------------------------------------
// LURD, extended for a third action class:
//   lowercase l u r d = move        (step onto empty floor)
//   uppercase L U R D = push        (shove a can)
//   uppercase + '!'   = pounce-tear (burst a bag — the irreversible one)

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
