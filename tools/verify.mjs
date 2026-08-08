#!/usr/bin/env node
// Treasure Trash — pack verifier. Every claim a level file makes is checked against the
// rules engine rather than hand-asserted.
//
//   node verify.mjs [levels/act1.tt] [levels/act1.sol]
//
// Exits non-zero on the first failing check, so it drops straight into CI.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import {
  parseLevelPack, formatLevelPack, parseSolutionPack, formatSolutionPack,
  parseLurd, formatLurd, toState, toGrid, toWater, toCart,
} from '../src/format.js';
import { analyze, replay } from '../src/solver.js';
import { isWon, bagsLeft } from '../src/rules.js';
import { deadTravel, isOneRoom, inertPieces, WALK_MAX } from './metrics.mjs';

// Neither end of a solve is free. The walk IN is the room withholding its first decision; the
// walk OUT is worse, because it comes after the last one — the puzzle is over and the player is
// still holding the controller. Both are invisible to every other check: par counts them,
// `:solves` and `:traps` are indifferent to them, and a room can pass everything above and
// still open with a march down a corridor and close with a march to a door in the far corner.
//
// A room whose distance is the point declares it with `:lead`/`:tail`, and the declaration is
// checked exactly — a claim about the room rather than a way out of the bound.

// Levels, and the doc this cross-checks, live at the repo root — one level up.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Every act, unless a pair is named. Discovered rather than listed: an act the verifier does
// not know about is an act nobody is checking, and the pack that adds one would build clean.
const PACKS = process.argv[2]
  ? [[resolve(root, process.argv[2]), resolve(root, process.argv[3] ?? process.argv[2].replace(/\.tt$/, '.sol'))]]
  : readdirSync(resolve(root, 'levels')).filter(f => /^act\d+\.tt$/.test(f)).sort()
      .map(f => [resolve(root, 'levels', f), resolve(root, 'levels', f.replace(/\.tt$/, '.sol'))]);

let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`  ${ok ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures++;
};
const section = t => console.log(`\n${t}`);

for (const [levelPath, solPath] of PACKS) {
  console.log(`\n=== ${levelPath.slice(root.length + 1)} ===`);
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

    // structural checks — see FORMATS.md section 4
    const exitCell = start.cells.flat().find(c => c.exit);
    check('exit starts empty', exitCell.o === 0);
    check('raccoon does not start on the exit', !start.cells[start.rac.y][start.rac.x].exit);
    // One room, not two. Only bare floor is ever walled, so a wall pass cannot wall a piece
    // away — it walls AROUND it, and what is left is a cart in a sealed pocket: drawn, part of
    // the room to look at, and reachable from nowhere in it.
    check('every open cell is in one region', isOneRoom(start));
    check('grid round-trips through the serialiser', toGrid(start).join('\n') === level.grid.join('\n'));
    check('water mask round-trips through the serialiser',
      (toWater(start) ?? []).join('\n') === (level.water ?? []).join('\n'),
      level.water ? `${level.water.length} rows` : 'no water');
    check('cart mask round-trips through the serialiser',
      (toCart(start) ?? []).join('\n') === (level.cart ?? []).join('\n'),
      level.cart ? `${level.cart.length} rows` : 'no carts');

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

    // INVARIANT: no reachable state may have an object on the exit. Checked over the whole
    // graph rather than the solve path, so it tests the engine and not the level design.
    const occupied = [...a.states.values()].find(n =>
      n.state.cells.some(row => row.some(c => c.exit && c.o !== 0)));
    check('the exit is never occupied, in any reachable state', !occupied,
      `${a.reachable} states searched`);

    // Traps that remain are stranding traps: the exit stays clear, but your trash has walled
    // you off from it.
    if (level.traps !== undefined)
      check('trap count as declared', a.traps.length === level.traps,
        `${a.traps.length} stranding trap(s)`);
    else console.log(`    · ${a.traps.length} stranding trap(s)`);

    // Vacuous today: walking writes nothing to the board, so it cannot change liveness and
    // this cannot fail. It is a regression guard — it fires only if some future verb makes a
    // plain step alter the board (a conveyor, a trapdoor), which would be a silent loss.
    check('guard: no lethal plain move (vacuous while walking writes nothing)',
      a.silentTraps.length === 0,
      a.silentTraps.length ? `e.g. ${a.silentTraps[0].lurd}` : '');

    // Every piece hinders, or it is not a piece. The sealed cart and the sealed trash pile that
    // prompted this rule were caught by the region check above, but being unreachable was the
    // least of what was wrong with them — a piece standing in the open, on a route, doing
    // nothing is the same fault without the tell.
    const inert = inertPieces(level, start, a);
    check('every piece is handled or binding', inert.length === 0,
      inert.map(p => `${p.what} at (${p.cells.map(([x, y]) => `${x + 1},${y + 1}`).join(') (')})`).join(', '));

    // Dead travel, at both ends of the best line the player could take.
    const { lead, tail } = deadTravel(a);
    const walk = (what, got, declared, max) => check(
      declared === undefined ? `the ${what} is at most ${max}` : `the declared ${what} is exact`,
      declared === undefined ? got <= max : got === declared,
      `${got}${declared === undefined ? '' : ` declared ${declared}`}`);
    walk('walk to the first piece', lead, level.lead, WALK_MAX.lead);
    walk('walk to the exit', tail, level.tail, WALK_MAX.tail);

    // A room that arms has to say which piece it is introducing.
    if (level.arm) check('an arming room declares what it teaches', !!level.teach, level.teach ?? '');
    console.log(`    · arming ${level.arm ? 'ON (introduces a piece)' : 'off'}`);

    // Counted as (state, direction) pairs the exit itself refuses.
    if (bags > 0)
      check('the exit forbids at least one action', a.exitRefusals > 0,
        `${a.exitRefusals} refusal(s) caused by the exit`);
  }

  // ---------------------------------------------------------------- doc drift
  // levels.md documents the pack; the pack is the data. Every :solve must appear there
  // verbatim, so the doc cannot disagree with the file.
  section('docs');
  const docPath = resolve(root, 'levels.md');
  let doc = null;
  try { doc = readFileSync(docPath, 'utf8'); } catch { /* doc is optional */ }
  if (doc === null) console.log('  · ../levels.md not found, skipping');
  else for (const l of pack.levels) {
    check(`levels.md quotes ${l.id}'s solve`, doc.includes(l.solve), `\`${l.solve}\``);
    // The table quotes the par too, and a solve that changed length without it is a silent
    // drift the solve check alone cannot see.
    const row = doc.split('\n').find(r => r.startsWith(`| ${l.id} |`));
    check(`levels.md quotes ${l.id}'s par`, !!row && row.split('|')[3].trim() === String(l.par),
      row ? `row says ${row.split('|')[3].trim()}, pack says ${l.par}` : 'no table row');
  }

}

// ---------------------------------------------------------------- one engine
// A page that inlines the engine is a second copy of it, and a second copy drifts — every rules
// change has to be hand-spliced into it, and the page silently disagrees with the game the first
// time someone forgets. Pages here are served over http, so they import from `src/` like
// everything else. `artifact.html` is exempt because it is GENERATED by build-artifact.mjs: a
// bundle behind a CSP has to inline, and a generated copy cannot drift because it is rebuilt.
section('one engine');
const GENERATED = new Set(['artifact.html']);
const MARKS = {
  'rules.js': 'function shoveCart(', 'format.js': 'function parseSections(',
  'stage.js': 'function applyStep(', 'sprites.js': 'function createSprites(',
  'rng.js': 'function mulberry32(',
};
for (const f of readdirSync(root).filter(n => n.endsWith('.html') && !GENERATED.has(n))) {
  const html = readFileSync(resolve(root, f), 'utf8');
  const copied = Object.entries(MARKS).filter(([, mark]) => html.includes(mark)).map(([m]) => m);
  check(`${f} imports the engine rather than copying it`, copied.length === 0,
    copied.length ? `inlines ${copied.join(', ')}` : `${Math.round(html.length / 1024)}kB`);
}

section(failures ? `FAIL — ${failures} check(s)` : 'ALL PASS');
process.exit(failures ? 1 : 0);
