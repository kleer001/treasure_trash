// Animation timelines as pure functions of elapsed milliseconds. No canvas, no clock.

import { mulberry32 } from './rng.js';
import { BAG, CAN_FULL, CAN_EMPTY } from './rules.mjs';
import { REFUSAL_MS, WIN_MS, CONFETTI, CONFETTI_COLOURS } from './theme.js';

export const easeOut = t => 1 - Math.pow(1 - t, 3);

/** Eased 0..1 progress, or null once the duration has elapsed. */
export const progress = (elapsed, duration) =>
  elapsed >= duration ? null : easeOut(elapsed / duration);

/** Which refusal animation suits the occupant in the way. */
export const refusalKindFor = o =>
  o === BAG ? 'tear' : (o === CAN_FULL || o === CAN_EMPTY) ? 'push' : 'bump';

export const refusalDuration = (kind) => {
  const d = REFUSAL_MS[kind];
  return d.lunge + d.burst + d.hold + d.rewind;
};

/** Refusal state as { lunge, burst, flash }, or null once it has rewound. */
export function refusalPhase(kind, elapsed) {
  const d = REFUSAL_MS[kind];
  const t1 = d.lunge, t2 = t1 + d.burst, t3 = t2 + d.hold, t4 = t3 + d.rewind;
  if (elapsed < t1) return { lunge: elapsed / t1, burst: 0, flash: 0 };
  if (elapsed < t2) return { lunge: 1, burst: d.burst ? (elapsed - t1) / d.burst : 1, flash: 0 };
  if (elapsed < t3) return { lunge: 1, burst: 1, flash: 1 };
  if (elapsed < t4) { const k = 1 - (elapsed - t3) / d.rewind; return { lunge: k, burst: k, flash: 0 }; }
  return null;
}

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

/** Offset and rotation of one confetti bit `t` seconds into the burst. */
export const confettiAt = (bit, t) => ({
  dx: bit.vx * t,
  dy: bit.vy * t + 0.5 * CONFETTI.gravity * t * t,
  rot: bit.rot + bit.spin * t,
});

export const confettiAlpha = t =>
  Math.min(1, Math.max(0, (WIN_MS / 1000 - t) / CONFETTI.fade));
