import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLevelPack, toState, parseLurd } from '../src/format.js';
import { explain, stateKey, isWon, bagsLeft, MOVE, TEAR, NONE } from '../src/rules.js';
import { createProgress } from '../src/progress.js';
import { createCrowMemory, TUNING } from '../src/crow.js';
import { createWatch, teachRooms, pieceEvents, refusal, fullOn, leftOn } from '../src/crowWatch.js';

const CROW = JSON.parse(readFileSync(new URL('../dialogue/crow.json', import.meta.url), 'utf8'));
const LEVELS = ['act1.tt', 'act2.tt'].flatMap(a => parseLevelPack(readFileSync(`levels/${a}`, 'utf8')).levels);
const ACTS = [{ from: 0, to: LEVELS.length - 1 }];
const OPP = { l: 'r', r: 'l', u: 'd', d: 'u' };
const store = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

/** Rooms from grids, each a list of rows with one exit; `water` rows lay terrain, `cart` rows carts. */
const pack = rooms => parseLevelPack(`:pack t\n:format 1\n${rooms.map(([grid, water, cart], i) =>
  `:level R${i}\n:par 1\n:solve r\n:grid\n${grid.join('\n')}\n:end\n${water ? `:water\n${water.join('\n')}\n:end\n` : ''}`
  + `${cart ? `:cart\n${cart.join('\n')}\n:end\n` : ''}`).join('')}`).levels;
const board = (grid, water) => toState(pack([[grid, water]])[0]);

function watcher({ levels = LEVELS, acts = ACTS, progress = createProgress(store()), memory = createCrowMemory(store()), tuning } = {}) {
  const fired = [];
  const crow = { fire: (key, t, ctx) => fired.push({ key, t, ctx }), arrive() {}, rewind() {}, recount() {}, has: k => k in CROW };
  const watch = createWatch({ crow, levels, acts, progress, memory, rng: () => 0, tuning });
  return { watch, fired, keys: () => fired.map(f => f.key), last: key => fired.findLast(f => f.key === key) };
}

function pacingRoom() {
  const walk = (s, d) => { const a = explain(s, d); return a.ok && a.kind === MOVE && !isWon(a.next) ? a.next : null; };
  for (let i = 0; i < LEVELS.length; i++) {
    const s = toState(LEVELS[i]);
    for (const d of 'lrud') {
      const s1 = walk(s, d), s2 = s1 && walk(s1, d);
      if (s2 && walk(s2, OPP[d]) && walk(s1, OPP[d])) return { i, s, d };
    }
  }
  throw new Error('no room lets the raccoon pace');
}

test('a room teaches when it is the first to hold some piece or ground', () => {
  const rooms = pack([
    [['####', '#@E#', '####']],
    [['#####', '#@$E#', '#####']],
    [['#####', '#@$E#', '#####']],
    [['#####', '#@CE#', '#####']],
  ]);
  assert.deepEqual([...teachRooms(rooms)], ['R1', 'R3']);
});

test('a shove names what the piece did', () => {
  const cases = [
    [['#######', '#@C---#', '#E#####'], null, 'piece.canSheds'],
    [['#######', '#@B---#', '#E#####'], null, 'piece.boxTipped'],
    [['#######', '#@W---#', '#E#####'], null, 'piece.wheelieRolls'],
    [['#######', '#@j---#', '#E#####'], null, 'piece.jugPours'],
    [['#######', '#@c---#', '#E#####'], ['-------', '--%%%--', '-------'], 'piece.grease'],
    [['#######', '#@c---#', '#E#####'], ['-------', '---~---', '-------'], 'piece.floats'],
  ];
  for (const [grid, water, name] of cases) {
    const r = explain(board(grid, water), 'r', { trace: true });
    assert.ok(pieceEvents(r, 'r').names.has(name), name);
  }
});

test('one refusal reason, water, is three different noes', () => {
  const s = board(['######', '#@$--#', '#E####']);
  const no = (x, y) => refusal(s, { reason: 'water', cells: [[x, y]], dir: 'r' });
  assert.equal(no(3, 1), 'pour');
  assert.equal(no(2, 1), 'afloat');
  s.cells[1][2].o = NONE;
  assert.equal(no(2, 1), 'water');
  assert.equal(refusal(s, { reason: 'wall', cells: [[2, 1]], dir: 'r' }), 'wall');
});

test('a tuning that names an event the lines lack fails when the watcher is made', () => {
  assert.throws(() => watcher({ tuning: { ...TUNING, sameRefusal: [3, 6] } }), /refuse\.same6/);
});

test('on a lost board, the ladder counts the moves back to the last board that could be won', () => {
  const { watch, last } = watcher();
  const { i, s: s0, d } = pacingRoom();
  watch.room(0, i, s0);
  const k0 = stateKey(s0);
  watch.scanned(0, k => k !== k0);
  let s = s0, dir = d, t = 0;
  const top = TUNING.lostLadder.at(-1);
  for (let k = 0; k <= top; k++) {
    const r = explain(s, dir, { trace: true });
    watch.action(t += 1000, dir, r, s);
    s = r.next; dir = k % 2 ? OPP[d] : d;
  }
  assert.equal(last('lost.step4').ctx.n, top + 1);
});

test('a lost board counts once an attempt: an undo and the same move again is the same loss', () => {
  const { watch, fired } = watcher();
  const { i, s: s0, d } = pacingRoom();
  const losses = () => fired.filter(f => f.key === 'lost').length;
  watch.room(0, i, s0);
  const k0 = stateKey(s0);
  watch.scanned(0, k => k !== k0);
  const r = explain(s0, d, { trace: true });
  let t = 0;
  watch.action(t += 1000, d, r, s0);
  assert.equal(losses(), 1);
  watch.undo(t += 1000);
  watch.action(t += 1000, d, r, s0);
  assert.equal(losses(), 1);
  watch.restart(t += 1000, s0);
  watch.action(t += 1000, d, r, s0);
  assert.equal(losses(), 2);
});

test('a counted line is handed its count', () => {
  const { watch, last } = watcher();
  const { i, s: s0, d } = pacingRoom();
  watch.room(0, i, s0);
  let t = 0;
  for (let k = 0; k < TUNING.manyUndos; k++) {
    watch.action(t += 1000, d, explain(s0, d, { trace: true }), s0);
    watch.undo(t += 1000);
  }
  assert.equal(last('undo.many').ctx.n, TUNING.manyUndos);
});

/** Wins room `i` by its solution from `t`, and returns the time of the win. */
function winRoom(watch, progress, i, { recordFirst = false, t = 0 } = {}) {
  const L = LEVELS[i];
  let s = toState(L);
  watch.room(t, i, s);
  const acts = parseLurd(L.solve, L.id);
  acts.forEach((a, k) => {
    const r = explain(s, a.dir, { trace: true }), last = k === acts.length - 1;
    if (last && recordFirst) progress.record(L.id, acts.length);
    watch.action(t += 1000, a.dir, r, s);
    if (last && !recordFirst) progress.record(L.id, acts.length);
    s = r.next;
  });
  return t;
}
const winL0 = (watch, progress, recordFirst) => winRoom(watch, progress, 0, { recordFirst });

test('the rooms-done count is the same whether the win is recorded before or after he hears of it', () => {
  for (const recordFirst of [true, false]) {
    const progress = createProgress(store());
    for (const L of LEVELS.slice(1, 10)) progress.record(L.id, L.par);
    const { watch, last } = watcher({ progress });
    winL0(watch, progress, recordFirst);
    assert.equal(last('progress.rooms10')?.ctx.n, 10, `recorded ${recordFirst ? 'before' : 'after'}`);
  }
});

test('a room counts once towards a streak, however often an undo lets it be won again', () => {
  const progress = createProgress(store());
  const { watch, fired } = watcher({ progress, tuning: { ...TUNING, streak: [2] } });
  winL0(watch, progress, false);
  const L = LEVELS[0], acts = parseLurd(L.solve, L.id);
  let s = toState(L);
  for (const a of acts.slice(0, -1)) s = explain(s, a.dir).next;
  const lastAct = acts.at(-1);
  for (let k = 0; k < 3; k++) {
    watch.undo(10000 + k * 2000);
    watch.action(11000 + k * 2000, lastAct.dir, explain(s, lastAct.dir, { trace: true }), s);
  }
  assert.equal(fired.filter(f => f.key === 'win.streak').length, 0);
});

test('the streak is named at its counts, not at every par win between them', () => {
  const progress = createProgress(store());
  const { watch, fired } = watcher({ progress, tuning: { ...TUNING, streak: [2, 4] } });
  let t = 0;
  for (let i = 0; i < 5; i++) t = winRoom(watch, progress, i, { t: t + 1000 });
  assert.deepEqual(fired.filter(f => f.key === 'win.streak').map(f => f.ctx.n), [2, 4]);
});

test('a first try at par is praised as a first try, not also as perfect', () => {
  const progress = createProgress(store());
  const { watch, keys } = watcher({ progress });
  winL0(watch, progress, false);
  assert.ok(keys().includes('win.par') && keys().includes('win.firstTry'));
  assert.ok(!keys().includes('win.perfect'));
});

test('the last room of an act is said by the act\'s story line, and by the act-done line only without one', () => {
  for (const [act, said, not] of [[0, 'story.act1', 'progress.actDone'], [2, 'progress.actDone', 'story.act1']]) {
    const progress = createProgress(store());
    const { watch, keys } = watcher({ progress, acts: [0, 1, 2].map(i => ({ from: i, to: i })) });
    winRoom(watch, progress, act);
    assert.ok(keys().includes(said), `act ${act + 1}: ${said}`);
    assert.ok(!keys().includes(not), `act ${act + 1}: no ${not}`);
  }
});

test('he counts the full ones by kind, and the kinds add up to what the door waits on', () => {
  for (const a of ['act1.tt', 'act2.tt', 'sandbox.tt'])
    for (const L of parseLevelPack(readFileSync(`levels/${a}`, 'utf8')).levels) {
      const s = toState(L);
      assert.equal(fullOn(s).reduce((n, [, k]) => n + k, 0), bagsLeft(s), L.id);
    }
  assert.equal(leftOn(board(['#####', '#@C-#', '#E###'])), 'a can');
  assert.equal(leftOn(board(['#######', '#@$$B-#', '#E#####'])), 'two bags and a box');
  assert.equal(leftOn(board(['#######', '#@$CBW#', '#E#####'])), "four of 'em, all kinds");
  assert.equal(leftOn(board(['#####', '#@c-#', '#E###'])), null);
});

test('the one-left and dark-door lines carry what is still full; a dark door with nothing full is the cart', () => {
  const levels = pack([
    [['########', '#------#', '#@$----#', '#------#', '#$-----#', '#E######']],
    [['######', '#@E-C#', '######']],
    [['#######', '#@E-x-#', '#######'], null, ['-------', '----PP-', '-------']],
  ]);
  const { watch, last, keys } = watcher({ levels, acts: [{ from: 0, to: levels.length - 1 }] });
  const press = (i, dir, t) => {
    const s = toState(levels[i]);
    watch.room(t, i, s);
    const r = explain(s, dir, { trace: true });
    watch.action(t + 500, dir, r, s);
    return r;
  };
  assert.equal(press(0, 'r', 0).kind, TEAR);
  assert.equal(last('tear.oneLeft').ctx.left, 'a bag');
  press(1, 'r', 10000);
  assert.equal(last('walk.exitDark').ctx.left, 'a can');
  press(2, 'r', 20000);
  assert.ok(keys().includes('walk.exitDarkCart'));
  assert.equal(keys().filter(k => k.startsWith('walk.exitDark')).length, 2);
});

test('one rip that is both the first and the last is said as the last', () => {
  const i = LEVELS.findIndex(L => bagsLeft(toState(L)) === 1 && parseLurd(L.solve, L.id).reduce(
    ({ s, tore }, a) => { const r = explain(s, a.dir); return { s: r.next, tore: tore || r.kind === TEAR }; },
    { s: toState(L), tore: false }).tore);
  assert.ok(i >= 0, 'a room with one bag, torn');
  const { watch, keys } = watcher();
  let s = toState(LEVELS[i]), t = 0;
  watch.room(t, i, s);
  watch.scanned(t, () => false);
  for (const a of parseLurd(LEVELS[i].solve, LEVELS[i].id)) {
    const r = explain(s, a.dir, { trace: true });
    watch.action(t += 1000, a.dir, r, s);
    s = r.next;
  }
  assert.ok(keys().includes('tear.last'));
  assert.ok(!keys().includes('tear.first'));
});

test('the opening speech says what the first act is; a later sitting hears the act\'s own line', () => {
  const memory = createCrowMemory(store());
  const first = watcher({ memory });
  first.watch.room(0, 0, toState(LEVELS[0]));
  assert.ok(first.keys().includes('room.firstEver'));
  assert.ok(!first.keys().includes('room.actFirst'));
  const later = watcher({ memory });
  later.watch.room(0, 0, toState(LEVELS[0]));
  assert.ok(later.keys().includes('room.actFirst'));
});

test('peek counts what the room has seen, and says whether the board is lost', () => {
  const { watch } = watcher();
  assert.equal(watch.peek(0), null);
  const { i, s, d } = pacingRoom();
  watch.room(0, i, s);
  assert.equal(watch.peek(0).verdict, 'unknown');
  watch.action(100, d, explain(s, d, { trace: true }), s);
  watch.scanned(150, () => false);
  const p = watch.peek(1100);
  assert.deepEqual([p.walks, p.idle, p.verdict, p.attempt, p.losses], [1, 1000, 'winnable', 1, 0]);
  watch.restart(1200, s);
  assert.equal(watch.peek(1200).attempt, 2);
});
