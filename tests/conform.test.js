import { test } from 'node:test';
import assert from 'node:assert/strict';
import { conform, disagreement, generatedRooms } from '../tools/conform.mjs';
import { actLevels } from '../tools/packs.mjs';

const quiet = () => {};
const REF = 'node tools/conform-ref.mjs';
const bent = b => `node tests/fixtures/bent-engine.mjs ${b}`;
// A few rooms is enough to prove the harness works; `node tools/conform.mjs` is the real sweep.
const SOME = actLevels().slice(0, 6);

test('the engine of record conforms to itself through the protocol', async () => {
  const { failures, tally } = await conform(REF, { rooms: SOME, steps: 12, log: quiet });
  assert.deepEqual(failures, []);
  assert.ok(tally.steps > 100, `only ${tally.steps} steps compared`);
  assert.equal(tally.skipped, 0);
});

// The whole value of a harness is that it FAILS. One that cannot is a green light wired to
// nothing, so each bend is a rule a port could plausibly get wrong, and each has to be caught.
test('a bent rule is caught, and named', async () => {
  const { failures } = await conform(bent('refuse-up'), { rooms: SOME, steps: 12, log: quiet });
  assert.ok(failures.length, 'a refusal the engine does not make went unnoticed');
  assert.match(failures[0].bad, /^ok: /);
  assert.ok(failures[0].board, 'a step disagreement has to come with the board it happened on');
});

test('a mislabelled action class is caught', async () => {
  const { failures } = await conform(bent('miscall'), { rooms: SOME, steps: 12, log: quiet });
  assert.ok(failures.length);
  assert.match(failures[0].bad, /kind: tear vs push/);
});

// The case the two grains exist for: every step is right and the room still comes out wrong.
test('a search that disagrees while every step agrees is caught, and told apart', async () => {
  const { failures } = await conform(bent('par-off-by'), { rooms: SOME, steps: 12, log: quiet });
  assert.ok(failures.length);
  assert.match(failures[0].bad, /^par: /);
  assert.equal(failures[0].board, undefined, 'no single board is to blame, and none should be named');
});

test('an unsupported op is a skip, never a pass', () => {
  assert.equal(disagreement({ ok: true, kind: 'push' }, { unsupported: true }), null);
  assert.equal(disagreement({ ok: true, kind: 'push' }, undefined), 'no reply');
  assert.match(disagreement({ par: 3 }, { error: 'boom' }), /^error: boom/);
});

test('the generated corpus is seeded, and reaches past the shipped acts', () => {
  const a = generatedRooms(8, 3), b = generatedRooms(8, 3), c = generatedRooms(8, 4);
  assert.deepEqual(a.map(r => r.level.grid), b.map(r => r.level.grid), 'same seed, same rooms');
  assert.notDeepEqual(a.map(r => r.level.grid), c.map(r => r.level.grid));
  assert.equal(a.length, 8);
});
