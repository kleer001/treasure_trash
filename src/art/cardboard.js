// The cardboard is a square panel torn from a box, lying flat, seen from above.
//   Palette: k ink, c face, r rib, l lit crease, s shade crease, x bare flute, y paper between flutes, f torn fibre.
import { drawingOf } from './pile.js';

export const CARDBOARD_PALETTE = { c: '#dcc6a2', r: '#cfb791', l: '#ecdcbf', s: '#b59c78', x: '#a9957a', y: '#c9b79a', f: '#f3ead8', k: '#19152b' };
export const CARDBOARD_ROWS = [
  '........................',
  '...kk..kkkkkkk...kkkk...',
  '..kxykkxyxyfcckkkcccyk..',
  '.kyxyxyxyxfccccccccccxk.',
  '..kxyxyxyfccccccccccyfk.',
  '..kxyxyxyxfcsssssssssk..',
  '.kyxyxyxyxyfccccccccyfk.',
  '.kyxyxyxyxyxfccccccccxk.',
  '..kxyxyxyxyfccccccccyk..',
  '..kxyxyxyxfccccccccxfk..',
  '.kyxyxyxyxfcccccccccyk..',
  '.kyxyxyxyfccccccccccyxk.',
  '..kxyxyxyxfcccccccccyk..',
  '.kyxyxyxyxyfcccccccccxk.',
  '.kyxyxyxyxyfccccccccyfk.',
  '..kxyxyxyxfcccccccccfk..',
  '..kxyxyxyxfcccccccccyfk.',
  '.kyxyxyxyxyfcccccccccxk.',
  '.kyxyxyxyxyxfcccccccyk..',
  '..kxyxyxyxyfccccccccyxk.',
  '..kxyxyxyxfcccccccccyk..',
  '...kyxyxyxfcckkcccyxk...',
  '....kkkkkkkkk..kkkkk....',
  '........................',
];

/** { w, h, px: [x, y, colour] }, one cell, from its top-left corner. */
export const CARDBOARD = drawingOf(CARDBOARD_ROWS, CARDBOARD_PALETTE);
