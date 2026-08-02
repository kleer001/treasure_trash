#!/usr/bin/env node
// Pack verifier: every claim a level file makes, checked against the rules engine.
// `node tools/verify.mjs [levels/act1.tt]`; exits non-zero on the first failure.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseLevelPack, formatLevelPack, parseLurd, formatLurd, toState, toGrid,
} from '../src/format.mjs';
import { analyze, replay } from '../src/solver.mjs';
import { isWon, bagsLeft } from '../src/rules.mjs';

const repo = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const levelPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(repo, 'levels/act1.tt');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const section = t => console.log(`\n${t}`);

section('format');
const levelText = readFileSync(levelPath, 'utf8');
const pack = parseLevelPack(levelText);
check('level pack parses', pack.levels.length > 0, `${pack.levels.length} levels`);
check('level pack round-trips',
  formatLevelPack(parseLevelPack(formatLevelPack(pack))) === formatLevelPack(pack));

for (const l of pack.levels)
  check(`LURD round-trips (${l.id})`, formatLurd(parseLurd(l.solve, l.id)) === l.solve, l.solve);

for (const bad of ['q', 'u!', 'U!!', 'z']) {
  let threw = false;
  try { parseLurd(bad); } catch { threw = true; }
  check(`LURD rejects ${JSON.stringify(bad)}`, threw);
}

for (const level of pack.levels) {
  section(`${level.id} — ${level.name ?? ''}`);
  const start = toState(level);
  const bags = bagsLeft(start);

  const exitCell = start.cells.flat().find(c => c.exit);
  check('exit starts empty', exitCell.o === 0);
  check('raccoon does not start on the exit', !start.cells[start.rac.y][start.rac.x].exit);
  check('grid round-trips through the serialiser', toGrid(start).join('\n') === level.grid.join('\n'));

  const a = analyze(start);
  check('solvable', a.minMoves !== null, `${a.reachable} reachable states`);
  check('par is provably minimal', a.minMoves === level.par, `shortest=${a.minMoves} declared=${level.par}`);
  check('declared :solve is a shortest solve', a.shortestLurd !== null && level.solve.length >= 1
    && parseLurd(level.solve).length === a.minMoves, `canonical=${a.shortestLurd}`);

  let replayed = null;
  try { replayed = replay(start, parseLurd(level.solve, level.id)); } catch (e) {
    check('declared :solve replays', false, e.message);
  }
  if (replayed) {
    check('declared :solve replays to a win', isWon(replayed.final));
    check('declared :solve is exactly par', parseLurd(level.solve).length === level.par);
  }

  if (level.solves !== undefined)
    check('distinct shortest solves as declared', a.shortestCount === level.solves,
      `found ${a.shortestCount}`);
  else console.log(`    · ${a.shortestCount} distinct shortest solve(s)`);

  const occupied = [...a.states.values()].find(n =>
    n.state.cells.some(row => row.some(c => c.exit && c.o !== 0)));
  check('the exit is never occupied, in any reachable state', !occupied,
    `${a.reachable} states searched`);

  if (level.traps !== undefined)
    check('trap count as declared', a.traps.length === level.traps,
      `${a.traps.length} stranding trap(s)`);
  else console.log(`    · ${a.traps.length} stranding trap(s)`);

  check('guard: no lethal plain move (vacuous while movement is reversible)',
    a.silentTraps.length === 0,
    a.silentTraps.length ? `e.g. ${a.silentTraps[0].lurd}` : '');

  if (level.arm) check('an arming room declares what it teaches', !!level.teach, level.teach ?? '');
  console.log(`    · arming ${level.arm ? 'ON (introduces a piece)' : 'off'}`);

  if (bags > 0)
    check('the exit forbids at least one action', a.exitRefusals > 0,
      `${a.exitRefusals} refusal(s) caused by the exit`);
}

section('docs');
const docPath = resolve(repo, 'levels.md');
let doc = null;
try { doc = readFileSync(docPath, 'utf8'); } catch { /* doc is optional */ }

const DOC_GLYPH = { '-': '.', '@': 'R', '$': 'B' };
const ringed = g => g.length > 2 && g[0].length > 2 &&
  [...g[0]].every(c => c === '#') && [...g[g.length - 1]].every(c => c === '#') &&
  g.every(r => r[0] === '#' && r[r.length - 1] === '#');

/** levels.md draws the playable area, implying the border ring of a walled room. */
const playable = g => ringed(g) ? g.slice(1, -1).map(r => r.slice(1, -1)) : g;
const diagramOf = g => playable(g).map((row, i) =>
  `y${i + 1}` + [...row].map(ch => '  ' + (DOC_GLYPH[ch] ?? ch)).join(''));

if (doc === null) console.log('  · levels.md not found, skipping');
else for (const l of pack.levels) {
  check(`levels.md quotes ${l.id}'s solve`, doc.includes(l.solve), `\`${l.solve}\``);
  const grid = toGrid(toState(l));
  const diagram = diagramOf(grid);
  const missing = diagram.find(d => !doc.includes(d));
  check(`levels.md draws ${l.id}'s board`, doc.includes(grid.join('\n')) || !missing,
    missing ? `no line ${JSON.stringify(missing)}` : '');
}

section(failures ? `FAIL — ${failures} check(s)` : 'ALL PASS');
process.exit(failures ? 1 : 0);
