// The landing ledger — which landing questions the engine is ever ASKED, and which it is not.
//
// A board comparison can only judge boards it is given, so a combination nothing stages looks
// exactly like a combination that works. This does not compare anything: it watches the one
// place a landing is decided, records every (site, lane, occupant) actually put to it over a
// corpus, and prints the ones that never came up.
//
// What comes back is a TO-DO LIST, not a failure list. Most of what goes unasked is unaskable —
// a couch cannot be tipped out of a jug — and telling those apart is the reading, which is why
// this reports rather than gates.
//
// Two cuts, because they have different blind spots. The narrow one asks which lanes a site was
// never put to about a thing it does meet; it cannot see a pairing never staged at all. The
// coarse one asks which things never reach a site, and that is where such a pairing shows.
//
//   node tools/landings.mjs            every shipped room, plus a generated batch
//   node tools/landings.mjs --asked    the combinations that DID come up
//   node tools/landings.mjs --rooms N  how many generated rooms to add (default 40)

import { explain, watchLandings, OCCUPANTS, TERRAINS, DIR_ORDER, NONE,
         LANDING_SITES } from '../src/rules.js';
import { toState } from '../src/format.js';
import { reachable, run as matrixRun, LANES } from './matrix.mjs';
import { generatedRooms } from './conform.mjs';
import { actLevels } from './packs.mjs';

// The lanes the forced meetings already know how to stage, named the way they name them, so one
// reader reads one vocabulary and a lane added there is a lane asked about here.
const lanes = Object.keys(LANES);
const LANE_NAME = lanes.slice(0, TERRAINS);

/** Occupant code to the name it is written under, for a report a person has to read. */
const codeName = new Map(Object.entries(OCCUPANTS)
  .filter(([, v]) => typeof v === 'number').map(([k, v]) => [v, k]));

const key = (site, lane, o) => `${site}\t${lane}\t${codeName.get(o) ?? `o${o}`}`;

/** Walk a corpus with the watcher on, and hand back every question it heard. */
function askedOver(rooms, { cap = 200 } = {}) {
  const asked = new Map();
  watchLandings((site, lane, o, taken) => {
    const k = key(site, typeof lane === 'number' ? (LANE_NAME[lane] ?? `ter${lane}`) : lane, o);
    const seen = asked.get(k) ?? { n: 0, took: false };
    seen.n++; seen.took ||= taken !== null;
    asked.set(k, seen);
  });
  try {
    for (const room of rooms) {
      let s0;
      try { s0 = toState(room); } catch { continue; }
      for (const st of reachable(s0, cap)) for (const d of DIR_ORDER) explain(st, d, { trace: true });
    }
    // The forced meetings too: they stage pairings no level author would build, which is exactly
    // where a landing nobody thought of turns up. Drained rather than read — each case explains
    // itself on the way past, and the questions it asks are what this is here for.
    for (const _ of matrixRun()) { /* the questions are the point, not the verdicts */ }
  } finally { watchLandings(null); }
  return asked;
}

/**
 * Every question worth asking, which is NOT the whole cartesian product: a site only ever
 * decides the landing of the things that can reach it, and a cabinet shutting is never asked
 * about a bag. So the plausible set per site is the occupants that site is ever asked about at
 * all — and the gap is one of those on a lane it was never put to.
 *
 * That is the shape the sweep bug had: the broom was asked about trash on dry floor a hundred
 * times and about water never once.
 */
const metAt = asked => {
  const seen = new Map();                       // site -> occupant names ever asked there
  for (const k of asked.keys()) {
    const [site, , name] = k.split('\t');
    seen.set(site, (seen.get(site) ?? new Set()).add(name));
  }
  return seen;
};

function everyQuestion(asked) {
  const out = [];
  for (const [site, names] of metAt(asked))
    for (const lane of lanes) for (const name of names) out.push(`${site}\t${lane}\t${name}`);
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const arg = n => { const i = process.argv.indexOf(n); return i < 0 ? null : process.argv[i + 1]; };
  const n = Number(arg('--rooms') ?? 40);
  const rooms = [...actLevels().map(l => l.level), ...generatedRooms(n, 7).map(g => g.level)];

  const asked = askedOver(rooms);
  // Every site the engine declares, not only the ones a corpus reached — a site nothing stages
  // is the emptiest column there is, and discovering the list from what was asked would leave
  // it out of the report altogether.
  const sites = [...LANDING_SITES].sort();
  const never = sites.filter(site => ![...asked.keys()].some(k => k.startsWith(`${site}\t`)));

  if (process.argv.includes('--asked')) {
    console.log(`${asked.size} combinations asked, over ${rooms.length} rooms\n`);
    for (const [k, v] of [...asked].sort())
      console.log(`  ${k.replace(/\t/g, '  ')}${v.took ? '   TAKEN' : ''}  ×${v.n}`);
    process.exit(0);
  }

  const every = everyQuestion(asked);
  const missing = every.filter(k => !asked.has(k));
  const bySite = new Map();
  for (const k of missing) {
    const [site, lane, name] = k.split('\t');
    const at = bySite.get(site) ?? new Map();
    at.set(lane, [...(at.get(lane) ?? []), name]);
    bySite.set(site, at);
  }

  console.log(`${rooms.length} rooms, ${sites.length} landing sites. ${asked.size} of `
    + `${every.length} plausible combinations asked; ${missing.length} never came up.\n`);
  if (never.length) console.log(`REACHED BY NOTHING — ${never.length} site(s) the corpus never `
    + `even arrived at: ${never.join(', ')}\n`);
  // A lane that takes nothing answers the same for every occupant, so a gap there is a gap in
  // one answer. Water and the grate are the ones where the occupant changes the reply.
  console.log('NEVER ASKED — read as a to-do list, not a failure list:\n');
  for (const site of sites) {
    const at = bySite.get(site);
    if (!at) { console.log(`  ${site}: nothing missing`); continue; }
    console.log(`  ${site}`);
    for (const [lane, names] of [...at].sort())
      console.log(`    ${lane.padEnd(8)} ${names.sort().join(' ')}`);
  }
  const takers = missing.filter(k => /\t(water|grate)\t/.test(k));
  console.log(`\n${takers.length} of the ${missing.length} unasked are on a lane that TAKES `
    + '— those are the ones where a gap can hide a wrong answer rather than a repeated one.');

  // The list above is only as wide as what the corpus staged: it asks which LANES a site was
  // never put to about a thing, and cannot ask about a thing the site never met. So the coarser
  // cut as well — which occupants reach a site at all. This is the cut the sweep bug sat in:
  // nothing in the corpus had ever swept trash anywhere, on any lane.
  const met = metAt(asked);
  const everyName = [...codeName.values()];
  console.log('\nNEVER REACHED AT ALL — the site has never decided the landing of these:\n');
  for (const site of sites) {
    const never = everyName.filter(n => !met.get(site)?.has(n)).sort();
    console.log(`  ${site.padEnd(16)} ${never.length ? never.join(' ') : '(everything reaches it)'}`);
  }
}
