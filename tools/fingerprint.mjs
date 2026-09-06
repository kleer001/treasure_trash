#!/usr/bin/env node
// What the engine ANSWERS, as one short string.
//
// Not a hash of `src/rules.js`. Hashing the source fires on a renamed variable and a reworded
// comment, which trains everyone to re-stamp without looking — and a stamp nobody reads is not a
// gate. This runs a fixed battery of boards through the engine and hashes the answers, so a
// refactor that changes no behaviour prints the same string and a rule that moves prints a
// different one.
//
// The battery is `matrix.mjs`'s staged meetings: every piece forced to meet every terrain lane
// and every other piece. STAGED rather than sampled, because a fingerprint built on a random
// walk sees a rule only when the walk happens to reach it — the first draft of this file used
// generated rooms and could not tell the weight ruleset from its removal.
//
//   node tools/fingerprint.mjs

import { createHash } from 'node:crypto';
import { explain, stateKey, DIR_ORDER } from '../src/rules.js';
import { toState } from '../src/format.js';
import { cases } from './matrix.mjs';

export function fingerprint() {
  const h = createHash('sha256');
  for (const c of cases()) {
    let s;
    try { s = toState({ ...c.room, id: c.id }); } catch { h.update(`${c.id} unbuildable\n`); continue; }
    // Every direction, not only the one the meeting is staged along: a rule that changes what a
    // shove does the other way is still a rule that changed.
    for (const dir of DIR_ORDER) {
      const r = explain(s, dir);
      // Both halves matter: a rule change can turn a legal move into a refusal, and it can also
      // change only which cells are blamed for one.
      h.update(r.ok ? `${c.id} ${dir} ${r.kind} ${stateKey(r.next)}\n`
                    : `${c.id} ${dir} no ${r.reason} ${JSON.stringify(r.blame)}\n`);
    }
  }
  return h.digest('hex').slice(0, 16);
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(fingerprint());
