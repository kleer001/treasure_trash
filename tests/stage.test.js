// The stage turns the rules' motion account into things with positions.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  explain, moves as movement, arrives as arrival, leaves as removal,
  CAN_EMPTY, CAN_FULL, TRASH, BAG, WHEELIE, WHEELIE_EMPTY, FURNITURE,
} from '../src/rules.js';
import { laneOf, CART_LANE } from '../src/handles.js';
import { toState } from '../src/format.js';
import {
  stageFrom, applyStep, advance, settle, rollEase, easeOut, pileLook, bump, NUDGE,
  CART, COUCH, RACCOON,
} from '../src/stage.js';

const S = (grid, cart, water) => toState({ id: 't', grid, cart, water });
const rolled = step => step.moved.some(m => laneOf(m.handle) === CART_LANE);
const of = (stage, kind) => stage.sprites.filter(sp => sp.kind === kind);
const one = (stage, kind) => {
  const m = of(stage, kind);
  assert.equal(m.length, 1, `expected exactly one ${String(kind)}, found ${m.length}`);
  return m[0];
};
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

test('cargo starts out parented to the skateboard it is standing in', () => {
  const stage = stageFrom(S(['@c--E'], ['-PP--']));
  const can = one(stage, CAN_EMPTY);
  assert.equal(can.parent, one(stage, CART).ref);
});

test('a pile being taken aboard does not move a hair', () => {
  let midBeat = null;
  const { stage } = play(['@--x-#', 'E-----'], 'r', { cart: ['-PP---', '------'] },
    (st, i) => { if (i === 0) midBeat = { ...of(st, TRASH)[0] }; });
  assert.equal(midBeat.x, 3, 'exactly where it was, half-way through the beat');
  assert.equal(midBeat.y, 0);
  assert.equal(midBeat.nudge, null, 'and it was never given one');
  assert.ok(of(stage, TRASH).length >= 1);
});

test('cargo that shifts a slot is nudged, so the swap is visible at all', () => {
  const s = S(['@-ccc-F-', '------F-', 'E-------'], ['-PP-----', '--------', '--------']);
  const r = explain(s, 'r', { trace: true });
  const stage = stageFrom(s, 1);
  applyStep(stage, r.steps[0], r.frames[1].rac);
  const can = of(stage, CAN_EMPTY).find(sp => sp.ax === 2 && sp.ay === 0);
  assert.ok(can, 'the can that started in the skateboard s rightmost cell');
  assert.deepEqual([can.tx, can.ty], [2, 0], 'the board does not move it');
  advance(stage, 0.5);
  assert.ok(can.x > 2.05, `it should be visibly out of place mid-beat, was ${can.x}`);
  assert.ok(can.x <= 2 + NUDGE + 1e-9, 'but never further than a quarter cell');
  settle(stage);
  assert.equal(can.x, 2, 'and it lands exactly where the board says');
  const arriving = of(stage, CAN_EMPTY).find(sp => sp.id !== can.id && sp.x === 3);
  assert.ok(arriving && arriving.nudge === null, 'the one being loaded is not nudged');
});

test('the nudge goes out and comes back, harder on the way back', () => {
  assert.equal(bump(0), 0);
  assert.ok(Math.abs(bump(1)) < 1e-12, 'it ends where it started');
  const peak = Math.max(...Array.from({ length: 101 }, (_, i) => bump(i / 100)));
  assert.ok(Math.abs(peak - 1) < 1e-9, 'and reaches full throw once');
  const out = bump(0.31) - bump(0.30), back = bump(0.81) - bump(0.80);
  assert.ok(Math.abs(back) > Math.abs(out), 'the return is the collision, so it is quicker');
});

test('riding cargo travels with the skateboard, cell for cell', () => {
  const s = S(['@--x--#', 'E------'], ['-PP----', '-------']);
  const r = explain(s, 'r', { trace: true });
  const stage = stageFrom(s, 1);
  const seen = [];
  r.steps.forEach((step, i) => {
    applyStep(stage, step, r.frames[i + 1].rac);
    advance(stage, 0.5);
    const cart = one(stage, CART), pile = of(stage, TRASH)[0];
    if (rolled(step) && pile && pile.parent !== null)
      seen.push([+(pile.x - cart.x).toFixed(3), pile.y - cart.y]);
    settle(stage);
  });
  const riding = seen.slice(1);
  assert.ok(riding.length > 1, 'the pile rode for more than one beat');
  const [first] = riding;
  for (const off of riding) assert.deepEqual(off, first, 'the offset from the skateboard never drifts');
});

test('a shed pile stops dead once the skateboard has rolled on', () => {
  const s = S(['@--xxx---#', 'E---------'], ['-PP-------', '----------']);
  const r = explain(s, 'r', { trace: true });
  const stage = stageFrom(s, 1);
  const rode = new Set(), hitOn = new Map(), rest = new Map();
  r.steps.forEach((step, i) => {
    applyStep(stage, step, r.frames[i + 1].rac);
    advance(stage, 0.5);
    if (rolled(step)) for (const sp of of(stage, TRASH)) {
      if (sp.parent !== null) { rode.add(sp.id); continue; }
      if (!rode.has(sp.id)) continue;
      if (!hitOn.has(sp.id)) { hitOn.set(sp.id, i); continue; }
      const at = `${sp.x},${sp.y}`;
      if (!rest.has(sp.id)) rest.set(sp.id, at);
      else assert.equal(at, rest.get(sp.id), `pile ${sp.id} drifted after being shed`);
    }
    settle(stage);
  });
  assert.equal(hitOn.size, 1, 'exactly one pile was shed mid-roll');
  assert.equal([...rest.values()][0], '3,0', 'and it stayed on the cell it was picked up from');
});

test('cargo already aboard does not advance on a step that takes something in', () => {
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

test('a wheelie bin carries its bag the whole way, then drops it out of the BIN', () => {
  const s = S(['-----', '-----', '-----', '--W--', 'E-@--']);
  const stage = stageFrom(s);
  const r = explain(s, 'u', { trace: true });

  applyStep(stage, r.steps[0], r.frames[1].rac);
  assert.equal(of(stage, BAG).length, 0, 'nothing comes out before it has hit anything');
  assert.deepEqual([one(stage, WHEELIE).tx, one(stage, WHEELIE).ty], [2, 0], 'it travels, still full');
  settle(stage);

  applyStep(stage, r.steps[1], r.frames[2].rac);
  const bag = one(stage, BAG);
  assert.deepEqual([bag.ax, bag.ay], [2, 0], 'the bag comes out of the bin, where the bin stopped');
  assert.deepEqual([bag.tx, bag.ty], [2, 1]);
  assert.equal(of(stage, WHEELIE).length, 0, 'the bin is empty for the whole of the bag s flight');
  assert.equal(one(stage, WHEELIE_EMPTY).y, 0, 'so it never draws as two bags at once');
  settle(stage);
  assert.equal(one(stage, WHEELIE_EMPTY).y, 0);
});

test('trash spent filling the canal leaves the stage', () => {
  const { stage } = play(['-x#', '@-#', 'E--'], 'r',
    { cart: ['-P-', '-P-', '---'], water: ['~--', '---', '---'] });
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

test('a beat is paced by the CELL, so he walks his one while the bin crosses three', () => {
  const s = S(['-----', '-----', '-----', '--W--', 'E-@--']);
  const stage = stageFrom(s);
  const r = explain(s, 'u', { trace: true });
  applyStep(stage, r.steps[0], r.frames[1].rac);
  const cells = 3;

  advance(stage, 1 / 6, cells);
  assert.equal(one(stage, RACCOON).y, 3.5, 'half a cell of roll is half his step');
  advance(stage, 1 / 3, cells);
  assert.equal(one(stage, RACCOON).y, 3, 'one cell of roll and he is home');
  assert.equal(one(stage, WHEELIE).y, 2, 'while the bin still has two to run');
  advance(stage, 0.5, cells);
  assert.equal(one(stage, RACCOON).y, 3, 'and he holds there rather than creeping');
  assert.equal(one(stage, WHEELIE).y, 1.5);
  settle(stage);
  assert.equal(one(stage, WHEELIE).y, 0, 'settle still lands everything');
});

test('the pusher never gets closer than a cell to what he shoved', () => {
  const s = S(['-----', '-----', '-----', '--W--', 'E-@--']);
  const stage = stageFrom(s);
  const r = explain(s, 'u', { trace: true });
  applyStep(stage, r.steps[0], r.frames[1].rac);
  for (let i = 0; i <= 100; i++) {
    advance(stage, i / 100, 3);
    const gap = one(stage, RACCOON).y - one(stage, WHEELIE).y;
    assert.ok(gap >= 1 - 1e-12, `only ${gap.toFixed(3)} of a cell behind at u=${i / 100}`);
  }
});

test('a beat with no cell count is one clock, however far its pieces fly', () => {
  const s = S(['-----', '-----', '-----', '--W--', 'E-@--']);
  const stage = stageFrom(s);
  const r = explain(s, 'u', { trace: true });
  applyStep(stage, r.steps[0], r.frames[1].rac);
  advance(stage, 0.5);
  assert.equal(one(stage, RACCOON).y, 3.5);
  assert.equal(one(stage, WHEELIE).y, 1.5, 'both half-way at half-way');
});

test('rollEase covers the distance exactly, never decelerating', () => {
  for (const cells of [1, 2, 4, 9]) {
    assert.equal(rollEase(0, cells), 0);
    assert.ok(Math.abs(rollEase(1, cells) - 1) < 1e-12, `cells=${cells} must arrive at 1`);
    let prev = -1;
    for (let t = 0.01; t <= 1; t += 0.01) {
      const v = (rollEase(t, cells) - rollEase(t - 0.01, cells)) / 0.01;
      assert.ok(v >= prev - 1e-9, `cells=${cells} slowed down at t=${t.toFixed(2)}`);
      prev = Math.max(prev, v);
    }
    const last = (rollEase(1, cells) - rollEase(0.99, cells)) / 0.01;
    assert.ok(last >= 0.9, `cells=${cells} should hit at cruise speed, got ${last.toFixed(3)}`);
  }
});

test('a pile looks the same every time it is asked, and different per seed', () => {
  assert.deepEqual(pileLook(12345), pileLook(12345));
  assert.notDeepEqual(pileLook(12345), pileLook(12346));
  const [hero, mid, accent] = pileLook(99);
  assert.ok(hero.r > mid.r && mid.r > accent.r, 'largest first, so small pieces draw on top');
  assert.equal(hero.tone, mid.tone, 'two pieces carry the dominant tone');
  assert.notEqual(accent.tone, hero.tone, 'and the third is an accent, never the same');
});

test('a pile stays inside its own cell', () => {
  for (let s = 1; s <= 400; s++) for (const pc of pileLook(s)) {
    assert.ok(Math.abs(pc.ox) + pc.r < 0.5, `seed ${s} spills sideways`);
    assert.ok(Math.abs(pc.oy) + pc.r < 0.5, `seed ${s} spills vertically`);
  }
});

test('piles are actually tellable apart — the looks do not collapse', () => {
  const seen = new Map();
  for (let s = 1; s <= 500; s++) {
    const [hero] = pileLook(s);
    const k = `${hero.tone}:${hero.shape}`;
    seen.set(k, (seen.get(k) ?? 0) + 1);
  }
  assert.ok(seen.size >= 16, `only ${seen.size} of 20 looks appear`);
  const worst = Math.max(...seen.values()) / 500;
  assert.ok(worst < 0.15, `one look takes ${(worst * 100).toFixed(0)}% of all piles`);
});

test('easeOut is the other envelope: it arrives slowing down', () => {
  assert.equal(easeOut(0), 0);
  assert.equal(easeOut(1), 1);
  const last = (easeOut(1) - easeOut(0.99)) / 0.01;
  const mid = (easeOut(0.5) - easeOut(0.49)) / 0.01;
  assert.ok(last < mid, 'it is slower at the end than in the middle');
});

test('what goes down a grate arrives first, then drops', () => {
  const stage = { sprites: [], nextId: 0 };
  applyStep(stage, {
    moved: [], impact: false,
    spawned: [arrival({ o: BAG, cells: [[3, 1]], from: [1, 1] })],
    gone: [removal({ o: BAG, cells: [[3, 1]], effect: 'falls' })],
  });
  const [bag] = stage.sprites;
  assert.equal(bag.falls, true);
  assert.equal(bag.spent, true, 'the board never received it');

  advance(stage, 0.3);
  assert.equal(bag.deflate, 1, 'still whole while it is travelling');
  assert.ok(bag.x > 1 && bag.x < 3, 'and on its way');

  advance(stage, 0.6);
  assert.equal(bag.x, 3, 'over the grate before it starts to go');
  assert.ok(bag.deflate < 1 && bag.deflate > 0, 'and going');

  advance(stage, 1);
  assert.equal(bag.deflate, 0, 'gone by the end of the beat');
  settle(stage);
  assert.deepEqual(stage.sprites, [], 'and off the stage');
});

test('a thing that travels into a grate is taken once, not deflated on the way as well', () => {
  const stage = stageFrom(S(['@-C-E', '-----']), 1);
  const can = one(stage, CAN_FULL);
  applyStep(stage, {
    moved: [movement({ o: CAN_FULL, cells: [[2, 0]], dx: 1, dy: 0 })],
    gone: [removal({ o: CAN_FULL, cells: [[2, 0]], effect: 'falls' })],
    spawned: [], impact: false,
  });
  assert.equal(can.falls, true);
  assert.ok(!can.dying, 'the drop is the whole of how it leaves');

  advance(stage, 0.3);
  assert.equal(can.deflate, 1, 'still whole while it is travelling');
  advance(stage, 1);
  assert.equal(can.deflate, 0, 'and all the way down by the end of the beat');
  settle(stage);
  assert.equal(of(stage, CAN_FULL).length, 0, 'off the stage');
});

test('a body can be born mid-action, and lands where a rebuilt stage would put it', () => {
  const stage = stageFrom(S(['@---E', '-----']), 1);
  applyStep(stage, {
    moved: [], gone: [], impact: false,
    spawned: [arrival({ lane: 'body', ref: 0, o: FURNITURE, cells: [[1, 1], [2, 1]] })],
  });
  settle(stage);
  const born = one(stage, COUCH);
  const rebuilt = one(stageFrom(S(['@---E', '-FF--']), 1), COUCH);
  for (const k of ['kind', 'ref', 'o', 'tx', 'ty', 'depth'])
    assert.deepEqual(born[k], rebuilt[k], `born ${k}`);
  assert.deepEqual(born.cells, rebuilt.cells, 'and the same footprint, in offsets');
});

test('a body born onto a handle the stage is already holding is loud, not quietly doubled', () => {
  const stage = stageFrom(S(['@---E', '-FF--']), 1);
  const ref = one(stage, COUCH).ref;
  assert.throws(() => applyStep(stage, {
    moved: [], gone: [], impact: false,
    spawned: [arrival({ lane: 'body', ref, o: FURNITURE, cells: [[1, 1], [2, 1]] })],
  }), /already answers/);
});

test('a body swapped for something else leaves the stage', () => {
  const stage = stageFrom(S(['@---E', '-FF--']), 1);
  const ref = one(stage, COUCH).ref;
  applyStep(stage, {
    impact: false,
    spawned: [arrival({ o: BAG, cells: [[1, 1]], from: [1, 1] })],
    moved: [movement({ lane: 'body', o: FURNITURE, ref, cells: [[1, 1], [2, 1]], dx: 0, dy: 0 })],
    gone: [removal({ lane: 'body', o: FURNITURE, ref, cells: [[1, 1], [2, 1]] })],
  });
  settle(stage);
  assert.equal(of(stage, COUCH).length, 0, 'the body is gone');
  assert.equal(of(stage, BAG).length, 1, 'and what replaced it is on the stage');
});
