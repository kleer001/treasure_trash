import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { run } from '../tools/pool.mjs';

const self = fileURLToPath(new URL('./fixtures/pool-pass.mjs', import.meta.url));
const quiet = () => {};

test('a pass comes back in the order the items went out', async () => {
  const items = Array.from({ length: 7 }, (_, id) => ({ id, do: 'bump' }));
  const out = await run({ self, tool: 'pass', items, workers: 3, onItem: quiet });
  assert.deepEqual(out.map(o => [o.id, o.bumped]), items.map(i => [i.id, true]));
});

test('an item the pass refuses comes through unchanged', async () => {
  const items = [{ id: 0, do: 'bump' }, { id: 1, do: 'refuse' }];
  const out = await run({ self, tool: 'pass', items, workers: 2, onItem: quiet });
  assert.deepEqual(out, [{ id: 0, do: 'bump', bumped: true }, { id: 1, do: 'refuse' }]);
});

test('a pass that throws fails the run', async () => {
  const items = [{ id: 0, do: 'bump' }, { id: 1, do: 'throw' }];
  await assert.rejects(run({ self, tool: 'pass', items, workers: 2, onItem: quiet }),
    /pass failed on 1/);
});
