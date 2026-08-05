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

// A roller leaves from under the shove instead of being followed, which is how one can be
// reached out in the canal. A cart cell reports its CARGO's code, so it has to be excluded
// here or a cart carrying a wheelie bin inherits the exemption and the raccoon walks into
// the water after it.
export const isRoller = c => !isCart(c) && (c.o === WHEELIE || c.o === WHEELIE_EMPTY);

// Pieces that slide exactly one cell when shoved. `slides` is what the piece becomes, `drops`
// what it throws one cell further, `pours` that it writes water there instead. A row with
// neither throws nothing — that is the whole of what an empty can is.
const SLIDES = {
  [CAN_FULL]:  { slides: CAN_EMPTY, drops: BAG },     // ejects its bag and empties
  [STACK]:     { slides: CAN_FULL,  drops: BAG },     // launches the loose bag; the can stays full
  [BIN]:       { slides: BIN,       drops: TRASH },
  [JUG]:       { slides: JUG,       pours: true },
  [CAN_EMPTY]: { slides: CAN_EMPTY },
};

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

// Where an OBJECT can come to rest. Water qualifies — a can, a bag, a bin or a couch all go
// in the canal, and getting one back out is governed by where the raccoon may stand, not here.
export const isOccupiable = (s, x, y) =>
  inGrid(s, x, y) && !cell(s, x, y).wall && !cell(s, x, y).exit
  && cell(s, x, y).o === NONE && !isCart(cell(s, x, y));

/**
 * Where a SHOVED piece may come to rest: everywhere an object rests, plus any cart slot. A
 * full slot is not a refusal — the load shifts along; see `intoCart`.
 *
 * A cart catches nothing. A fan's spray, a bin's dropped trash, a wheelie's ejected bag and a
 * jug's pour go through `isOccupiable` instead, and bounce off. The line is what was pushed
 * against the cart, not what was thrown at it.
 */
export const canRest = (s, x, y) => isOccupiable(s, x, y) || cartAt(s, [x, y]) !== null;

/** The cart a cell belongs to, or null. */
const cartAt = (s, [x, y]) => (inGrid(s, x, y) && isCart(cell(s, x, y)) ? cell(s, x, y).cart : null);

/**
 * Shoving a piece into a cart runs the same internal push a roll does, from the other end: the
 * piece takes the slot it was shoved into, the load shifts one slot away from the shove, and
 * whatever goes past the far slot lands on the ground beyond the cart. A cart is a pipe, and
 * it does not matter which end you feed.
 *
 * Returns the file, the cell past it, and what is about to come out of it — or `blame` when
 * that has nowhere to go.
 */
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

// --- the motion account -------------------------------------------------------------------
// A board says what is where; it never says what moved where. A wheelie bin that rolls five
// cells and leaves its bag behind produces the same board as a bag that appeared there, so a
// renderer left to diff boards has to guess an origin, and the only one available is the cell
// that was shoved. A traced action reports its motion instead.
//
//   moved   something that already existed, going somewhere. `becomes` when its code changes
//           (a full can empties), `parent` when it starts or stops riding a cart.
//   spawned something that did not exist before. `from` is where it flies out of, if anywhere.
//   gone    something that ceased to be — the bag a tear consumed.
//   piece   a rigid body translating as a unit: a couch, or a cart and everything aboard it.
//   impact  this step ended against something immovable, so it does not decelerate into it.
//
// `effect` is how a landing resolves: it rests, it fills a canal cell, or it is a jug's pour.
const mkStep = (over = {}) => ({ moved: [], spawned: [], gone: [], piece: null, impact: false, ...over });
const effectOf = (c, o) => (o === TRASH && c.water ? 'fills' : 'rest');

/** Where a rolling cart may advance: everywhere an object may rest, plus a cell holding a
 *  single-cell occupant, which it takes aboard as it passes. */
const cartCanEnter = (s, x, y) => {
  if (!inGrid(s, x, y)) return false;
  const c = cell(s, x, y);
  return !c.wall && !c.exit && !isCart(c) && !isMultiCell(c.o);
};

/**
 * Shove a cart: it rolls until something stops it, taking aboard what it rolls over, and then
 * unloads backward into the cells it came through.
 *
 * Its cells are grouped into FILES running along the shove — end-on, one file two slots deep;
 * broadside, two files one slot deep. A file's depth is how far cargo travels before it falls
 * out the back, which is the whole of the piece's asymmetry.
 *
 * `entry` is the cart cell the raccoon shoved. He ends up there, unless the unload put
 * something in it first.
 *
 * With `trace`, every board the roll passes through is collected too. Off by default: the
 * frames cost a clone per step and `analyze()` wants only the last one.
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
  // Each file's load, lead-first. `fresh` marks what came aboard on THIS shove: one item, one
  // move, so a thing cannot both enter the cart and leave it on the same push.
  const loads = files.map(f => f.map(([x, y]) => ({ o: cell(s, x, y).o, fresh: false })));
  const repaint = (k, from) => files.forEach((f, i) => f.forEach((p, j) => {
    const c = cell(next, ...at(p, from)); c.o = NONE; c.cart = undefined;
    const d = cell(next, ...at(p, k)); d.cart = cid; d.o = loads[i][j].o;
  }));

  let n = 0;
  for (;;) {
    const ahead = aheadAt(n);
    if (!ahead.every(([x, y]) => cartCanEnter(next, x, y))) break;
    const taken = ahead.map(([x, y]) => cell(next, x, y).o);
    const step = trace ? mkStep({ piece: { kind: 'cart', ref: cid, dx, dy } }) : null;
    const shed = [];
    files.forEach((f, i) => {
      if (taken[i] === NONE) return;               // nothing enters: this load just rides along
      const load = loads[i], out = load[load.length - 1];
      // Nothing in this file moves on the board. Each item shifts one slot back while the cart
      // moves one cell forward, and those cancel exactly — so the file holds still and only
      // who it travels with changes. Riding is a parent, not a position.
      if (step) {
        load.forEach((it, j) => {
          if (it.o === NONE) return;
          const on = at(f[j], n);
          step.moved.push(j === load.length - 1
            ? { o: it.o, from: on, to: on, parent: null, effect: effectOf(cell(next, ...on), it.o) }
            : { o: it.o, from: on, to: on, parent: cid });
        });
        step.moved.push({ o: taken[i], from: ahead[i], to: ahead[i], parent: cid });
      }
      for (let k = load.length - 1; k > 0; k--) load[k] = load[k - 1];
      load[0] = { o: taken[i], fresh: true };
      if (out.o !== NONE) shed.push([at(f[f.length - 1], n), out.o]);
    });
    repaint(n + 1, n);
    n++;
    for (const [[x, y], o] of shed) drop(cell(next, x, y), o);
    if (trace) { frames.push(cloneState(next)); steps.push(step); }
  }
  if (trace && steps.length) steps[steps.length - 1].impact = true;

  // Whatever stopped it, the load settles against the back of the basket and is pushed out
  // into the cells the cart came through, nearest the cart first, until one of them refuses
  // it. Contiguous, so nothing leapfrogs what is already on the ground.
  const tip = trace ? mkStep() : null;
  files.forEach((f, i) => {
    const depth = loads[i].length, trail = f[depth - 1];
    const held = [];
    for (let j = 0; j < depth; j++)
      if (loads[i][j].o !== NONE) held.push({ ...loads[i][j], from: at(f[j], n) });
    if (!held.length) return;

    const out = [];
    for (let k = 1; k <= n && held.length && !held[held.length - 1].fresh; k++) {
      const to = at(trail, n - k);
      if (!isOccupiable(next, ...to)) break;
      out.push({ ...held.pop(), to });
    }
    for (let j = 0; j < depth; j++) cell(next, ...at(f[j], n)).o = NONE;
    held.forEach((it, k) => {
      const to = at(f[depth - held.length + k], n);
      cell(next, ...to).o = it.o;
      if (tip && (it.from[0] !== to[0] || it.from[1] !== to[1]))
        tip.moved.push({ o: it.o, from: it.from, to, parent: cid });
    });
    for (const it of out) {
      if (tip) tip.moved.push({
        o: it.o, from: it.from, to: it.to, parent: null, effect: effectOf(cell(next, ...it.to), it.o),
      });
      drop(cell(next, ...it.to), it.o);
    }
  });
  if (trace && tip.moved.length) { frames.push(cloneState(next)); steps.push(tip); }

  // He follows it in, like every other shove — into the cell he shoved, if the unload has not
  // just filled it. The load claims the run first; he takes what is left. Whether he ends up
  // moving is only known once the unload has resolved, but he is pushing, so if he moves at
  // all he moved on the first cell of travel: every frame after the first carries him there.
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
 * `opts.trace` adds `frames` — every board the action passes through, starting with the one
 * before it and ending with `next` — and `steps`, one per transition, saying what moved.
 * Only a rolling cart has more than one. Opt-in: it costs a clone per step, and `analyze()`
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

  // Everything but a cart resolves in one transition, so one board pair and one step.
  const done = (next, kind, step) => opts.trace
    ? { ok: true, kind, next, frames: [cloneState(s), next], steps: [step] }
    : { ok: true, kind, next };

  const stepOnto = () => {
    const next = cloneState(s);
    next.rac = { x: tx, y: ty };
    return done(next, MOVE, mkStep());          // only the raccoon, and he rides on `rac`
  };

  // Water holds anything except the raccoon. A bridge is floor and never reaches here; it
  // falls through to the ordinary empty-cell path below. What is left is real canal — and
  // every action finishes with him standing in the cell he acted on, except a shoved roller,
  // which leaves from under him while he stays on the bank. So a roller in the canal can be
  // reached and nothing else can, empty water included.
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
      // every speck flies out of the bag, so the fan's cells all share one origin
      step.spawned.push({ o: TRASH, at: [fx, fy], from: [tx, ty], effect: effectOf(c, TRASH) });
      layTrash(c);
    }
    cell(next, tx, ty).o = NONE;
    next.rac = { x: tx, y: ty };
    return done(next, TEAR, step);
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

  // Five pieces share one shape of shove: the piece slides one cell, and for four of them
  // something lands one cell further. Only what lands differs, so the clearance test lives in
  // one place and the empty can is the row that throws nothing.
  if (SLIDES[o]) {
    const { slides, drops, pours } = SLIDES[o];
    const throws = drops !== undefined || pours === true;
    const c1 = [tx + dx, ty + dy], c2 = [tx + 2 * dx, ty + 2 * dy];
    // Piece and load both rest anywhere empty, canal included. The jug is the exception:
    // its spill needs dry ground — see `canPour`.
    // The piece may be shoved into a cart; what it ejects may not — that is thrown, not pushed.
    const fits = pours ? canPour : isOccupiable;
    const blame = [];
    if (!canRest(s, c1[0], c1[1])) blame.push(c1);
    if (throws && !fits(s, c2[0], c2[1])) blame.push(c2);
    const into = cartAt(s, c1);
    let shove = null;
    if (into !== null && !blame.length) {
      shove = intoCart(s, into, c1, dx, dy);
      // A piece that is also throwing something cannot displace the cart's load as well: both
      // would land in the cell past the cart, and only one thing goes in a cell.
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
      drop(cell(next, c2[0], c2[1]), drops);                        // trash fills the canal
    }
    if (shove) applyIntoCart(s, next, into, shove, slides, step);
    else cell(next, c1[0], c1[1]).o = slides;
    cell(next, tx, ty).o = NONE;
    next.rac = { x: tx, y: ty };
    return done(next, PUSH, step);
  }

  // The wheelie bin rolls until something stops it, and a full one dumps its bag out the back
  // on impact — the same act a cart's tip performs, into the cell it just vacated. The one
  // difference is that the raccoon does not follow a bin in, so that cell is always free to
  // him. A cart computes his landing instead; the bin keeps the constant until its shipped
  // pars have been re-verified against the general rule.
  if (isRoller(target)) {
    let rx = tx, ry = ty;
    while (isOccupiable(s, rx + dx, ry + dy)) { rx += dx; ry += dy; }
    if (rx === tx && ry === ty) {
      const stop = [[tx + dx, ty + dy]];
      return { ok: false, reason: reasonFor(s, stop, 'canRoom'), blame: stop };
    }
    // The roll and the dump are two beats, the same way a cart's travel and its tip are. A bin
    // still carrying its bag is a bin that has not hit anything yet — report them as one and
    // the bag is drawn leaving a bin that is still halfway down the alley.
    const rolled = cloneState(s);
    cell(rolled, tx, ty).o = NONE;
    cell(rolled, rx, ry).o = o;                       // still full for the whole of the roll
    // Out the back, into the cell it just vacated — tested against the board the bin has
    // already left, because on a one-cell roll that cell is the bin's own starting square.
    const back = o === WHEELIE ? [rx - dx, ry - dy] : null;
    if (back && !isOccupiable(rolled, back[0], back[1]))
      return { ok: false, reason: reasonFor(s, [back], 'canRoom'), blame: [back] };

    // Untraced, the mid-roll board is not wanted, so it is finished in place rather than cloned.
    const next = opts.trace ? cloneState(rolled) : rolled;
    if (back) {
      cell(next, rx, ry).o = WHEELIE_EMPTY;
      drop(cell(next, back[0], back[1]), BAG);
    }
    if (!opts.trace) return { ok: true, kind: PUSH, next };

    const frames = [cloneState(s), rolled];
    const steps = [mkStep({
      moved: [{ o, from: [tx, ty], to: [rx, ry] }],
      impact: true,                                   // it stopped because something stopped it
    })];
    if (back) {
      frames.push(next);
      steps.push(mkStep({                             // and only now does it empty
        moved: [{ o: WHEELIE, from: [rx, ry], to: [rx, ry], becomes: WHEELIE_EMPTY }],
        spawned: [{ o: BAG, at: back, from: [rx, ry] }],
      }));
    }
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
// One pass, because this runs once per state the solver generates and a room reaches
// hundreds of thousands. The label maps are made lazily — most boards have no furniture and
// no cart, and an empty lane costs nothing.
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
