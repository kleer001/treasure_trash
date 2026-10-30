// The grate: a drain grating in the floor, seen from above.
//   k ink, a pit rim, b frame, c bar, d bar lit
const PALETTE = { k: '#19152b', a: '#3a3d42', b: '#4a4f57', c: '#67819e', d: '#8a9099' };
const ROWS = [
  'bbbbbbbbbbbbbbbbbbbbbbb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bdddddddddddddddddddddb.',
  'bcccccccccccccccccccccb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bdddddddddddddddddddddb.',
  'bcccccccccccccccccccccb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bdddddddddddddddddddddb.',
  'bcccccccccccccccccccccb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bkkkkkkkkkkkkkkkkkkkkkb.',
  'bbbbbbbbbbbbbbbbbbbbbbb.',
  '........................',
];

/** { w, h, px: [x, y, colour] }, one cell, from its top-left corner. */
export const GRATE = { w: ROWS[0].length, h: ROWS.length,
  px: ROWS.flatMap((r, y) => [...r].flatMap((c, x) => (c === '.' ? [] : [[x, y, PALETTE[c]]]))) };
