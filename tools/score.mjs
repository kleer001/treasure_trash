#!/usr/bin/env node
// Treasure Trash — score and rank harvested rooms.
//
//   node tools/score.mjs [--in F] [--top N] [--par LO-HI] [--show N] [--tt N]
//
// The harvest stores every metric it measured, so this is a query over that file: change the
// weights, re-run, get a new ranking in a second. Nothing here re-solves anything.
//
// WHAT IS SCORED, AND WHY IT IS NOT A PILE OF TRAPS
//
// Sokoban's generators rank on the SHAPE of the solution, not its length. Taylor & Parberry
// (GAMEON-NA 2011) report box lines as the metric that "corresponds fairly well with the
// difficulty of the resulting level" and box changes as one that "may be an even better
// measure", and they warn that push and move counts measure tedium rather than difficulty —
// a solution that shoves one thing down a long corridor scores high on both and plays flat.
//
// This game adds one axis Sokoban does not have. Its mess is permanent, so a room can be lost
// without ending, and the interesting question is not how many ways there are to lose but
// WHERE they sit. A room whose first losing move is twenty steps in punishes a player who has
// already stopped paying attention; a room that can be lost on move one is asking a question.

import { readFileSync } from 'node:fs';
import { toState } from '../src/format.js';
import { analyze } from '../src/solver.js';
import { pathBite } from './metrics.mjs';

/**
 * Re-solve one room to measure the thing the harvest could not store cheaply: how much of the
 * ROAD has a way off it. `biteSteps` counts distinct depths anywhere in the graph, and the
 * graph runs far past par, so it says nothing about the walk the player actually takes.
 *
 * `onPath` is the fraction of the solve's depths at which optimal play can still throw the
 * room away. That is the number L29 got wrong: it shipped with seventeen ways to lose and
 * every one of them off the line a player would walk.
 */
export function refine(room) {
  const s = toState({ id: 'refine', grid: room.grid, ...(room.cart && { cart: room.cart }) });
  return pathBite(analyze(s));
}

// ---------------------------------------------------------------- the terms
// Each returns 0..1. Kept separate from the weights so a reading can be argued with without
// touching the arithmetic.
const clamp01 = v => Math.max(0, Math.min(1, v));

export const TERMS = {
  // Sokoban's best-attested difficulty signal: distinct runs of work on one piece in one
  // direction. Saturates — past about a dozen the room is long rather than hard.
  lines: r => clamp01(r.lines / 12),

  // How often the solution puts one piece down and picks another up. Interleaving is what
  // makes a room a puzzle instead of several puzzles sharing a grid.
  changes: r => clamp01(r.changes / 8),

  // How EARLY the first way to lose appears, as a fraction of the way through the solve.
  // 1 when the room can be lost on move one. This is the term that separates a room which
  // asks a question from one that springs a surprise.
  //
  // Refined, this reads the first depth at which OPTIMAL play can lose. Unrefined it falls
  // back to the earliest trap anywhere in the graph, which flatters a room whose traps all
  // hang off lines a solver would never walk.
  firstBite: r => {
    if (r.firstOnPath !== undefined)
      return r.firstOnPath === null ? 0 : clamp01(1 - r.firstOnPath / Math.max(1, r.par));
    return r.firstTrap === null ? 0 : clamp01(1 - r.firstTrap / Math.max(1, r.par));
  },

  // How much of the ROAD has a way off it. `onPath` is exact and arrives with --refine;
  // `biteSteps` counts distinct depths across the whole graph, which runs well past par, so
  // it is only a stand-in until the room has been re-solved.
  biteSpread: r => (r.onPath !== undefined ? r.onPath : clamp01(r.biteSteps / 12)),

  // How long the room lets you keep playing after it is already lost. This one is SUBTRACTED:
  // a room that stays playable for thirty moves after the mistake cannot teach you what the
  // mistake was.
  blindness: r => clamp01(r.blind / 20),

  // Fewer distinct shortest solutions means a tighter room. Measured against par, since a
  // long solution having two orderings is far less slack than a short one having two.
  tightness: r => clamp01(1 - (r.solves - 1) / Math.max(2, r.par / 4)),

  // Work per move. A room that is mostly walking is padded, however long it is.
  density: r => clamp01(r.pushes / Math.max(1, r.par * 0.45)),
};

export const WEIGHTS = {
  lines: 1.0,
  changes: 1.4,        // the paper's "may be an even better measure"
  firstBite: 1.6,      // this game's own axis, and the one L29 got wrong
  biteSpread: 0.8,
  blindness: -1.2,     // subtracted: see above
  tightness: 0.9,
  density: 0.7,
};

/** A room with no way to lose at all is not a hard room, whatever else it scores. */
export const REQUIRE = r => r.traps >= 1 && r.par >= 12;

export function score(room, weights = WEIGHTS) {
  let total = 0;
  const parts = {};
  for (const [k, f] of Object.entries(TERMS)) {
    parts[k] = f(room);
    total += (weights[k] ?? 0) * parts[k];
  }
  return { total: +total.toFixed(3), parts };
}

/**
 * Rooms that are too alike are one room. Two rooms collide when they draw the same group and
 * land on the same (par, lines, changes) signature — the generator finds near-duplicates in
 * bulk, and twenty of one idea is not an act.
 */
export function dedupe(scored) {
  const seen = new Set(), out = [];
  for (const r of scored) {
    const k = `${r.group}|${r.par}|${r.lines}|${r.changes}`;
    if (seen.has(k)) continue;
    seen.add(k); out.push(r);
  }
  return out;
}

/** A pack wants a curve, not twenty of the best room. Takes the best room in each par band. */
export function ladder(scored, lo, hi, want) {
  const bands = [];
  for (let i = 0; i < want; i++) {
    const a = lo + Math.round((hi - lo) * i / want);
    const b = lo + Math.round((hi - lo) * (i + 1) / want);
    const inBand = scored.filter(r => r.par >= a && r.par <= Math.max(a, b));
    if (inBand.length) bands.push({ band: [a, b], pick: inBand[0] });
    else bands.push({ band: [a, b], pick: null });
  }
  return bands;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const str = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : process.argv[i + 1]; };
  const num = (f, d) => { const i = process.argv.indexOf(f); return i === -1 ? d : Number(process.argv[i + 1]); };
  const inPath = str('--in', 'levels/harvest.jsonl');
  const top = num('--top', 25);
  const show = num('--show', 3);
  const [plo, phi] = str('--par', '12-40').split('-').map(Number);

  const rooms = readFileSync(inPath, 'utf8').trim().split('\n').map(JSON.parse);
  const eligible = rooms.filter(r => REQUIRE(r) && r.par >= plo && r.par <= phi);
  let scored = dedupe(eligible.map(r => ({ ...r, ...score(r) }))
    .sort((a, b) => b.total - a.total));

  // Re-solving is the expensive part, so only the shortlist earns it — then rescore, because
  // the exact on-path number moves rooms around.
  const nRefine = num('--refine', 0);
  if (nRefine) {
    const head = scored.slice(0, nRefine).map(r => ({ ...r, ...refine(r) }));
    scored = [...head.map(r => ({ ...r, ...score(r) })), ...scored.slice(nRefine)]
      .sort((a, b) => b.total - a.total);
    console.log(`refined the top ${nRefine} by re-solving each\n`);
  }

  console.log(`${rooms.length} harvested, ${eligible.length} eligible (traps>=1, par ${plo}-${phi}),`
    + ` ${scored.length} after dedupe\n`);
  console.log('score  group  par lines chg 1stBite onPath blind solves  size');
  for (const r of scored.slice(0, top)) {
    const bite = r.onPath !== undefined ? `${(100 * r.onPath).toFixed(0)}%` : `~${r.biteSteps}`;
    console.log(`${r.total.toFixed(2).padStart(5)}  ${r.group.padEnd(5)} ${String(r.par).padStart(3)}`
      + ` ${String(r.lines).padStart(5)} ${String(r.changes).padStart(3)}`
      + ` ${String(r.firstOnPath ?? r.firstTrap).padStart(7)} ${bite.padStart(6)}`
      + ` ${String(r.blind).padStart(5)} ${String(r.solves).padStart(6)}  ${r.w}x${r.h}`);
  }

  console.log(`\ntop ${show} boards:\n`);
  for (const r of scored.slice(0, show)) {
    console.log(`  ${r.group}  par ${r.par}  lines ${r.lines}  changes ${r.changes}`
      + `  firstTrap ${r.firstTrap}  blind ${r.blind}  score ${r.total}`);
    r.grid.forEach((g, i) => console.log(`    ${g}${r.cart ? '   ' + r.cart[i] : ''}`));
    console.log(`    solve ${r.solve}\n`);
  }

  const want = num('--tt', 0);
  if (want) {
    console.log(`ladder of ${want} across par ${plo}-${phi}:`);
    for (const { band, pick } of ladder(scored, plo, phi, want))
      console.log(`  par ${String(band[0]).padStart(2)}-${String(band[1]).padStart(2)}  `
        + (pick ? `${pick.group} par ${pick.par} score ${pick.total}` : '(nothing in band)'));
  }
}
