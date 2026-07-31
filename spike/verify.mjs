#!/usr/bin/env node
// Treasure Trash — pack verifier. Every claim a level file makes is checked against
// the rules engine. No claim in levels.md is allowed to be hand-asserted.
//
//   node verify.mjs [levels/act1.tt] [levels/act1.sol]
//
// Exits non-zero on the first failing check, so it drops straight into CI.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseLevelPack, formatLevelPack, parseSolutionPack, formatSolutionPack,
  parseLurd, formatLurd, toState, toGrid,
} from './format.mjs';
import { analyze, replay } from './solver.mjs';
import { isWon, bagsLeft } from './rules.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const levelPath = resolve(here, process.argv[2] ?? 'levels/act1.tt');
const solPath = resolve(here, process.argv[3] ?? 'levels/act1.sol');

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

const solText = readFileSync(solPath, 'utf8');
const solPack = parseSolutionPack(solText);
check('solution pack round-trips',
  formatSolutionPack(parseSolutionPack(formatSolutionPack(solPack))) === formatSolutionPack(solPack));

for (const l of pack.levels)
  check(`LURD round-trips (${l.id})`, formatLurd(parseLurd(l.solve, l.id)) === l.solve, l.solve);

for (const bad of ['q', 'u!', 'U!!', 'z']) {
  let threw = false;
  try { parseLurd(bad); } catch { threw = true; }
  check(`LURD rejects ${JSON.stringify(bad)}`, threw);
}

// ---------------------------------------------------------------- per level
const byId = new Map(solPack.solutions.map(s => [s.id, s]));

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

  // the .sol file must agree with the level's inline claim
  const sol = byId.get(level.id);
  check('solution file has an entry', !!sol);
  if (sol) check('solution file agrees with :solve', sol.moves === level.solve, `${sol.moves} vs ${level.solve}`);

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
  // a mechanic that breaks move-reversibility. DESIGN-BIBLE's World 3 ice, where "everyone
  // overshoots", is exactly that mechanic. Keep the guard; don't mistake it for enforcement.
  check('guard: no lethal plain move (vacuous while movement is reversible)',
    a.silentTraps.length === 0,
    a.silentTraps.length ? `e.g. ${a.silentTraps[0].lurd}` : '');

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
if (doc === null) console.log('  · ../levels.md not found, skipping');
else for (const l of pack.levels)
  check(`levels.md quotes ${l.id}'s solve`, doc.includes(l.solve), `\`${l.solve}\``);

section(failures ? `FAIL — ${failures} check(s)` : 'ALL PASS');
process.exit(failures ? 1 : 0);
