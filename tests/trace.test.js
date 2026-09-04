// A traced action reports what MOVED, not just what the board became. Those are different
// claims, and the difference is exactly what a renderer gets wrong when it is left to guess:
// diffing two boards tells you a bag appeared behind a wheelie bin, but not that the bin put
// it there, so the bag ends up flying out of whatever cell was shoved.
//
// These are coverage checks rather than a replay: an event vocabulary rich enough to
// reconstruct a board would be a second copy of the rules. What matters is that no branch
// changes a cell it never mentions, and that no event names an origin that was never holding
// what it claims — the two ways a piece silently stops animating, or animates from nowhere.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  explain, cell, cartCells, pieceCells, bagsLeft, restsOn, moves, arrives, leaves, NONE,
  BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, BIN_EMPTY, WHEELIE, WHEELIE_EMPTY, JUG, JUG_EMPTY,
  FURNITURE, RUG, LANDS_ON, TERRAINS, terrainOf, BRIDGE,
} from '../src/rules.js';
import { toState } from '../src/format.js';
import { anchorOf, laneOf, isBodyLane, CART_LANE, BODY_LANE } from '../src/handles.js';

const S = (grid, cart, water) => toState({ id: 't', grid, cart, water });
const key = ([x, y]) => `${x},${y}`;
/** The movements of things the board gives an id to — one sprite over a whole footprint. */
const bodies = st => st.moved.filter(m => isBodyLane(laneOf(m.handle)));

/** Cells whose contents differ — occupant, terrain, or which piece owns them. */
function changed(a, b) {
  const out = [];
  for (let y = 0; y < a.rows; y++) for (let x = 0; x < a.cols; x++) {
    const p = cell(a, x, y), q = cell(b, x, y);
    if (p.o !== q.o || !!p.water !== !!q.water || !!p.bridge !== !!q.bridge
        || p.cart !== q.cart || p.pid !== q.pid) out.push(`${x},${y}`);
  }
  return out;
}

/** Every cell some event in this step points at, including both ends of a movement's travel. */
function named(prev, step) {
  const t = new Set();
  step.gone.forEach(g => g.cells.forEach(c => t.add(key(c))));
  step.spawned.forEach(sp => sp.cells.forEach(c => t.add(key(c))));
  // Every entry names its whole span, so a couch and a can are read the same way here.
  step.moved.forEach(m => m.cells.forEach(([x, y]) => {
    t.add(`${x},${y}`); t.add(`${x + m.dx},${y + m.dy}`);
  }));
  return t;
}

function audit(label, grid, dir, { cart, water } = {}) {
  const s = S(grid, cart, water);
  const r = explain(s, dir, { trace: true });
  assert.ok(r.ok, `${label}: expected a legal action, got refused (${r.reason})`);
  assert.equal(r.steps.length, r.frames.length - 1, `${label}: one step per transition`);

  r.steps.forEach((step, i) => {
    const prev = r.frames[i], next = r.frames[i + 1], at = `${label} step ${i}`;
    const t = named(prev, step);
    for (const k of changed(prev, next))
      assert.ok(t.has(k), `${at}: cell ${k} changed and no event names it`);

    // The origin claim: whatever a step says moved must have been sitting where it says. A cart
    // is not an occupant of its cell and declares no code, so it makes no such claim.
    for (const m of step.moved)
      if (m.o !== null) for (const c of m.cells)
        assert.equal(cell(prev, ...c).o, m.o,
          `${at}: moved says ${m.o} was at ${c}, the board had ${cell(prev, ...c).o}`);
    // An arrival the board did not receive is both facts: it arrives, and it is then gone. Such
    // a removal is about a thing that was never on the board this step ran on, so the origin
    // claim is not one it makes.
    const arrived = new Set(step.spawned.map(sp => sp.handle));
    for (const g of step.gone)
      if (g.o !== null && !arrived.has(g.handle))
        assert.equal(cell(prev, ...g.cells[0]).o, g.o, `${at}: gone says ${g.o} was at ${g.cells[0]}`);

    // Something new lands on empty ground, or on ground vacated in this same step — the
    // wheelie's bag drops onto the bin's own starting cell when the roll is one long.
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
  // Two things pinned here. The bag is ejected by a bin that ended up at (2,0), three cells
  // from the cell that was shoved — a board diff could only guess the shove cell. And the
  // dump is its own beat: report it with the roll and the bag is drawn leaving a bin that is
  // still halfway down the alley, which is not what a collision looks like.
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

  // A LOADED cart is heavy: one translation, and no roll to be stopped at the end of, so there
  // is no tip to report either.
  const heavy = audit('cart-heavy', ['@cc--#', 'E-----'], 'r', { cart: ['-PP---', '------'] });
  assert.equal(heavy.steps.length, 1, 'one cell, one step');
  assert.deepEqual(heavy.steps[0].moved.filter(m => m.o !== null), [],
    'its load went with it, so nothing but the cart itself is named');
});

test('swallowing and shedding are changes of parent, not of position', () => {
  // Neither end of this moves on the board: the skateboard rolls ONTO what it takes and OUT FROM
  // UNDER what it sheds. If either were reported as a position change the renderer would
  // snap it, which is the whole thing riding is meant to avoid.
  const r = audit('cart-parent', ['@--xxx-#', 'E-------'], 'r', { cart: ['-PP-----', '--------'] });
  // travel steps only — the tip is the one step where cart cargo genuinely goes somewhere
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
  // The cart is blocked, so nothing about it moves — only what comes off it. It leaves the file
  // the raccoon is NOT behind, into the cell behind that file, and the report has to name both
  // or a renderer has nowhere to fly it from.
  const r = audit('cart-shed', ['-c#', '@c#', 'E--'], 'r', { cart: ['-P-', '-P-', '---'] });
  const tip = r.steps.at(-1);
  assert.deepEqual(bodies(tip), [], 'the skateboard itself is going nowhere');
  const out = tip.moved.filter(m => m.parent === null);
  assert.deepEqual(out.map(m => anchorOf(m.cells)), [[1, 0]], 'from the slot it rode in');
  assert.deepEqual(out.map(restsOn), [[0, 0]], 'to the cell behind that file');
  for (const m of tip.moved) assert.ok(m.dx || m.dy, 'everything in a shed moves');
});

test('nothing a cart reports ever crosses more than one cell', () => {
  // The invariant that keeps a renderer honest. Rolling, a slot back and a cell forward cancel
  // and cargo reports from === to; stopped, the same nudge is one real cell. Nothing composes
  // the two into a longer vector, so no load is ever drawn flying across the board.
  for (const grid of [
    ['@$-----#', 'E-------'],       // bag in the trail slot
    ['@-$----#', 'E-------'],       // bag in the lead slot
    ['@--xxx-#', 'E-------'],       // swallowing, shedding and stopping
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
  // The property, not one board: whatever comes out fills the run backward from the skateboard with
  // no gap, so a pile can never be found on the far side of something already down.
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
    if (bodies(tip).length) continue;              // this board did not tip
    const before = r.frames[r.frames.length - 2];
    for (const m of tip.moved.filter(m => m.parent === null)) {
      // walk from the landing cell back toward the skateboard: every cell between must be free
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
  // Named where the stage is HOLDING it, which is the cell it set off from.
  assert.deepEqual(tip.gone, [{ o: TRASH, ref: null, cells: tip.moved[0].cells,
                                handle: tip.moved[0].handle, effect: 'fills' }]);
});

test('a tip only ever moves cargo backward, and never past the run the skateboard came through', () => {
  // The load settles against the tail of the deck and the wall pushes it out behind. Both
  // halves travel the same way — away from the wall — and nothing goes further back than the
  // cell the skateboard's trail slot started in, which is where the raccoon is standing.
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
      const back = -(m.dx + m.dy);                                 // shoves here are all 'r'
      assert.ok(back > 0, `a tip moved ${m.o} by ${m.dx},${m.dy} — not backward`);
      assert.ok(restsOn(m)[0] > r.frames[0].rac.x,
        `${m.o} landed on or behind the raccoon's start`);
    }
  }
});

test('a broadside cart reports both files in one step', () => {
  // Empty, so it is light and takes the whole run — and both files swallow on the same beat.
  const r = audit('cart-wide', ['@--c-FE', '---c-F-'], 'r', { cart: ['-P-----', '-P-----'] });
  const swallows = r.steps.flatMap(st => st.moved).filter(m => m.parent !== undefined && m.parent !== null);
  assert.equal(swallows.length, 2, 'two lead cells, two things aboard');
  assert.deepEqual(bodies(r.steps[0])[0].ref, bodies(r.steps[1])[0].ref, 'the same cart both steps');
});

test('nothing is traced unless it is asked for', () => {
  const s = S(['@--x-#', 'E-----'], ['-PP---', '------']);
  const plain = explain(s, 'r');
  assert.equal(plain.frames, undefined);
  assert.equal(plain.steps, undefined);
});

test('a rug that sets a bicycle going reports the bicycle as a BODY', () => {
  // Both are multi-cell, so both have one sprite for a whole footprint. An entry per CELL of the
  // bicycle names sprites the stage does not hold, and `applyStep` throws — which is invisible to
  // a board comparison and shows only on screen.
  //
  // The two lie ACROSS each other, because each rolls on the axis the other does not: the rug
  // is shoved against its side, and what it sets going is a bicycle pointing down the lane.
  const r = audit('rug', ['-@--------', '-UUU------', '----------', '-Y--------', '-Y--------',
                          '----------', '----------', 'E---------'], 'd');
  const [step] = r.steps;
  assert.deepEqual(step.moved, [
    // the rug, stopped against the bicycle
    moves({ cells: pieceCells(r.frames[0], 1), lane: BODY_LANE, o: RUG, ref: 1, dx: 0, dy: 1 }),
    // the bicycle it handed off to
    moves({ cells: pieceCells(r.frames[0], 0), lane: BODY_LANE,
            o: cell(r.frames[0], 1, 3).o, ref: 0, dx: 0, dy: 3 }),
  ], 'each body is one entry over its whole footprint, never a cell at a time');
});

test('a swept container reports what it becomes as it sheds', () => {
  // The head of the line is the only cell with room beyond it, so it is the only one that can
  // shed — and the board empties it. A `moved` entry with no `becomes` leaves the sprite drawn
  // full beside the bag it just threw, which reads as two bags.
  const r = audit('sweep', ['-----------', '-@rC-------', 'E----------'], 'r');
  const head = r.steps[0].moved.find(m => m.o === CAN_FULL);
  assert.equal(head.becomes.o, CAN_EMPTY, 'the can that sheds says so');
  assert.equal(r.steps[0].spawned.filter(sp => sp.o === BAG).length, 1);
});

test('a grate that takes a BODY takes it in the same lane as everything else', () => {
  // Without a removal nothing is emitted at all: the board is right, the step is silent, and the
  // stage slides the sprite onto the grate and leaves it drawn there. The movement carries it to
  // the hole and the removal takes it down, which is the two-part account every traveller that
  // does not survive the trip gets.
  const rolled = audit('grate body', ['#####', '#@---', '#UU--', '#----', '#----', '#---E', '#####'],
                       'd', { water: ['-----', '-----', '-----', '-----', '-OO--', '-----', '-----'] });
  const cells = pieceCells(rolled.frames[0], 0);
  assert.deepEqual(rolled.steps[0].moved,
                   [moves({ cells, lane: BODY_LANE, o: RUG, ref: 0, dx: 0, dy: 2 })]);
  assert.deepEqual(rolled.steps[0].gone,
                   [leaves({ cells, lane: BODY_LANE, o: RUG, ref: 0, effect: 'falls' })]);

  // And what a hand-off passes to a grate, body or not: one lane, whichever sort of thing it is.
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
  // It ARRIVES over the grate and only then goes down. A removal on its own is right about the
  // board and silent about the travel: matched against a sprite's ANCHOR it deflates the piece
  // on the cell it started from, and a piece that shrinks where it stood reads as forgotten
  // rather than dropped. So the movement entry carries it and the removal takes it down.
  const slid = audit('grate slide', ['-----', '-@C--', 'E----'], 'r', { water: ['-----', '---O-', '-----'] });
  assert.deepEqual(slid.steps[0].moved, [moves({ o: CAN_FULL, from: [2, 1], to: [3, 1] })]);
  assert.deepEqual(slid.steps[0].gone,
    [leaves({ o: CAN_FULL, cells: [[2, 1]], effect: 'falls' })]);

  const rolled = audit('grate roll', ['------', '-@W---', 'E-----'], 'r', { water: ['------', '----O-', '------'] });
  assert.deepEqual(rolled.steps.flatMap(st => st.moved),
                   [moves({ o: WHEELIE, from: [2, 1], to: [4, 1] })]);
  assert.deepEqual(rolled.steps.flatMap(st => st.gone),
                   [leaves({ o: WHEELIE, cells: [[2, 1]], effect: 'falls' })]);

  // And what a broom sweeps in, which travels as a line and loses only its head to the hole.
  const swept = audit('grate sweep', ['------', '@rC---', 'E-----'], 'r', { water: ['------', '---O--', '------'] });
  assert.deepEqual(swept.steps[0].moved.find(m => m.o === CAN_FULL),
                   moves({ o: CAN_FULL, from: [2, 1], to: [3, 1] }));
  assert.deepEqual(swept.steps[0].gone,
                   [leaves({ o: CAN_FULL, cells: [[2, 1]], effect: 'falls' })]);
});


test('every terrain lane answers for itself about what landing on it costs', () => {
  // The point of the table is that there is no fallthrough: a lane that takes nothing says so,
  // and a lane added without an answer is a throw rather than a silent inheritance of one.
  for (let ter = 0; ter < TERRAINS; ter++)
    assert.equal(typeof LANDS_ON[ter], 'function', `terrain ${ter} states no landing rule`);
  assert.equal(Object.keys(LANDS_ON).length, TERRAINS,
    'the table holds every lane and nothing else');
});


test('trash swept into a canal fills it, and the step says which lane took it', () => {
  // The broom sweeps what a shove cannot move, so it is the one path that can put trash on a
  // lane no other action reaches. The lane has to answer for it on the board as well as in the
  // account: what the canal takes is what it then becomes.
  const r = audit('sweep-canal', ['######', '#@rx-#', '#E---#', '######'], 'r',
    { water: ['------', '----~-', '------', '------'] });
  const step = r.steps.at(-1);
  assert.deepEqual(step.gone.filter(g => g.o === TRASH),
    [leaves({ o: TRASH, cells: [[3, 1]], effect: 'fills' })]);
  assert.equal(terrainOf(cell(r.next, 4, 1)), BRIDGE, 'the canal it filled is floor now');
  assert.equal(cell(r.next, 4, 1).o, NONE, 'and nothing is left standing in it');
});
