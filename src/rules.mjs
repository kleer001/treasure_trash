// Treasure Trash — THE RULES. Pure, deterministic, no DOM, no I/O.
// This module is the single source of truth for what is legal. The game, the solver
// and the verifier all import it; nothing re-implements a rule.

// Occupant codes. Add freely — `stateKey` encodes each as one printable character, so the
// list is not near any ceiling. Whether a new piece belongs here is a design question about
// the piece, never a budget question about this list.
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

// WATER IS TERRAIN, not an occupant — a `water` flag on the cell, like `wall` and `exit`.
// That is the truthful model rather than a saving: water never moves and is never pushed,
// so nothing about it belongs in the occupant grid. What varies is whether something has
// been dumped in it, and that is already an occupant on the cell.
//
// A water cell has exactly two states, and they are opposites for the raccoon:
//   empty  (o === NONE)  — he will not wet his paws. Impassable.
//   filled (o === TRASH) — a bridge. Walkable, permanently.
// So trash means "blocked" on floor and "walkable" on water. That inversion is the whole
// piece, and it is the one place in the game where making a mess buys you something.

// The two water states get names, because everything below is phrased in terms of them
// and a rule spelled out twice is a rule that drifts. These take a CELL, not coordinates:
// the renderer and the serialiser already hold one and should not have to re-look it up.
/** Filled in with trash: the raccoon's bridge, and permanent. */
export const bridged = c => c.water && c.o === TRASH;
/** Still open: he will not wet his paws, and nothing but trash may land here. */
export const openWater = c => c.water && c.o === NONE;

/**
 * Somewhere TRASH can land — which is strictly more places than an object can rest.
 * Trash is the only thing water accepts, and accepting it is what turns the cell into
 * ground. Fans and the recycle bin's drop test against this; cans and bags do not.
 * Water needs no mention here: an empty cell that is not wall and not the exit takes
 * trash, and that is true of the canal exactly as it is of the floor.
 */
export const canHoldTrash = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall && !cell(s, x, y).exit && cell(s, x, y).o === NONE;

// Somewhere an OBJECT can come to rest: everywhere trash can land, minus the water. The
// exit is already excluded above — you cannot bury your own way out — and water is
// excluded here because a can shoved into the canal would be a second way to build a
// bridge, and the piece is clearer with exactly one. A shoved can and an ejected bag test
// against this, so any action that would put something on the exit, or in the water, is
// refused outright rather than allowed and then regretted.
export const isOccupiable = (s, x, y) => canHoldTrash(s, x, y) && !cell(s, x, y).water;

/** Everywhere the raccoon can stand. The exit qualifies — he walks over it freely. */
export const canStand = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall &&
  (cell(s, x, y).water ? bridged(cell(s, x, y)) : cell(s, x, y).o === NONE);

/** The 2x3 fan: the bag's two perpendicular side cells + the three cells one step ahead. */
export function fan(bx, by, dx, dy) {
  const px = -dy, py = dx;
  return [
    [bx + px, by + py], [bx - px, by - py],
    [bx + dx, by + dy], [bx + dx + px, by + dy + py], [bx + dx - px, by + dy - py],
  ];
}

// A fan lays trash, so it clears against `canHoldTrash` — a bag CAN be fired into water,
// and that is the point of the piece.
export const fanBlockers = (s, bx, by, dx, dy) =>
  fan(bx, by, dx, dy).filter(([x, y]) => !canHoldTrash(s, x, y));

// A refusal caused by the exit gets its own reason, because "you can't dump on your
// way out" is a different lesson from "there's no room". Water earns one for the same
// reason: "it would sink" is not "there's no room", and the player has to learn that
// water takes trash and nothing else.
const reasonFor = (s, blockers, fallback) => {
  const cells = blockers.filter(([x, y]) => inGrid(s, x, y)).map(([x, y]) => cell(s, x, y));
  if (cells.some(c => c.exit)) return 'exit';
  if (cells.some(openWater)) return 'water';
  return fallback;
};

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
  const target = cell(s, tx, ty);
  if (target.wall) return { ok: false, reason: 'wall', blame: [[tx, ty]] };

  // One predicate owns "where he may stand", and the engine asks it rather than deriving
  // the answer a second time: empty dry floor, or water he has already filled in.
  if (canStand(s, tx, ty)) {
    const next = cloneState(s);
    next.rac = { x: tx, y: ty };
    return { ok: true, kind: MOVE, next };
  }

  // Water holds nothing but trash, so past `canStand` it can only be open water.
  // He will not wet his paws — but he will happily walk over what he threw in there.
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

  // Three pieces share one shape of shove: the piece slides one cell and something lands
  // one cell further. Only what lands differs, so the clearance test lives in one place.
  // The piece itself always needs dry ground; what it DROPS is held to the looser test
  // only when that thing is trash. So the recycle bin can bridge a single cell of water —
  // one cell of floor for one cell spent, against the bag's five — and the full can still
  // cannot eject its bag into the canal. That clearance is a property of the piece, so it
  // lives in the row rather than being re-derived from `drops` at the call site.
  const TWO_CELL = {
    [CAN_FULL]: { slides: CAN_EMPTY, drops: BAG,   lands: isOccupiable },  // ejects its bag and empties
    [STACK]:    { slides: CAN_FULL,  drops: BAG,   lands: isOccupiable },  // launches the loose bag; the can stays full
    [BIN]:      { slides: BIN,       drops: TRASH, lands: canHoldTrash },  // the precise obstacle placer
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

/** Canonical state key — walls are static, so only occupants + raccoon vary.
 *
 * One character per cell, but the character is the code OFFSET INTO PRINTABLE ASCII rather
 * than its decimal digits. Joining decimals with no delimiter is ambiguous the moment a
 * code reaches two digits — `1,0,10` and `10,1,0` both render as "1010" — and the failure
 * is silent: the solver reads the second board as already visited and its "minimal" par is
 * no longer minimal. Offsetting sidesteps that without lengthening the key, which matters
 * because `analyze()` holds one key per reachable state and rooms reach tens of thousands.
 *
 * The key is opaque. Nothing parses it; `solver.mjs` only ever uses it as a Map key.
 */
export const stateKey = s =>
  s.cells.map(r => String.fromCharCode(...r.map(c => 65 + c.o))).join('/')
  + `|${s.rac.x},${s.rac.y}`;
