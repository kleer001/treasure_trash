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

// Pieces that travel, and everything worth striking with them. A staged meeting puts two things
// side by side, so the shove that follows is DIRECT — which leaves the whole hand-off half of
// the engine unseen: a knock only happens when something rolls a distance first and passes its
// motion on. This battery puts a gap in, so it does.
const ROLLERS = ['o', 'W', 'w', 'h'];
const STRUCK = ['c', 'C', '$', 'x', 'b', 'B', 'w', 'W', 'j', 'i', 's', 'd', 'g', 'o', 'O', 'h',
                'r', 'a', 'e', 'k', 'm', 'f', 'l', 'p', 'q', 'F', 'Y', 'U'];

function* cascades() {
  for (const roll of ROLLERS) {
    for (const hit of STRUCK) {
      yield { id: `cascade ${roll}->${hit}`,
              room: { grid: [`@${roll}--${hit}---#`, 'E-------#'] } };
      // and the same blow arriving at a cart, which is the case that went unseen
      yield { id: `cascade ${roll}->cart`,
              room: { grid: [`@${roll}--${hit}---#`, 'E-------#'],
                      cart: ['------PP#', '--------#'] } };
    }
    // a loaded cart struck, and a cart struck with something beyond it to roll onto
    yield { id: `cascade ${roll}->laden cart`,
            room: { grid: [`@${roll}--c--c-#`, 'E-------#'], cart: ['----PP---', '---------'] } };
  }
}

export function fingerprint() {
  const h = createHash('sha256');
  for (const c of [...cases(), ...cascades()]) {
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
