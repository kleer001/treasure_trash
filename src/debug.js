// The development surface, behind `?debug`: a play-by-play for a person to read, and a probe for
// a driver to query. Presentation only, and strictly downstream — both read what the game already
// produced. Nothing in here decides anything about a move.
//
// It takes its element at the boundary the way `progress` takes its store, so what it writes
// can be read by a plain object in a test.
import { OCCUPANTS, restsOn } from './rules.js';
import { census } from './stage.js';
import { CART_LANE, laneDepth } from './handles.js';

// An occupant reads back under the name rules.js gives it, so a line here and a branch there
// call the same thing the same thing. Derived rather than listed: a code added to the engine
// is named here without anyone remembering to come back for it.
const NAME = Object.fromEntries(Object.entries(OCCUPANTS)
  .filter(([, v]) => typeof v === 'number').map(([k, v]) => [v, k]));
const named = o => NAME[o] ?? `?${o}`;
const at = ([x, y]) => `${x},${y}`;
const cart = n => `cart#${n}`;

const rests = m =>
  (m.becomes.o !== m.o ? ` becomes ${named(m.becomes.o)}` : '')
  + (m.becomes.lane === CART_LANE && m.becomes.ref !== m.ref ? ` into ${cart(m.becomes.ref)}` : '')
  + (m.parent != null ? ` in ${cart(m.parent)}` : '')
  + (laneDepth(m.becomes.lane) ? ` @${laneDepth(m.becomes.lane)}` : '');

const span = e => `${e.o === null ? '' : named(e.o)}${e.ref === null ? '' : `#${e.ref}`} ${e.handle}`
  + (e.cells.length > 1 ? ` ${e.cells.map(at).join(' ')}` : '');

/** One traced step, as lines. */
const linesOf = step => {
  const out = [];
  if (step.impact) out.push('impact');
  for (const m of step.moved)
    out.push(`${span(m)}->${at(restsOn(m))}` + rests(m) + (m.effect ? ` ${m.effect}` : ''));
  for (const s of step.spawned)
    out.push(`+${span(s)}` + (s.from ? ` from ${at(s.from)}` : '')
      + (s.parent != null ? ` in ${cart(s.parent)}` : '') + (s.effect ? ` ${s.effect}` : ''));
  for (const g of step.gone)
    out.push(`-${span(g)}` + (g.effect ? ` ${g.effect}` : ''));
  return out;
};

/**
 * `el` is the scrolling log. `cap` bounds the DOM: a session is thousands of moves and the
 * interesting one is the last one.
 */
export function createDebugLog(el, cap = 240) {
  const add = (head, lines, cls) => {
    const e = document.createElement('div');
    e.className = cls ? `e ${cls}` : 'e';
    const h = document.createElement('b');
    h.textContent = head;
    e.append(h);
    if (lines.length) e.append(lines.join('\n'));
    el.append(e);
    while (el.childElementCount > cap) el.firstElementChild.remove();
    el.scrollTop = el.scrollHeight;
  };
  return {
    /** A move that landed. */
    action(n, dir, from, r) {
      add(`${n} ${dir} ${r.kind}`,
        [`rac ${at([from.x, from.y])}->${at([r.next.rac.x, r.next.rac.y])}`,
          ...r.steps.flatMap(linesOf)]);
    },
    /** A move that did not. */
    refused(dir, r) {
      add(`- ${dir} refused: ${r.reason}`, r.blame.map(b => `blame ${at(b)}`), 'no');
    },
    note(text) { add(text, [], 'mark'); },
    /** Which way things face after a press: what the board does not hold, so it is told apart. */
    decor(d) {
      add('facing', [...(d ?? [])].map(([h, { heading, lie }]) =>
        `${h} ${heading ?? '-'}${lie ? ` lies ${lie}` : ''}`));
    },
  };
}


/**
 * The probe: what a driver asks the running game, instead of looking at it.
 *
 * A screenshot answers "what is on the canvas" in pixels somebody then has to interpret, and it
 * cannot say what the board underneath believes.
 *
 * `matrix.mjs` lands steps on a stage directly. Everything between an arrow key and that call —
 * the input handler, the timeline, the animation frame that walks it — is only ever exercised by
 * the page, and is where a step that names nothing goes unnoticed and a step naming a piece that
 * was never built throws.
 *
 * `read` is how it reaches the game: main.js owns the state and hands over the questions rather
 * than the variables, so the probe cannot build a stage the game would not have built.
 */
export function createProbe(read) {
  const errors = [];
  // The throw that matters happens inside an animation frame, where nothing is awaiting it: it
  // reaches no caller and shows up here or nowhere.
  addEventListener('error', e => errors.push(e.message ?? String(e.error)));
  addEventListener('unhandledrejection', e => errors.push(String(e.reason)));

  const check = () => {
    const mine = census(read.stage()), theirs = census(read.refStage());
    return {
      level: read.level(), moves: read.moves(), won: read.won(),
      agree: JSON.stringify(mine) === JSON.stringify(theirs),
      drawnButGone: mine.filter(k => !theirs.includes(k)),
      onBoardButUndrawn: theirs.filter(k => !mine.includes(k)),
      errors: [...errors],
    };
  };

  // A beat is checked where the player would see it and not mid-slide. Bounded: a stuck animation is a result, not a hang.
  const settled = (limit = 600) => new Promise(done => {
    let n = 0;
    const spin = () => (read.idle() || ++n > limit) ? done(n <= limit) : requestAnimationFrame(spin);
    spin();
  });

  return {
    check,
    grid: () => read.grid(),
    /** Which way things face, by handle: `[handle, { heading, lie }]` pairs. */
    decor: () => [...(read.decor() ?? [])],
    /** A person debugging by hand gets sound back with this. */
    mute: v => read.mute(v),
    /**
     * Returns one
     * record per key, and stops at the first beat that disagrees or throws — after that the stage
     * and the board have already parted company and every later record says the same thing twice.
     */
    async walk(keys) {
      read.mute(true);                 // a sweep is thousands of beats; every refusal in them buzzes
      const out = [];
      for (const k of keys) {
        const key = KEYNAME[k];
        if (!key) throw new Error(`walk: '${k}' is not a direction`);
        press(key);
        const rested = await settled();
        const r = { key: k, ...check(), rested };
        out.push(r);
        if (!r.agree || r.errors.length || !rested) break;
      }
      return out;
    },

    /**
     * Drive a plan from `tools/sweep.mjs`.
     *
     * The plan says what is worth pressing; this says whether the screen kept up with it. A run
     * that stops short stopped on a fault, so the meetings past that point were never had — they
     * come back as `missed` rather than being quietly dropped from the count.
     */
    async sweep(plan) {
      const out = [];
      for (const room of plan) {
        for (let i = 0; i < room.runs.length; i++) {
          const run = room.runs[i];
          if (!this.goto(room.id)) { out.push({ room: room.id, error: 'no such room in this pack' }); break; }
          const beats = await this.walk(run.keys);
          const bad = beats.find(b => !b.agree || b.errors.length || !b.rested);
          const reached = beats.length;
          out.push({
            room: room.id, run: i + 1, keys: run.keys.length, walked: reached,
            ok: !bad,
            had: run.covers.filter(c => c.after <= reached).flatMap(c => c.had),
            missed: run.covers.filter(c => c.after > reached).flatMap(c => c.had),
            fault: bad ? { key: bad.key, atBeat: reached, errors: bad.errors,
                           drawnButGone: bad.drawnButGone,
                           onBoardButUndrawn: bad.onBoardButUndrawn } : null,
          });
        }
      }
      return {
        runs: out.length,
        meetings: out.reduce((n, r) => n + (r.had?.length ?? 0), 0),
        unmet: out.flatMap(r => r.missed ?? []),
        clean: out.every(r => r.ok),
        faults: out.filter(r => !r.ok || r.error),
        lines: out.map(r => `${r.room}#${r.run} ${r.walked}/${r.keys} keys`
          + ` ${r.had?.length ?? 0} meetings${r.ok ? '' : ' FAULT'}`),
      };
    },

    /** The animation clock: stop it, step it on by `n` 60 Hz frames, or let it run again. */
    hold: () => read.hold(),
    step: (n = 1) => read.step(n),
    run: () => read.run(),
    idle: () => read.idle(),

    /** False when the pack has no such id. */
    goto(id) {
      for (let i = 0; i < LEVEL_SEARCH && read.level() !== id; i++) press('>');
      if (read.level() !== id) return false;
      press('r');
      return true;
    },
  };
}

// A full turn round it is the most any search of it can need.
const LEVEL_SEARCH = 400;
const press = key => dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

// The solve alphabet the level files are written in. A `.sol` says which shoves are shoves by
// capitalising them, and the keyboard has no such distinction.
const KEYNAME = {
  u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight',
  U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight',
};
