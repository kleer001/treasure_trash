import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { rampGroups, UPGRADE, SET_TOP_MIN, PAR_MIN, PAR_MAX } from '../tools/sets.mjs';
import { chooseSets } from '../tools/pick.mjs';
import { toState } from '../src/format.js';
import { bagsLeft } from '../src/rules.js';

// The invariants are asserted against the sets the search actually produced. Re-running the
// builders here would cost minutes per test and would check a different sample than ships.
const SETS = readFileSync('levels/sets.jsonl', 'utf8').trim().split('\n').map(JSON.parse);
const bagsOf = r => bagsLeft(toState({ id: 't', grid: r.grid, ...(r.cart && { cart: r.cart }) }));
const bodies = g => g.join('').replace(/[-#]/g, '').length;
const occupied = g => new Set(g.flatMap((row, y) =>
  [...row].map((ch, x) => (ch !== '-' && ch !== '#' ? `${x},${y}` : null)).filter(Boolean)));

test('the search produced sets of exactly three rooms', () => {
  assert.ok(SETS.length > 0, 'no candidate sets on disk');
  for (const s of SETS) assert.equal(s.rooms.length, 3, `${s.ramp} ${s.shape}`);
});

test('every set climbs, and stays in band while it does', () => {
  for (const s of SETS) {
    const pars = s.rooms.map(r => r.par);
    assert.ok(pars[0] < pars[1] && pars[1] < pars[2], `${s.ramp} ${s.shape}: pars ${pars}`);
    for (const p of pars) assert.ok(p >= PAR_MIN && p <= PAR_MAX, `par ${p} out of band`);
  }
});

// Where the top rung lands is asked of the file at SELECTION, not of every candidate in it:
// `resite` runs after the search and gives back the par a set was padding with, so a candidate
// may drop under the floor between being found and being chosen.
test('a set that no longer reaches Act 2 is not chosen', () => {
  const { sets } = chooseSets(SETS, { want: SETS.length });
  for (const s of sets)
    assert.ok(s.rooms[2].par >= SET_TOP_MIN, `${s.ramp} ${s.shape} tops out at ${s.rooms[2].par}`);
  assert.ok(SETS.some(s => s.rooms[2].par < SET_TOP_MIN),
    'nothing under the floor on disk, so this proves nothing — check the fixture');
});

test('every room has something to clear and a way to lose', () => {
  for (const s of SETS) for (const r of s.rooms) {
    assert.ok(bagsOf(r) >= 1, `${s.ramp} ${s.shape}: nothing to clear`);
    assert.ok(r.traps >= 1, `${s.ramp} ${s.shape}: no way to lose`);
  }
});

// The upgrade ramp's whole claim: the board does not change, the containers do.
test('an upgrade set moves nothing — it only fills containers', () => {
  const ups = SETS.filter(s => s.ramp === 'upgrade');
  assert.ok(ups.length > 0, 'the search found no upgrade sets to check');
  for (const s of ups) {
    const [a, b, c] = s.rooms.map(r => r.grid);
    assert.equal(bodies(a), bodies(b), `${s.shape}: a body appeared`);
    assert.equal(bodies(b), bodies(c), `${s.shape}: a body appeared`);
    assert.deepEqual(occupied(a), occupied(b), `${s.shape}: something moved`);
    assert.deepEqual(occupied(b), occupied(c), `${s.shape}: something moved`);
    // Only container cells may differ, and only ever empty -> full.
    for (const [p, q] of [[a, b], [b, c]])
      p.forEach((row, y) => [...row].forEach((ch, x) => {
        if (ch === q[y][x]) return;
        assert.equal(UPGRADE[ch], q[y][x], `${s.shape}: (${x},${y}) went ${ch} -> ${q[y][x]}`);
      }));
    const bags = s.rooms.map(bagsOf);
    assert.ok(bags[0] < bags[1] && bags[1] < bags[2], `${s.shape}: bags ${bags}`);
  }
});

test('an addition set leaves every earlier piece where it stood', () => {
  for (const s of SETS.filter(x => x.ramp === 'addition')) {
    const [a, b, c] = s.rooms.map(r => r.grid);
    for (const cell of occupied(a)) assert.ok(occupied(b).has(cell), `${s.shape}: ${cell} moved`);
    for (const cell of occupied(b)) assert.ok(occupied(c).has(cell), `${s.shape}: ${cell} moved`);
    assert.ok(occupied(b).size > occupied(a).size, `${s.shape}: no body was added`);
  }
});

test('a par set shows the same cast three times', () => {
  for (const s of SETS.filter(x => x.ramp === 'par'))
    for (const r of s.rooms) assert.equal(r.group, s.group, `${s.shape}: mixture changed`);
});

test('every room in a set stands on the same outline', () => {
  for (const s of SETS) {
    const walls = g => g.map(row => [...row].map(ch => (ch === '#' ? '#' : '-')).join(''));
    const first = walls(s.rooms[0].grid);
    for (const r of s.rooms) assert.deepEqual(walls(r.grid), first, `${s.shape}: outline changed`);
  }
});

// --- deriving the ramp groups (pure, no search) ------------------------------

const FERTILE = readFileSync('levels/fertility.jsonl', 'utf8').trim().split('\n')
  .map(JSON.parse).filter(r => r.interesting >= 6).map(r => r.group);
const GROUPS = rampGroups(FERTILE);

test('an upgrade base is a fertile mixture with two containers emptied', () => {
  assert.ok(GROUPS.upgrade.length > 0);
  for (const base of GROUPS.upgrade)
    assert.ok([...base].filter(c => UPGRADE[c]).length >= 2, `${base} cannot climb two rungs`);
});

test('an addition base is one piece short, and what goes back in carries a bag', () => {
  for (const a of GROUPS.addition.slice(0, 40)) {
    assert.equal(a.extras.length, 2);
    assert.ok('$CWB'.includes(a.extras[1]), `${a.extras[1]} adds furniture, not work`);
  }
});

// --- choosing the act --------------------------------------------------------

const fakeSet = (over = {}) => ({
  ramp: 'par', shape: 'H 8x5 x', group: 'xBBj',
  rooms: [16, 20, 24].map(par => ({ par, onPath: 0.1, group: 'xBBj', grid: ['--'], solve: 'r', traps: 2, solves: 1 })),
  ...over,
});

test('one outline per set, so ten sets are ten different shapes', () => {
  assert.equal(chooseSets(Array.from({ length: 30 }, () => fakeSet()), { want: 10 }).sets.length, 1);
});

test('the act climbs in the axis it was ranked on', () => {
  const mk = (on, i) => fakeSet({
    shape: `shape${i}`,
    rooms: [16, 20, 24].map(par => ({ par, onPath: on, group: 'xBBj', grid: ['--'], solve: 'r', traps: 2, solves: 1 })),
  });
  const { sets } = chooseSets([mk(0.3, 1), mk(0.05, 2), mk(0.2, 3)], { want: 3 });
  const on = sets.map(s => s.rooms[0].onPath);
  for (let i = 1; i < on.length; i++) assert.ok(on[i] >= on[i - 1], `onPath should ascend, got ${on}`);
});

test('no single ramp may run the whole act', () => {
  const many = Array.from({ length: 30 }, (_, i) => fakeSet({ shape: `s${i}` }));
  const { byRamp } = chooseSets(many, { want: 10, maxPerRamp: 4 });
  assert.ok(byRamp.par <= 4, `par ran ${byRamp.par} sets`);
});

test('coming up short is reported rather than padded', () => {
  const { sets, short } = chooseSets([fakeSet({ shape: 'a' }), fakeSet({ shape: 'b' })], { want: 10 });
  assert.equal(sets.length, 2);
  assert.equal(short, 8);
});
