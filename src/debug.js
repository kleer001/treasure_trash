// The development surface, behind `?debug`: a play-by-play for a person to read, and a probe for
// a driver to query. Presentation only, and strictly downstream — both read what the game already
// produced. Nothing in here decides anything about a move.
//
// It takes its element at the boundary the way `progress` takes its store, so what it writes
// can be read by a plain object in a test.
import { OCCUPANTS } from './rules.js';
import { census } from './stage.js';

// An occupant reads back under the name rules.js gives it, so a line here and a branch there
// call the same thing the same thing. Derived rather than listed: a code added to the engine
// is named here without anyone remembering to come back for it.
const NAME = Object.fromEntries(Object.entries(OCCUPANTS)
  .filter(([, v]) => typeof v === 'number').map(([k, v]) => [v, k]));
const named = o => NAME[o] ?? `?${o}`;
const at = ([x, y]) => `${x},${y}`;
const cart = n => `cart#${n}`;

// Where a thing came to rest when a cell does not say it: which cart holds it, and how deep in
// what that cart is carrying.
const stow = m =>
  (m.fromCart !== undefined ? ` out of ${cart(m.fromCart)}` : '')
  + (m.toCart !== undefined ? ` into ${cart(m.toCart)}` : '')
  + (m.parent != null && m.toCart === undefined ? ` in ${cart(m.parent)}` : '')
  + (m.wasDepth !== undefined && m.wasDepth !== m.depth ? ` @${m.wasDepth}->${m.depth}`
    : m.depth ? ` @${m.depth}` : '');

/** One traced step, as lines: the piece that travelled, then every mutation it billed. */
const linesOf = step => {
  const out = [];
  // One piece or several — a tow moves a barrow and what it is towing in the same beat. Same
  // shape `applyStep` reads, so a step that carries a list is not read as one piece with no name.
  for (const p of [step.piece ?? []].flat())
    out.push(`${p.kind}#${p.ref} rolls ${at([p.dx, p.dy])}` + (p.effect ? ` ${p.effect}` : ''));
  if (step.impact) out.push('impact');
  for (const m of step.moved)
    out.push(`${named(m.o)} ${at(m.from)}->${at(m.to)}`
      + (m.becomes !== undefined ? ` becomes ${named(m.becomes)}` : '')
      + stow(m) + (m.effect ? ` ${m.effect}` : ''));
  for (const s of step.spawned)
    out.push(`+${named(s.o)} ${at(s.at)}`
      + (s.from ? ` from ${at(s.from)}` : '') + (s.parent != null ? ` in ${cart(s.parent)}` : '')
      + (s.effect ? ` ${s.effect}` : ''));
  for (const g of step.gone)
    out.push(`-${named(g.o)} ${at(g.at)}` + (g.depth ? ` @${g.depth}` : ''));
  for (const b of step.born)
    out.push(`*${b.kind}#${b.ref} ${named(b.o)} ${b.cells.map(at).join(' ')}`);
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
    /** A move that landed: where he ended up, then what it did to the board. */
    action(n, dir, from, r) {
      add(`${n} ${dir} ${r.kind}`,
        [`rac ${at([from.x, from.y])}->${at([r.next.rac.x, r.next.rac.y])}`,
          ...r.steps.flatMap(linesOf)]);
    },
    /** A move that did not: the engine's own reason, and the cells it blamed. */
    refused(dir, r) {
      add(`- ${dir} refused: ${r.reason}`, r.blame.map(b => `blame ${at(b)}`), 'no');
    },
    note(text) { add(text, [], 'mark'); },
  };
}


/**
 * The probe: what a driver asks the running game, instead of looking at it.
 *
 * A screenshot answers "what is on the canvas" in pixels somebody then has to interpret, and it
 * cannot say what the board underneath believes. The stage already knows where every sprite is
 * going, and `census` is the same roll `tools/matrix.mjs` compares — so the question worth asking
 * is the one that tool asks, put to the REAL loop: does the stage the animation left behind hold
 * the same sprites as a stage built fresh from the board?
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

  // A frame at a time until the game says it is at rest, so a beat is checked where the player
  // would see it and not mid-slide. Bounded: a stuck animation is a result, not a hang.
  const settled = (limit = 600) => new Promise(done => {
    let n = 0;
    const spin = () => (read.idle() || ++n > limit) ? done(n <= limit) : requestAnimationFrame(spin);
    spin();
  });

  return {
    check,
    grid: () => read.grid(),
    /** Sound is off from the first `walk` on; a person debugging by hand gets it back with this. */
    mute: v => read.mute(v),
    /**
     * Press each key through the page's own handler and check the beat it lands. Returns one
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
     * Drive a plan from `tools/sweep.mjs`: every run of every room, each beat checked, and the
     * meetings each run was there to cause reported by name.
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

    /** Step the picker round to a room and start it clean. False when the pack has no such id. */
    goto(id) {
      for (let i = 0; i < LEVEL_SEARCH && read.level() !== id; i++) press('>');
      if (read.level() !== id) return false;
      press('r');
      return true;
    },
  };
}

// The pack wraps, so a full turn round it is the most any search of it can need.
const LEVEL_SEARCH = 400;
const press = key => dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

// The solve alphabet the level files are written in. Upper case is the same direction: a `.sol`
// says which shoves are shoves by capitalising them, and the keyboard has no such distinction.
const KEYNAME = {
  u: 'ArrowUp', d: 'ArrowDown', l: 'ArrowLeft', r: 'ArrowRight',
  U: 'ArrowUp', D: 'ArrowDown', L: 'ArrowLeft', R: 'ArrowRight',
};
