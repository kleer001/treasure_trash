// Treasure Trash — the rules. Pure, deterministic, no DOM, no I/O. The game, the solver
// and the verifier all import this module.

// Occupant codes. `stateKey` encodes each as one printable character, so the list can grow.
export const NONE = 0, BAG = 1, CAN_FULL = 2, CAN_EMPTY = 3, TRASH = 4,
             BIN = 5, STACK = 6, WHEELIE = 7, WHEELIE_EMPTY = 8, JUG = 9, FURNITURE = 10,
             BIN_EMPTY = 11, JUG_EMPTY = 12, SPONGE = 13, CARDBOARD = 14, PANE = 15,
             TIRE_H = 16, TIRE_V = 17, BICYCLE = 18, RUG = 19, CHAIR = 20, BROOM = 21,
             // The cabinet is four facings times two states, and OPEN and CLOSED are separate
             // codes rather than one code with a flag. That is what keeps `isMultiCell` the flat
             // predicate on a code it has always been: an open cabinet is simply a multi-cell
             // kind, and a closed one is not.
             CABC_U = 22, CABC_D = 23, CABC_L = 24, CABC_R = 25,
             CABO_U = 26, CABO_D = 27, CABO_L = 28, CABO_R = 29, DRAWER = 30,
             MAG_U = 31, MAG_D = 32, MAG_L = 33, MAG_R = 34;

// The one code a cell does not fully describe: two adjacent FURNITURE cells may be one couch
// or two, and only `pid` says which. `stateKey` encodes the partition as well as the codes.
export const isMultiCell = o => o === FURNITURE || o === BICYCLE || o === RUG;

// A cabinet's facing is baked into its code, so nothing stores it and nothing can rotate it.
export const cabinetFace = o =>
  ({ [CABC_U]: 'u', [CABC_D]: 'd', [CABC_L]: 'l', [CABC_R]: 'r',
     [CABO_U]: 'u', [CABO_D]: 'd', [CABO_L]: 'l', [CABO_R]: 'r' })[o];
export const isCabinetClosed = o => o >= CABC_U && o <= CABC_R;
export const isCabinetOpen = o => o >= CABO_U && o <= CABO_R;
// The occupant codes, as one object. The renderer takes this rather than a hand-listed subset:
// a code left out of such a list does not throw, it draws NOTHING, and a piece that is simply
// invisible is a bug you find by playing rather than by testing.
export const MAGNET_REACH = 3;
export const magnetFace = o =>
  ({ [MAG_U]: 'u', [MAG_D]: 'd', [MAG_L]: 'l', [MAG_R]: 'r' })[o];
export const isMagnet = o => o >= MAG_U && o <= MAG_R;

export const OCCUPANTS = {
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY, JUG, FURNITURE,
  BIN_EMPTY, JUG_EMPTY, SPONGE, CARDBOARD, PANE, TIRE_H, TIRE_V, BICYCLE, RUG, CHAIR, BROOM,
  CABC_U, CABC_D, CABC_L, CABC_R, CABO_U, CABO_D, CABO_L, CABO_R, DRAWER,
  MAG_U, MAG_D, MAG_L, MAG_R,
  // The cabinet is the one kind whose drawing needs more than its code, so the questions the
  // renderer has to ask travel with the codes rather than being re-derived over there.
  cabinetFace, isCabinetOpen, magnetFace,
};

const CAB_OPENS = { [CABC_U]: CABO_U, [CABC_D]: CABO_D, [CABC_L]: CABO_L, [CABC_R]: CABO_R };
const CAB_SHUTS = { [CABO_U]: CABC_U, [CABO_D]: CABC_D, [CABO_L]: CABC_L, [CABO_R]: CABC_R };

// An open cabinet is a BODY and a DRAWER in two ordinary cells, not one multi-cell piece. The
// drawer is always one step along the body's facing, so the pair is found from either end
// without an id — and, unlike a piece that grows a second cell mid-game, both halves are things
// the board already knows how to hold and the stage already knows how to draw.
export const drawerOf = (s, [x, y]) => {
  const f = DIRS[cabinetFace(cell(s, x, y).o)];
  return [x + f[0], y + f[1]];
};

/** The body a drawer belongs to: the one neighbour whose facing points at it. */
export const bodyOfDrawer = (s, [x, y]) => {
  for (const d of DIR_ORDER) {
    const [bx, by] = [x - DIRS[d][0], y - DIRS[d][1]];
    if (!inGrid(s, bx, by)) continue;
    const c = cell(s, bx, by);
    if (isCabinetOpen(c.o) && cabinetFace(c.o) === d) return [bx, by];
  }
  return null;
};

// The multi-cell pieces that roll. A couch is shoved; these two travel — and they take their
// axis from the cells they already occupy, so anisotropy costs no field of its own and nothing
// in `stateKey`. That is the whole reason they are cheaper than a turnstile.
const ROLLS_LONGWAYS = new Set([BICYCLE, RUG]);

/** Whether the thing standing here rolls THIS way — one cell or many, the same question. A
 *  multi-cell piece asks it of its own footprint; that is what lets a rug hand its motion to a
 *  bicycle, and what stops it when the two lie across each other. */
export const rollsHere = (s, x, y, dx, dy) => {
  const c = cell(s, x, y);
  if (isMultiCell(c.o))
    return ROLLS_LONGWAYS.has(c.o) && longAxis(pieceCells(s, c.pid)) === (dx !== 0 ? 'x' : 'y');
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

// Whether a rolling KIND rolls THIS way. A bin is round from every side and rolls wherever it is
// shoved; a tire has an axis and, shoved across it, is just a thing being pushed one cell. So
// the question a shove asks is never "does this roll" but "does this roll from here" — and the
// answer is what decides which branch it takes.
export const rollsAlong = (c, dx, dy) =>
  isRoller(c) && (c.o === TIRE_H ? dx !== 0 : c.o === TIRE_V ? dy !== 0 : true);

// One shove table for the single-cell pushables. Read the entries, not a paraphrase.
const SLIDES = {
  [CAN_FULL]:  { slides: CAN_EMPTY, drops: BAG },
  [STACK]:     { slides: CAN_FULL,  drops: BAG },
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
  cells: s.cells.map(row => row.map(c => ({ ...c }))),
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

// Slick floor. A ROLLER already travels until blocked, so grease changes nothing for one — it
// buys its keep against the shove branches, by making a slider behave like a roller.
export const isGrease = c => c.ter === GREASE;

// Broken glass: the raccoon may not stand on it, and objects rest on it and cross it freely.
// That splits "where he can walk" from "where anything can sit" — one predicate did both.
export const isGlass = c => c.ter === GLASS;

// Static lanes. Out of `stateKey` for the reason `wall` always was.
//
// A grate swallows an object whose footprint FITS inside it; a bigger thing spans it. The
// raccoon crosses either way.
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
// alike. `CART` is the two-cell cart every level has today.
export const CART = 0, BARROW_H = 1, BARROW_V = 2;
export const CART_KINDS = 4;
export const cartKindOf = c => c.ck ?? CART;

// A barrow is a cart of one cell with an axis it cannot turn. Shoved ALONG that axis it behaves
// as a cart does and swallows what it meets — that is the scoop. Shoved ACROSS it, it tips.
export const isBarrow = k => k === BARROW_H || k === BARROW_V;

// --- the magnet ------------------------------------------------------------------------------
// One facing, four orientations, and it never turns. Its field is a straight line along that
// facing, like a rook's — walls stop it, objects do not. Reach is three cells, which is also
// where a chain lets go, so the piece is one sentence long.

// What a magnet takes hold of. The chair is in and the sponge is not, which is a design
// statement rather than an oversight: the chair is only ever moved by being hit, and the one
// piece that cleans up water and grease cannot be fetched back from wherever it was left.
const METAL = new Set([CAN_FULL, CAN_EMPTY, BIN, BIN_EMPTY, WHEELIE, WHEELIE_EMPTY,
                       TIRE_H, TIRE_V, BICYCLE, CHAIR,
                       CABC_U, CABC_D, CABC_L, CABC_R, CABO_U, CABO_D, CABO_L, CABO_R, DRAWER,
                       MAG_U, MAG_D, MAG_L, MAG_R]);
export const isMetal = c => (isCart(c) ? isBarrow(cartKindOf(c)) : METAL.has(c.o));

// --- links ---------------------------------------------------------------------------------
// Two things held together, and the ONE lane both the barrow's tow and the magnet's chain ride
// in. They differ in how they behave, not in how they are recorded: a tow is rigid and a chain
// stretches, and which it is falls out of what the group holds rather than out of a second field.
export const linkOf = c => c.lk;
export const linkCells = (s, lk) => {
  const out = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++)
    if (s.cells[y][x].lk === lk) out.push([x, y]);
  return out;
};
/** An id no link on this board is using. */
export const freeLink = s => {
  let top = -1;
  for (const row of s.cells) for (const c of row) if (c.lk !== undefined && c.lk > top) top = c.lk;
  return top + 1;
};
export const barrowRollsAlong = (k, dx, dy) => (k === BARROW_H ? dx !== 0 : dy !== 0);

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
 *  Tar is enterable and is never left, so it ends travel rather than forbidding it. */
export const travelsInto = (s, x, y, dx, dy) =>
  isOccupiable(s, x, y) && mayEnter(s, x, y, dx, dy);

/** A piece standing on tar is there for good, and a multi-cell one needs only a single foot in
 *  it. `explain` asks before it asks anything else, so no branch can forget. */
const stuckInTar = (s, tx, ty) => {
  const c = cell(s, tx, ty);
  if (isTar(c)) return true;
  if (c.o === SPONGE && isGlass(c)) return true;      // shards in the sponge; it does not come off
  if (isMultiCell(c.o)) return pieceCells(s, c.pid).some(([x, y]) => isTar(cell(s, x, y)));
  if (isCart(c)) return cartCells(s, c.cart).some(([x, y]) => isTar(cell(s, x, y)));
  return false;
};

export const canRest = (s, x, y) => isOccupiable(s, x, y) || cartAt(s, [x, y]) !== null;

const cartAt = (s, [x, y]) => (inGrid(s, x, y) && isCart(cell(s, x, y)) ? cell(s, x, y).cart : null);

function intoCart(s, cid, entry, dx, dy) {
  const file = [];
  for (let p = entry; cartAt(s, p) === cid; p = [p[0] + dx, p[1] + dy]) file.push(p);
  const last = file[file.length - 1];
  const beyond = [last[0] + dx, last[1] + dy];
  const out = cell(s, ...last).o;
  if (out !== NONE && !isOccupiable(s, ...beyond)) return { blame: [beyond] };
  if (out !== NONE && !tipFits(s, out, beyond, dx, dy))
    return { blame: [tipsInto(out, beyond, dx, dy)] };
  return { file, beyond, out, dx, dy };
}

function applyIntoCart(s, next, cid, { file, beyond, out, dx, dy }, o, step) {
  for (let j = file.length - 1; j > 0; j--) {
    const was = cell(s, ...file[j - 1]).o;
    cell(next, ...file[j]).o = was;
    if (step && was !== NONE)
      step.moved.push({ o: was, from: file[j - 1], to: file[j], parent: cid });
  }
  cell(next, ...file[0]).o = o;
  if (out !== NONE) {
    if (step) step.moved.push({
      o: out, from: file[file.length - 1], to: beyond, parent: null,
      effect: effectOf(cell(next, ...beyond), out),
      ...(landsAs(out) !== out && { becomes: landsAs(out) }),
    });
    drop(cell(next, ...beyond), out);
    tipOut(next, out, beyond, dx, dy, step);
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

// Which way a chair goes when the burst reaches it: directly away from the bag. Every `spawned`
// entry the tear makes carries the bag's own cell, so a five-cell spray still yields one ray per
// chair — and a ray that comes out diagonal takes the direction the burst itself is travelling,
// because a grid has nowhere else to put it.
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

/** The one place cargo is put down. A grate takes what lands in it, and takes it for good. */
const drop = (c, o) => { if (isGrate(c)) return; if (o === TRASH) layTrash(c); else c.o = o; };

// --- the motion account -------------------------------------------------------------------
// A board says what is where, not what moved where, so a traced action carries a step. The
// schema is stage.js's contract; the branches that fill it are the spec for what goes in it.
//
//   moved    { o, from, to, becomes?, parent?, effect? }
//   spawned  { o, at, from?, effect? }
//   gone     { o, at }
//   piece    { kind, ref, dx, dy } | null
//   impact   boolean
const mkStep = (over = {}) => ({ moved: [], spawned: [], gone: [], piece: null, impact: false, ...over });
const effectOf = (c, o) => (o === TRASH && c.water ? 'fills' : 'rest');

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
    if (step) step.spawned.push({ o: NONE, at: c, from: at, effect: 'pours' });
    pour(target);
  } else {
    if (step) step.spawned.push({ o: t.drops, at: c, from: at, effect: effectOf(target, t.drops) });
    drop(target, t.drops);
  }
  if (t.slides !== o) cell(s, ...at).o = t.slides;
}

/** What a container reads as once it has landed and shed. */
const landsAs = o => (sheds(o) ? SLIDES[o].slides : o);

const cartCanEnter = (s, x, y, dx, dy) => {
  if (!inGrid(s, x, y)) return false;
  const c = cell(s, x, y);
  return !c.wall && !c.exit && !isCart(c) && !isMultiCell(c.o) && mayEnter(s, x, y, dx, dy);
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
function handOff(next, from, dx, dy) {
  const moved = [];
  for (let p = from; inGrid(next, ...p) && rollsHere(next, ...p, dx, dy);) {
    const c = cell(next, ...p);
    const own = isMultiCell(c.o) ? pieceCells(next, c.pid) : [[...p]];
    const ownSet = new Set(own.map(([x, y]) => `${x},${y}`));
    const blockedAt = j => own.map(([x, y]) => [x + j * dx, y + j * dy])
      .filter(([x, y]) => !ownSet.has(`${x},${y}`) && !travelsInto(next, x, y, dx, dy)).length > 0;
    let j = 0;
    while (!blockedAt(j + 1)) {
      j++;
      if (own.some(([x, y]) => isTar(cell(next, x + j * dx, y + j * dy))
                            || isGrate(cell(next, x + j * dx, y + j * dy)))) break;
    }
    if (j === 0) break;
    const was = own.map(([x, y]) => ({ o: cell(next, x, y).o, pid: cell(next, x, y).pid }));
    for (const [x, y] of own) { const t = cell(next, x, y); t.o = NONE; t.pid = undefined; }
    own.forEach(([x, y], i) => {
      const to = cell(next, x + j * dx, y + j * dy);
      if (isGrate(to)) return;
      to.o = was[i].o; to.pid = was[i].pid;
    });
    own.forEach(([x, y], i) =>
      moved.push({ o: was[i].o, from: [x, y], to: [x + j * dx, y + j * dy] }));
    const lead = own.reduce((a, b) => (a[0] * dx + a[1] * dy >= b[0] * dx + b[1] * dy ? a : b));
    p = [lead[0] + (j + 1) * dx, lead[1] + (j + 1) * dy];
  }
  return moved;
}

/**
 * Everything a magnet does, and it only ever does it on a shove — nothing on this board moves
 * unbidden. First the chain it already has follows or lets go, then it takes hold of whatever
 * is now in reach.
 */
function magnetResolve(next, mx, my, step, dx = 0, dy = 0) {
  const o = cell(next, mx, my).o;
  const f = DIRS[magnetFace(o)];
  const lk = cell(next, mx, my).lk;

  // The chain is strictly along the facing. Anything that has fallen off that line, or drifted
  // past the reach, is simply let go — which is why the piece needs no distance metric.
  if (lk !== undefined) {
    let held = linkCells(next, lk).filter(([x, y]) => !(x === mx && y === my));

    // ACROSS the field, what is held keeps pace: it moves the way the magnet moved, or the two
    // simply come apart. ALONG the field there is nothing to keep pace with — the gap closes
    // instead, further down. A shove that carries the magnet sideways carries its load sideways.
    if (held.length && (dx || dy) && dx * f[0] + dy * f[1] === 0) {
      const [hx, hy] = held[0];
      const to = [hx + dx, hy + dy];
      if (travelsInto(next, ...to, dx, dy)) {
        const was = { ...cell(next, hx, hy) };
        const c0 = cell(next, hx, hy);
        c0.o = NONE; c0.pid = undefined; c0.cart = undefined; c0.ck = undefined; c0.lk = undefined;
        const c1 = cell(next, ...to);
        c1.o = was.o; c1.pid = was.pid; c1.cart = was.cart; c1.ck = was.ck; c1.lk = was.lk;
        step?.moved.push({ o: was.o, from: [hx, hy], to });
        held = [to];
      }
    }
    const onLine = held.length && held.every(([x, y]) => {
      const k = (x - mx) * f[0] + (y - my) * f[1];
      return k >= 1 && k <= MAGNET_REACH && x - mx === f[0] * k && y - my === f[1] * k;
    });
    if (!onLine) for (const [x, y] of linkCells(next, lk)) cell(next, x, y).lk = undefined;
    else {
      // It closes the gap by up to two, and stops when it is alongside.
      const [hx, hy] = held[0];
      let k = (hx - mx) * f[0] + (hy - my) * f[1];
      let moved = 0;
      while (k > 1 && moved < 2) {
        const to = [hx - f[0] * (moved + 1), hy - f[1] * (moved + 1)];
        if (!travelsInto(next, ...to, -f[0], -f[1])) break;
        moved++; k--;
      }
      if (moved) {
        const was = { ...cell(next, hx, hy) };
        const c0 = cell(next, hx, hy);
        c0.o = NONE; c0.pid = undefined; c0.lk = undefined;
        const to = [hx - f[0] * moved, hy - f[1] * moved];
        const c1 = cell(next, ...to);
        c1.o = was.o; c1.pid = was.pid; c1.lk = was.lk;
        step?.moved.push({ o: was.o, from: [hx, hy], to });
      }
    }
  }

  // Capture. Walls stop the field; objects do not, so the first METAL along the line is taken
  // even with something standing in front of it — it simply closes as far as it can.
  if (cell(next, mx, my).lk !== undefined) return;
  for (let k = 1; k <= MAGNET_REACH; k++) {
    const p = [mx + f[0] * k, my + f[1] * k];
    if (!inGrid(next, ...p) || cell(next, ...p).wall) return;
    const c = cell(next, ...p);
    if (c.o === NONE && !isCart(c)) continue;
    if (!isMetal(c)) continue;
    // One link per piece. A barrow already towing cannot also be captured — the second hold
    // would overwrite the first and leave what it was towing orphaned, with nothing to say so.
    if (c.lk !== undefined) return;
    let moved = 0;
    while (moved < k - 1) {
      const to = [p[0] - f[0] * (moved + 1), p[1] - f[1] * (moved + 1)];
      if (!travelsInto(next, ...to, -f[0], -f[1])) break;
      moved++;
    }
    const was = { ...c };
    const lk2 = freeLink(next);
    if (moved) {
      c.o = NONE; c.pid = undefined; c.cart = undefined; c.ck = undefined;
      const to = [p[0] - f[0] * moved, p[1] - f[1] * moved];
      const d = cell(next, ...to);
      d.o = was.o; d.pid = was.pid; d.cart = was.cart; d.ck = was.ck;
      d.lk = lk2;
      step?.moved.push({ o: was.o, from: [...p], to });
    } else c.lk = lk2;
    cell(next, mx, my).lk = lk2;
    return;
  }
}

/** The barrow has come to rest; if what stopped it is a piece too big to scoop, hook it. */
function hookTow(next, cid, dx, dy) {
  const at = cartCells(next, cid)[0];
  if (!at) return;
  const ahead = [at[0] + dx, at[1] + dy];
  if (!inGrid(next, ...ahead)) return;
  const c = cell(next, ...ahead);
  if (!isMultiCell(c.o) || c.lk !== undefined) return;
  const lk = freeLink(next);
  cell(next, ...at).lk = lk;
  for (const [x, y] of pieceCells(next, c.pid)) cell(next, x, y).lk = lk;
}

/** A tow is rigid: barrow and load move together, or the shove is refused. */
function towMove(s, lk, dx, dy, done) {
  const own = linkCells(s, lk);
  const ownSet = new Set(own.map(([x, y]) => `${x},${y}`));
  const blame = own.map(([x, y]) => [x + dx, y + dy])
    .filter(([x, y]) => !ownSet.has(`${x},${y}`) && !travelsInto(s, x, y, dx, dy));
  if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };
  const next = cloneState(s);
  const was = own.map(([x, y]) => ({ ...cell(s, x, y) }));
  for (const [x, y] of own) {
    const c = cell(next, x, y);
    c.o = NONE; c.pid = undefined; c.cart = undefined; c.ck = undefined; c.lk = undefined;
  }
  own.forEach(([x, y], i) => {
    const c = cell(next, x + dx, y + dy);
    c.o = was[i].o; c.pid = was[i].pid; c.cart = was[i].cart; c.ck = was[i].ck; c.lk = was[i].lk;
  });
  next.rac = { x: s.rac.x + dx, y: s.rac.y + dy };
  return done(next, PUSH, mkStep({
    moved: own.map(([x, y], i) => ({ o: was[i].o, from: [x, y], to: [x + dx, y + dy] })),
  }));
}

/** An open cabinet shoved anywhere but shut: body and drawer move together, one cell. */
function shoveCabinet(s, body, draw, dx, dy, done) {
  const pair = [body, draw];
  const own = new Set(pair.map(([x, y]) => `${x},${y}`));
  const blame = pair.map(([x, y]) => [x + dx, y + dy])
    .filter(([x, y]) => !own.has(`${x},${y}`) && !travelsInto(s, x, y, dx, dy));
  if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };
  const next = cloneState(s);
  const was = pair.map(([x, y]) => cell(s, x, y).o);
  for (const [x, y] of pair) cell(next, x, y).o = NONE;
  pair.forEach(([x, y], i) => { cell(next, x + dx, y + dy).o = was[i]; });
  next.rac = { x: s.rac.x + dx, y: s.rac.y + dy };
  return done(next, PUSH, mkStep({
    moved: pair.map(([x, y], i) => ({ o: was[i], from: [x, y], to: [x + dx, y + dy] })),
  }));
}

function shoveCart(s, cid, entry, dx, dy, trace) {
  const kind = cartKindOf(cell(s, ...entry));
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
  const blame = first.filter(([x, y]) => !cartCanEnter(s, x, y, dx, dy));
  if (!blame.length) files.forEach((f, i) => {
    const back = f[f.length - 1], out = cell(s, ...back).o;
    if (out === NONE || cell(s, ...first[i]).o === NONE) return;
    if (!tipFits(s, out, back, -dx, -dy)) blame.push(tipsInto(out, back, -dx, -dy));
  });
  if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };

  const next = cloneState(s);
  const frames = trace ? [cloneState(s)] : null;
  const steps = trace ? [] : null;
  const loads = files.map(f => f.map(([x, y]) => ({ o: cell(s, x, y).o })));
  const repaint = (k, from) => files.forEach((f, i) => f.forEach((p, j) => {
    const c = cell(next, ...at(p, from)); c.o = NONE; c.cart = undefined; c.ck = undefined;
    // The kind travels with the cart. Without it a barrow becomes an ordinary cart the moment it
    // moves — and `stateKey` would then key two different boards alike.
    const d = cell(next, ...at(p, k)); d.cart = cid; d.ck = kind; d.o = loads[i][j].o;
  }));

  let n = 0, lastRoll = -1;
  for (;;) {
    const ahead = aheadAt(n);
    // The cell a swallow pushes the old load back onto is one the cart is vacating this beat,
    // so only the cell that load would shed into has to be free.
    const canShed = i => {
      const load = loads[i], out = load[load.length - 1];
      if (out.o === NONE) return true;
      return tipFits(next, out.o, at(files[i][load.length - 1], n), -dx, -dy);
    };
    const clear = ahead.every(([x, y]) => cartCanEnter(next, x, y, dx, dy))
      && !files.some(f => isTar(cell(next, ...at(f[0], n))));
    const incoming = clear ? ahead.map(([x, y]) => cell(next, x, y).o) : ahead.map(() => NONE);
    const rolling = clear && files.every((f, i) => incoming[i] === NONE || canShed(i));
    const taken = rolling ? incoming : ahead.map(() => NONE);
    const end = rolling ? n + 1 : n;              // where the cart stands once this step is over
    const step = trace ? mkStep(rolling ? { piece: { kind: 'cart', ref: cid, dx, dy } } : {}) : null;
    const spill = [];

    files.forEach((f, i) => {
      if (rolling && taken[i] === NONE) return;
      // A cart that stops rolling pushes its load out the back. A barrow does not: what it
      // scooped stays in it until it is tipped, which is the whole of what scooping buys.
      if (!rolling && isBarrow(kind)) return;
      const load = loads[i], depth = load.length, out = load[depth - 1];
      const behind = at(f[depth - 1], end - 1);
      if (!rolling && out.o !== NONE
          && (!isOccupiable(next, ...behind) || !tipFits(next, out.o, behind, -dx, -dy))) return;

      for (let j = depth - 1; j > 0; j--) {
        const it = load[j] = load[j - 1];
        if (step && it.o !== NONE)
          step.moved.push({ o: it.o, from: at(f[j - 1], n), to: at(f[j], end), parent: cid });
      }
      load[0] = { o: taken[i] };
      if (step && taken[i] !== NONE)
        step.moved.push({ o: taken[i], from: ahead[i], to: at(f[0], end), parent: cid });
      if (out.o !== NONE) {
        if (step) step.moved.push({
          o: out.o, from: at(f[depth - 1], n), to: behind, parent: null,
          effect: effectOf(cell(next, ...behind), out.o),
          ...(landsAs(out.o) !== out.o && { becomes: landsAs(out.o) }),
        });
        spill.push([behind, out.o]);
      }
    });

    repaint(end, n);
    n = end;
    for (const [[x, y], o] of spill) {
      drop(cell(next, x, y), o);
      tipOut(next, o, [x, y], -dx, -dy, step);
    }
    if (trace && (rolling || step.moved.length)) {
      frames.push(cloneState(next)); steps.push(step);
      if (rolling) lastRoll = steps.length - 1;
    }
    if (!rolling) break;
  }
  if (trace && lastRoll >= 0) steps[lastRoll].impact = true;

  next.rac = isClearFloor(next, entry[0], entry[1]) ? { x: entry[0], y: entry[1] } : { ...s.rac };
  if (trace) for (let k = 1; k < frames.length; k++) frames[k].rac = { ...next.rac };

  return trace ? { ok: true, kind: PUSH, next, frames, steps } : { ok: true, kind: PUSH, next };
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
export function explain(s, dir, opts = {}) {
  const d = DIRS[dir];
  if (!d) throw new Error(`unknown direction: ${dir}`);
  const [dx, dy] = d;
  const x = s.rac.x, y = s.rac.y, tx = x + dx, ty = y + dy;

  if (!inGrid(s, tx, ty)) return { ok: false, reason: 'edge', blame: [] };
  const target = cell(s, tx, ty);
  if (target.wall) return { ok: false, reason: 'wall', blame: [[tx, ty]] };

  // One board pair, one step. Anything with more to report builds its own.
  const done = (next, kind, step) => opts.trace
    ? { ok: true, kind, next, frames: [cloneState(s), next], steps: [step] }
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
      const load = target.o;
      if (!travelsInto(s, ...to, dx, dy))
        return { ok: false, reason: reasonFor(s, [to], 'canRoom'), blame: [to] };
      if (load !== NONE && !travelsInto(s, ...out, dx, dy))
        return { ok: false, reason: reasonFor(s, [out], 'canRoom'), blame: [out] };
      if (load !== NONE && !tipFits(s, load, out, dx, dy))
        return { ok: false, reason: reasonFor(s, [tipsInto(load, out, dx, dy)], 'canRoom'),
                 blame: [tipsInto(load, out, dx, dy)] };
      const next = cloneState(s);
      const step = mkStep();
      // Tipping lets go of whatever it was towing: the barrow turns out from under the load.
      if (target.lk !== undefined)
        for (const [x, y] of linkCells(next, target.lk)) cell(next, x, y).lk = undefined;
      cell(next, tx, ty).cart = undefined; cell(next, tx, ty).ck = undefined;
      cell(next, tx, ty).o = NONE;
      const landed = cell(next, ...to);
      landed.cart = target.cart; landed.ck = kind; landed.o = NONE;
      step.moved.push({ o: NONE, from: [tx, ty], to });
      if (load !== NONE) {
        step.moved.push({ o: load, from: [tx, ty], to: out, parent: null,
          effect: effectOf(cell(next, ...out), load),
          ...(landsAs(load) !== load && { becomes: landsAs(load) }) });
        drop(cell(next, ...out), load);
        tipOut(next, load, out, dx, dy, step);
      }
      next.rac = isClearFloor(next, tx, ty) ? { x: tx, y: ty } : { ...s.rac };
      return done(next, PUSH, step);
    }
    // Already towing: the pair is rigid, so it moves as one thing or not at all.
    if (target.lk !== undefined) return towMove(s, target.lk, dx, dy, done);

    // Shoved straight at something too big to scoop, the barrow hooks on rather than refusing.
    // The shove is spent taking hold, which is the same beat a scoop costs.
    if (isBarrow(kind)) {
      const ahead = [tx + dx, ty + dy];
      if (inGrid(s, ...ahead) && isMultiCell(cell(s, ...ahead).o)
          && cell(s, ...ahead).lk === undefined) {
        const next = cloneState(s);
        const lk = freeLink(next);
        cell(next, tx, ty).lk = lk;
        for (const [x, y] of pieceCells(next, cell(next, ...ahead).pid)) cell(next, x, y).lk = lk;
        return done(next, PUSH, mkStep());
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
    const step = mkStep({ gone: [{ o: BAG, at: [tx, ty] }] });
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
      step.spawned.push({ o: TRASH, at: [fx, fy], from: [tx, ty], effect: effectOf(c, TRASH) });
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
      gone: [{ o: PANE, at: [tx, ty] }],
      spawned: [{ o: NONE, at: c1, from: [tx, ty], effect: 'shatters' }],
    }));
  }

  // Shoved on the drawer, toward the body, the shove is spent closing it — the cabinet does not
  // move, and the next shove moves the whole thing.
  if (isCabinetOpen(o)) {
    const f = DIRS[cabinetFace(o)];
    const own = pieceCells(s, target.pid);
    const body = own.find(([x, y]) => !(x === tx + f[0] && y === ty + f[1])
      && own.some(([bx, by]) => bx === x + f[0] && by === y + f[1]));
    const isDrawerCell = body && (tx !== body[0] || ty !== body[1]);
    if (isDrawerCell && dx === -f[0] && dy === -f[1]) {
      const next = cloneState(s);
      for (const [x, y] of own) { const c = cell(next, x, y); c.o = NONE; c.pid = undefined; }
      cell(next, ...body).o = CAB_SHUTS[o];
      next.rac = { x: tx, y: ty };
      return done(next, PUSH, mkStep({
        moved: [{ o, from: [tx, ty], to: body, becomes: CAB_SHUTS[o] }],
      }));
    }
  }

  // Shoved from the far side, anything held drags its holder along behind it — a towed couch
  // takes its barrow, a chained can takes its magnet. That is the board pulling, not the
  // raccoon, which is the one place pulling was ever allowed. The magnet itself is exempt: a
  // shove on IT is an ordinary shove, and what it holds follows after.
  if (target.lk !== undefined && !isMagnet(o)) return towMove(s, target.lk, dx, dy, done);

  if (isMultiCell(o)) {
    const own = pieceCells(s, target.pid);
    const ownSet = new Set(own.map(([x, y]) => `${x},${y}`));
    const clearAt = k => own.map(([x, y]) => [x + k * dx, y + k * dy])
      .filter(([x, y]) => !ownSet.has(`${x},${y}`) && !travelsInto(s, x, y, dx, dy));
    const blame = clearAt(1);
    if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };

    // Shoved along its length a rug rolls; shoved broadside it shifts one cell, like the couch
    // it otherwise is. Nothing stores the axis — it is whatever the footprint already says.
    let k = 1;
    if (ROLLS_LONGWAYS.has(o) && longAxis(own) === (dx !== 0 ? 'x' : 'y')) {
      while (!clearAt(k + 1).length) {
        k++;
        const front = own.map(([x, y]) => cell(s, x + k * dx, y + k * dy));
        if (front.some(c => isTar(c) || isGrate(c))) break;
      }
    }

    const next = cloneState(s);
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
    // The same hand-off every roller gets: a rug that reaches a bicycle lying the same way sets
    // it going, and one lying across it is simply what the rug stops against.
    const lead = own.reduce((a, b) => (a[0] * dx + a[1] * dy >= b[0] * dx + b[1] * dy ? a : b));
    const passed = ROLLS_LONGWAYS.has(o)
      ? handOff(next, [lead[0] + (k + 1) * dx, lead[1] + (k + 1) * dy], dx, dy) : [];
    next.rac = isClearFloor(next, tx, ty) ? { x: tx, y: ty } : { ...s.rac };
    return done(next, PUSH, mkStep({
      piece: { kind: 'furniture', ref: target.pid, dx, dy },
      moved: passed,
    }));
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
      drop(cell(next, ...shedAt), BAG);
    }

    // IMPACT. The train stopped; if what stopped it rolls, the motion carries on into it and
    // the train stays put. One rule, applied until nothing is left rolling — every hand-off
    // goes strictly forward, so a cascade is a straight run and cannot fail to end.
    const passedTo = handOff(next, [lead[0] + (k + 1) * dx, lead[1] + (k + 1) * dy], dx, dy);

    next.rac = isClearFloor(next, tx, ty) ? { x: tx, y: ty } : { ...s.rac };
    if (!opts.trace) return { ok: true, kind: PUSH, next };

    const frames = [cloneState(s), rolled];
    const steps = [mkStep({
      moved: train.filter(c => !swallowed.some(([sc]) => sc[0] === c[0] && sc[1] === c[1]))
        .map(([x, y]) => ({ o: cell(s, x, y).o, from: [x, y], to: [x + k * dx, y + k * dy] })),
      gone: swallowed.map(([at, o2]) => ({ o: o2, at: [at[0] + k * dx, at[1] + k * dy] })),
      impact: true,
    })];
    if (shedAt || passedTo.length) {
      frames.push(next);
      steps.push(mkStep({
        moved: [
          ...(shedAt ? [{ o: WHEELIE, from: [rear[0] + k * dx, rear[1] + k * dy],
                          to: [rear[0] + k * dx, rear[1] + k * dy], becomes: WHEELIE_EMPTY }] : []),
          ...passedTo,
        ],
        spawned: shedAt ? [{ o: BAG, at: shedAt, from: [rear[0] + k * dx, rear[1] + k * dy] }] : [],
      }));
    }
    for (let i = 1; i < frames.length; i++) frames[i].rac = { ...next.rac };
    return { ok: true, kind: PUSH, next, frames, steps };
  }

  // A closed cabinet moves, and the same shove slides its drawer out. The drawer opening is
  // itself a PUSH — it shoves whatever is in the way one further cell — which is what makes the
  // cabinet a second aimed action: you shove north, and something goes east.
  if (isCabinetClosed(o)) {
    const f = DIRS[cabinetFace(o)];
    const body = [tx + dx, ty + dy];
    const draw = [body[0] + f[0], body[1] + f[1]];
    if (!travelsInto(s, ...body, dx, dy))
      return { ok: false, reason: reasonFor(s, [body], 'canRoom'), blame: [body] };
    // It cannot open onto the cell he is standing in, and he is the one occupant `isOccupiable`
    // cannot see.
    if (draw[0] === tx && draw[1] === ty)
      return { ok: false, reason: 'canRoom', blame: [draw] };

    const next = cloneState(s);
    const step = mkStep();
    if (!travelsInto(next, ...draw, f[0], f[1])) {
      const past = [draw[0] + f[0], draw[1] + f[1]];
      const inWay = inGrid(next, ...draw) ? cell(next, ...draw) : null;
      if (!inWay || inWay.o === NONE || isCart(inWay) || isMultiCell(inWay.o)
          || !travelsInto(next, ...past, f[0], f[1]))
        return { ok: false, reason: reasonFor(s, [draw], 'canRoom'), blame: [draw] };
      const shoved = inWay.o;
      cell(next, ...draw).o = NONE;
      drop(cell(next, ...past), shoved);
      step.moved.push({ o: shoved, from: draw, to: past });
    }
    cell(next, tx, ty).o = NONE;
    cell(next, ...body).o = CAB_OPENS[o];
    cell(next, ...draw).o = DRAWER;
    step.moved.push({ o, from: [tx, ty], to: body, becomes: CAB_OPENS[o] });
    step.spawned.push({ o: DRAWER, at: draw, from: body });
    next.rac = { x: tx, y: ty };
    return done(next, PUSH, step);
  }

  // Shoved on the drawer toward the body, the shove is spent closing it: the cabinet does not
  // move, and the next shove moves the whole thing.
  if (o === DRAWER) {
    const body = bodyOfDrawer(s, [tx, ty]);
    if (!body) throw new Error(`a drawer at ${tx},${ty} with no cabinet behind it`);
    const f = DIRS[cabinetFace(cell(s, ...body).o)];
    if (dx === -f[0] && dy === -f[1]) {
      const next = cloneState(s);
      cell(next, tx, ty).o = NONE;
      cell(next, ...body).o = CAB_SHUTS[cell(s, ...body).o];
      next.rac = { x: tx, y: ty };
      return done(next, PUSH, mkStep({
        gone: [{ o: DRAWER, at: [tx, ty] }],
        moved: [{ o: cell(s, ...body).o, from: body, to: body,
                  becomes: CAB_SHUTS[cell(s, ...body).o] }],
      }));
    }
    return shoveCabinet(s, body, [tx, ty], dx, dy, done);
  }

  if (isCabinetOpen(o)) return shoveCabinet(s, [tx, ty], drawerOf(s, [tx, ty]), dx, dy, done);

  // The broom takes the whole contiguous line ahead of it, of any kinds, one cell — and on
  // grease it takes the line the length of the slick. It is the ONLY thing that moves a bag
  // without bursting it, which is what gives broken glass anything to do.
  if (o === BROOM) {
    const line = [];
    for (let p = [tx, ty]; inGrid(s, ...p) && cell(s, ...p).o !== NONE
         && !isCart(cell(s, ...p)) && !isMultiCell(cell(s, ...p).o); p = [p[0] + dx, p[1] + dy])
      line.push(p);
    const head = line[line.length - 1];
    const beyond = [head[0] + dx, head[1] + dy];
    if (!travelsInto(s, ...beyond, dx, dy))
      return { ok: false, reason: reasonFor(s, [beyond], 'canRoom'), blame: [beyond] };
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
    for (const [x, y] of line) { const c = cell(next, x, y); c.o = NONE; c.lk = undefined; }
    for (const [x, y] of [...line].reverse()) {
      const from = [x, y], to = [x + k * dx, y + k * dy];
      const what = cell(s, x, y).o;
      if (isGrate(cell(next, ...to))) { step.gone.push({ o: what, at: from }); continue; }
      // A bag swept onto glass bursts where it lands, which only the head of a line can do.
      if (what === BAG && isGlass(cell(next, ...to))) {
        step.gone.push({ o: BAG, at: from });
        for (const [fx, fy] of fan(to[0], to[1], dx, dy)) {
          if (!isOccupiable(next, fx, fy)) continue;
          step.spawned.push({ o: TRASH, at: [fx, fy], from: to, effect: effectOf(cell(next, fx, fy), TRASH) });
          layTrash(cell(next, fx, fy));
        }
        continue;
      }
      // Everything the cell was carrying travels with it, not just the occupant code. A link
      // left behind belongs to whatever is standing there now, which is a different board.
      const c = cell(next, ...to);
      c.o = what; c.lk = cell(s, x, y).lk;
      step.moved.push({ o: what, from, to });
    }
    // Only the head has a free cell beyond it; every other has its neighbour there, so the shed
    // rule needs no statement of its own.
    const headTo = [head[0] + k * dx, head[1] + k * dy];
    const headWas = cell(s, ...head).o;
    if (sheds(headWas) && cell(next, ...headTo).o === headWas) {
      if (tipFits(next, headWas, headTo, dx, dy)) tipOut(next, headWas, headTo, dx, dy, step);
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
      moved: gone ? [] : [{ o, from: [tx, ty], to: at,
        ...(lands !== o && { becomes: lands }), ...(into !== null && { parent: into }) }],
      gone: gone ? [{ o, at }] : [],
    });
    if (tips && pours) {
      step.spawned.push({ o: NONE, at: c2, from: [tx, ty], effect: 'pours' });
      pour(cell(next, c2[0], c2[1]));
    } else if (tips) {
      step.spawned.push({ o: drops, at: c2, from: [tx, ty],
        effect: effectOf(cell(next, c2[0], c2[1]), drops) });
      drop(cell(next, c2[0], c2[1]), drops);
    }
    if (isMagnet(o)) {
      // The magnet is an ordinary slider; what it does happens after it lands.
      drop(cell(next, at[0], at[1]), lands);
      cell(next, tx, ty).o = NONE;
      cell(next, at[0], at[1]).lk = cell(next, tx, ty).lk;
      cell(next, tx, ty).lk = undefined;
      magnetResolve(next, at[0], at[1], step, dx, dy);
      next.rac = { x: tx, y: ty };
      return done(next, PUSH, step);
    }
    if (shove) applyIntoCart(s, next, into, shove, lands, step);
    else if (SLIDES[o].soaks) { soak(cell(next, ...at)); drop(cell(next, ...at), lands); }
    // Spent making the cell walkable. It still MOVES — the sheet slides onto the hazard and goes
    // down with it — so the step keeps the move and names the sprite where the stage holds it,
    // which is the cell it started from.
    else if (SLIDES[o].covers && cover(cell(next, ...at))) step.gone = [{ o, at: [tx, ty] }];
    else drop(cell(next, at[0], at[1]), lands);
    cell(next, tx, ty).o = NONE;
    next.rac = { x: tx, y: ty };
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

const BAGS_IN = { [BAG]: 1, [CAN_FULL]: 1, [WHEELIE]: 1, [STACK]: 2, [BIN]: 1 };
export function bagsLeft(s) {
  let k = 0;
  for (const row of s.cells) for (const c of row) k += BAGS_IN[c.o] ?? 0;
  return k;
}

export function trashHeld(s) {
  let k = 0;
  for (const row of s.cells) for (const c of row) if (isCart(c) && c.o === TRASH) k++;
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
  let kinds = '', pids = '', carts = '', links = '';
  let pidLabels = null, cartLabels = null, linkLabels = null;
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
      if (c.lk !== undefined) {
        linkLabels ??= new Map();
        if (!linkLabels.has(c.lk)) linkLabels.set(c.lk, linkLabels.size);
        links += String.fromCharCode(65 + linkLabels.get(c.lk));
      }
    }
  }
  return `${kinds}${SEP}${pids}${SEP}${carts}${SEP}${links}${SEP}${s.rac.x},${s.rac.y}`;
};
