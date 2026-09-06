#!/usr/bin/env node
// Where each piece and each terrain lane has got to, pack by pack.
//
// A READING, not a gate. A piece built before its rooms is how this project works — the engine
// grows, the bench packs exercise it by hand, and rooms come when the design settles. Nothing
// here is a fault. What it is for is answering "what is still in the workshop" without anybody
// having to hold it in their head, and noticing when something has been sitting there so long
// that it was finished and nobody moved it on.
//
// `verify.mjs` and the acts are the shipped set; `teach`, `scratch` and `sandbox` are benches.
//
//   node tools/staging.mjs [--shipped|--bench]

import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { OCCUPANTS, NONE, cell, chainOf, isCart, cartKindOf, terrainOf, isGrate } from '../src/rules.js';
import { parseLevelPack, toState } from '../src/format.js';
import { root } from './packs.mjs';

const SHIPPED = /^act\d+\.tt$/;
const LANES = ['dry', 'canal', 'crossing', 'grease', 'tar', 'glass', 'covered'];
const CARTS = ['skateboard', 'barrow up', 'barrow down', 'barrow left', 'barrow right'];

const packs = readdirSync(resolve(root, 'levels')).filter(f => f.endsWith('.tt')).sort();
const seen = new Map();                       // thing -> Set(pack)
const note = (thing, pack) => seen.set(thing, (seen.get(thing) ?? new Set()).add(pack));

for (const f of packs) {
  let levels;
  try { levels = parseLevelPack(readFileSync(resolve(root, 'levels', f), 'utf8')).levels; }
  catch { continue; }
  for (const l of levels) {
    let s; try { s = toState(l); } catch { continue; }
    for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) {
      const c = cell(s, x, y);
      for (const o of chainOf(c)) note(`piece:${o}`, f);
      if (isCart(c)) note(`cart:${cartKindOf(c)}`, f);
      note(`lane:${terrainOf(c)}`, f);
      if (isGrate(c)) note('lane:grate', f);
      if (c.oneway !== undefined) note('lane:one-way', f);
    }
  }
}

const where = key => {
  const at = seen.get(key);
  if (!at) return { stage: 'engine only', packs: '—' };
  const ship = [...at].filter(p => SHIPPED.test(p));
  return { stage: ship.length ? 'SHIPPED' : 'bench', packs: [...at].map(p => p.replace('.tt', '')).join(' ') };
};

const rows = [];
for (const [name, o] of Object.entries(OCCUPANTS)) {
  if (typeof o !== 'number' || o === NONE) continue;
  rows.push({ what: name, ...where(`piece:${o}`) });
}
CARTS.forEach((n, k) => rows.push({ what: n, ...where(`cart:${k}`) }));
LANES.forEach((n, t) => rows.push({ what: n, ...where(`lane:${t}`) }));
for (const n of ['grate', 'one-way']) rows.push({ what: n, ...where(`lane:${n}`) });

const only = process.argv.includes('--shipped') ? 'SHIPPED'
           : process.argv.includes('--bench') ? 'bench' : null;
const show = only ? rows.filter(r => r.stage === only) : rows;

const w = Math.max(...show.map(r => r.what.length), 4);
for (const r of show) console.log(`${r.what.padEnd(w)}  ${r.stage.padEnd(11)}  ${r.packs}`);

const n = s => rows.filter(r => r.stage === s).length;
console.log(`\n${n('SHIPPED')} in the acts · ${n('bench')} on a bench · ${n('engine only')} in the engine and no room at all`);
