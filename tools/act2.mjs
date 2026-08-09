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
// 0.9, which puts the recycle bin in 27 of the 30 rooms — and that is a FINDING, not a bill.
//
// The bin tops the fertility map at 86.6 solvable rooms per 1000 placements against 62.0 for the
// next piece, and it earns that: one shove slides it a cell, sheds PERMANENT trash a cell beyond
// it, and leaves an empty bin behind. A body moves, an obstacle lands where the player chose to
// put it, and the piece changes state. Nothing else in the roster does that much at once.
//
// So the cap is a proxy for variety, and a measured one costs more than it buys. A bin-free
// search ten times deeper than the one that built this act returned eight sets and NOT ONE of
// them an upgrade: the upgrade ramp fills a container each rung (`c`→`C`, `w`→`W`, `b`→`B`) and
// the bin is the container that reliably makes a room. Squeezing the bin does not flatten the
// act, it deletes its best device. Piece share is `:traps` all over again — a count standing in
// for an experience — and the act already varies where a player can feel it: ten outlines, three
// ramps, pars 8 to 32.
//
// Kept as a loose backstop rather than removed, because nothing has tested what an unbounded
// pool looks like. Half buys 24 rooms, 0.8 buys 27, 0.9 buys 30.
const maxPieceShare = num('--maxpiece', 0.9);
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
