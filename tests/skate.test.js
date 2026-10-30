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

test('the raccoon follows the skateboard in, exactly as he follows a can', () => {
  const next = act(['@---E', '-----'], ['-PP--', '-----'], 'r');
  assert.deepEqual(next.rac, { x: 1, y: 0 });
  assert.deepEqual(toCart(next), ['--PP-', '-----']);
});

test('shoved with nowhere to go, a loaded skateboard sheds out the back', () => {
  const next = act(['-c#', '@c#', 'E--'], ['-P-', '-P-', '---'], 'r');
  assert.deepEqual(toGrid(next), ['c-#', '@c#', 'E--'], 'the far file put its can down behind it');
  assert.deepEqual(toCart(next), ['-P-', '-P-', '---'], 'and the skateboard itself has not moved');
  assert.equal(refused(['@cc#', 'E---'], ['-PP-', '----'], 'r'), 'canRoom',
    'end-on there is no file he is not behind, so nothing can come off');
});

test('a loaded skateboard swallows what it is flush with, and the old load comes out the back', () => {
  const next = act(['@ccc--#', 'E------'], ['-PP----', '-------'], 'r');
  assert.deepEqual(toGrid(next), ['@c-cc-#', 'E------'], 'shed behind as it went, and took up again');
  assert.deepEqual(toCart(next), ['----PP-', '-------'], 'and it ran to the wall, loaded or not');
});

test('broadside, each file swallows its own and displaces its own', () => {
  const next = act(['-cc#', '@cc#', 'E---'], ['-P--', '-P--', '----'], 'r');
  assert.deepEqual(toGrid(next), ['-cc#', '@cc#', 'E---'], 'each file set one down and took one up');
  assert.deepEqual(toCart(next), ['--P-', '--P-', '----'], 'and the skateboard is one cell on');
});

test('broadside swallows one per file, on the single cell the shove is worth', () => {
  const next = act(['@-c-FE', '--c-F-'], ['-P----', '-P----'], 'r');
  assert.deepEqual(toGrid(next), ['-@c-FE', '--c-F-']);
  assert.deepEqual(toCart(next), ['--P---', '--P---']);
});

test('a pile shed mid-roll lands on the cell it was picked up from', () => {
  const next = act(['@--xxx-#', 'E-------'], ['-PP-----', '--------'], 'r');
  assert.deepEqual(toGrid(next), ['-@-xxx-#', 'E-------']);
  assert.deepEqual(toCart(next), ['-----PP-', '--------']);
  assert.equal(trashHeld(next), 1, 'one of the three piles drove off aboard');
});

test('shoved along its deck a skateboard rolls the run and hoovers as it goes', () => {
  const next = act(['@---c-c-#', 'E--------'], ['-PP------', '---------'], 'r');
  assert.deepEqual(toGrid(next), ['-@---cc-#', 'E--------'], 'one aboard, the one before it shed');
  assert.deepEqual(toCart(next), ['------PP-', '---------'], 'and it ran to the wall');
});

test('shoved broadside onto a bag, the skateboard takes it up and stops there', () => {
  const next = act(['###', '---', '-$-', '---', 'E@-'],
                   ['---', '---', '---', '-PP', '---'], 'u');
  assert.deepEqual(toGrid(next), ['###', '---', '-$-', '-@-', 'E--'], 'the bag is aboard, one cell up');
  assert.deepEqual(toCart(next), ['---', '---', '-PP', '---', '---'], 'and the deck moved its one cell');
  assert.equal(bagsLeft(next), 1, 'still unopened');
});

test('what stopped it does not change whether it unloads', () => {
  for (const [what, grid, cart] of [
    ['a wall',  ['-c#', '@c#', 'E--'], ['-P-', '-P-', '---']],
    ['a couch', ['-cF', '@cF', 'E--'], ['-P-', '-P-', '---']],
    ['the exit', ['-cE', '@c-', '---'], ['-P-', '-P-', '---']],
  ]) {
    const next = act(grid, cart, 'r');
    assert.equal(toGrid(next)[0][0], 'c', `${what} should still put one down`);
    assert.equal(toCart(next)[0], '-P-', `${what} should leave the skateboard where it stands`);
  }
});

test('a skateboard that cannot roll at all is refused: it vacated nothing to unload into', () => {
  assert.equal(refused(['@cc#', 'E---'], ['-PP-', '----'], 'r'), 'canRoom');
});

test('a skateboard takes in anything single-cell — bag, can, bin, jug, wheelie, trash', () => {
  for (const g of ['$', 'C', 'c', 'x', 'B', 'b', 'j', 'W', 'w']) {
    const r = explain(S([`@--${g}-F`, '-----F', 'E-----'], ['-PP---', '------', '------']), 'r',
                      { trace: true });
    assert.ok(r.ok, `${g} should load`);
    assert.equal(toCart(r.frames[1])[0], '--PP--', `${g} rides in the lead slot`);
    assert.equal(toGrid(r.frames[1])[0][3], g, `${g} should be aboard mid-roll`);
    assert.deepEqual(toGrid(r.next), [`-@-${g}-F`, '-----F', 'E-----'], `${g} should load`);
    assert.deepEqual(toCart(r.next), ['---PP-', '------', '------'], `${g} should load`);
  }
});

test('trash tipped into the canal fills it, exactly as a fan or a bin drop does', () => {
  const next = act(['-x#', '@x#', 'E--'], ['-P-', '-P-', '---'], 'r', ['~--', '---', '---']);
  assert.deepEqual(toGrid(next)[0], '--#', 'the pile is gone from the occupant grid');
  assert.deepEqual(toWater(next)[0], '=--', 'it became a crossing');
});

test('a skateboard out in the canal is out of reach — he would have to stand in the water', () => {
  for (const cargo of ['-', 'c', '$', 'W', 'w'])
    assert.equal(refused([`@${cargo}--E`, '-----'], ['-PP--', '-----'], 'r', ['-~~--', '-----']),
                 'water', `a skateboard carrying ${cargo}`);
});

test('a fan is refused into a skateboard: loading means rolling into cargo, not catching it', () => {
  assert.equal(refused(['-----', '--$--', '--@--', 'E----'],
                       ['-PP--', '-----', '-----', '-----'], 'u'), 'fan');
});

test('the win is the mess ON THE FLOOR: trash in a skateboard keeps the exit dark', () => {
  const held = S(['+-x-'], ['--PP']);
  assert.equal(bagsLeft(held), 0);
  assert.equal(trashHeld(held), 1);
  assert.equal(isWon(held), false, 'the pile is still in the skateboard');
});

test('junk that was never the mess rides out with him', () => {
  const junk = S(['+-c-'], ['--PP']);
  assert.equal(trashHeld(junk), 0);
  assert.equal(isWon(junk), true, 'an empty can in the skateboard is not unfinished business');
});

test('a bag in a skateboard still counts as a bag, wherever it is riding', () => {
  assert.equal(bagsLeft(S(['@-$-E'], ['--PP-'])), 1);
  assert.equal(bagsLeft(S(['@-W-E'], ['--PP-'])), 1);
});

test('a can riding in a skateboard is not the same board as a can lying on the floor', () => {
  const carted = stateKey(S(['@c--E'], ['-PP--']));
  const loose = stateKey(S(['@c--E']));
  assert.notEqual(carted, loose);
  assert.notEqual(carted.split('|')[0], loose.split('|')[0], 'the occupant lane must differ');
});

test('two skateboards abreast are not the same board as two skateboards end-on', () => {
  const rows = ['----', '----', '@--E'];
  const abreast = stateKey(S(rows, ['PP--', 'QQ--', '----']));
  const endOn = stateKey(S(rows, ['PQ--', 'PQ--', '----']));
  assert.notEqual(abreast, endOn);
});

test('a skateboard stops at another skateboard — it cannot take one aboard', () => {
  assert.equal(refused(['@----E', '------'], ['-PPQQ-', '------'], 'r'), 'canRoom');
});

test('the exit stops a skateboard without tipping it — nothing may rest there', () => {
  const next = act(['@---E', '-----'], ['-PP--', '-----'], 'r');
  assert.deepEqual(toCart(next), ['--PP-', '-----']);
});

test('the skateboard block round-trips, loaded and all', () => {
  const s = S(['@-cx--E', '-------'], ['-PP-QQ-', '-------']);
  assert.deepEqual(toGrid(s), ['@-cx--E', '-------']);
  assert.deepEqual(toCart(s), ['-PP-QQ-', '-------']);
});

test('a traced shove reports every board the roll passes through', () => {
  const s = S(['@--xxx-#', 'E-------'], ['-PP-----', '--------']);
  const r = explain(s, 'r', { trace: true });
  assert.equal(r.frames.length, 6, 'the start, four advances and the tip');
  assert.deepEqual(toGrid(r.frames[0]), toGrid(s), 'frame 0 is the board before the shove');
  assert.deepEqual(toGrid(r.frames.at(-1)), toGrid(r.next), 'the last frame is the result');

  assert.deepEqual(toCart(r.frames[1]), ['--PP----', '--------']);
  assert.deepEqual(toCart(r.frames[2]), ['---PP---', '--------']);
  assert.deepEqual(toCart(r.frames[4]), ['-----PP-', '--------']);

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

test('a skateboard is exactly two cells; anything else is a file error', () => {
  assert.throws(() => S(['@--E'], ['-P--']), /covers 1 cell; a skateboard is exactly two/);
  assert.throws(() => S(['@---E'], ['-PPP-']), /covers 3 cells; a skateboard is exactly two/);
});

test('the reader refuses a skateboard on a wall, on the exit, holding furniture, or under him', () => {
  assert.throws(() => S(['@#-E', '----'], ['-PP-', '----']), /both wall and cart/);
  assert.throws(() => S(['@--E', '----'], ['--PP', '----']), /exit cannot hold a cart/);
  assert.throws(() => S(['@FF-E', '-FF--'], ['-PP--', '-----']), /cannot hold a multi-cell piece/);
  assert.throws(() => S(['@--E'], ['PP--']), /raccoon cannot start in a cart/);
});

test('a can can be shoved INTO a skateboard, not just run over by one', () => {
  const next = act(['@c---E'], ['--PP--'], 'r');
  assert.deepEqual(toGrid(next), ['-@c--E'], 'the can is in the skateboard cell, he is in the one it left');
  assert.deepEqual(toCart(next), ['--PP--'], 'and the skateboard has not moved');
  assert.equal(cell(next, 2, 0).cart, cell(next, 3, 0).cart, 'it is riding, not sitting beside it');
});

test('shoving into a full skateboard shifts the load and pushes one out the far side', () => {
  const next = act(['@ccc-E'], ['--PP--'], 'r');
  assert.deepEqual(toGrid(next), ['-@cccE'], 'the load slid along and one came out at cell 4');
  assert.deepEqual(toCart(next), ['--PP--']);
  assert.equal(cell(next, 4, 0).cart, undefined, 'the one pushed out is on the floor, not aboard');
});

test('a full skateboard with nowhere to put the overflow refuses the shove', () => {
  assert.equal(refused(['@ccc#', '----E'], ['--PP-', '-----'], 'r'), 'canRoom');
});

test('every shovable piece can go in, and rides in whatever state it went in as', () => {
  for (const g of ['C', 'B', 'j']) {
    const next = act([`@${g}---E`, '------'], ['--P---', '--P---'], 'r');
    assert.equal(cell(next, 2, 0).cart !== undefined, true, `${g} should ride`);
    assert.deepEqual(toGrid(next), [`-@${g}--E`, '------'], `${g} should be aboard unchanged`);
    assert.equal(toWater(next), null, `${g} should not have wet anything`);
  }
});

test('a container shoved onto a deck needs no room past the deck', () => {
  assert.deepEqual(toGrid(act(['@B---E'], ['--PP--'], 'r')), ['-@B--E']);
  assert.deepEqual(toGrid(act(['@j---E'], ['--PP--'], 'r')), ['-@j--E']);
  assert.deepEqual(toGrid(act(['@B--#', '----E'], ['--PP-', '-----'], 'r')), ['-@B-#', '----E']);
});

test('a container displaced out the far side of a deck sheds where it lands', () => {
  const next = act(['@BB--E', '------'], ['--P---', '--P---'], 'r');
  assert.deepEqual(toGrid(next), ['-@BbxE', '------'],
    'the shoved bin rides at cell 2; the one it displaced landed at cell 3 and shed at cell 4');
  assert.equal(cell(next, 2, 0).cart !== undefined, true, 'the new one is riding');
  assert.equal(cell(next, 3, 0).cart, undefined, 'the old one is on the floor');
});

test('a skateboard shoved broadside onto a bin takes it up where it stands', () => {
  const next = act(['E-B-@', '-----'], ['---P-', '---P-'], 'l');
  assert.deepEqual(toGrid(next), ['E-B@-', '-----'], 'the bin is aboard where it already stood');
  assert.equal(cell(next, 2, 0).cart, 0, 'and it is on the deck, not on the floor');
});

test('he stops a container emptying onto the square he is standing on', () => {
  for (const g of ['j', 'C', 'B']) {
    const next = act([`-${g}#--`, '--E$-', '-@---', '---##'],
                     ['-----', 'PP---', '-----', '-----'], 'u');
    assert.equal(cell(next, 1, 0).cart !== undefined, true, `${g} should still be aboard`);
    assert.equal(cell(next, 1, 0).o !== 0, true, `${g} should still be in the slot`);
    assert.equal(cell(next, next.rac.x, next.rac.y).o, 0, `${g} should not shed onto him`);
    assert.equal(cell(next, next.rac.x, next.rac.y).water ?? false, false, `${g} should not wet him`);
    assert.deepEqual(next.rac, { x: 1, y: 1 }, `${g}: nothing was set down, so he follows in`);
  }
});

test('a skateboard will not swallow when the load it would push out has nowhere to shed', () => {
  assert.equal(refused(['E-cB#', '----@'], ['---P-', '---P-'], 'l'), 'canRoom');
});

test('a fan still cannot throw trash into a skateboard', () => {
  assert.equal(refused(['-----', '--$--', '--@--', 'E----'],
                       ['-PP--', '-----', '-----', '-----'], 'u'), 'fan');
});

// --- the wheels decide the distance, not the load -------------------------------------------

test('an empty skateboard shoved across its deck goes one cell, not to the wall', () => {
  const next = act(['E----', '@----', '-----'], ['-P---', '-P---', '-----'], 'r');
  assert.deepEqual(toCart(next), ['--P--', '--P--', '-----']);
  assert.deepEqual(next.rac, { x: 1, y: 1 });
});

test('a loaded skateboard shoved along its deck rolls, exactly as an empty one does', () => {
  const empty  = act(['@----', 'E----'], ['-PP--', '-----'], 'r');
  const loaded = act(['@c---', 'E----'], ['-PP--', '-----'], 'r');
  assert.deepEqual(toCart(empty), ['---PP', '-----']);
  assert.deepEqual(toCart(loaded), toCart(empty), 'the load must not shorten the roll');
});

test('the deck answers to its own footprint, so the same shove differs by how it lies', () => {
  const along  = act(['@----', 'E----'], ['-PP--', '-----'], 'r');
  const across = act(['E----', '@----'], ['-P---', '-P---'], 'r');
  assert.deepEqual(toCart(along),  ['---PP', '-----'], 'along the deck it rolls');
  assert.deepEqual(toCart(across), ['--P--', '--P--'], 'across it, one cell');
});
