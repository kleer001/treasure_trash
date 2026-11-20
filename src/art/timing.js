// Timing, easing, angle and clamp helpers that the clips share. Positions are px.
import { DIRS } from '../rules.js';
export const FRAME_RATE = 60;
export const FRAME_MS = 1000 / FRAME_RATE;
export const onTwos = f => f - (f % 2);
export const evenEnd = end => end + (end % 2);
export const quadOut = u => 1 - (1 - u) ** 2;
/** `h` is the height of a flight at its middle. `u` is how far through the flight, from 0 to 1. */
export const arc = (u, h) => h * 4 * u * (1 - u);
/** The `tip` and `flat` keys of a fall, as frames counted from the start of a move. `moveFrames` is the length of the move in frames. */
export const fallKeys = (moveFrames, k) => {
  const tip = Math.max(0, moveFrames + k.tip);
  return { tip, flat: tip + Math.max(2, k.fall) };
};
/** Returns the degrees over at frame `f`, from 0 to 90. `power` is the exponent of the fall's curve. */
export const degAt = (keys, f, power = 2) => (f <= keys.tip ? 0 : f >= keys.flat ? 90
  : Math.round(90 * ((f - keys.tip) / (keys.flat - keys.tip)) ** power));
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const radians = deg => deg * Math.PI / 180;
/** `[cos, sin]` of `deg`, exact at the quarter turns, so a turned sprite keeps its straight edges. */
export function cosSin(deg) {
  const d = ((deg % 360) + 360) % 360;
  return d === 0 ? DIRS.r : d === 90 ? DIRS.d : d === 180 ? DIRS.l : d === 270 ? DIRS.u
    : [Math.cos(radians(d)), Math.sin(radians(d))];
}
