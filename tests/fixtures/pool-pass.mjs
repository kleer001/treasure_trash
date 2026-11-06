// A `servePass` worker for `tests/pool.test.js`. An item names what the pass does with it:
// `bump` returns a changed item, `refuse` returns null, and `throw` throws.

import { servePass } from '../../tools/pool.mjs';

servePass(item => {
  if (item.do === 'throw') throw new Error(`pass failed on ${item.id}`);
  if (item.do === 'refuse') return null;
  return { ...item, bumped: true };
});
