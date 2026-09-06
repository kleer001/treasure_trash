#!/usr/bin/env node
// The fast gate. Seconds, not minutes, so it can run first and on every push.
//
// It answers two questions that `verify.mjs` also answers, but answers them cheaply and says
// WHICH ONE failed in one line. That matters: when the rules moved under the level data, the
// full verifier reported twenty-six scattered failures across seven rooms and the common cause
// had to be inferred. This says "the rules moved" once, at the top.
//
//   node tools/gate.mjs

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { explain, isWon } from '../src/rules.js';
import { parseLevelPack, parseLurd, toState } from '../src/format.js';
import { actPacks, root } from './packs.mjs';
import { fingerprint } from './fingerprint.mjs';

let failed = 0;
const fail = (what, detail) => { failed++; console.log(`  ✗ ${what}${detail ? ` — ${detail}` : ''}`); };
const pass = (what, detail) => console.log(`  ✓ ${what}${detail ? ` — ${detail}` : ''}`);

// --- the rules, against the ledger -----------------------------------------------------------
// A rule that changed with nothing recording the decision is the failure this gate exists for.
console.log('\nthe rules are the ones somebody decided on');
const now = fingerprint();
const ledger = readFileSync(resolve(root, 'DECISIONS.md'), 'utf8');
const newest = /^## \d{4}-\d{2}-\d{2} — ([0-9a-f]{16})\s*$/m.exec(ledger);
if (!newest) fail('DECISIONS.md has a newest entry to read', 'no `## <date> — <fingerprint>` heading found');
else if (newest[1] !== now)
  fail('the engine matches the newest decision',
       `engine answers ${now}, the ledger's newest entry is ${newest[1]}\n`
       + `      The rules moved. Re-prove the packs, then record what was decided and by whom\n`
       + `      at the top of DECISIONS.md with the new fingerprint. If you did not mean to\n`
       + `      change a rule, the diff in src/rules.js is not the refactor you thought it was.`);
else pass('the engine matches the newest decision', now);

// --- the level data, against the rules --------------------------------------------------------
// Replay only: no state-graph search, so this is the cheap half of what `verify.mjs` proves. A
// par that is no longer minimal still passes here; a solve that no longer WORKS does not.
console.log('\nevery declared solution still replays to a win');
let rooms = 0, broken = [];
for (const p of actPacks()) {
  for (const l of parseLevelPack(readFileSync(p.levelPath, 'utf8')).levels) {
    if (!l.solve) continue;
    rooms++;
    let s = toState(l), why = null;
    for (const [i, a] of parseLurd(l.solve, l.id).entries()) {
      const r = explain(s, a.dir);
      if (!r.ok) { why = `move ${i + 1} ${a.kind} ${a.dir} refused (${r.reason})`; break; }
      if (r.kind !== a.kind) { why = `move ${i + 1} declared ${a.kind}, board gives ${r.kind}`; break; }
      s = r.next;
    }
    if (!why && !isWon(s)) why = 'replays, but does not end won';
    if (why) broken.push(`${p.name}:${l.id} — ${why}`);
  }
}
if (broken.length) {
  fail(`all ${rooms} declared solutions replay`, `${broken.length} do not`);
  for (const b of broken.slice(0, 8)) console.log(`      ${b}`);
  if (broken.length > 8) console.log(`      … and ${broken.length - 8} more`);
} else pass(`all ${rooms} declared solutions replay`);

console.log(failed ? `\nGATE FAILED — ${failed} check(s)\n` : '\nGATE PASSED\n');
process.exit(failed ? 1 : 0);
