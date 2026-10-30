// What the crow notices: the game's happenings turned into his event names. It reads only what
// the game already works out — the move's traced account, the refusal, the undo history, the
// dead-board scan, progress, the room file and the clock — and hands each event to the director,
// which decides whether he says anything. No DOM: the game and the headless harness both drive it.
import {
  NONE, BAG, CAN_FULL, CAN_EMPTY, BIN, BIN_EMPTY, WHEELIE, WHEELIE_EMPTY, JUG, JUG_EMPTY,
  FURNITURE, SPONGE, CARDBOARD, PANE, TIRE_H, TIRE_V, BICYCLE, RUG, CHAIR, BROOM, TRASH,
  MOVE, TEAR, DIRS, cell, inGrid, deepCells, stateKey, bagsLeft, exitLit, isWon, BAGS_IN,
  isCabinetClosed, isCabinetOpen, isMagnet, isCarriedBarrow, isCart, isBarrow, cartKindOf,
  isTar, isGrease, isGlass, isGrate, gripTarget, rollsHere,
} from './rules.js';
import { laneOf, CART_LANE, BODY_LANE } from './lanes.js';
import { SLACK, stars } from './progress.js';
import { toState } from './format.js';
import { TUNING } from './crow.js';

// ---- what a board holds ----
const HOLDS = [
  ['bag', o => o === BAG], ['can', o => o === CAN_FULL || o === CAN_EMPTY],
  ['box', o => o === BIN || o === BIN_EMPTY], ['wheelie', o => o === WHEELIE || o === WHEELIE_EMPTY],
  ['jug', o => o === JUG || o === JUG_EMPTY], ['couch', o => o === FURNITURE],
  ['sponge', o => o === SPONGE], ['cardboard', o => o === CARDBOARD], ['pane', o => o === PANE],
  ['tire', o => o === TIRE_H || o === TIRE_V], ['bicycle', o => o === BICYCLE], ['rug', o => o === RUG],
  ['chair', o => o === CHAIR], ['broom', o => o === BROOM],
  ['cabinet', o => isCabinetClosed(o) || isCabinetOpen(o)], ['magnet', isMagnet],
  ['barrow', isCarriedBarrow],
];
const GROUNDS = [
  ['water', c => c.water || c.bridge], ['tar', isTar], ['grease', isGrease], ['glass', isGlass],
  ['grate', isGrate], ['oneway', c => c.oneway !== undefined],
];

/** The names of every piece and ground on a board, as the `meet.*` events spell them. */
export function namesOn(s) {
  const out = new Set();
  for (const o of deepCells(s)) for (const [name, is] of HOLDS) if (is(o)) out.add(name);
  for (const row of s.cells) for (const c of row) {
    if (isCart(c)) out.add(isBarrow(cartKindOf(c)) ? 'barrow' : 'skateboard');
    for (const [name, is] of GROUNDS) if (is(c)) out.add(name);
  }
  return out;
}

const PLURAL = { bag: 'bags', can: 'cans', box: 'boxes', wheelie: 'wheelies' };
const NUMBER = ['', 'a', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven',
  'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'];

/** The full ones the door waits on, as `[name, count]` in the order HOLDS names them. */
export function fullOn(s) {
  const n = new Map();
  for (const o of deepCells(s)) if (BAGS_IN[o]) {
    const [name] = HOLDS.find(([, is]) => is(o));
    n.set(name, (n.get(name) ?? 0) + BAGS_IN[o]);
  }
  return HOLDS.filter(([name]) => n.has(name)).map(([name]) => [name, n.get(name)]);
}

/** The same in his words: "a can", "two bags and a box". */
export function leftOn(s) {
  const kinds = fullOn(s), say = k => NUMBER[k] ?? String(k);
  if (!kinds.length) return null;
  if (kinds.length > 2) return `${say(kinds.reduce((a, [, k]) => a + k, 0))} of 'em, all kinds`;
  return kinds.map(([name, k]) => `${say(k)} ${k === 1 ? name : PLURAL[name]}`).join(' and ');
}

/**
 * The refusal as the player meets it.
 */
export function refusal(s, b) {
  if (b.reason !== 'water') return b.reason;
  const [bx, by] = b.cells[0] ?? [];
  if (bx === undefined || !inGrid(s, bx, by)) return 'water';
  const [dx, dy] = DIRS[b.dir];
  if (bx !== s.rac.x + dx || by !== s.rac.y + dy) return 'pour';
  return cell(s, bx, by).o === NONE ? 'water' : 'afloat';
}

// ---- what one action did, from its account ----
const travel = m => Math.abs(m.dx) + Math.abs(m.dy);
const sign = v => Math.sign(v);
const count = (s, is) => { let n = 0; for (const row of s.cells) for (const c of row) if (is(c)) n++; return n; };
const afloat = c => c.water && (c.o !== NONE || isCart(c));
const stuck = c => isTar(c) && c.o !== NONE;


/** How many magnets have hold of something. */
function gripping(s) {
  let n = 0;
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) if (isMagnet(cell(s, x, y).o) && gripTarget(s, x, y)) n++;
  return n;
}

const CHAINS = ['piece.chain2', 'piece.chain3', 'piece.chain4', 'piece.chain5'];

/** `piece.*` names for one accepted action traced with `{ trace: true }`, and its longest roll. */
export function pieceEvents(r, dir) {
  const out = new Set(), steps = r.steps ?? [], frames = r.frames ?? [];
  if (!steps.length) return { names: out, roll: 0, things: 0 };
  const first = frames[0], last = frames[frames.length - 1];
  let roll = 0, cartRun = 0, things = new Set();
  const [sx, sy] = DIRS[dir];
  steps.forEach((st, k) => {
    const before = frames[k];
    const cartRoll = st.moved.some(m => laneOf(m.handle) === CART_LANE && m.becomes?.lane === CART_LANE && travel(m));
    cartRun = cartRoll ? cartRun + 1 : 0;
    roll = Math.max(roll, cartRun);
    for (const m of st.moved) {
      const lane = laneOf(m.handle), d = travel(m), [x, y] = m.cells[0], o = m.o, to = m.becomes?.o;
      if (d && lane !== 'rac' && m.parent == null) things.add(m.ref !== undefined ? `#${m.ref}` : `${k}:${m.handle}`);
      if (o === CAN_FULL && to === CAN_EMPTY) out.add('piece.canSheds');
      if (o === BIN && to === BIN_EMPTY) out.add('piece.boxTipped');
      if (o === JUG && to === JUG_EMPTY) out.add('piece.jugPours');
      if (!d) continue;
      if (lane === BODY_LANE && o === FURNITURE) out.add('piece.couch');
      const rolled = lane !== CART_LANE && inGrid(before, x, y) && rollsHere(before, x, y, sign(m.dx), sign(m.dy));
      if (rolled) {
        roll = Math.max(roll, d);
        if (o === WHEELIE || o === WHEELIE_EMPTY) out.add('piece.wheelieRolls');
        if (o === TIRE_H || o === TIRE_V) out.add('piece.tireRolls');
        if (o === CHAIR) out.add('piece.chairRolls');
      } else if (d > 1 && lane !== CART_LANE) out.add('piece.grease');
      if (lane === CART_LANE && cartRoll && inGrid(before, x, y) && isCart(cell(before, x, y)) && !isBarrow(cartKindOf(cell(before, x, y))))
        out.add('piece.skateRolls');
      if (m.parent === null && m.dx === -sx && m.dy === -sy && !cartRoll && inGrid(before, x, y)) {
        const c = cell(before, x, y);
        if (isCart(c) && !isBarrow(cartKindOf(c))) out.add('piece.skateSlop');
      }
      if (m.parent != null && inGrid(before, x, y) && !isCart(cell(before, x, y))) {
        const [ex, ey] = [x + m.dx, y + m.dy], after = frames[k + 1];
        if (inGrid(after, ex, ey) && isCart(cell(after, ex, ey)) && isBarrow(cartKindOf(cell(after, ex, ey))))
          out.add('piece.barrowScoops');
      }
    }
    for (const g of st.gone) {
      if (g.effect === 'falls') out.add('piece.grate');
    }
    for (const a of st.spawned) {
      if (a.effect === 'pours' && a.cells.some(([x, y]) => inGrid(before, x, y) && isGrate(cell(before, x, y)))) out.add('piece.grate');
      if (laneOf(a.handle) === BODY_LANE && isCabinetOpen(a.o)) out.add('piece.cabinetOpens');
      if (isCabinetClosed(a.o)) out.add('piece.cabinetShuts');
    }
    if (st.impact && steps[k + 1]?.moved.some(m => travel(m) && laneOf(m.handle) !== 'rac')) out.add('piece.rollerHandoff');
  });
  // The rest has no entry of its own in the account, so it is read off the boards either side.
  if (count(last, c => c.bridge) > count(first, c => c.bridge)) out.add('piece.canalFilled');
  if (count(last, isGlass) > count(first, isGlass)) out.add('piece.glass');
  if (count(last, stuck) > count(first, stuck)) out.add('piece.tar');
  if (count(last, afloat) > count(first, afloat)) out.add('piece.floats');
  if (gripping(last) > gripping(first)) out.add('piece.magnetGrabs');
  const n = things.size;
  if (n >= 2) out.add(CHAINS[Math.min(n, CHAINS.length + 1) - 2]);
  return { names: out, roll, things: n };
}

// ---- the watcher ----

const near = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]);
const OPPOSITE = { u: 'd', d: 'u', l: 'r', r: 'l' };
const RAMBLES = ['idle.rambleTrash', 'idle.rambleFaces', 'idle.rambleShiny', 'idle.rambleRaccoon', 'idle.rambleBags'];
// The story beat that closes an act, by act.
const STORY = { 1: 'story.act1', 2: 'story.act2', 6: 'story.ending' };
const REDO_SAME = ['undo.redoSame', 'undo.redoSame3', 'undo.redoSame10'];

/**
 * The event names the watcher builds from tables and tuning rather than spells out. Checked
 * against the lines when the watcher is made, so a tuning edit fails at load and not mid-move.
 */
export function builtNames(tuning = TUNING) {
  if (tuning.redoSame.length !== REDO_SAME.length) throw new Error('crow: redoSame and its names differ in length');
  return [
    ...[...HOLDS, ...GROUNDS].map(([name]) => `meet.${name}`), 'meet.skateboard',
    ...tuning.sameRefusal.map(n => `refuse.same${n}`),
    ...tuning.lostLadder.map((_, k) => `lost.step${k + 1}`),
    ...REDO_SAME, ...RAMBLES, ...CHAINS, ...Object.values(STORY),
  ];
}

/**
 * `levels` and `acts` are the running order (`acts` as `{ from, to }` index ranges). `progress`
 * is read, never written, and the room in hand is left out of every count taken from it, so the
 * game may record a win before or after it tells the watcher. `memory` is the crow's own, shared
 * with the director.
 */
export function createWatch({ crow, levels, acts, progress, memory, rng, tuning = TUNING }) {
  const T = tuning, mem = memory.data;
  for (const k of builtNames(T)) if (!crow.has(k)) throw new Error(`crow: no event "${k}"`);
  const firstOfRoom = teachRooms(levels);
  const sitting = { started: false, rounds: {}, lost: {}, parRun: 0, leftRun: 0, rambles: [] };
  let v = null, isDead = null;

  // The board on screen, by key: the last action's, or the room's start.
  const here = () => v.stack.at(-1)?.key ?? v.key0;
  const dead = key => isDead ? isDead(key) : null;
  const fire = (key, t, ctx = {}) => crow.fire(key, t, { room: v.id, act: v.act, ...ctx });
  const doneElsewhere = list => list.filter(l => l.id !== v.id && progress.done(l.id)).length;
  const actOf = i => acts.findIndex(a => i >= a.from && i <= a.to);
  const save = () => memory.save();

  function input(t) {
    if (v.dozed) { v.dozed = false; fire('idle.wake', t); }
    v.inputAt = t; v.idleStage = 0; v.idleAt = null; v.faced = false; v.lostIdle = false;
  }

  function attempt(s) {
    Object.assign(v, {
      stack: [], key0: stateKey(s), lost: false, lostMoves: 0, justLost: false, lostThisTry: false, lostKeys: new Set(),
      walkRun: 0, walkSeen: new Map(), paceRun: 0, lastWalk: null, fastRun: 0, slowRun: 0,
      tore: false, same: null, spin: null, refusedAt: [], undoRun: 0, settleAt: null, undone: null,
      bags0: bagsLeft(s), undosThisTry: 0,
    });
  }

  function leave(t) {
    if (!v || v.won || !v.touched) return;
    mem.left[v.id] = true;
    sitting.leftRun++;
    fire('progress.leftUnsolved', t);
    if (sitting.leftRun === T.loseStreak) fire('progress.loseStreak3', t);
  }

  function room(t, i, s) {
    leave(t);
    crow.arrive(t);
    const L = levels[i], a = actOf(i);
    const opened = mem.rooms[L.id] ?? 0;
    v = { id: L.id, i, par: L.par, act: a + 1, won: false, wins: 0, touched: false, undos: 0, restarts: 0,
      refusals: 0, lostCount: 0, redoSame: 0, idleCount: 0, exitDark: 0, inputAt: t, idleStage: 0,
      dozed: false, faced: false, lostIdle: false, faceDir: null, exits: exitsOf(s),
      opened, wasDone: progress.done(L.id), best: progress.best(L.id), prevOpening: null };
    attempt(s);
    sitting.rounds[L.id] = (sitting.rounds[L.id] ?? 0) + 1;
    let opening = false;
    if (!sitting.started) {
      sitting.started = true;
      const everOpened = Object.keys(mem.rooms).length;
      opening = !everOpened;
      const t3 = levels.every(l => progress.stars(l.id, l.par) === 3);
      if (!everOpened) fire('room.firstEver', t);
      else if (levels.every(l => progress.done(l.id))) fire(t3 ? 'room.backAllStars' : 'room.backDone', t);
    }
    if (!opened) fire('room.new', t);
    else if (!v.wasDone) fire('room.unsolvedAgain', t, { n: sitting.rounds[L.id] });
    else fire(progress.stars(L.id, L.par) === 3 ? 'room.replayAtPar' : 'room.replay', t);
    if (firstOfRoom.has(L.id)) fire('room.teach', t);
    const firstOpen = levels.findIndex(l => !progress.done(l.id));
    if (firstOpen >= 0 && i > firstOpen) fire('room.skippedAhead', t);
    if (a >= 0 && i === acts[a].from) {
      // The opening speech says what the first act is.
      if (!opening) fire('room.actFirst', t);
      if (v.act >= 5) fire('story.late', t);
    }
    if (a >= 0 && i === acts[a].to) fire('room.actLast', t);
    if (L.par <= T.tinyPar) fire('room.tiny', t);
    if (L.par >= T.hugePar) fire('room.huge', t);
    const has = namesOn(s);
    if (has.has('couch')) fire('room.hasCouch', t);
    if (has.has('pane')) fire('room.hasPane', t);
    if (has.has('skateboard')) fire('room.hasSkateboard', t);
    for (const name of has) fire(`meet.${name}`, t);
    mem.rooms[L.id] = opened + 1;
    save();
    isDead = null;
  }

  function restart(t, s) {
    crow.rewind(t);
    input(t);
    const was = v.lost, n = v.stack.length;
    fire('restart.first', t);
    if (n > 0 && n <= T.restartEarly) fire('restart.early', t, { n });
    if (n >= T.restartDeep) fire('restart.deep', t);
    if (n > 0 && was) fire('restart.fromLost', t);
    else if (n > 0 && dead(here()) === false) fire('restart.stillWinnable', t);
    v.restarts++;
    if (v.restarts === T.manyRestarts) fire('restart.many', t, { n: v.restarts });
    v.prevOpening = opening();
    attempt(s);
    v.won = false;
  }

  /** The dead-board answer for this room has landed. `fn(stateKey)` is true on a lost board. */
  function scanned(t, fn) {
    isDead = fn;
    if (!v.lost && !v.won && fn(here())) lostNow(t, false, here());
  }

  const opening = () => v.stack.slice(0, T.sameOpening).map(m => m.dir + m.kind).join();

  function lostNow(t, byWalk, key) {
    v.lost = true; v.justLost = true; v.lostMoves = 0;
    // Stepping back into a lost board after an undo is the same loss, not another one.
    if (v.lostKeys.has(key)) return;
    v.lostKeys.add(key); v.lostCount++; v.lostThisTry = true;
    const n = sitting.lost[v.id] = (sitting.lost[v.id] ?? 0) + 1;
    fire('lost.firstEver', t);
    fire('lost', t, { count: n, n });
    if (byWalk) fire('lost.byWalk', t);
  }

  function action(t, dir, r, prev) {
    const gap = t - v.inputAt;
    input(t);
    const s = r.next, kind = r.kind, from = here(), key = stateKey(s);
    v.touched = true; v.faceDir = dir;
    crow.recount(t, leftOn(s));
    v.stack.push({ dir, kind, key });
    if (v.undone && v.undone.key === from && v.undone.dir === dir) {
      v.redoSame++;
      const at = T.redoSame.indexOf(v.redoSame);
      if (at >= 0) fire(REDO_SAME[at], t);
    }
    v.undone = null; v.undoRun = 0; v.settleAt = null;
    v.same = null; v.spin = null;

    if (v.stack.length === T.sameOpening && v.prevOpening === opening()) fire('restart.sameOpening', t);
    if (v.stack.length === 1 && kind === TEAR) fire('tear.beforeLooking', t);

    v.fastRun = gap <= T.fastGapMs ? v.fastRun + 1 : 1;
    v.slowRun = gap >= T.slowGapMs ? v.slowRun + 1 : 0;
    if (v.fastRun === T.fastRun) fire('walk.fastRun', t);
    if (v.slowRun === T.slowRun) fire('walk.slowThink', t);

    if (kind === MOVE) walked(t, dir, prev, s, from, key);
    else { v.walkRun = 0; v.paceRun = 0; v.walkSeen = new Map(); v.lastWalk = null; }

    const before = bagsLeft(prev), after = bagsLeft(s), lit = exitLit(s);
    const verdict = dead(key);
    const last = after < before && lit && verdict !== null;
    if (kind === TEAR) {
      if (!v.tore) { v.tore = true; if (!last) fire('tear.first', t); }
      if (verdict === false && !lit) fire('tear.stillWinnable', t);
      const trash = (r.steps ?? []).flatMap(st => st.spawned.filter(a => a.o === TRASH).flatMap(a => a.cells));
      if (trash.some(c => v.exits.some(e => near(c, e) === 1))) fire('tear.byExit', t);
    }
    if (after < before) {
      if (lit) {
        if (verdict === true) fire('tear.lastButSealed', t);
        else if (verdict === false) fire('tear.last', t);
      } else if (after === 1 && v.bags0 >= 2) fire('tear.oneLeft', t, { left: leftOn(s) });
      else if (after > 0 && v.bags0 >= T.halfBags && before > v.bags0 / 2 && after <= v.bags0 / 2)
        fire('tear.half', t, { left: leftOn(s) });
    }

    const p = pieceEvents(r, dir);
    for (const name of p.names) fire(name, t);
    if (p.roll >= T.longRoll) fire('piece.longRoll', t, { n: p.roll });
    if (p.roll >= T.longestRollMin && p.roll > (mem.flags.longestRoll ?? 0)) {
      mem.flags.longestRoll = p.roll; save();
      fire('piece.longestRoll', t, { n: p.roll });
    }

    v.justLost = false;
    if (verdict === true && !v.lost) lostNow(t, kind === MOVE, key);
    else if (verdict === true) {
      v.lostMoves++;
      const step = T.lostLadder.indexOf(v.lostMoves);
      const keys = [v.key0, ...v.stack.map(m => m.key)];
      if (step >= 0) fire(`lost.step${step + 1}`, t, { n: keys.length - 1 - keys.findLastIndex(k => dead(k) === false) });
    } else if (verdict === false) v.lost = false;

    if (isWon(s)) won(t);
  }

  function walked(t, dir, prev, s, from, key) {
    v.walkRun++;
    if (v.walkRun === T.longWalk) fire('walk.long', t);
    v.paceRun = v.lastWalk === OPPOSITE[dir] ? v.paceRun + 1 : 1;
    v.lastWalk = dir;
    if (v.paceRun === T.pacing) fire('walk.pacing', t);
    const seen = v.walkSeen.get(key);
    if (seen !== undefined && v.walkRun - seen >= T.loopMin && v.paceRun < 2) fire('walk.loop', t);
    if (v.walkSeen.size === 0) v.walkSeen.set(from, 0);
    v.walkSeen.set(key, v.walkRun);
    const at = [s.rac.x, s.rac.y], was = [prev.rac.x, prev.rac.y];
    const lit = exitLit(s);
    if (!lit && v.exits.some(e => near(e, at) === 0)) {
      const left = leftOn(s);
      if (!left) fire('walk.exitDarkCart', t);
      else fire(++v.exitDark === 1 ? 'walk.exitDark' : 'walk.exitDarkAgain', t, { left });
    }
    const gap = p => Math.min(...v.exits.map(e => near(e, p)));
    if (lit && gap(was) === 1 && gap(at) > 1) fire('walk.exitThenAway', t);
  }

  function won(t) {
    const n = v.stack.length, par = v.par, firstWin = !v.wasDone;
    const firstTry = firstWin && !v.opened && v.restarts === 0;
    const prevStars = stars(v.best, par), nowStars = stars(Math.min(v.best ?? Infinity, n), par);
    if (n < par) fire('win.underPar', t);
    else if (n === par) {
      fire('win.par', t);
      // A first try is the rarer praise.
      if (v.undosThisTry === 0 && v.restarts === 0 && !firstTry) fire('win.perfect', t);
    } else fire(n <= Math.ceil(par * SLACK) ? 'win.overPar' : 'win.wayOverPar', t);
    if (v.undosThisTry >= T.winUndos) fire('win.manyUndos', t, { n: v.undosThisTry });
    if (v.restarts >= T.winRestarts) fire('win.manyRestarts', t, { n: v.restarts });
    if (v.best !== null && n < v.best) fire('win.beatBest', t);
    if (v.best !== null && nowStars > prevStars) fire('win.starUp', t);
    if (v.lostThisTry) fire('win.afterLost', t);
    if (firstTry) fire('win.firstTry', t);
    if ((sitting.lost[v.id] ?? 0) >= T.nemesis) fire('win.nemesis', t);
    if (mem.left[v.id]) { fire('win.cameBack', t); delete mem.left[v.id]; save(); }
    if (!v.wins++) {
      sitting.parRun = n <= par ? sitting.parRun + 1 : 0;
      if (T.streak.includes(sitting.parRun)) fire('win.streak', t, { n: sitting.parRun });
      sitting.leftRun = 0;
    }
    if (firstWin) {
      const done = doneElsewhere(levels) + 1;
      if (done % 10 === 0) fire('progress.rooms10', t, { n: done });
      const a = acts[v.act - 1];
      if (a) {
        const total = a.to - a.from + 1;
        const before = doneElsewhere(levels.slice(a.from, a.to + 1));
        const half = Math.ceil(total / 2);
        if (before < half && before + 1 >= half && before + 1 < total) fire('progress.halfAct', t);
        if (before + 1 === total) fire(STORY[v.act] ?? 'progress.actDone', t);
      }
    }
    v.won = true; v.wasDone = true; v.best = Math.min(v.best ?? Infinity, n);
    v.lost = false;
  }

  function refused(t, dir, r, s) {
    input(t);
    v.touched = true; v.faceDir = dir;
    v.walkRun = 0; v.paceRun = 0;
    const why = refusal(s, { cells: r.blame, reason: r.reason, dir });
    fire(`refuse.${why}`, t);
    v.refusals++;
    if (v.refusals === T.manyRefusals) fire('refuse.manyInRoom', t, { n: v.refusals });
    const sig = stateKey(s) + dir;
    v.same = v.same?.sig === sig ? { sig, n: v.same.n + 1 } : { sig, n: 1 };
    if (T.sameRefusal.includes(v.same.n)) fire(`refuse.same${v.same.n}`, t);
    v.refusedAt = [...v.refusedAt.filter(e => t - e.t <= T.flailMs), { t, why }];
    if (v.refusedAt.length >= T.flail && new Set(v.refusedAt.map(e => e.why)).size >= 2) {
      fire('refuse.flailing', t); v.refusedAt = [];
    }
    const at = `${s.rac.x},${s.rac.y}`;
    v.spin = v.spin?.at === at ? v.spin : { at, dirs: new Set() };
    v.spin.dirs.add(dir);
    if (v.spin.dirs.size === 2) fire('walk.spin', t);
  }

  function busy(t) { input(t); fire('refuse.busy', t); }

  function undo(t) {
    crow.rewind(t);
    input(t);
    const was = v.lost, { dir } = v.stack.pop(), verdict = dead(here());
    v.undos++; v.undosThisTry++; v.undoRun++;
    fire('undo.firstEver', t);
    if (v.justLost && verdict === false) fire('undo.losingMove', t);
    else if (was && verdict === false) fire('lost.undoneOut', t);
    else if (!was && verdict === false) fire('undo.fine', t);
    if (v.undoRun === T.farBack) fire('undo.farBack', t);
    if (!v.stack.length && v.undoRun >= T.toStartMin) fire('undo.toStart', t);
    if (v.undos === T.manyUndos) fire('undo.many', t, { n: v.undos });
    v.undone = { key: here(), dir };
    v.justLost = false;
    v.lost = verdict === true;
    v.lostMoves = 0;
    v.settleAt = v.lost ? t + T.undoSettleMs : null;
    v.walkRun = 0; v.paceRun = 0; v.walkSeen = new Map(); v.lastWalk = null;
    v.won = false;
  }

  /** `s` is the board on screen. */
  function tick(t, s) {
    if (!v) return;
    const idle = t - v.inputAt;
    if (v.settleAt !== null && t >= v.settleAt) { v.settleAt = null; if (v.lost) fire('undo.notFarEnough', t); }
    if (!v.faced && !v.won && idle >= T.facingMs && v.faceDir) {
      v.faced = true;
      const [dx, dy] = DIRS[v.faceDir], x = s.rac.x + dx, y = s.rac.y + dy;
      if (inGrid(s, x, y) && cell(s, x, y).o === BAG) fire('tear.facing', t);
    }
    if (v.lost && !v.lostIdle && idle >= T.lostIdleMs) {
      v.lostIdle = true;
      fire(v.lostCount >= T.yodaLost ? 'lost.yoda' : 'lost.idle', t);
    }
    if (v.idleStage < 1 && idle >= T.idleMs) {
      v.idleStage = 1;
      fire(v.idleCount++ ? 'idle.second' : 'idle.first', t);
    }
    if (v.idleStage < 2 && idle >= T.rambleMs) {
      v.idleStage = 2;
      if (!sitting.rambles.length) sitting.rambles = [...RAMBLES];
      fire(sitting.rambles.splice(Math.floor(rng() * sitting.rambles.length), 1)[0], t);
    }
    if (v.idleStage < 3 && idle >= T.dozeMs) { v.idleStage = 3; v.dozed = true; fire('idle.doze', t); }
  }

  /** The room's counters at `t`, for the debug panel. Null before the first room. */
  function peek(t) {
    if (!v) return null;
    const d = dead(here());
    return { walks: v.walkRun, fastRun: v.fastRun, refusals: v.refusals, same: v.same?.n ?? 0, undos: v.undos,
      restarts: v.restarts, idle: t - v.inputAt, verdict: d === null ? 'unknown' : d ? 'lost' : 'winnable',
      attempt: v.restarts + 1, losses: v.lostCount, lostMoves: v.lostMoves };
  }

  return { room, restart, scanned, action, refused, busy, undo, tick, peek, key: t => v && input(t) };
}

/** Rooms that are the first, in running order, to hold some piece or ground. */
export function teachRooms(levels) {
  const seen = new Set(), out = new Set();
  for (const l of levels) {
    const has = namesOn(toState(l));
    if ([...has].some(n => !seen.has(n))) out.add(l.id);
    for (const n of has) seen.add(n);
  }
  return out;
}

function exitsOf(s) {
  const out = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) if (cell(s, x, y).exit) out.push([x, y]);
  return out;
}
