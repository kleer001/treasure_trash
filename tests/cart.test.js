import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, isWon, bagsLeft, trashHeld, stateKey, cell } from '../src/rules.js';
import { toState, toGrid, toCart, toWater } from '../src/format.js';

// Carts ride in their own aligned block, like water: the occupant grid holds the CARGO, and
// the mask says which cells are cart cells. See FORMATS.md.
const S = (grid, cart, water) => toState({ id: 't', grid, cart, water });
const act = (grid, cart, dir, water) => {
  const r = explain(S(grid, cart, water), dir);
  assert.ok(r.ok, `expected a legal action, got refused (${r.reason})`);
  return r.next;
};
const refused = (grid, cart, dir, water) => {
  const r = explain(S(grid, cart, water), dir);
  assert.ok(!r.ok, 'expected a refusal');
  return r.reason;
};

test('the raccoon follows the cart in, exactly as he follows a can', () => {
  const next = act(['@---E', '-----'], ['-PP--', '-----'], 'r');
  assert.deepEqual(next.rac, { x: 1, y: 0 });
  assert.deepEqual(toCart(next), ['--PP-', '-----']);
});

test('...but what leaves the trail slot claims the cell behind, and he takes what is left', () => {
  // The can rides the trail slot, so the stop puts it straight out into the cell behind. That
  // is the cell he would have followed into, so he has nowhere to go and stays on the bank.
  // The occupant grid reads the same before and after — only `toCart` says it is off the cart.
  const next = act(['@c--#', 'E----'], ['-PP--', '-----'], 'r');
  assert.deepEqual(toGrid(next), ['@c--#', 'E----']);
  assert.deepEqual(toCart(next), ['--PP-', '-----'], 'the cart is empty');
  assert.deepEqual(next.rac, { x: 0, y: 0 });
});

test('end-on, a third pile pushes the first out the back: two in, the old one behind', () => {
  // The cart holds one can in its LEAD slot. The first can it swallows shoves that one to the
  // trail; the second shoves it out. A couch stops the roll and the load slides back out into
  // the run — until the can shed mid-roll blocks it, so the last one keeps its slot.
  const next = act(['@-ccc-F-', '------F-', 'E-------'],
                   ['-PP-----', '--------', '--------'], 'r');
  assert.deepEqual(toGrid(next), ['-@ccc-F-', '------F-', 'E-------']);
  assert.deepEqual(toCart(next), ['----PP--', '--------', '--------']);
});

test('broadside, the cart is one slot deep, so both new cans displace the old one at once', () => {
  // Two cells of travel and one slot per file: what it picks up on the first cell is set back
  // down on the second, so the cart comes to rest empty a cell past the cans.
  const next = act(['@cc-FE', '--c-F-'], ['-P----', '-P----'], 'r');
  assert.deepEqual(toGrid(next), ['@cc-FE', '--c-F-']);
  assert.deepEqual(toCart(next), ['---P--', '---P--']);
});

test('broadside swallows two things in one shove, and sets both down again behind it', () => {
  const next = act(['@-c-FE', '--c-F-'], ['-P----', '-P----'], 'r');
  assert.deepEqual(toGrid(next), ['-@c-FE', '--c-F-']);
  assert.deepEqual(toCart(next), ['---P--', '---P--']);
});

test('a pile shed mid-roll lands on the cell it was picked up from', () => {
  // The cart is a two-slot pipe moving at exactly the rate a solid line is spaced, so the pile
  // it sheds comes down on its own square. The tip then fills the one free cell left behind it
  // and the third pile, with nowhere to land, drives off aboard.
  const next = act(['@--xxx-#', 'E-------'], ['-PP-----', '--------'], 'r');
  assert.deepEqual(toGrid(next), ['-@-xxx-#', 'E-------']);
  assert.deepEqual(toCart(next), ['-----PP-', '--------']);
  assert.equal(trashHeld(next), 1, 'one of the three piles drove off aboard');
});

test('what it swallowed on the way leaves by the same rule as what it was carrying', () => {
  // Where a thing came from does not follow it aboard. Here the run behind is blocked by the
  // can shed mid-roll, so the pile it took on keeps its slot — by the geometry, not by a
  // clause about newcomers.
  const next = act(['@cc-x-#', 'E------'], ['-PP----', '-------'], 'r');
  assert.deepEqual(toGrid(next), ['-@ccx-#', 'E------']);
  assert.deepEqual(toCart(next), ['----PP-', '-------']);
  assert.equal(trashHeld(next), 1, 'the pile it took aboard is still aboard');

  // Same rule from the other end: only the trail slot sheds. A newcomer enters at the LEAD, so
  // one stop nudges it to the trail and no further — it is aboard until something moves it on.
  const only = act(['@--$#', 'E----'], ['-PP--', '-----'], 'r');
  assert.equal(bagsLeft(only), 1);
  assert.deepEqual(toGrid(only), ['-@$-#', 'E----'], 'one slot back, still aboard');
  assert.deepEqual(toCart(only), ['--PP-', '-----']);
});

test('a cart against a wall is not a sealed box', () => {
  // Free play's shape: a broadside cart shoved up, one clear cell of runway before the bag and
  // one after it. It swallows the bag in passing, hits the wall a cell later, and the load
  // slides back out into the run it vacated. This is the whole reason the rule has to hold for
  // what it just picked up: nothing can stand on a wall, so a cart that reaches one can never
  // be shoved again. Whatever it swallowed on the way in would be out of the game for good, and
  // a bag pinned to a wall line can never be torn either — the fan needs two rows.
  const next = act(['###', '---', '-$-', '---', 'E@-'],
                   ['---', '---', '---', '-PP', '---'], 'u');
  assert.deepEqual(toGrid(next), ['###', '---', '-$-', '-@-', 'E--'], 'the bag is back on the floor');
  assert.deepEqual(toCart(next), ['---', '-PP', '---', '---', '---'], 'and the cart stays at the wall');
  assert.equal(bagsLeft(next), 1, 'still unopened — but reachable again');
});

test('a file tips exactly one, however far the cart rolled', () => {
  // Two cans aboard, end-on, so one file two slots deep. How far it travels picks the cell
  // the tipped can lands in; it does not pick how many land.
  const one = act(['@cc-#', 'E----'], ['-PP--', '-----'], 'r');
  assert.deepEqual(toGrid(one), ['@cc-#', 'E----'], 'one out at cell 1, one riding at cell 2');
  assert.deepEqual(toCart(one), ['--PP-', '-----']);

  const far = act(['@cc---#', 'E------'], ['-PP----', '-------'], 'r');
  assert.deepEqual(toGrid(far), ['-@-cc-#', 'E------'], 'still one — three cells of travel, one out');
  assert.deepEqual(toCart(far), ['----PP-', '-------']);
  assert.deepEqual(far.rac, { x: 1, y: 0 }, 'and he follows into the cell it left');
});

test('one per FILE, so a broadside cart sets down two at once', () => {
  // The same two cans, turned ninety degrees: broadside the cart is two files one slot deep,
  // and each tips its own. This is the axis asymmetry, not an exception to the rule.
  const next = act(['@c--#', '-c--#', 'E----'], ['-P---', '-P---', '-----'], 'r');
  assert.deepEqual(toGrid(next), ['-@c-#', '--c-#', 'E----'], 'both files tipped');
  assert.deepEqual(toCart(next), ['---P-', '---P-', '-----'], 'and the cart is empty');
});

test('what stopped it does not change whether it unloads', () => {
  // The wheelie bin never asks what stopped it, and neither does this. A cart that only spilled
  // against walls would make furniture and the exit into silent, unexplained parking spots.
  for (const [what, grid, cart] of [
    ['a wall',      ['@cc-#', 'E----'], ['-PP--', '-----']],
    ['a couch',     ['@cc-F', '----F', 'E----'], ['-PP--', '-----', '-----']],
    ['the exit',    ['@cc-E', '-----'], ['-PP--', '-----']],
    ['another cart', ['@cc-----', 'E-------'], ['-PP-QQ--', '--------']],
  ]) {
    const next = act(grid, cart, 'r');
    assert.equal(toCart(next)[0].slice(2, 4), 'PP', `${what} should stop it at cells 2-3`);
    assert.equal(toGrid(next)[0][1], 'c', `${what} should still put one down`);
  }
});

test('a cart that cannot roll at all is refused: it vacated nothing to unload into', () => {
  assert.equal(refused(['@cc#', 'E---'], ['-PP-', '----'], 'r'), 'canRoom');
});

test('a cart takes in anything single-cell — bag, can, bin, jug, wheelie, stack, trash', () => {
  for (const g of ['$', 'C', 'c', 'x', 'b', 'j', 'W', 'w', 'S']) {
    const r = explain(S([`@--${g}-F`, '-----F', 'E-----'], ['-PP---', '------', '------']), 'r',
                      { trace: true });
    assert.ok(r.ok, `${g} should load`);
    // It enters at the lead slot, and the couch that stops it nudges it one slot back — so it
    // finishes in the trail slot, still aboard. Intake is a fact about the roll, not the result.
    assert.equal(toCart(r.frames[1])[0], '--PP--', `${g} rides in the lead slot`);
    assert.equal(toGrid(r.frames[1])[0][3], g, `${g} should be aboard mid-roll`);
    assert.deepEqual(toGrid(r.next), [`-@-${g}-F`, '-----F', 'E-----'], `${g} should load`);
    assert.deepEqual(toCart(r.next), ['---PP-', '------', '------'], `${g} should load`);
  }
});

test('trash tipped into the canal fills it, exactly as a fan or a bin drop does', () => {
  // The pile starts in the cart's trail slot, rides forward, and the wall throws it back one
  // slot — past the trail and into open water. The cell stops being canal and becomes a
  // crossing, and the pile is spent doing it.
  const next = act(['@x---#', 'E-----'], ['-PP---', '------'], 'r', ['--~---', '------']);
  assert.deepEqual(toGrid(next), ['-@---#', 'E-----'], 'the pile is gone from the occupant grid');
  assert.deepEqual(toWater(next), ['--=---', '------'], 'it became a crossing');
});

test('only the trail slot sheds, so where a thing rides decides whether it lands', () => {
  // One shove is one nudge. A thing in the trail slot is one nudge from the ground; a thing in
  // the lead slot is two, so it finishes the shove aboard. The two carts come to rest in the
  // same place and the difference is on the board — which cell the bag is drawn in — rather
  // than in a slot the player has to have been told about.
  const trail = act(['@$-----#', 'E-------'], ['-PP-----', '--------'], 'r');
  assert.deepEqual(toGrid(trail), ['-@--$--#', 'E-------'], 'out, one cell behind the cart');
  assert.deepEqual(toCart(trail), ['-----PP-', '--------'], 'and the cart is empty');

  const lead = act(['@-$----#', 'E-------'], ['-PP-----', '--------'], 'r');
  assert.deepEqual(toGrid(lead), ['-@---$-#', 'E-------'], 'nudged to the trail slot, still aboard');
  assert.deepEqual(toCart(lead), toCart(trail), 'the carts stop in the same place either way');
});

test('a cart out in the canal is out of reach — he would have to stand in the water', () => {
  // The wheelie bin leaves from under the shove, so it can be sent into the canal and shoved
  // again from the bank. A cart is followed in like everything else, so it cannot — whatever
  // it happens to be carrying. A cart holding a wheelie bin used to inherit the exemption.
  for (const cargo of ['-', 'c', '$', 'W', 'w'])
    assert.equal(refused([`@${cargo}--E`, '-----'], ['-PP--', '-----'], 'r', ['-~~--', '-----']),
                 'water', `a cart carrying ${cargo}`);
});

test('a fan is refused into a cart: loading means rolling into cargo, not catching it', () => {
  assert.equal(refused(['-----', '--$--', '--@--', 'E----'],
                       ['-PP--', '-----', '-----', '-----'], 'u'), 'fan');
});

test('the win is the mess ON THE FLOOR: trash in a cart keeps the exit dark', () => {
  const held = S(['+-x-'], ['--PP']);
  assert.equal(bagsLeft(held), 0);
  assert.equal(trashHeld(held), 1);
  assert.equal(isWon(held), false, 'the pile is still in the cart');
});

test('junk that was never the mess rides out with him', () => {
  const junk = S(['+-c-'], ['--PP']);
  assert.equal(trashHeld(junk), 0);
  assert.equal(isWon(junk), true, 'an empty can in the cart is not unfinished business');
});

test('a bag in a cart still counts as a bag, wherever it is riding', () => {
  assert.equal(bagsLeft(S(['@-$-E'], ['--PP-'])), 1);
  assert.equal(bagsLeft(S(['@-W-E'], ['--PP-'])), 1);   // a full wheelie bin, in a cart
  assert.equal(bagsLeft(S(['@-S-E'], ['--PP-'])), 2);   // a stack is two, in a cart or out
});

test('a can riding in a cart is not the same board as a can lying on the floor', () => {
  // The regression this pins: cargo keeps its own occupant code, so without cart membership in
  // the packed character the two cells read identically and the solver merges distinct boards.
  const carted = stateKey(S(['@c--E'], ['-PP--']));
  const loose = stateKey(S(['@c--E']));
  assert.notEqual(carted, loose);
  assert.notEqual(carted.split('|')[0], loose.split('|')[0], 'the occupant lane must differ');
});

test('two carts abreast are not the same board as two carts end-on', () => {
  // Same four cart cells, two different partitions, and they roll completely differently.
  const rows = ['----', '----', '@--E'];
  const abreast = stateKey(S(rows, ['PP--', 'QQ--', '----']));
  const endOn = stateKey(S(rows, ['PQ--', 'PQ--', '----']));
  assert.notEqual(abreast, endOn);
});

test('a cart stops at another cart — it cannot take one aboard', () => {
  assert.equal(refused(['@----E', '------'], ['-PPQQ-', '------'], 'r'), 'canRoom');
});

test('the exit stops a cart without tipping it — nothing may rest there', () => {
  const next = act(['@---E', '-----'], ['-PP--', '-----'], 'r');
  assert.deepEqual(toCart(next), ['--PP-', '-----']);
});

test('the cart block round-trips, loaded and all', () => {
  const s = S(['@-cx--E', '-------'], ['-PP-QQ-', '-------']);
  assert.deepEqual(toGrid(s), ['@-cx--E', '-------']);
  assert.deepEqual(toCart(s), ['-PP-QQ-', '-------']);
});

test('a traced shove reports every board the roll passes through', () => {
  // A shove resolves several cells at once and the end state does not say in what order, so
  // a renderer needs the steps. Three piles, then a cell of runway to a wall: four advances
  // and the tip that follows them.
  const s = S(['@--xxx-#', 'E-------'], ['-PP-----', '--------']);
  const r = explain(s, 'r', { trace: true });
  assert.equal(r.frames.length, 6, 'the start, four advances and the tip');
  assert.deepEqual(toGrid(r.frames[0]), toGrid(s), 'frame 0 is the board before the shove');
  assert.deepEqual(toGrid(r.frames.at(-1)), toGrid(r.next), 'the last frame is the result');

  // one cell of travel per frame
  assert.deepEqual(toCart(r.frames[1]), ['--PP----', '--------']);
  assert.deepEqual(toCart(r.frames[2]), ['---PP---', '--------']);
  assert.deepEqual(toCart(r.frames[4]), ['-----PP-', '--------']);

  // `toGrid` draws cargo in the cell it rides in, so the piles-on-the-floor count is what
  // separates a swallow from a shed. Three go in, the third of them pushes one back out, and
  // the tip hands over one more into the cell that shed left free.
  const loose = st => {
    const g = toGrid(st)[0], c = toCart(st)[0];
    return [...g].filter((ch, i) => ch === 'x' && c[i] === '-').length;
  };
  assert.deepEqual(r.frames.map(loose), [3, 2, 1, 1, 1, 2]);
});

test('frames are opt-in, so the solver never pays for them', () => {
  const s = S(['@--x-#', 'E-----'], ['-PP---', '------']);
  assert.equal(explain(s, 'r').frames, undefined);
  assert.ok(explain(s, 'r', { trace: true }).frames.length > 1);
});

test('a cart is exactly two cells; anything else is a file error', () => {
  assert.throws(() => S(['@--E'], ['-P--']), /covers 1 cell; a cart is exactly two/);
  assert.throws(() => S(['@---E'], ['-PPP-']), /covers 3 cells; a cart is exactly two/);
});

test('the reader refuses a cart on a wall, on the exit, holding furniture, or under him', () => {
  assert.throws(() => S(['@#-E', '----'], ['-PP-', '----']), /both wall and cart/);
  assert.throws(() => S(['@--E', '----'], ['--PP', '----']), /exit cannot hold a cart/);
  assert.throws(() => S(['@FF-E', '-FF--'], ['-PP--', '-----']), /cannot hold furniture/);
  assert.throws(() => S(['@--E'], ['PP--']), /raccoon cannot start in a cart/);
});

test('a can can be shoved INTO a cart, not just run over by one', () => {
  // A cart loads by being rolled into cargo; shoving the cargo into the cart is the same
  // collision from the other side. Refusing it made the piece feel broken rather than rigid.
  const next = act(['@c---E'], ['--PP--'], 'r');
  assert.deepEqual(toGrid(next), ['-@c--E'], 'the can is in the cart cell, he is in the one it left');
  assert.deepEqual(toCart(next), ['--PP--'], 'and the cart has not moved');
  assert.equal(cell(next, 2, 0).cart, cell(next, 3, 0).cart, 'it is riding, not sitting beside it');
});

test('shoving into a full cart shifts the load and pushes one out the far side', () => {
  // A cart is a pipe and it does not matter which end you feed: the same internal push a roll
  // performs, run from the other direction.
  const next = act(['@ccc-E'], ['--PP--'], 'r');
  assert.deepEqual(toGrid(next), ['-@cccE'], 'the load slid along and one came out at cell 4');
  assert.deepEqual(toCart(next), ['--PP--']);
  assert.equal(cell(next, 4, 0).cart, undefined, 'the one pushed out is on the floor, not aboard');
});

test('a full cart with nowhere to put the overflow refuses the shove', () => {
  assert.equal(refused(['@ccc#', '----E'], ['--PP-', '-----'], 'r'), 'canRoom');
});

test('every shovable piece can go in, and what it ejects still cannot', () => {
  for (const g of ['C', 'S', 'b']) {
    // the piece lands in the cart's near slot, its load flies past onto open floor
    // a cart standing broadside, so the piece lands in it and its load flies past onto floor
    const next = act([`@${g}---E`, '------'], ['--P---', '--P---'], 'r');
    assert.equal(cell(next, 2, 0).cart !== undefined, true, `${g} should ride`);
    assert.equal(cell(next, 2, 0).o !== 0, true, `${g} should actually be in the slot`);
  }
  // ...but a load thrown at a cart bounces off it: the bin's trash has only the far slot to
  // land in, and a cart catches what is pushed into it, not what is dropped on it.
  assert.equal(refused(['@b---E'], ['--PP--'], 'r'), 'canRoom');
  // and a piece that is throwing something cannot displace the cart's load as well — both
  // would land in the cell past the cart
  assert.equal(refused(['@bc--E', '------'], ['--P---', '--P---'], 'r'), 'canRoom');
});

test('a jug shoved into a cart still will not pour into one', () => {
  assert.equal(refused(['@j---E'], ['--PP--'], 'r'), 'canRoom');
});

test('a fan still cannot throw trash into a cart', () => {
  assert.equal(refused(['-----', '--$--', '--@--', 'E----'],
                       ['-PP--', '-----', '-----', '-----'], 'u'), 'fan');
});
