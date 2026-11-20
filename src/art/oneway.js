// The one-way is a double chevron painted on the floor, seen from above.
//   p paint, s worn paint
import { pixelsOf } from './pile.js';
const PALETTE = { p: '#e3c35a', s: '#b8913a' };
const ROWS = [
  '........................',
  '........................',
  '........................',
  '........................',
  '...pps.....ppp..........',
  '....ppp.....pps.........',
  '.....ppp.....p.p........',
  '......psp.....ppp.......',
  '.......ppp.....ppp......',
  '........pp......pps.....',
  '.........ppp.....ppp....',
  '..........ppp.....psp...',
  '..........pps.....ppp...',
  '.........ppp.....ppp....',
  '........s.p.....ppp.....',
  '.......ppp.....pps......',
  '......ppp.....ppp.......',
  '.....pps.....s.p........',
  '....ppp.....ppp.........',
  '...psp.....ppp..........',
  '........................',
  '........................',
  '........................',
  '........................',
];
const N = ROWS.length;
const R = pixelsOf(ROWS, PALETTE);
const turned = f => ({ w: N, h: N, px: R.map(([x, y, c]) => [...f(x, y), c]) });

/** Each facing, `{ w, h, px: [x, y, colour] }`, one cell from its top-left corner. */
export const ONEWAY = {
  r: turned((x, y) => [x, y]),
  l: turned((x, y) => [N - 1 - x, y]),
  d: turned((x, y) => [N - 1 - y, x]),
  u: turned((x, y) => [y, N - 1 - x]),
};
