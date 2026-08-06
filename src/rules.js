// Treasure Trash — the rules. Pure, deterministic, no DOM, no I/O. The game, the solver
// and the verifier all import this module.

// Occupant codes. `stateKey` encodes each as one printable character, so the list can grow.
export const NONE = 0, BAG = 1, CAN_FULL = 2, CAN_EMPTY = 3, TRASH = 4,
             BIN = 5, STACK = 6, WHEELIE = 7, WHEELIE_EMPTY = 8, JUG = 9, FURNITURE = 10;

// The one code a cell does not fully describe: two adjacent FURNITURE cells may be one couch
// or two, and only `pid` says which. `stateKey` encodes the partition as well as the codes.
export const isMultiCell = o => o === FURNITURE;

/** Every cell of the piece `pid`, in raster order. Boards are tiny; this scans the whole one. */
export function pieceCells(s, pid) {
  const out = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++)
    if (s.cells[y][x].pid === pid) out.push([x, y]);
  return out;
}

// A cart cell holds its CARGO's occupant code in `o`, so membership needs a field of its own;
// and like `pid`, two adjacent cart cells may be one cart or two.
export const isCart = c => c.cart !== undefined;

/** Every cell of cart `cid`, in raster order. */
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
  [BIN]:       { slides: BIN,       drops: TRASH },
  [JUG]:       { slides: JUG,       pours: true },
  [CAN_EMPTY]: { slides: CAN_EMPTY },
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
// holds one occupant, and terrain has to be able to coexist with one. Only `wall` is static,
// so `stateKey` encodes the other two.

export const isClearFloor = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall && !cell(s, x, y).water
  && cell(s, x, y).o === NONE && !isCart(cell(s, x, y));

export const canStand = isClearFloor;

/** The one place trash is laid down. */
export function layTrash(c) {
  if (c.water) { c.water = false; c.bridge = true; }
  else c.o = TRASH;
}

export const isOccupiable = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall && !cell(s, x, y).exit
  && cell(s, x, y).o === NONE && !isCart(cell(s, x, y));

export const canRest = (s, x, y) => isOccupiable(s, x, y) || cartAt(s, [x, y]) !== null;

/** The cart a cell belongs to, or null. */
const cartAt = (s, [x, y]) => (inGrid(s, x, y) && isCart(cell(s, x, y)) ? cell(s, x, y).cart : null);

/** Returns the file, the cell past it, and what comes out — or `blame` when it cannot. */
function intoCart(s, cid, entry, dx, dy) {
  const file = [];
  for (let p = entry; cartAt(s, p) === cid; p = [p[0] + dx, p[1] + dy]) file.push(p);
  const last = file[file.length - 1];
  const beyond = [last[0] + dx, last[1] + dy];
  const out = cell(s, ...last).o;
  if (out !== NONE && !isOccupiable(s, ...beyond)) return { blame: [beyond] };
  return { file, beyond, out };
}

/** Apply that shove to `next`, and say so in `step`. */
function applyIntoCart(s, next, cid, { file, beyond, out }, o, step) {
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
    });
    drop(cell(next, ...beyond), out);
  }
}

/** Spill test. */
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

// The exit and open water each get their own refusal reason rather than the generic one,
// so the UI can name what is in the way instead of just saying "blocked".
const reasonFor = (s, blockers, fallback) => {
  const is = pred => blockers.some(([x, y]) => inGrid(s, x, y) && pred(cell(s, x, y)));
  if (is(c => c.exit)) return 'exit';
  if (is(c => c.water && c.o === NONE)) return 'water';
  return fallback;
};

/** The one place cargo is put down. */
const drop = (c, o) => { if (o === TRASH) layTrash(c); else c.o = o; };

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

const cartCanEnter = (s, x, y) => {
  if (!inGrid(s, x, y)) return false;
  const c = cell(s, x, y);
  return !c.wall && !c.exit && !isCart(c) && !isMultiCell(c.o);
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

  if (!aheadAt(0).every(([x, y]) => cartCanEnter(s, x, y))) {
    const blame = aheadAt(0).filter(([x, y]) => !cartCanEnter(s, x, y));
    return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };
  }

  const next = cloneState(s);
  const frames = trace ? [cloneState(s)] : null;
  const steps = trace ? [] : null;
  // Each file's load, lead-first.
  const loads = files.map(f => f.map(([x, y]) => ({ o: cell(s, x, y).o })));
  const repaint = (k, from) => files.forEach((f, i) => f.forEach((p, j) => {
    const c = cell(next, ...at(p, from)); c.o = NONE; c.cart = undefined;
    const d = cell(next, ...at(p, k)); d.cart = cid; d.o = loads[i][j].o;
  }));

  let n = 0, lastRoll = -1;
  for (;;) {
    const ahead = aheadAt(n);
    const rolling = ahead.every(([x, y]) => cartCanEnter(next, x, y));
    const taken = rolling ? ahead.map(([x, y]) => cell(next, x, y).o) : ahead.map(() => NONE);
    const end = rolling ? n + 1 : n;              // where the cart stands once this step is over
    const step = trace ? mkStep(rolling ? { piece: { kind: 'cart', ref: cid, dx, dy } } : {}) : null;
    const spill = [];

    files.forEach((f, i) => {
      if (rolling && taken[i] === NONE) return;
      const load = loads[i], depth = load.length, out = load[depth - 1];
      const behind = at(f[depth - 1], end - 1);
      if (!rolling && out.o !== NONE && !isOccupiable(next, ...behind)) return;

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
        });
        spill.push([behind, out.o]);
      }
    });

    repaint(end, n);
    n = end;
    for (const [[x, y], o] of spill) drop(cell(next, x, y), o);
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

  const stepOnto = () => {
    const next = cloneState(s);
    next.rac = { x: tx, y: ty };
    return done(next, MOVE, mkStep());          // only the raccoon, and he rides on `rac`
  };

  if (target.water && !isRoller(target)) return { ok: false, reason: 'water', blame: [[tx, ty]] };

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
      .filter(([x, y]) => !ownSet.has(`${x},${y}`) && !isOccupiable(s, x, y));
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
    const throws = drops !== undefined || pours === true;
    const c1 = [tx + dx, ty + dy], c2 = [tx + 2 * dx, ty + 2 * dy];
    const fits = pours ? canPour : isOccupiable;
    const blame = [];
    if (!canRest(s, c1[0], c1[1])) blame.push(c1);
    if (throws && !fits(s, c2[0], c2[1])) blame.push(c2);
    const into = cartAt(s, c1);
    let shove = null;
    if (into !== null && !blame.length) {
      shove = intoCart(s, into, c1, dx, dy);
      if (shove.blame) blame.push(...shove.blame);
      else if (throws && shove.out !== NONE) blame.push(c2);
    }
    if (blame.length) return { ok: false, reason: reasonFor(s, blame, 'canRoom'), blame };
    const next = cloneState(s);
    // The load leaves the piece, so it flies from the piece's own cell rather than appearing.
    const step = mkStep({ moved: [{ o, from: [tx, ty], to: c1,
      ...(slides !== o && { becomes: slides }), ...(into !== null && { parent: into }) }] });
    if (pours) {
      step.spawned.push({ o: NONE, at: c2, from: [tx, ty], effect: 'pours' });
      cell(next, c2[0], c2[1]).water = true;
    } else if (drops !== undefined) {
      step.spawned.push({ o: drops, at: c2, from: [tx, ty],
        effect: effectOf(cell(next, c2[0], c2[1]), drops) });
      drop(cell(next, c2[0], c2[1]), drops);
    }
    if (shove) applyIntoCart(s, next, into, shove, slides, step);
    else cell(next, c1[0], c1[1]).o = slides;
    cell(next, tx, ty).o = NONE;
    next.rac = { x: tx, y: ty };
    return done(next, PUSH, step);
  }

  if (isRoller(target)) {
    let rx = tx, ry = ty;
    while (isOccupiable(s, rx + dx, ry + dy)) { rx += dx; ry += dy; }
    if (rx === tx && ry === ty) {
      const stop = [[tx + dx, ty + dy]];
      return { ok: false, reason: reasonFor(s, stop, 'canRoom'), blame: stop };
    }
    // Two beats, not one: reported together, the bag is drawn leaving a bin that is still
    // halfway down the alley.
    const rolled = cloneState(s);
    cell(rolled, tx, ty).o = NONE;
    cell(rolled, rx, ry).o = o;
    // Tested against `rolled`, not `s`: on a one-cell roll this cell is the bin's own start.
    const back = o === WHEELIE ? [rx - dx, ry - dy] : null;
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

const BAGS_IN = { [BAG]: 1, [CAN_FULL]: 1, [WHEELIE]: 1, [STACK]: 2 };
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
 *
 * Packed one character per cell and offset off 'A' rather than joined as decimals, which turn
 * ambiguous at two digits — `1,0,10` and `10,1,0` both render as "1010".
 */
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
      const terrain = c.water ? 1 : c.bridge ? 2 : 0;        // wall is static; these are not
      kinds += String.fromCharCode(65 + (c.o * 3 + terrain) * 2 + (c.cart !== undefined ? 1 : 0));
      if (c.pid !== undefined) {
        pidLabels ??= new Map();
        if (!pidLabels.has(c.pid)) pidLabels.set(c.pid, pidLabels.size);
        pids += String.fromCharCode(65 + pidLabels.get(c.pid));
      }
      if (c.cart !== undefined) {
        cartLabels ??= new Map();
        if (!cartLabels.has(c.cart)) cartLabels.set(c.cart, cartLabels.size);
        carts += String.fromCharCode(65 + cartLabels.get(c.cart));
      }
    }
  }
  return `${kinds}|${pids}|${carts}|${s.rac.x},${s.rac.y}`;
};
