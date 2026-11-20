// For each room whose golden-master digest changed: walk it with the new engine and ask both
// engines every state and direction, then sort each difference by what changed.
//   node gmdiff.mjs <old tree> <new tree> <old .digests> <new .digests> [cap]
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join, resolve } from 'node:path';
const [oldRoot, newRoot, oldDig, newDig] = process.argv.slice(2).map(p => resolve(p));
const CAP = Number(process.argv[6] ?? 500);
const imp = (root, p) => import(pathToFileURL(join(root, p)).href);
const O = await imp(oldRoot, 'src/rules.js'), N = await imp(newRoot, 'src/rules.js');
const F = await imp(newRoot, 'src/format.js'), M = await imp(newRoot, 'tools/matrix.mjs');

const read = f => new Map(readFileSync(f, 'utf8').trim().split('\n').map(l => { const [h, , ...rest] = l.split(' '); return [rest.filter(w => w !== 'capped').join(' '), h]; }));
const a = read(oldDig), b = read(newDig);
const SAMPLE = Number(process.argv[7] ?? 1e9);
const fam = n => n.startsWith('matrix:') ? 'matrix:' + n.slice(7).split('-')[0] : n.split(':')[0];
const perFam = new Map();
const changed = [...a.keys()].filter(k => b.has(k) && a.get(k) !== b.get(k)).filter(n => { const f = fam(n); perFam.set(f, (perFam.get(f) ?? 0) + 1); return perFam.get(f) <= SAMPLE; }).filter((n, i) => i % Number(process.env.SN ?? 1) === Number(process.env.SK ?? 0));
console.log(`rooms: ${a.size}, changed: ${changed.length}`);

const byName = new Map();
const { readdirSync } = await import('node:fs');
for (const f of readdirSync(join(newRoot, 'levels')).filter(f => f.endsWith('.tt')).sort())
  for (const level of F.parseLevelPack(readFileSync(join(newRoot, 'levels', f), 'utf8')).levels)
    byName.set(`${f}:${level.id}`, () => F.toState(level));
for (const c of M.cases()) byName.set(`matrix:${c.id}`, () => F.toState({ ...c.room, id: c.id }));

const norm = v => v === undefined ? '~u' : v === null || typeof v !== 'object' ? v : Array.isArray(v) ? v.map(norm)
  : Object.fromEntries(Object.keys(v).filter(k => v[k] !== undefined).sort().map(k => [k, norm(v[k])]));
const txt = v => JSON.stringify(norm(v));
const noGrip = s => s && { ...s, cells: s.cells.map(r => r.map(({ grip, ...c }) => c)) };

const kinds = new Map(), examples = new Map();
const note = (kind, ex) => { kinds.set(kind, (kinds.get(kind) ?? 0) + 1); if (!examples.has(kind)) examples.set(kind, ex); };
for (const name of changed) {
  const make = byName.get(name);
  if (!make) { note('room not found', name); continue; }
  const states = [make()], seen = new Set([N.stateKey(states[0])]);
  let found = false;
  for (let i = 0; i < states.length && states.length < CAP; i++) for (const d of N.DIR_ORDER) {
    const ro = O.explain(states[i], d, { trace: true }), rn = N.explain(states[i], d, { trace: true });
    if (txt(ro) !== txt(rn)) {
      found = true;
      let kind;
      if (ro.ok !== rn.ok) kind = 'refused in one engine only';
      else if (!rn.ok) kind = 'refusal differs';
      else if (txt(ro.next) !== txt(rn.next))
        kind = txt(noGrip(ro.next)) === txt(noGrip(rn.next)) ? 'end board differs in holds only' : 'end board differs';
      else if ((ro.frames?.length ?? 0) !== (rn.frames?.length ?? 0)) kind = 'same end board, beat count differs';
      else if (txt(ro.frames?.map(noGrip)) === txt(rn.frames?.map(noGrip)) && txt(ro.steps) === txt(rn.steps)) kind = 'same end board, a beat differs in holds only';
      else kind = 'same end board, beats differ';
      note(kind, `${name} state ${i} dir ${d}`);
      break;
    }
    if (found) break;
    if (!rn.ok) continue;
    const k = N.stateKey(rn.next);
    if (!seen.has(k)) { seen.add(k); states.push(rn.next); }
  }
  if (!found) note('no difference found in this walk', name);
}
for (const [k, n] of kinds) console.log(`${String(n).padStart(7)}  ${k}   e.g. ${examples.get(k)}`);
console.log('rooms by pack:', Object.entries(changed.reduce((m, n) => { const p = n.split(':')[0]; m[p] = (m[p] ?? 0) + 1; return m; }, {})));
