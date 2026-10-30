// The office chair, side view, back to the left.
//   k ink, a base, m metal, M metal lit, b back, c seat, d seat lit, e shine
const PALETTE = { k: '#19152b', a: '#262440', m: '#67819e', M: '#9aa2a9', b: '#244287', c: '#3169b0', d: '#7dafb3', e: '#f1eccb' };
const TOP = [
  '..kkkk................',
  '.kbceck...............',
  '.kbbbck...............',
  '.kbbbck...............',
  '..kbbbck..............',
  '..kbbbck..............',
  '..kbbbck..............',
  '..kbbbck..............',
  '..kbbbck..............',
  '..kbbbck..............',
  '...kbbbck.............',
  '...kbbbck.............',
  '...kaakk..............',
  '...kaaakkkkkkkkkkkk...',
  '....kcddddddddddddck..',
  '....kcccccccccccccbk..',
  '....kcccccccccccccbk..',
  '.....kkaaaaaaaakkkk...',
  '.......kkkMmkkk.......',
];
const STEM = '.........kMmk.........';
const BASE = [
  '........kaaaak........',
  '..kkkkkkkaaaakkkkkkk..',
  '.kmmmmmmmmmmmmmmmmmmk.',
  '.kaaaaaaaaaaaaaaaaaak.',
  '.kmakkkkkkmakkkkkkmak.',
  '.kaak....kaak....kaak.',
  '..kk......kk......kk..',
];
export const STEM_ROWS = 3;

/** The chair with its stem `stem` rows long: { w, h, px: [x, y, colour] }. */
export function chair(stem = STEM_ROWS) {
  const rows = [...TOP, ...Array(stem).fill(STEM), ...BASE];
  return { w: rows[0].length, h: rows.length,
    px: rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === '.' ? [] : [[x, y, PALETTE[c]]]))) };
}
export const CHAIR = chair();
