// What each piece has been declared to be, table by table.
//
// A piece is not one record. Its code is a rule, its glyph is a file format, its drawing is a
// sprite sheet, and what it does when shoved is a rule again — and each of those lives with the
// thing that owns the concern, which is right and is also why adding a piece means touching
// several files. The codes themselves cannot be gathered into one sheet: they are handed out
// and never renumbered, and five predicates read them as contiguous ranges, so a sheet that
// regenerated them would quietly change what a saved board means.
//
// So this gathers the READING rather than the declarations. Three columns must be filled for
// every piece and a specification asserts they are. The rest are optional by design — most
// pieces do not slide and most do not roll — which is exactly why nothing can fail loudly about
// them, and why a piece that was meant to slide and never got its entry looks like a piece that
// was meant not to.
//
//   node tools/pieces.mjs [--missing]

import { OCCUPANTS, NONE, SLIDES, isMultiCell, isRoller } from '../src/rules.js';
import { toState, toGrid, LEGEND, MULTI_POOLS } from '../src/format.js';
import { drawOccupant } from '../src/sprites.js';

const codes = Object.entries(OCCUPANTS)
  .filter(([, v]) => typeof v === 'number' && v !== NONE)
  .map(([name, o]) => ({ name, o }));

const described = new Set(LEGEND.flatMap(l => l.split(' ')[0].split(/[/,]/).filter(Boolean)));

/** The glyph a piece is written as, or null when it borrows one from a pool. */
const glyphOf = o => {
  if (isMultiCell(o)) return null;
  const s = toState({ id: 'w', grid: ['#####', '#-@-#', '#---#', '#--E#', '#####'] });
  s.cells[1][3].o = o;
  try { return toGrid(s)[1][3]; } catch { return undefined; }
};

const draws = o => {
  let hit = 0;
  const sheet = new Proxy({}, { get: () => () => { hit++; } });
  try { drawOccupant(sheet, OCCUPANTS, o, 0, 0); } catch { return false; }
  return hit > 0;
};

export function sheet() {
  return codes.map(({ name, o }) => {
    const g = glyphOf(o);
    const t = SLIDES[o];
    return {
      name, o,
      glyph: isMultiCell(o) ? (MULTI_POOLS.find(m => m.o === o)?.pool.join('') ?? null) : g,
      pooled: isMultiCell(o),
      legend: isMultiCell(o) ? null : described.has(g),
      // A body is drawn once across its whole span by the stage, not per cell by its code,
      // so `drawOccupant` not reaching it is the right answer rather than a missing one.
      drawing: draws(o) ? true : (isMultiCell(o) ? 'span' : false),
      slides: t ? (t.pours ? 'pours' : t.drops !== undefined ? `drops ${t.drops}` : 'yes') : null,
      rolls: isRoller({ o }) || undefined,
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const rows = sheet();
  const mark = v => (v === true ? '✓' : v === false ? '✗' : v === null || v === undefined ? '·' : String(v));
  const owed = r => r.drawing === false || (!r.pooled && (r.legend !== true || !r.glyph));

  if (process.argv.includes('--missing')) {
    const bad = rows.filter(owed);
    console.log(bad.length ? bad.map(r => `${r.name}: ${!r.glyph ? 'no glyph ' : ''}`
      + `${r.legend === false ? 'not in the legend ' : ''}`
      + `${r.drawing === false ? 'no drawing' : ''}`).join('\n')
      : 'every piece has a glyph, a legend line and a drawing.');
    process.exit(bad.length ? 1 : 0);
  }

  console.log(`${'piece'.padEnd(16)}${'code'.padEnd(6)}${'writes'.padEnd(9)}`
    + `${'legend'.padEnd(8)}${'drawn'.padEnd(7)}${'shoved'.padEnd(12)}rolls`);
  console.log('-'.repeat(66));
  for (const r of rows)
    console.log(`${r.name.padEnd(16)}${String(r.o).padEnd(6)}${mark(r.glyph).padEnd(9)}`
      + `${mark(r.legend).padEnd(8)}${mark(r.drawing).padEnd(7)}${mark(r.slides).padEnd(12)}${mark(r.rolls)}`);
  console.log(`\n${rows.length} pieces. The first three columns are owed by every piece and a `
    + 'specification says so; the last two are behaviours most pieces do not have.');
}
