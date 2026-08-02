// Animation timelines — pure functions of elapsed milliseconds. No canvas, no clock, no
// requestAnimationFrame: the caller owns "now" and passes it in, which is what makes every
// curve in here testable without a browser.
//
// Three timelines share this module because they share one property: none of them is game
// state. A refusal never changes the board, a move animation only remembers where the
// pieces WERE, and the confetti is decoration over a room already won.

import { mulberry32 } from './rng.js';
import { BAG, CAN_FULL, CAN_EMPTY } from './rules.mjs';
import { REFUSAL_MS, WIN_MS, CONFETTI, CONFETTI_COLOURS } from './theme.js';

export const easeOut = t => 1 - Math.pow(1 - t, 3);

/**
 * Eased progress of a timed animation.
 * @returns {number|null} 0..1 while running, null once it has played out.
 */
export const progress = (elapsed, duration) =>
  elapsed >= duration ? null : easeOut(elapsed / duration);

// ---------------------------------------------------------------- the refusal
// THE STATE NEVER CHANGES. The raccoon lunges, the bag bursts, the debris reaches the cell
// that won't take it, everything flashes, and the whole thing rewinds itself. The player
// spends no move and is never left in a position they have to escape — the invalid overlap
// is a frame in a rejection, not a board state.

/** Which refusal has something to show: a bag bursts, a can lunges, everything else knocks. */
export const refusalKindFor = o =>
  o === BAG ? 'tear' : (o === CAN_FULL || o === CAN_EMPTY) ? 'push' : 'bump';

export const refusalDuration = (kind) => {
  const d = REFUSAL_MS[kind];
  return d.lunge + d.burst + d.hold + d.rewind;
};

/**
 * Where a refusal has got to.
 * @returns {{lunge:number, burst:number, flash:number}|null} null once it is over.
 */
export function refusalPhase(kind, elapsed) {
  const d = REFUSAL_MS[kind];
  const t1 = d.lunge, t2 = t1 + d.burst, t3 = t2 + d.hold, t4 = t3 + d.rewind;
  if (elapsed < t1) return { lunge: elapsed / t1, burst: 0, flash: 0 };
  if (elapsed < t2) return { lunge: 1, burst: d.burst ? (elapsed - t1) / d.burst : 1, flash: 0 };
  if (elapsed < t3) return { lunge: 1, burst: 1, flash: 1 };
  if (elapsed < t4) { const k = 1 - (elapsed - t3) / d.rewind; return { lunge: k, burst: k, flash: 0 }; }
  return null;
}

// ---------------------------------------------------------------- the win
// Seeded from the level, never Math.random() — a replay of the same room throws the same
// confetti. It is cosmetic, so the seed only has to be stable, not secret.

/** One burst of confetti, deterministic in `seed`. */
export function makeConfetti(seed) {
  const rnd = mulberry32(seed);
  const [slow, fast] = CONFETTI.speed;
  return Array.from({ length: CONFETTI.count }, () => {
    const a = rnd() * Math.PI * 2, sp = slow + rnd() * (fast - slow);
    return {
      vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - CONFETTI.lift,
      colour: CONFETTI_COLOURS[(rnd() * CONFETTI_COLOURS.length) | 0],
      w: 4 + rnd() * 7, h: 3 + rnd() * 6, rot: rnd() * 6.3, spin: (rnd() - 0.5) * 16,
    };
  });
}

/** Where one bit of confetti is `t` seconds in, under gravity. Offsets from the burst point. */
export const confettiAt = (bit, t) => ({
  dx: bit.vx * t,
  dy: bit.vy * t + 0.5 * CONFETTI.gravity * t * t,
  rot: bit.rot + bit.spin * t,
});

/** Fades on the way out so the hand-over to the next room is not a cut. */
export const confettiAlpha = t =>
  Math.min(1, Math.max(0, (WIN_MS / 1000 - t) / CONFETTI.fade));
