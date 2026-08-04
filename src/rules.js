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

// A cart is a rigid two-cell piece that rolls, and each of its cells is one cargo slot. The
// cargo keeps its own occupant code in the cell it rides in — a bag in a cart still reads BAG
// and still counts — so cart membership needs a field of its own, the way `pid` names a
// furniture piece. Two adjacent cart cells are one cart or two touching carts, and only
// `cart` says which.
export const isCart = c => c.cart !== undefined;

/** Every cell of cart `cid`, in raster order. */
export function cartCells(s, cid) {
  const out = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++)
    if (s.cells[y][x].cart === cid) out.push([x, y]);
  return out;
}

// The two pieces that leave from under the shove instead of being followed.
export const isRoller = c => c.o === WHEELIE || c.o === WHEELIE_EMPTY || isCart(c);

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
  inGrid(s, x, y) && !cell(s, x, y).wall && !cell(s, x, y).water
  && cell(s, x, y).o === NONE && !isCart(cell(s, x, y));

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

// Where an OBJECT can come to rest: any empty cell that is not a wall, not the exit and not
// part of a cart. Water qualifies — a can, a bag, a bin or a couch all go in the canal. What
// makes that one-way is not a clause about water but the raccoon: a push leaves him standing
// where the thing was, so to shove it again he would have to stand in open canal. A cart cell
// is excluded because a cart loads by being rolled into cargo, not by having cargo land in it.
export const isOccupiable = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall && !cell(s, x, y).exit
  && cell(s, x, y).o === NONE && !isCart(cell(s, x, y));

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

/** Lay one piece of cargo down. Trash fills a canal cell rather than blocking it, exactly as
 *  a fan or a bin drop does, so every way something leaves a cart goes through one helper. */
const drop = (c, o) => { if (o === TRASH) layTrash(c); else c.o = o; };

/** Where a rolling cart may advance: everywhere an object may rest, plus a cell holding a
 *  single-cell occupant, which it takes aboard as it passes. */
const cartCanEnter = (s, x, y) => {
  if (!inGrid(s, x, y)) return false;
  const c = cell(s, x, y);
  return !c.wall && !c.exit && !isCart(c) && !isMultiCell(c.o);
};

/**
 * Shove a cart. It rolls until something it cannot take in stops it, eating what it passes
 * over on the way.
 *
 * The cart's cells are grouped into FILES running along the shove: end-on that is one file
 * two slots deep, broadside it is two files one slot deep. A file's depth is how far cargo
 * travels before it falls out the back — which is why the same cart swallows one thing at a
 * time end-on and two at once broadside, and why broadside displaces its old load on contact
 * while end-on carries it one step further.
 *
 * Cargo entering a file's lead slot pushes what was there one slot back, and anything pushed
 * past the trail slot lands in the cell that slot vacated on this very step — the cart has
 * just left it, so it is always free. The raccoon does not advance, same as the wheelie bin,
 * which is why nothing a cart sheds can land on him.
 */
function shoveCart(s, cid, dx, dy) {
  const own = cartCells(s, cid);
  const at = (p, n) => [p[0] + n * dx, p[1] + n * dy];
  const owned = new Set(own.map(([x, y]) => `${x},${y}`));
  const files = own.filter(([x, y]) => !owned.has(`${x + dx},${y + dy}`))   // lead cells
    .map(lead => {
      const f = [];
      for (let p = lead; owned.has(`${p[0]},${p[1]}`); p = at(p, -1)) f.push(p);
      return f;                                                  // [lead, ..., trail]
    });
  const slots = files.map(f => f.map(([x, y]) => cell(s, x, y).o));
  const aheadAt = n => files.map(f => at(f[0], n + 1));

  // The roll is computed against the board as it stands: the cart only moves forward, so it
  // never tests a cell that it, or anything it has shed, is already sitting in.
  let n = 0;
  const eaten = [], shed = [];
  for (;;) {
    const ahead = aheadAt(n);
    if (!ahead.every(([x, y]) => cartCanEnter(s, x, y))) break;
    n++;
    ahead.forEach(([ax, ay], i) => {
      const o = cell(s, ax, ay).o;
      if (o === NONE) return;
      eaten.push([ax, ay]);
      const slot = slots[i], out = slot[slot.length - 1];
      for (let k = slot.length - 1; k > 0; k--) slot[k] = slot[k - 1];
      slot[0] = o;
      if (out !== NONE) shed.push([at(files[i][files[i].length - 1], n - 1), out]);
    });
  }

  if (n === 0) {
    const blame = aheadAt(0).filter(([x, y]) => !cartCanEnter(s, x, y));
    return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };
  }

  const next = cloneState(s);
  for (const [x, y] of own) { const c = cell(next, x, y); c.o = NONE; delete c.cart; }
  for (const [x, y] of eaten) cell(next, x, y).o = NONE;
  for (const [[x, y], o] of shed) drop(cell(next, x, y), o);
  files.forEach((f, i) => f.forEach((p, k) => {
    const c = cell(next, ...at(p, n));
    c.cart = cid; c.o = slots[i][k];
  }));

  // A wall or the board edge tips it. Each file sheds backward into the cells it rolled
  // through, trail slot first, into the nearest FREE one — whatever it shed on the way is
  // sitting in the closest. Cargo with nowhere left to land stays aboard, and the cart never
  // sheds behind where it started, so a shove that rolls one cell can only put down one thing.
  if (aheadAt(n).some(([x, y]) => !inGrid(s, x, y) || cell(s, x, y).wall))
    files.forEach((f, i) => {
      let back = n - 1;
      for (let k = slots[i].length - 1; k >= 0; k--) {
        if (slots[i][k] === NONE) continue;
        while (back >= 0 && !isOccupiable(next, ...at(f[f.length - 1], back))) back--;
        if (back < 0) break;
        drop(cell(next, ...at(f[f.length - 1], back)), slots[i][k]);
        cell(next, ...at(f[k], n)).o = NONE;
        back--;
      }
    });

  return { ok: true, kind: PUSH, next };
}

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
  // falls through to the ordinary empty-cell path below. What is left is real canal — and
  // every action finishes with him standing in the cell he acted on, except a shoved roller,
  // which leaves from under him while he stays on the bank. So a roller in the canal can be
  // reached and nothing else can, empty water included.
  if (target.water && !isRoller(target)) return { ok: false, reason: 'water', blame: [[tx, ty]] };

  // A cart cell carries its cargo in `o`, so cart-ness is read before the occupant is.
  if (isCart(target)) return shoveCart(s, target.cart, dx, dy);

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

/** Piles of trash riding in a cart. The win is the mess ON THE FLOOR, so trash the raccoon is
 *  still carrying is trash he has not put down yet. Junk that was never the mess — an empty
 *  can, a bin, a jug — rides out with him. */
export function trashHeld(s) {
  let k = 0;
  for (const row of s.cells) for (const c of row) if (isCart(c) && c.o === TRASH) k++;
  return k;
}

export const atExit = s => cell(s, s.rac.x, s.rac.y).exit;
export const isWon = s => bagsLeft(s) === 0 && trashHeld(s) === 0 && atExit(s);

/** Canonical state key — walls are static, so only occupants, WATER and the raccoon vary.
 *
 * Water is in here because the jug pours it. Leave it out and a jug shoved in a loop around
 * the board returns every occupant to where it started, keys identical to the opening
 * position, and the solver declares a board it has never seen already visited. Worse, the
 * occupant code alone does not say what a cell IS: trash on floor blocks and the same trash
 * on water walks, so two boards differing only in that are genuinely different boards.
 *
 * One character per cell, because `analyze()` holds one key per reachable state and rooms
 * reach thousands. The character is the (occupant, terrain, in-a-cart) triple packed as a
 * single number and offset off 'A' rather than written in decimal. Joining decimals with no
 * delimiter is ambiguous the moment a code reaches two digits — `1,0,10` and `10,1,0` both
 * render as "1010" — and that failure is silent in exactly the same way. Cart membership is
 * in the packed character because a cart cell holds its cargo in `o`: without it a can riding
 * in a cart reads exactly like a can lying on the floor.
 *
 * Multi-cell pieces get a lane each, because the codes alone do not determine the board: four
 * FURNITURE cells in a row are one long couch or two short ones, and two adjacent cart cells
 * are one cart or two touching carts. A lane walks its cells in raster order and labels each
 * by first appearance, so it keys on the partition and not on whichever ids are in play.
 */
export const stateKey = s => {
  const terrain = c => (c.water ? 1 : c.bridge ? 2 : 0);     // wall is static; these are not
  const kinds = s.cells.map(r => r.map(c =>
    String.fromCharCode(65 + (c.o * 3 + terrain(c)) * 2 + (isCart(c) ? 1 : 0))).join('')).join('/');
  const lane = field => {
    const label = new Map();
    return s.cells.flat().filter(c => c[field] !== undefined).map(c => {
      if (!label.has(c[field])) label.set(c[field], label.size);
      return String.fromCharCode(65 + label.get(c[field]));
    }).join('');
  };
  return `${kinds}|${lane('pid')}|${lane('cart')}|${s.rac.x},${s.rac.y}`;
};
