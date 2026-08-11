// Treasure Trash — the rules. Pure, deterministic, no DOM, no I/O. The game, the solver
// and the verifier all import this module.

// Occupant codes. `stateKey` encodes each as one printable character, so the list can grow.
export const NONE = 0, BAG = 1, CAN_FULL = 2, CAN_EMPTY = 3, TRASH = 4,
             BIN = 5, STACK = 6, WHEELIE = 7, WHEELIE_EMPTY = 8, JUG = 9, FURNITURE = 10,
             BIN_EMPTY = 11, JUG_EMPTY = 12;

// The occupant codes, as one object. The renderer takes this rather than a hand-listed subset:
// a code left out of such a list does not throw, it draws NOTHING, and a piece that is simply
// invisible is a bug you find by playing rather than by testing.
export const OCCUPANTS = {
  NONE, BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY, JUG, FURNITURE,
  BIN_EMPTY, JUG_EMPTY,
};

// The one code a cell does not fully describe: two adjacent FURNITURE cells may be one couch
// or two, and only `pid` says which. `stateKey` encodes the partition as well as the codes.
export const isMultiCell = o => o === FURNITURE;

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
export const isRoller = c => !isCart(c) && (c.o === WHEELIE || c.o === WHEELIE_EMPTY);

// One shove table for the single-cell pushables. Read the entries, not a paraphrase.
const SLIDES = {
  [CAN_FULL]:  { slides: CAN_EMPTY, drops: BAG },
  [STACK]:     { slides: CAN_FULL,  drops: BAG },
  [BIN]:       { slides: BIN_EMPTY, drops: TRASH },
  [JUG]:       { slides: JUG_EMPTY,  pours: true },
  [JUG_EMPTY]: { slides: JUG_EMPTY },
  [CAN_EMPTY]: { slides: CAN_EMPTY },
  [BIN_EMPTY]: { slides: BIN_EMPTY },
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
export const CART = 0;
export const CART_KINDS = 4;
export const cartKindOf = c => c.ck ?? CART;

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

export const fanBlockers = (s, bx, by, dx, dy) =>
  fan(bx, by, dx, dy).filter(([x, y]) => !isOccupiable(s, x, y));

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
function shoveCart(s, cid, entry, dx, dy, trace) {
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
    const c = cell(next, ...at(p, from)); c.o = NONE; c.cart = undefined;
    const d = cell(next, ...at(p, k)); d.cart = cid; d.o = loads[i][j].o;
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
  if (isCart(target)) return shoveCart(s, target.cart, [tx, ty], dx, dy, opts.trace === true);

  const o = target.o;

  if (o === NONE) return stepOnto();

  if (o === TRASH) return { ok: false, reason: 'trash', blame: [[tx, ty]] };

  if (o === BAG) {
    const blockers = fanBlockers(s, tx, ty, dx, dy);
    if (blockers.length) return { ok: false, reason: reasonFor(s, blockers, 'fan'), blame: blockers };
    const next = cloneState(s);
    const step = mkStep({ gone: [{ o: BAG, at: [tx, ty] }] });
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

  if (isMultiCell(o)) {
    const own = pieceCells(s, target.pid);
    const ownSet = new Set(own.map(([x, y]) => `${x},${y}`));
    const blame = own.map(([x, y]) => [x + dx, y + dy])
      .filter(([x, y]) => !ownSet.has(`${x},${y}`) && !travelsInto(s, x, y, dx, dy));
    if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };
    const next = cloneState(s);
    // `= undefined`, not `delete`: deleting a property drops the cell into dictionary mode and
    // every clone and key of every state descended from this one pays for it.
    for (const [x, y] of own) { const c = cell(next, x, y); c.o = NONE; c.pid = undefined; }
    for (const [x, y] of own) {
      const c = cell(next, x + dx, y + dy);
      c.o = o; c.pid = target.pid;
    }
    next.rac = { x: tx, y: ty };
    return done(next, PUSH, mkStep({ piece: { kind: 'furniture', ref: target.pid, dx, dy } }));
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
    if (into === null && !blame.length) {
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
    if (shove) applyIntoCart(s, next, into, shove, lands, step);
    else drop(cell(next, at[0], at[1]), lands);
    cell(next, tx, ty).o = NONE;
    next.rac = { x: tx, y: ty };
    return done(next, PUSH, step);
  }

  if (isRoller(target)) {
    let rx = tx, ry = ty;
    // Tar and a grate END a roll rather than blocking it: the cell is entered, and then either
    // held for good or fallen through. Everything else is the ordinary "until blocked".
    while (travelsInto(s, rx + dx, ry + dy, dx, dy)) {
      rx += dx; ry += dy;
      if (isTar(cell(s, rx, ry)) || isGrate(cell(s, rx, ry))) break;
    }
    if (rx === tx && ry === ty) {
      const stop = [[tx + dx, ty + dy]];
      return { ok: false, reason: reasonFor(s, stop, 'canRoom'), blame: stop };
    }
    // Two beats, not one: reported together, the bag is drawn leaving a bin that is still
    // halfway down the alley.
    const rolled = cloneState(s);
    cell(rolled, tx, ty).o = NONE;
    const swallowed = isGrate(cell(rolled, rx, ry));
    if (!swallowed) cell(rolled, rx, ry).o = o;
    // Tested against `rolled`, not `s`: on a one-cell roll this cell is the bin's own start.
    // A bin that went down a grate went down holding its bag, so it sheds nothing.
    const back = !swallowed && o === WHEELIE ? [rx - dx, ry - dy] : null;
    if (back && !isOccupiable(rolled, back[0], back[1]))
      return { ok: false, reason: reasonFor(s, [back], 'canRoom'), blame: [back] };

    // Untraced, the mid-roll board is not wanted, so it is finished in place rather than cloned.
    const next = opts.trace ? cloneState(rolled) : rolled;
    if (back) {
      cell(next, rx, ry).o = WHEELIE_EMPTY;
      drop(cell(next, back[0], back[1]), BAG);
    }
    next.rac = isClearFloor(next, tx, ty) ? { x: tx, y: ty } : { ...s.rac };
    if (!opts.trace) return { ok: true, kind: PUSH, next };

    const frames = [cloneState(s), rolled];
    const steps = [mkStep({
      moved: [{ o, from: [tx, ty], to: [rx, ry] }],
      impact: true,
    })];
    if (back) {
      frames.push(next);
      steps.push(mkStep({
        moved: [{ o: WHEELIE, from: [rx, ry], to: [rx, ry], becomes: WHEELIE_EMPTY }],
        spawned: [{ o: BAG, at: back, from: [rx, ry] }],
      }));
    }
    for (let k = 1; k < frames.length; k++) frames[k].rac = { ...next.rac };
    return { ok: true, kind: PUSH, next, frames, steps };
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
  let kinds = '', pids = '', carts = '';
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
    }
  }
  return `${kinds}${SEP}${pids}${SEP}${carts}${SEP}${s.rac.x},${s.rac.y}`;
};
