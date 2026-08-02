// The rules. Pure, deterministic, no DOM, no I/O. The single source of truth for
// what is legal; the game, the solver and the verifier all import it.

export const NONE = 0, BAG = 1, CAN_FULL = 2, CAN_EMPTY = 3, TRASH = 4,
             BIN = 5, STACK = 6, WHEELIE = 7, WHEELIE_EMPTY = 8;

export const DIRS = { l: [-1, 0], u: [0, -1], r: [1, 0], d: [0, 1] };
export const DIR_ORDER = ['u', 'd', 'l', 'r'];

export const MOVE = 'move', PUSH = 'push', TEAR = 'tear';

export const cloneState = s => ({
  cols: s.cols, rows: s.rows, rac: { ...s.rac },
  cells: s.cells.map(row => row.map(c => ({ ...c }))),
});

export const inGrid = (s, x, y) => x >= 0 && y >= 0 && x < s.cols && y < s.rows;
export const cell = (s, x, y) => s.cells[y][x];

/** Water filled with trash: walkable, permanently. */
export const bridged = c => c.water && c.o === TRASH;
/** Water still open: impassable, and only trash may land in it. */
export const openWater = c => c.water && c.o === NONE;

/** Where trash may land — includes water, excludes the exit. */
export const canHoldTrash = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall && !cell(s, x, y).exit && cell(s, x, y).o === NONE;

/** Where an object may come to rest — `canHoldTrash` minus the water. */
export const isOccupiable = (s, x, y) => canHoldTrash(s, x, y) && !cell(s, x, y).water;

/** Where the raccoon may stand. The exit qualifies; open water does not. */
export const canStand = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall &&
  (cell(s, x, y).water ? bridged(cell(s, x, y)) : cell(s, x, y).o === NONE);

/** The 2x3 fan: the bag's two side cells plus the three cells one step ahead. */
export function fan(bx, by, dx, dy) {
  const px = -dy, py = dx;
  return [
    [bx + px, by + py], [bx - px, by - py],
    [bx + dx, by + dy], [bx + dx + px, by + dy + py], [bx + dx - px, by + dy - py],
  ];
}

export const fanBlockers = (s, bx, by, dx, dy) =>
  fan(bx, by, dx, dy).filter(([x, y]) => !canHoldTrash(s, x, y));

const reasonFor = (s, blockers, fallback) => {
  const cells = blockers.filter(([x, y]) => inGrid(s, x, y)).map(([x, y]) => cell(s, x, y));
  if (cells.some(c => c.exit)) return 'exit';
  if (cells.some(openWater)) return 'water';
  return fallback;
};

/**
 * The one decision point: what direction `dir` does, without applying it.
 * @returns {object} { ok:true, kind, next } or { ok:false, reason, blame:[[x,y]...] },
 *   where `blame` is exactly the cells that forbid the action.
 */
export function explain(s, dir) {
  const d = DIRS[dir];
  if (!d) throw new Error(`unknown direction: ${dir}`);
  const [dx, dy] = d;
  const x = s.rac.x, y = s.rac.y, tx = x + dx, ty = y + dy;

  if (!inGrid(s, tx, ty)) return { ok: false, reason: 'edge', blame: [] };
  const target = cell(s, tx, ty);
  if (target.wall) return { ok: false, reason: 'wall', blame: [[tx, ty]] };

  if (canStand(s, tx, ty)) {
    const next = cloneState(s);
    next.rac = { x: tx, y: ty };
    return { ok: true, kind: MOVE, next };
  }

  if (target.water) return { ok: false, reason: 'water', blame: [[tx, ty]] };

  const o = target.o;

  if (o === TRASH) return { ok: false, reason: 'trash', blame: [[tx, ty]] };

  if (o === BAG) {
    const blockers = fanBlockers(s, tx, ty, dx, dy);
    if (blockers.length) return { ok: false, reason: reasonFor(s, blockers, 'fan'), blame: blockers };
    const next = cloneState(s);
    for (const [fx, fy] of fan(tx, ty, dx, dy)) cell(next, fx, fy).o = TRASH;
    cell(next, tx, ty).o = NONE;
    next.rac = { x: tx, y: ty };
    return { ok: true, kind: TEAR, next };
  }

  const TWO_CELL = {
    [CAN_FULL]: { slides: CAN_EMPTY, drops: BAG,   lands: isOccupiable },
    [STACK]:    { slides: CAN_FULL,  drops: BAG,   lands: isOccupiable },
    [BIN]:      { slides: BIN,       drops: TRASH, lands: canHoldTrash },
  };
  if (TWO_CELL[o]) {
    const { slides, drops, lands } = TWO_CELL[o];
    const c1 = [tx + dx, ty + dy], c2 = [tx + 2 * dx, ty + 2 * dy];
    const blame = [];
    if (!isOccupiable(s, c1[0], c1[1])) blame.push(c1);
    if (!lands(s, c2[0], c2[1])) blame.push(c2);
    if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };
    const next = cloneState(s);
    cell(next, c2[0], c2[1]).o = drops;
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

/** Apply a declared action. Throws unless the board produces exactly that kind. */
export function applyAction(s, { dir, kind }) {
  const r = explain(s, dir);
  if (!r.ok) throw new Error(`illegal ${kind} ${dir}: blocked by ${r.reason}`);
  if (r.kind !== kind) throw new Error(`declared ${kind} ${dir} but the board gives ${r.kind}`);
  return r.next;
}

const BAGS_IN = { [BAG]: 1, [CAN_FULL]: 1, [WHEELIE]: 1, [STACK]: 2 };

/** Bags still to be torn, wherever they sit. A stack holds two. */
export function bagsLeft(s) {
  let k = 0;
  for (const row of s.cells) for (const c of row) k += BAGS_IN[c.o] ?? 0;
  return k;
}

export const atExit = s => cell(s, s.rac.x, s.rac.y).exit;
export const isWon = s => bagsLeft(s) === 0 && atExit(s);

/** Canonical state key: one printable char per cell, offset so codes cannot run together. */
export const stateKey = s =>
  s.cells.map(r => String.fromCharCode(...r.map(c => 65 + c.o))).join('/')
  + `|${s.rac.x},${s.rac.y}`;
