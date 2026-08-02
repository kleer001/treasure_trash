// The board on screen: one canvas, one compositor, one ticker.
//
// The view owns the three animations and nothing else. It never decides what is legal and
// never mutates a board — it is handed a session event and plays it out. The single ticker
// matters: a refusal, a slide and a win blast all advance from the same frame, so they can
// never fight over the animation handle.

import { createCompositor } from './compositor.js';
import { boardLayers } from './layers.js';
import { DIRS, TEAR, PUSH, NONE, cell, fan } from './rules.mjs';
import { BOARD, MOVE_MS, WIN_MS } from './theme.js';
import { makeConfetti, progress, refusalKindFor, refusalPhase } from './anim.js';

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {object} opts.session the play session to draw.
 * @param {object} opts.audio the sound boundary (`refuse` is fired on the refusal flash).
 * @param {Function} opts.onWinDone called once the confetti has cleared.
 * @param {Function} [opts.onFrame] called after every composited frame — where the HUD hangs.
 * @param {Function} [opts.now] millisecond clock; injected so the timeline can be driven in a test.
 */
export function createView({ canvas, session, audio, onWinDone, onFrame = () => {}, now = () => performance.now() }) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new Error('createView() requires a <canvas> element'); // boundary
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const scene = createCompositor(boardLayers());
  let refusal = null, motion = null, confetti = null, raf = 0;

  // A refusal degrades: the second time you make the same mistake in a room you get the
  // short version, because by then you know. Reset per room, never across the pack.
  let seen = new Set();

  const api = {
    get busy() { return Boolean(refusal || motion || confetti); },

    /** A fresh room: drop every animation and let it explain itself in full again. */
    reset() {
      api.cancel();
      seen = new Set();
      return api;
    },

    /** Stop whatever is playing. Any input does this — nobody waits on decoration. */
    cancel() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; refusal = motion = confetti = null;
      return api;
    },

    /**
     * Play a refusal. THE STATE NEVER CHANGES: the raccoon lunges, the bag bursts, the
     * debris reaches the cell that won't take it, everything flashes, and the whole thing
     * rewinds. The player spends no move and is never left somewhere they must escape.
     */
    playRefusal({ dir, reason, target }) {
      const [dx, dy] = DIRS[dir];
      const bx = session.state.rac.x + dx, by = session.state.rac.y + dy;
      const first = refusalKindFor(target);
      const key = `${first}:${reason}`;
      const kind = seen.has(key) ? 'bump' : first;    // seen it once; don't make them sit through it
      seen.add(key);
      refusal = {
        kind, dx, dy, bx, by, t0: now(), beeped: false,
        cells: kind === 'tear' ? fan(bx, by, dx, dy) : [],
      };
      start();
    },

    /**
     * Play an accepted action. The board is ALREADY the new one by the time this runs, so
     * the animation only remembers where the pieces were — nothing ever teleports. `hide`
     * names the cells whose occupant the animation draws itself, so nothing is painted twice.
     */
    playMotion({ dir, kind, from }) {
      const to = session.state;
      const [dx, dy] = DIRS[dir];
      const bx = from.rac.x + dx, by = from.rac.y + dy;      // the cell he acts into
      const m = {
        t0: now(), dur: MOVE_MS[kind], hide: new Set(), parts: [],
        rac: [from.rac.x, from.rac.y, to.rac.x, to.rac.y],
      };
      if (kind === TEAR) {
        m.parts.push({ what: 'bag', from: [bx, by], to: [bx, by] });
        for (const [tx, ty] of fan(bx, by, dx, dy)) {
          m.hide.add(`${tx},${ty}`);
          m.parts.push({ what: 'trash', from: [tx, ty], to: [tx, ty], src: [bx, by] });
        }
      } else if (kind === PUSH) {
        // Whatever the shove produced, slide it out of the cell that was shoved. Reading the
        // two boards rather than naming the piece keeps this correct for every pushable — a
        // can and its ejected bag, a bin and the trash it drops, a wheelie bin that rolls
        // clean across the room and leaves its bag behind.
        for (let y = 0; y < to.rows; y++) for (let x = 0; x < to.cols; x++) {
          const o = cell(to, x, y).o;
          if (o === NONE || o === cell(from, x, y).o) continue;
          m.hide.add(`${x},${y}`);
          m.parts.push({ what: 'piece', o, from: [bx, by], to: [x, y] });
        }
      }
      motion = m;
      start();
    },

    /**
     * The room is won. Seeded from the room, never Math.random() — the same room throws the
     * same confetti. The reward IS the progression: the blast ends and the next room is up.
     */
    playWin() {
      confetti = {
        t0: now(), x: session.state.rac.x, y: session.state.rac.y,
        bits: makeConfetti(session.index + 1),
      };
      start();
    },

    /** Composite one frame from wherever the animations have got to. */
    render() {
      const s = session.state, t = now();
      canvas.width = s.cols * BOARD.cell;
      canvas.height = s.rows * BOARD.cell;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const phase = refusal ? refusalPhase(refusal.kind, t - refusal.t0) : null;
      scene.render(ctx, {
        width: canvas.width, height: canvas.height,
        state: s,
        // An expired timeline is not a frame to draw — a refusal that has rewound is over,
        // and the board it left behind is the one it started from.
        refusal: phase ? { ...refusal, phase } : null,
        motion: motion ? { ...motion, t: progress(t - motion.t0, motion.dur) ?? 1 } : null,
        blocked: session.blocked,
        armed: session.armed,
        preview: session.preview,
        confetti: confetti ? { ...confetti, t: (t - confetti.t0) / 1000 } : null,
      });
      onFrame();
      return api;
    },
  };

  function start() { if (!raf) raf = requestAnimationFrame(tick); }

  function tick() {
    raf = 0;
    const t = now();
    if (refusal) {
      const phase = refusalPhase(refusal.kind, t - refusal.t0);
      // The "no" sounds on the flash, so the red mark and the beep land together.
      if (phase?.flash && !refusal.beeped) { refusal.beeped = true; audio.refuse(); }
      if (!phase) refusal = null;
    }
    if (motion && progress(t - motion.t0, motion.dur) === null) motion = null;
    if (confetti && t - confetti.t0 >= WIN_MS) { confetti = null; onWinDone(); return; }
    api.render();
    if (api.busy) start();
  }

  return api;
}
