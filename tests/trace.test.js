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
  explain, cell, cartCells, pieceCells, bagsLeft, NONE,
  BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, BIN_EMPTY, STACK, WHEELIE, WHEELIE_EMPTY, JUG, JUG_EMPTY,
} from '../src/rules.js';
import { toState } from '../src/format.js';

const S = (grid, cart, water) => toState({ id: 't', grid, cart, water });
const key = ([x, y]) => `${x},${y}`;

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

/** Every cell some event in this step points at, including both ends of a piece's travel. */
function named(prev, step) {
  const t = new Set();
  step.gone.forEach(g => t.add(key(g.at)));
  step.spawned.forEach(sp => t.add(key(sp.at)));
  step.moved.forEach(m => { t.add(key(m.from)); t.add(key(m.to)); });
  // One body or several — a tow moves a barrow and its load in one beat, and a rug that sets a
  // bicycle going moves two pieces. Same shape `applyStep` reads.
  for (const b of step.born) for (const [x, y] of b.cells) t.add(`${x},${y}`);
  for (const { kind, ref, dx, dy } of [step.piece ?? []].flat()) {
    const cells = kind === 'cart' ? cartCells(prev, ref) : pieceCells(prev, ref);
    assert.ok(cells.length, `piece ${kind}:${ref} has no cells on the board it moves from`);
    for (const [x, y] of cells) { t.add(`${x},${y}`); t.add(`${x + dx},${y + dy}`); }
  }
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

    // The origin claim: whatever a step says moved must have been sitting where it says.
    for (const m of step.moved)
      assert.equal(cell(prev, ...m.from).o, m.o,
        `${at}: moved says ${m.o} was at ${m.from}, the board had ${cell(prev, ...m.from).o}`);
    for (const g of step.gone)
      assert.equal(cell(prev, ...g.at).o, g.o, `${at}: gone says ${g.o} was at ${g.at}`);

    // Something new lands on empty ground, or on ground vacated in this same step — the
    // wheelie's bag drops onto the bin's own starting cell when the roll is one long.
    const vacated = new Set(step.moved.map(m => key(m.from)));
    for (const sp of step.spawned) {
      if (sp.effect === 'pours') continue;
      assert.ok(cell(prev, ...sp.at).o === NONE || vacated.has(key(sp.at)),
        `${at}: spawned ${sp.o} onto occupied cell ${sp.at}`);
    }
  });
  return r;
}

test('a plain step reports no motion but the raccoon', () => {
  const r = audit('walk', ['@--E'], 'r');
  assert.deepEqual(r.steps, [{ moved: [], spawned: [], gone: [], born: [], piece: null, impact: false }]);
  assert.equal(r.frames[1].rac.x, 1);
});

test('a tear consumes the bag and throws five piles out of it', () => {
  const r = audit('tear', ['-----', '--$--', '--@--', 'E----'], 'u');
  const [step] = r.steps;
  assert.deepEqual(step.gone, [{ o: BAG, at: [2, 1] }]);
  assert.equal(step.spawned.length, 5);
  for (const sp of step.spawned) assert.deepEqual(sp.from, [2, 1], 'every speck flies out of the bag');
});

test('a fan cell over the canal reports that it fills rather than rests', () => {
  const r = audit('tear-canal', ['-----', '--$--', '--@--', 'E----'], 'u',
    { water: ['--~--', '-----', '-----', '-----'] });
  const fills = r.steps[0].spawned.filter(sp => sp.effect === 'fills');
  assert.equal(fills.length, 1);
  assert.deepEqual(fills[0].at, [2, 0]);
});

test('each two-cell piece moves itself and launches its load from its own cell', () => {
  for (const [g, o, becomes, load] of [
    ['C', CAN_FULL, CAN_EMPTY, BAG], ['S', STACK, CAN_FULL, BAG],
    ['B', BIN, BIN_EMPTY, TRASH], ['j', JUG, JUG_EMPTY, NONE],
  ]) {
    const r = audit(`two-cell ${g}`, ['-----', '-----', `--${g}--`, '--@--', 'E----'], 'u');
    const [step] = r.steps;
    assert.deepEqual(step.moved, [{ o, from: [2, 2], to: [2, 1], ...(becomes && { becomes }) }]);
    assert.deepEqual(step.spawned[0].at, [2, 0]);
    assert.deepEqual(step.spawned[0].from, [2, 2], 'the load comes out of the piece');
    assert.equal(step.spawned[0].o, load);
  }
});

test('an empty can is one move and nothing else', () => {
  const r = audit('can', ['-----', '--c--', '--@--', 'E----'], 'u');
  assert.deepEqual(r.steps[0].moved, [{ o: CAN_EMPTY, from: [2, 1], to: [2, 0] }]);
});

test('a couch reports one rigid translation, not four cell edits', () => {
  const r = audit('couch', ['-----', '-FF--', '-FF--', '-@---', 'E----'], 'u');
  const [step] = r.steps;
  assert.deepEqual(step.piece, [{ kind: 'furniture', ref: 0, dx: 0, dy: -1 }]);
  assert.deepEqual(step.moved, [], 'a rigid body is one piece, not a pile of moves');
});

test('a wheelie bin rolls first and dumps after, out of the BIN', () => {
  // Two things pinned here. The bag is ejected by a bin that ended up at (2,0), three cells
  // from the cell that was shoved — a board diff could only guess the shove cell. And the
  // dump is its own beat: report it with the roll and the bag is drawn leaving a bin that is
  // still halfway down the alley, which is not what a collision looks like.
  const r = audit('wheelie', ['-----', '-----', '-----', '--W--', 'E-@--'], 'u');
  assert.equal(r.steps.length, 2, 'the roll and the dump are separate beats');
  const [roll, dump] = r.steps;
  assert.deepEqual(roll.moved, [{ o: WHEELIE, from: [2, 3], to: [2, 0] }]);
  assert.deepEqual(roll.spawned, [], 'it is still carrying the bag the whole way down');
  assert.equal(roll.impact, true, 'and it stopped because something stopped it');
  assert.equal(bagsLeft(r.frames[1]), 1, 'the bag is accounted for throughout, never in limbo');
  assert.deepEqual(dump.spawned, [{ o: BAG, at: [2, 1], from: [2, 0] }]);
  assert.equal(dump.moved[0].becomes, WHEELIE_EMPTY, 'and it empties as the bag leaves');
  assert.equal(dump.impact, false, 'the dump is the consequence, not another collision');
});

test('an empty wheelie bin rolls with nothing to eject', () => {
  const r = audit('wheelie-empty', ['-----', '-----', '--w--', '--@--', 'E----'], 'u');
  assert.deepEqual(r.steps[0].spawned, []);
  assert.equal(r.steps[0].moved[0].becomes, undefined);
});

test('a cart reports one translation per cell of travel', () => {
  const r = audit('cart-roll', ['@--xxx-#', 'E-------'], 'r', { cart: ['-PP-----', '--------'] });
  assert.equal(r.frames.length, 6);
  const travel = r.steps.filter(st => st.piece);
  assert.equal(travel.length, 4, 'four advances');
  for (const st of travel) assert.deepEqual([st.piece.dx, st.piece.dy], [1, 0]);
  assert.equal(travel.at(-1).impact, true, 'the last cell of travel is the collision');
  assert.equal(r.steps.length, 5, 'four advances and the tip that follows them');

  // A LOADED cart is heavy: one translation, and no roll to be stopped at the end of, so there
  // is no tip to report either.
  const heavy = audit('cart-heavy', ['@cc--#', 'E-----'], 'r', { cart: ['-PP---', '------'] });
  assert.equal(heavy.steps.length, 1, 'one cell, one step');
  assert.deepEqual(heavy.steps[0].moved, [], 'its load went with it, so nothing is named');
});

test('swallowing and shedding are changes of parent, not of position', () => {
  // Neither end of this moves on the board: the cart rolls ONTO what it takes and OUT FROM
  // UNDER what it sheds. If either were reported as a position change the renderer would
  // snap it, which is the whole thing riding is meant to avoid.
  const r = audit('cart-parent', ['@--xxx-#', 'E-------'], 'r', { cart: ['-PP-----', '--------'] });
  // travel steps only — the tip is the one step where cart cargo genuinely goes somewhere
  const rides = r.steps.filter(st => st.piece).flatMap(st => st.moved).filter(m => m.parent !== undefined);
  assert.ok(rides.length >= 4, 'three swallows and at least one shed');
  for (const m of rides)
    assert.deepEqual(m.from, m.to, `a ${m.parent === null ? 'shed' : 'swallow'} must not move the cargo`);
  assert.ok(rides.some(m => m.parent !== null), 'something was taken aboard');
  assert.ok(rides.some(m => m.parent === null), 'something was shed');
});

test('a shed names the cell the load rode in and the cell it lands on', () => {
  // The cart is blocked, so nothing about it moves — only what comes off it. It leaves the file
  // the raccoon is NOT behind, into the cell behind that file, and the report has to name both
  // or a renderer has nowhere to fly it from.
  const r = audit('cart-shed', ['-c#', '@c#', 'E--'], 'r', { cart: ['-P-', '-P-', '---'] });
  const tip = r.steps.at(-1);
  assert.equal(tip.piece, null, 'the cart itself is going nowhere');
  const out = tip.moved.filter(m => m.parent === null);
  assert.deepEqual(out.map(m => m.from), [[1, 0]], 'from the slot it rode in');
  assert.deepEqual(out.map(m => m.to), [[0, 0]], 'to the cell behind that file');
  for (const m of tip.moved) assert.notDeepEqual(m.from, m.to, 'everything in a shed moves');
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
      const d = Math.abs(m.to[0] - m.from[0]) + Math.abs(m.to[1] - m.from[1]);
      assert.ok(d <= 1, `${grid[0]}: ${JSON.stringify(m)} crossed ${d} cells`);
    }
  }
});

test('a tip lands contiguously behind the cart, never skipping a taken cell', () => {
  // The property, not one board: whatever comes out fills the run backward from the cart with
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
    if (tip.piece) continue;                       // this board did not tip
    const before = r.frames[r.frames.length - 2];
    for (const m of tip.moved.filter(m => m.parent === null)) {
      // walk from the landing cell back toward the cart: every cell between must be free
      const [dx, dy] = [Math.sign(m.from[0] - m.to[0]), Math.sign(m.from[1] - m.to[1])];
      for (let p = [m.to[0] + dx, m.to[1] + dy];
           !(p[0] === m.from[0] && p[1] === m.from[1]); p = [p[0] + dx, p[1] + dy]) {
        const c = cell(before, ...p);
        assert.ok(c.o === NONE || c.cart !== undefined,
          `a tip crossed occupied cell ${p} on its way to ${m.to}`);
      }
    }
  }
});

test('cargo tipped into the canal reports that it fills', () => {
  const r = audit('cart-canal', ['-x#', '@x#', 'E--'], 'r',
    { cart: ['-P-', '-P-', '---'], water: ['~--', '---', '---'] });
  const tip = r.steps.at(-1);
  assert.equal(tip.moved[0].effect, 'fills');
  assert.equal(tip.moved[0].o, TRASH);
  assert.deepEqual(tip.moved[0].to, [0, 0]);
});

test('a tip only ever moves cargo backward, and never past the run the cart came through', () => {
  // The load settles against the back of the basket and the wall pushes it out behind. Both
  // halves travel the same way — away from the wall — and nothing goes further back than the
  // cell the cart's trail slot started in, which is where the raccoon is standing.
  for (const [grid, cart, water] of [
    [['@--xxx-#', 'E-------'], ['-PP-----', '--------'], null],
    [['@cc---#', 'E------'], ['-PP----', '-------'], null],
    [['@-c-#', 'E----'], ['-PP--', '-----'], null],
    [['@-x--#', 'E-----'], ['-PP---', '------'], ['--~---', '------']],
    [['@c-#', '-c-#', 'E---'], ['-P--', '-P--', '----'], null],
  ]) {
    const r = audit('tip-direction', grid, 'r', { cart, water });
    const tip = r.steps.at(-1);
    if (tip.piece) continue;
    for (const m of tip.moved) {
      const back = (m.from[0] - m.to[0]) + (m.from[1] - m.to[1]);   // shoves here are all 'r'
      assert.ok(back > 0, `a tip moved ${m.o} from ${m.from} to ${m.to} — not backward`);
      assert.ok(m.to[0] > r.frames[0].rac.x, `${m.o} landed on or behind the raccoon's start`);
    }
  }
});

test('a broadside cart reports both files in one step', () => {
  // Empty, so it is light and takes the whole run — and both files swallow on the same beat.
  const r = audit('cart-wide', ['@--c-FE', '---c-F-'], 'r', { cart: ['-P-----', '-P-----'] });
  const swallows = r.steps.flatMap(st => st.moved).filter(m => m.parent !== undefined && m.parent !== null);
  assert.equal(swallows.length, 2, 'two lead cells, two things aboard');
  assert.deepEqual(r.steps[0].piece.ref, r.steps[1].piece.ref, 'the same cart both steps');
});

test('nothing is traced unless it is asked for', () => {
  const s = S(['@--x-#', 'E-----'], ['-PP---', '------']);
  const plain = explain(s, 'r');
  assert.equal(plain.frames, undefined);
  assert.equal(plain.steps, undefined);
});

test('a rug that sets a bicycle going reports the bicycle as a BODY', () => {
  // Both are multi-cell, so both have one sprite for a whole footprint. Naming the bicycle's
  // cells in `moved` names sprites the stage does not hold, and `applyStep` throws — which is
  // invisible to a board comparison and shows only on screen.
  //
  // The two lie ACROSS each other, because each rolls on the axis the other does not: the rug
  // is shoved against its side, and what it sets going is a bicycle pointing down the lane.
  const r = audit('rug', ['-@--------', '-UUU------', '----------', '-Y--------', '-Y--------',
                          '----------', '----------', 'E---------'], 'd');
  const [step] = r.steps;
  assert.deepEqual(step.moved, [], 'a body is never an occupant sprite');
  assert.deepEqual(step.piece, [
    { kind: 'furniture', ref: 1, dx: 0, dy: 1 },     // the rug, stopped against the bicycle
    { kind: 'furniture', ref: 0, dx: 0, dy: 3 },     // the bicycle it handed off to
  ]);
});

test('a swept container reports what it becomes as it sheds', () => {
  // The head of the line is the only cell with room beyond it, so it is the only one that can
  // shed — and the board empties it. A `moved` entry with no `becomes` leaves the sprite drawn
  // full beside the bag it just threw, which reads as two bags.
  const r = audit('sweep', ['-----------', '-@rC-------', 'E----------'], 'r');
  const head = r.steps[0].moved.find(m => m.o === CAN_FULL);
  assert.equal(head.becomes, CAN_EMPTY, 'the can that sheds says so');
  assert.equal(r.steps[0].spawned.filter(sp => sp.o === BAG).length, 1);
});

test('a grate that takes a BODY says so on the piece entry', () => {
  // A body has no occupant code, so `gone` — which names a sprite by its code and cell — cannot
  // express one. Without a word from the piece entry nothing is emitted at all: the board is
  // right, the step is silent, and the stage slides the sprite onto the grate and leaves it
  // drawn there. It ARRIVES and is then gone, which is what `falls` says everywhere else.
  const rolled = audit('grate body', ['#####', '#@---', '#UU--', '#----', '#----', '#---E', '#####'],
                       'd', { water: ['-----', '-----', '-----', '-----', '-OO--', '-----', '-----'] });
  assert.deepEqual(rolled.steps[0].piece,
                   [{ kind: 'furniture', ref: 0, dx: 0, dy: 2, effect: 'falls' }]);

  // And what a hand-off passes to a grate, body or not: the same word, on whichever entry can
  // carry it. A tyre is an occupant, so it is `moved` that has to say it.
  const passed = audit('grate handoff',
                       ['######', '#@----', '#UU---', '#-----', '#O----', '#-----', '#----E', '######'],
                       'd', { water: ['------', '------', '------', '------', '------', '-O----',
                                      '------', '------'] });
  const tyre = passed.steps[0].moved.find(m => m.to[1] === 5);
  assert.equal(tyre.effect, 'falls', 'the tyre it handed off to went down the grate');
});

test('a grate takes what travelled into it, and the step says it fell', () => {
  // It ARRIVES over the grate and only then goes down, which is the same two-part account the
  // body and the hand-off get. `gone` alone is right about the board and silent about the
  // travel: matched against a sprite's ANCHOR it deflates the piece on the cell it started
  // from, and a piece that shrinks where it stood reads as forgotten rather than dropped.
  const slid = audit('grate slide', ['-----', '-@C--', 'E----'], 'r', { water: ['-----', '---O-', '-----'] });
  assert.deepEqual(slid.steps[0].moved, [{ o: CAN_FULL, from: [2, 1], to: [3, 1], effect: 'falls' }]);
  assert.deepEqual(slid.steps[0].gone, []);

  const rolled = audit('grate roll', ['------', '-@W---', 'E-----'], 'r', { water: ['------', '----O-', '------'] });
  assert.deepEqual(rolled.steps.flatMap(st => st.moved),
                   [{ o: WHEELIE, from: [2, 1], to: [4, 1], effect: 'falls' }]);
  assert.deepEqual(rolled.steps.flatMap(st => st.gone), []);

  // And what a broom sweeps in, which travels as a line and loses only its head to the hole.
  const swept = audit('grate sweep', ['------', '@rC---', 'E-----'], 'r', { water: ['------', '---O--', '------'] });
  assert.deepEqual(swept.steps[0].moved.find(m => m.o === CAN_FULL),
                   { o: CAN_FULL, from: [2, 1], to: [3, 1], effect: 'falls' });
  assert.deepEqual(swept.steps[0].gone, []);
});
