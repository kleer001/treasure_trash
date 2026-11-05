// Timing and curve helpers that the clips share. Frames are 60 Hz. Positions are px.
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
/** Returns the degrees over at frame `f`, from 0 to 90. */
export const degAt = (keys, f) => (f <= keys.tip ? 0 : f >= keys.flat ? 90
  : Math.round(90 * ((f - keys.tip) / (keys.flat - keys.tip)) ** 2));
