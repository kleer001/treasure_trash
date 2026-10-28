// The broom: a hand broom standing upright, side view. A metal cap, the straw wrapped into a
// handle with wire bands, flaring into a fan stitched once in red and once in blue, ragged at the
// tips.
//   k ink, M cap lit, m cap, n cap shade, w wire, t straw lit, s straw, S straw shade, r red, b blue
const PALETTE = { k: '#19152b', M: '#d6d3b0', m: '#9aa2a9', n: '#67819e', w: '#453d51', t: '#f1eccb', s: '#e3c35a',
  S: '#b8913a', r: '#c8453f', b: '#3169b0' };
const ROWS = [
  '.....kkkk.....',
  '....kMmMnk....',
  '....kmmmnk....',
  '....kwwwwk....',
  '....ktssSk....',
  '....kwwwwk....',
  '....ktssSk....',
  '....ktssSk....',
  '....kwwwwk....',
  '...ktsssSSk...',
  '..ktssssssSk..',
  '..ktsssSssSSk.',
  '.ktsssSssssSk.',
  '.krrrrrrrrrrk.',
  '.ktssSsssSsSk.',
  '.kbbbbbbbbbbk.',
  'ktssSsssSssSSk',
  'ktssSssSsssSSk',
  'ktsSssSssSsSSk',
  'ktsSssSssSssSk',
  'ktsSssSsssSsSk',
  'ktsSsSssSssSSk',
  'ksksSsksSskSsk',
  '.kskkskkskksk.',
  '..k..k..k..k..',
];

/** { w, h, px: [x, y, colour] }, standing on its tips. */
export const BROOM = { w: ROWS[0].length, h: ROWS.length,
  px: ROWS.flatMap((r, y) => [...r].flatMap((c, x) => (c === '.' ? [] : [[x, y, PALETTE[c]]]))) };
