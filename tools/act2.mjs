#!/usr/bin/env node
// Treasure Trash — assemble Act 2 from the candidate sets.
//
//   node tools/act2.mjs [--in F] [--sets N] [--first ID] [--out DIR] [--dry]
//
// `sets.mjs` finds three-room sets on H outlines; this chooses ten of them and writes the act.
// Ordering is by `onPath` — how much of the solve optimal play can still throw away — because
// trap COUNT does not say whether a player will ever meet one.

import { readFileSync, writeFileSync } from 'node:fs';
import { chooseSets, emit } from './pick.mjs';

const str = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : process.argv[i + 1]; };
const num = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : Number(process.argv[i + 1]); };

const inPath = str('--in', 'levels/sets.jsonl');
const outDir = str('--out', 'levels');
const want = num('--sets', 10);
// 0.8 rather than a half. The fertility map is blunt about the recycle bin being the most
// fertile piece in the roster, and on H outlines it is close to load-bearing: of 56 candidate
// sets only ONE contains no bin at all, and a deliberate bin-free search over 47 bin-free
// fertile mixtures turned up that single set. Holding the cap at half buys a 24-room act; this
// buys thirty and says plainly what it cost.
const maxPieceShare = num('--maxpiece', 0.8);
const first = num('--first', 31);
const dry = process.argv.includes('--dry');

const all = readFileSync(inPath, 'utf8').trim().split('\n').map(JSON.parse);
const { sets, byRamp, byPiece, short } = chooseSets(all, { want, maxPieceShare });

console.log(`${all.length} candidate sets -> ${sets.length} chosen\n`);
if (short) console.log(`  SHORT by ${short} sets — search wider or loosen a constraint\n`);
console.log(`  ramps: ${Object.entries(byRamp).map(([k, v]) => `${k} ${v}`).join(', ')}`);
console.log(`  pieces across all ${sets.length * 3} rooms: `
  + Object.entries(byPiece).sort((a, b) => b[1] - a[1]).map(([p, n]) => `${p}:${n}`).join(' '));

console.log('\nset  ramp      shape                       pars        onPath        traps');
sets.forEach((s, i) => {
  console.log(`${String(i + 1).padStart(3)}  ${s.ramp.padEnd(9)} ${s.shape.padEnd(26)}`
    + ` ${s.rooms.map(r => String(r.par).padStart(2)).join('/')}`
    + `  ${s.rooms.map(r => String(Math.round(r.onPath * 100) + '%').padStart(4)).join(' ')}`
    + `  ${s.rooms.map(r => String(r.traps).padStart(3)).join(' ')}`);
});

// Rooms in running order: set by set, easiest rung first.
const rooms = sets.flatMap(s => s.rooms.map((r, j) => ({ ...r, _set: s, _rung: j })));
const RAMP_SAYS = {
  upgrade: 'the same board as the last one, with one more container full',
  addition: 'the same board as the last one, with one more thing in it',
  par: 'the same shape and the same pieces, arranged harder',
};
const noteFor = (r) => {
  const n = sets.indexOf(r._set) + 1;
  return r._rung === 0
    ? `TODO note — set ${n} of ${sets.length}, ${r._set.shape}, opens the set`
    : `TODO note — set ${n} of ${sets.length}, ${RAMP_SAYS[r._set.ramp]}`;
};

const { tt, sol, md } = emit(rooms, { first, pack: 'Treasure Trash — Act 2 (the H act)', noteFor });
console.log(`\n${rooms.length} rooms, L${first}–L${first + rooms.length - 1}`);
if (dry) { console.log('--dry: nothing written'); process.exit(0); }
writeFileSync(`${outDir}/act2.tt`, tt);
writeFileSync(`${outDir}/act2.sol`, sol);
writeFileSync(`${outDir}/act2.md`, md);
console.log(`-> ${outDir}/act2.tt, ${outDir}/act2.sol, ${outDir}/act2.md`);
console.log('   names and notes are placeholders: they are the part nothing can compute.');
