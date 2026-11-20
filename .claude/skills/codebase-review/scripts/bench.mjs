#!/usr/bin/env node
// Hot-path timing for src/rules.js: the solver's expansion (explain without trace) over the act
// rooms, walked breadth first to a state cap. Median over reps, after one warm-up pass.
//
//   node bench.mjs <tree root> [reps] [cap]

import { readFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';
import { performance } from 'node:perf_hooks';

const root = resolve(process.argv[2]);
const reps = Number(process.argv[3] ?? 5);
const CAP = Number(process.argv[4] ?? 3000);
const imp = p => import(pathToFileURL(join(root, p)).href);
const { explain, stateKey, DIR_ORDER } = await imp('src/rules.js');
const { toState, parseLevelPack } = await imp('src/format.js');

const starts = readdirSync(join(root, 'levels')).filter(f => /^act\d+\.tt$/.test(f)).sort()
  .flatMap(f => parseLevelPack(readFileSync(join(root, 'levels', f), 'utf8')).levels)
  .map(level => toState(level));

function expand(s0) {
  const states = [s0], seen = new Set([stateKey(s0)]);
  let calls = 0;
  for (let i = 0; i < states.length && states.length < CAP; i++) {
    for (const d of DIR_ORDER) {
      const r = explain(states[i], d);
      calls++;
      if (!r.ok) continue;
      const k = stateKey(r.next);
      if (seen.has(k)) continue;
      seen.add(k);
      states.push(r.next);
      if (states.length >= CAP) break;
    }
  }
  return calls;
}

const pass = () => { let n = 0; for (const s of starts) n += expand(s); return n; };
pass();
const times = [], counts = [];
for (let r = 0; r < reps; r++) {
  const t = performance.now();
  counts.push(pass());
  times.push(performance.now() - t);
}
times.sort((a, b) => a - b);
const median = times[Math.floor(times.length / 2)];
console.log(JSON.stringify({ rooms: starts.length, cap: CAP, reps, explainCalls: counts[0],
  medianMs: Math.round(median), minMs: Math.round(times[0]), maxMs: Math.round(times.at(-1)),
  callsPerSec: Math.round(counts[0] / (median / 1000)) }));
