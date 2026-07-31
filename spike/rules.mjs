// Treasure Trash — THE RULES. Pure, deterministic, no DOM, no I/O.
// This module is the single source of truth for what is legal. The browser spike,
// the solver, and the verifier all import it; nothing re-implements a rule.

// Occupant codes. `stateKey` packs these one CHARACTER per cell, so this list must stay
// below 10 entries — a two-digit code would make two different boards share a key.
export const NONE = 0, BAG = 1, CAN_FULL = 2, CAN_EMPTY = 3, TRASH = 4,
             BIN = 5, STACK = 6, WHEELIE = 7, WHEELIE_EMPTY = 8;

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

// Somewhere the raccoon can stand: floor with nothing on it. The exit qualifies —
// he walks over it freely.
export const isClearFloor = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall && cell(s, x, y).o === NONE;

// Somewhere an OBJECT can come to rest. The exit does not qualify: you cannot bury
// your own way out. Trash, a shoved can and an ejected bag all test against this, so
// any action that would put something on the exit is refused outright rather than
// allowed and then regretted. The exit is walkable by the raccoon and by nothing else.
export const isOccupiable = (s, x, y) => isClearFloor(s, x, y) && !cell(s, x, y).exit;

/** The 2x3 fan: the bag's two perpendicular side cells + the three cells one step ahead. */
export function fan(bx, by, dx, dy) {
  const px = -dy, py = dx;
  return [
    [bx + px, by + py], [bx - px, by - py],
    [bx + dx, by + dy], [bx + dx + px, by + dy + py], [bx + dx - px, by + dy - py],
  ];
}

export const fanBlockers = (s, bx, by, dx, dy) =>
  fan(bx, by, dx, dy).filter(([x, y]) => !isOccupiable(s, x, y));

// A refusal caused by the exit gets its own reason, because "you can't dump on your
// way out" is a different lesson from "there's no room".
const reasonFor = (s, blockers, fallback) =>
  blockers.some(([x, y]) => inGrid(s, x, y) && cell(s, x, y).exit) ? 'exit' : fallback;

/**
 * Explain what direction `dir` does from the current state — without applying it.
 * Returns { ok:true, kind, next } or { ok:false, reason, blame:[[x,y]...] }.
 * `blame` is the cell list the UI paints red: exactly the cells that forbid the action.
 * Every caller (step, solver, renderer) goes through here — one path, no second opinion.
 */
export function explain(s, dir) {
  const d = DIRS[dir];
  if (!d) throw new Error(`unknown direction: ${dir}`);
  const [dx, dy] = d;
  const x = s.rac.x, y = s.rac.y, tx = x + dx, ty = y + dy;

  if (!inGrid(s, tx, ty)) return { ok: false, reason: 'edge', blame: [] };
  if (cell(s, tx, ty).wall) return { ok: false, reason: 'wall', blame: [[tx, ty]] };

  const o = cell(s, tx, ty).o;

  if (o === NONE) {
    const next = cloneState(s);
    next.rac = { x: tx, y: ty };
    return { ok: true, kind: MOVE, next };
  }

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

  // Three pieces share one shape of shove: the piece slides one cell and something lands
  // one cell further. Only what lands differs, so the clearance test lives in one place.
  const TWO_CELL = {
    [CAN_FULL]: { slides: CAN_EMPTY, drops: BAG },     // ejects its bag and empties
    [STACK]:    { slides: CAN_FULL,  drops: BAG },     // launches the loose bag; the can stays full
    [BIN]:      { slides: BIN,       drops: TRASH },   // the precise obstacle placer
  };
  if (TWO_CELL[o]) {
    const { slides, drops } = TWO_CELL[o];
    const c1 = [tx + dx, ty + dy], c2 = [tx + 2 * dx, ty + 2 * dy];
    const blame = [c1, c2].filter(([bx, by]) => !isOccupiable(s, bx, by));
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

  // The wheelie bin does not stop where you stop pushing — it rolls until something stops
  // it, and a full one dumps its bag out the back on impact. The raccoon does NOT follow
  // it: the bin leaves from under the shove, which is also what keeps the one-cell roll
  // from dropping a bag onto the cell he would otherwise be standing in.
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
 * Apply a declared action {dir, kind}. Throws if the board does not produce exactly
 * that kind — this is what makes a solution file self-checking rather than a hint.
 */
export function applyAction(s, { dir, kind }) {
  const r = explain(s, dir);
  if (!r.ok) throw new Error(`illegal ${kind} ${dir}: blocked by ${r.reason}`);
  if (r.kind !== kind) throw new Error(`declared ${kind} ${dir} but the board gives ${r.kind}`);
  return r.next;
}

// Every bag still to be torn, wherever it is sitting — loose, inside a can, inside a
// wheelie bin, or riding a stack. A stack counts TWO: the loose bag on top and the one in
// the still-full can beneath it.
const BAGS_IN = { [BAG]: 1, [CAN_FULL]: 1, [WHEELIE]: 1, [STACK]: 2 };
export function bagsLeft(s) {
  let k = 0;
  for (const row of s.cells) for (const c of row) k += BAGS_IN[c.o] ?? 0;
  return k;
}

export const atExit = s => cell(s, s.rac.x, s.rac.y).exit;
export const isWon = s => bagsLeft(s) === 0 && atExit(s);

/** Canonical state key — walls are static, so only occupants + raccoon vary. */
export const stateKey = s =>
  s.cells.map(r => r.map(c => c.o).join('')).join('/') + `|${s.rac.x},${s.rac.y}`;
