#!/usr/bin/env node
/**
 * The crow, headless, on a simulated clock: what he says while rooms are played, and when.
 *
 *   node tools/crowsim.mjs [--acts act1.tt,act2.tt] [--rooms 0-9] [--pace 2000] [--think 3000]
 *                          [--skip none|fast|skip] [--polite] [--seed 1] [--talk chatty] [--all]
 *   node tools/crowsim.mjs --cover [--only <scenario name part>] [--seed 1]
 *
 * RUN plays each room's `:solve` at a human pace and prints the transcript: time, room, event,
 * face and line. `--skip fast` presses once into every line, `--skip skip` twice; `--polite`
 * waits for him to finish before each move; `--all` adds what he heard and let go, and why.
 *
 * COVER lists every crow event, plans a scripted scenario for each, plays them, and reports which
 * events the watcher fired and which lines the director let through. A scenario states what it is
 * there to cause before it runs, so a gap shows as an uncovered event rather than as silence.
 *
 * Seconds pass in a loop, not on a wall clock: an hour of play takes a moment. The crow, the
 * watcher, the rules, the solver and the game loop's bookkeeping (`src/play.js`) are the game's
 * own modules; the session below adds only the clock: how long a shove takes, and when keys land.
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  explain, stateKey, MOVE, TEAR, DIR_ORDER, cell, bagsLeft, exitLit,
} from '../src/rules.js';
import { parseLevelPack, toState, parseLurd } from '../src/format.js';
import { deadScan } from '../src/solver.js';
import { createPlay, tell } from '../src/play.js';
import { createProgress, STORE_KEY } from '../src/progress.js';
import { createCrow, createCrowMemory, TUNING, CROW_KEY } from '../src/crow.js';
import { createWatch, refusal, pieceEvents } from '../src/crowWatch.js';
import { timeline, CELL_MS } from '../src/stage.js';
import { mulberry32 } from '../src/rng.js';
import { root, actPacks } from './packs.mjs';
import { cases } from './matrix.mjs';

const CROW = JSON.parse(readFileSync(resolve(root, 'dialogue/crow.json'), 'utf8'));
export const WIN_MS = 1400;          // the win blast before the next room, as `src/main.js` plays it
const TICK = 50;
const ARM_MS = 150;           // the second tap that commits an aimed tear

// ---------------------------------------------------------------- packs

export function loadPacks(names) {
  const levels = [], acts = [];
  for (const name of names) {
    const pack = parseLevelPack(readFileSync(resolve(root, 'levels', name), 'utf8'));
    acts.push({ label: name, from: levels.length, to: levels.length + pack.levels.length - 1 });
    levels.push(...pack.levels);
  }
  return { levels, acts };
}

/**
 * The interaction matrix's cases as rooms: each is one board, met by a single shove right. Built
 * from `tools/matrix.mjs` rather than read from its pack, which is only as fresh as its last
 * `--pack`. A case that does not build is counted, not hidden.
 */
function matrixPack() {
  const levels = [];
  let unbuildable = 0;
  for (const c of cases()) {
    const L = { ...c.room, id: c.id, name: c.what, par: 1, solve: '' };
    try { toState(L); levels.push(L); } catch { unbuildable++; }
  }
  return { levels, acts: [{ label: 'matrix', from: 0, to: levels.length - 1 }], unbuildable };
}

const scans = new Map();
/** The room's dead boards, as the game's scan finds them; null for a room too big to scan. */
export function deadOf(L) {
  if (!scans.has(L.id)) {
    const it = deadScan(toState(L));
    let r;
    do r = it.next(); while (!r.done);
    scans.set(L.id, r.value);
  }
  return scans.get(L.id);
}

const memStore = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

// ---------------------------------------------------------------- the session

/**
 * One sitting. Every call happens at the session's clock `t`; `wait` is the only thing that moves
 * it, and it ticks the watcher and the director on the way.
 */
export function session({ levels, acts, seed = 1, tuning = TUNING, stores = {}, skip = 'none', scan = true }) {
  stores.progress ??= memStore();
  stores.crow ??= memStore();
  const log = [];
  const progress = createProgress(stores.progress);
  const memory = createCrowMemory(stores.crow);
  const rng = mulberry32(seed);
  let t = 0, animUntil = 0, speaking = false, last = null;
  const presses = [];
  const play = createPlay({ levels, progress });
  const crow = createCrow({ events: CROW, rng, memory, tuning, onLog: r => {
    log.push({ ...r, room: levels[play.cur]?.id });
    if (r.type === 'say' && skip !== 'none') {
      presses.push(r.t + 500);
      if (skip === 'skip') presses.push(r.t + 700);
    }
  } });
  const watch = createWatch({ crow, levels, acts, progress, memory, rng, tuning });

  function wait(ms) {
    const to = t + ms;
    while (t < to) {
      presses.sort((a, b) => a - b);
      const next = presses.length && presses[0] <= to ? presses[0] : Infinity;
      t = Math.min(to, t + TICK, Math.max(t, next));
      if (presses.length && presses[0] <= t) { presses.shift(); if (!speaking) watch.key(t); crow.press(t); }
      // As the game's frame does: a speech is not the player idling.
      speaking ? watch.key(t) : watch.tick(t, play.state);
      speaking = crow.view(t).speech;
    }
  }

  function load(i, again = false) {
    const res = play.load(i, again);
    animUntil = 0;
    if (!again) log.push({ t, type: 'room', room: levels[i].id, name: levels[i].name, par: levels[i].par });
    tell(watch, t, res);
    const dead = scan && deadOf(levels[i]);
    if (dead) watch.scanned(t, k => dead.has(k));
  }

  /** A direction key, as `act()` in the game takes it. */
  function press(dir) {
    while (speaking) wait(TICK);
    const res = last = play.press(dir, t < animUntil);
    if (res.kind === 'handover') { if (play.cur < levels.length - 1) load(play.cur + 1); return { won: true }; }
    if (res.kind === 'moved') animUntil = t + timeline(res.r, CELL_MS).reduce((n, s) => n + s.dur, 0);
    tell(watch, t, res);
    return res.r;
  }

  function act(dir) {
    const r = press(dir);
    if (play.armed !== dir) return r;
    wait(ARM_MS);
    return press(dir);
  }

  return {
    log, crow, watch, progress, stores,
    get t() { return t; }, get state() { return play.state; }, get won() { return play.won; }, get cur() { return play.cur; },
    /** The moves that made the board, and what the last direction key did, as `src/play.js` answers. */
    get path() { return play.path; }, get last() { return last; },
    wait, load, press, act,
    undo() { animUntil = 0; tell(watch, t, play.undo()); },
    restart() { load(play.cur, true); },
    skipKey() { if (!speaking) watch.key(t); crow.press(t); },
    /** Plays LURD actions `pace` apart, each once the last has finished moving, as a player would. */
    play(actions, pace) { for (const a of actions) { wait(Math.max(pace, animUntil - t)); act(a.dir); } },
    step(dir, pace = 400) { wait(Math.max(pace, animUntil - t)); return act(dir); },
    quiet(most = 60000) {
      const until = t + most;
      for (let v = crow.view(t); (v.talking || v.waiting) && t < until; v = crow.view(t)) wait(TICK);
    },
  };
}

// ---------------------------------------------------------------- printing

export const clock = ms => {
  const s = ms / 1000, m = Math.floor(s / 60);
  return `${String(m).padStart(3)}:${(s - m * 60).toFixed(1).padStart(4, '0')}`;
};

function transcript(log, all) {
  const out = [];
  for (const r of log) {
    if (r.type === 'room') out.push(`\n${clock(r.t)}  == ${r.room} ${r.name ?? ''} (par ${r.par}) ==`);
    else if (r.type === 'say') out.push(`${clock(r.t)}  ${r.key.padEnd(24)} [${r.face}]  ${r.beats.map(b => `"${b}"`).join(' / ')}`);
    else if (r.type === 'face') out.push(`${clock(r.t)}  ${r.key.padEnd(24)} [${r.face}]  (face only)`);
    else if (r.type === 'talk') out.push(`${clock(r.t)}  -- talk setting: ${r.talk}`);
    else if (all && r.type === 'drop') out.push(`${clock(r.t)}    · ${r.key} dropped: ${r.why}`);
    else if (all && r.type === 'queue') out.push(`${clock(r.t)}    · ${r.key} waits`);
    else if (all && (r.type === 'skip' || r.type === 'fast')) out.push(`${clock(r.t)}    · ${r.type} ${r.key}`);
  }
  return out.join('\n');
}

function summary(log, total) {
  const said = log.filter(r => r.type === 'say');
  const drops = {};
  for (const r of log) if (r.type === 'drop') drops[r.why] = (drops[r.why] ?? 0) + 1;
  let talking = 0, from = null;
  for (const r of log) {
    if (r.type === 'say') from = r.t;
    if ((r.type === 'end' || r.type === 'skip') && from !== null) { talking += r.t - from; from = null; }
  }
  return [
    `\nPlayed ${clock(total).trim()} of simulated time.`,
    `Lines said: ${said.length} (${said.filter(r => r.beats.length > 1).length} monologues). `
      + `Events fired: ${log.filter(r => r.type === 'fire').length}.`,
    `Dropped by reason: ${Object.entries(drops).map(([k, n]) => `${k} ${n}`).join(', ') || 'none'}.`,
    `He talked for ${(100 * talking / Math.max(1, total)).toFixed(0)}% of the time.`,
  ].join('\n');
}

// ---------------------------------------------------------------- RUN

function run(opt) {
  const { levels, acts } = loadPacks(opt.acts);
  const tuning = { ...TUNING, talkStart: opt.talk ?? TUNING.talkStart };
  const g = session({ levels, acts, seed: opt.seed, tuning, skip: opt.skip });
  const [a, b] = opt.rooms ?? [0, levels.length - 1];
  for (let i = a; i <= b; i++) {
    g.load(i);
    g.wait(opt.think);
    for (const act of parseLurd(levels[i].solve, levels[i].id)) {
      if (opt.polite) g.quiet();
      g.step(act.dir, opt.pace);
    }
    g.wait(WIN_MS);
  }
  g.quiet();
  if (opt.json) { console.log(JSON.stringify(g.log)); return; }
  console.log(transcript(g.log, opt.all));
  console.log(summary(g.log, g.t));
}

// ---------------------------------------------------------------- COVER: finding setups

/** Every board on a room's solution path, with the actions that reach it. */
export function along(L) {
  let s = toState(L);
  // A matrix board has no solution, only its one shove.
  if (!L.solve) {
    const r = explain(s, 'r');
    return r.ok ? [{ s, prefix: [], next: { dir: 'r' } }, { s: r.next, prefix: [{ dir: 'r' }] }] : [{ s, prefix: [] }];
  }
  const acts = parseLurd(L.solve, L.id);
  const out = [{ s, prefix: [], next: acts[0] }];
  acts.forEach((a, k) => { s = explain(s, a.dir).next; out.push({ s, prefix: acts.slice(0, k + 1), next: acts[k + 1] }); });
  return out;
}

/** The first (room, board, direction) in `levels` that `pred` accepts. */
function find(levels, pred) {
  for (let i = 0; i < levels.length; i++) {
    for (const b of along(levels[i])) {
      for (const dir of DIR_ORDER) {
        const r = explain(b.s, dir, { trace: true });
        if (pred({ L: levels[i], s: b.s, dir, r, b })) return { i, prefix: b.prefix, dir, s: b.s, r, b };
      }
    }
  }
  return null;
}

const exitsOf = s => {
  const out = [];
  for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) if (cell(s, x, y).exit) out.push([x, y]);
  return out;
};
export const walkable = (s, dir) => { const r = explain(s, dir); return r.ok && r.kind === MOVE ? r.next : null; };
export const OPP = { u: 'd', d: 'u', l: 'r', r: 'l' };
/** Two opposite plain walks from `s`, as a direction to go and come back. */
export const pacer = s => DIR_ORDER.find(d => { const n = walkable(s, d); return n && walkable(n, OPP[d]); });

/** Plain walks from `s` to a board `goal` accepts, breadth first. */
function walkTo(s, goal) {
  const seen = new Set([stateKey(s)]), q = [[s, []]];
  while (q.length) {
    const [b, path] = q.shift();
    if (goal(b)) return path;
    for (const d of DIR_ORDER) {
      const n = walkable(b, d);
      if (!n || seen.has(stateKey(n))) continue;
      seen.add(stateKey(n)); q.push([n, [...path, { dir: d }]]);
    }
  }
  return null;
}

// ---------------------------------------------------------------- COVER: the plan

const NOT_HERE = {
  'win.underPar': 'par is the proven minimum, so no win comes in under it',
  'story.late': 'fires in Act 5, and these packs stop before it',
  'story.ending': 'fires at the end of Act 6, and these packs stop before it',
  'progress.actDone': 'an act with a story line says that instead, and every act in these packs has one',
};
for (const n of [3, 4, 5, 6]) NOT_HERE[`room.actFirst.act${n}`] = `Act ${n} is not in these packs`;
NOT_HERE['room.actFirst'] = 'every act in these packs has an act-start line of its own';

function plan(opt) {
  const main = loadPacks(actPacks().map(p => p.name));
  const { levels } = main;
  const fast = 400;
  const S = [];
  const add = (name, aims, pack, body, more = {}) => S.push({ name, aims, pack, body, ...more });
  const dead = L => deadOf(L) ?? new Set();
  const isDead = (L, s) => dead(L).has(stateKey(s));

  add('Every room in order, at par', ['room.*', 'meet.*', 'win.*', 'tear.*', 'piece.*', 'progress.*', 'story.*'], main, g => {
    for (let i = 0; i < levels.length; i++) {
      g.load(i); g.wait(3000);
      g.play(parseLurd(levels[i].solve, levels[i].id), 1500);
      g.wait(WIN_MS);
    }
    g.quiet();
  }, { fresh: true });

  add('A second sitting, every room at par', ['room.backAllStars', 'room.replayAtPar'], main, g => {
    g.load(0); g.quiet();
  }, { after: 'Every room in order, at par' });

  add('A second sitting, one room over par', ['room.backDone', 'room.replay'], main, g => {
    g.load(1); g.quiet();
  }, { stores: () => {
    const progress = memStore(), crow = memStore();
    progress.setItem(STORE_KEY, JSON.stringify(Object.fromEntries(levels.map((l, i) => [l.id, i === 1 ? l.par + 5 : l.par]))));
    crow.setItem(CROW_KEY, JSON.stringify({ rooms: Object.fromEntries(levels.map(l => [l.id, 1])) }));
    return { progress, crow };
  } });

  add('Walk away from rooms, skip ahead, come back', ['progress.leftUnsolved', 'progress.loseStreak3',
    'room.skippedAhead', 'room.unsolvedAgain', 'win.cameBack'], main, g => {
    for (const i of [1, 2, 3, 4]) {
      g.load(i); g.quiet();
      g.act(parseLurd(levels[i].solve, levels[i].id)[0].dir); g.wait(2000);
    }
    g.load(1); g.quiet();
    g.play(parseLurd(levels[1].solve, levels[1].id), fast);
    g.quiet();
  });

  const reasons = ['edge', 'wall', 'trash', 'fan', 'canRoom', 'exit', 'water', 'afloat', 'pour', 'glass', 'tar', 'oneway'];
  const matrix = matrixPack();
  const packsFor = [main, loadPacks(['scratch.tt']), matrix];
  for (const why of reasons) {
    let hit = null, pack = null;
    for (const p of packsFor) {
      hit = find(p.levels, ({ s, dir, r }) => !r.ok && refusal(s, { cells: r.blame, reason: r.reason, dir }) === why);
      if (hit) { pack = p; break; }
    }
    if (!hit) { NOT_HERE[`refuse.${why}`] = 'no solution path in the packs passes a board that refuses this way'; continue; }
    add(`Refused: ${why} (${pack.levels[hit.i].id})`, [`refuse.${why}`], pack, g => {
      g.load(hit.i); g.quiet(); g.play(hit.prefix, fast); g.quiet(); g.step(hit.dir); g.quiet();
    });
  }

  const spin = find(levels, ({ s, dir, r }) => !r.ok && DIR_ORDER.some(d => d !== dir && !explain(s, d).ok
    && explain(s, d).reason !== r.reason));
  if (spin) add(`The same refusal over and over, then flailing (${levels[spin.i].id})`, ['refuse.same3', 'refuse.same5',
    'refuse.same8', 'refuse.same12', 'walk.spin', 'refuse.flailing', 'refuse.manyInRoom'], main, g => {
    const other = DIR_ORDER.find(d => d !== spin.dir && !explain(spin.s, d).ok && explain(spin.s, d).reason !== spin.r.reason);
    g.load(spin.i); g.quiet(); g.play(spin.prefix, fast); g.quiet();
    for (let k = 0; k < 12; k++) { g.wait(1500); g.press(spin.dir); }
    g.wait(15000);
    for (let k = 0; k < 4; k++) { g.wait(300); g.press(k % 2 ? spin.dir : other); }
    g.quiet();
  });

  const shove = find(levels, ({ r, s }) => r.ok && r.kind !== MOVE && DIR_ORDER.some(d => {
    const n = explain(r.next, d); return !n.ok || n.kind !== MOVE;
  }));
  add(`A press while a shove still plays (${levels[shove.i].id})`, ['refuse.busy'], main, g => {
    g.load(shove.i); g.quiet(); g.play(shove.prefix, fast); g.step(shove.dir);
    g.wait(10);
    g.press(DIR_ORDER.find(d => { const n = explain(g.state, d); return !n.ok || n.kind !== MOVE; }));
    g.quiet();
  });

  // Losing the board, and everything that hangs off a lost board.
  const lose = find(levels, ({ L, s, r }) => r.ok && r.kind !== MOVE && !isDead(L, s) && isDead(L, r.next) && pacer(r.next));
  if (lose) add(`Lose the board, then all the ways out (${levels[lose.i].id})`, ['lost.firstEver', 'lost',
    'undo.losingMove', 'undo.redoSame', 'lost.step1', 'lost.step2', 'lost.step3', 'lost.step4', 'walk.pacing',
    'walk.long', 'lost.idle', 'undo.notFarEnough', 'lost.undoneOut', 'lost.yoda', 'restart.fromLost', 'win.afterLost',
    'win.nemesis'], main, g => {
    const L = levels[lose.i];
    g.load(lose.i); g.quiet(); g.play(lose.prefix, fast); g.quiet();
    g.step(lose.dir); g.quiet();
    g.undo(); g.quiet();
    g.act(lose.dir); g.quiet();
    const d = pacer(g.state);
    for (let k = 0; k < 14; k++) { g.wait(900); g.press(k % 2 ? OPP[d] : d); }
    g.quiet(); g.wait(TUNING.lostIdleMs + 500); g.quiet();
    g.undo(); g.wait(TUNING.undoSettleMs + 200); g.quiet();
    while (isDead(L, g.state)) g.undo();
    g.quiet();
    for (let k = 0; k < TUNING.yodaLost - 1; k++) {
      g.restart(); g.play(lose.prefix, fast); g.step(lose.dir); g.wait(fast); g.undo();
    }
    g.act(lose.dir); g.wait(TUNING.lostIdleMs + 500); g.quiet();
    g.restart(); g.quiet();
    g.play(lose.prefix, fast); g.step(lose.dir); g.wait(fast); g.undo();
    g.play(parseLurd(L.solve, L.id).slice(lose.prefix.length), fast);
    g.quiet();
  });
  else NOT_HERE['lost'] = 'no solution path passes a shove that loses the board';

  const byWalk = find([...levels, ...loadPacks(['scratch.tt']).levels], ({ L, s, r }) => r.ok && r.kind === MOVE && !isDead(L, s) && isDead(L, r.next));
  if (byWalk) {
    const pack = byWalk.i < levels.length ? main : loadPacks(['scratch.tt']);
    const i = byWalk.i < levels.length ? byWalk.i : byWalk.i - levels.length;
    add(`Lose the board by walking (${pack.levels[i].id})`, ['lost.byWalk'], pack, g => {
      g.load(i); g.quiet(); g.play(byWalk.prefix, fast); g.quiet(); g.step(byWalk.dir); g.quiet();
    });
  } else NOT_HERE['lost.byWalk'] = 'no plain walk off a solution path loses the board';

  const sealed = find(levels, ({ L, s, r }) => r.ok && bagsLeft(r.next) < bagsLeft(s) && exitLit(r.next) && isDead(L, r.next));
  if (sealed) add(`Tear the last bag with the way out shut (${levels[sealed.i].id})`, ['tear.lastButSealed'], main, g => {
    g.load(sealed.i); g.quiet(); g.play(sealed.prefix, fast); g.quiet(); g.step(sealed.dir); g.quiet();
  });
  else NOT_HERE['tear.lastButSealed'] = 'no last tear off a solution path shuts the way out';

  // Undo and restart, on the longest room.
  const long = levels.reduce((m, l, i) => (l.par > levels[m].par ? i : m), 0);
  add(`Undo a long way, redo the same move, many undos (${levels[long].id})`, ['undo.firstEver', 'undo.fine', 'undo.farBack',
    'undo.toStart', 'undo.redoSame', 'undo.redoSame3', 'undo.redoSame10', 'undo.many', 'win.manyUndos'], main, g => {
    const sol = parseLurd(levels[long].solve, levels[long].id);
    g.load(long); g.quiet(); g.play(sol.slice(0, 10), fast);
    for (let k = 0; k < 10; k++) { g.wait(fast); g.undo(); }
    g.quiet();
    for (let k = 0; k < 10; k++) { g.step(sol[0].dir); g.wait(fast); g.undo(); }
    g.quiet();
    g.play(sol, fast); g.quiet();
  });
  add(`Restarts: early, deep, the same opening, many (${levels[long].id})`, ['restart.first', 'restart.early',
    'restart.deep', 'restart.stillWinnable', 'restart.sameOpening', 'restart.many', 'win.manyRestarts'], main, g => {
    const sol = parseLurd(levels[long].solve, levels[long].id);
    g.load(long); g.quiet();
    g.play(sol.slice(0, 2), fast); g.wait(fast); g.restart(); g.quiet();
    g.play(sol.slice(0, TUNING.restartDeep), fast); g.wait(fast); g.restart(); g.quiet();
    g.play(sol.slice(0, TUNING.sameOpening), fast); g.wait(fast); g.restart(); g.quiet();
    g.play(sol.slice(0, TUNING.sameOpening), fast); g.wait(fast); g.restart(); g.quiet();
    g.wait(fast); g.restart(); g.quiet();
    g.play(sol, fast); g.quiet();
  });

  // Walking.
  const loop = find(levels, ({ s, dir }) => {
    const turn = { u: 'r', r: 'd', d: 'l', l: 'u' };
    let b = s, d = dir;
    for (let k = 0; k < 4; k++) { b = walkable(b, d); if (!b) return false; d = turn[d]; }
    return stateKey(b) === stateKey(s);
  });
  if (loop) add(`Walk a loop back to the same board (${levels[loop.i].id})`, ['walk.loop'], main, g => {
    const turn = { u: 'r', r: 'd', d: 'l', l: 'u' };
    g.load(loop.i); g.quiet(); g.play(loop.prefix, fast); g.quiet();
    let d = loop.dir;
    for (let k = 0; k < 4; k++) { g.wait(900); g.press(d); d = turn[d]; }
    g.quiet();
  });
  else NOT_HERE['walk.loop'] = 'no board on a solution path has a square of open floor';

  const dark = levels.findIndex(L => { const s = toState(L); return walkTo(s, b => !exitLit(b) && exitsOf(b).some(([x, y]) => b.rac.x === x && b.rac.y === y)); });
  if (dark >= 0) add(`Stand on the dark exit, twice (${levels[dark].id})`, ['walk.exitDark', 'walk.exitDarkAgain'], main, g => {
    g.load(dark); g.quiet();
    const path = walkTo(g.state, b => !exitLit(b) && exitsOf(b).some(([x, y]) => b.rac.x === x && b.rac.y === y));
    g.play(path, fast);
    const off = DIR_ORDER.find(d => walkable(g.state, d));
    g.step(off); g.step(OPP[off]); g.quiet();
  });

  const onExit = b => !exitLit(b) && exitsOf(b).some(([x, y]) => b.rac.x === x && b.rac.y === y);
  const cartPacks = [main, loadPacks(['scratch.tt'])];
  const carted = find(cartPacks.flatMap(p => p.levels), ({ s, dir }) => dir === DIR_ORDER[0] && bagsLeft(s) === 0 && !exitLit(s) && walkTo(s, onExit));
  if (carted) {
    const pack = carted.i < levels.length ? main : cartPacks[1];
    const i = carted.i < levels.length ? carted.i : carted.i - levels.length;
    add(`Stand on the dark exit with only cart trash left (${pack.levels[i].id})`, ['walk.exitDarkCart'], pack, g => {
      g.load(i); g.quiet(); g.play(carted.prefix, fast); g.quiet(); g.play(walkTo(g.state, onExit), fast); g.quiet();
    });
  } else NOT_HERE['walk.exitDarkCart'] = 'no solution path leaves trash on a cart with nothing full and a walk to the exit';

  const door = find(levels, ({ s, dir, b }) => exitLit(s) && exitsOf(s).some(e => Math.abs(e[0] - s.rac.x) + Math.abs(e[1] - s.rac.y) === 1)
    && (() => { const n = walkable(s, dir); return n && exitsOf(s).every(e => Math.abs(e[0] - n.rac.x) + Math.abs(e[1] - n.rac.y) > 1); })());
  if (door) add(`Walk up to the lit exit, then away (${levels[door.i].id})`, ['walk.exitThenAway'], main, g => {
    const L = levels[door.i];
    g.load(door.i); g.quiet(); g.play(door.prefix, fast); g.quiet(); g.step(door.dir); g.quiet();
  });
  else NOT_HERE['walk.exitThenAway'] = 'no solution path stops beside the lit exit with somewhere to walk away to';

  const roomy = find(levels, ({ s }) => pacer(s));
  add(`Walk fast, then think long before every move (${levels[roomy.i].id})`, ['walk.fastRun', 'walk.slowThink'], main, g => {
    g.load(roomy.i); g.quiet(); g.play(roomy.prefix, fast); g.quiet();
    const d = pacer(g.state);
    for (let k = 0; k < 8; k++) { g.wait(200); g.press(k % 2 ? OPP[d] : d); }
    g.quiet();
    for (let k = 0; k < 4; k++) { g.wait(TUNING.slowGapMs + 500); g.press(k % 2 ? OPP[d] : d); }
    g.quiet();
  });

  // Idling.
  const facing = find(levels, ({ b }) => b.prefix.length && b.next?.kind === TEAR && b.prefix.at(-1).dir === b.next.dir);
  if (facing) add(`Face a bag and stand there (${levels[facing.i].id})`, ['tear.facing'], main, g => {
    g.load(facing.i); g.quiet(); g.play(facing.prefix, fast); g.quiet(); g.wait(TUNING.facingMs + 500); g.quiet();
  });
  else NOT_HERE['tear.facing'] = 'no solution path walks up to a bag before tearing it';
  add('Stand idle long enough to doze, then wake', ['idle.first', 'idle.second', 'idle.rambleTrash', 'idle.rambleFaces',
    'idle.rambleShiny', 'idle.rambleRaccoon', 'idle.rambleBags', 'idle.doze', 'idle.wake'], main, g => {
    g.load(1);
    g.wait(TUNING.idleMs + 500); g.skipKey();
    for (let k = 0; k < 5; k++) { g.wait(TUNING.rambleMs + 500); g.skipKey(); }
    g.wait(TUNING.dozeMs + 500); g.skipKey(); g.quiet();
  });

  // Winning in other ways.
  const room8 = levels.findIndex(l => l.par >= 8 && pacer(toState(l)));
  add(`Win over par, way over par, then beat the best (${levels[room8].id})`, ['win.overPar', 'win.wayOverPar',
    'win.beatBest', 'win.starUp'], main, g => {
    const L = levels[room8], sol = parseLurd(L.solve, L.id);
    for (const extra of [12, 2, 0]) {
      g.load(room8); g.quiet();
      const d = pacer(g.state);
      for (let k = 0; k < extra; k++) { g.step(k % 2 ? OPP[d] : d); }
      g.play(sol, fast); g.quiet(); g.wait(WIN_MS);
    }
  });
  add('Win three rooms in a row at par', ['win.streak'], main, g => {
    for (let i = 0; i < 4; i++) { g.load(i); g.quiet(); g.play(parseLurd(levels[i].solve, levels[i].id), fast); g.wait(WIN_MS); }
    g.quiet();
  });

  const tearFirst = levels.findIndex(l => parseLurd(l.solve, l.id)[0].kind === TEAR);
  if (tearFirst >= 0) add(`Tear before looking (${levels[tearFirst].id})`, ['tear.beforeLooking'], main, g => {
    g.load(tearFirst); g.quiet(); g.step(parseLurd(levels[tearFirst].solve, levels[tearFirst].id)[0].dir); g.quiet();
  });

  add('Skip his lines until he goes quieter', ['progress.skipped', 'progress.quieter'], main, g => {
    for (let i = 0; i < 8; i++) { g.load(i); g.wait(TUNING.preWaitMs + 600); g.skipKey(); g.wait(100); g.skipKey(); g.wait(3000); }
    g.quiet();
  }, { skip: 'skip' });

  // What no board here can be made to do, measured rather than assumed.
  const most = { bags: 0, things: 0, grabs: 0 };
  for (const L of [...levels, ...matrix.levels]) {
    let s = toState(L);
    most.bags = Math.max(most.bags, bagsLeft(s));
    const acts = L.solve ? parseLurd(L.solve, L.id) : [{ dir: 'r' }];
    for (const a of acts) {
      const r = explain(s, a.dir, { trace: true });
      if (!r.ok) break;
      const p = pieceEvents(r, a.dir);
      most.things = Math.max(most.things, p.things);
      if (p.names.has('piece.magnetGrabs')) most.grabs++;
      s = r.next;
    }
  }
  if (most.bags < TUNING.halfBags) NOT_HERE['tear.half'] = `no room holds ${TUNING.halfBags} bags or more (the most is ${most.bags})`;
  for (const n of [3, 4, 5]) if (most.things < n)
    NOT_HERE[`piece.chain${n}`] = `no shove on a solution path or in the matrix moves ${n} things (the most is ${most.things})`;
  if (!most.grabs) NOT_HERE['piece.magnetGrabs'] = 'no shove here makes a magnet take hold of something new: every hold forms as its room loads';

  // Every meeting the interaction matrix stages, for the piece lines.
  add(`Every meeting in the interaction matrix (${matrix.levels.length} boards, ${matrix.unbuildable} unbuildable)`,
    ['piece.*'], matrix, g => {
    for (let i = 0; i < matrix.levels.length; i++) { g.load(i); g.wait(100); g.press('r'); g.wait(1200); }
  }, { scan: false });
  return S;
}

function cover(opt) {
  // A scenario that plays on from another's sitting brings that one along.
  const all = plan(opt);
  const want = new Set(all.filter(sc => !opt.only || sc.name.includes(opt.only)).map(sc => sc.name));
  for (const sc of [...all].reverse()) if (want.has(sc.name) && sc.after) want.add(sc.after);
  const S = all.filter(sc => want.has(sc.name));
  const keys = Object.keys(CROW).filter(k => !CROW[k].stretch);
  console.log(`Plan: ${S.length} scenarios for ${keys.length} events (${Object.keys(CROW).length - keys.length} stretch events left out).\n`);
  S.forEach((s, n) => console.log(`${String(n + 1).padStart(3)}. ${s.name}`));
  const fired = new Map(), said = new Map(), byName = new Map();
  const tuning = { ...TUNING, talkStart: opt.talk ?? 'verbose' };
  for (const sc of S) {
    const prior = sc.after ? byName.get(sc.after) : null;
    if (sc.after && !prior) throw new Error(`crowsim: "${sc.name}" plays on from "${sc.after}", which has not run before it`);
    const stores = prior ? { progress: copyStore(prior.stores.progress), crow: copyStore(prior.stores.crow) }
      : sc.stores?.() ?? (sc.fresh ? {} : pastTheOpening());
    const g = session({ levels: sc.pack.levels, acts: sc.pack.acts, seed: opt.seed, tuning, stores,
      skip: sc.skip ?? 'none', scan: sc.scan ?? true });
    sc.body(g);
    byName.set(sc.name, g);
    if (opt.only && sc.name.includes(opt.only)) console.log(`\n---- ${sc.name}\n${transcript(g.log, true)}`);
    for (const r of g.log) {
      if (r.type === 'fire' && !fired.has(r.key)) fired.set(r.key, sc.name);
      if (r.type === 'say' && !said.has(r.key)) said.set(r.key, sc.name);
    }
  }
  console.log('\nevent                         fired  said   first fired in');
  for (const k of keys) {
    const f = fired.get(k);
    console.log(`${k.padEnd(30)}${(f ? 'yes' : '—').padEnd(7)}${(said.has(k) ? 'yes' : '—').padEnd(7)}${f ?? NOT_HERE[k] ?? ''}`);
  }
  const missing = keys.filter(k => !fired.has(k));
  const reasoned = missing.filter(k => NOT_HERE[k]);
  const open = missing.filter(k => !NOT_HERE[k]);
  console.log(`\nFired ${fired.size} of ${keys.length} events; ${said.size} of them were also said.`);
  console.log(`Not fired, with a reason: ${reasoned.length}.`);
  console.log(`Not fired, no reason found: ${open.length}${open.length ? ` — ${open.join(', ')}` : ''}.`);
  if (!opt.only && open.length) process.exitCode = 1;
}

/** A sitting that is not the player's first: the opening has been said. */
function pastTheOpening() {
  const crow = memStore();
  crow.setItem(CROW_KEY, JSON.stringify({ said: { 'room.firstEver': true }, count: { 'room.firstEver': 1 }, rooms: { opened: true } }));
  return { crow };
}

function copyStore(s) {
  const m = memStore();
  for (const k of [STORE_KEY, CROW_KEY]) { const v = s.getItem(k); if (v !== null) m.setItem(k, v); }
  return m;
}

// ---------------------------------------------------------------- CLI

function args(argv) {
  const opt = { acts: actPacks().map(p => p.name), pace: 2000, think: 3000, skip: 'none', seed: 1 };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k], next = () => argv[++k];
    if (a === '--acts') opt.acts = next().split(',');
    else if (a === '--rooms') { const [x, y] = next().split('-').map(Number); opt.rooms = [x, y ?? x]; }
    else if (a === '--pace') opt.pace = Number(next());
    else if (a === '--think') opt.think = Number(next());
    else if (a === '--skip') opt.skip = next();
    else if (a === '--seed') opt.seed = Number(next());
    else if (a === '--talk') opt.talk = next();
    else if (a === '--polite') opt.polite = true;
    else if (a === '--all') opt.all = true;
    else if (a === '--json') opt.json = true;
    else if (a === '--cover') opt.cover = true;
    else if (a === '--only') opt.only = next();
    else if (a === '--help') { console.log(readFileSync(new URL(import.meta.url), 'utf8').split('*/')[0]); process.exit(0); }
    else throw new Error(`crowsim: unknown argument ${a}`);
  }
  if (!['none', 'fast', 'skip'].includes(opt.skip)) throw new Error(`crowsim: --skip is none, fast or skip`);
  return opt;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const opt = args(process.argv.slice(2));
  opt.cover ? cover(opt) : run(opt);
}
