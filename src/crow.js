// The crow's director: which line he says, when, and for how long. No DOM and no clock of its
// own — the time comes in on every call — so the game and the headless harness run the same
// thing. What made him want to speak is `crowWatch.js`; the lines are `dialogue/crow.json`.

export const TALK = ['quiet', 'chatty', 'verbose'];

// Every number the crow runs on, the watcher's thresholds included, so tuning him is one table.
export const TUNING = {
  // ---- the director ----
  preWaitMs: 1000,
  cps: 40,                  // typing, characters a second
  readPerCharMs: 38,
  holdMs: 900,
  beatGapMs: 400,
  speechPerCharMs: 45,
  fastX: 3,
  monoGapMs: 10000,
  eventGapMs: 30000,
  momentMs: 6000,
  repeatChance: { quiet: 0.15, chatty: 0.35, verbose: 0.7 },
  faceMs: 1500,
  talkStart: 'chatty',
  talkWindow: 8,
  talkDown: 0.6,
  talkUpWindow: 16,
  talkUp: 0.1,

  // ---- the watcher ----
  tinyPar: 4, hugePar: 30,
  longWalk: 12,
  loopMin: 4,
  pacing: 4,
  fastRun: 8, fastGapMs: 350,
  slowRun: 4, slowGapMs: 6000,
  facingMs: 5000,
  halfBags: 4,
  longRoll: 4, longestRollMin: 5,
  sameRefusal: [3, 5, 8, 12],
  flail: 4, flailMs: 3000,
  manyRefusals: 15,
  redoSame: [1, 3, 10],
  farBack: 8,
  toStartMin: 3,
  undoSettleMs: 1200,
  manyUndos: 20, winUndos: 10,
  restartEarly: 5, restartDeep: 15,
  manyRestarts: 5, winRestarts: 3,
  sameOpening: 4,
  lostLadder: [2, 5, 9, 14],
  lostIdleMs: 10000,
  yodaLost: 4,
  idleMs: 20000, rambleMs: 60000, dozeMs: 120000,
  nemesis: 5,
  streak: [3, 5, 8, 12],
  loseStreak: 3,
};

// An entry ending in a dot is a family. `name` is for the debug panel.
const TIERS = [
  { name: 'story', chance: false, gap: false, keys: ['story.', 'room.firstEver', 'room.backAllStars', 'room.backDone'] },
  { name: 'act and teach', chance: false, gap: false, keys: ['progress.actDone', 'room.actFirst', 'room.teach', 'meet.'] },
  { name: 'lost board', chance: false, gap: true, keys: ['lost.firstEver', 'tear.lastButSealed', 'restart.fromLost',
    'undo.losingMove', 'undo.notFarEnough', 'lost.yoda', 'lost.byWalk', 'lost', 'lost.'] },
  { name: 'rare win', chance: false, gap: false, keys: ['progress.rooms10', 'progress.halfAct', 'win.nemesis',
    'win.streak', 'win.perfect', 'win.underPar', 'win.cameBack', 'win.starUp', 'win.beatBest', 'win.afterLost',
    'win.firstTry', 'progress.loseStreak3'] },
  { name: 'room and win', chance: true, gap: true, keys: ['room.hasCouch', 'room.hasPane', 'room.hasSkateboard', 'room.huge',
    'room.tiny', 'room.actLast', 'room.skippedAhead', 'room.unsolvedAgain', 'win.', 'room.',
    'progress.leftUnsolved'] },
  { name: 'common', chance: true, gap: true, keys: [
    'tear.last', 'tear.oneLeft', 'tear.half', 'tear.first', 'tear.beforeLooking', 'tear.',
    'undo.firstEver', 'undo.many', 'undo.redoSame10', 'undo.redoSame3', 'undo.redoSame', 'undo.',
    'restart.first', 'restart.many', 'restart.sameOpening', 'restart.',
    'refuse.same12', 'refuse.same8', 'refuse.same5', 'refuse.same3', 'refuse.flailing', 'refuse.manyInRoom', 'refuse.',
    'piece.longestRoll', 'piece.chain5', 'piece.chain4', 'piece.chain3', 'piece.longRoll', 'piece.',
    'walk.', 'idle.', 'progress.'] },
];

/** Every name and family the rank list places, for a test to hold against the lines. */
export const RANK_ENTRIES = TIERS.flatMap(t => t.keys);

// How long a line that has to wait stays worth saying. A win has been recorded
// by the time anyone can undo it, so what is said about it outlives an undo. An act's first room
// is often left before the line about the act can start, and the line is about the act, not the room.
const MOMENT = { timed: true, arrive: true, rewind: true };
const LASTS = [
  ['story.', { timed: false, arrive: false, rewind: false }],
  ['room.actFirst', { timed: false, arrive: false, rewind: false }],
  ['room.', { timed: false, arrive: true, rewind: false }],
  ['meet.', { timed: false, arrive: true, rewind: false }],
  ['win.', { timed: true, arrive: true, rewind: false }],
  ['progress.', { timed: false, arrive: false, rewind: false }],
];

// A key with an act suffix is its base event said in that act's words.
const variantOf = (key, events) => {
  const m = /^(.*)\.act\d+$/.exec(key);
  return m && m[1] in events ? m[1] : null;
};

/**
 * Rank, tier and lifetime for every event, built once from `events`. An entry that places nothing
 * is a test's to catch, so a small table can stand in for the lines.
 */
export function rankTable(events) {
  const keys = Object.keys(events).filter(k => !events[k].stretch && !variantOf(k, events));
  const table = {};
  let at = 0;
  for (const { name: tier, chance, gap, keys: entries } of TIERS) for (const p of entries) {
    const hit = p.endsWith('.') ? keys.filter(k => k.startsWith(p)) : keys.filter(k => k === p);
    for (const k of hit) if (!(k in table))
      table[k] = { at: at++, tier, chance, gap, lasts: LASTS.find(([f]) => k.startsWith(f))?.[1] ?? MOMENT };
  }
  const loose = keys.filter(k => !(k in table));
  if (loose.length) throw new Error(`crow: no rank for ${loose.join(', ')}`);
  for (const k of Object.keys(events)) { const base = variantOf(k, events); if (base) table[k] = table[base]; }
  return table;
}

export const CROW_KEY = 'treasure-trash:crow:1';

/**
 * What the crow remembers across sittings, over a `Storage`-shaped object. One blob for the
 * director and the watcher both. Storage is outside the program, so it is checked here once and
 * trusted after.
 */
export function createCrowMemory(store) {
  let data = {};
  try {
    const raw = store.getItem(CROW_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) data = parsed;
  } catch { /* unreadable */ }
  for (const k of ['said', 'count', 'bags', 'rooms', 'left', 'flags'])
    if (!data[k] || typeof data[k] !== 'object' || Array.isArray(data[k])) data[k] = {};
  for (const [k, bag] of Object.entries(data.bags)) if (!Array.isArray(bag)) delete data.bags[k];
  return {
    data,
    save() { try { store.setItem(CROW_KEY, JSON.stringify(data)); } catch { /* full or blocked */ } },
  };
}

/** How long beat `i` of `beats` stays up. */
export function beatMs(beats, i, speech, T = TUNING) {
  const s = beats[i], read = (speech ? T.speechPerCharMs : T.readPerCharMs) * s.length;
  return Math.max(s.length / T.cps * 1000, read) + (speech || i === beats.length - 1 ? T.holdMs : T.beatGapMs);
}
/** How long a line stays up, every beat of it: `line` is one beat or a list of them. */
export const lineMs = (line, speech, T = TUNING) =>
  [line].flat().reduce((ms, s, i, beats) => ms + beatMs(beats, i, speech, T), 0);

// His answers to being skipped.
const SKIPPED = 'progress.skipped', QUIETER = 'progress.quieter';

/**
 * `events` is `dialogue/crow.json`. `rng` returns floats in [0, 1). `onLog` hears every decision
 * as `{ t, type, key, ... }` — the harness's transcript, and nothing in the game needs it.
 */
export function createCrow({ events, rng, memory, tuning = TUNING, onLog = () => {} }) {
  const T = tuning, mem = memory.data, RANK = rankTable(events);
  for (const k of [SKIPPED, QUIETER]) if (!(k in events)) throw new Error(`crow: no event "${k}"`);
  let now = 0;
  // Fired and not yet decided, and once-only lines waiting their turn (`waiting`).
  let wants = [], dueAt = null;
  let cur = null, faceOnly = null;
  let monoUntil = -Infinity;
  const gapUntil = new Map();
  const saidSitting = new Set(), faced = new Set();
  let saidVisit = new Set();
  let talk = TALK.indexOf(T.talkStart);
  let recent = [];

  const scopeKey = (key, once, ctx) => once === 'room' ? `${key}@${ctx.room}` : key;
  function said(key, once, ctx) {
    if (once === 'sitting') return saidSitting.has(key);
    if (once === 'visit') return saidVisit.has(key);
    return !!mem.said[scopeKey(key, once, ctx)];
  }
  const played = key => (mem.count[key] ?? 0) > 0 || faced.has(key);
  const resolve = (key, ctx) => events[`${key}.act${ctx.act}`] ? `${key}.act${ctx.act}` : key;

  function stepOf(e, ctx) {
    if (!e.byCount) return { lines: e.lines, face: e.face, bag: '' };
    const n = ctx.count ?? 1;
    let i = 0;
    e.byCount.forEach((s, k) => { if (s.from <= n) i = k; });
    return { lines: e.byCount[i].lines, face: e.byCount[i].face, bag: `#${i}` };
  }

  const isMono = v => Array.isArray(v);
  // A variant is remembered by its first line, so the bag survives the file being reordered.
  const firstOf = v => [v].flat()[0];

  // `pick` narrows it, for a monologue that has to wait.
  function draw(bagKey, lines, pick) {
    const ok = lines.map((v, i) => i).filter(i => pick(lines[i]));
    const bag = mem.bags[bagKey] ?? [];
    let fresh = ok.filter(i => !bag.includes(firstOf(lines[i])));
    if (!fresh.length) {
      mem.bags[bagKey] = bag.filter(s => !ok.some(i => firstOf(lines[i]) === s));
      fresh = ok.length > 1 ? ok.filter(i => firstOf(lines[i]) !== bag.at(-1)) : ok;
    }
    return fresh[Math.floor(rng() * fresh.length)];
  }

  const stale = (c, at) => c.rank.lasts.timed && at - c.t > T.momentMs;

  /** Why a candidate cannot start at `at`, or null when it can. */
  function gate(c, at) {
    const e = events[c.key];
    if (e.once && said(c.key, e.once, c.ctx)) return 'said';
    if (stale(c, at)) return 'stale';
    if (e.after && !played(e.after)) return 'after';
    if (c.rank.gap && (gapUntil.get(c.key) ?? -Infinity) > at) return 'gap';
    if (monoUntil > at && stepOf(e, c.ctx).lines.every(isMono)) return 'mono';
    if (c.rank.chance && played(c.key) && rng() >= T.repeatChance[TALK[talk]]) return 'chance';
    if (TALK.indexOf(e.talk) > talk) return 'talk';
    return null;
  }

  function post(key, t, ctx = {}, bySelf = false) {
    const e = events[key];
    if (!e) throw new Error(`crow: no event "${key}"`);
    if (e.stretch) throw new Error(`crow: "${key}" is a stretch event`);
    const c = { key: resolve(key, ctx), ctx, rank: RANK[key], t, bySelf };
    if (events[c.key].once && said(c.key, events[c.key].once, ctx)) return;
    onLog({ t, type: 'fire', key: c.key });
    if (cur) {
      if (events[c.key].once) enqueue(c, t);
      else onLog({ t, type: 'drop', key: c.key, why: 'talking' });
      return;
    }
    wants.push(c);
    // The timer may be set as far out as a waiting monologue's turn.
    dueAt = Math.min(dueAt ?? Infinity, t + T.preWaitMs);
  }

  function enqueue(c, t) {
    if (wants.some(q => q.waiting && q.key === c.key)) return;
    if (!c.waiting) onLog({ t, type: 'queue', key: c.key });
    c.waiting = true;
    wants.push(c);
  }

  function decide(at) {
    dueAt = null;
    const pool = wants;
    wants = [];
    const ready = [], faceless = [];
    let wake = null;
    for (const c of pool) {
      const why = gate(c, at);
      if (!why) ready.push(c);
      else if (why === 'mono' && events[c.key].once) { enqueue(c, at); wake = monoUntil; }
      else {
        if (why === 'talk') faceless.push(c);
        if (why !== 'said') onLog({ t: at, type: 'drop', key: c.key, why });
      }
    }
    ready.sort((a, b) => a.rank.at - b.rank.at || a.t - b.t);
    const [win, ...rest] = ready;
    for (const c of rest) {
      if (events[c.key].once) enqueue(c, at);
      else onLog({ t: at, type: 'drop', key: c.key, why: 'outranked' });
    }
    if (win) start(win, at);
    else if (faceless.length) {
      faceless.sort((a, b) => a.rank.at - b.rank.at);
      const c = faceless[0];
      faceOnly = { key: c.key, face: stepOf(events[c.key], c.ctx).face, until: at + T.faceMs };
      faced.add(c.key);
      if (c.rank.gap) gapUntil.set(c.key, at + T.eventGapMs);
      onLog({ t: at, type: 'face', key: c.key, face: faceOnly.face });
    }
    if (!win && wants.length) dueAt = Math.max(at + T.preWaitMs, wake ?? -Infinity);
  }

  function start(c, at) {
    const e = events[c.key], step = stepOf(e, c.ctx);
    const pick = monoUntil > at ? v => !isMono(v) : () => true;
    const bagKey = c.key + step.bag;
    const i = draw(bagKey, step.lines, pick);
    (mem.bags[bagKey] ??= []).push(firstOf(step.lines[i]));
    const fill = s => s.replace(/\{(\w+)\}/g, (_, k) => {
      if (c.ctx[k] == null) throw new Error(`crow: "${c.key}" was fired without its {${k}}`);
      return String(c.ctx[k]);
    });
    const beats = [step.lines[i]].flat().map(fill);
    if (e.once === 'sitting') saidSitting.add(c.key);
    else if (e.once === 'visit') saidVisit.add(c.key);
    else if (e.once) mem.said[scopeKey(c.key, e.once, c.ctx)] = true;
    mem.count[c.key] = (mem.count[c.key] ?? 0) + 1;
    if (c.rank.gap) gapUntil.set(c.key, at + T.eventGapMs);
    memory.save();
    faceOnly = null;
    cur = { key: c.key, face: step.face, beats, bi: 0, pos: 0, last: at, speed: 1, bySelf: c.bySelf,
      speech: !!e.speech, bag: { key: bagKey, size: step.lines.length } };
    onLog({ t: at, type: 'say', key: c.key, beats, face: step.face, talk: TALK[talk] });
  }

  const typed = () => Math.min(cur.beats[cur.bi].length, Math.floor(cur.pos / 1000 * T.cps));

  function end(at, skipped) {
    const { key, beats, bySelf } = cur;
    cur = null;
    if (beats.length > 1) monoUntil = at + T.monoGapMs;
    onLog({ t: at, type: skipped ? 'skip' : 'end', key });
    if (!bySelf) listened(at, skipped);
    if (wants.length) dueAt = Math.min(dueAt ?? Infinity, at + T.preWaitMs);
  }

  function listened(at, skipped) {
    recent.push(skipped);
    if (recent.length > T.talkUpWindow) recent.shift();
    const share = list => list.filter(Boolean).length / list.length;
    const last = recent.slice(-T.talkWindow);
    if (last.length >= T.talkWindow / 2 && share(last) >= T.talkDown && talk > 0) {
      talk--; recent = [];
      onLog({ t: at, type: 'talk', talk: TALK[talk] });
      post(QUIETER, at, {}, true);
      return;
    }
    if (recent.length === T.talkUpWindow && share(recent) <= T.talkUp && talk < TALK.length - 1) {
      talk++; recent = [];
      onLog({ t: at, type: 'talk', talk: TALK[talk] });
    }
    if (skipped) post(SKIPPED, at, {}, true);
  }

  function advance(t) {
    if (t < now) throw new Error(`crow: time went back from ${now} to ${t}`);
    for (;;) {
      if (cur) {
        const left = (beatMs(cur.beats, cur.bi, cur.speech, T) - cur.pos) / cur.speed;
        const at = cur.last + left;
        if (at > t) { cur.pos += (t - cur.last) * cur.speed; cur.last = t; break; }
        if (++cur.bi < cur.beats.length) { cur.pos = 0; cur.last = at; continue; }
        end(at, false);
        continue;
      }
      if (dueAt !== null && dueAt <= t) { decide(dueAt); continue; }
      break;
    }
    if (faceOnly && faceOnly.until <= t) faceOnly = null;
    now = t;
  }

  function drop(t, ends, why) {
    wants = wants.filter(c => {
      if (!ends(c)) return true;
      onLog({ t, type: 'drop', key: c.key, why });
      return false;
    });
    if (!wants.length) dueAt = null;
  }

  return {
    fire(key, t, ctx) { advance(t); post(key, t, ctx); },
    cue(t) { advance(t); if (!cur && wants.length) { dueAt = t; advance(t); } },
    press(t) {
      advance(t);
      if (!cur) return;
      if (cur.speed === 1) { cur.speed = T.fastX; onLog({ t, type: 'fast', key: cur.key }); }
      else end(t, true);
    },
    arrive(t) { advance(t); saidVisit = new Set(); drop(t, c => c.rank.lasts.arrive, 'left'); },
    rewind(t) { advance(t); drop(t, c => c.rank.lasts.rewind, 'rewound'); },
    /** The full ones left changed: a waiting line that counts them would say the old count. */
    recount(t, left) { advance(t); drop(t, c => 'left' in c.ctx && c.ctx.left !== left, 'recount'); },
    /** What is on screen at `t`. `speech`: a line that takes the whole screen is up, or due. */
    view(t) {
      advance(t);
      if (!cur) return { talking: false, waiting: dueAt !== null || wants.length > 0,
        speech: wants.some(c => events[c.key].speech), face: faceOnly?.face ?? 'closed', text: '' };
      const s = cur.beats[cur.bi], n = typed();
      return { talking: true, speech: cur.speech, key: cur.key, face: cur.face, text: s.slice(0, n),
        line: s, typing: n < s.length, beat: cur.bi, beats: cur.beats.length };
    },
    /** What the director holds, for the debug panel. It reads only, and leaves the clock where `view` put it. */
    peek() {
      const line = cur && (() => {
        const beatLeft = (beatMs(cur.beats, cur.bi, cur.speech, T) - cur.pos) / cur.speed;
        let rest = 0;
        for (let i = cur.bi + 1; i < cur.beats.length; i++) rest += beatMs(cur.beats, i, cur.speech, T);
        rest /= cur.speed;
        return { key: cur.key, face: cur.face, beats: cur.beats, beat: cur.bi, typed: typed(), speed: cur.speed,
          bySelf: cur.bySelf, tier: RANK[cur.key].tier, said: mem.count[cur.key] ?? 0,
          bagLeft: cur.bag.size - (mem.bags[cur.bag.key] ?? []).length, bagSize: cur.bag.size,
          beatLeft, lineLeft: beatLeft + rest };
      })();
      return { now, line, face: faceOnly, dueAt, monoUntil, talk: TALK[talk], chance: T.repeatChance[TALK[talk]],
        recent: [...recent], gaps: [...gapUntil].filter(([, u]) => u > now),
        wants: wants.map(c => ({ key: c.key, t: c.t, waiting: !!c.waiting, timed: c.rank.lasts.timed })) };
    },
    has: key => key in events,
    talk: () => TALK[talk],
  };
}
