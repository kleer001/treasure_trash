import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createProgress, stars, STORE_KEY, SLACK } from '../src/progress.js';

/** A Storage-shaped object, which is all the module wants. */
const fakeStore = (seed = {}) => {
  const data = { ...seed };
  return {
    getItem: k => (k in data ? data[k] : null),
    setItem: (k, v) => { data[k] = String(v); },
    raw: () => data,
  };
};

// --- stars -------------------------------------------------------------------
// Par is the provably minimal action count, so three stars is a claim about optimality and
// has to be exact. The middle band is proportional on purpose.

test('three stars means the player matched the proven minimum', () => {
  assert.equal(stars(10, 10), 3);
  assert.equal(stars(11, 10), 2);
});

test('the near-miss band scales with the room, so short rooms are not brutal', () => {
  // +1 on a par-8 room costs a star's worth of slack; the same +1 on a par-38 room does not.
  assert.equal(stars(8, 8), 3);
  assert.equal(stars(10, 8), 2);           // ceil(8 * 1.25) = 10
  assert.equal(stars(11, 8), 1);
  assert.equal(stars(47, 38), 2);          // ceil(38 * 1.25) = 48
  assert.equal(stars(49, 38), 1);
  assert.ok(SLACK > 1, 'the band must be wider than par itself');
});

test('an unfinished room has no stars, and finishing at all earns one', () => {
  assert.equal(stars(null, 12), 0);
  assert.equal(stars(999, 12), 1);
});

// --- recording ---------------------------------------------------------------

test('the best run is kept, never the latest', () => {
  const p = createProgress(fakeStore());
  assert.equal(p.record('L5', 20), true);
  assert.equal(p.best('L5'), 20);
  assert.equal(p.record('L5', 12), true, 'a better run is a new record');
  assert.equal(p.best('L5'), 12);
  assert.equal(p.record('L5', 30), false, 'a worse run is not');
  assert.equal(p.best('L5'), 12, 'and must not take the stars away');
});

test('finishing a room a second time at the same count is not a new record', () => {
  const p = createProgress(fakeStore());
  p.record('L5', 12);
  assert.equal(p.record('L5', 12), false);
});

test('a record survives a new session over the same store', () => {
  const store = fakeStore();
  createProgress(store).record('L9', 17);
  assert.equal(createProgress(store).best('L9'), 17);
});

test('nonsense move counts are refused rather than written', () => {
  const p = createProgress(fakeStore());
  for (const bad of [0, -1, 2.5, NaN, '12', null, undefined]) assert.equal(p.record('L1', bad), false);
  assert.equal(p.done('L1'), false);
});

// --- the storage boundary ----------------------------------------------------
// Storage is outside the program: a player can edit it and an older build can have left
// something else there. A wrecked store must cost progress, never the game.

test('a corrupt store reads as empty rather than throwing', () => {
  for (const junk of ['not json', '[]', 'null', '"a string"', '{"L1":"lots"}', '{"L1":-4}']) {
    const p = createProgress(fakeStore({ [STORE_KEY]: junk }));
    assert.equal(p.done('L1'), false, `${junk} should not survive validation`);
    assert.doesNotThrow(() => p.record('L1', 5));
  }
});

test('a store that refuses to be read or written does not stop play', () => {
  const hostile = {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('full'); },
  };
  const p = createProgress(hostile);
  assert.doesNotThrow(() => p.record('L1', 5));
  assert.equal(p.best('L1'), 5, 'it still knows about this session');
});

test('only the valid entries of a partly-wrecked store are kept', () => {
  const p = createProgress(fakeStore({ [STORE_KEY]: '{"L1":9,"L2":"x","L3":4}' }));
  assert.equal(p.best('L1'), 9);
  assert.equal(p.best('L2'), null);
  assert.equal(p.best('L3'), 4);
});

// --- tallies -----------------------------------------------------------------

const PACK = [{ id: 'L1', par: 10 }, { id: 'L2', par: 10 }, { id: 'L3', par: 10 }];

test('an act tallies what is done and what it was worth', () => {
  const p = createProgress(fakeStore());
  assert.deepEqual(p.tally(PACK), { done: 0, total: 3, earned: 0, possible: 9, complete: false });
  p.record('L1', 10);                       // optimal
  p.record('L2', 12);                       // within the band
  assert.deepEqual(p.tally(PACK), { done: 2, total: 3, earned: 5, possible: 9, complete: false });
  p.record('L3', 40);                       // finished, badly
  assert.equal(p.tally(PACK).complete, true, 'complete counts finishing, not perfection');
  assert.equal(p.tally(PACK).earned, 6);
});

test('an act is complete on finishing every room, however well', () => {
  const p = createProgress(fakeStore());
  for (const l of PACK) p.record(l.id, 999);
  const t = p.tally(PACK);
  assert.equal(t.complete, true);
  assert.equal(t.earned, 3, 'one star each');
});

test('clearing forgets everything, including on disk', () => {
  const store = fakeStore();
  const p = createProgress(store);
  p.record('L1', 5);
  p.clear();
  assert.equal(p.done('L1'), false);
  assert.equal(createProgress(store).done('L1'), false);
});
