import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseLevelPack, toState } from '../src/format.js';
import { analyze, reroot } from '../src/solver.js';
import { canStand } from '../src/rules.js';

// Re-rooting is only worth having if it is indistinguishable from enumerating again, so it is
// checked against the thing it replaces, on the rooms that ship.
const PACKS = ['levels/act1.tt', 'levels/act2.tt'].flatMap(p =>
  parseLevelPack(readFileSync(p, 'utf8')).levels.map(l => [p, l]));

const answer = a => a && [a.minMoves, a.shortestLurd, a.shortestCount, a.reachable,
  a.dead.size, a.traps.length, a.exitRefusals].join('|');

const moveRaccoon = (level, [x, y]) => ({
  ...level,
  grid: level.grid.map((row, j) => [...row].map((ch, i) =>
    (i === x && j === y ? '@' : ch === '@' ? '-' : ch)).join('')),
});

test('re-rooting says exactly what analyzing again says', () => {
  let rerooted = 0, refused = 0;
  for (const [pack, level] of PACKS) {
    const start = toState(level);
    const graph = analyze(start);
    for (let y = 0; y < start.rows; y++) for (let x = 0; x < start.cols; x++) {
      if (!canStand(start, x, y) || start.cells[y][x].exit) continue;
      const moved = toState(moveRaccoon(level, [x, y]));
      const fast = reroot(graph, moved);
      if (fast === null) { refused++; continue; }
      rerooted++;
      // `dead`, `traps` and `exitRefusals` are properties of the graph and must come through
      // untouched; the distances are the part that is allowed to differ, and must be right.
      assert.equal(answer(fast), answer(analyze(moved)), `${pack} ${level.id} @ ${x},${y}`);
    }
  }
  assert.ok(rerooted > 100, `only ${rerooted} starts took the fast path`);
  console.log(`    · ${rerooted} starts re-rooted, ${refused} refused and fell back`);
});

test('re-rooting refuses a start its graph does not hold', () => {
  // Two pens, no way between them. A graph built in one cannot answer for the other.
  const level = { id: 'split', grid: ['-$-#-$-', '-@-#---', '---#--E'] };
  const graph = analyze(toState(level));
  assert.equal(reroot(graph, toState(moveRaccoon(level, [5, 1]))), null);
});
