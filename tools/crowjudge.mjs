#!/usr/bin/env node
/**
 * The crow on trial: scripted players sit through the acts, a script checks what he says against
 * the game state he says it in, and what a script cannot judge goes into a packet for readers.
 *
 *   node tools/crowjudge.mjs [--acts act1.tt,act2.tt] [--out tmp/crowjudge]
 *
 * Three players, two sittings each, every sitting from a fresh save:
 *   steady     solves at par after a pause to think; in some rooms, one refused press. Talk: verbose.
 *   struggler  takes one planned detour in each room, the list in rotation: the same refusal three
 *              times, a lost board walked on and undone, an early or a deep restart, a run of undos
 *              redone, a 25 s or a 65 s pause, a room left unsolved and come back to. Talk: chatty.
 *   impatient  fast moves, and skips every line. Talk: chatty, and quieter as the skips add up.
 *
 * Writes, under --out:
 *   sittings/<player>-<seed>.json  each sitting's crow log, and every action with the board after it
 *   findings.json, findings.md     what the script finds: stale lines, false claims, pieces named
 *                                  that are not in the room, repeats, and big moments left unsaid
 *   packet.md, items.json          what it cannot judge: line pairs said back to back (C…), and up
 *                                  to three cards for each event he said (F…), for the readers
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, BIN_EMPTY, WHEELIE, WHEELIE_EMPTY, JUG, JUG_EMPTY, FURNITURE,
  SPONGE, CARDBOARD, PANE, TIRE_H, TIRE_V, BICYCLE, RUG, CHAIR, BROOM, DIRS, DIR_ORDER,
  explain, stateKey, bagsLeft, exitLit, isWon, cell, inGrid, isCart, isBarrow, cartKindOf,
  isCabinetOpen, isCabinetClosed, isMagnet, isTar, isGrease, isGlass, isGrate,
} from '../src/rules.js';
import { parseLurd, toState } from '../src/format.js';
import { TUNING, rankTable } from '../src/crow.js';
import { namesOn, pieceEvents, leftOn } from '../src/crowWatch.js';
import { mulberry32 } from '../src/rng.js';
import { root } from './packs.mjs';
import { session, loadPacks, deadOf, along, pacer, OPP, WIN_MS, clock } from './crowsim.mjs';

const CROW = JSON.parse(readFileSync(resolve(root, 'dialogue/crow.json'), 'utf8'));
const RANK = rankTable(CROW);

const STALE_ACTIONS = 3;      // actions between an event and its line that make the line stale
const REPEAT_ROOMS = 3;       // the same line again within this many rooms is a repeat
const ROOM_REPEAT = 3;        // one event said this often in one visit to a room
const CLASH_MS = 5000;        // from the end of one line to the start of the next
const SAMPLES = 3;            // fit cards for each event
const BIG = new Set(['story', 'act and teach', 'lost board', 'rare win']);

const PLAYERS = [
  { name: 'steady', talk: 'verbose', skip: 'none' },
  { name: 'struggler', talk: 'chatty', skip: 'none' },
  { name: 'impatient', talk: 'chatty', skip: 'skip' },
];
const SEEDS = [1, 2];

// ---------------------------------------------------------------- the board, in words

const ONAME = {
  [BAG]: 'bag', [CAN_FULL]: 'trash can with a bag in it', [CAN_EMPTY]: 'empty trash can', [TRASH]: 'trash',
  [BIN]: 'full recycling box', [BIN_EMPTY]: 'empty recycling box', [WHEELIE]: 'full wheelie bin',
  [WHEELIE_EMPTY]: 'empty wheelie bin', [JUG]: 'full water jug', [JUG_EMPTY]: 'empty water jug',
  [FURNITURE]: 'couch', [SPONGE]: 'sponge', [CARDBOARD]: 'cardboard', [PANE]: 'glass pane', [TIRE_H]: 'tire',
  [TIRE_V]: 'tire', [BICYCLE]: 'bicycle', [RUG]: 'rug', [CHAIR]: 'office chair', [BROOM]: 'broom',
};
const occupant = o => ONAME[o] ?? (isCabinetOpen(o) ? 'open cabinet' : isCabinetClosed(o) ? 'closed cabinet'
  : isMagnet(o) ? 'magnet' : `a barrow, carried`);

function describe(c) {
  const parts = [];
  if (c.wall) parts.push('wall');
  if (c.exit) parts.push('exit');
  if (c.o) parts.push(occupant(c.o));
  if (isCart(c)) parts.push(isBarrow(cartKindOf(c)) ? 'barrow' : 'skateboard');
  if (c.water) parts.push('water');
  if (c.bridge) parts.push('filled canal');
  if (isTar(c)) parts.push('tar');
  if (isGrease(c)) parts.push('grease');
  if (isGlass(c)) parts.push('broken glass');
  if (isGrate(c)) parts.push('grate');
  if (c.oneway !== undefined) parts.push(`one-way arrow pointing ${{ u: 'up', d: 'down', l: 'left', r: 'right' }[c.oneway]}`);
  return parts.join(' + ') || 'floor';
}

/** The two cells in front of the raccoon, the way he pressed. */
function ahead(s, dir) {
  const [dx, dy] = DIRS[dir], out = [];
  for (let k = 1; k <= 2; k++) {
    const x = s.rac.x + dx * k, y = s.rac.y + dy * k;
    if (!inGrid(s, x, y)) { out.push('outside the room'); break; }
    out.push(describe(cell(s, x, y)));
  }
  return out.join(', then ');
}

// Words in a line that name a piece, and the pieces (as `namesOn` spells them) that make it true.
const WORDS = [
  [/\bbags?\b/i, ['bag', 'can', 'wheelie']],
  [/\btrash\b/i, ['bag', 'can', 'box', 'wheelie']],
  [/\btrash ?cans?\b|\bcans\b|\b(the|a|that|this|your|full|empty) can\b/i, ['can']],
  [/(?<!take-out )\bbox(es)?\b|\brecycling\b/i, ['box']],
  [/\bwheelie/i, ['wheelie']],
  [/\bjugs?\b/i, ['jug']],
  [/\bcouch(es)?\b|\bsofa\b/i, ['couch']],
  [/\bsponge/i, ['sponge']],
  [/\bcardboard\b/i, ['cardboard']],
  [/\bpanes?\b|\bwindow/i, ['pane']],
  [/\btires?\b|\btyres?\b/i, ['tire']],
  [/\bbikes?\b|\bbicycles?\b/i, ['bicycle']],
  [/\brugs?\b|\bcarpet/i, ['rug']],
  [/\bchairs?\b/i, ['chair']],
  [/\bbrooms?\b/i, ['broom']],
  [/\bcabinets?\b|\bdrawers?\b/i, ['cabinet']],
  [/\bmagnet/i, ['magnet']],
  [/\bbarrows?\b|\bwheelbarrow|\bcart\b/i, ['barrow']],
  [/\bskateboard|\bdeck\b|\bskate\b/i, ['skateboard']],
  [/\bwater\b|\bcanal\b|\bpuddle/i, ['water', 'jug']],
  [/\btar\b/i, ['tar']],
  [/\bgrease|\bgreasy\b|\bslick\b/i, ['grease']],
  [/\bglass\b|\bshards?\b/i, ['glass', 'pane']],
  [/\bgrates?\b|\bdrain/i, ['grate']],
  [/\bone[- ]way\b/i, ['oneway']],
];

// What a line says about the board. `before`: the board the action that fired it left. `now`:
// the board when it fired, and still when he says it.
const CLAIMS = {
  'restart.fromLost': { before: 'lost' }, 'restart.stillWinnable': { before: 'winnable' },
  'undo.losingMove': { before: 'lost', now: 'winnable' }, 'undo.fine': { before: 'winnable', now: 'winnable' },
  'lost.undoneOut': { before: 'lost', now: 'winnable' }, 'undo.notFarEnough': { now: 'lost' },
  'tear.stillWinnable': { now: 'winnable' }, 'tear.lastButSealed': { now: 'lost' },
};
const claimOf = key => CLAIMS[key] ?? (key === 'lost' || key.startsWith('lost.') ? { now: 'lost' } : null);

const groupBy = (xs, f) => xs.reduce((m, x) => ((m[f(x)] ??= []).push(x), m), {});
const family = key => key.split('.')[0];
const moveBound = key => !['story', 'room', 'meet', 'win', 'progress'].includes(family(key));
const crossesRooms = key => ['win', 'progress', 'story'].includes(family(key));
const variants = key => { const e = CROW[key]; return e.lines ? e.lines.length : Math.max(...e.byCount.map(s => s.lines.length)); };

// ---------------------------------------------------------------- the players

function sit(player, seed, pack) {
  const { levels, acts } = pack;
  const g = session({ levels, acts, seed, tuning: { ...TUNING, talkStart: player.talk }, skip: player.skip });
  const rnd = mulberry32(seed * 7919 + PLAYERS.indexOf(player) * 104729);
  const j = n => Math.floor(rnd() * n);
  const actions = [], detours = [];
  const startNames = levels.map(L => namesOn(toState(L)));
  let visit = 0;

  const verdict = () => {
    if (isWon(g.state)) return 'won';
    const dead = deadOf(levels[g.cur]);
    return dead ? (dead.has(stateKey(g.state)) ? 'lost' : 'winnable') : 'unknown';
  };
  function op(what, fn, extra = {}) {
    const before = g.state ? verdict() : null, s = g.state;
    fn();
    if (what === 'arrive') visit++;
    const w = g.watch.peek(g.t);
    actions.push({ t: g.t, what, room: g.cur, visit, path: g.path, before, verdict: verdict(), bags: bagsLeft(g.state), left: leftOn(g.state),
      lit: exitLit(g.state), names: [...new Set([...startNames[g.cur], ...namesOn(g.state)])],
      counts: { refusals: w.refusals, sameRefusal: w.same, undos: w.undos, restarts: w.restarts, losses: w.losses,
        movesWhileLost: w.lostMoves }, ...extra, ...(extra.dir ? press(s, extra.dir) : {}) });
  }
  function press(s, dir) {
    const res = g.last;
    if (res.kind === 'handover') throw new Error('crowjudge: a script pressed on after a win');
    if (res.kind === 'refused') return { result: `refused (${res.r.reason})`, ahead: ahead(s, dir) };
    if (res.kind === 'moved') return { result: res.r.kind, pieces: pieceEvents(res.r, dir).names };
    return { result: res.kind };
  }
  const load = i => op('arrive', () => g.load(i));
  const restart = () => op('restart', () => g.restart());
  const undo = (pace = 600) => { g.wait(pace); op('undo', () => g.undo()); };
  const step = (dir, pace) => op('press', () => g.step(dir, pace), { dir });
  const sol = i => parseLurd(levels[i].solve, levels[i].id).map(a => a.dir);

  /** The first refused direction on the room's solution path, and how many moves in. */
  function refusalOnPath(L) {
    for (const b of along(L)) for (const dir of DIR_ORDER) if (!explain(b.s, dir).ok) return { at: b.prefix.length, dir };
    return null;
  }
  /** A move off the solution path that loses a board the path still wins. */
  function losingOffPath(L) {
    const dead = deadOf(L);
    if (!dead) return null;
    for (const b of along(L)) {
      if (!b.next || dead.has(stateKey(b.s))) continue;
      for (const dir of DIR_ORDER) {
        const r = explain(b.s, dir);
        if (r.ok && dir !== b.next.dir && dead.has(stateKey(r.next))) return { at: b.prefix.length, dir };
      }
    }
    return null;
  }

  const players = {
    steady(i) {
      const pace = () => 1300 + j(600), dirs = sol(i);
      const slip = (i + seed) % 5 === 0 ? refusalOnPath(levels[i]) : null;
      load(i); g.wait(3000 + j(1500));
      dirs.forEach((d, k) => { if (slip?.at === k) step(slip.dir, pace()); step(d, pace()); });
      g.wait(WIN_MS);
    },
    impatient(i) {
      load(i); g.wait(600 + j(400));
      for (const d of sol(i)) step(d, 450 + j(150));
      g.wait(WIN_MS);
    },
  };

  const pace = () => 1800 + j(800), think = () => 4000 + j(2000);
  const DETOURS = [
    { name: 'the same refusal three times', can: i => refusalOnPath(levels[i]), run(i, x) {
      const dirs = sol(i);
      load(i); g.wait(think());
      dirs.forEach((d, k) => { if (k === x.at) for (let n = 0; n < 3; n++) step(x.dir, 1500); step(d, pace()); });
    } },
    { name: 'a lost board, walked on, then undone', can: i => losingOffPath(levels[i]), run(i, x) {
      const dirs = sol(i);
      load(i); g.wait(think());
      for (const d of dirs.slice(0, x.at)) step(d, pace());
      step(x.dir, pace());
      const p = pacer(g.state);
      if (p) for (const d of [p, OPP[p], p]) step(d, 900);
      g.wait(1500);
      while (verdict() === 'lost') undo(700);
      for (const d of dirs.slice(x.at)) step(d, pace());
    } },
    { name: 'an early restart', can: i => sol(i).length >= 3, run(i) {
      const dirs = sol(i);
      load(i); g.wait(think());
      for (const d of dirs.slice(0, 2)) step(d, pace());
      g.wait(1000); restart(); g.wait(2000);
      for (const d of dirs) step(d, pace());
    } },
    { name: 'a deep restart', can: i => sol(i).length >= 4, run(i) {
      const dirs = sol(i);
      load(i); g.wait(think());
      for (const d of dirs.slice(0, -1)) step(d, pace());
      g.wait(1500); restart(); g.wait(2000);
      for (const d of dirs) step(d, pace());
    } },
    { name: 'a run of undos, redone', can: i => sol(i).length >= 4, run(i) {
      const dirs = sol(i), k = Math.max(3, Math.floor(dirs.length / 2));
      load(i); g.wait(think());
      for (const d of dirs.slice(0, k)) step(d, pace());
      for (let n = 0; n < 3; n++) undo();
      for (const d of dirs.slice(k - 3)) step(d, pace());
    } },
    { name: 'a 25 s pause', can: () => true, run(i) {
      const dirs = sol(i), k = Math.floor(dirs.length / 2);
      load(i); g.wait(think());
      for (const d of dirs.slice(0, k)) step(d, pace());
      g.wait(25000);
      for (const d of dirs.slice(k)) step(d, pace());
    } },
    { name: 'a 65 s pause', can: () => true, run(i) {
      load(i); g.wait(65000);
      for (const d of sol(i)) step(d, pace());
    } },
    { name: 'left unsolved, then come back to', can: i => i + 1 < levels.length && sol(i).length >= 3, run(i) {
      load(i); g.wait(think());
      for (const d of sol(i).slice(0, 2)) step(d, pace());
      g.wait(1500);
      load(i + 1); g.wait(think());
      for (const d of sol(i + 1)) step(d, pace());
      g.wait(WIN_MS);
      load(i); g.wait(think());
      for (const d of sol(i)) step(d, pace());
      return true;
    } },
  ];
  players.struggler = i => {
    for (let n = 0; n < DETOURS.length; n++) {
      const d = DETOURS[(i + seed + n) % DETOURS.length], x = d.can(i);
      if (!x) continue;
      const again = d.run(i, x);
      g.wait(WIN_MS);
      detours.push({ room: levels[i].id, detour: d.name, passedOver: n });
      return again;
    }
    throw new Error(`crowjudge: no detour fits ${levels[i].id}`);
  };

  for (let i = 0; i < levels.length; i++) if (players[player.name](i)) i++;
  g.quiet();
  return { name: `${player.name}-${seed}`, player: player.name, seed, log: g.log, actions, detours,
    rooms: levels.map((L, i) => ({ id: L.id, name: L.name, act: acts.findIndex(a => i >= a.from && i <= a.to) + 1 })) };
}

// ---------------------------------------------------------------- reading a sitting

/** Every line said, with the event behind it and the board when it fired and when he spoke. */
function lines(S) {
  const at = t => S.actions.findLast(a => a.t <= t) ?? null;
  // The fires of each event still waiting: a drop takes the oldest, and a line is the oldest left.
  // Two fires of one event a moment apart may swap, which moves no check by more than that moment.
  const out = [], pending = {};
  S.log.forEach((r, n) => {
    if (r.type === 'fire') (pending[r.key] ??= []).push(r);
    if (r.type === 'drop') pending[r.key]?.shift();
    if (r.type !== 'say') return;
    const fire = pending[r.key]?.[0] ?? null;
    pending[r.key] = [];
    const end = S.log.slice(n + 1).find(e => (e.type === 'end' || e.type === 'skip') && e.key === r.key);
    const A = fire ? at(fire.t) : null, B = at(r.t);
    out.push({ sitting: S.name, n: out.length, key: r.key, text: r.beats.join(' / '), face: r.face, talk: r.talk,
      t: r.t, end: end?.t ?? r.t, skipped: end?.type === 'skip', fire, atFire: A, atSay: B,
      firedBy: A && fire && A.t === fire.t ? A : null,
      between: fire ? S.actions.filter(a => a.what !== 'arrive' && a.t > fire.t && a.t <= r.t).length : 0,
      recent: S.actions.filter(a => a.t <= r.t && a.room === B?.room).slice(-6) });
  });
  return out;
}

const roomOf = (S, a) => a ? S.rooms[a.room] : null;
const where = (S, l) => { const R = roomOf(S, l.atSay); return R ? `${R.id} "${R.name}" (act ${R.act})` : 'before any room'; };
const actionText = a => a.what === 'press' ? `press ${a.dir} → ${a.result}${a.pieces?.length ? ` [${a.pieces.join(', ')}]` : ''}` : a.what;

function scriptChecks(S, L) {
  const found = [];
  const add = (l, kind, detail) => found.push({ kind, sitting: S.name, key: l.key, room: roomOf(S, l.atSay)?.id ?? null,
    t: l.t, line: l.text, detail });
  for (const l of L) {
    const A = l.atFire, B = l.atSay;
    if (A && B && A.room !== B.room && !crossesRooms(l.key)) add(l, 'stale', `fired in ${S.rooms[A.room].id}, said in ${S.rooms[B.room].id}`);
    if (moveBound(l.key) && A && B && A.room === B.room) {
      if (l.between >= STALE_ACTIONS) add(l, 'stale', `${l.between} actions between the event and the line`);
      if (!B.path.startsWith(A.path)) add(l, 'stale', 'the move behind it was taken back before he spoke');
      const known = v => v === 'lost' || v === 'winnable';
      if (known(A.verdict) && known(B.verdict) && A.verdict !== B.verdict)
        add(l, 'stale', `the board went from ${A.verdict} to ${B.verdict} before he spoke`);
    }
    const c = claimOf(l.key);
    if (c && A) {
      if (c.before && l.firedBy && ['lost', 'winnable'].includes(l.firedBy.before) && l.firedBy.before !== c.before)
        add(l, 'false claim', `says the board was ${c.before}; it was ${l.firedBy.before}`);
      for (const [when, a] of [['fired', A], ['said', B]])
        if (c.now && ['lost', 'winnable'].includes(a.verdict) && a.verdict !== c.now)
          add(l, 'false claim', `says the board is ${c.now}; when it was ${when}, it was ${a.verdict}`);
    }
    if (B && !['story', 'progress', 'meet'].includes(family(l.key)) && RANK[l.key].tier !== 'story' && !CROW[l.key].actBound) {
      for (const [re, names] of WORDS) {
        const m = l.text.match(re);
        if (m && !names.some(nm => B.names.includes(nm)))
          add(l, 'absent piece', `names "${m[0]}"; the room has ${B.names.join(', ') || 'none of the pieces'}`);
      }
    }
  }
  // A line that counts the full ones says the count on the board when he spoke it.
  for (const l of L) {
    const B = l.atSay, lines = CROW[l.key].lines ?? [];
    if (!B || !lines.some(v => typeof v === 'string' && v.includes('{left}'))) continue;
    if (!lines.some(v => v.includes('{left}') ? B.left !== null && v.replace('{left}', B.left) === l.text : v === l.text))
      add(l, 'false claim', `counts what is full; the board has ${B.left ?? 'nothing full'}`);
  }
  // Repeats: the same words again soon, one event again and again in a visit, the bag giving the same variant twice.
  const byText = new Map();
  for (const l of L) if (l.atSay) (byText.get(l.text) ?? byText.set(l.text, []).get(l.text)).push(l);
  for (const [, ls] of byText) for (let k = 1; k < ls.length; k++) {
    const gap = ls[k].atSay.visit - ls[k - 1].atSay.visit;
    if (gap <= REPEAT_ROOMS) add(ls[k], 'repeat', gap === 0 ? 'the same line twice in one visit to the room'
      : `the same line ${gap} room${gap > 1 ? 's' : ''} after the last time`);
  }
  const perVisit = new Map();
  for (const l of L) if (l.atSay) {
    const k = `${l.atSay.visit}|${l.key}`;
    perVisit.set(k, [...(perVisit.get(k) ?? []), l]);
  }
  for (const [, ls] of perVisit) if (ls.length >= ROOM_REPEAT) add(ls[ROOM_REPEAT - 1], 'repeat', `${ls.length} times in one visit to the room`);
  const lastOf = {};
  for (const l of L) {
    if (lastOf[l.key] === l.text && variants(l.key) > 1) add(l, 'repeat', 'the same variant twice in a row; the event has more');
    lastOf[l.key] = l.text;
  }
  return found;
}

/** Big moments that fired in the sitting and were never said in it, with why the director let them go. */
function unsaid(S) {
  const fired = new Set(S.log.filter(r => r.type === 'fire' && BIG.has(RANK[r.key]?.tier)).map(r => r.key));
  const said = new Set(S.log.filter(r => r.type === 'say').map(r => r.key));
  return [...fired].filter(k => !said.has(k)).map(key => ({ key, sitting: S.name,
    fires: S.log.filter(r => r.type === 'fire' && r.key === key).length,
    why: S.log.filter(r => r.type === 'drop' && r.key === key).map(r => r.why) }));
}

// ---------------------------------------------------------------- the packet

function card(id, S, l) {
  const A = l.atFire, B = l.atSay, f = l.firedBy;
  const c = B?.counts;
  return [
    `${id} · ${l.key} · ${where(S, l)} · ${clock(l.t).trim()} · talk ${l.talk}`,
    `  line: "${l.text}"   face: ${l.face}`,
    `  fired by: ${f ? actionText(f) + (f.ahead ? `; ahead of him: ${f.ahead}` : '') : 'the clock, with no action'}`,
    `  fired ${((l.t - (l.fire?.t ?? l.t)) / 1000).toFixed(1)} s before he spoke; ${l.between} action${l.between === 1 ? '' : 's'} in between`
      + (A && B && A.room !== B.room ? `; it fired in ${S.rooms[A.room].id} "${S.rooms[A.room].name}", and he spoke after the next room opened` : ''),
    `  board: ${A?.verdict ?? '—'} when it fired, ${B?.verdict ?? '—'} when he spoke · bags left ${B?.bags ?? '—'} · exit ${B?.lit ? 'open' : 'shut'}`,
    `  room has: ${B?.names.join(', ') || '—'}`,
    c ? `  counts in the room: refusals ${c.refusals}, the same refusal ${c.sameRefusal} in a row, undos ${c.undos}, restarts ${c.restarts}, losses ${c.losses}, moves while lost ${c.movesWhileLost}` : null,
    `  last actions: ${l.recent.map(actionText).join(', ') || '—'}`,
  ].filter(Boolean).join('\n');
}

const RUBRIC = `# Crow lines: does each one make sense?

A grumpy old crow coaches a raccoon through a trash puzzle game, one room at a time. He reacts to
what the player does. Each line was approved as written: judge SENSE only, never wording, tone or
style. Use only what an item shows. Do not guess about the game.

Game words: a "refused" press is one the rules turned away (the raccoon stays put). A board is
"lost" when the room can no longer be won from it, "winnable" when it can. "Bags left" is the
bags still to tear; the exit opens when they are all torn. "{n}" in a line has been filled in.

## Clash items (C…): line A, then line B soon after it
- ok: B can follow A.
- clash: B repeats what A just said, contradicts it, or makes no sense right after it.

## Fit items (F…): one line, and the game when he said it
- ok: the line fits what the card shows.
- mismatch: the line is about something other than what happened (for example, a line about a
  wall when the push hit the edge of the room, or a line about a tear when nothing tore).
- false: the line states something the card contradicts (a count, a piece, lost or winnable).
- unsure: the card does not show enough to decide.

## Answer
Write ONE JSON array to the file you are told to, one object per item, in item order:
{"id": "C1", "verdict": "ok", "why": "at most 15 words"}
Give every item a verdict. Write nothing else in the file.
`;

function packet(sittings, all) {
  // Clash pairs: two lines back to back, each pair of events once, with how often it happened.
  const pairs = new Map();
  for (const S of sittings) {
    const L = all.get(S.name);
    for (let k = 1; k < L.length; k++) {
      const a = L[k - 1], b = L[k];
      if (b.t - a.end > CLASH_MS) continue;
      const id = `${a.key} → ${b.key}`;
      if (!pairs.has(id)) pairs.set(id, { a, b, S, count: 0 });
      pairs.get(id).count++;
    }
  }
  const items = [], text = [RUBRIC, '\n# Items\n'];
  let n = 0;
  for (const [, p] of pairs) {
    const id = `C${++n}`;
    items.push({ id, kind: 'clash', keys: [p.a.key, p.b.key], count: p.count, sitting: p.S.name, t: p.a.t });
    text.push(`${id} · seen ${p.count} time${p.count > 1 ? 's' : ''} · first in ${where(p.S, p.a)} at ${clock(p.a.t).trim()}\n`
      + `  A  ${p.a.key}  "${p.a.text}"\n  B  ${p.b.key}  "${p.b.text}"   (B began ${((p.b.t - p.a.end) / 1000).toFixed(1)} s after A ended)\n`);
  }
  // Fit cards: up to SAMPLES for each event, taken from the sittings in turn, a different room each time.
  const byKey = new Map();
  for (const S of sittings) for (const l of all.get(S.name)) (byKey.get(l.key) ?? byKey.set(l.key, []).get(l.key)).push([S, l]);
  n = 0;
  for (const [key, ls] of [...byKey].sort(([a], [b]) => RANK[a].at - RANK[b].at)) {
    const picked = [], rooms = new Set();
    for (let round = 0; picked.length < SAMPLES && round < ls.length; round++) {
      for (const S of sittings) {
        const hit = ls.find(([s, l]) => s === S && !picked.some(p => p[1] === l) && !rooms.has(l.atSay?.room));
        if (hit && picked.length < SAMPLES) { picked.push(hit); rooms.add(hit[1].atSay?.room); }
      }
      if (picked.length < SAMPLES) rooms.clear();
    }
    for (const [S, l] of picked) {
      const id = `F${++n}`;
      items.push({ id, kind: 'fit', keys: [key], sitting: S.name, t: l.t });
      text.push(card(id, S, l) + '\n');
    }
  }
  return { items, text: text.join('\n') };
}

// ---------------------------------------------------------------- CLI

function args(argv) {
  const opt = { acts: ['act1.tt', 'act2.tt'], out: resolve(root, 'tmp/crowjudge') };
  for (let k = 0; k < argv.length; k++) {
    const a = argv[k];
    if (a === '--acts') opt.acts = argv[++k].split(',');
    else if (a === '--out') opt.out = resolve(argv[++k]);
    else throw new Error(`crowjudge: unknown argument ${a}`);
  }
  return opt;
}

const opt = args(process.argv.slice(2));
const pack = loadPacks(opt.acts);
mkdirSync(resolve(opt.out, 'sittings'), { recursive: true });
const sittings = [], all = new Map(), findings = [], missing = [];
for (const player of PLAYERS) for (const seed of SEEDS) {
  const S = sit(player, seed, pack);
  sittings.push(S);
  writeFileSync(resolve(opt.out, 'sittings', `${S.name}.json`), JSON.stringify(S));
  const L = lines(S);
  all.set(S.name, L);
  findings.push(...scriptChecks(S, L));
  missing.push(...unsaid(S));
  const lastT = S.log.at(-1)?.t ?? 0;
  console.log(`${S.name.padEnd(12)} ${String(L.length).padStart(4)} lines in ${clock(lastT).trim()}`
    + (S.detours.length ? `  · detours: ${Object.entries(groupBy(S.detours, d => d.detour)).map(([k, v]) => `${k} ${v.length}`).join(', ')}` : ''));
}
const passed = sittings.flatMap(S => S.detours.filter(d => d.passedOver > 0));
if (passed.length) console.log(`struggler rooms where a detour did not fit and the next one was taken: ${passed.length}`);

// Missing moments, folded by event.
const gone = Object.entries(groupBy(missing, m => m.key)).map(([key, ms]) => ({ key, sittings: ms.map(m => m.sitting).join(', '),
  fires: ms.reduce((n, m) => n + m.fires, 0),
  why: Object.entries(groupBy(ms.flatMap(m => m.why.length ? m.why : ['no drop logged']), w => w)).map(([w, v]) => `${w} ${v.length}`).join(', ') }));
writeFileSync(resolve(opt.out, 'findings.json'), JSON.stringify({ findings, missing: gone }, null, 1));
const byKind = groupBy(findings, f => f.kind);
const md = ['# Script findings', ''];
for (const [kind, fs] of Object.entries(byKind)) {
  md.push(`## ${kind} (${fs.length})`, '');
  for (const f of fs) md.push(`- **${f.key}** · ${f.sitting} · ${f.room} · ${clock(f.t).trim()} — ${f.detail}  \n  "${f.line}"`);
  md.push('');
}
md.push(`## big moments fired and never said in a sitting (${gone.length} events)`, '');
for (const m of gone) md.push(`- **${m.key}** — never said in ${m.sittings}; fired ${m.fires}×; dropped: ${m.why}`);
writeFileSync(resolve(opt.out, 'findings.md'), md.join('\n') + '\n');

const P = packet(sittings, all);
writeFileSync(resolve(opt.out, 'packet.md'), P.text);
writeFileSync(resolve(opt.out, 'items.json'), JSON.stringify(P.items, null, 1));
const clashes = P.items.filter(i => i.kind === 'clash').length;
console.log(`\nscript findings: ${Object.entries(byKind).map(([k, v]) => `${k} ${v.length}`).join(', ') || 'none'}; big moments never said: ${gone.length} events`);
console.log(`packet: ${clashes} clash pairs, ${P.items.length - clashes} fit cards, ${P.text.length} characters (about ${Math.round(P.text.length / 4 / 1000)}k tokens)`);
