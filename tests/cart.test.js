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

test('shoved with nowhere to go, a loaded cart sheds out the back', () => {
  // A cart carrying anything is HEAVY: one cell a shove, and no roll to be stopped at the end
  // of. So the shed has one occasion left — a shove it cannot take — and one place to go, which
  // is the cell behind. Never the cell behind the file he is pushing: he is standing in it.
  //
  // That makes a loaded cart end-on in a one-wide corridor a thing you cannot empty by shoving,
  // which is a dead end the room is allowed to have.
  const next = act(['-c#', '@c#', 'E--'], ['-P-', '-P-', '---'], 'r');
  assert.deepEqual(toGrid(next), ['c-#', '@c#', 'E--'], 'the far file put its can down behind it');
  assert.deepEqual(toCart(next), ['-P-', '-P-', '---'], 'and the cart itself has not moved');
  assert.equal(refused(['@cc#', 'E---'], ['-PP-', '----'], 'r'), 'canRoom',
    'end-on there is no file he is not behind, so nothing can come off');
});

test('a heavy cart swallows what it is flush with, and the old load comes out the back', () => {
  // Carrying something makes it heavy, so it takes one cell — but the mouth still works, and
  // taking a new thing in is what pushes the old one out. That is the cart's other way of being
  // emptied, and the only one that needs no wall.
  const next = act(['@ccc--#', 'E------'], ['-PP----', '-------'], 'r');
  assert.deepEqual(toGrid(next), ['@ccc--#', 'E------'], 'one shed behind, two aboard');
  assert.deepEqual(toCart(next), ['--PP---', '-------'], 'one cell on');
});

test('broadside, each file swallows its own and displaces its own', () => {
  // Two files one slot deep, so what each takes in turns out what each was holding. The axis
  // asymmetry, not an exception: the rule is per FILE everywhere it is counted.
  const next = act(['-cc#', '@cc#', 'E---'], ['-P--', '-P--', '----'], 'r');
  assert.deepEqual(toGrid(next), ['-cc#', '@cc#', 'E---'], 'each file set one down and took one up');
  assert.deepEqual(toCart(next), ['--P-', '--P-', '----'], 'and the cart is one cell on');
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

test('an EMPTY cart is light, so it rolls the run and hoovers as it goes', () => {
  // Weight is read once, when the shove begins. That is what keeps the cart a cart: it starts
  // empty, takes the whole run, and is heavy only from the NEXT shove. Read it per cell instead
  // and it would fill on the first thing it passed and stop, which is the barrow's rule.
  const next = act(['@---c-c-#', 'E--------'], ['-PP------', '---------'], 'r');
  assert.deepEqual(toGrid(next), ['-@---cc-#', 'E--------'], 'one aboard, the one before it shed');
  assert.deepEqual(toCart(next), ['------PP-', '---------'], 'and it ran to the wall');
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

test('what stopped it does not change whether it unloads', () => {
  // The wheelie bin never asks what stopped it, and neither does this. A cart that only spilled
  // against walls would make furniture and the exit into silent, unexplained parking spots.
  for (const [what, grid, cart] of [
    ['a wall',  ['-c#', '@c#', 'E--'], ['-P-', '-P-', '---']],
    ['a couch', ['-cF', '@cF', 'E--'], ['-P-', '-P-', '---']],
    ['the exit', ['-cE', '@c-', '---'], ['-P-', '-P-', '---']],
  ]) {
    const next = act(grid, cart, 'r');
    assert.equal(toGrid(next)[0][0], 'c', `${what} should still put one down`);
    assert.equal(toCart(next)[0], '-P-', `${what} should leave the cart where it stands`);
  }
});

test('a cart that cannot roll at all is refused: it vacated nothing to unload into', () => {
  assert.equal(refused(['@cc#', 'E---'], ['-PP-', '----'], 'r'), 'canRoom');
});

test('a cart takes in anything single-cell — bag, can, bin, jug, wheelie, stack, trash', () => {
  for (const g of ['$', 'C', 'c', 'x', 'B', 'b', 'j', 'W', 'w', 'S']) {
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
  // The pile comes off the back of the file he is not behind, and the cell behind that one is
  // open water. The cell stops being canal and becomes a crossing, and the pile is spent.
  const next = act(['-x#', '@x#', 'E--'], ['-P-', '-P-', '---'], 'r', ['~--', '---', '---']);
  assert.deepEqual(toGrid(next)[0], '--#', 'the pile is gone from the occupant grid');
  assert.deepEqual(toWater(next)[0], '=--', 'it became a crossing');
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
  assert.throws(() => S(['@FF-E', '-FF--'], ['-PP--', '-----']), /cannot hold a multi-cell piece/);
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

test('every shovable piece can go in, and rides in whatever state it went in as', () => {
  for (const g of ['C', 'S', 'B', 'j']) {
    const next = act([`@${g}---E`, '------'], ['--P---', '--P---'], 'r');
    assert.equal(cell(next, 2, 0).cart !== undefined, true, `${g} should ride`);
    assert.deepEqual(toGrid(next), [`-@${g}--E`, '------'], `${g} should be aboard unchanged`);
    assert.equal(toWater(next), null, `${g} should not have wet anything`);
  }
});

test('a container shoved into a basket needs no room past the basket', () => {
  // Nothing lands beyond it, so the far slot being cart, wall or occupied is not its business.
  assert.deepEqual(toGrid(act(['@B---E'], ['--PP--'], 'r')), ['-@B--E']);
  assert.deepEqual(toGrid(act(['@j---E'], ['--PP--'], 'r')), ['-@j--E']);
  assert.deepEqual(toGrid(act(['@B--#', '----E'], ['--PP-', '-----'], 'r')), ['-@B-#', '----E']);
});

test('a container displaced out the far side of a basket sheds where it lands', () => {
  const next = act(['@BB--E', '------'], ['--P---', '--P---'], 'r');
  assert.deepEqual(toGrid(next), ['-@BbxE', '------'],
    'the shoved bin rides at cell 2; the one it displaced landed at cell 3 and shed at cell 4');
  assert.equal(cell(next, 2, 0).cart !== undefined, true, 'the new one is riding');
  assert.equal(cell(next, 3, 0).cart, undefined, 'the old one is on the floor');
});

test('a cart sets its load down on the floor, and the landing is where it sheds', () => {
  const next = act(['E-B-@', '-----'], ['---P-', '---P-'], 'l');
  assert.deepEqual(toGrid(next), ['E-bx@', '-----'],
    'the bin went in at cell 2, came back out there, and shed into the cell the cart left');
  assert.equal(cell(next, 2, 0).cart, undefined, 'it is on the floor, not aboard');
});

test('he stops a container emptying onto the square he is standing on', () => {
  // Every container the cart could set down here would shed backwards onto him, so none of
  // them is set down at all — each keeps its slot, and he follows the cart in.
  for (const g of ['j', 'C', 'B', 'S']) {
    const next = act([`-${g}#--`, '--E$-', '-@---', '---##'],
                     ['-----', 'PP---', '-----', '-----'], 'u');
    assert.equal(cell(next, 1, 0).cart !== undefined, true, `${g} should still be aboard`);
    assert.equal(cell(next, 1, 0).o !== 0, true, `${g} should still be in the slot`);
    assert.equal(cell(next, next.rac.x, next.rac.y).o, 0, `${g} should not shed onto him`);
    assert.equal(cell(next, next.rac.x, next.rac.y).water ?? false, false, `${g} should not wet him`);
    assert.deepEqual(next.rac, { x: 1, y: 1 }, `${g}: nothing was set down, so he follows in`);
  }
});

test('a cart will not swallow when the load it would push out has nowhere to shed', () => {
  assert.equal(refused(['E-cB#', '----@'], ['---P-', '---P-'], 'l'), 'canRoom');
});

test('a fan still cannot throw trash into a cart', () => {
  assert.equal(refused(['-----', '--$--', '--@--', 'E----'],
                       ['-PP--', '-----', '-----', '-----'], 'u'), 'fan');
});
