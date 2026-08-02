// The board on screen: one canvas, one compositor, one ticker for all three animations.

import { createCompositor } from './compositor.js';
import { boardLayers } from './layers.js';
import { DIRS, TEAR, PUSH, NONE, cell, fan, forEachCell } from './rules.mjs';
import { BOARD, MOVE_MS, WIN_MS } from './theme.js';
import { makeConfetti, progress, refusalKindFor, refusalPhase } from './anim.js';

/**
 * @param {object} opts
 * @param {HTMLCanvasElement} opts.canvas
 * @param {object} opts.session the play session to draw.
 * @param {object} opts.audio the sound boundary; `refuse` fires on the refusal flash.
 * @param {Function} opts.onWinDone called once the confetti has cleared.
 * @param {Function} [opts.onFrame] called after every composited frame.
 * @param {Function} [opts.now] millisecond clock, injected so timelines can be driven in a test.
 */
export function createView({ canvas, session, audio, onWinDone, onFrame = () => {}, now = () => performance.now() }) {
  if (!canvas || typeof canvas.getContext !== 'function') {
    throw new Error('createView() requires a <canvas> element');
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const scene = createCompositor(boardLayers());
  let refusal = null, motion = null, confetti = null, raf = 0;
  let seen = new Set();

  const api = {
    get busy() { return Boolean(refusal || motion || confetti); },

    /** New room: drop every animation and let refusals play in full again. */
    reset() {
      api.cancel();
      seen = new Set();
      return api;
    },

    cancel() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0; refusal = motion = confetti = null;
      return api;
    },

    /** Lunge, burst, flash and rewind. The board never changes. */
    playRefusal({ dir, reason, target }) {
      const [dx, dy] = DIRS[dir];
      const bx = session.state.rac.x + dx, by = session.state.rac.y + dy;
      const first = refusalKindFor(target);
      const key = `${first}:${reason}`;
      const kind = seen.has(key) ? 'bump' : first;
      seen.add(key);
      refusal = {
        kind, dx, dy, bx, by, t0: now(), beeped: false,
        cells: kind === 'tear' ? fan(bx, by, dx, dy) : [],
      };
      start();
    },

    /**
     * Animate an accepted action. The board is already the new one, so this only
     * remembers where the pieces were; `hide` names the cells it draws itself.
     */
    playMotion({ dir, kind, from }) {
      const to = session.state;
      const [dx, dy] = DIRS[dir];
      const bx = from.rac.x + dx, by = from.rac.y + dy;
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
        forEachCell(to, (c, x, y) => {
          if (c.o === NONE || c.o === cell(from, x, y).o) return;
          m.hide.add(`${x},${y}`);
          m.parts.push({ what: 'piece', o: c.o, from: [bx, by], to: [x, y] });
        });
      }
      motion = m;
      start();
    },

    /** Seeded from the room, so a replay throws the same confetti. */
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
