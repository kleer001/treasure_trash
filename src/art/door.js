// The exit: a roller shutter under an EXIT sign. Shut, it is slats; lit, the shutter rolls up
// into its housing and the light of the next room shimmers in the opening.
//
// Pixels are [x, y, colour] from the cell's top-left. The sign stands RISE rows above the cell.
export const RISE = 9;
// The look of the door, in pixels, 60 Hz frames and pixels a second. `light` runs from the top
// of the opening to the bottom. A sine `amp` pixels high bends its bands; `wave` and `waveY` are
// its lengths across and down, and it travels `speedX` to the right and `speedY` up.
export const LOOK = {
  roll: 12,
  amp: 1, wave: 18, waveY: 12, speedX: 0, speedY: 6,
  light: ['#ffffff', '#f1eccb', '#e3c35a', '#e3c35a'],
};

const INK = '#19152b', FRAME = '#262440', SLAT = '#453d51', SLAT_LIT = '#67819e', HOUSING = '#67819e',
  HOUSING_TOP = '#7dafb3', SIGN_DARK = '#1d3b2c', WORD_DARK = '#2e5d44', SIGN_LIT = '#2e9e5b', WORD_LIT = '#f1eccb';

const LETTERS = {
  E: ['###', '#..', '##.', '#..', '###'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
};
const TOP = 2, OPEN_TOP = 5, BOTTOM = 22, LEFT = 3, RIGHT = 20;

/** The door `open` of the way up (0 shut, 1 open), `frame` frames into the shimmer. */
export function door(open, frame = 0, look = LOOK) {
  const px = [];
  const fill = (x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px.push([x + i, y + j, c]); };
  const lit = open > 0;
  fill(0, -RISE, 24, 1, INK);
  fill(0, 1 - RISE, 1, 23 + RISE, INK);
  fill(23, 1 - RISE, 1, 23 + RISE, INK);
  fill(1, 1 - RISE, 22, 23 + RISE, FRAME);
  fill(LEFT, 3 - RISE, 18, 7, lit ? SIGN_LIT : SIGN_DARK);
  [...'EXIT'].forEach((ch, i) => LETTERS[ch].forEach((row, r) => [...row].forEach((c, k) => {
    if (c === '#') px.push([5 + i * 4 + k, 4 - RISE + r, lit ? WORD_LIT : WORD_DARK]);
  })));
  if (!lit) {
    for (let y = TOP; y < BOTTOM; y++) fill(LEFT, y, 18, 1, y % 2 ? SLAT : SLAT_LIT);
    fill(LEFT, BOTTOM, 18, 1, FRAME);
    return px;
  }
  fill(LEFT, TOP, 18, OPEN_TOP - TOP, HOUSING);
  fill(LEFT, TOP, 18, 1, HOUSING_TOP);
  // The slats left below the housing ride up with the shutter's bottom edge.
  const rows = BOTTOM - OPEN_TOP + 1, hang = Math.round((1 - Math.min(1, open)) * rows), lift = rows - hang;
  for (let y = OPEN_TOP; y < OPEN_TOP + hang; y++) fill(LEFT, y, 18, 1, (y + lift) % 2 ? SLAT : SLAT_LIT);
  if (hang) fill(LEFT, OPEN_TOP + hang - 1, 18, 1, FRAME);
  const n = look.light.length, t = frame / 60;
  for (let y = OPEN_TOP + hang; y <= BOTTOM; y++) for (let x = LEFT; x <= RIGHT; x++) {
    const along = (x - LEFT - look.speedX * t) / look.wave + (y - OPEN_TOP + look.speedY * t) / look.waveY;
    const bent = y - OPEN_TOP + look.amp * Math.sin(2 * Math.PI * along);
    px.push([x, y, look.light[Math.max(0, Math.min(n - 1, Math.floor((bent * n) / rows)))]]);
  }
  return px;
}
