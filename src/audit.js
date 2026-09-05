// Does the account name everything the board did?
//
// A step's entries are a CLAIM about what changed. This puts the claim to the two boards either
// side of it: every cell that differs must be named by some entry. It is a coverage question and
// only that — an entry can name the right cells and still be wrong about which thing it is about,
// which is what the handle checks in `tools/matrix.mjs` are for.
//
// The lanes come off the cells themselves rather than a list. A list is the cheap way to write
// this and it answers a smaller question every time a lane is added to the board without being
// added to it, which is a check going quiet with nothing to say so.

import { cell } from './rules.js';

const same = (a, b) => {
  if (Array.isArray(a) || Array.isArray(b)) {
    const x = a ?? [], y = b ?? [];
    return x.length === y.length && x.every((v, i) => v === y[i]);
  }
  return a === b;
};

/** Every lane either cell carries — so a cell that gained one is compared on it. */
/**
 * Where two boards differ, and in which lanes — the lanes matter, see `unnamedOver`.
 *
 * Written without allocating for a cell that has not changed, which is nearly all of them: this
 * runs over every board the forced meetings reach, and the higher orders are millions of them.
 */
function changedCells(a, b) {
  const out = [];
  for (let y = 0; y < a.rows; y++) for (let x = 0; x < a.cols; x++) {
    const p = cell(a, x, y), q = cell(b, x, y);
    let lanes = null;
    for (const k in p) if (!same(p[k], q[k])) (lanes ??= []).push(k);
    for (const k in q) if (!(k in p) && !same(p[k], q[k])) (lanes ??= []).push(k);
    if (lanes) out.push({ at: `${x},${y}`, lanes });
  }
  return out;
}

/** Every cell some entry in this step points at, including both ends of a movement's travel. */
function namedCells(step) {
  const at = new Set();
  const add = ([x, y]) => at.add(`${x},${y}`);
  step.gone.forEach(g => g.cells.forEach(add));
  step.spawned.forEach(sp => { sp.cells.forEach(add); if (sp.from) add(sp.from); });
  // Every entry names its whole span, so a couch and a can are read the same way here.
  step.moved.forEach(m => m.cells.forEach(([x, y]) => {
    at.add(`${x},${y}`); at.add(`${x + m.dx},${y + m.dy}`);
  }));
  return at;
}

/** What a step changed and did not mention. Empty is the answer that means nothing is owed. */
export function unnamedCells(before, after, step) {
  const named = namedCells(step);
  return changedCells(before, after).filter(c => !named.has(c.at));
}

/**
 * A lane the account does not carry at all. A hold is written on the board and has no sprite and
 * no entry, so a hook taking hold changes a cell that nothing announces — a known omission rather
 * than a step that forgot, and counted so it cannot quietly become one.
 */
export const UNACCOUNTED = ['grip'];

/**
 * The same question of a whole traced action. The raccoon needs no exemption: where he stands is
 * not a lane of the cell he stands on, so walking changes no board.
 */
export function unnamedOver(r, { silent = UNACCOUNTED } = {}) {
  const bad = [], quiet = [];
  r.steps?.forEach((step, i) => {
    const before = r.frames[i], after = r.frames[i + 1];
    for (const c of unnamedCells(before, after, step)) {
      if (c.lanes.every(k => silent.includes(k))) { quiet.push(`${c.at} ${c.lanes.join(',')}`); continue; }
      bad.push(`step ${i}: cell ${c.at} changed in ${c.lanes.join(',')} and no entry names it`);
    }
  });
  return { bad, quiet };
}

// --- watching a whole pipeline ------------------------------------------------------------
//
// The offline discovery run already traces every board it walks and throws the account away.
// Turning this on makes those boards answer the question above for free. It tallies rather than
// throws: a run measured in CPU-hours should come back with a count, not stop at the first fault.

let tally = null;

/** Start counting. Call with nothing to stop and hand back what was seen. */
export function watchAccounts(on = true, { silent = UNACCOUNTED, keep = 20 } = {}) {
  if (!on) { const was = tally; tally = null; return was; }
  tally = { boards: 0, faults: [], quiet: 0, silent, keep };
  return tally;
}

/** Put one traced action to the audit, if anything is listening. Returns it unchanged. */
export function watched(r) {
  if (!tally || !r?.steps) return r;
  tally.boards++;
  const { bad, quiet } = unnamedOver(r, { silent: tally.silent });
  tally.quiet += quiet.length;
  for (const b of bad) if (tally.faults.length < tally.keep) tally.faults.push(b);
  return r;
}
