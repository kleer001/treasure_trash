// The stage turns the rules' motion account into things with positions. The properties worth
// pinning are the ones the old cell-diffing renderer got wrong: an object keeps its identity
// across a move, riding is a parent rather than a position, and nothing teleports.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, CAN_EMPTY, TRASH, BAG, WHEELIE_EMPTY } from '../src/rules.js';
import { toState } from '../src/format.js';
import { stageFrom, applyStep, advance, settle, rollEase, easeOut, CART, COUCH, RACCOON } from '../src/stage.js';

const S = (grid, cart, water) => toState({ id: 't', grid, cart, water });
const of = (stage, kind) => stage.sprites.filter(sp => sp.kind === kind);
const one = (stage, kind) => {
  const m = of(stage, kind);
  assert.equal(m.length, 1, `expected exactly one ${String(kind)}, found ${m.length}`);
  return m[0];
};
/** Run a whole traced action through the stage, sampling positions mid-beat. */
function play(grid, dir, { cart, water } = {}, sample = null) {
  const s = S(grid, cart, water);
  const r = explain(s, dir, { trace: true });
  assert.ok(r.ok, `refused (${r.reason})`);
  const stage = stageFrom(s, 1);
  r.steps.forEach((step, i) => {
    applyStep(stage, step, r.frames[i + 1].rac);
    if (sample) { advance(stage, 0.5); sample(stage, i, r.steps.length); }
    settle(stage);
  });
  return { stage, r };
}

test('a board becomes one sprite per thing, pieces included', () => {
  const stage = stageFrom(S(['@c-$-E', '-FF---'], ['--PP--', '------']));
  assert.equal(one(stage, RACCOON).x, 0);
  assert.equal(one(stage, CART).ref !== undefined, true);
  assert.deepEqual(one(stage, COUCH).cells, [[0, 0], [1, 0]]);
  assert.equal(of(stage, CAN_EMPTY).length, 1);
  assert.equal(of(stage, BAG).length, 1);
});

test('a cart sprite carries its own cell offsets, and they never change', () => {
  const { stage } = play(['@---E', '-----'], 'r', { cart: ['-PP--', '-----'] });
  assert.deepEqual(one(stage, CART).cells, [[0, 0], [1, 0]]);
});

test('cargo starts out parented to the cart it is standing in', () => {
  const stage = stageFrom(S(['@c--E'], ['-PP--']));
  const can = one(stage, CAN_EMPTY);
  assert.equal(can.parent, one(stage, CART).ref);
});

test('a swallowed pile takes a parent without moving a hair that beat', () => {
  // The cart rolls onto it. If this were reported as a position change the pile would lurch
  // forward into the basket and back out again, which is the snap the parent model removes.
  let midBeat = null;
  const { stage } = play(['@--x-#', 'E-----'], 'r', { cart: ['-PP---', '------'] },
    (st, i) => { if (i === 0) midBeat = { ...of(st, TRASH)[0] }; });
  assert.equal(midBeat.x, 3, 'the pile is exactly where it was, half-way through the beat');
  assert.equal(midBeat.y, 0);
  assert.ok(of(stage, TRASH).length >= 1);
});

test('riding cargo travels with the cart, cell for cell', () => {
  const seen = [];
  play(['@-x---#', 'E------'], 'r', { cart: ['-PP----', '-------'] }, st => {
    const cart = one(st, CART), pile = of(st, TRASH)[0];
    if (pile && pile.parent !== null) seen.push([+(pile.x - cart.x).toFixed(3), pile.y - cart.y]);
  });
  assert.ok(seen.length, 'the pile rode for at least one beat');
  const [first] = seen;
  for (const off of seen) assert.deepEqual(off, first, 'the offset from the cart never drifts');
});

test('a shed pile stops dead while the cart rolls on', () => {
  // Once the cart has rolled out from under it, a pile is furniture: it must not drift by so
  // much as a fraction of a cell for the rest of the roll. "Shed" means it was riding and
  // stopped — a pile that was never picked up has the same null parent and is not the subject.
  const s = S(['@--xxx-#', 'E-------'], ['-PP-----', '--------']);
  const r = explain(s, 'r', { trace: true });
  const stage = stageFrom(s, 1);
  const rode = new Set(), shed = new Map();
  r.steps.forEach((step, i) => {
    applyStep(stage, step, r.frames[i + 1].rac);
    advance(stage, 0.5);
    if (step.piece) for (const sp of of(stage, TRASH)) {      // travel only — a tip does move
      if (sp.parent !== null) { rode.add(sp.id); continue; }
      if (!rode.has(sp.id)) continue;
      const at = `${sp.x},${sp.y}`;
      if (!shed.has(sp.id)) shed.set(sp.id, at);
      else assert.equal(at, shed.get(sp.id), `pile ${sp.id} drifted after being shed`);
    }
    settle(stage);
  });
  assert.equal(shed.size, 1, 'exactly one pile was shed mid-roll');
  assert.equal([...shed.values()][0], '3,0', 'and it came down on the cell it was picked up from');
});

test('cargo already aboard does not advance on a step that takes something in', () => {
  // Each item shifts one slot toward the back while the cart moves one cell forward, and
  // those cancel. Report only the entering item and the load already aboard gets dragged a
  // cell it never travelled — two piles end up stacked on one square and the shed one is
  // never drawn at all.
  const s = S(['@--xxx-#', 'E-------'], ['-PP-----', '--------']);
  const r = explain(s, 'r', { trace: true });
  const stage = stageFrom(s, 1);
  r.steps.forEach((step, i) => {
    applyStep(stage, step, r.frames[i + 1].rac);
    settle(stage);
    const cells = of(stage, TRASH).map(sp => `${sp.x},${sp.y}`);
    assert.equal(new Set(cells).size, cells.length, `two piles share a cell after step ${i}`);
  });
});

test('tipped cargo genuinely travels, and is somewhere in between mid-beat', () => {
  let mid = null;
  const { stage } = play(['@cc-#', 'E----'], 'r', { cart: ['-PP--', '-----'] },
    (st, i, total) => { if (i === total - 1) mid = of(st, CAN_EMPTY).map(sp => sp.x); });
  assert.ok(mid.some(x => !Number.isInteger(x)), 'something was between cells during the tip');
  assert.equal(of(stage, CAN_EMPTY).length, 2, 'both cans still exist');
});

test('a sprite keeps its identity, and its seed, across a whole action', () => {
  const s = S(['@-x--#', 'E-----'], ['-PP---', '------']);
  const stage = stageFrom(s, 7);
  const before = { ...of(stage, TRASH)[0] };
  const r = explain(s, 'r', { trace: true });
  r.steps.forEach((step, i) => { applyStep(stage, step, r.frames[i + 1].rac); settle(stage); });
  const after = of(stage, TRASH).find(sp => sp.id === before.id);
  assert.ok(after, 'the same pile is still on the stage');
  assert.equal(after.seed, before.seed, 'and it looks the same wherever it ended up');
});

test('a torn bag dies and its trash is born flying out of it', () => {
  const s = S(['-----', '--$--', '--@--', 'E----']);
  const stage = stageFrom(s);
  const r = explain(s, 'u', { trace: true });
  applyStep(stage, r.steps[0], r.frames[1].rac);
  assert.equal(one(stage, BAG).dying, true);
  const born = of(stage, TRASH);
  assert.equal(born.length, 5);
  for (const sp of born) assert.deepEqual([sp.ax, sp.ay], [2, 1], 'all five start at the bag');
  settle(stage);
  assert.equal(of(stage, BAG).length, 0, 'the bag is gone once the beat ends');
});

test("a wheelie bin's bag is born at the bin, not at the cell that was shoved", () => {
  const s = S(['-----', '-----', '-----', '--W--', 'E-@--']);
  const stage = stageFrom(s);
  const r = explain(s, 'u', { trace: true });
  applyStep(stage, r.steps[0], r.frames[1].rac);
  const bag = one(stage, BAG);
  assert.deepEqual([bag.ax, bag.ay], [2, 0], 'it comes out of the bin at the end of the roll');
  assert.deepEqual([bag.tx, bag.ty], [2, 1]);
  settle(stage);
  assert.equal(one(stage, WHEELIE_EMPTY).y, 0, 'and the bin emptied itself on arrival');
});

test('trash spent filling the canal leaves the stage', () => {
  const { stage } = play(['@--x-#', 'E-----'], 'r',
    { cart: ['-PP---', '------'], water: ['--~---', '------'] });
  assert.equal(of(stage, TRASH).length, 0, 'the pile became a crossing');
});

test('advance interpolates and settle lands exactly on the target', () => {
  const s = S(['-----', '--c--', '--@--', 'E----']);
  const stage = stageFrom(s);
  const r = explain(s, 'u', { trace: true });
  applyStep(stage, r.steps[0], r.frames[1].rac);
  advance(stage, 0.25);
  assert.equal(one(stage, CAN_EMPTY).y, 1 - 0.25);
  settle(stage);
  assert.equal(one(stage, CAN_EMPTY).y, 0);
  assert.equal(one(stage, CAN_EMPTY).ay, 0, 'the anchor follows, ready for the next beat');
});

test('rollEase covers the distance exactly, never decelerating', () => {
  for (const cells of [1, 2, 4, 9]) {
    assert.equal(rollEase(0, cells), 0);
    assert.ok(Math.abs(rollEase(1, cells) - 1) < 1e-12, `cells=${cells} must arrive at 1`);
    // speed is non-decreasing: sample the derivative and check it never drops
    let prev = -1;
    for (let t = 0.01; t <= 1; t += 0.01) {
      const v = (rollEase(t, cells) - rollEase(t - 0.01, cells)) / 0.01;
      assert.ok(v >= prev - 1e-9, `cells=${cells} slowed down at t=${t.toFixed(2)}`);
      prev = Math.max(prev, v);
    }
    // and it is still at full speed on the frame it stops
    const last = (rollEase(1, cells) - rollEase(0.99, cells)) / 0.01;
    assert.ok(last >= 0.9, `cells=${cells} should hit at cruise speed, got ${last.toFixed(3)}`);
  }
});

test('easeOut is the other envelope: it arrives slowing down', () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  const last = (easeOut(1) - easeOut(0.99)) / 0.01;
  const mid = (easeOut(0.5) - easeOut(0.49)) / 0.01;
  assert.ok(last < mid, 'it is slower at the end than in the middle');
});
