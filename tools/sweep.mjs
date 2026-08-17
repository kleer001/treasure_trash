/**
 * The interaction sweep: what a room can be made to DO, and the shortest way to do all of it.
 *
 * A declared `:solve` is the shortest path to the exit, and the shortest path is under no
 * obligation to touch anything. Room TM teaches that a blow on a cabinet's back opens it and
 * wins in seven moves that walk around the cabinet — so replaying solves proves the exit still
 * opens and says nothing at all about the pieces.
 *
 * So this does not search for a win. It enumerates the MEETINGS a room affords — a piece shoved
 * into another piece, a piece run onto a terrain lane — keeps the ones the room can actually be
 * driven to, and orders them into as few runs as it can. What comes out is a key sequence per
 * run and the list of meetings that run is there to cause. A driver replays it and checks the
 * board against the screen at every beat; what this file promises is that the beats are worth
 * checking.
 *
 * Planning is done against `src/rules.js`, which is the only thing that knows what a shove does.
 * Nothing here decides a rule; it asks, and it asks the same module the game asks.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { explain, cell, isCart, inGrid, DIRS, DIR_ORDER, PUSH, stateKey } from '../src/rules.js';
import { parseLevelPack, toState, toGrid, toWater, toCart } from '../src/format.js';
import { analyze, TooManyStates } from '../src/solver.js';
import { MAX_STATES } from './metrics.mjs';
import { root } from './packs.mjs';

// ---------------------------------------------------------------- naming what is where

/** A cell as one character, in the alphabet the level files are written in. */
function nameAt(look, s, x, y) {
  if (!inGrid(s, x, y)) return '#';
  const c = cell(s, x, y);
  if (c.wall) return '#';
  if (c.exit) return 'E';
  const g = look.g[y][x];
  if (g !== '-') return g;
  // A cart is a mask rather than an occupant, so an empty slot still reads as something met.
  if (isCart(c)) return look.c[y][x];
  return '-';
}

// A room with no hazards writes no `:water` block at all, so the mask is absent rather than
// blank — a lane nothing is standing on is still a lane nothing can be met on.
const look = s => ({ g: toGrid(s), w: toWater(s), c: toCart(s) });
const laneAt = (lk, x, y) => (lk.w ? lk.w[y][x] : '-');

/**
 * The meeting a shove causes: what is being pushed, the first thing standing in its way, and
 * every terrain lane it crosses on the way there.
 *
 * The way is read off the board BEFORE the shove, which is what the raccoon can see too. Where
 * the piece actually stops is the engine's business and the board it returns is what gets
 * checked; this only has to name the meeting well enough to know it has been had.
 */
function meetingOf(s, dir) {
  const [dx, dy] = DIRS[dir];
  const lk = look(s);
  const ax = s.rac.x + dx, ay = s.rac.y + dy;
  const actor = nameAt(lk, s, ax, ay);
  const lanes = new Set();
  let x = ax + dx, y = ay + dy, met = '#';
  while (inGrid(s, x, y)) {
    const here = nameAt(lk, s, x, y);
    const lane = laneAt(lk, x, y);
    if (lane !== '-') lanes.add(lane);
    if (here !== '-') { met = here; break; }
    x += dx; y += dy;
  }
  return { actor, met, lanes: [...lanes].sort() };
}

/** One meeting, as the keys a report counts. A piece against a piece, and a piece on a lane. */
const keysOf = m =>
  [`${m.actor} meets ${m.met}`, ...m.lanes.map(l => `${m.actor} on ${l}`)];

// ---------------------------------------------------------------- what a room affords

/**
 * Every meeting the room can be driven to, and the edge that causes each.
 *
 * `analyze` has already walked the whole reachable graph and kept an edge for every legal action
 * from every board, so the filter that asks whether a meeting is POSSIBLE is a read over that
 * graph rather than a second search.
 */
function affords(a) {
  const byKey = new Map();
  for (const [from, node] of a.states) {
    for (const dir of DIR_ORDER) {
      const r = explain(node.state, dir);
      if (!r.ok || r.kind !== PUSH) continue;      // walking into empty floor meets nothing
      const m = meetingOf(node.state, dir);
      for (const k of keysOf(m)) {
        if (!byKey.has(k)) byKey.set(k, []);
        byKey.get(k).push({ from, dir, to: stateKey(r.next) });
      }
    }
  }
  return byKey;
}

// ---------------------------------------------------------------- routing

/** Shortest walk between two boards, as directions, over the graph `analyze` built. */
function pathBetween(a, fromKey, toKeys) {
  if (toKeys.has(fromKey)) return [];
  const prev = new Map([[fromKey, null]]);
  let frontier = [fromKey];
  while (frontier.length) {
    const next = [];
    for (const k of frontier) {
      for (const e of a.states.get(k).edges) {
        if (prev.has(e.to)) continue;
        prev.set(e.to, { k, dir: e.dir });
        if (toKeys.has(e.to)) {
          const out = [];
          for (let at = e.to; prev.get(at); at = prev.get(at).k) out.unshift(prev.get(at).dir);
          return out;
        }
        next.push(e.to);
      }
    }
    frontier = next;
  }
  return null;
}

/**
 * Greedy: from where the last meeting left the board, walk to the nearest one not yet had and
 * have it. Nearest FIRST is what keeps a run long — chasing a far meeting early strands the
 * near ones behind a board that has moved on.
 *
 * A run ends when nothing uncovered is reachable any more, and the next one starts the room
 * over. Restarting is a real cost to a driver, so it is what the ordering spends last.
 */
function route(a, rootKey, byKey) {
  const want = new Set(byKey.keys());
  const runs = [];
  const stranded = [];
  while (want.size) {
    let at = rootKey, keys = [], covers = [], progressed = false;
    for (;;) {
      // Every board from which some uncovered meeting is one shove away.
      const doors = new Map();
      for (const k of want) for (const e of byKey.get(k)) {
        if (!doors.has(e.from)) doors.set(e.from, []);
        doors.get(e.from).push({ key: k, dir: e.dir, to: e.to });
      }
      if (!doors.size) break;
      const walk = pathBetween(a, at, new Set(doors.keys()));
      if (walk === null) break;
      let here = at;
      for (const d of walk) here = a.states.get(here).edges.find(e => e.dir === d).to;
      // One shove can cause several meetings at once — a piece that crosses tar to reach a can
      // has met both, and the driver should be told to watch for both.
      const opts = doors.get(here);
      const dir = opts[0].dir;
      const had = opts.filter(o => o.dir === dir).map(o => o.key);
      keys.push(...walk, dir);
      covers.push({ after: keys.length, keys: keys.join(''), had });
      for (const k of had) want.delete(k);
      at = opts.find(o => o.dir === dir).to;
      progressed = true;
    }
    if (progressed) runs.push({ keys: keys.join(''), covers });
    else { stranded.push(...want); break; }
  }
  return { runs, stranded };
}

// ---------------------------------------------------------------- per room

export function sweepRoom(level, { maxStates = MAX_STATES } = {}) {
  const s = toState(level);
  let a;
  try { a = analyze(s, { maxStates }); }
  catch (e) {
    if (e instanceof TooManyStates)
      return { id: level.id, name: level.name, tooBig: maxStates, runs: [], affords: 0 };
    throw e;
  }
  const byKey = affords(a);
  const { runs, stranded } = route(a, stateKey(s), byKey);
  return {
    id: level.id, name: level.name,
    reachable: a.reachable,
    affords: byKey.size,
    covered: byKey.size - stranded.length,
    stranded,
    runs,
  };
}

// ---------------------------------------------------------------- cli

const packOf = name => parseLevelPack(readFileSync(resolve(root, 'levels', name), 'utf8')).levels;

if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const write = argv.includes('--write');
  const [pack = 'scratch.tt', ...only] = argv.filter(a => a !== '--write');
  const levels = packOf(pack).filter(l => !only.length || only.includes(l.id));
  const out = [];
  for (const l of levels) {
    const r = sweepRoom(l);
    out.push(r);
    if (r.tooBig) { console.log(`${r.id}  — too big to enumerate (over ${r.tooBig} boards)`); continue; }
    const runs = r.runs.map(x => x.keys.length).join('+') || '0';
    console.log(`${r.id}  ${String(r.covered).padStart(3)}/${String(r.affords).padEnd(3)} meetings`
      + `  ${r.runs.length} run(s), ${runs} keys`
      + (r.stranded.length ? `  UNREACHABLE: ${r.stranded.join(', ')}` : ''));
  }
  const planned = out.filter(r => !r.tooBig);
  console.log(`\n${planned.length}/${out.length} rooms planned, `
    + `${planned.reduce((n, r) => n + r.covered, 0)} meetings, `
    + `${planned.reduce((n, r) => n + r.runs.length, 0)} runs`
    + (out.length - planned.length ? `; ${out.length - planned.length} over the board bound` : ''));
  // Written where the dev server can reach it: the page fetches the plan rather than being handed
  // it, so a sweep of a whole pack is one call and not a wall of pasted keys.
  if (write) {
    const to = resolve(root, 'levels', `sweep-${pack.replace(/\.tt$/, '')}.json`);
    writeFileSync(to, JSON.stringify(planned.map(r => ({ id: r.id, runs: r.runs }))));
    console.log(`wrote ${to}`);
  }
  if (process.env.SWEEP_JSON) console.log(JSON.stringify(out));
}
