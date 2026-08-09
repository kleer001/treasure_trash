#!/usr/bin/env node
// A conformance engine with one rule bent, so the harness can be caught failing to catch it.
//
//   node tests/fixtures/bent-engine.mjs <bend>
//
// It defines no rules — it asks `src/` and then lies about the answer, which is the point: the
// bend is a one-line difference of exactly the kind a port would have, and every other reply is
// right, so the harness has to find it rather than notice the engine is nonsense.
//
//   refuse-up   the first legal `u` on a board with a bag on it comes back refused
//   miscall     a tear is reported as a push, and lands the board it really lands
//   par-off-by  every room's par is one higher; every step of every room agrees
//   walk-off-by every room's `lead` is one higher — par, traps and every step agree, and only
//               the number the level pipeline SITES a room on is wrong
//   silent      nothing bent. The control: the harness must pass this one.

import { TEAR, PUSH } from '../../src/rules.js';
import { reply, serve } from '../../tools/conform-ref.mjs';

const bend = process.argv[2] ?? 'silent';

// The reference's answer, then one thing wrong with it. Bending the reply rather than writing
// an engine is what makes these fair: everything the harness is not being tested on is right.
const BENDS = {
  'refuse-up': (r, req) =>
    (r.ok && req.dir === 'u' && req.grid.some(row => row.includes('$'))
      ? { id: r.id, ok: false, reason: 'wall' } : r),
  miscall: r => (r.kind === TEAR ? { ...r, kind: PUSH } : r),
  'par-off-by': r => (typeof r.par === 'number' ? { ...r, par: r.par + 1 } : r),
  'walk-off-by': r => (typeof r.lead === 'number' ? { ...r, lead: r.lead + 1 } : r),
  silent: r => r,
};

await serve(req => BENDS[bend](reply(req), req));
