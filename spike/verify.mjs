#!/usr/bin/env node
// Treasure Trash — pack verifier. Every claim a level file makes is checked against
// the rules engine. No claim in levels.md is allowed to be hand-asserted.
//
//   node verify.mjs [levels/act1.tt]
//
// Exits non-zero on the first failing check, so it drops straight into CI.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseLevelPack, formatLevelPack, parseLurd, formatLurd, toState, toGrid,
} from '../src/format.mjs';
import { analyze, replay } from '../src/solver.mjs';
import { isWon, bagsLeft } from '../src/rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
// An explicit path is the caller's, so resolve it where they typed it; the default is
// this script's own neighbour. Without that split, `npm run verify` from the repo root
// would look for spike/spike/levels/.
const levelPath = process.argv[2]
  ? resolve(process.cwd(), process.argv[2])
  : resolve(here, 'levels/act1.tt');

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const section = t => console.log(`\n${t}`);

// ---------------------------------------------------------------- format layer
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

// ---------------------------------------------------------------- per level
for (const level of pack.levels) {
  section(`${level.id} — ${level.name ?? ''}`);
  const start = toState(level);
  const bags = bagsLeft(start);

  // structural laws (the authoring checklist in levels.md, mechanised)
  const exitCell = start.cells.flat().find(c => c.exit);
  check('exit starts empty', exitCell.o === 0);
  check('raccoon does not start on the exit', !start.cells[start.rac.y][start.rac.x].exit);
  check('grid round-trips through the serialiser', toGrid(start).join('\n') === level.grid.join('\n'));

  const a = analyze(start);
  check('solvable', a.minMoves !== null, `${a.reachable} reachable states`);
  check('par is provably minimal', a.minMoves === level.par, `shortest=${a.minMoves} declared=${level.par}`);
  check('declared :solve is a shortest solve', a.shortestLurd !== null && level.solve.length >= 1
    && parseLurd(level.solve).length === a.minMoves, `canonical=${a.shortestLurd}`);

  // the declared solution actually wins, and every action's declared KIND is right
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

  // INVARIANT: no reachable state may ever have an object on the exit. This is the
  // whole point of the rule change — it is not enough that our levels happen to avoid
  // it, the engine must make it impossible. Checked across every reachable state.
  const occupied = [...a.states.values()].find(n =>
    n.state.cells.some(row => row.some(c => c.exit && c.o !== 0)));
  check('the exit is never occupied, in any reachable state', !occupied,
    `${a.reachable} states searched`);

  // Traps that remain are stranding traps: the exit stays clear and reachable-looking,
  // but your trash has walled you off from it. Those need connectivity reasoning, which
  // is what L4 "Corner Yourself" is designed around.
  if (level.traps !== undefined)
    check('trap count as declared', a.traps.length === level.traps,
      `${a.traps.length} stranding trap(s)`);
  else console.log(`    · ${a.traps.length} stranding trap(s)`);

  // GUARD, not a law: a plain move can never lose the room, because moving is reversible
  // (you step onto empty floor; stepping back into the cell you just left is always legal).
  // So this cannot fail under the current ruleset — it is here to fire the day someone adds
  // a mechanic that breaks move-reversibility. An ice floor, where "everyone
  // overshoots", is exactly that mechanic. Keep the guard; don't mistake it for enforcement.
  check('guard: no lethal plain move (vacuous while movement is reversible)',
    a.silentTraps.length === 0,
    a.silentTraps.length ? `e.g. ${a.silentTraps[0].lurd}` : '');

  // Arming is a scaffold for a room that introduces a piece, so a room that arms has to
  // say what it is introducing. If it teaches nothing, the extra press is just friction.
  if (level.arm) check('an arming room declares what it teaches', !!level.teach, level.teach ?? '');
  console.log(`    · arming ${level.arm ? 'ON (introduces a piece)' : 'off'}`);

  // LAW (the exit earns its slot): in any room with a bag, the exit's position must
  // rule out at least one otherwise-legal action. Now that the exit refuses rather than
  // punishes, that's measured directly — how many (state, direction) pairs does the exit
  // itself say no to? Zero means the exit forbids nothing: a walk-back tax, move it.
  if (bags > 0)
    check('the exit forbids at least one action', a.exitRefusals > 0,
      `${a.exitRefusals} refusal(s) caused by the exit`);
}

// ---------------------------------------------------------------- doc drift
// levels.md is prose ABOUT the pack; the pack is the data. The doc is allowed to explain
// a solve, not to disagree with it — so every :solve must appear there verbatim.
section('docs');
const docPath = resolve(here, '../levels.md');
let doc = null;
try { doc = readFileSync(docPath, 'utf8'); } catch { /* doc is optional */ }
// levels.md draws its boards in a second, prose-readable notation, so a hand-transcribed
// diagram could drift from the room it documents. It can't now: both notations are
// generated from the level file here and required to appear verbatim.
//   raw     — the .tt glyphs in a fenced block, as the searched rooms are shown
//   diagram — the doc's coordinate grid, over the PLAYABLE AREA: a room walled all the
//             way round implies its border ring rather than drawing it.
const DOC_GLYPH = { '-': '.', '@': 'R', '$': 'B' };
const ringed = g => g.length > 2 && g[0].length > 2 &&
  [...g[0]].every(c => c === '#') && [...g[g.length - 1]].every(c => c === '#') &&
  g.every(r => r[0] === '#' && r[r.length - 1] === '#');
const playable = g => ringed(g) ? g.slice(1, -1).map(r => r.slice(1, -1)) : g;
const diagramOf = g => playable(g).map((row, i) =>
  `y${i + 1}` + [...row].map(ch => '  ' + (DOC_GLYPH[ch] ?? ch)).join(''));

if (doc === null) console.log('  · ../levels.md not found, skipping');
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
