// Writes levels/gallery.tt: one small room for every piece, every thing a press does to it, and
// every direction, for the Piece Gallery to play in the real game. Each room is checked against
// the rules before it is written: the press must do what the room is named for.
//
//   node tools/gallery.mjs
import { writeFileSync } from 'node:fs';
import { explain } from '../src/rules.js';
import { toState, formatLurd } from '../src/format.js';

const DIRS = ['u', 'd', 'l', 'r'];

// Each room is laid along the press: `at` puts glyphs at places counted from the wall behind him,
// on the room's middle line (`side` moves one line across it). `canal` lays open water across the
// room at those places. `deck` lays a skateboard. `want` is what the rules must answer.
const thing = (o, more = {}) => ({ at: [[1, '@'], [2, o]], ...more });
const pushed = { want: 'moves' }, refused = { want: 'refused' }, stopped = { at: [[3, '#']] };
const join = (a, b) => ({ ...a, ...b, at: [...(a.at ?? []), ...(b.at ?? [])] });
const ROOMS = [
  ['raccoon', 'crawl', { at: [[1, '@']], want: 'moves' }],
  ['raccoon', 'push', join(thing('c'), pushed)],
  ['raccoon', 'refused', join(join(thing('c'), stopped), refused)],
  ['bag', 'rip', join(thing('$'), { want: 'tear' })],
  ['bag', 'rip by water', join(thing('$'), { canal: [3], want: 'tear' })],
  ['bag', 'refused', join(join(thing('$'), stopped), refused)],
  ['can-full', 'tip', join(thing('C'), pushed)],
  ['can-full', 'tip into water', join(thing('C'), { canal: [3], want: 'moves' })],
  ['can-full', 'tip beside water', join(thing('C'), { canal: [4], want: 'moves' })],
  ['can-full', 'refused', join(join(thing('C'), stopped), refused)],
  ['can', 'push', join(thing('c'), pushed)],
  ['can', 'into water', join(thing('c'), { canal: [3], want: 'moves' })],
  ['can', 'refused', join(join(thing('c'), stopped), refused)],
  ['box-full', 'tip', join(thing('B'), pushed)],
  ['box-full', 'refused', join(join(thing('B'), stopped), refused)],
  ['box', 'push', join(thing('b'), pushed)],
  ['box', 'into water', join(thing('b'), { canal: [3], want: 'moves' })],
  ['box', 'refused afloat', join(thing('b'), { canal: [2], want: 'refused' })],
  ['box', 'refused', join(join(thing('b'), stopped), refused)],
  ['jug', 'pour', join(thing('j'), pushed)],
  ['jug', 'refused', join(join(thing('j'), stopped), refused)],
  ['jug-empty', 'push', join(thing('i'), pushed)],
  ['jug-empty', 'into water', join(thing('i'), { canal: [3], want: 'moves' })],
  ['jug-empty', 'refused', join(join(thing('i'), stopped), refused)],
  ['pane', 'shatter', join(thing('g'), pushed)],
  ['pane', 'refused', join(join(thing('g'), stopped), refused)],
  ['wheelie', 'roll', join(thing('w'), pushed)],
  ['wheelie', 'refused', join(join(thing('w'), stopped), refused)],
  ['wheelie-full', 'roll', join(thing('W'), pushed)],
  ['wheelie-full', 'refused', join(join(thing('W'), stopped), refused)],
  ['skate', 'roll', { at: [[1, '@']], deck: [[2, 0], [3, 0]], want: 'moves' }],
  ['skate', 'scoot', { at: [[1, '@']], deck: [[2, 0], [2, -1]], want: 'moves' }],
];

const N = 7, MID = 3;
/** Cell (x, y) of place `a` along the press toward `dir`, `side` lines across it. */
const along = (dir, a, side = 0) => ({ r: [a, MID + side], l: [N - 1 - a, MID + side], d: [MID + side, a], u: [MID + side, N - 1 - a] })[dir];

function room(piece, act, spec, dir) {
  const grid = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) => (x && y && x < N - 1 && y < N - 1 ? '-' : '#')));
  const water = Array.from({ length: N }, () => Array(N).fill('-')), cart = Array.from({ length: N }, () => Array(N).fill('-'));
  const [ex, ey] = along(dir, N - 2, -2);
  grid[ey][ex] = 'E';
  for (const a of spec.canal ?? []) for (let s = -2; s <= 2; s++) { const [x, y] = along(dir, a, s); water[y][x] = '~'; }
  for (const [a, s] of spec.deck ?? []) { const [x, y] = along(dir, a, s); cart[y][x] = 'P'; }
  for (const [a, ch] of spec.at) { const [x, y] = along(dir, a); grid[y][x] = ch; }
  const rows = g => g.map(r => r.join(''));
  const level = { id: 'gallery', grid: rows(grid) };
  if (spec.canal) level.water = rows(water);
  if (spec.deck) level.cart = rows(cart);
  const r = explain(toState(level), dir, { trace: true });
  const got = !r.ok ? 'refused' : r.kind === 'tear' ? 'tear' : 'moves';
  if (got !== spec.want) throw new Error(`${piece} · ${act} · ${dir}: the rules answer ${r.ok ? r.kind : r.reason}, the room wants ${spec.want}`);
  level.solve = r.ok ? formatLurd([{ dir, kind: r.kind }]) : dir;
  return level;
}

const out = [':pack   Treasure Trash — the Piece Gallery (bench pack, never shipped)', ''];
let n = 0;
for (const [piece, act, spec] of ROOMS) for (const dir of DIRS) {
  const level = room(piece, act, spec, dir);
  out.push(`:level  G${n++}`, `:name   ${piece} · ${act} · ${dir}`, ':par    1', `:solve  ${level.solve}`, ':grid', ...level.grid, ':end');
  if (level.water) out.push(':water', ...level.water, ':end');
  if (level.cart) out.push(':cart', ...level.cart, ':end');
  out.push('');
}
writeFileSync(new URL('../levels/gallery.tt', import.meta.url), out.join('\n'));
console.log(`levels/gallery.tt: ${n} rooms`);
