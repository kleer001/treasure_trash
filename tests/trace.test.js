// A traced action reports what MOVED, not just what the board became.
// These are coverage checks rather than a replay: an event vocabulary rich enough to
// reconstruct a board would be a second copy of the rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  explain, cell, cartCells, pieceCells, bagsLeft, restsOn, moves, arrives, leaves, NONE,
  BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, BIN_EMPTY, WHEELIE, WHEELIE_EMPTY, JUG, JUG_EMPTY,
  FURNITURE, RUG, LANDS_ON, TERRAINS, terrainOf, BRIDGE,
} from '../src/rules.js';
import { toState } from '../src/format.js';
import { unnamedCells, UNACCOUNTED } from '../src/audit.js';
import { anchorOf, laneOf, isBodyLane, CART_LANE, BODY_LANE } from '../src/handles.js';

const S = (grid, cart, water) => toState({ id: 't', grid, cart, water });
const key = ([x, y]) => `${x},${y}`;
const bodies = st => st.moved.filter(m => isBodyLane(laneOf(m.handle)));

function audit(label, grid, dir, { cart, water } = {}) {
  const s = S(grid, cart, water);
  const r = explain(s, dir, { trace: true });
  assert.ok(r.ok, `${label}: expected a legal action, got refused (${r.reason})`);
  assert.equal(r.steps.length, r.frames.length - 1, `${label}: one step per transition`);

  r.steps.forEach((step, i) => {
    const prev = r.frames[i], next = r.frames[i + 1], at = `${label} step ${i}`;
    for (const c of unnamedCells(prev, next, step))
      assert.ok(c.lanes.every(k => UNACCOUNTED.includes(k)),
        `${at}: cell ${c.at} changed in ${c.lanes.join(',')} and no event names it`);

    for (const m of step.moved)
      if (m.o !== null) for (const c of m.cells)
        assert.equal(cell(prev, ...c).o, m.o,
          `${at}: moved says ${m.o} was at ${c}, the board had ${cell(prev, ...c).o}`);
    const arrived = new Set(step.spawned.map(sp => sp.handle));
    for (const g of step.gone)
      if (g.o !== null && !arrived.has(g.handle))
        assert.equal(cell(prev, ...g.cells[0]).o, g.o, `${at}: gone says ${g.o} was at ${g.cells[0]}`);

    const vacated = new Set(step.moved.flatMap(m => m.cells.map(key)));
    for (const sp of step.spawned) {
      if (sp.effect === 'pours') continue;
      if (sp.ref === null)
        assert.ok(cell(prev, ...sp.cells[0]).o === NONE || vacated.has(key(sp.cells[0])),
          `${at}: spawned ${sp.o} onto occupied cell ${sp.cells[0]}`);
    }
  });
  return r;
}

test('a plain step reports no motion but the raccoon', () => {
  const r = audit('walk', ['@--E'], 'r');
  assert.deepEqual(r.steps, [{ moved: [], spawned: [], gone: [], impact: false }]);
  assert.equal(r.frames[1].rac.x, 1);
});

test('a tear consumes the bag and throws five piles out of it', () => {
  const r = audit('tear', ['-----', '--$--', '--@--', 'E----'], 'u');
  const [step] = r.steps;
  assert.deepEqual(step.gone, [leaves({ o: BAG, cells: [[2, 1]] })]);
  assert.equal(step.spawned.length, 5);
  for (const sp of step.spawned) assert.deepEqual(sp.from, [2, 1], 'every speck flies out of the bag');
});

test('a fan cell over the canal takes what lands on it, and the step says so', () => {
  const r = audit('tear-canal', ['-----', '--$--', '--@--', 'E----'], 'u',
    { water: ['--~--', '-----', '-----', '-----'] });
  const [step] = r.steps;
  assert.equal(step.spawned.filter(sp => sp.cells[0][0] === 2 && sp.cells[0][1] === 0).length, 1,
    'the speck still flies to the canal cell');
  assert.deepEqual(step.gone.filter(g => g.o === TRASH),
    [leaves({ o: TRASH, cells: [[2, 0]], effect: 'fills' })],
    'and the canal keeps it, saying how');
});

test('each two-cell piece moves itself and launches its load from its own cell', () => {
  for (const [g, o, becomes, load] of [
    ['C', CAN_FULL, CAN_EMPTY, BAG],
    ['B', BIN, BIN_EMPTY, TRASH], ['j', JUG, JUG_EMPTY, NONE],
  ]) {
    const r = audit(`two-cell ${g}`, ['-----', '-----', `--${g}--`, '--@--', 'E----'], 'u');
    const [step] = r.steps;
    assert.deepEqual(step.moved,
      [moves({ o, from: [2, 2], to: [2, 1], becomes: becomes || o })]);
    assert.deepEqual(step.spawned[0].cells, [[2, 0]]);
    assert.deepEqual(step.spawned[0].from, [2, 2], 'the load comes out of the piece');
    assert.equal(step.spawned[0].o, load);
  }
});

test('an empty can is one move and nothing else', () => {
  const r = audit('can', ['-----', '--c--', '--@--', 'E----'], 'u');
  assert.deepEqual(r.steps[0].moved, [moves({ o: CAN_EMPTY, from: [2, 1], to: [2, 0] })]);
});

test('a couch reports one rigid translation, not four cell edits', () => {
  const r = audit('couch', ['-----', '-FF--', '-FF--', '-@---', 'E----'], 'u');
  const [step] = r.steps;
  assert.deepEqual(step.moved, [moves({ cells: pieceCells(r.frames[0], 0), lane: BODY_LANE,
                                        o: FURNITURE, ref: 0, dx: 0, dy: -1 })],
    'a rigid body is one entry over four cells, not a pile of moves');
});

test('a wheelie bin rolls first and dumps after, out of the BIN', () => {
  const r = audit('wheelie', ['-----', '-----', '-----', '--W--', 'E-@--'], 'u');
  assert.equal(r.steps.length, 2, 'the roll and the dump are separate beats');
  const [roll, dump] = r.steps;
  assert.deepEqual(roll.moved, [moves({ o: WHEELIE, from: [2, 3], to: [2, 0] })]);
  assert.deepEqual(roll.spawned, [], 'it is still carrying the bag the whole way down');
  assert.equal(roll.impact, true, 'and it stopped because something stopped it');
  assert.equal(bagsLeft(r.frames[1]), 1, 'the bag is accounted for throughout, never in limbo');
  assert.deepEqual(dump.spawned, [arrives({ o: BAG, cells: [[2, 1]], from: [2, 0] })]);
  assert.equal(dump.moved[0].becomes.o, WHEELIE_EMPTY, 'and it empties as the bag leaves');
  assert.equal(dump.impact, false, 'the dump is the consequence, not another collision');
});

test('an empty wheelie bin rolls with nothing to eject', () => {
  const r = audit('wheelie-empty', ['-----', '-----', '--w--', '--@--', 'E----'], 'u');
  assert.deepEqual(r.steps[0].spawned, []);
  assert.equal(r.steps[0].moved[0].becomes.o, WHEELIE_EMPTY, 'it is already the empty one');
});

test('a cart reports one translation per cell of travel', () => {
  const r = audit('cart-roll', ['@--xxx-#', 'E-------'], 'r', { cart: ['-PP-----', '--------'] });
  assert.equal(r.frames.length, 6);
  const travel = r.steps.filter(st => bodies(st).length);
  assert.equal(travel.length, 4, 'four advances');
  for (const st of travel) assert.deepEqual([bodies(st)[0].dx, bodies(st)[0].dy], [1, 0]);
  assert.equal(travel.at(-1).impact, true, 'the last cell of travel is the collision');
  assert.equal(r.steps.length, 5, 'four advances and the tip that follows them');

  const loaded = audit('cart-loaded', ['@cc--#', 'E-----'], 'r', { cart: ['-PP---', '------'] });
  const carried = loaded.steps.filter(st => bodies(st).length);
  assert.equal(carried.length, 2, 'two advances, the same as empty over the same floor');
  assert.equal(carried.at(-1).impact, true, 'the last cell of travel is the collision');
  assert.deepEqual(carried[0].moved.filter(m => m.o !== null), [],
    'its load went with it, so nothing but the cart itself is named');
});

test('swallowing and shedding are changes of parent, not of position', () => {
  const r = audit('cart-parent', ['@--xxx-#', 'E-------'], 'r', { cart: ['-PP-----', '--------'] });

  const rides = r.steps.filter(st => bodies(st).length)
    .flatMap(st => st.moved).filter(m => m.parent !== undefined);
  assert.ok(rides.length >= 4, 'three swallows and at least one shed');
  for (const m of rides)
    assert.deepEqual([m.dx, m.dy], [0, 0],
      `a ${m.parent === null ? 'shed' : 'swallow'} must not move the cargo`);
  assert.ok(rides.some(m => m.parent !== null), 'something was taken aboard');
  assert.ok(rides.some(m => m.parent === null), 'something was shed');
});

test('a shed names the cell the load rode in and the cell it lands on', () => {
  const r = audit('cart-shed', ['-c#', '@c#', 'E--'], 'r', { cart: ['-P-', '-P-', '---'] });
  const tip = r.steps.at(-1);
  assert.deepEqual(bodies(tip), [], 'the skateboard itself is going nowhere');
  const out = tip.moved.filter(m => m.parent === null);
  assert.deepEqual(out.map(m => anchorOf(m.cells)), [[1, 0]], 'from the slot it rode in');
  assert.deepEqual(out.map(restsOn), [[0, 0]], 'to the cell behind that file');
  for (const m of tip.moved) assert.ok(m.dx || m.dy, 'everything in a shed moves');
});

test('nothing a cart reports ever crosses more than one cell', () => {
  for (const grid of [
    ['@$-----#', 'E-------'],
    ['@-$----#', 'E-------'],
    ['@--xxx-#', 'E-------'],
    ['@cc-x-#', 'E------'],
  ]) {
    const r = audit('one-cell', grid, 'r', { cart: ['-PP-----', '--------'].map(c => c.slice(0, grid[0].length)) });
    for (const st of r.steps) for (const m of st.moved) {
      const d = Math.abs(m.dx) + Math.abs(m.dy);
      assert.ok(d <= 1, `${grid[0]}: ${JSON.stringify(m)} crossed ${d} cells`);
    }
  }
});

test('a tip lands contiguously behind the skateboard, never skipping a taken cell', () => {
  for (const [grid, cart] of [
    [['@--xxx-#', 'E-------'], ['-PP-----', '--------']],
    [['@cc-#', 'E----'], ['-PP--', '-----']],
    [['@cc--#', 'E-----'], ['-PP---', '------']],
    [['@cc---#', 'E------'], ['-PP----', '-------']],
    [['@cc-x-#', 'E------'], ['-PP----', '-------']],
    [['@c-#', '-c-#', 'E---'], ['-P--', '-P--', '----']],
  ]) {
    const r = audit('contiguity', grid, 'r', { cart });
    const tip = r.steps.at(-1);
    if (bodies(tip).length) continue;
    const before = r.frames[r.frames.length - 2];
    for (const m of tip.moved.filter(m => m.parent === null)) {
      const from = anchorOf(m.cells), to = restsOn(m);
      const [dx, dy] = [Math.sign(from[0] - to[0]), Math.sign(from[1] - to[1])];
      for (let p = [to[0] + dx, to[1] + dy];
           !(p[0] === from[0] && p[1] === from[1]); p = [p[0] + dx, p[1] + dy]) {
        const c = cell(before, ...p);
        assert.ok(c.o === NONE || c.cart !== undefined,
          `a tip crossed occupied cell ${p} on its way to ${to}`);
      }
    }
  }
});

test('cargo tipped into the canal travels there and does not survive it', () => {
  const r = audit('cart-canal', ['-x#', '@x#', 'E--'], 'r',
    { cart: ['-P-', '-P-', '---'], water: ['~--', '---', '---'] });
  const tip = r.steps.at(-1);
  assert.equal(tip.moved[0].o, TRASH);
  assert.deepEqual(restsOn(tip.moved[0]), [0, 0]);
  assert.deepEqual(tip.gone, [{ o: TRASH, ref: null, cells: tip.moved[0].cells,
                                handle: tip.moved[0].handle, effect: 'fills' }]);
});

test('a tip only ever moves cargo backward, and never past the run the skateboard came through', () => {
  for (const [grid, cart, water] of [
    [['@--xxx-#', 'E-------'], ['-PP-----', '--------'], null],
    [['@cc---#', 'E------'], ['-PP----', '-------'], null],
    [['@-c-#', 'E----'], ['-PP--', '-----'], null],
    [['@-x--#', 'E-----'], ['-PP---', '------'], ['--~---', '------']],
    [['@c-#', '-c-#', 'E---'], ['-P--', '-P--', '----'], null],
  ]) {
    const r = audit('tip-direction', grid, 'r', { cart, water });
    const tip = r.steps.at(-1);
    if (bodies(tip).length) continue;
    for (const m of tip.moved) {
      const back = -(m.dx + m.dy);
      assert.ok(back > 0, `a tip moved ${m.o} by ${m.dx},${m.dy} — not backward`);
      assert.ok(restsOn(m)[0] > r.frames[0].rac.x,
        `${m.o} landed on or behind the raccoon's start`);
    }
  }
});

test('a broadside cart reports both files in one step', () => {
  const r = audit('cart-wide', ['@-c-FE', '--c-F-'], 'r', { cart: ['-P----', '-P----'] });
  const swallows = r.steps.flatMap(st => st.moved).filter(m => m.parent !== undefined && m.parent !== null);
  assert.equal(swallows.length, 2, 'two lead cells, two things aboard');
  assert.equal(r.steps.length, 1, 'one cell of travel is one step');
  const refs = new Set(bodies(r.steps[0]).map(b => b.ref));
  assert.equal(refs.size, 1, 'one cart, named once for the whole footprint');
});

test('nothing is traced unless it is asked for', () => {
  const s = S(['@--x-#', 'E-----'], ['-PP---', '------']);
  const plain = explain(s, 'r');
  assert.equal(plain.frames, undefined);
  assert.equal(plain.steps, undefined);
});

test('a rug that sets a bicycle going reports the bicycle as a BODY', () => {
  const r = audit('rug', ['-@--------', '-UUU------', '----------', '-Y--------', '-Y--------',
                          '----------', '----------', 'E---------'], 'd');
  const [step] = r.steps;
  assert.deepEqual(step.moved, [
    moves({ cells: pieceCells(r.frames[0], 1), lane: BODY_LANE, o: RUG, ref: 1, dx: 0, dy: 1 }),
    moves({ cells: pieceCells(r.frames[0], 0), lane: BODY_LANE,
            o: cell(r.frames[0], 1, 3).o, ref: 0, dx: 0, dy: 3 }),
  ], 'each body is one entry over its whole footprint, never a cell at a time');
});

test('a swept container reports what it becomes as it sheds', () => {
  const r = audit('sweep', ['-----------', '-@rC-------', 'E----------'], 'r');
  const head = r.steps[0].moved.find(m => m.o === CAN_FULL);
  assert.equal(head.becomes.o, CAN_EMPTY, 'the can that sheds says so');
  assert.equal(r.steps[0].spawned.filter(sp => sp.o === BAG).length, 1);
});

test('a grate that takes a BODY takes it in the same lane as everything else', () => {
  const rolled = audit('grate body', ['#####', '#@---', '#UU--', '#----', '#----', '#---E', '#####'],
                       'd', { water: ['-----', '-----', '-----', '-----', '-OO--', '-----', '-----'] });
  const cells = pieceCells(rolled.frames[0], 0);
  assert.deepEqual(rolled.steps[0].moved,
                   [moves({ cells, lane: BODY_LANE, o: RUG, ref: 0, dx: 0, dy: 2 })]);
  assert.deepEqual(rolled.steps[0].gone,
                   [leaves({ cells, lane: BODY_LANE, o: RUG, ref: 0, effect: 'falls' })]);

  const passed = audit('grate handoff',
                       ['######', '#@----', '#UU---', '#-----', '#O----', '#-----', '#----E', '######'],
                       'd', { water: ['------', '------', '------', '------', '------', '-O----',
                                      '------', '------'] });
  const tyre = passed.steps[0].moved.find(m => restsOn(m)[1] === 5);
  assert.deepEqual(passed.steps[0].gone,
                   [leaves({ o: tyre.o, cells: tyre.cells, effect: 'falls' })],
                   'the tyre it handed off to went down the grate');
});

test('a grate takes what travelled into it, and the step keeps both halves of that', () => {
  const slid = audit('grate slide', ['-----', '-@C--', 'E----'], 'r', { water: ['-----', '---O-', '-----'] });
  assert.deepEqual(slid.steps[0].moved, [moves({ o: CAN_FULL, from: [2, 1], to: [3, 1] })]);
  assert.deepEqual(slid.steps[0].gone,
    [leaves({ o: CAN_FULL, cells: [[2, 1]], effect: 'falls' })]);

  const rolled = audit('grate roll', ['------', '-@W---', 'E-----'], 'r', { water: ['------', '----O-', '------'] });
  assert.deepEqual(rolled.steps.flatMap(st => st.moved),
                   [moves({ o: WHEELIE, from: [2, 1], to: [4, 1] })]);
  assert.deepEqual(rolled.steps.flatMap(st => st.gone),
                   [leaves({ o: WHEELIE, cells: [[2, 1]], effect: 'falls' })]);

  const swept = audit('grate sweep', ['------', '@rC---', 'E-----'], 'r', { water: ['------', '---O--', '------'] });
  assert.deepEqual(swept.steps[0].moved.find(m => m.o === CAN_FULL),
                   moves({ o: CAN_FULL, from: [2, 1], to: [3, 1] }));
  assert.deepEqual(swept.steps[0].gone,
                   [leaves({ o: CAN_FULL, cells: [[2, 1]], effect: 'falls' })]);
});


test('every terrain lane answers for itself about what landing on it costs', () => {
  for (let ter = 0; ter < TERRAINS; ter++)
    assert.equal(typeof LANDS_ON[ter], 'function', `terrain ${ter} states no landing rule`);
  assert.equal(Object.keys(LANDS_ON).length, TERRAINS,
    'the table holds every lane and nothing else');
});


test('trash swept into a canal fills it, and the step says which lane took it', () => {
  const r = audit('sweep-canal', ['######', '#@rx-#', '#E---#', '######'], 'r',
    { water: ['------', '----~-', '------', '------'] });
  const step = r.steps.at(-1);
  assert.deepEqual(step.gone.filter(g => g.o === TRASH),
    [leaves({ o: TRASH, cells: [[3, 1]], effect: 'fills' })]);
  assert.equal(terrainOf(cell(r.next, 4, 1)), BRIDGE, 'the canal it filled is floor now');
  assert.equal(cell(r.next, 4, 1).o, NONE, 'and nothing is left standing in it');
});


test('a container the lane takes goes down whole, however it got there', () => {
  const shoved = audit('can-onto-grate', ['########', '#@C----#', '#-----E#', '########'], 'r',
    { water: ['--------', '---O----', '--------', '--------'] });
  const ejected = audit('can-out-of-barrow', ['##########', '#@CC----E#', '##########'], 'r',
    { water: ['----------', '----O-----', '----------'], cart: ['----------', '---r------', '----------'] });
  for (const [what, r] of [['shoved', shoved], ['ejected', ejected]]) {
    const all = r.steps.flatMap(st => st.spawned);
    assert.deepEqual(all.filter(sp => sp.o === BAG), [], `${what}: nothing is left on the floor`);
    assert.ok(r.steps.some(st => st.gone.some(g => g.o === CAN_FULL && g.effect === 'falls')),
      `${what}: the can went down`);
  }
});
