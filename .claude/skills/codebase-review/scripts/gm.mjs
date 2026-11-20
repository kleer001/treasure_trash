#!/usr/bin/env node
// Golden master for src/rules.js. Run it from outside the tree it measures.
//
//   node gm.mjs <tree root> <dir> [--cap N] [--shard k/N] [--only substr]   walk and record rooms
//   node gm.mjs --merge <dir> <final.jsonl>                                 join rooms in order
//   node gm.mjs <tree root> --dump <room name> <state index> [--cap N]      print one state, all dirs
//
// Rooms: every levels/*.tt pack of the tree, plus the interaction matrix cases from
// tools/matrix.mjs (levels/matrix.tt is gitignored and absent, so the cases are built in memory).
// Each room is walked breadth first through `explain` (the solver's own expansion), capped at N
// states. For every state, in walk order, and every direction, the full `explain(s, d, {trace:true})`
// result is serialised with sorted keys, undefined-valued keys kept as "~u", and hashed.
// A room writes <dir>/rooms/<index>.jsonl: a header line, then one line per state with the state
// hash and the per-direction result hashes. --merge concatenates the rooms in index order, so the
// merged file is the same whatever the shard count. `cmp` two merged files to prove identity.
//
// Everything is imported from <tree root>, so the same file tests the untouched tree and any edit.

import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve, join } from 'node:path';

const args = process.argv.slice(2);
const flag = name => (args.includes(name) ? args[args.indexOf(name) + 1] : null);
const hash = s => createHash('sha256').update(s).digest('hex').slice(0, 20);

if (args[0] === '--merge') {
  const [, dir, finalPath] = args;
  const roomsDir = join(dir, 'rooms');
  const files = readdirSync(roomsDir).filter(f => f.endsWith('.jsonl')).sort();
  const tot = { rooms: 0, states: 0, records: 0, ok: 0, traced: 0, capped: 0 };
  const digests = [];
  writeFileSync(finalPath, '');
  for (const f of files) {
    const body = readFileSync(join(roomsDir, f), 'utf8');
    const head = JSON.parse(body.slice(0, body.indexOf('\n')));
    tot.rooms++; tot.states += head.states; tot.records += head.states * 4;
    tot.ok += head.ok; tot.traced += head.traced; if (head.capped) tot.capped++;
    digests.push(`${hash(body)} ${head.states}${head.capped ? ' capped' : ''} ${head.room}`);
    appendFileSync(finalPath, body);
  }
  writeFileSync(finalPath + '.digests', digests.join('\n') + '\n');
  const line = `rooms ${tot.rooms} states ${tot.states} records ${tot.records} ok ${tot.ok} traced ${tot.traced} capped ${tot.capped}`;
  writeFileSync(finalPath + '.totals', line + '\n');
  console.log(line);
  process.exit(0);
}

const root = resolve(args[0]);
const DUMP = args[1] === '--dump';
const DIR = DUMP ? null : resolve(args[1]);
const CAP = Number(flag('--cap') ?? 2000);
const ONLY = flag('--only');
const SHARD = flag('--shard') ?? '0/1';
const [SHARD_K, SHARD_N] = SHARD.split('/').map(Number);

const imp = p => import(pathToFileURL(join(root, p)).href);
const rules = await imp('src/rules.js');
const format = await imp('src/format.js');
const matrix = await imp('tools/matrix.mjs');
const { explain, stateKey, DIR_ORDER } = rules;
const { toState, parseLevelPack } = format;

const norm = v => {
  if (v === undefined) return '~u';
  if (v === null || typeof v !== 'object') return v;
  if (Array.isArray(v)) return v.map(norm);
  const o = {};
  for (const k of Object.keys(v).sort()) o[k] = norm(v[k]);
  return o;
};
const text = v => JSON.stringify(norm(v));

// The solver's own expansion: first sight of a key keeps the board, and the board is not copied.
function walk(s0, cap) {
  const states = [s0], seen = new Set([stateKey(s0)]);
  for (let i = 0; i < states.length && states.length < cap; i++) {
    for (const d of DIR_ORDER) {
      const r = explain(states[i], d);
      if (!r.ok) continue;
      const k = stateKey(r.next);
      if (seen.has(k)) continue;
      seen.add(k);
      states.push(r.next);
      if (states.length >= cap) break;
    }
  }
  return states;
}

// Rooms as { name, make() -> start state }, in a fixed order. Built lazily.
function rooms() {
  const out = [];
  const packs = readdirSync(join(root, 'levels')).filter(f => f.endsWith('.tt')).sort();
  for (const f of packs) {
    const pack = parseLevelPack(readFileSync(join(root, 'levels', f), 'utf8'));
    for (const level of pack.levels)
      out.push({ name: `${f}:${level.id}`, make: () => toState(level) });
  }
  for (const c of matrix.cases())
    out.push({ name: `matrix:${c.id}`, make: () => toState({ ...c.room, id: c.id }) });
  return out;
}

function resultsAt(states, i) {
  const per = {};
  for (const d of DIR_ORDER) per[d] = explain(states[i], d, { trace: true });
  return per;
}

if (DUMP) {
  const [, , name, idx] = args;
  const room = rooms().find(r => r.name === name);
  if (!room) throw new Error(`no room ${name}`);
  const states = walk(room.make(), CAP);
  const i = Number(idx);
  console.log(JSON.stringify({ state: norm(states[i]) }, null, 1));
  for (const [d, r] of Object.entries(resultsAt(states, i)))
    console.log(`--- ${d}\n${JSON.stringify(norm(r), null, 1)}`);
  process.exit(0);
}

const roomsDir = join(DIR, 'rooms');
mkdirSync(roomsDir, { recursive: true });

const all = rooms();
let done = 0;
const t0 = Date.now();
for (let idx = 0; idx < all.length; idx++) {
  if (idx % SHARD_N !== SHARD_K) continue;
  const room = all[idx];
  if (ONLY && !room.name.includes(ONLY)) continue;
  let s0;
  try { s0 = room.make(); } catch { continue; }
  const states = walk(s0, CAP);
  const stats = { ok: 0, traced: 0 };
  const lines = [];
  for (let i = 0; i < states.length; i++) {
    const per = resultsAt(states, i);
    const cols = DIR_ORDER.map(d => {
      const r = per[d];
      if (r.ok) { stats.ok++; if (r.frames) stats.traced++; }
      const tag = r.ok ? `ok:${r.kind}` : `no:${r.reason}`;
      return `${d}:${tag}:${hash(text(r))}`;
    });
    lines.push(JSON.stringify({ i, st: hash(text(states[i])), r: cols }));
  }
  const head = JSON.stringify({ room: room.name, states: states.length, cap: CAP,
    capped: states.length >= CAP, ok: stats.ok, traced: stats.traced });
  writeFileSync(join(roomsDir, `${String(idx).padStart(6, '0')}.jsonl`),
    [head, ...lines].join('\n') + '\n');
  done++;
}
console.log(`shard ${SHARD}: ${done} rooms in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
