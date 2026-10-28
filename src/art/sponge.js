// The sponge, drawn by hand: a block standing on its cell, seen from the side, its holes dark on
// the edge the face shades and lit on the far wall.
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

/** { w, h, px: [x, y, colour] }, its bottom row on the ground. */
export const SPONGE = { w: ROWS[0].length, h: ROWS.length,
  px: ROWS.flatMap((r, y) => [...r].flatMap((c, x) => (c === '.' ? [] : [[x, y, PALETTE[c]]]))) };
