// Treasure Trash — the rules. Pure, deterministic, no DOM, no I/O. The game, the solver
// and the verifier all import this module.

// Occupant codes. `stateKey` encodes each as one printable character, so the list can grow.
export const NONE = 0, BAG = 1, CAN_FULL = 2, CAN_EMPTY = 3, TRASH = 4,
             // 6 is retired.
             BIN = 5, WHEELIE = 7, WHEELIE_EMPTY = 8, JUG = 9, FURNITURE = 10,
             BIN_EMPTY = 11, JUG_EMPTY = 12, SPONGE = 13, CARDBOARD = 14, PANE = 15,
             TIRE_H = 16, TIRE_V = 17, BICYCLE = 18, RUG = 19, CHAIR = 20, BROOM = 21,
             // The cabinet is four facings times two states, and OPEN and CLOSED are separate
             // codes rather than one code with a flag. That is what keeps `isMultiCell` the flat
             // predicate on a code it has always been: an open cabinet is a multi-cell kind, and
             // a closed one is not.
             CABC_U = 22, CABC_D = 23, CABC_L = 24, CABC_R = 25,
             CABO_U = 26, CABO_D = 27, CABO_L = 28, CABO_R = 29,
             // 30 is free. Codes are handed out, never renumbered: the board protocol reads them
             // as numbers, so a code that moves is a board that means something else.
             MAG_U = 31, MAG_D = 32, MAG_L = 33, MAG_R = 34,
             // A barrow being CARRIED. One cell holds one cart, so a barrow riding in
             // something cannot also be one — it rides as cargo and is put down as a cart.
             BAR_U = 35, BAR_D = 36, BAR_L = 37, BAR_R = 38;

// The one code a cell does not fully describe: two adjacent FURNITURE cells may be one couch
// or two, and only `pid` says which. `stateKey` encodes the partition as well as the codes.
export const isMultiCell = o =>
  o === FURNITURE || o === BICYCLE || o === RUG || (o >= CABO_U && o <= CABO_R);

// A cabinet's facing is baked into its code, so nothing stores it.
export const cabinetFace = o =>
  ({ [CABC_U]: 'u', [CABC_D]: 'd', [CABC_L]: 'l', [CABC_R]: 'r',
     [CABO_U]: 'u', [CABO_D]: 'd', [CABO_L]: 'l', [CABO_R]: 'r' })[o];
export const isCabinetClosed = o => o >= CABC_U && o <= CABC_R;
export const isCabinetOpen = o => o >= CABO_U && o <= CABO_R;
// The occupant codes, as one object. The renderer takes this rather than a hand-listed subset:
// a code left out of such a list does not throw, it draws NOTHING, and a piece that is simply
// invisible is a bug you find by playing rather than by testing.
/** A barrow riding as cargo, and which way it is still facing. */
export const isCarriedBarrow = o => o >= BAR_U && o <= BAR_R;
/** The two directions of the same fact: a cart kind, and the cargo code it rides as. */
export const carriedAs = k => BAR_U + (k - BARROW_U);
export const carriedKind = o => BARROW_U + (o - BAR_U);
/** Which way a carried barrow is still pointing — the renderer draws it as the barrow it is. */
export const carriedFace = o => (isCarriedBarrow(o) ? barrowFace(carriedKind(o)) : undefined);

// --- what a cell is carrying ---------------------------------------------------------------
// A barrow that is carrying something can itself be carried, and what IT carries may be another
// barrow. So a cell holds a CHAIN rather than an occupant: `o` is the outermost thing — the one
// standing in the cart slot or on the floor, and the one the stage draws — and `hold` is what
// rides inside it, outermost first. Only a carried barrow has anywhere to put a `hold`, so
// every link of the chain but the last is one.
//
// `o` alone is the chain of length one every cell had before, which is why every branch that
// only ever moves a bare occupant still reads and writes `o` and is none the wiser.

/** Everything riding in this cell, outermost first; empty when the cell holds nothing. */
export const chainOf = c => (c.o === NONE ? [] : c.hold !== undefined ? [c.o, ...c.hold] : [c.o]);

/** The one write. `= undefined` rather than `delete`, for the reason every other lane is. */
export const setChain = (c, ch) => {
  c.o = ch.length ? ch[0] : NONE;
  if (ch.length > 1) c.hold = ch.slice(1);
  else if (c.hold !== undefined) c.hold = undefined;
};

/** Everything a cell is carrying, at every depth — what `bagsLeft` and the format have to walk
 *  so a bag stowed three barrows deep still counts and still round-trips. */
export const deepCells = s => {
  const out = [];
  for (const row of s.cells) for (const c of row) out.push(...chainOf(c));
  return out;
};

export const MAGNET_REACH = 3;
export const magnetFace = o =>
  ({ [MAG_U]: 'u', [MAG_D]: 'd', [MAG_L]: 'l', [MAG_R]: 'r' })[o];
export const isMagnet = o => o >= MAG_U && o <= MAG_R;

export const OCCUPANTS = {
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, WHEELIE, WHEELIE_EMPTY, JUG, FURNITURE,
  BIN_EMPTY, JUG_EMPTY, SPONGE, CARDBOARD, PANE, TIRE_H, TIRE_V, BICYCLE, RUG, CHAIR, BROOM,
  CABC_U, CABC_D, CABC_L, CABC_R, CABO_U, CABO_D, CABO_L, CABO_R,
  MAG_U, MAG_D, MAG_L, MAG_R, BAR_U, BAR_D, BAR_L, BAR_R, carriedFace,
  // The cabinet is the one kind whose drawing needs more than its code, so the questions the
  // renderer has to ask travel with the codes rather than being re-derived over there.
  cabinetFace, isCabinetOpen, magnetFace,
};

const CAB_OPENS = { [CABC_U]: CABO_U, [CABC_D]: CABO_D, [CABC_L]: CABO_L, [CABC_R]: CABO_R };
const CAB_SHUTS = { [CABO_U]: CABC_U, [CABO_D]: CABC_D, [CABO_L]: CABC_L, [CABO_R]: CABC_R };

// An open cabinet is a BODY of two cells: the drawer end is the one its facing points at, so the
// pair needs no field of its own and no lookup — a piece id already says which cells are one
// thing, the way it does for the couch.
export const cabinetEnds = (s, pid) => {
  const own = pieceCells(s, pid);
  const f = DIRS[cabinetFace(cell(s, ...own[0]).o)];
  const body = own.find(([x, y]) => own.some(([bx, by]) => bx === x + f[0] && by === y + f[1]));
  if (!body) throw new Error(`cabinet ${pid} is not two cells along its facing`);
  return { own, body, draw: [body[0] + f[0], body[1] + f[1]], f };
};

/** An id no piece on this board is using. Never a count: a piece minted with an id another one
 *  holds is welded to it, and `pieceCells` would move the two as one. */
export const freePid = s => {
  let top = -1;
  for (const row of s.cells) for (const c of row) if (c.pid !== undefined && c.pid > top) top = c.pid;
  return top + 1;
};

// The multi-cell pieces that roll, and which shove sets each one going. The axis is taken from
// the cells a piece already occupies, so anisotropy costs no field of its own and nothing in
// `stateKey` — which is the whole reason these are cheaper than a turnstile.
const ROLL_AXIS = new Map([[BICYCLE, 'long'], [RUG, 'short']]);

/** Whether a shove this way is the one that sets this body rolling, read off the footprint. */
const rollsBody = (o, cells, dx, dy) => {
  const axis = ROLL_AXIS.get(o);
  if (axis === undefined) return false;
  const pushedLong = longAxis(cells) === (dx !== 0 ? 'x' : 'y');
  return axis === 'long' ? pushedLong : !pushedLong;
};

/** Whether the thing standing here rolls THIS way — one cell or many, the same question. A
 *  multi-cell piece asks it of its own footprint; that is what lets a rug hand its motion to a
 *  bicycle, and what stops it when the two lie across each other. */
export const rollsHere = (s, x, y, dx, dy) => {
  const c = cell(s, x, y);
  if (isCart(c)) return !isHeavyCart(s, c.cart)
    && (!isBarrow(cartKindOf(c)) || barrowRollsAlong(cartKindOf(c), dx, dy));
  if (isMultiCell(c.o)) return rollsBody(c.o, pieceCells(s, c.pid), dx, dy);
  return rollsAlong(c, dx, dy);
};

/** A multi-cell piece's long axis, read off its own footprint. */
export function longAxis(cells) {
  let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
  for (const [x, y] of cells) {
    if (x < minx) minx = x; if (x > maxx) maxx = x;
    if (y < miny) miny = y; if (y > maxy) maxy = y;
  }
  return maxx - minx >= maxy - miny ? 'x' : 'y';
}

/** Boards are tiny, so this scans the whole one rather than keeping an index. */
export function pieceCells(s, pid) {
  const out = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++)
    if (s.cells[y][x].pid === pid) out.push([x, y]);
  return out;
}

// A cart cell holds its CARGO's occupant code in `o`, so membership needs a field of its own;
// and like `pid`, two adjacent cart cells may be one cart or two.
export const isCart = c => c.cart !== undefined;

export function cartCells(s, cid) {
  const out = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++)
    if (s.cells[y][x].cart === cid) out.push([x, y]);
  return out;
}

// `!isCart` is load-bearing: a cart cell reports its cargo's code, so without it a cart
// carrying a wheelie bin reads as a roller.
export const isRoller = c =>
  !isCart(c) && (c.o === WHEELIE || c.o === WHEELIE_EMPTY || c.o === TIRE_H || c.o === TIRE_V
                 || c.o === CHAIR);

// Asked per shove rather than per kind, because the answer decides which branch is taken.
export const rollsAlong = (c, dx, dy) =>
  isRoller(c) && (c.o === TIRE_H ? dx !== 0 : c.o === TIRE_V ? dy !== 0 : true);

// One shove table for the single-cell pushables. Read the entries, not a paraphrase.
const SLIDES = {
  [CAN_FULL]:  { slides: CAN_EMPTY, drops: BAG },
  [BIN]:       { slides: BIN_EMPTY, drops: TRASH },
  [JUG]:       { slides: JUG_EMPTY,  pours: true },
  [JUG_EMPTY]: { slides: JUG_EMPTY },
  [CAN_EMPTY]: { slides: CAN_EMPTY },
  [BIN_EMPTY]: { slides: BIN_EMPTY },
  [TIRE_H]:    { slides: TIRE_H },
  [TIRE_V]:    { slides: TIRE_V },
  [MAG_U]:     { slides: MAG_U },
  [MAG_D]:     { slides: MAG_D },
  [MAG_L]:     { slides: MAG_L },
  [MAG_R]:     { slides: MAG_R },
  [CABC_U]:    { slides: CABC_U },
  [CABC_D]:    { slides: CABC_D },
  [CABC_L]:    { slides: CABC_L },
  [CABC_R]:    { slides: CABC_R },
  [SPONGE]:    { slides: SPONGE,    soaks: true },
  [CARDBOARD]: { slides: CARDBOARD, covers: true },
};

// Direction letters are the solution format's alphabet — see FORMATS.md.
export const DIRS = { l: [-1, 0], u: [0, -1], r: [1, 0], d: [0, 1] };
export const DIR_ORDER = ['u', 'd', 'l', 'r'];   // canonical order: solver tie-breaks on this

// The three action classes. A solution records `kind`; `applyAction` checks it on replay.
export const MOVE = 'move', PUSH = 'push', TEAR = 'tear';

export const cloneState = s => ({
  cols: s.cols, rows: s.rows, rac: { ...s.rac },
  // `hold` is the one field that is not a scalar, so it is the one a spread would SHARE. A
  // shared array is a write on one board arriving on another, which no test would see as
  // anything but a wrong answer several moves later.
  cells: s.cells.map(row => row.map(c => (c.hold ? { ...c, hold: [...c.hold] } : { ...c }))),
});

export const inGrid = (s, x, y) => x >= 0 && y >= 0 && x < s.cols && y < s.rows;
export const cell = (s, x, y) => s.cells[y][x];

// Terrain — `wall`, `water`, `bridge` — is a lane of its own, not an occupant code: a cell
// holds one occupant, and terrain has to be able to coexist with one.
//
// Only the terrain a move can CHANGE reaches `stateKey`. A static lane cannot differ between two
// states of the same room, so encoding it would buy nothing — which is why `wall` was never in
// there, and the rule generalises to every static lane added since.
export const DRY = 0, WATER = 1, BRIDGE = 2, GREASE = 3, TAR = 4, GLASS = 5, COVERED = 6;

// The width `stateKey` packs against. Raising it is the whole cost of a new mutable lane, and
// it multiplies against the occupant count — see SPEC-SHEET, what this costs the port.
export const TERRAINS = 7;

// `water` and `bridge` keep their own flags: the level format, the renderer and every pipeline
// tool read them by name, and the lanes added since ride in `ter` beside them. One resolver, so
// no caller has to know which of the two a lane happens to live in.
export const terrainOf = c => (c.water ? WATER : c.bridge ? BRIDGE : c.ter ?? DRY);

// A cell nothing can be dragged off again. The permanence is the piece.
export const isTar = c => c.ter === TAR;

// Slick floor.
export const isGrease = c => c.ter === GREASE;

// Broken glass. It is what split "where he can walk" from "where anything can sit"; one
// predicate did both.
export const isGlass = c => c.ter === GLASS;

// Static lanes. Out of `stateKey` for the reason `wall` always was.
export const isGrate = c => c.grate === true;

/** One-way cells bind the raccoon and objects alike, so the test needs the direction of travel
 *  and cannot sit in `isOccupiable` with the rest. */
export const mayEnter = (s, x, y, dx, dy) => {
  if (!inGrid(s, x, y)) return false;
  const w = cell(s, x, y).oneway;
  return w === undefined || (DIRS[w][0] === dx && DIRS[w][1] === dy);
};

// Carts are not interchangeable once they have kinds, and `stateKey` labels them by first
// appearance — so the kind travels in the key beside the label, or two different boards key
// alike. `SKATE` is the two-cell skateboard every level has today.
export const SKATE = 0, BARROW_U = 1, BARROW_D = 2, BARROW_L = 3, BARROW_R = 4;
export const CART_KINDS = 5;
export const cartKindOf = c => c.ck ?? SKATE;

// A barrow is a cart of one cell, and it FACES the way its tub points.
export const isBarrow = k => k >= BARROW_U && k <= BARROW_R;
export const barrowFace = k =>
  ({ [BARROW_U]: 'u', [BARROW_D]: 'd', [BARROW_L]: 'l', [BARROW_R]: 'r' })[k];
/** Whether it faces this way — the only direction it picks anything up. */
export const barrowScoops = (k, dx, dy) => {
  const f = DIRS[barrowFace(k)];
  return f !== undefined && dx === f[0] && dy === f[1];
};

// --- the magnet ------------------------------------------------------------------------------
// `MAGNET_REACH`, `METAL`, `magnetResolve` and `settleAtRest` are the whole of it.

// What a magnet takes hold of. The sponge's absence is deliberate: an unlimited cleaner that
// could be fetched back from anywhere would have no bound at all.
const METAL = new Set([CAN_FULL, CAN_EMPTY, BIN, BIN_EMPTY, WHEELIE, WHEELIE_EMPTY,
                       TIRE_H, TIRE_V, BICYCLE, CHAIR,
                       CABC_U, CABC_D, CABC_L, CABC_R, CABO_U, CABO_D, CABO_L, CABO_R,
                       MAG_U, MAG_D, MAG_L, MAG_R]);
export const isMetal = c => (isCart(c) ? isBarrow(cartKindOf(c)) : METAL.has(c.o));

// --- holds ---------------------------------------------------------------------------------
// A hold is an EDGE, and it is written on the HOLDER: `grip` is the signed offset along the
// holder's own axis to whatever it has hold of. Nothing is written on the held thing, which is
// what lets several holders have hold of one object without competing for a field on it — and
// what makes the direction of a hold readable, so a held magnet can tell its holder from its
// load. Both the barrow's tow and the magnet's chain ride in this one lane.
export const gripOf = c => c.grip;

/** The axis a holder's hold runs along: its facing, either way along it for a barrow. */
export const gripAxis = (s, x, y) => {
  const c = cell(s, x, y);
  if (isMagnet(c.o)) return DIRS[magnetFace(c.o)];
  if (isCart(c) && isBarrow(cartKindOf(c))) return DIRS[barrowFace(cartKindOf(c))];
  return undefined;
};

/** The cell a holder has hold of, or null when it has hold of nothing. */
export const gripTarget = (s, x, y) => {
  const c = cell(s, x, y);
  if (c.grip === undefined) return null;
  const f = gripAxis(s, x, y);
  if (!f) return null;
  const p = [x + f[0] * c.grip, y + f[1] * c.grip];
  return inGrid(s, ...p) ? p : null;
};

/** Every holder with hold of the body standing here — the reverse of `gripTarget`. */
export const holdersOf = (s, x, y) => {
  const body = new Set(bodyCells(s, [x, y]).map(([bx, by]) => `${bx},${by}`));
  const out = [];
  for (let yy = 0; yy < s.rows; yy++) for (let xx = 0; xx < s.cols; xx++) {
    const t = gripTarget(s, xx, yy);
    if (t && body.has(`${t[0]},${t[1]}`)) out.push([xx, yy]);
  }
  return out;
};

/**
 * The whole rigid complex a cell belongs to: what it has hold of, whoever has hold of it, and
 * onward through both. Derived rather than stored, the way `bodyCells`, `pieceCells` and
 * `cartCells` are — so a hold shared by two holders needs no field to say so.
 */
export const complexCells = (s, at) => {
  const seen = new Set(), out = [];
  const walk = (x, y) => {
    for (const [bx, by] of bodyCells(s, [x, y])) {
      const k = `${bx},${by}`;
      if (seen.has(k)) continue;
      seen.add(k); out.push([bx, by]);
      const t = gripTarget(s, bx, by);
      if (t) walk(...t);
      for (const [hx, hy] of holdersOf(s, bx, by)) walk(hx, hy);
    }
  };
  walk(at[0], at[1]);
  return out;
};

/** Whether anything at all has hold of this cell, either end of the edge. */
export const inAHold = (s, x, y) =>
  cell(s, x, y).grip !== undefined || holdersOf(s, x, y).length > 0;
/** Whether this is the line it runs on at all — either way along its facing. */
export const barrowRollsAlong = (k, dx, dy) => {
  const f = DIRS[barrowFace(k)];
  return f !== undefined && (dx !== 0) === (f[0] !== 0);
};

export const isClearFloor = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall && !cell(s, x, y).water && !isGlass(cell(s, x, y))
  && cell(s, x, y).o === NONE && !isCart(cell(s, x, y));

export const canStand = isClearFloor;

/** The one place water is laid down. A grate takes it and it is gone; grease and tar are washed
 *  off the cell it lands on, which is the only thing in the game that undoes either. */
export function pour(c) {
  if (isGrate(c)) return;
  if (c.ter === GREASE || c.ter === TAR) c.ter = undefined;
  c.water = true;
}

/** The one place water and grease are taken OFF a cell. Tar and glass are not soaked: the
 *  sponge sticks to them, and being stuck is the only bound an unlimited sponge has. */
export function soak(c) {
  if (c.water) c.water = false;
  else if (c.ter === GREASE) c.ter = undefined;
}

/** The one place a hazard is covered over. Water, tar and glass are the three a cell can be made
 *  walkable from; anywhere else the sheet is simply lying on the floor. */
export const coversOver = c => c.water || c.ter === TAR || c.ter === GLASS;
export function cover(c) {
  if (!coversOver(c)) return false;
  c.water = false; c.ter = COVERED;
  return true;
}

/** The one place trash is laid down. */
export function layTrash(c) {
  if (isGrate(c)) return;                                   // straight through, and gone
  if (c.water) { c.water = false; c.bridge = true; }
  else c.o = TRASH;
}

export const isOccupiable = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall && !cell(s, x, y).exit
  && cell(s, x, y).o === NONE && !isCart(cell(s, x, y));

/** Where a travelling thing may go on to: a cell it can rest in, entered from a legal side.
 *  Tar ends travel rather than forbidding it, which is why it is not a bar to entry here. */
export const travelsInto = (s, x, y, dx, dy) =>
  isOccupiable(s, x, y) && mayEnter(s, x, y, dx, dy);

/** Asked by `explain` before anything else, so no branch can forget it. */
const stuckInTar = (s, tx, ty) => {
  const c = cell(s, tx, ty);
  if (isTar(c)) return true;
  if (c.o === SPONGE && isGlass(c)) return true;      // shards in the sponge; it does not come off
  return bodyCells(s, [tx, ty]).some(([x, y]) => isTar(cell(s, x, y)));
};

export const canRest = (s, x, y) => isOccupiable(s, x, y) || cartAt(s, [x, y]) !== null;

const cartAt = (s, [x, y]) => (inGrid(s, x, y) && isCart(cell(s, x, y)) ? cell(s, x, y).cart : null);

function intoCart(s, cid, entry, dx, dy) {
  const file = [];
  for (let p = entry; cartAt(s, p) === cid; p = [p[0] + dx, p[1] + dy]) file.push(p);
  const last = file[file.length - 1];
  const beyond = [last[0] + dx, last[1] + dy];
  const out = chainOf(cell(s, ...last));
  if (out.length && !isOccupiable(s, ...beyond)) return { blame: [beyond] };
  if (out.length && !tipFits(s, out[0], beyond, dx, dy))
    return { blame: [tipsInto(out[0], beyond, dx, dy)] };
  return { file, beyond, out, dx, dy };
}

function applyIntoCart(s, next, cid, { file, beyond, out, dx, dy }, o, step) {
  for (let j = file.length - 1; j > 0; j--) {
    const was = chainOf(cell(s, ...file[j - 1]));
    setChain(cell(next, ...file[j]), was);
    if (step) was.forEach((o, k) =>
      step.moved.push({ o, from: file[j - 1], to: file[j], parent: cid, depth: k }));
  }
  setChain(cell(next, ...file[0]), [o]);
  if (out.length) {
    const m = {
      o: out[0], from: file[file.length - 1], to: beyond, parent: null,
      effect: effectOf(cell(next, ...beyond), out[0]),
      ...(landsAs(out[0]) !== out[0] && { becomes: landsAs(out[0]) }),
    };
    if (step) step.moved.push(m);
    land(next, beyond, out, step, m);
    tipOut(next, out[0], beyond, dx, dy, step);
  }
}

export const canPour = (s, x, y) =>
  isOccupiable(s, x, y) && !cell(s, x, y).water && !cell(s, x, y).bridge;

export function fan(bx, by, dx, dy) {
  const px = -dy, py = dx;
  return [
    [bx + px, by + py], [bx - px, by - py],
    [bx + dx, by + dy], [bx + dx + px, by + dy + py], [bx + dx - px, by + dy - py],
  ];
}

// Every `spawned` entry the tear makes carries the bag's own cell, which is what keeps a spray
// to one ray per chair. A grid has nowhere to put a diagonal, so one takes the burst's own way.
export const fleeFrom = (bx, by, dx, dy, fx, fy) => {
  const rx = Math.sign(fx - bx), ry = Math.sign(fy - by);
  return rx !== 0 && ry !== 0 ? [dx, dy] : [rx, ry];
};

/** A chair in the fan is not a wall — it is something the burst MOVES, provided it has anywhere
 *  to go. So the fan's legality turns on a cell beyond the fan, and when that cell is the one at
 *  fault the refusal names it as well as the chair. */
const chairFlees = (s, bx, by, dx, dy, fx, fy) => {
  const [ax, ay] = fleeFrom(bx, by, dx, dy, fx, fy);
  return isOccupiable(s, fx + ax, fy + ay) && mayEnter(s, fx + ax, fy + ay, ax, ay)
    ? [fx + ax, fy + ay] : null;
};

export const fanBlockers = (s, bx, by, dx, dy) => {
  const blame = [];
  for (const [x, y] of fan(bx, by, dx, dy)) {
    if (isOccupiable(s, x, y)) continue;
    if (inGrid(s, x, y) && cell(s, x, y).o === CHAIR) {
      const to = chairFlees(s, bx, by, dx, dy, x, y);
      if (to) continue;
      blame.push([x, y], [x + fleeFrom(bx, by, dx, dy, x, y)[0], y + fleeFrom(bx, by, dx, dy, x, y)[1]]);
      continue;
    }
    blame.push([x, y]);
  }
  return blame;
};

// A lane that can refuse gets its own reason rather than the generic one, so the UI can name
// what is in the way instead of just saying "blocked". Order is most-specific first: a one-way
// exit cell is refused for being the exit, which is the thing the player can do nothing about.
const reasonFor = (s, blockers, fallback) => {
  const is = pred => blockers.some(([x, y]) => inGrid(s, x, y) && pred(cell(s, x, y)));
  if (is(c => c.exit)) return 'exit';
  if (is(c => c.water && c.o === NONE)) return 'water';
  if (is(isGlass)) return 'glass';
  if (is(isTar)) return 'tar';
  if (is(c => c.oneway !== undefined)) return 'oneway';
  return fallback;
};

/** A cart id no cart on this board is using. */
export const freeCart = s => {
  let top = -1;
  for (const row of s.cells) for (const c of row) if (c.cart !== undefined && c.cart > top) top = c.cart;
  return top + 1;
};

/**
 * The one place cargo is put down. A grate takes what lands in it, and takes it for good —
 * a loaded barrow included, load and all.
 *
 * And the one place a carried barrow stops being cargo. It rode as an occupant because a cell
 * holds one cart and it was in somebody else's; set down, it is a barrow again, facing the way
 * it always was, holding what it was holding. Here rather than at each of the places cargo
 * leaves a cart, so no one of them can forget and leave a barrow lying about as a code nothing
 * can shove.
 *
 * `ch` is a chain, and what comes back is what the STEP has to say about it: the id of the cart
 * the head became, when it became one.
 */
const drop = (s, at, ch) => {
  const c = cell(s, ...at);
  if (isGrate(c)) return {};
  const head = ch[0];
  if (head === TRASH) { layTrash(c); return {}; }
  if (isCarriedBarrow(head)) {
    c.cart = freeCart(s); c.ck = carriedKind(head);
    setChain(c, ch.slice(1));
    return { cart: c.cart };
  }
  setChain(c, ch);
  return {};
};

/**
 * `drop`, and the step entries that go with it. `m` is the `moved` entry for the head, if the
 * caller made one; everything the head was carrying travels with it and needs one of its own.
 *
 * Set down, the head is a cart again and what was inside it is one level shallower than it was
 * — which is the whole of what the stage has to be told, since nothing appears and nothing is
 * consumed. Every place a chain comes to rest goes through here, so no one of them can put one
 * down and leave the load drawn where the cart used to be.
 */
const land = (s, at, ch, step, m = null) => {
  const swallowed = isGrate(cell(s, ...at));
  const { cart } = drop(s, at, ch);
  if (cart !== undefined && m) m.toCart = cart;
  if (!step) return;
  for (let i = 1; i < ch.length; i++)
    step.moved.push({
      o: ch[i], from: m ? m.from : at, to: at, wasDepth: i, depth: i - 1,
      parent: cart ?? null, ...(swallowed && { effect: 'falls' }),
    });
};

// --- the motion account -------------------------------------------------------------------
// A board says what is where, not what moved where, so a traced action carries a step. The
// schema is stage.js's contract; the branches that fill it are the spec for what goes in it.
//
//   moved    { o, from, to, depth, becomes?, parent?, effect?, fromCart?, toCart?, wasDepth? }
//   spawned  { cells, depth, from?, o?, effect?, parent?, kind?, ref? }
//   gone     { cells, depth, o?, effect?, kind?, ref? }
//
// One lane per FACT — a thing moved, arrived, left — and never one lane per kind of thing. An
// occupant is found by its code and the cell it stands on; a body has neither, and is found by
// the piece id it carries. Both are the same event, so both go in the same list: a reader
// counting what left the board reads `gone` and is right, rather than reading `gone` and then
// remembering that bodies say it somewhere else.
//
// Every entry names `cells`, however many it has. A `piece` entry says which cells a body or a
// cart moved FROM, so nothing downstream has to rebuild that from the board.
//
// `depth` is how far INSIDE this cell's contents a thing comes to rest: 0 is what stands in the
// cart slot or on the floor, 1 is what that is carrying, and so on down. `wasDepth` is where the
// stage is holding it now, and defaults to `depth` — a thing that only changes cells keeps it.
//   piece    { kind, ref, dx, dy, effect? } | null
//   impact   boolean
/**
 * Every piece entry says which cells it moved FROM. A body and a cart travel by id and an
 * offset because the stage draws each of them as one sprite; anything counting cells would
 * otherwise have to know that, and reconstruct it, and be wrong the day it forgot.
 *
 * Resolved against the frame the step ran on, which is the only board on which those ids still
 * mean what the entry says.
 */
/** A body carries a piece id; an occupant does not. The one thing that tells the two apart. */
export const isBodyEvent = e => e.ref !== undefined;

// The two effects that take a BODY off the board. A body has no occupant code, so nothing else
// about the entry says it is leaving.
const CONSUMES_BODY = new Set(['falls', 'swaps']);

function settleSteps(frames, steps) {
  steps.forEach((step, i) => {
    for (const p of step.piece) {
      p.cells = p.kind === 'cart' ? cartCells(frames[i], p.ref) : pieceCells(frames[i], p.ref);
      // A body leaves the board by being named in `gone`, the way everything else does.
      if (CONSUMES_BODY.has(p.effect))
        step.gone.push({ kind: p.kind, ref: p.ref, cells: p.cells, effect: p.effect });
    }
    for (const e of [...step.moved, ...step.gone, ...step.spawned]) e.depth ??= 0;
  });
  return steps;
}

const mkStep = (over = {}) => ({ moved: [], spawned: [], gone: [], piece: [], impact: false, ...over });
// What landing here looks like. A grate takes what arrives regardless of what it is, so the
// thing that arrives plays its arrival and is then gone — which is what stops the stage holding
// a sprite for cargo the board never received.
const effectOf = (c, o) => (isGrate(c) ? 'falls' : o === TRASH && c.water ? 'fills' : 'rest');

// --- tipping -------------------------------------------------------------------------------
// A container comes to rest in three places — the cell a shove slides it to, the cell a cart
// ejects it onto, and the cell it is displaced to when something else is shoved into the cart
// behind it. All three go through `tipFits` and `tipOut`, so no caller can disagree with
// another about what a container owes on landing.

const sheds = o => {
  const t = SLIDES[o];
  return t && (t.drops !== undefined || t.pours === true) ? t : null;
};

const tipCell = ([x, y], dx, dy) => [x + dx, y + dy];

/** `at` is where the container lands, (dx,dy) the direction it was travelling. */
export const tipFits = (s, o, at, dx, dy) => {
  const t = sheds(o);
  if (!t) return true;
  const [x, y] = tipCell(at, dx, dy);
  // He is the one occupant `isOccupiable` cannot see, and he is in the way: standing on the
  // cell, he stops the container emptying onto it. It keeps its slot until he moves.
  if (s.rac.x === x && s.rac.y === y) return false;
  return (t.pours ? canPour : isOccupiable)(s, x, y);
};

export const tipsInto = (o, at, dx, dy) => (sheds(o) ? tipCell(at, dx, dy) : null);

/** The one place a container sheds. `at` already holds it; this is the bill for landing. */
function tipOut(s, o, at, dx, dy, step) {
  const t = sheds(o);
  if (!t) return;
  const c = tipCell(at, dx, dy);
  const target = cell(s, ...c);
  if (t.pours) {
    if (step) step.spawned.push({ o: NONE, cells: [c], from: at, effect: 'pours' });
    pour(target);
  } else {
    if (step) step.spawned.push({ o: t.drops, cells: [c], from: at, effect: effectOf(target, t.drops) });
    drop(s, c, [t.drops]);
  }
  if (t.slides !== o) cell(s, ...at).o = t.slides;
}

/** What a container reads as once it has landed and shed. */
const landsAs = o => (sheds(o) ? SLIDES[o].slides : o);

/**
 * A barrow that something else can take aboard: one cell, and not held. Carrying one is the
 * only way a cart ever enters another cart's cell.
 *
 * What it is holding comes with it — a barrow does not have to be emptied to be lifted, and
 * what it is holding may be another loaded barrow, as deep as anyone cares to stack them.
 * Unheld, because a hooked one is already spoken for, and a hold that outlived the thing
 * holding it is a link pointing at nothing.
 */
export const isScoopable = (s, x, y) => {
  const c = cell(s, x, y);
  return isCart(c) && isBarrow(cartKindOf(c)) && !inAHold(s, x, y)
    && cartCells(s, c.cart).length === 1;
};

/**
 * Move a whole cart `k` cells along, carrying its kind and whatever is in each of its slots.
 * Cleared in full before anything is written, so a cart never overwrites its own tail.
 *
 * `shoveCart` does this same move fused with the slot bookkeeping a swallow needs; this is the
 * bare translation, which is all a cart moved by a KNOCK ever does — a knocked cart is light, and
 * light means it is carrying nothing to shift, shed or set down.
 */
const translateCart = (s, cid, k, dx, dy) => {
  const own = cartCells(s, cid);
  const kind = cartKindOf(cell(s, ...own[0]));
  const held = own.map(([x, y]) => chainOf(cell(s, x, y)));
  for (const [x, y] of own) {
    const c = cell(s, x, y);
    setChain(c, []); c.cart = undefined; c.ck = undefined;
  }
  own.forEach(([x, y], i) => {
    const d = cell(s, x + k * dx, y + k * dy);
    d.cart = cid; d.ck = kind; setChain(d, held[i]);
  });
};

/**
 * WEIGHT. A wheeled thing is heavy while it is CARRYING objects — a cart or a barrow with
 * something riding in it. A wheelie bin is light full or empty: its trash is a state of the bin
 * rather than cargo, and nothing rides in it. The tyre, the bicycle and the chair can hold nothing
 * and so are never heavy. Weight decides distance and nothing else: heavy moves one cell, light
 * rolls.
 */
export const isHeavyCart = (s, cid) =>
  cartCells(s, cid).some(([x, y]) => chainOf(cell(s, x, y)).length > 0);

/** What a cart takes in when it swallows this cell — a barrow rides as cargo with everything
 *  it was holding stacked behind it, and anything else is already the chain it will be. */
export const cargoAt = (s, x, y) => {
  const c = cell(s, x, y);
  return isScoopable(s, x, y) ? [carriedAs(cartKindOf(c)), ...chainOf(c)] : chainOf(c);
};

/** `swallows` is false for a barrow shoved against its facing: it rolls, but it has no mouth
 *  that way, so anything at all in the cell ahead is what stops it rather than what it takes. */
const cartCanEnter = (s, x, y, dx, dy, swallows = true) => {
  if (!inGrid(s, x, y)) return false;
  const c = cell(s, x, y);
  if (isCart(c)) return swallows && isScoopable(s, x, y) && mayEnter(s, x, y, dx, dy);
  if (!swallows && c.o !== NONE) return false;
  return !c.wall && !c.exit && !isHalfOfABody(s, x, y) && mayEnter(s, x, y, dx, dy);
};

/**
 * Shove a cart. Its cells are grouped into FILES running along the shove; a file is a lead
 * cell plus the cells behind it, and `loads[i][j]` is that file's cargo, lead-first.
 *
 * `entry` is the cart cell the raccoon shoved. `trace` collects a frame per transition; off
 * by default, since the clones cost and `analyze()` wants only the last board.
 */
/**
 * IMPACT, for whatever is standing there. A train stops; if what stopped it rolls this way, the
 * motion carries on into it, and into whatever THAT stops against. Every hand-off goes strictly
 * forward, so a cascade is a straight run on a finite board and cannot fail to end.
 */
function handOff(next, from, dx, dy, step) {
  const moved = [], bodies = [];
  let p = from, caught = false;
  for (; inGrid(next, ...p) && rollsHere(next, ...p, dx, dy);) {
    const c = cell(next, ...p);
    // A cart takes a knock with its mouth SHUT. Taking things in is what the raccoon's own shove
    // buys; a cart that hoovered whatever a stray impact sent it over would be the cascade all
    // over again, in a piece nobody was pushing. Anything it meets is what stops it.
    if (isCart(c)) {
      const cid = c.cart, own = cartCells(next, cid);
      const ownKey = new Set(own.map(([x, y]) => `${x},${y}`));
      const shut = (x, y) => !ownKey.has(`${x},${y}`) && !cartCanEnter(next, x, y, dx, dy, false);
      let j = 0;
      while (!own.some(([x, y]) => shut(x + (j + 1) * dx, y + (j + 1) * dy))) {
        j++;
        if (own.some(([x, y]) => isTar(cell(next, x + j * dx, y + j * dy)))) break;
      }
      if (j === 0) {
        // Pinned, and the momentum has to go SOMEWHERE. It moved the thing on wheels while there
        // was anywhere to move it; with nowhere left, what rolled in goes in instead of stopping
        // dead against the deck. A barrow takes it only through its mouth — its back is closed,
        // and a blow there is just a blow. Nothing displaces: a cart with anything aboard is
        // heavy, and a heavy one never reaches this branch at all.
        const kind = cartKindOf(c);
        const back = [p[0] - dx, p[1] - dy];
        const it = inGrid(next, ...back) ? cell(next, ...back) : null;
        if (it && it.o !== NONE && !isMultiCell(it.o) && !isCart(it)
            && (!isBarrow(kind) || barrowScoops(kind, -dx, -dy))) {
          const took = chainOf(it);
          setChain(it, []);
          setChain(c, took);
          moved.push({ o: took[0], from: back, to: [...p], parent: cid, depth: 0 });
          caught = true;
        } else {
          // Pinned, and nothing could go in either — a barrow struck on its closed back, or a
          // thing too big to ride. The momentum still arrived, so it shows as a wobble rather
          // than as the game doing nothing at all.
          bodies.push({ kind: 'cart', ref: cid, dx: 0, dy: 0, effect: 'rattles', blow: [dx, dy] });
        }
        break;
      }
      translateCart(next, cid, j, dx, dy);
      bodies.push({ kind: 'cart', ref: cid, dx: j * dx, dy: j * dy });
      const head = own.reduce((a, b) => (a[0] * dx + a[1] * dy >= b[0] * dx + b[1] * dy ? a : b));
      p = [head[0] + (j + 1) * dx, head[1] + (j + 1) * dy];
      continue;
    }
    const multi = isMultiCell(c.o), pid = c.pid;
    const own = multi ? pieceCells(next, c.pid) : [[...p]];
    const ownSet = new Set(own.map(([x, y]) => `${x},${y}`));
    const blockedAt = j => own.map(([x, y]) => [x + j * dx, y + j * dy])
      .filter(([x, y]) => !ownSet.has(`${x},${y}`) && !travelsInto(next, x, y, dx, dy)).length > 0;
    let j = 0;
    while (!blockedAt(j + 1)) {
      j++;
      if (own.some(([x, y]) => isTar(cell(next, x + j * dx, y + j * dy))
                            || isGrate(cell(next, x + j * dx, y + j * dy)))) break;
    }
    if (j === 0) break;                       // it stopped here, against whatever is beyond it
    const was = own.map(([x, y]) => ({ o: cell(next, x, y).o, pid: cell(next, x, y).pid }));
    for (const [x, y] of own) { const t = cell(next, x, y); t.o = NONE; t.pid = undefined; }
    // A grate takes what rolls in only when the WHOLE of it fits inside one; a longer thing
    // spans the hole and comes to rest across it. One cell of a body is not a smaller body.
    const landed = own.map(([x, y]) => [x + j * dx, y + j * dy]);
    const swallowed = landed.every(([x, y]) => isGrate(cell(next, x, y)));
    if (!swallowed) landed.forEach(([x, y], i) => {
      const to = cell(next, x, y);
      to.o = was[i].o; to.pid = was[i].pid;
    });
    // A multi-cell piece is a BODY: it has one sprite for the whole footprint, and naming its
    // cells here would name sprites the stage does not hold. Either way it ARRIVES and is then
    // gone, which is what stops the stage holding a sprite for what the board no longer has.
    const fall = swallowed ? { effect: 'falls' } : null;
    if (multi) bodies.push({ kind: 'furniture', ref: pid, dx: j * dx, dy: j * dy, ...fall });
    else own.forEach(([x, y], i) =>
      moved.push({ o: was[i].o, from: [x, y], to: landed[i], ...fall }));
    const lead = own.reduce((a, b) => (a[0] * dx + a[1] * dy >= b[0] * dx + b[1] * dy ? a : b));
    p = [lead[0] + (j + 1) * dx, lead[1] + (j + 1) * dy];
  }
  // Whatever the run finally came up against wears the blow — unless the momentum went INSIDE
  // it, which settles the whole thing. Taking something aboard makes a cart heavy, and a heavy
  // cart is exactly what `strikeBack` rattles, so without this a catch reports both at once.
  if (!caught) strikeBack(next, p, dx, dy, step);
  return { moved, bodies };
}

/** Every cell of the thing standing here. A body is all of it — anything that moves one cell of
 *  a two-cell thing leaves halves that the board cannot even write down. */
export const bodyCells = (s, [x, y]) => {
  const c = cell(s, x, y);
  if (isMultiCell(c.o)) return pieceCells(s, c.pid);
  if (isCart(c)) return cartCells(s, c.cart);
  return [[x, y]];
};

/** Whether this cell is one half of something bigger, and so may not be taken on its own. The
 *  question every branch that shifts a single cell has to ask. */
export const isHalfOfABody = (s, x, y) => {
  const c = cell(s, x, y);
  return isMultiCell(c.o) || isCart(c);
};

/**
 * Whether a whole body can travel that far, testing against the cells it is vacating — the same
 * question `clearAt` asks of a couch, and with the one occupant `isOccupiable` cannot see put
 * back in. This is the PULL side of the board, where he can be anywhere: a shove has him behind
 * what moves, so no other branch has to ask.
 */
const bodyTravels = (s, own, dx, dy) => {
  const set = new Set(own.map(([x, y]) => `${x},${y}`));
  return own.every(([x, y]) => {
    const [nx, ny] = [x + dx, y + dy];
    if (set.has(`${nx},${ny}`)) return true;
    if (s.rac.x === nx && s.rac.y === ny) return false;
    return travelsInto(s, nx, ny, dx, dy);
  });
};

/**
 * Name what moved. A cart and a multi-cell piece have ONE sprite for a whole footprint, so they
 * are named as bodies and naming their cells would ask the stage for sprites it has not got.
 * Everything else is named cell by cell — which is what an open cabinet needs, since its two
 * halves are two ordinary occupants that happen to travel together.
 */
const nameMove = (step, was, cells, dx, dy) => {
  if (!step) return;
  const c = was[0];
  if (c.cart !== undefined) step.piece.push({ kind: 'cart', ref: c.cart, dx, dy });
  else if (isMultiCell(c.o)) step.piece.push({ kind: 'furniture', ref: c.pid, dx, dy });
  else cells.forEach(([x, y], i) =>
    step.moved.push({ o: was[i].o, from: [x, y], to: [x + dx, y + dy] }));
};

/** Move the whole body standing at `at` by (dx,dy). Its caller has already established that it
 *  fits; this is the write, and the one place a body's cells are carried across whole. */
function slideBody(next, at, dx, dy, step) {
  const own = bodyCells(next, at);
  const was = own.map(([x, y]) => ({ ...cell(next, x, y) }));
  for (const [x, y] of own) {
    const c = cell(next, x, y);
    c.o = NONE; c.hold = undefined; c.pid = undefined;
    c.cart = undefined; c.ck = undefined; c.grip = undefined;
  }
  own.forEach(([x, y], i) => {
    const c = cell(next, x + dx, y + dy);
    c.o = was[i].o; c.hold = was[i].hold; c.pid = was[i].pid;
    c.cart = was[i].cart; c.ck = was[i].ck; c.grip = was[i].grip;
  });
  nameMove(step, was, own, dx, dy);
}

/** How far a body may be drawn along (dx,dy), never more than `max`. */
const drawIn = (next, at, dx, dy, max) => {
  const own = bodyCells(next, at);
  let k = 0;
  while (k < max && bodyTravels(next, own, dx * (k + 1), dy * (k + 1))) k++;
  return k;
};

/**
 * Everything a magnet does. First the chain it already has follows or lets go, then it takes hold
 * of whatever is now in reach.
 *
 * `dx,dy` is the shove that carried the MAGNET here, and only the load it already had cares:
 * across the field that load keeps pace. Called with no direction it is the same question asked
 * of a magnet that did not move, which is what `settleMagnets` asks of every one of them.
 *
 * Returns whether it changed anything — a link taken or dropped is board state the account never
 * mentions, so nothing downstream can see it by looking at the step.
 */
function magnetResolve(next, mx, my, step, dx = 0, dy = 0) {
  let wrote = false;
  const f = DIRS[magnetFace(cell(next, mx, my).o)];

  // The hold it already has: still hold of something, or let go. `grip` says which cell, so this
  // asks after ONE edge and never has to work out which end of a group it is standing on.
  if (cell(next, mx, my).grip !== undefined) {
    const k = cell(next, mx, my).grip;
    // This runs after the magnet has moved, and what it holds has not moved with it — so the
    // offset is stale by exactly the shove. A shove is only ever along the facing or across it.
    const along = dx * f[0] + dy * f[1];
    const lag = [mx - dx + f[0] * k, my - dy + f[1] * k];   // where the load still stands
    if (along) {
      // ALONG: the load stayed put and the magnet closed on it, so the gap is short by the shove.
      cell(next, mx, my).grip = k - along;
    } else if (dx || dy) {
      // ACROSS: what is held keeps pace, or the two simply come apart.
      if (inGrid(next, ...lag) && drawIn(next, lag, dx, dy, 1)) {
        slideBody(next, lag, dx, dy, step);
        wrote = true;
      } else {
        cell(next, mx, my).grip = undefined;
        wrote = true;
      }
    }
    const at = gripTarget(next, mx, my);
    const g = cell(next, mx, my).grip;
    if (g === undefined || !at || g < 1 || g > MAGNET_REACH || !isMetal(cell(next, ...at))) {
      if (cell(next, mx, my).grip !== undefined) wrote = true;
      cell(next, mx, my).grip = undefined;
    } else {
      // It closes the gap by up to two, and stops when it is alongside.
      const drew = drawIn(next, at, -f[0], -f[1], Math.min(2, g - 1));
      if (drew) {
        slideBody(next, at, -f[0] * drew, -f[1] * drew, step);
        cell(next, mx, my).grip = g - drew;
        wrote = true;
      }
    }
  }

  // Capture. Walls stop the field; objects do not, so the first METAL along the line is taken
  // even with something standing in front of it — it simply closes as far as it can.
  if (cell(next, mx, my).grip !== undefined) return wrote;
  for (let k = 1; k <= MAGNET_REACH; k++) {
    const p = [mx + f[0] * k, my + f[1] * k];
    if (!inGrid(next, ...p) || cell(next, ...p).wall) return wrote;
    const c = cell(next, ...p);
    if (c.o === NONE && !isCart(c)) continue;
    if (!isMetal(c)) continue;
    const drew = drawIn(next, p, -f[0], -f[1], k - 1);
    if (drew) slideBody(next, p, -f[0] * drew, -f[1] * drew, step);
    cell(next, mx, my).grip = k - drew;
    return true;
  }
  return wrote;
}

/**
 * A field does not wait to be pushed. Every magnet on the board is asked again after the action
 * lands, in raster order, so anything that has come into a field is taken and anything that has
 * left one is let go — and a magnet that has never been shoved holds what is beside it.
 *
 * One pass. A piece drawn to one magnet can land in another's field, and the second magnet takes
 * it only if the sweep reaches it later in the order; a board settled to closure would need a
 * loop, and a loop is a rule nobody can read off the board.
 */
/**
 * A board as it is once its fields have taken hold — what a room LOOKS like before anyone has
 * touched it. A magnet holds whatever is in its field, and a field that waited for the first
 * action would appear to fire in answer to a step that had nothing to do with it.
 *
 * Every board enters the game through `toState`, so this is asked once, there, and no caller has
 * to remember it. The step it bills is thrown away: nothing has happened yet, and the stage is
 * built from the board this leaves rather than played into.
 */
export function settleAtRest(s) {
  settleMagnets(s, mkStep());
  return s;
}

function settleMagnets(next, step) {
  let wrote = false;
  for (let y = 0; y < next.rows; y++) for (let x = 0; x < next.cols; x++)
    if (isMagnet(cell(next, x, y).o)) wrote = magnetResolve(next, x, y, step) || wrote;
  return wrote;
}

/** The barrow has come to rest; if what stopped it is a piece too big to scoop, hook it. */
function hookTow(next, cid, dx, dy) {
  const at = cartCells(next, cid)[0];
  if (!at) return;
  const ahead = [at[0] + dx, at[1] + dy];
  if (!inGrid(next, ...ahead)) return;
  const c = cell(next, ...ahead);
  if (!isMultiCell(c.o) || holdersOf(next, ...ahead).length) return;
  const f = gripAxis(next, ...at);
  if (!f) return;
  cell(next, ...at).grip = dx * f[0] + dy * f[1];
}

/** A tow is rigid: barrow and load move together, or the shove is refused. */
/**
 * A tow, or the hold breaking. The board is re-asked with the link cut rather than the shove
 * being written a second time, so what follows is an ordinary shove and every branch that
 * handles one already handles this.
 *
 * Only a FIELD is cut. Cutting a barrow's is a move it undoes itself: a barrow shoved at
 * something too big to scoop takes hold, so the re-asked board hands it the same couch back on
 * the same beat and nothing has happened. Whether a blocked hook should let go and stay let go is
 * a question about the barrow, and it is open.
 */
function towOrBreak(s, at, dir, dx, dy, done, opts) {
  const towed = towMove(s, at, dx, dy, done);
  if (towed.ok) return towed;
  const own = complexCells(s, at);
  if (!own.some(([x, y]) => isMagnet(cell(s, x, y).o))) return towed;
  const freed = cloneState(s);
  for (const [x, y] of own) cell(freed, x, y).grip = undefined;
  return decide(freed, dir, opts);
}

function towMove(s, at, dx, dy, done) {
  const own = complexCells(s, at);
  const ownSet = new Set(own.map(([x, y]) => `${x},${y}`));
  const blame = own.map(([x, y]) => [x + dx, y + dy])
    .filter(([x, y]) => !ownSet.has(`${x},${y}`) && !travelsInto(s, x, y, dx, dy));
  if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };
  const next = cloneState(s);
  const was = own.map(([x, y]) => ({ ...cell(s, x, y) }));
  for (const [x, y] of own) {
    const c = cell(next, x, y);
    c.o = NONE; c.hold = undefined; c.pid = undefined;
    c.cart = undefined; c.ck = undefined; c.grip = undefined;
  }
  own.forEach(([x, y], i) => {
    const c = cell(next, x + dx, y + dy);
    c.o = was[i].o; c.hold = was[i].hold; c.pid = was[i].pid;
    c.cart = was[i].cart; c.ck = was[i].ck; c.grip = was[i].grip;
  });
  next.rac = { x: s.rac.x + dx, y: s.rac.y + dy };
  // A link holds whatever the field caught, and the account names it the way the rest of the game
  // does: a cart or a multi-cell piece by its id, and everything else — the magnet itself, a can,
  // a wheelie, a shut cabinet — as the occupant it is. Named by neither, a tow is a beat in which
  // the board moves and nothing on screen does.
  const bodies = [], moved = [];
  for (const [x, y] of own) {
    const c = cell(s, x, y);
    if (c.cart !== undefined) {
      if (!bodies.some(b => b.kind === 'cart' && b.ref === c.cart))
        bodies.push({ kind: 'cart', ref: c.cart, dx, dy });
    } else if (c.pid !== undefined) {
      if (!bodies.some(b => b.kind === 'furniture' && b.ref === c.pid))
        bodies.push({ kind: 'furniture', ref: c.pid, dx, dy });
    } else {
      moved.push({ o: c.o, from: [x, y], to: [x + dx, y + dy] });
    }
  }
  return done(next, PUSH, mkStep({ piece: bodies, moved }));
}

/**
 * The blow that opens a cabinet, written once and reached two ways: the raccoon's own shove, and
 * anything that comes to rest against its back. Struck there, the shut cabinet is swapped for the
 * two-cell piece it becomes — it does not slide, and whatever struck it stops, because a cabinet
 * is not a thing that rolls.
 *
 * `next` is a board the caller has already cloned and `step` a step it owns, because the impact
 * path is a loop over several cells of one beat. `clears` is the raccoon's: the drawer comes out
 * along the line the blow travelled and shoves what is in the way one cell on, which an impact
 * does not buy. Returns the cell to blame when it cannot open, and null when it did.
 */
function openInPlace(next, at, step, clears) {
  const o = cell(next, ...at).o;
  const f = DIRS[cabinetFace(o)];
  const draw = [at[0] + f[0], at[1] + f[1]];
  if (!travelsInto(next, ...draw, f[0], f[1])) {
    if (!clears) return draw;
    const past = [draw[0] + f[0], draw[1] + f[1]];
    const inWay = inGrid(next, ...draw) ? cell(next, ...draw) : null;
    if (!inWay || inWay.o === NONE || isHalfOfABody(next, ...draw)
        || !travelsInto(next, ...past, f[0], f[1])) return draw;
    const shoved = inWay.o;
    cell(next, ...draw).o = NONE;
    drop(next, past, [shoved]);
    step.moved.push({ o: shoved, from: draw, to: past });
  }
  // The shut cabinet is gone and a body stands where it and its drawer are: two pieces, not one
  // that grew. `freePid` rather than a count, or the new piece is welded to an old one.
  const open = CAB_OPENS[o], pid = freePid(next);
  for (const p of [at, draw]) { const c = cell(next, ...p); c.o = open; c.pid = pid; }
  step.gone.push({ o, cells: [at] });
  step.spawned.push({ kind: 'furniture', ref: pid, o: open,
                      cells: rasterOrder([at, draw]), from: at });
  return null;
}

/** Board cells in the order a stage reads them, which is where a body's anchor comes from. */
export const rasterOrder = cells => [...cells].sort((a, b) => a[1] - b[1] || a[0] - b[0]);

/**
 * Both ways an open cabinet shuts. The piece is destroyed and a shut cabinet is put down on `at`:
 * its own body cell when it closes where it stands, the drawer's cell when it folds in and the
 * body advances into it. `travel` is what the piece does on the way out, which is nothing at all
 * in the first case; the raccoon takes the cell he shoved into either way.
 */
function shutCabinet(s, own, at, shut, [px, py], dx, dy, done) {
  const next = cloneState(s);
  const pid = cell(s, ...own[0]).pid;
  for (const [x, y] of own) { const c = cell(next, x, y); c.o = NONE; c.pid = undefined; }
  // Through `drop`, not straight into the cell: a body spans a hole and one cell does not, so
  // folding back to one cell over a grate is a cabinet standing on nothing.
  const effect = effectOf(cell(next, ...at), shut);
  drop(next, at, [shut]);
  next.rac = { x: s.rac.x + dx, y: s.rac.y + dy };
  return done(next, PUSH, mkStep({
    piece: [{ kind: 'furniture', ref: pid, dx: px, dy: py, effect: 'swaps' }],
    spawned: [{ o: shut, cells: [at], from: own[0], effect }],
  }));
}

function openCabinet(s, at, done) {
  const next = cloneState(s);
  const step = mkStep();
  const blame = openInPlace(next, at, step, true);
  if (blame) return { ok: false, reason: reasonFor(s, [blame], 'canRoom'), blame: [blame] };
  return done(next, PUSH, step);
}

/**
 * A travelling thing has come to rest against `at`. If what is standing there is a shut cabinet
 * taking the blow on its BACK, the drawer shoots out — the raccoon's own shove is not special,
 * a rolling tyre and a swept line knock it open the same way.
 *
 * Nothing else happens: the cabinet does not move and the thing that struck it stops, because a
 * cabinet is not a thing that rolls. And the drawer needs somewhere to go — with no room it
 * stays shut, so an impact can never do what a shove would have been refused for.
 */
function strikeBack(next, at, dx, dy, step) {
  if (!inGrid(next, ...at)) return;
  // A heavy thing takes the blow without going anywhere: the board is unchanged, so the solver
  // never sees this and it costs nothing in the state graph — but the stage has to be told, or a
  // knock that visibly does nothing reads as the game ignoring the press.
  const c = cell(next, ...at);
  if (isCart(c) && isHeavyCart(next, c.cart)) {
    if (step) step.piece.push(
      { kind: 'cart', ref: c.cart, dx: 0, dy: 0, effect: 'rattles', blow: [dx, dy] });
    return;
  }
  const o = c.o;
  if (!isCabinetClosed(o)) return;
  const f = DIRS[cabinetFace(o)];
  if (dx !== f[0] || dy !== f[1]) return;
  openInPlace(next, at, step ?? mkStep(), false);
}

/**
 * `tail` is a run of touching things flush BEHIND the cart, closest first, which the same shove
 * is driving. They travel with it cell for cell: a run of touching things is one thing to push,
 * and a press that moved something across the room while the raccoon stood still would read as a
 * dropped input rather than as a shove.
 */
function shoveCart(s, cid, entry, dx, dy, trace, tail = []) {
  const kind = cartKindOf(cell(s, ...entry));
  const barrow = isBarrow(kind);
  // WEIGHT, read once here and not again. A cart carrying objects is heavy and moves one cell;
  // empty, it is light and rolls. Reading it per beat instead would turn the cart into a barrow:
  // it would start light, take in the first thing it passed, go heavy mid-roll and stop, which is
  // one item per shove and leaves the two pieces with no difference worth a code.
  const heavy = isHeavyCart(s, cid);
  // A barrow is AIMED where a cart is open-mouthed, and that is the whole difference between
  // them. A cart keeps its mouth open for the length of its roll. A barrow takes in only what it
  // was ALREADY touching when the shove began, only along its facing, and only while empty — so
  // a barrow does one thing per shove, and never a corridor's worth of both.
  //
  // Shoved the other way along its line it still rolls, but with nothing to take things in
  // with, so whatever it meets stops it.
  const swallows = !barrow || (barrowScoops(kind, dx, dy) && !heavy);
  const at = (p, k) => [p[0] + k * dx, p[1] + k * dy];
  const isOwn = (x, y) => inGrid(s, x, y) && cell(s, x, y).cart === cid;
  const files = cartCells(s, cid).filter(([x, y]) => !isOwn(x + dx, y + dy))   // lead cells
    .map(lead => {
      const f = [];
      for (let p = lead; isOwn(...p); p = at(p, -1)) f.push(p);
      return f;                                                  // [lead, ..., trail]
    });
  const aheadAt = k => files.map(f => at(f[0], k + 1));

  // Two ways the first beat can be refused: nowhere to roll, or a load that would be pushed
  // out by the swallow with nowhere to shed. Past the first beat the same condition just
  // stops the cart, which is an ordinary way for a roll to end rather than a refusal.
  const first = aheadAt(0);
  const blame = first.filter(([x, y]) => !cartCanEnter(s, x, y, dx, dy, swallows));
  // A cart rolled up against the back of a shut cabinet knocks it open, and stops there. The
  // blow is the whole of the beat, so nothing else on the cart moves.
  if (blame.length) {
    const knocked = cloneState(s);
    const step = mkStep();
    for (const at of blame) strikeBack(knocked, at, dx, dy, step);
    if (step.moved.length || step.spawned.some(isBodyEvent) || step.piece.length)
      return { ok: true, kind: PUSH, next: knocked,
               ...(trace && (f => ({ frames: f, steps: settleSteps(f, [step]) }))([cloneState(s), knocked])) };
  }
  if (!blame.length) files.forEach((f, i) => {
    const back = f[f.length - 1], out = cell(s, ...back).o;
    if (out === NONE || cell(s, ...first[i]).o === NONE) return;
    if (!tipFits(s, out, back, -dx, -dy)) blame.push(tipsInto(out, back, -dx, -dy));
  });
  // Heavy and going nowhere, a SKATEBOARD slops one item out the back rather than refusing: shove it
  // at a wall and the load comes off, which is the only way a cart is emptied deliberately. Never
  // out of the file the raccoon is pushing — he is standing exactly where it would land — so a
  // cart pinned with nothing free behind either file is genuinely stuck.
  //
  // A barrow has no such shed. Shoved along its line there is no unambiguous side to dump toward,
  // and shoved across it the raccoon is where the load would go; what a barrow scooped stays in
  // it until it is tipped, which is the whole of what scooping buys over a cart.
  if (blame.length && heavy && !barrow) {
    const next = cloneState(s);
    const step = mkStep();
    for (const f of files) {
      const tail = f[f.length - 1];
      const out = chainOf(cell(next, ...tail));
      const behind = at(tail, -1);
      if (!out.length || (behind[0] === s.rac.x && behind[1] === s.rac.y)) continue;
      if (!isOccupiable(next, ...behind) || !tipFits(next, out[0], behind, -dx, -dy)) continue;
      setChain(cell(next, ...tail), []);
      step.moved.push({
        o: out[0], from: tail, to: behind, parent: null,
        effect: effectOf(cell(next, ...behind), out[0]),
        ...(landsAs(out[0]) !== out[0] && { becomes: landsAs(out[0]) }),
      });
      land(next, behind, out, step, step.moved[step.moved.length - 1]);
      tipOut(next, out[0], behind, -dx, -dy, step);
    }                       // one per FILE, the way every other shed in the game is counted
    if (step.moved.length)
      return { ok: true, kind: PUSH, next,
               ...(trace && (f => ({ frames: f, steps: settleSteps(f, [step]) }))([cloneState(s), next])) };
  }
  if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };

  const next = cloneState(s);
  const frames = trace ? [cloneState(s)] : null;
  const steps = trace ? [] : null;
  // A slot holds a CHAIN, not an occupant: what is in it may be a barrow, and that barrow may
  // be holding something. The whole chain rides in the slot and is shifted, shed and set down
  // as one, which is what makes a loaded barrow no different from a can to everything below.
  const loads = files.map(f => f.map(([x, y]) => ({ ch: chainOf(cell(s, x, y)) })));
  const repaint = (k, from) => files.forEach((f, i) => f.forEach((p, j) => {
    const c = cell(next, ...at(p, from));
    setChain(c, []); c.cart = undefined; c.ck = undefined;
    // The kind travels with the cart. Without it a barrow becomes an ordinary cart the moment it
    // moves — and `stateKey` would then key two different boards alike.
    const d = cell(next, ...at(p, k)); d.cart = cid; d.ck = kind; setChain(d, loads[i][j].ch);
  }));

  let n = 0, lastRoll = -1, stoppedAt = null;
  for (;;) {
    const ahead = aheadAt(n);
    // The cell a swallow pushes the old load back onto is one the cart is vacating this beat,
    // so only the cell that load would shed into has to be free.
    const canShed = i => {
      const load = loads[i], out = load[load.length - 1];
      if (!out.ch.length) return true;
      return tipFits(next, out.ch[0], at(files[i][load.length - 1], n), -dx, -dy);
    };
    // Only the first beat has a mouth. Past it a barrow meets things rather than taking them,
    // which is what stops a roll turning into a cascade of scoops.
    const mouth = swallows && (!barrow || n === 0);
    const clear = ahead.every(([x, y]) => cartCanEnter(next, x, y, dx, dy, mouth))
      && !files.some(f => isTar(cell(next, ...at(f[0], n))));
    const incoming = clear ? ahead.map(([x, y]) => cargoAt(next, x, y)) : ahead.map(() => []);
    // Which of them were CARTS before they were cargo. The stage holds a cart sprite for those,
    // so the step has to say which one turned into what rather than naming an occupant sprite
    // that does not exist yet.
    const wasCart = ahead.map(([x, y]) => (clear && isScoopable(next, x, y) ? cell(next, x, y).cart : undefined));
    const rolling = clear && files.every((f, i) => !incoming[i].length || canShed(i));
    const taken = rolling ? incoming : ahead.map(() => []);
    const end = rolling ? n + 1 : n;              // where the cart stands once this step is over
    const step = trace ? mkStep(rolling ? { piece: [{ kind: 'cart', ref: cid, dx, dy }] } : {}) : null;
    const spill = [];

    files.forEach((f, i) => {
      if (rolling && !taken[i].length) return;
      // A cart that stops rolling pushes its load out the back. A barrow does not: what it
      // scooped stays in it until it is tipped, which is the whole of what scooping buys.
      if (!rolling && isBarrow(kind)) return;
      const load = loads[i], depth = load.length, out = load[depth - 1];
      const behind = at(f[depth - 1], end - 1);
      if (!rolling && out.ch.length
          && (!isOccupiable(next, ...behind) || !tipFits(next, out.ch[0], behind, -dx, -dy))) return;

      for (let j = depth - 1; j > 0; j--) {
        const it = load[j] = load[j - 1];
        // A slot shift moves the whole stack in it, and moves it as it stands: each thing comes
        // to rest exactly as deep in the next slot as it was in this one.
        if (step) it.ch.forEach((o, k) => step.moved.push({
          o, from: at(f[j - 1], n), to: at(f[j], end), parent: cid, depth: k,
        }));
      }
      load[0] = { ch: taken[i] };
      if (step && taken[i].length) {
        step.moved.push({ o: taken[i][0], from: ahead[i], to: at(f[0], end), parent: cid, depth: 0,
                          ...(wasCart[i] !== undefined && { fromCart: wasCart[i] }) });
        // A barrow taken aboard brings its load, and the load comes aboard one level deeper than
        // it was: it was standing in that barrow, and now the barrow is standing in this one.
        for (let k = 1; k < taken[i].length; k++)
          step.moved.push({ o: taken[i][k], from: ahead[i], to: at(f[0], end), parent: cid,
                            wasDepth: wasCart[i] !== undefined ? k - 1 : k, depth: k });
      }
      if (out.ch.length) {
        if (step) step.moved.push({
          o: out.ch[0], from: at(f[depth - 1], n), to: behind, parent: null,
          effect: effectOf(cell(next, ...behind), out.ch[0]),
          ...(landsAs(out.ch[0]) !== out.ch[0] && { becomes: landsAs(out.ch[0]) }),
        });
        spill.push([behind, out.ch]);
      }
    });

    repaint(end, n);
    // Front of the run first, so each one moves into the cell the thing ahead of it just left.
    if (rolling) for (const c of tail) {
      const from = at(c, n), to = at(c, end);
      const o = cell(next, ...from).o;
      cell(next, ...from).o = NONE;
      cell(next, ...to).o = o;
      if (step) step.moved.push({ o, from, to });
    }
    n = end;
    for (const [[x, y], ch] of spill) {
      const m = step && step.moved.find(e => e.o === ch[0] && e.to[0] === x && e.to[1] === y);
      land(next, [x, y], ch, step, m);
      tipOut(next, ch[0], [x, y], -dx, -dy, step);
    }
    if (trace && (rolling || step.moved.length)) {
      frames.push(cloneState(next)); steps.push(step);
      if (rolling) lastRoll = steps.length - 1;
    }
    if (!rolling) { stoppedAt = ahead; break; }
    // A heavy thing has moved its one cell, and a barrow has done its one thing. Nothing stopped
    // either of them, so nothing wears a blow. Grease is the exception it always is: on a slick a
    // thing keeps going, whatever it weighs.
    const slick = files.some(f => isGrease(cell(next, ...at(f[0], n))));
    if (!slick && (heavy || (barrow && taken.some(ch => ch.length)))) break;
  }
  if (trace && lastRoll >= 0) steps[lastRoll].impact = true;

  // What the roll finally came up against wears the blow, wherever along the run it stopped.
  const blow = mkStep();
  for (const at of stoppedAt ?? []) strikeBack(next, at, dx, dy, blow);
  if (trace && (blow.moved.length || blow.spawned.some(isBodyEvent) || blow.piece.length)) {
    frames.push(cloneState(next)); steps.push(blow);
  }

  // Behind a run, he steps into the cell its rearmost member left; behind the cart itself, into
  // the cart's own. Either way he follows only if the thing in front of him actually went.
  const racTo = tail.length ? [s.rac.x + dx, s.rac.y + dy] : entry;
  next.rac = isClearFloor(next, ...racTo) ? { x: racTo[0], y: racTo[1] } : { ...s.rac };
  if (trace) for (let k = 1; k < frames.length; k++) frames[k].rac = { ...next.rac };

  return trace ? { ok: true, kind: PUSH, next, frames, steps: settleSteps(frames, steps) } : { ok: true, kind: PUSH, next };
}

/**
 * Explain what direction `dir` does from the current state — without applying it.
 * Returns { ok:true, kind, next } or { ok:false, reason, blame:[[x,y]...] }.
 * `blame` is the cell list the UI paints red: exactly the cells that forbid the action.
 * Every caller — step, solver, renderer — goes through here.
 *
 * `opts.trace` adds `frames` and `steps`. Opt-in: it costs a clone per step, and `analyze()`
 * walks the whole state graph wanting nothing but the last board.
 */
/**
 * The action, and then the board settling. `decide` answers what the shove does; every magnet on
 * the board is asked again afterwards, because a field holds what is in it whether or not the
 * magnet was the thing that moved.
 */
export function explain(s, dir, opts = {}) {
  const r = decide(s, dir, opts);
  if (!r.ok) return r;
  let found = false;
  for (let y = 0; y < r.next.rows && !found; y++)
    for (let x = 0; x < r.next.cols && !found; x++) found = isMagnet(cell(r.next, x, y).o);
  if (!found) return r;
  // A walk SHARES the board it came from, and a traced action has already handed out its last
  // frame — either way the sweep writes to a copy or it writes to a board somebody else holds.
  const next = opts.trace || r.next.cells === s.cells ? cloneState(r.next) : r.next;
  const step = mkStep();
  if (!settleMagnets(next, step)) return r;
  return opts.trace
    ? (f => ({ ...r, next, frames: f, steps: settleSteps(f, [...r.steps, step]) }))([...r.frames, next])
    : { ...r, next };
}

function decide(s, dir, opts) {
  const d = DIRS[dir];
  if (!d) throw new Error(`unknown direction: ${dir}`);
  const [dx, dy] = d;
  const x = s.rac.x, y = s.rac.y, tx = x + dx, ty = y + dy;

  if (!inGrid(s, tx, ty)) return { ok: false, reason: 'edge', blame: [] };
  const target = cell(s, tx, ty);
  if (target.wall) return { ok: false, reason: 'wall', blame: [[tx, ty]] };

  // One board pair, one step. Anything with more to report builds its own.
  const done = (next, kind, step) => opts.trace
    ? (f => ({ ok: true, kind, next, frames: f, steps: settleSteps(f, [step]) }))([cloneState(s), next])
    : { ok: true, kind, next };

  // Only the raccoon moves, and he rides on `rac` — so the board the step lands on is the board
  // it started from, and the new state SHARES it rather than copying it. Sound because every
  // path in here that writes to a board calls `cloneState` first and writes to that; a shared
  // board is never the one being written. Worth doing because walking is most of what a state
  // graph is made of: the solver generates one of these per free direction per state, and
  // copying a cell object per cell for a step that changes no cell was the tool chain's
  // largest single cost, in allocation and then again in collection.
  const stepOnto = () =>
    done({ cols: s.cols, rows: s.rows, cells: s.cells, rac: { x: tx, y: ty } }, MOVE, mkStep());

  if (target.water && !isRoller(target)) return { ok: false, reason: 'water', blame: [[tx, ty]] };

  // Three gates ahead of every branch, so none of them can forget one. He may not stand on
  // broken glass, which also means he cannot shove what is standing on it; a one-way admits
  // only its own direction; and tar keeps what it has.
  if (isGlass(target)) return { ok: false, reason: 'glass', blame: [[tx, ty]] };
  if (!mayEnter(s, tx, ty, dx, dy)) return { ok: false, reason: 'oneway', blame: [[tx, ty]] };
  if (target.o !== NONE || isCart(target)) {
    if (stuckInTar(s, tx, ty)) return { ok: false, reason: 'tar', blame: [[tx, ty]] };
  }

  // A cart cell carries its cargo in `o`, so cart-ness is read before the occupant is.
  if (isCart(target)) {
    const kind = cartKindOf(target);
    // Across its axis a barrow tips: it goes one cell and its load carries on one further,
    // which is the recycle bin's shape exactly — the dump is a shed, not a new mechanic.
    if (isBarrow(kind) && !barrowRollsAlong(kind, dx, dy)) {
      const to = [tx + dx, ty + dy], out = [to[0] + dx, to[1] + dy];
      // Whatever was in it goes over the front as one — a barrow it was carrying lands as a
      // barrow, still holding what IT was holding.
      const load = chainOf(target);
      if (!travelsInto(s, ...to, dx, dy))
        return { ok: false, reason: reasonFor(s, [to], 'canRoom'), blame: [to] };
      if (load.length && !travelsInto(s, ...out, dx, dy))
        return { ok: false, reason: reasonFor(s, [out], 'canRoom'), blame: [out] };
      if (load.length && !tipFits(s, load[0], out, dx, dy))
        return { ok: false, reason: reasonFor(s, [tipsInto(load[0], out, dx, dy)], 'canRoom'),
                 blame: [tipsInto(load[0], out, dx, dy)] };
      const next = cloneState(s);
      const step = mkStep();
      // Tipping lets go of whatever it was towing: the barrow turns out from under the load.
      cell(next, tx, ty).grip = undefined;
      cell(next, tx, ty).cart = undefined; cell(next, tx, ty).ck = undefined;
      setChain(cell(next, tx, ty), []);
      const landed = cell(next, ...to);
      landed.cart = target.cart; landed.ck = kind; setChain(landed, []);
      // The barrow is a BODY. Naming it in `moved` names an occupant sprite of code NONE, which
      // the stage does not hold and cannot animate.
      step.piece = [{ kind: 'cart', ref: target.cart, dx, dy }];
      if (load.length) {
        const m = { o: load[0], from: [tx, ty], to: out, parent: null,
          effect: effectOf(cell(next, ...out), load[0]),
          ...(landsAs(load[0]) !== load[0] && { becomes: landsAs(load[0]) }) };
        step.moved.push(m);
        land(next, out, load, step, m);
        tipOut(next, load[0], out, dx, dy, step);
      }
      next.rac = isClearFloor(next, tx, ty) ? { x: tx, y: ty } : { ...s.rac };
      return done(next, PUSH, step);
    }
    // Already towing: the pair is rigid while it can travel, and the hold breaks when it cannot.
    if (inAHold(s, tx, ty)) return towOrBreak(s, [tx, ty], dir, dx, dy, done, opts);

    // Shoved straight at something too big to scoop, the barrow hooks on rather than refusing.
    // The shove is spent taking hold, which is the same beat a scoop costs.
    if (isBarrow(kind)) {
      const ahead = [tx + dx, ty + dy];
      if (inGrid(s, ...ahead) && isMultiCell(cell(s, ...ahead).o)
          && !holdersOf(s, ...ahead).length) {
        const next = cloneState(s);
        const f = gripAxis(next, tx, ty);
        if (f) {
          cell(next, tx, ty).grip = dx * f[0] + dy * f[1];
          return done(next, PUSH, mkStep());
        }
      }
    }

    const res = shoveCart(s, target.cart, [tx, ty], dx, dy, opts.trace === true);
    // A barrow that rolls up against something too big to scoop HOOKS it instead. One cell
    // cannot swallow a couch, and the barrow is the handle rather than the container.
    if (res.ok && isBarrow(kind)) hookTow(res.next, target.cart, dx, dy);
    return res;
  }

  const o = target.o;

  if (o === NONE) return stepOnto();

  if (o === TRASH) return { ok: false, reason: 'trash', blame: [[tx, ty]] };

  if (o === BAG) {
    const blockers = fanBlockers(s, tx, ty, dx, dy);
    if (blockers.length) return { ok: false, reason: reasonFor(s, blockers, 'fan'), blame: blockers };
    const next = cloneState(s);
    const step = mkStep({ gone: [{ o: BAG, cells: [[tx, ty]] }] });
    // Chairs clear out before anything is laid down, so the trash lands on the cells they left.
    // This is the whole of what the chair changes: the fan stops being only a cost and becomes
    // something you can aim.
    for (const [fx, fy] of fan(tx, ty, dx, dy)) {
      if (!inGrid(s, fx, fy) || cell(s, fx, fy).o !== CHAIR) continue;
      const to = chairFlees(s, tx, ty, dx, dy, fx, fy);
      cell(next, fx, fy).o = NONE;
      if (!isGrate(cell(next, ...to))) cell(next, ...to).o = CHAIR;
      step.moved.push({ o: CHAIR, from: [fx, fy], to });
    }
    for (const [fx, fy] of fan(tx, ty, dx, dy)) {
      const c = cell(next, fx, fy);
      // one origin for the whole fan
      step.spawned.push({ o: TRASH, cells: [[fx, fy]], from: [tx, ty], effect: effectOf(c, TRASH) });
      layTrash(c);
    }
    cell(next, tx, ty).o = NONE;
    next.rac = { x: tx, y: ty };
    return done(next, TEAR, step);
  }

  // A pane goes where a shove sends it only in the sense that it BREAKS there. It needs the
  // cell beyond free to break into — so it is protected by being boxed in, and broken by being
  // given room, which is the opposite of every other piece on the board.
  if (o === PANE) {
    const c1 = [tx + dx, ty + dy];
    if (!isOccupiable(s, ...c1) || !mayEnter(s, ...c1, dx, dy) || cell(s, ...c1).water)
      return { ok: false, reason: reasonFor(s, [c1], 'canRoom'), blame: [c1] };
    const next = cloneState(s);
    cell(next, tx, ty).o = NONE;
    const target1 = cell(next, ...c1);
    if (!isGrate(target1)) target1.ter = GLASS;
    next.rac = { x: tx, y: ty };
    return done(next, PUSH, mkStep({
      gone: [{ o: PANE, cells: [[tx, ty]] }],
      spawned: [{ o: NONE, cells: [c1], from: [tx, ty], effect: 'shatters' }],
    }));
  }

  // Shoved from the far side, anything held drags its holder along behind it — a towed couch
  // takes its barrow, a chained can takes its magnet. That is the board pulling, not the
  // raccoon, which is the one place pulling was ever allowed. The magnet itself is exempt: a
  // shove on IT is an ordinary shove, and what it holds follows after.
  if (inAHold(s, tx, ty) && !isMagnet(o)) return towOrBreak(s, [tx, ty], dir, dx, dy, done, opts);

  // An open cabinet shuts two ways, and both are the same swap: the piece is destroyed and a shut
  // cabinet is put down. Shoved on the DRAWER toward the body it closes where it stands. Driven
  // drawer-first into something that will not take the drawer it FOLDS IN, and the body carries
  // on into the cell the drawer was filling. Anything else is an ordinary body shove, below.
  if (isCabinetOpen(o)) {
    const { own, body, draw, f } = cabinetEnds(s, target.pid);
    const onDrawer = tx === draw[0] && ty === draw[1];
    if (onDrawer && dx === -f[0] && dy === -f[1])
      return shutCabinet(s, own, body, CAB_SHUTS[o], [0, 0], dx, dy, done);
    if (dx === f[0] && dy === f[1] && !travelsInto(s, draw[0] + dx, draw[1] + dy, dx, dy))
      return shutCabinet(s, own, draw, CAB_SHUTS[o], [dx, dy], dx, dy, done);
  }

  if (isMultiCell(o)) {
    const own = pieceCells(s, target.pid);
    const ownSet = new Set(own.map(([x, y]) => `${x},${y}`));
    const clearAt = k => own.map(([x, y]) => [x + k * dx, y + k * dy])
      .filter(([x, y]) => !ownSet.has(`${x},${y}`) && !travelsInto(s, x, y, dx, dy));
    const blame = clearAt(1);
    if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };

    // The end that goes first, and the only cell either kind of travel asks about: what the roll
    // hands off to, and what the slick is under. Read off the footprint against the shove, so a
    // body has a leading end without storing which end that is.
    const lead = own.reduce((a, b) => (a[0] * dx + a[1] * dy >= b[0] * dx + b[1] * dy ? a : b));

    // Shoved the way it rolls a body travels; shoved the other way it shifts one cell, like the
    // couch it otherwise is. Nothing stores the axis — it is whatever the footprint already says.
    //
    // Grease is the other way it travels, and it is not about rolling: the lane beats weight, and
    // a body is the heaviest thing there is. What decides is the LEADING cell — the end taking
    // the shove is the end that skates, and asking the whole footprint would mean a long body
    // needs a lane longer than itself before the slick did anything for it.
    let k = 1;
    const rolls = rollsBody(o, own, dx, dy);
    const travels = () => rolls || isGrease(cell(s, lead[0] + k * dx, lead[1] + k * dy));
    while (travels() && !clearAt(k + 1).length) {
      k++;
      const front = own.map(([x, y]) => cell(s, x + k * dx, y + k * dy));
      if (front.some(c => isTar(c) || isGrate(c))) break;
    }

    const next = cloneState(s);
    const step = mkStep();
    // `= undefined`, not `delete`: deleting a property drops the cell into dictionary mode and
    // every clone and key of every state descended from this one pays for it.
    for (const [x, y] of own) { const c = cell(next, x, y); c.o = NONE; c.pid = undefined; }
    // A grate takes the piece only when the whole of it fits inside one; a longer thing spans it.
    const landed = own.map(([x, y]) => [x + k * dx, y + k * dy]);
    const swallowed = landed.every(([x, y]) => isGrate(cell(next, x, y)));
    if (!swallowed) for (const [x, y] of landed) {
      const c = cell(next, x, y);
      c.o = o; c.pid = target.pid;
    }
    // The same hand-off every roller gets, and each end asks it of its own footprint: what takes
    // the roll is whatever rolls THIS way, and what does not is simply what the roller stops
    // against. A rug and a bicycle roll on opposite axes, so the pair that hands off is the pair
    // lying across each other.
    const passed = ROLL_AXIS.has(o)
      ? handOff(next, [lead[0] + (k + 1) * dx, lead[1] + (k + 1) * dy], dx, dy, step)
      : { moved: [], bodies: [] };
    next.rac = isClearFloor(next, tx, ty) ? { x: tx, y: ty } : { ...s.rac };
    // The whole roll in one beat, so the body's own entry carries the whole distance.
    step.piece = [{ kind: 'furniture', ref: target.pid, dx: k * dx, dy: k * dy,
                   ...(swallowed && { effect: 'falls' }) }, ...passed.bodies,
                  ...step.piece];
    step.moved.push(...passed.moved);
    return done(next, PUSH, step);
  }

  if (rollsAlong(target, dx, dy)) {
    // Rollers already touching are one thing to shove, so the unit that moves is the whole
    // contiguous run — which also makes the run maximal, and that is what gives IMPACT a
    // meaning: the cell ahead of a maximal train never holds a roller until travel closes a gap.
    const train = [];
    for (let p = [tx, ty]; inGrid(s, ...p) && rollsAlong(cell(s, ...p), dx, dy); p = [p[0] + dx, p[1] + dy])
      train.push(p);
    const lead = train[train.length - 1];

    let k = 0;
    while (travelsInto(s, lead[0] + (k + 1) * dx, lead[1] + (k + 1) * dy, dx, dy)) {
      k++;
      const c = cell(s, lead[0] + k * dx, lead[1] + k * dy);
      if (isTar(c) || isGrate(c)) break;                 // entered, and then held or fallen through
    }
    if (k === 0) {
      // Flush against a cart, the shove reaches THROUGH the run and the cart is what moves — a
      // run of touching things is one thing to push. It goes to the same mover the raccoon's own
      // shove uses, so weight, swallowing and shedding cannot come out differently for having
      // arrived down a train. The shove is spent reaching it: nothing in the train travels, and
      // he does not follow.
      const ahead = [lead[0] + dx, lead[1] + dy];
      if (inGrid(s, ...ahead) && isCart(cell(s, ...ahead))) {
        // `train` runs rear-first; the cart wants it closest-first.
        const r = shoveCart(s, cell(s, ...ahead).cart, ahead, dx, dy, opts.trace,
                            [...train].reverse());
        if (r.ok) return r;
      }
      const stop = [[lead[0] + dx, lead[1] + dy]];
      return { ok: false, reason: reasonFor(s, stop, 'canRoom'), blame: stop };
    }

    // The rearmost is the only one with a free cell behind it — every other has its neighbour
    // there — so it is the only one that can shed. Same shape as a line of containers.
    const rear = train[0];
    const backOf = ([x, y]) => [x + (k - 1) * dx, y + (k - 1) * dy];
    const rearIsWheelie = cell(s, ...rear).o === WHEELIE;
    const back = rearIsWheelie ? backOf(rear) : null;

    const rolled = cloneState(s);
    for (const [x, y] of train) cell(rolled, x, y).o = NONE;
    const swallowed = [];
    for (const [x, y] of train) {
      const to = [x + k * dx, y + k * dy];
      if (isGrate(cell(rolled, ...to))) { swallowed.push([[x, y], cell(s, x, y).o]); continue; }
      cell(rolled, ...to).o = cell(s, x, y).o;
    }
    // Tested against `rolled`: on a one-cell roll this cell is the bin's own start.
    if (back && !swallowed.length && !isOccupiable(rolled, back[0], back[1]))
      return { ok: false, reason: reasonFor(s, [back], 'canRoom'), blame: [back] };

    const next = opts.trace ? cloneState(rolled) : rolled;
    const shedAt = back && !swallowed.length ? back : null;
    if (shedAt) {
      cell(next, rear[0] + k * dx, rear[1] + k * dy).o = WHEELIE_EMPTY;
      drop(next, shedAt, [BAG]);
    }

    // IMPACT. The train stopped; if what stopped it rolls, the motion carries on into it and
    // the train stays put. One rule, applied until nothing is left rolling — every hand-off
    // goes strictly forward, so a cascade is a straight run and cannot fail to end.
    const strike = mkStep();
    const passedTo = handOff(next, [lead[0] + (k + 1) * dx, lead[1] + (k + 1) * dy], dx, dy, strike);

    next.rac = isClearFloor(next, tx, ty) ? { x: tx, y: ty } : { ...s.rac };
    if (!opts.trace) return { ok: true, kind: PUSH, next };

    const frames = [cloneState(s), rolled];
    const steps = [mkStep({
      // One entry each, swallowed or not: what the grate takes still TRAVELS to it, and `falls`
      // is the difference between arriving and then dropping through and never having gone.
      moved: train.map(([x, y]) => ({
        o: cell(s, x, y).o, from: [x, y], to: [x + k * dx, y + k * dy],
        ...(swallowed.some(([sc]) => sc[0] === x && sc[1] === y) && { effect: 'falls' }),
      })),
      impact: true,
    })];
    const struck = [...passedTo.bodies, ...strike.piece];
    // A body arriving and a thing leaving are asked for the same reason the rest of `strike` is: an impact that
    // only opened a cabinet moves nothing and names nothing, and the body it minted is then a
    // piece the stage was never told to build. The next step to reference it cannot find it.
    if (shedAt || passedTo.moved.length || struck.length
        || strike.moved.length || strike.spawned.some(isBodyEvent) || strike.gone.length) {
      frames.push(next);
      steps.push(mkStep({
        piece: struck,
        spawned: strike.spawned,
        gone: strike.gone,
        moved: [
          ...strike.moved,
          ...(shedAt ? [{ o: WHEELIE, from: [rear[0] + k * dx, rear[1] + k * dy],
                          to: [rear[0] + k * dx, rear[1] + k * dy], becomes: WHEELIE_EMPTY }] : []),
          ...passedTo.moved,
        ],
      }));
      if (shedAt) steps.at(-1).spawned.push(
        { o: BAG, cells: [shedAt], from: [rear[0] + k * dx, rear[1] + k * dy] });
    }
    for (let i = 1; i < frames.length; i++) frames[i].rac = { ...next.rac };
    return { ok: true, kind: PUSH, next, frames, steps: settleSteps(frames, steps) };
  }

  // A shut cabinet opens when it is struck on the BACK — the face opposite the drawer — and the
  // blow is spent opening it. The cabinet does not slide: it is not a rolling thing, and whatever
  // hit it stops there. Struck on any other face it is an ordinary shove, which is what its rows
  // in SLIDES give it, so nothing is written here for that case.
  if (isCabinetClosed(o)) {
    const f = DIRS[cabinetFace(o)];
    if (dx === f[0] && dy === f[1]) return openCabinet(s, [tx, ty], done);
  }

  // The broom takes the whole contiguous line ahead of it, of any kinds, one cell — and on
  // grease it takes the line the length of the slick. It is the ONLY thing that moves a bag
  // without bursting it, which is what gives broken glass anything to do.
  if (o === BROOM) {
    const line = [];
    for (let p = [tx, ty]; inGrid(s, ...p) && cell(s, ...p).o !== NONE
         && !isHalfOfABody(s, ...p) && !isCabinetClosed(cell(s, ...p).o); p = [p[0] + dx, p[1] + dy])
      line.push(p);
    const head = line[line.length - 1];
    const beyond = [head[0] + dx, head[1] + dy];
    if (!travelsInto(s, ...beyond, dx, dy)) {
      // Unless what is in the way is a shut cabinet taking the blow on its back. The line has
      // nowhere to go, so the sweep is spent knocking the drawer out.
      const knocked = cloneState(s);
      const step = mkStep();
      strikeBack(knocked, beyond, dx, dy, step);
      if (!step.spawned.some(isBodyEvent))
        return { ok: false, reason: reasonFor(s, [beyond], 'canRoom'), blame: [beyond] };
      return done(knocked, PUSH, step);
    }
    if (line.some(([x, y]) => stuckInTar(s, x, y)))
      return { ok: false, reason: 'tar', blame: line.filter(([x, y]) => isTar(cell(s, x, y))) };

    // How far the line goes. Off grease that is one cell; on it, the broom carries the whole
    // train to the end of the slick.
    let k = 1;
    while (isGrease(cell(s, tx + k * dx, ty + k * dy))
           && travelsInto(s, head[0] + (k + 1) * dx, head[1] + (k + 1) * dy, dx, dy)) {
      k++;
      const c = cell(s, head[0] + k * dx, head[1] + k * dy);
      if (isTar(c) || isGrate(c)) break;
    }

    // A bag anywhere but the head refuses to be swept onto glass: it would tear with the rest of
    // the line packed round it, and there is nowhere for a fan to go.
    for (let i = 0; i < line.length; i++) {
      const [x, y] = line[i];
      if (cell(s, x, y).o !== BAG || i === line.length - 1) continue;
      const to = cell(s, x + k * dx, y + k * dy);
      if (isGlass(to)) return { ok: false, reason: 'glass', blame: [[x + k * dx, y + k * dy]] };
    }

    const next = cloneState(s);
    const step = mkStep({ moved: [], gone: [] });
    let headMoved = null;
    for (const [x, y] of line) {
      const c = cell(next, x, y); c.o = NONE; c.hold = undefined; c.grip = undefined;
    }
    for (const [x, y] of [...line].reverse()) {
      const from = [x, y], to = [x + k * dx, y + k * dy];
      const what = cell(s, x, y).o;
      if (isGrate(cell(next, ...to))) { step.moved.push({ o: what, from, to, effect: 'falls' }); continue; }
      // A pane breaks into the space IN FRONT of it, which a line gives only to its head: every
      // other has its neighbour there, and a neighbour in front is what saves a pane from a
      // shove as well. Water is the landing that breaks nothing — there is no floor there to
      // leave glass on, and glass in the canal is what the shove refuses outright.
      if (what === PANE && isOccupiable(s, x + dx, y + dy) && !cell(s, ...to).water) {
        // It travels and is then gone, which a shoved pane cannot do — the raccoon is standing
        // where it would have to set off from. Swept, the space it breaks into is the space it
        // was going anyway.
        step.moved.push({ o: PANE, from, to });
        step.gone.push({ o: PANE, cells: [from] });
        cell(next, ...to).ter = GLASS;
        continue;
      }
      // A bag swept onto glass bursts where it lands, which only the head of a line can do.
      if (what === BAG && isGlass(cell(next, ...to))) {
        step.gone.push({ o: BAG, cells: [from] });
        for (const [fx, fy] of fan(to[0], to[1], dx, dy)) {
          if (!isOccupiable(next, fx, fy)) continue;
          step.spawned.push({ o: TRASH, cells: [[fx, fy]], from: to, effect: effectOf(cell(next, fx, fy), TRASH) });
          layTrash(cell(next, fx, fy));
        }
        continue;
      }
      // Everything the cell was carrying travels with it, not just the occupant code. A link
      // left behind belongs to whatever is standing there now, which is a different board.
      const c = cell(next, ...to);
      c.o = what; c.hold = cell(s, x, y).hold; c.grip = cell(s, x, y).grip;
      const m = { o: what, from, to };
      step.moved.push(m);
      if (x === head[0] && y === head[1]) headMoved = m;
    }
    // Only the head has a free cell beyond it; every other has its neighbour there, so the shed
    // rule needs no statement of its own.
    const headTo = [head[0] + k * dx, head[1] + k * dy];
    const headWas = cell(s, ...head).o;
    if (sheds(headWas) && cell(next, ...headTo).o === headWas
        && tipFits(next, headWas, headTo, dx, dy)) {
      tipOut(next, headWas, headTo, dx, dy, step);
      // The container empties as it lands, and the sprite is already drawn: without this it
      // keeps its old kind, and a can still drawn full beside the bag it just shed reads as
      // two bags.
      if (headMoved && landsAs(headWas) !== headWas) headMoved.becomes = landsAs(headWas);
    }
    next.rac = isClearFloor(next, tx, ty) ? { x: tx, y: ty } : { ...s.rac };
    return done(next, PUSH, step);
  }

  // One shape of shove for everything in SLIDES, so the clearance test lives in one place.
  if (SLIDES[o]) {
    const { slides, drops, pours } = SLIDES[o];
    const c1 = [tx + dx, ty + dy];
    const into = cartAt(s, c1);
    const blame = [];
    if (!canRest(s, c1[0], c1[1]) || !mayEnter(s, c1[0], c1[1], dx, dy)) blame.push(c1);

    // Where it actually stops. Off grease that is the cell it was shoved to; on grease it keeps
    // going, and every bill — the tip, the cart it lands in, the grate that takes it — is
    // settled where it comes to rest rather than where it was pushed.
    let at = c1;
    if (into === null && !blame.length && !SLIDES[o].soaks) {
      while (isGrease(cell(s, ...at)) && travelsInto(s, at[0] + dx, at[1] + dy, dx, dy)) {
        at = [at[0] + dx, at[1] + dy];
        if (isTar(cell(s, ...at)) || isGrate(cell(s, ...at))) break;
      }
    }
    const gone = into === null && !blame.length && isGrate(cell(s, ...at));
    const c2 = [at[0] + dx, at[1] + dy];
    const tips = into === null && !gone && (drops !== undefined || pours === true);

    if (tips && !tipFits(s, o, at, dx, dy)) blame.push(c2);
    let shove = null;
    if (into !== null && !blame.length) {
      shove = intoCart(s, into, c1, dx, dy);
      if (shove.blame) blame.push(...shove.blame);
    }
    if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };
    const lands = tips ? slides : o;
    const next = cloneState(s);
    // The load leaves the piece, so it flies from the piece's own cell rather than appearing.
    const step = mkStep({
      moved: [{ o, from: [tx, ty], to: at,
        ...(lands !== o && { becomes: lands }), ...(into !== null && { parent: into }),
        ...(gone && { effect: 'falls' }) }],
    });
    if (tips && pours) {
      step.spawned.push({ o: NONE, cells: [c2], from: [tx, ty], effect: 'pours' });
      pour(cell(next, c2[0], c2[1]));
    } else if (tips) {
      step.spawned.push({ o: drops, cells: [c2], from: [tx, ty],
        effect: effectOf(cell(next, c2[0], c2[1]), drops) });
      drop(next, c2, [drops]);
    }
    if (shove) applyIntoCart(s, next, into, shove, lands, step);
    else if (SLIDES[o].soaks) { soak(cell(next, ...at)); drop(next, at, [lands]); }
    // Spent making the cell walkable. It still MOVES — the sheet slides onto the hazard and goes
    // down with it — so the step keeps the move and names the sprite where the stage holds it,
    // which is the cell it started from.
    else if (SLIDES[o].covers && cover(cell(next, ...at))) step.gone = [{ o, cells: [[tx, ty]] }];
    else drop(next, at, [lands]);
    const grip = cell(next, tx, ty).grip;
    cell(next, tx, ty).o = NONE;
    cell(next, tx, ty).grip = undefined;
    // The magnet is an ordinary slider; what it does happens after it lands, and it lands
    // wherever the dispatch above put it — a cart slot is a place to land like any other.
    // Asking the board where it ended up is also how a grate that took it on the way says so:
    // there is then no field to resolve, and nothing holds what it was holding.
    if (isMagnet(o)) {
      const rest = shove ? shove.file[0] : at;
      if (cell(next, ...rest).o === o) {
        cell(next, ...rest).grip = grip;
        magnetResolve(next, ...rest, step, dx, dy);
      }
    }
    // He follows only onto floor he could have walked onto, the same question every travelling
    // branch asks. A ROLLER standing in water is shovable — that is what the water gate lets
    // through — and across its axis a tire takes this branch, so the cell it leaves is the
    // canal it was sitting in.
    next.rac = isClearFloor(next, tx, ty) ? { x: tx, y: ty } : { ...s.rac };
    return done(next, PUSH, step);
  }

  throw new Error(`unknown occupant ${o} at ${tx},${ty}`);
}

export function step(s, dir) {
  const r = explain(s, dir);
  return r.ok ? r.next : null;
}

/** Throws unless the board produces exactly the declared `kind`, which is what makes a solution
 *  file self-checking rather than a hint. */
export function applyAction(s, { dir, kind }) {
  const r = explain(s, dir);
  if (!r.ok) throw new Error(`illegal ${kind} ${dir}: blocked by ${r.reason}`);
  if (r.kind !== kind) throw new Error(`declared ${kind} ${dir} but the board gives ${r.kind}`);
  return r.next;
}

const BAGS_IN = { [BAG]: 1, [CAN_FULL]: 1, [WHEELIE]: 1, [BIN]: 1 };
// Both walk the whole chain. A bag stowed inside a barrow that is itself riding in a cart is
// still a bag the exit is waiting on, and a room that let it out of sight would open its door
// on a yard that is not clear.
export function bagsLeft(s) {
  let k = 0;
  for (const o of deepCells(s)) k += BAGS_IN[o] ?? 0;
  return k;
}

export function trashHeld(s) {
  let k = 0;
  for (const row of s.cells) for (const c of row)
    if (isCart(c)) for (const o of chainOf(c)) if (o === TRASH) k++;
  return k;
}

export const atExit = s => cell(s, s.rac.x, s.rac.y).exit;
export const isWon = s => bagsLeft(s) === 0 && trashHeld(s) === 0 && atExit(s);

/** Canonical state key. Each lane is here because dropping it is a SILENT bug:
 *
 *  - terrain, because the jug pours. Without it a jug shoved in a loop keys identical to the
 *    opening position and the solver skips a board it has never seen; and trash on floor
 *    blocks where trash on water walks, so the occupant code alone does not say what a cell is.
 *  - cart membership, because a cart cell holds its cargo in `o` — a can riding in a cart
 *    would read exactly like a can on the floor.
 *  - one lane per multi-cell kind, because the codes do not determine the partition: four
 *    FURNITURE cells are one couch or two. Labelled by first appearance in raster order, so
 *    the key does not depend on which ids happen to be in play.
 *  - link membership, because what is hooked to what changes what a shove does. The same
 *    pieces in the same cells, one pair linked and one not, are two boards.
 *  - each cart's KIND beside its label, because that same relabelling is what makes two carts
 *    interchangeable — sound only while they are. Two carts of different kinds that swap
 *    positions would otherwise hand back one key for two boards.
 *
 * Packed one character per cell and offset off 'A' rather than joined as decimals, which turn
 * ambiguous at two digits — `1,0,10` and `10,1,0` both render as "1010".
 *
 * `SEP` sits below the offset every lane is packed off, so no cell, label or kind can ever emit
 * it. That is the whole reason for the number: a separator inside the alphabet it separates is
 * only unambiguous while every section happens to be fixed-length, which is true today and is
 * not an invariant anything checks.
 *
 * The board half of this key is recomputed for every walk, and a walk shares the board it came
 * from, so it could be cached against the cells array and reused. It is not, deliberately: the
 * cache would be correct only while nothing writes to a board after it has been keyed, that is
 * true today by accident of where the writes happen, and a future write in the wrong place
 * would not throw or fail a test — it would hand the solver a stale key and a wrong answer for
 * a board it thinks it has already seen. Measured, it was worth about four percent.
 */
const SEP = '#';                        // below 65, which is the floor every lane is packed off

// One pass with lazy label maps: this runs once per state generated, and most boards have
// neither furniture nor a cart.
export const stateKey = s => {
  let kinds = '', pids = '', carts = '', links = '', holds = '';
  let pidLabels = null, cartLabels = null;
  for (let y = 0; y < s.rows; y++) {
    if (y) kinds += '/';
    const row = s.cells[y];
    for (let x = 0; x < s.cols; x++) {
      const c = row[x];
      kinds += String.fromCharCode(65 + (c.o * TERRAINS + terrainOf(c)) * 2 + (c.cart !== undefined ? 1 : 0));
      if (c.pid !== undefined) {
        pidLabels ??= new Map();
        if (!pidLabels.has(c.pid)) pidLabels.set(c.pid, pidLabels.size);
        pids += String.fromCharCode(65 + pidLabels.get(c.pid));
      }
      if (c.cart !== undefined) {
        cartLabels ??= new Map();
        if (!cartLabels.has(c.cart)) cartLabels.set(c.cart, cartLabels.size);
        carts += String.fromCharCode(65 + cartLabels.get(c.cart) * CART_KINDS + cartKindOf(c));
      }
      // What is hooked to what is board state: the same pieces in the same cells, one pair
      // linked and one pair not, are two different boards and play differently.
      if (c.grip !== undefined) links += String.fromCharCode(78 + c.grip);
      // What a carried barrow is holding, and what THAT is holding. Variable length, so each
      // one is written with its own count — the cells it belongs to are the ones the kinds lane
      // already says hold a carried barrow, in this same order, and every one of them writes a
      // count even when it is nothing. Two boards differing only in what is stowed out of sight
      // are two boards, and without this the solver would take the second for the first.
      if (isCarriedBarrow(c.o)) {
        const h = c.hold ?? [];
        holds += String.fromCharCode(65 + h.length);
        for (const o of h) holds += String.fromCharCode(65 + o);
      }
    }
  }
  return `${kinds}${SEP}${pids}${SEP}${carts}${SEP}${links}${SEP}${holds}${SEP}${s.rac.x},${s.rac.y}`;
};
