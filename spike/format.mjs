// Treasure Trash — the file formats. Parse and serialise levels (.tt) and solutions (.sol).
// Text in, data out; data in, byte-identical text out. See FORMATS.md for the spec.

import {
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY,
  DIRS, MOVE, PUSH, TEAR, bridged, openWater,
} from './rules.mjs';

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
  'E': { exit: true },
  '+': { exit: true, rac: true },     // raccoon standing on the exit (XSB's player-on-goal)
  // Water is terrain with two states, and trash is what flips it. `=` reads as the plank
  // it effectively is; it is written as water-plus-trash, never as a third glyph state.
  '~': { water: true },               // open water — he will not wet his paws
  '=': { water: true, o: TRASH },     // filled in: a permanent bridge
  '*': { water: true, o: TRASH, rac: true },   // raccoon standing on a bridge he made
  // No glyph for anything else on an exit: nothing else can ever be there. The rules
  // refuse any action that would put an object on it, so those states are unreachable
  // and a level file that hand-writes one is invalid input.
};
export const LEGEND = [
  '# wall', '- floor', '@ raccoon', '$ bag', 'C full can', 'c empty can',
  'x spilled trash', 'E exit', '+ raccoon on exit',
  'S bag-on-can stack', 'W wheelie bin (full)', 'w wheelie bin (empty)', 'b recycle bin',
  '~ water', '= water filled with trash (a bridge)', '* raccoon on a bridge',
];

function glyphFor(c, isRac) {
  if (c.wall) return '#';
  if (c.water) {
    if (bridged(c)) return isRac ? '*' : '=';
    if (openWater(c)) return '~';          // nothing can stand in open water, raccoon included
    throw new Error(`occupant ${c.o} in water: water holds trash or nothing`);
  }
  if (!c.exit) {
    if (isRac) return '@';
    return { [NONE]: '-', [BAG]: '$', [CAN_FULL]: 'C', [CAN_EMPTY]: 'c', [TRASH]: 'x',
             [STACK]: 'S', [WHEELIE]: 'W', [WHEELIE_EMPTY]: 'w', [BIN]: 'b' }[c.o];
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
// `:arm on` makes board-changing actions ask twice in this room. It is a TEACHING
// SCAFFOLD for a room that introduces a new piece, not an input mode — absent means off,
// which is the default and the normal Sokoban feel.
const BOOL_KEYS = new Set(['arm']);
const BOOLS = { on: true, off: false, true: true, false: false };

/**
 * One grammar, two files. `sectionKey` is 'level' or 'solution'; entries collect every
 * other directive as a field, plus an optional verbatim :grid/:end block.
 */
export function parseSections(text, sectionKey) {
  const pack = { meta: {}, entries: [] };
  let cur = null, grid = null;

  text.split('\n').forEach((raw, i) => {
    const line = raw.replace(/\r$/, '');
    const at = `line ${i + 1}`;

    if (grid !== null) {
      if (line.trim() === ':end') {
        if (!grid.length) throw new Error(`${at}: empty :grid in ${cur.id}`);
        cur.grid = grid; grid = null;
      } else grid.push(line);
      return;
    }
    if (!line.trim() || line.startsWith(';')) return;
    if (!line.startsWith(':')) throw new Error(`${at}: expected a ':key' directive, got ${JSON.stringify(line)}`);

    const m = /^:(\w+)[ \t]*(.*)$/.exec(line);
    if (!m) throw new Error(`${at}: malformed directive ${JSON.stringify(line)}`);
    const [, key, rest] = m;
    const val = rest.trim();

    if (key === 'grid') {
      if (!cur) throw new Error(`${at}: :grid outside a :${sectionKey}`);
      grid = []; return;
    }
    if (key === 'end') throw new Error(`${at}: :end without :grid`);
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

  if (grid !== null) throw new Error(':grid never closed with :end');
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
    if (s.grid) throw new Error(`solution ${s.id}: a solution has no :grid`);
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
    out.push(':grid', ...l.grid, ':end', '');
  }
  return out.join('\n').replace(/\n+$/, '\n');
}

/** Build a runnable state from a parsed level. Validates structure at the boundary. */
export function toState(level) {
  const rows = level.grid.length;
  const cols = Math.max(...level.grid.map(r => r.length));
  const cells = [];
  let rac = null, exits = 0;

  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      const ch = level.grid[y][x] ?? '-';        // short rows pad with floor
      const spec = READ[ch];
      if (!spec) throw new Error(`${level.id}: unknown glyph ${JSON.stringify(ch)} at (${x + 1},${y + 1})`);
      const c = { wall: !!spec.wall, exit: !!spec.exit, water: !!spec.water, o: spec.o ?? NONE };
      if (c.exit && c.water) throw new Error(`${level.id}: the exit cannot be water at (${x + 1},${y + 1})`);
      if (spec.rac) {
        if (rac) throw new Error(`${level.id}: more than one raccoon`);
        rac = { x, y };
      }
      if (c.exit) exits++;
      row.push(c);
    }
    cells.push(row);
  }
  if (!rac) throw new Error(`${level.id}: no raccoon`);
  if (exits !== 1) throw new Error(`${level.id}: needs exactly one exit, found ${exits}`);
  return { cols, rows, cells, rac };
}

/** Serialise a live state back to grid lines — used for traces and round-trip checks. */
export function toGrid(s) {
  return s.cells.map((row, y) =>
    row.map((c, x) => glyphFor(c, s.rac.x === x && s.rac.y === y)).join(''));
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
