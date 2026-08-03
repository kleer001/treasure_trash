// Treasure Trash — the rules. Pure, deterministic, no DOM, no I/O. The game, the solver
// and the verifier all import this module.

// Occupant codes. `stateKey` encodes each as one printable character, so the list can grow.
export const NONE = 0, BAG = 1, CAN_FULL = 2, CAN_EMPTY = 3, TRASH = 4,
             BIN = 5, STACK = 6, WHEELIE = 7, WHEELIE_EMPTY = 8, JUG = 9, FURNITURE = 10;

// Multi-cell pieces. Every other code is fully described by the cell it sits in; FURNITURE
// is not. Two adjacent cells both reading FURNITURE may be one couch or two touching
// couches, and only the `pid` says which — so anything reasoning about a piece reads the
// pid, and `stateKey` encodes the partition as well as the codes.
export const isMultiCell = o => o === FURNITURE;

/** Every cell of the piece `pid`, in raster order. Boards are tiny; this scans the whole one. */
export function pieceCells(s, pid) {
  const out = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++)
    if (s.cells[y][x].pid === pid) out.push([x, y]);
  return out;
}

// Direction letters are the solution format's alphabet — see FORMATS.md.
export const DIRS = { l: [-1, 0], u: [0, -1], r: [1, 0], d: [0, 1] };
export const DIR_ORDER = ['u', 'd', 'l', 'r'];   // canonical order: solver tie-breaks on this

// The three action classes. `kind` is recorded in the solution, so a solution that
// claims a push where the board only permits a move is rejected on replay.
export const MOVE = 'move', PUSH = 'push', TEAR = 'tear';

export const cloneState = s => ({
  cols: s.cols, rows: s.rows, rac: { ...s.rac },
  cells: s.cells.map(row => row.map(c => ({ ...c }))),
});

export const inGrid = (s, x, y) => x >= 0 && y >= 0 && x < s.cols && y < s.rows;
export const cell = (s, x, y) => s.cells[y][x];

// Terrain is separate from the occupant, and only the wall is static — the jug writes new
// water mid-room and any fill converts it. A cell's terrain is one of three:
//   dry     — ordinary ground
//   water   — the canal. Objects rest in it; the raccoon does not.
//   bridge  — a water cell somebody filled in. Floor, in every sense that matters.
//
// A bridge is terrain rather than an occupant because a cell holds only one occupant: while
// the fill counted as the occupant there was no room for anything else, so a can could not
// be pushed across a crossing. `stateKey` encodes terrain for the same reason.

/** Ordinary dry ground with nothing on it. A bridge counts — it is floor now. */
export const isClearFloor = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall && !cell(s, x, y).water && cell(s, x, y).o === NONE;

/** Everywhere the raccoon can stand. The exit qualifies — he walks over it freely. */
export const canStand = isClearFloor;

/**
 * Lay trash on a cell. In the canal that fills it — the cell stops being water and becomes a
 * bridge, and the trash is spent doing it. Anywhere else the trash sits there and blocks.
 * One helper, so a fan and a bin drop cannot disagree about what landing means.
 */
export function layTrash(c) {
  if (c.water) { c.water = false; c.bridge = true; }
  else c.o = TRASH;
}

// Where an OBJECT can come to rest: any empty cell that is not a wall and not the exit.
// Water qualifies — a can, a bag, a bin or a couch all go in the canal. What makes that
// one-way is not a clause about water but the raccoon: a push leaves him standing where the
// thing was, so to shove it again he would have to stand in open canal. No piece floats and
// none is named here.
export const isOccupiable = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall && !cell(s, x, y).exit && cell(s, x, y).o === NONE;

/**
 * Where the water jug may spill: bare floor only. Water already there changes nothing, trash
 * would be un-blocked by it, and a bridge would be un-filled — and nothing reverses a fill.
 */
export const canPour = (s, x, y) =>
  isOccupiable(s, x, y) && !cell(s, x, y).water && !cell(s, x, y).bridge;

/** The 2x3 fan: the bag's two perpendicular side cells + the three cells one step ahead. */
export function fan(bx, by, dx, dy) {
  const px = -dy, py = dx;
  return [
    [bx + px, by + py], [bx - px, by - py],
    [bx + dx, by + dy], [bx + dx + px, by + dy + py], [bx + dx - px, by + dy - py],
  ];
}

// A fan lays trash, and trash rests anywhere an object does — water included, where it
// becomes a bridge rather than an obstacle.
export const fanBlockers = (s, bx, by, dx, dy) =>
  fan(bx, by, dx, dy).filter(([x, y]) => !isOccupiable(s, x, y));

// The exit and open water each get their own refusal reason rather than the generic one,
// so the UI can name what is in the way instead of just saying "blocked".
const reasonFor = (s, blockers, fallback) => {
  const is = pred => blockers.some(([x, y]) => inGrid(s, x, y) && pred(cell(s, x, y)));
  if (is(c => c.exit)) return 'exit';
  if (is(c => c.water && c.o === NONE)) return 'water';
  return fallback;
};

/**
 * Explain what direction `dir` does from the current state — without applying it.
 * Returns { ok:true, kind, next } or { ok:false, reason, blame:[[x,y]...] }.
 * `blame` is the cell list the UI paints red: exactly the cells that forbid the action.
 * Every caller — step, solver, renderer — goes through here.
 */
export function explain(s, dir) {
  const d = DIRS[dir];
  if (!d) throw new Error(`unknown direction: ${dir}`);
  const [dx, dy] = d;
  const x = s.rac.x, y = s.rac.y, tx = x + dx, ty = y + dy;

  if (!inGrid(s, tx, ty)) return { ok: false, reason: 'edge', blame: [] };
  const target = cell(s, tx, ty);
  if (target.wall) return { ok: false, reason: 'wall', blame: [[tx, ty]] };

  const stepOnto = () => {
    const next = cloneState(s);
    next.rac = { x: tx, y: ty };
    return { ok: true, kind: MOVE, next };
  };

  // Water holds anything except the raccoon. A bridge is floor and never reaches here; it
  // falls through to the ordinary empty-cell path below. What is left is real canal.
  if (target.water) {
    if (target.o === NONE) return { ok: false, reason: 'water', blame: [[tx, ty]] };
    // Something is floating in it. Every action finishes with him standing in the cell he
    // acted on — except a roller, which leaves from under the shove while he stays on the
    // bank. So everything else in the canal is out of reach.
    if (target.o !== WHEELIE && target.o !== WHEELIE_EMPTY)
      return { ok: false, reason: 'water', blame: [[tx, ty]] };
  }

  const o = target.o;

  if (o === NONE) return stepOnto();

  if (o === TRASH) return { ok: false, reason: 'trash', blame: [[tx, ty]] };

  if (o === BAG) {
    const blockers = fanBlockers(s, tx, ty, dx, dy);
    if (blockers.length) return { ok: false, reason: reasonFor(s, blockers, 'fan'), blame: blockers };
    const next = cloneState(s);
    for (const [fx, fy] of fan(tx, ty, dx, dy)) layTrash(cell(next, fx, fy));
    cell(next, tx, ty).o = NONE;
    next.rac = { x: tx, y: ty };
    return { ok: true, kind: TEAR, next };
  }

  // A rigid multi-cell piece translates one cell as a unit; nothing rotates. The clearance
  // test covers the cells it moves INTO minus the cells it moves out of, so a couch sliding
  // along its own length asks for only one new cell. The raccoon advances into the cell he
  // shoved, which the piece has always just vacated — the cell behind it is his own, so it
  // can never be part of the translated footprint.
  if (isMultiCell(o)) {
    const own = pieceCells(s, target.pid);
    const ownSet = new Set(own.map(([x, y]) => `${x},${y}`));
    const blame = own.map(([x, y]) => [x + dx, y + dy])
      .filter(([x, y]) => !ownSet.has(`${x},${y}`) && !isOccupiable(s, x, y));
    if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };
    const next = cloneState(s);
    for (const [x, y] of own) { const c = cell(next, x, y); c.o = NONE; delete c.pid; }
    for (const [x, y] of own) {
      const c = cell(next, x + dx, y + dy);
      c.o = o; c.pid = target.pid;
    }
    next.rac = { x: tx, y: ty };
    return { ok: true, kind: PUSH, next };
  }

  // Four pieces share one shape of shove: the piece slides one cell and something lands
  // one cell further. Only what lands differs, so the clearance test lives in one place.
  const TWO_CELL = {
    [CAN_FULL]: { slides: CAN_EMPTY, drops: BAG },     // ejects its bag and empties
    [STACK]:    { slides: CAN_FULL,  drops: BAG },     // launches the loose bag; the can stays full
    [BIN]:      { slides: BIN,       drops: TRASH },
    [JUG]:      { slides: JUG,       pours: true },    // pours water instead of dropping trash
  };
  if (TWO_CELL[o]) {
    const { slides, drops, pours } = TWO_CELL[o];
    const c1 = [tx + dx, ty + dy], c2 = [tx + 2 * dx, ty + 2 * dy];
    // Piece and load both rest anywhere empty, canal included. The jug is the exception:
    // its spill needs dry ground — see `canPour`.
    const fits = pours ? canPour : isOccupiable;
    const blame = [];
    if (!isOccupiable(s, c1[0], c1[1])) blame.push(c1);
    if (!fits(s, c2[0], c2[1])) blame.push(c2);
    if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };
    const next = cloneState(s);
    if (pours) cell(next, c2[0], c2[1]).water = true;
    else if (drops === TRASH) layTrash(cell(next, c2[0], c2[1]));   // fills the canal, like a fan
    else cell(next, c2[0], c2[1]).o = drops;
    cell(next, c1[0], c1[1]).o = slides;
    cell(next, tx, ty).o = NONE;
    next.rac = { x: tx, y: ty };
    return { ok: true, kind: PUSH, next };
  }

  if (o === CAN_EMPTY) {
    const c1 = [tx + dx, ty + dy];
    if (!isOccupiable(s, c1[0], c1[1]))
      return { ok: false, reason: reasonFor(s, [c1], 'canRoom'), blame: [c1] };
    const next = cloneState(s);
    cell(next, c1[0], c1[1]).o = CAN_EMPTY;
    cell(next, tx, ty).o = NONE;
    next.rac = { x: tx, y: ty };
    return { ok: true, kind: PUSH, next };
  }

  // The wheelie bin rolls until something stops it, and a full one dumps its bag out the
  // back on impact. The raccoon does not follow it — the bin leaves from under the shove,
  // which is what keeps a one-cell roll from dropping a bag onto his own cell.
  if (o === WHEELIE || o === WHEELIE_EMPTY) {
    let rx = tx, ry = ty;
    while (isOccupiable(s, rx + dx, ry + dy)) { rx += dx; ry += dy; }
    if (rx === tx && ry === ty) {
      const stop = [[tx + dx, ty + dy]];
      return { ok: false, reason: reasonFor(s, stop, 'canRoom'), blame: stop };
    }
    const next = cloneState(s);
    cell(next, tx, ty).o = NONE;
    cell(next, rx, ry).o = WHEELIE_EMPTY;
    if (o === WHEELIE) {
      // Out the back, into the cell it just vacated — tested against the board the bin has
      // already left, because on a one-cell roll that cell is the bin's own starting square.
      const back = [rx - dx, ry - dy];
      if (!isOccupiable(next, back[0], back[1]))
        return { ok: false, reason: reasonFor(s, [back], 'canRoom'), blame: [back] };
      cell(next, back[0], back[1]).o = BAG;
    }
    return { ok: true, kind: PUSH, next };
  }

  throw new Error(`unknown occupant ${o} at ${tx},${ty}`);
}

/** Apply a direction. Returns the next state, or null if the action is illegal. */
export function step(s, dir) {
  const r = explain(s, dir);
  return r.ok ? r.next : null;
}

/**
 * Apply a declared action {dir, kind}. Throws if the board does not produce exactly that
 * kind, which is what makes a solution file self-checking rather than a hint.
 */
export function applyAction(s, { dir, kind }) {
  const r = explain(s, dir);
  if (!r.ok) throw new Error(`illegal ${kind} ${dir}: blocked by ${r.reason}`);
  if (r.kind !== kind) throw new Error(`declared ${kind} ${dir} but the board gives ${r.kind}`);
  return r.next;
}

// A stack counts two bags: the loose one on top and the one in the still-full can beneath.
const BAGS_IN = { [BAG]: 1, [CAN_FULL]: 1, [WHEELIE]: 1, [STACK]: 2 };
export function bagsLeft(s) {
  let k = 0;
  for (const row of s.cells) for (const c of row) k += BAGS_IN[c.o] ?? 0;
  return k;
}

export const atExit = s => cell(s, s.rac.x, s.rac.y).exit;
export const isWon = s => bagsLeft(s) === 0 && atExit(s);

/** Canonical state key — walls are static, so only occupants, WATER and the raccoon vary.
 *
 * Water is in here because the jug pours it. Leave it out and a jug shoved in a loop around
 * the board returns every occupant to where it started, keys identical to the opening
 * position, and the solver declares a board it has never seen already visited. Worse, the
 * occupant code alone does not say what a cell IS: trash on floor blocks and the same trash
 * on water walks, so two boards differing only in that are genuinely different boards.
 *
 * One character per cell still, because `analyze()` holds one key per reachable state and
 * rooms reach tens of thousands. The character is the (terrain, occupant) pair packed as a
 * single number and OFFSET INTO PRINTABLE ASCII rather than written in decimal. Joining
 * decimals with no delimiter is ambiguous the moment a code reaches two digits — `1,0,10`
 * and `10,1,0` both render as "1010" — and that failure is silent in exactly the same way.
 * Packing as `o * 3 + terrain` (dry / water / bridge) stays injective however many occupant
 * codes get added, and however many terrains follow — widen the multiplier, not the scheme.
 *
 * Multi-cell pieces need a second lane, because the codes alone do not determine the board:
 * four FURNITURE cells in a row are one long couch, or two short ones, and those push
 * differently. The lane walks the furniture cells in raster order and writes each one's piece
 * as a label numbered by first appearance — canonical, so it depends on the partition and not
 * on which `pid` values happen to be in play. It is a separate lane rather than a wider
 * alphabet in the first one so that adding an eleventh occupant code cannot collide with it.
 *
 * The key is opaque. Nothing parses it; `solver.js` only ever uses it as a Map key.
 */
export const stateKey = s => {
  const terrain = c => (c.water ? 1 : c.bridge ? 2 : 0);     // wall is static; these are not
  const kinds = s.cells.map(r => r.map(c =>
    String.fromCharCode(65 + c.o * 3 + terrain(c))).join('')).join('/');
  const label = new Map();
  const pieces = s.cells.flat().filter(c => c.pid !== undefined).map(c => {
    if (!label.has(c.pid)) label.set(c.pid, label.size);
    return String.fromCharCode(65 + label.get(c.pid));
  }).join('');
  return `${kinds}|${pieces}|${s.rac.x},${s.rac.y}`;
};
