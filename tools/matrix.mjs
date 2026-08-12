#!/usr/bin/env node
// Treasure Trash — the interaction matrix. Does every piece behave when it MEETS something?
//
//   node tools/matrix.mjs               # run the whole matrix, report what disagrees
//   node tools/matrix.mjs --pack        # also write levels/matrix.tt, playable in the browser
//   node tools/matrix.mjs --list        # what the matrix covers, and what it could not build
//
// A room proves a piece works when the piece is FORCED to meet the thing under test. A room's
// declared `:solve` is its SHORTEST path, and the shortest path usually walks straight past the
// piece — so a pack of one-piece rooms replayed to a win says the exit still opens and nothing
// about the piece. What is left uncovered by that is every pairing: a piece against a terrain
// lane, and a piece against another piece.
//
// WHAT EACH CASE CHECKS, and why it is this and not a board comparison. `tools/conform.mjs`
// already compares boards, and a board is only half of an action: the rules also report what
// MOVED, and the stage animates from that report. A step that lands the right board while
// naming the wrong thing leaves a sprite behind, drops one, or asks for one that does not
// exist — none of which a board comparison can see. So the invariant here is:
//
//   landing an action on the stage the room started from must leave the same sprites as
//   building a stage from the board the action produced.
//
// That is one sentence and it catches the whole class: a body named as an occupant (the stage
// throws), a container that sheds without saying what it becomes (the sprite keeps its old
// kind), a piece consumed by a name that finds nothing (the sprite is never removed).

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  explain, cell, cabinetPair, isCabinetOpen, DRAWER, DIR_ORDER,
} from '../src/rules.js';
import { toState, toGrid, toWater, toCart } from '../src/format.js';
import { analyze } from '../src/solver.js';
import { MAX_STATES } from './metrics.mjs';
import { stageFrom, applyStep, settle, timeline } from '../src/stage.js';
import { root } from './packs.mjs';

// ---------------------------------------------------------------- what there is to meet

/** Every loose piece, by the glyph a grid writes it with. */
export const PIECES = {
  bag: '$', canFull: 'C', canEmpty: 'c', stack: 'S', wheelie: 'W', wheelieEmpty: 'w',
  bin: 'B', binEmpty: 'b', jug: 'j', jugEmpty: 'i',
  sponge: 's', cardboard: 'd', pane: 'g', tyreH: 'o', tyreV: 'O', chair: 'h', broom: 'r',
  cabinetU: 'a', cabinetD: 'e', cabinetL: 'k', cabinetR: 'm',
  magnetU: 'f', magnetD: 'l', magnetL: 'p', magnetR: 'q',
};

/** The multi-cell pieces, written as a run of one letter. */
export const BODIES = { couch: 'F', bicycle: 'Y', rug: 'U' };

/** Every lane the `:water` mask carries. `-` is the control: the same case on bare floor. */
export const LANES = {
  dry: '-', canal: '~', plank: '=', grease: '%', tar: 'T', glass: '*', covered: '_',
  grate: 'O', onewayU: '^', onewayD: 'v', onewayL: '<', onewayR: '>',
};

// ---------------------------------------------------------------- the invariant

/** What identifies a sprite for comparison. Ids and draw seeds are not in it: they are the
 *  stage's own bookkeeping, and a rebuilt stage hands out fresh ones. Where it ENDS UP is,
 *  along with everything the renderer reads to decide what to draw there. */
const shapeOf = sp => JSON.stringify([
  sp.kind, sp.tx, sp.ty, sp.parent ?? null, sp.ref ?? null, sp.o ?? null, sp.ck ?? null,
  sp.cells ?? null,
]);

const census = stage => stage.sprites.map(shapeOf).sort();

/**
 * Land one action on a stage the way the game lands it, and say whether the sprites agree with
 * the board it produced.
 *
 * Returns null when the action is refused — a refusal is a legal answer and moves no sprite.
 */
export function landsWhereTheBoardSays(s, dir) {
  const r = explain(s, dir, { trace: true });
  if (!r.ok) return null;
  const stage = stageFrom(s);
  let threw = null;
  try {
    // The same sequence `landMv` uses when an input cuts an animation short: every step
    // applied in order, each one settled before the next names anything.
    for (const seg of timeline(r, 1))
      for (const it of seg.items) { applyStep(stage, it.step, it.racTo); settle(stage); }
  } catch (e) { threw = e.message; }
  if (threw) return { ok: false, why: `the stage threw: ${threw}`, r };
  const mine = census(stage), theirs = census(stageFrom(r.next));
  if (JSON.stringify(mine) === JSON.stringify(theirs)) return { ok: true, r };
  const extra = mine.filter(k => !theirs.includes(k));
  const missing = theirs.filter(k => !mine.includes(k));
  return {
    ok: false, r,
    why: [extra.length ? `left over: ${extra.join(' ')}` : null,
          missing.length ? `never arrived: ${missing.join(' ')}` : null]
      .filter(Boolean).join('; '),
  };
}

/**
 * A cabinet is a BODY and a DRAWER, and it is one thing: half of one is a board nothing can
 * write down and every branch that reads a cabinet will then read it wrong. Cheap enough to ask
 * of every board a case reaches, which is what makes it a gate rather than a spec about the one
 * piece that happened to separate them.
 */
export function halfCabinets(s) {
  const bad = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) {
    const o = cell(s, x, y).o;
    if ((isCabinetOpen(o) || o === DRAWER) && !cabinetPair(s, [x, y])) bad.push([x, y]);
  }
  return bad;
}

/** Every board a room can reach, bounded — the invariants are asked of all of them. */
export function reachable(s0, cap = 4000) {
  const seen = new Map(), stack = [s0];
  const key = st => JSON.stringify([st.cells.map(r => r.map(c =>
    [c.o, c.pid ?? -1, c.cart ?? -1, c.ck ?? -1, c.lk ?? -1, c.water, c.bridge, c.ter ?? 0])), st.rac]);
  seen.set(key(s0), s0);
  while (stack.length && seen.size < cap) {
    const st = stack.pop();
    for (const d of DIR_ORDER) {
      const r = explain(st, d);
      if (!r.ok) continue;
      const k = key(r.next);
      if (seen.has(k)) continue;
      seen.set(k, r.next);
      stack.push(r.next);
    }
  }
  return [...seen.values()];
}

// ---------------------------------------------------------------- building a forced meeting

// Room shape. The raccoon stands at the left of a corridor with the piece in front of him, so
// one shove drives it into whatever is placed further along. Wide enough that a roller has room
// to travel and a container has room to shed.
const W = 11, H = 5, ROW = 2;

/**
 * A corridor with `left` at x=2 and `right` at x=4, terrain `lane` under x=4, and the raccoon
 * at x=1 facing right. `right` may be null — that is the piece meeting bare lane.
 *
 * Bodies are written as a run of two cells, which is what makes a rug or a bicycle horizontal;
 * `vertical` writes it up the column instead, which is the case where the same piece is
 * broadside to the same shove.
 */
export function corridor({ left, right = null, lane = '-', vertical = false, laneAt = 4 }) {
  const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => '-'));
  const water = Array.from({ length: H }, () => Array.from({ length: W }, () => '-'));
  for (let x = 0; x < W; x++) { grid[0][x] = '#'; grid[H - 1][x] = '#'; }
  for (let y = 0; y < H; y++) { grid[y][0] = '#'; grid[y][W - 1] = '#'; }
  grid[ROW][1] = '@';
  grid[ROW][W - 2] = 'E';

  const put = (glyph, x) => {
    if (glyph === null) return true;
    const body = Object.values(BODIES).includes(glyph);
    if (!body) { grid[ROW][x] = glyph; return true; }
    if (vertical) {
      if (ROW - 1 < 1 || ROW + 1 > H - 2) return false;
      grid[ROW][x] = glyph; grid[ROW - 1][x] = glyph;
    } else {
      if (x + 1 > W - 3) return false;
      grid[ROW][x] = glyph; grid[ROW][x + 1] = glyph;
    }
    return true;
  };
  if (!put(left, 2)) return null;
  if (!put(right, 5)) return null;
  if (lane !== '-') water[ROW][laneAt] = lane;

  const room = { id: 'm', grid: grid.map(r => r.join('')) };
  if (water.some(r => r.some(c => c !== '-'))) room.water = water.map(r => r.join(''));
  return room;
}

/** Every case the matrix runs: a piece meeting a lane, and a piece meeting a piece. */
export function cases() {
  const out = [];
  const all = { ...PIECES, ...BODIES };
  for (const [pn, pg] of Object.entries(all)) {
    for (const [ln, lg] of Object.entries(LANES))
      out.push({ id: `${pn}-on-${ln}`, what: `${pn} shoved onto ${ln}`,
                 room: corridor({ left: pg, lane: lg }) });
    for (const [qn, qg] of Object.entries(all))
      out.push({ id: `${pn}-into-${qn}`, what: `${pn} shoved into ${qn}`,
                 room: corridor({ left: pg, right: qg }) });
    // The same piece broadside: a rug or a bicycle lying across the shove is a different rule
    // from one lying along it, and the two share every other field.
    if (Object.values(BODIES).includes(pg))
      for (const [qn, qg] of Object.entries(all))
        out.push({ id: `${pn}-broadside-into-${qn}`, what: `${pn} lying across, shoved into ${qn}`,
                   room: corridor({ left: pg, right: qg, vertical: true }) });
  }
  return out.filter(c => c.room);
}

// ---------------------------------------------------------------- the run

/** Run every case. A case that will not build a legal board is REPORTED, not skipped quietly. */
export function run(only = null) {
  const rows = [];
  for (const c of cases()) {
    if (only && !c.id.includes(only)) continue;
    let s;
    try { s = toState({ ...c.room, id: c.id }); }
    catch (e) { rows.push({ ...c, verdict: 'unbuildable', why: e.message }); continue; }
    const got = landsWhereTheBoardSays(s, 'r');
    if (got === null) { rows.push({ ...c, verdict: 'refused' }); continue; }
    rows.push({ ...c, verdict: got.ok ? 'ok' : 'DISAGREES', why: got.why, state: s });
  }
  return rows;
}

/**
 * The cases as a playable pack, so any one of them can be poked by hand in the real game:
 * serve the root and open `index.html?acts=matrix.tt`.
 *
 * A room needs a solve to load, and computing it also settles whether the case is playable at
 * all. One that cannot be finished is dropped and COUNTED — a pack that quietly shrank would
 * read as a pack that passed.
 */
export function pack(rows) {
  const out = [':pack   Treasure Trash — the interaction matrix (bench, never shipped)', ''];
  let dropped = 0;
  for (const r of rows) {
    if (r.verdict === 'unbuildable' || !r.state) { dropped++; continue; }
    let a;
    try { a = analyze(r.state, { maxStates: MAX_STATES }); } catch { dropped++; continue; }
    if (a.minMoves === null) { dropped++; continue; }
    out.push(`:level  ${r.id}`, `:name   ${r.what}`,
             `:par    ${a.minMoves}`, `:traps  ${a.traps.length}`,
             `:solves ${a.shortestCount}`, `:solve  ${a.shortestLurd}`,
             ':grid', ...r.room.grid, ':end');
    if (r.room.water) out.push(':water', ...r.room.water, ':end');
    out.push('');
  }
  return { text: out.join('\n') + '\n', dropped };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const only = process.argv.includes('--only') ? process.argv[process.argv.indexOf('--only') + 1] : null;
  const rows = run(only);
  const tally = rows.reduce((a, r) => ({ ...a, [r.verdict]: (a[r.verdict] ?? 0) + 1 }), {});
  if (process.argv.includes('--list'))
    for (const r of rows) console.log(`${r.verdict.padEnd(12)} ${r.id}${r.why ? ' — ' + r.why : ''}`);
  else
    for (const r of rows) if (r.verdict !== 'ok') console.log(`  ${r.verdict} ${r.id} — ${r.why ?? ''}`);
  if (process.argv.includes('--pack')) {
    const at = resolve(root, 'levels', 'matrix.tt');
    const { text, dropped } = pack(rows);
    writeFileSync(at, text);
    console.log(`\nwrote ${at} — ${dropped} case(s) left out as unfinishable`);
  }
  console.log(`\n${rows.length} cases: ` + Object.entries(tally).map(([k, v]) => `${v} ${k}`).join(', '));
  process.exit(rows.some(r => r.verdict === 'DISAGREES') ? 1 : 0);
}
