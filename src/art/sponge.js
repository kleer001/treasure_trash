// The sponge, drawn by hand: a block standing on its cell, seen from the side, its holes dark on
// the edge the face shades and lit on the far wall.
import { stretch } from './stretch.js';

const PALETTE = { k: '#19152b', a: '#6f5a2e', b: '#b8913a', c: '#e3c35a', d: '#f1eccb' };
const ROWS = [
  '....kkkkkkkkkkkkkkkk....',
  '..kkccbbbbbbbbbbcccckk..',
  '.kddddddddddddddddddddk.',
  '.kcccccccccccccccaaccck.',
  '.kcccccccccaaacccabccck.',
  '.kccaaaccccaabcccccccck.',
  '.kccaabcccccccacccaacck.',
  '.kccccccccaccccccccabck.',
  '.kcccaaccccccccccccccck.',
  '.kcccccccccccccaaacccck.',
  '.kccccccaaaacccaabcccck.',
  '.kccccccaaabcccccccacck.',
  '.kcacccccccccaaccccccck.',
  '.kcccccccccccccccccccck.',
  '..kbbbbbbbbbbbbbbbbbbk..',
  '...kkkkkkkkkkkkkkkkkk...',
];

export { PALETTE as SPONGE_PALETTE };

/** Its size in px and how far it stands off the middle of its cell's foot. */
export const SPONGE_LOOK = { w: 23, h: 21, dx: 0, dy: -1 };
/** The drawing at `look`'s size, as rows. */
export const spongeRows = ({ w, h }) => stretch(ROWS, h, 3, 2).map(r => stretch([...r], w, 3, 3).join(''));

/** { w, h, dx, dy, px: [x, y, colour] }, its bottom row on the ground. */
export function spongeSprite(look) {
  const rows = spongeRows(look);
  return { w: look.w, h: look.h, dx: look.dx, dy: look.dy,
    px: rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === '.' ? [] : [[x, y, PALETTE[c]]]))) };
}
export const SPONGE = spongeSprite(SPONGE_LOOK);
