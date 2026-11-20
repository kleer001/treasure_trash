// The grate is a drain grating in the floor, seen from above.
//   k ink, a pit rim, b frame, c bar, d bar lit
import { drawingOf } from './pile.js';
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
export const GRATE = drawingOf(ROWS, PALETTE);
