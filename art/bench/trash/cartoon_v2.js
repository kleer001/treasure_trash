// The raccoon, cartoon, in three views. From the side the body is drawn in four shapes (squash,
// normal, gather, stretch), and every frame places body, head, tail and feet by hand, the legs drawn
// from the hip down to where the frame puts the foot; facing left is the mirror. From the front
// and the back every frame is a list of whole parts and where each goes, in drawing order.
//
// Every frame of an action carries a beat. `rest` is the sit before the press. `windup` plays only
// from the sit, unless the frame says `always`: a press that comes while he is still settling skips
// it. `move` is the travel the board makes in one game step. `tail` is the settle back to the sit,
// and the next press cuts it. Holds are whole 60 Hz ticks where they can be (17, 33, 50, 67 ms).

import { ART } from '../../../src/art/raccoon.js';

export const W = 44, H = 18;
const GROUND = H - 1;

/** Rows `rows` with the pixels `[x, y, colour]` changed. */
const swap = (rows, list) => rows.map((r, y) => [...r].map((c, x) => list.find(([px, py]) => px === x && py === y)?.[2] ?? c).join(''));
/** Rows `rows` with the box `[x0, y0, x1, y1]` moved by `dx, dy`, cleared where it was. */
const shift = (rows, [x0, y0, x1, y1], dx, dy) => {
  const g = rows.map(r => [...r]), box = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (rows[y][x] !== '.') box.push([x, y, rows[y][x]]);
  for (const [x, y] of box) g[y][x] = '.';
  for (const [x, y, c] of box) if (g[y + dy]?.[x + dx] !== undefined) g[y + dy][x + dx] = c;
  return g.map(r => r.join(''));
};
const ghost = (rows, ch) => rows.map(r => r.replace(/[^.]/g, ch));
const flip = rows => rows.map(r => [...r].reverse().join(''));
/** Rows `rows` with each column `x` raised by `lift[x]` px, on `extra` new rows at the top. */
const curl = (rows, lift, extra) => {
  const w = rows[0].length, g = Array.from({ length: rows.length + extra }, () => Array(w).fill('.'));
  rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') g[y + extra - (lift[x] ?? 0)][x] = c; }));
  return g.map(r => r.join(''));
};
/** Rows `rows` with columns `at` to `at + n - 1` drawn twice, `n` px longer. */
const widen = (rows, at, n) => rows.map(r => r.slice(0, at + n) + r.slice(at, at + n) + r.slice(at + n));

const HEAD = [
  '...aa........',
  '..alla.......',
  '..adlaaaa....',
  '.aiiiiiiia...',
  'aiiiiiiiiia..',
  'aiiimmmmiiia.',
  'akdddddddiia.',
  'akddmadddkka.',
  'aikddddddkkaa',
  'aaikkkkkkjka.',
  '..aiiiiiiaa..',
  '..aaaaaaa....',
];
const earsBack = h => ['.............', '..aaa........', '.alldaaaa....', ...h.slice(3)];
const blink = h => swap(h, [[4, 7, 'd'], [5, 7, 'e']]);
const squint = h => swap(h, [[4, 7, 'm'], [5, 7, 'm']]);
const wide = h => swap(h, [[3, 7, 'm'], [4, 7, 'a'], [5, 7, 'm'], [4, 6, 'm']]);

const FRONT_HEAD = swap([
  '..aa........aa..',
  '.alll......llla.',
  '.lddlfiiiiflddl.',
  '.ldeiiiiiiiiedla',
  '.afhiiiiiiiiijfa',
  '.ahhmmliilkmiia.',
  '.fikddddddddkia.',
  'aikddaddddaddiha',
  'akddaaddddaaddka',
  '.iddddkbbkddddja',
  '..iddkkkbkkddaa.',
  '..aaaajjjjaaaa..',
], [[4, 7, 'm'], [11, 7, 'm']]);
const flat = rows => ['................', '.aal........laa.', ...rows.slice(2)];
const frontBlink = h => swap(h, [[4, 7, 'd'], [5, 7, 'd'], [10, 7, 'd'], [11, 7, 'd'], [4, 8, 'e'], [5, 8, 'e'], [10, 8, 'e'], [11, 8, 'e']]);
const frontWide = h => swap(h, [[4, 7, 'm'], [6, 7, 'm'], [5, 6, 'm'], [9, 7, 'm'], [11, 7, 'm'], [10, 6, 'm']]);
// The front face at the side head's size, to turn to the viewer on the side body.
const FRONT_SMALL = frontWide(FRONT_HEAD).map(r => r.slice(1, 15)).map((r, y) => (y >= 2 && y <= 9 ? 'a' + r.slice(1, 13) + 'a' : r));

// The side sit: the head is the box from column 9 to 21, rows 0 to 10.
const SIDE_HEAD_BOX = [9, 0, 21, 10];
const sideEar = rows => ['......................', '...........aaa........', rows[2].slice(0, 9) + '.alldaaaa....', ...rows.slice(3)];
const SIDE = ART.SIDE_ART;
const BACK_SKULL = ART.BACK_ART.slice(0, 12).map(r => r.slice(0, 16));

const TAIL_LOW = ['....aaaaaaa', '..aallddlld', '.addllddlld', '.addllddlld', '..aaaaaaaaa'];
const BACK_TAIL = ['.aa.', 'adda', 'aiia', 'adda', 'aiia', 'adda', 'aiia', '.aa.'];
const NORMAL = [
  '...aaaaaa......',
  '.aaggggggaaa...',
  'aggggggggggfaa.',
  'agggggggggggffa',
  'aggggggggggggfa',
  'afgggggggggiila',
  'afggggggggiiiia',
  '.affffffffffffa',
  '..aaaaaaaaaaaa.',
];

const PARTS = {
  // From the side, sitting: the sprite, and its idle beats.
  sit: SIDE,
  sitBlink: swap(SIDE, [[13, 7, 'd'], [14, 7, 'e']]),
  sitWide: swap(SIDE, [[12, 7, 'm'], [13, 7, 'a'], [14, 7, 'm'], [13, 6, 'm']]),
  sitEar: sideEar(SIDE),
  sitFlick: shift(SIDE, [0, 2, 4, 5], 2, -1),
  sitSniff: shift(SIDE, [17, 6, 21, 10], 1, -1),
  sitLook: shift(SIDE, SIDE_HEAD_BOX, 1, 1),
  sitTilt: shift(SIDE, SIDE_HEAD_BOX, 0, 1),
  sideBody: shift(SIDE, SIDE_HEAD_BOX, 0, 40),
  // From the side, low: the head and its faces, the body's four shapes, the tail.
  head: HEAD,
  headBack: earsBack(HEAD),
  headStrain: squint(earsBack(HEAD)),
  headBlink: blink(HEAD),
  headWide: wide(HEAD),
  headAway: flip(blink(earsBack(HEAD))),
  frontSmall: FRONT_SMALL,
  ghostHead: ghost(HEAD, 'f'),
  normal: NORMAL,
  stretch: widen(NORMAL, 6, 2),
  gather: [
    '...aaaaa....',
    '..aggggga...',
    '.agggggggaa.',
    'agggggggggga',
    'agggggggggga',
    'aggggggggiia',
    'afgggggggiia',
    'afggggggfiia',
    '.afffffffffa',
    '..aaaaaaaaa.',
  ],
  squash: [
    '...aaaaaaaa.....',
    '.aaggggggggaaa..',
    'agggggggggggggaa',
    'agggggggggggggga',
    'afggggggggggiiia',
    'affgggggggggfiia',
    '.afffffffffffffa',
    '..aaaaaaaaaaaaa.',
  ],
  tailLow: TAIL_LOW,
  tailCurve: curl(TAIL_LOW, [3, 3, 2, 1, 1], 3),
  tailUp: [
    '.aaa.....',
    'addda....',
    'allllaa..',
    '.addddda.',
    '..alllla.',
    '...addda.',
    '....aaa..',
  ],
  tailPuff: [
    'a.a.a....',
    '.addda.a.',
    'adddddaa.',
    'alllllla.',
    '.adddddda',
    '..allllla',
    '...addda.',
    '....aaa..',
  ],
  dust: ['.i.', 'ili', '.i.'],
  dustSmall: ['i.', '.i'],
  pip: ['m.m', '.m.', 'm.m'],
  // From the front: the head and its faces, the haunches it sits on, and for the low frames the
  // hump of the back over the head, the shoulders, a chest between the fore legs, legs by length,
  // and the paws that grip a thing's rim in front of it.
  frontHead: FRONT_HEAD,
  frontHeadBlink: frontBlink(FRONT_HEAD),
  frontHeadStrain: flat(swap(FRONT_HEAD, [[4, 7, 'd'], [5, 7, 'd'], [10, 7, 'd'], [11, 7, 'd'], [4, 8, 'm'], [5, 8, 'm'], [10, 8, 'm'], [11, 8, 'm']])),
  frontHeadBack: flat(FRONT_HEAD),
  frontHeadEar: ['..aa............', '.alll.......aaa.', ...FRONT_HEAD.slice(2)],
  frontHeadWide: frontWide(FRONT_HEAD),
  frontHeadSniff: swap(FRONT_HEAD, [[7, 8, 'b'], [8, 8, 'b'], [7, 9, 'k'], [8, 9, 'k'], [7, 7, 'b'], [8, 7, 'b']]),
  frontHeadYawn: swap(frontBlink(FRONT_HEAD), [[6, 10, 'a'], [7, 10, 'c'], [8, 10, 'c'], [9, 10, 'a'], [7, 11, 'c'], [8, 11, 'c']]),
  frontSitBody: [
    '.afggiiggiiggfa.',
    'afgggiiggiigggfa',
    'afgggiiggiigggfa',
    'afgggiiggiigggfa',
    'aeeeaddaaddaeeea',
    '.aaa.aa..aa.aaa.',
  ],
  frontSitTail: ['.aa.', 'adda', 'alla', 'adda', 'alla', 'aaa.'],
  hump: ['...aaaaaa...', '.aaggggggaa.', 'agggggggggga', 'agggggggggga', 'agggggggggga'],
  shoulderL: ['.aa', 'agg', 'agg', 'afg', '.aa'],
  shoulderR: ['aa.', 'gga', 'gga', 'gfa', 'aa.'],
  chest: ['aaaaaaaaaa', 'afffccfffa', 'afffccfffa', 'afffccfffa', 'afffccfffa', 'aaaaaaaaaa'],
  tailTip: ['.aa.', 'adda', 'aiia', 'adda', '.aa.'],
  tailTipPuff: ['a..a', '.aa.', 'adda', 'aiia', 'adda', 'aiia', '.aa.'],
  leg1: ['alla', 'aaaa'],
  leg2: ['aiia', 'alla', 'aaaa'],
  leg3: ['aiia', 'aiia', 'alla', 'aaaa'],
  leg4: ['aiia', 'aiia', 'aiia', 'alla', 'aaaa'],
  rimPaw: ['.aa.', 'alla', 'aaaa'],
  // From the back: the back sprite to sit, and for the low frames its skull over a round rump, the
  // tail hanging down the rump or curled up one side, the hind feet flat or kicking up their soles.
  backSit: ART.BACK_ART,
  backSitEar: ['..aa...............', '.adda.......aaa....', ...ART.BACK_ART.slice(2)],
  backSitTail: ART.BACK_TAIL,
  backBody: ART.BACK_ART.map((r, y) => (y < 12 ? '.'.repeat(r.length) : r)),
  backHead: BACK_SKULL,
  skull: BACK_SKULL.slice(0, 10),
  skullFlat: ['................', '.aaa........aaa.', ...BACK_SKULL.slice(2, 10)],
  rump: [
    '....aaaaaa....',
    '..aaggggggaa..',
    '.afggggggggfa.',
    'affggggggggffa',
    'affggggggggffa',
    '.afffggggfffa.',
    '..aaaaaaaaaa..',
  ],
  backTailDown: BACK_TAIL,
  backTailUp: ['.aa..', 'adda.', 'aiia.', 'adda.', 'aiiia', '.adda', '.aiia', '..aa.'],
  backTailPuff: ['a.aa.a', '.adda.', 'adddda', 'aiiiia', 'adddda', '.aiia.', '.adda.', '..aa..'],
  foot: ['adda', 'aaaa'],
  sole: ['akka', 'alla', 'aaaa'],
};

/** A leg as a line from `[x0, y0]` to `[x1, y1]`: `fill` along it, a 2 px `paw` at the end, outlined. */
function limb([x0, y0], [x1, y1], fill, paw) {
  const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)), core = new Map();
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + (x1 - x0) * i / n), y = Math.round(y0 + (y1 - y0) * i / n);
    for (const [ox, oy] of i === n ? [[0, 0], [1, 0], [0, 1], [1, 1]] : [[0, 0]]) core.set(`${x + ox},${y + oy}`, [x + ox, y + oy, i === n ? paw : fill]);
  }
  const edge = new Map();
  for (const [x, y] of core.values()) for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const k = `${x + ox},${y + oy}`;
    if (!core.has(k)) edge.set(k, [x + ox, y + oy, 'a']);
  }
  return [...edge.values(), ...core.values()];
}

// Each body shape: where the hind and fore legs leave it, and the row they start on.
const HIPS = {
  normal: { hind: 3, fore: 10, row: 7 }, stretch: { hind: 3, fore: 12, row: 7 },
  gather: { hind: 2, fore: 8, row: 8 }, squash: { hind: 3, fore: 12, row: 6 },
};
const LEGS = {
  fore: { near: { fill: 'i', paw: 'd', w: 2 }, far: { fill: 'f', paw: 'c', w: 2 } },
  hind: { near: { fill: 'f', paw: 'd', w: 2 }, far: { fill: 'e', paw: 'c', w: 2 } },
};
// The tail's root, in its own px, so a frame sets it against the body's rump.
const ROOT = { tailLow: [10, 2], tailCurve: [10, 5], tailUp: [6, 5], tailPuff: [7, 6] };
// The rump on each body shape, and where the head sits against its shoulder.
const RUMP = { normal: [1, 3], stretch: [1, 3], gather: [1, 3], squash: [1, 3] };
const NECK = { normal: [11, -3], stretch: [14, -3], gather: [8, -2], squash: [12, -3] };

/** A side frame. `b`: body shape, its x and its top row. `h`: head [face, dx from the neck, dy].
 *  `t`: tail [shape, dy]. `feet`: [offset, lift] near fore, far fore, near hind, far hind.
 *  `o.smear` draws a ghost of the head 2 px behind it; `o.dust` and `o.fx` go on top. */
const F = (name, ms, dx, [body, bx, by], [head, hdx, hdy], [tail, tdy], feet, o = {}) => {
  const [rx, ry] = RUMP[body], [nx, ny] = NECK[body], [ox, oy] = ROOT[tail];
  by += 2;
  const hx = bx + nx + hdx, hy = by + ny + hdy;
  return { name, ms, dx, thing: o.thing, always: o.always, body: [body, bx, by], head: [head, hx, hy],
    tail: [tail, bx + rx - ox, by + ry - oy + tdy], feet, smear: o.smear ? ['ghostHead', hx - 2, hy] : null,
    dust: o.dust ?? [], fx: o.fx ?? [] };
};
const P = [0, 0], PLANT = [P, P, P, P];
/** A sit: `under` is drawn beneath the sprite `art`, `top` over it. */
const sitting = (name, ms, dx, thing, art, o) => ({ name, ms, dx, thing, seated: true, parts: [...(o.under ?? []), ...art, ...(o.top ?? [])] });
/** The side sit, the raccoon's rest, centred as the game centres it. */
const S = (name, ms, dx, thing, art = 'sit', o = {}) => sitting(name, ms, dx, thing, [[art, 11, 0]], o);

const as = beat => fs => fs.map(f => ({ ...f, beat }));
const rest = f => ({ ...f, beat: 'rest' });
const windup = as('windup'), move = as('move'), after = as('tail');
const recovery = (name, fs) => after(fs).map(f => ({ ...f, recovery: name }));
/** The recoveries after a push held fast; a run of refusals takes them in turn. */
export const RECOVERIES = ['look', 'shake', 'hmph', 'puff'];
const idleBeat = (name, fs) => fs.map(f => ({ ...f, beat: 'idle', idle: name }));
const shakes = make => [-1, 1, -1, 1].map((d, k) => make(k % 2 ? 'shakeR' : 'shakeL', d));

// The side push's contact: the nose on the can's edge, the spark just past it.
const SPARK = ['pip', 40, 10];
const SIDE_ACTIONS = {
  // Hunker, smear forward, one patter, land 1 px past the mark, settle back, rise to the sit.
  crawl: [
    rest(S('sit', 200, 0)),
    ...windup([F('hunker', 33, 0, ['squash', 14, 6], ['headBack', 0, 1], ['tailUp', 0], PLANT)]),
    ...move([
      F('launch', 33,  6, ['stretch', 13, 5], ['headBack', 1, 0], ['tailCurve', 0], [[2, 1], [1, 1], [-3, 1], [-2, 1]], { smear: true }),
      F('patter', 33, 14, ['normal', 14, 4], ['head', 0, 0], ['tailCurve', 0], [[2, 1], [-2, 0], [-2, 0], [2, 1]]),
      F('land',   44, 25, ['squash', 14, 6], ['head', 1, 1], ['tailUp', -1], [[2, 0], [2, 0], [-2, 0], [-2, 0]]),
    ]),
    ...after([
      F('settle', 50, 24, ['normal', 14, 5], ['headBack', 0, 0], ['tailCurve', 0], PLANT),
      F('rise',   67, 24, ['gather', 15, 4], ['head', 0, -1], ['tailUp', 0], PLANT),
      S('sit', 300, 24),
    ]),
  ],
  // Back off, slam the head in with a spark, drive it across on the hind feet, thud it 1 px past
  // its mark, pop back.
  push: [
    rest(S('sit', 200, 0, 0)),
    ...windup([F('windup', 33, -2, ['squash', 14, 6], ['headBack', -1, 0], ['tailUp', 0], [P, P, [-1, 0], [-1, 0]], { thing: 0 })]),
    ...move([
      F('slam',  33, -1, ['stretch', 13, 5], ['headStrain', 0, 0], ['tailCurve', 0], [[0, 0], [1, 0], [-3, 0], [-2, 0]], { thing: 0, fx: [SPARK], dust: [['dust', 9, 15]] }),
      F('drive', 33, 11, ['stretch', 13, 5], ['headStrain', 0, 0], ['tailCurve', 1], [[1, 1], [-1, 0], [-1, 1], [-4, 0]], { thing: 12, dust: [['dustSmall', 10, 16]] }),
      F('thud',  44, 25, ['squash', 14, 6], ['headStrain', 0, 0], ['tailUp', -1], [[1, 0], [1, 0], [-2, 0], [-2, 0]], { thing: 25 }),
    ]),
    ...after([
      F('pop',  50, 23, ['normal', 14, 5], ['headBack', 0, -1], ['tailCurve', 0], PLANT, { thing: 24 }),
      F('rise', 67, 24, ['gather', 15, 4], ['head', 0, -1], ['tailUp', 0], PLANT, { thing: 24 }),
      S('sit', 300, 24, 24),
    ]),
  ],
  // The same slam, then a hold where nothing moves; he strains, bounces off it wide-eyed, lands,
  // plays one recovery, and sits with an ear down before it pricks up again.
  stuck: [
    rest(S('sit', 200, 0, 0)),
    ...windup([F('windup', 33, -2, ['squash', 14, 6], ['headBack', -1, 0], ['tailUp', 0], [P, P, [-1, 0], [-1, 0]], { thing: 0, always: true })]),
    ...move([
      F('slam', 33, 0, ['stretch', 13, 5], ['headStrain', 0, 0], ['tailCurve', 0], [[0, 0], [1, 0], [-3, 0], [-2, 0]], { thing: 1, fx: [['pip', 41, 10]] }),
      F('hold', 77, -1, ['stretch', 13, 5], ['headStrain', 0, 0], ['tailCurve', 0], [[0, 0], [1, 0], [-3, 0], [-2, 0]], { thing: 0 }),
    ]),
    ...after([
      F('strainA', 50, -1, ['stretch', 13, 6], ['headStrain', 0, -1], ['tailLow', 0], [[1, 0], [1, 0], [-3, 0], [-3, 0]], { thing: 0, dust: [['dust', 9, 15]] }),
      F('strainB', 50, -1, ['stretch', 13, 5], ['headStrain', 0, 0], ['tailLow', 0], [[1, 0], [1, 0], [-3, 0], [-3, 0]], { thing: 0, dust: [['dustSmall', 10, 16]] }),
      F('bounce',  50, -4, ['stretch', 13, 4], ['headWide', -1, -1], ['tailUp', 0], [[-3, 1], [-2, 1], [2, 2], [3, 2]], { thing: 0 }),
      F('land',    33, -3, ['squash', 14, 6], ['headWide', 0, 1], ['tailUp', 0], PLANT, { thing: 0 }),
    ]),
    ...recovery('look', [F('look', 200, -3, ['normal', 14, 5], ['frontSmall', 0, 0], ['tailCurve', 0], PLANT, { thing: 0 })]),
    ...recovery('shake', shakes((n, d) => F(n, 50, -3, ['normal', 14, 5], ['head', d, 0], [d < 0 ? 'tailLow' : 'tailUp', 0], PLANT, { thing: 0 }))),
    ...recovery('hmph', [F('hmph', 167, -3, ['normal', 14, 5], ['headAway', -2, 2], ['tailUp', 0], PLANT, { thing: 0 })]),
    ...recovery('puff', [F('puff', 133, -3, ['normal', 14, 5], ['headWide', 0, 0], ['tailPuff', 0], PLANT, { thing: 0 })]),
    ...after([
      F('rise', 67, -1, ['gather', 15, 4], ['head', 0, -1], ['tailUp', 0], PLANT, { thing: 0 }),
      S('earDown', 117, 0, 0, 'sitEar'),
      S('sit', 300, 0, 0),
    ]),
  ],
};

// The side scratch: a hind foot up from the haunch to behind the ear, the head tilted down to it.
const scratch = (name, ms, to) => S(name, ms, 0, undefined, 'sitTilt', { top: [['limb', [16, 12], to, 'i', 'd']] });
SIDE_ACTIONS.idle = [
  ...idleBeat('blink', [S('flash', 50, 0, undefined, 'sitWide'), S('blink', 117, 0, undefined, 'sitBlink')]),
  ...idleBeat('ear', [S('ear', 100, 0, undefined, 'sitEar'), S('sit', 83, 0), S('ear', 100, 0, undefined, 'sitEar')]),
  ...idleBeat('flick', [S('flick', 100, 0, undefined, 'sitFlick'), S('sit', 83, 0), S('flick', 100, 0, undefined, 'sitFlick')]),
  ...idleBeat('sniff', [S('sniff', 100, 0, undefined, 'sitSniff'), S('sit', 83, 0), S('sniff', 100, 0, undefined, 'sitSniff'), S('sit', 83, 0)]),
  ...idleBeat('look', [S('look', 500, 0, undefined, 'sitLook')]),
  ...idleBeat('scratch', [scratch('lift', 67, [18, 6]),
    ...[1, 2, 3].flatMap(() => [scratch('scratch', 50, [20, 1]), scratch('scratch', 50, [21, 2])]), scratch('lower', 67, [18, 6])]),
];

// The front and back parts' left edge in the frame, so they stand centred as the sit does.
const X = 14;
// The front push's paws on the thing's rim, drawn over the thing.
const RIM = [['rimPaw', X + 1, 13], ['rimPaw', X + 11, 13]];
/** From the front, low: the hump `hump` px over the head, the head `hy` from the top, a fore leg of
 *  length `lh` and `rh` each side of the chest. */
const front = (name, ms, dx, hy, [lh, rh], o = {}) => ({ name, ms, dx, thing: o.thing, always: o.always, parts: [
  ...(o.tail === undefined ? [] : o.tail === 'puff' ? [['tailTipPuff', X + 13, hy + 2]] : [['tailTip', X + 13, hy + 5 + o.tail]]),
  ['hump', X + 2, hy - (o.hump ?? 1)],
  ...(o.shoulders ? [['shoulderL', X - 1, hy + 5], ['shoulderR', X + 14, hy + 5]] : []),
  ['chest', X + 3, H - 6],
  [`leg${lh}`, X + 3 - (o.splay ?? 0), H - lh - 1], [`leg${rh}`, X + 9 + (o.splay ?? 0), H - rh - 1],
  [o.head ?? 'frontHead', X + (o.hx ?? 0), hy],
], over: o.over ?? [], dust: o.dust ?? [], fx: o.fx ?? [] });
const frontSit = (name, ms, dx, thing, head = 'frontHead', o = {}) => sitting(name, ms, dx, thing,
  [['frontSitTail', X + 15 + (o.flick ?? 0), 11 - (o.flick ?? 0)], ['frontSitBody', X, 12], [head, X + (o.hx ?? 0), 0]], o);
/** From the back, low: the rump's top on row `ry`, the ears and the top of the skull over it, the
 *  hind feet `lf` and `rf`. The rump sways `sway` px; the tail swings `wag` px the other way, a frame
 *  behind it. */
const back = (name, ms, dx, ry, [lf, rf], o = {}) => {
  const sway = o.sway ?? 0, s = o.splay ?? 0, wag = o.wag ?? 0;
  const tail = { up: ['backTailUp', X - 1 + sway, ry - 6], stiff: ['backTailDown', X + 6 + sway, ry - 7],
    puff: ['backTailPuff', X + 5 + sway, ry - 7] }[o.tail] ?? ['backTailDown', X + 6 - wag, ry + 1];
  return { name, ms, dx, thing: o.thing, always: o.always, parts: [
    o.head ? [o.head, X + 1 + (o.hx ?? 0), ry - 9] : [o.skull ?? 'skull', X + (o.hx ?? 0), ry - 5 + (o.bow ?? 0)],
    ...[[lf, X + 2 - s], [rf, X + 10 + s]].map(([f, x]) => [f, x + sway, H - PARTS[f].length]),
    ['rump', X + 1 + sway, ry],
    tail,
  ], dust: o.dust ?? [], fx: o.fx ?? [] };
};
const backSit = (name, ms, dx, thing, art = 'backSit', o = {}) => sitting(name, ms, dx, thing,
  [[art, X, 0], ['backSitTail', X - (o.flick ?? 0), -(o.flick ?? 0)]], o);
const puff = (x, y, small) => [small ? 'dustSmall' : 'dust', x, y];
const FEET = ['foot', 'foot'], SOLES = ['sole', 'sole'];
// A hind foot raised beside the head to the ear, behind the sprite: from the front, or the back.
const frontLeg = to => [['limb', [X + 15, 13], to, 'i', 'd']];
const backLeg = to => [['limb', [X + 14, 13], to, 'i', 'd']];

/** Every action in every view: `side` faces right, `front` comes down the screen toward the viewer,
 *  `back` goes up it, away. */
export const ACTIONS = {
  side: SIDE_ACTIONS,
  front: {
    crawl: [
      rest(frontSit('sit', 200, 0)),
      ...windup([front('hunker', 33, 0, 6, [2, 2], { splay: 1, hump: 2, head: 'frontHeadBack', tail: -2 })]),
      ...move([
        front('launch', 33,  8, 3, [4, 4], { hump: 0, head: 'frontHeadBack' }),
        front('waddle', 33, 16, 5, [3, 2], { hx: -1, tail: 0 }),
        front('land',   44, 25, 5, [2, 2], { splay: 1, hump: 2, hx: 1, tail: -1 }),
      ]),
      ...after([
        front('settle', 50, 24, 4, [3, 3], { head: 'frontHeadBack', tail: 0 }),
        front('rise',   67, 24, 2, [4, 4], { hump: 0, tail: 0 }),
        frontSit('sit', 300, 24),
      ]),
    ],
    // He rests his chin on the thing's rim, his paws on it and his shoulders up past his cheeks.
    push: [
      rest(frontSit('sit', 200, 0, 0)),
      ...windup([front('windup', 33, -2, 6, [2, 2], { splay: 1, hump: 3, head: 'frontHeadBack', tail: -2, thing: 0 })]),
      ...move([
        front('slam',  33,  6, 4, [4, 4], { head: 'frontHeadStrain', shoulders: true, thing: 0, over: RIM, fx: [['pip', X - 3, 9], ['pip', X + 16, 9]] }),
        front('drive', 33, 18, 4, [3, 2], { hx: -1, head: 'frontHeadStrain', shoulders: true, thing: 12, over: RIM, dust: [puff(X - 3, 14)] }),
        front('thud',  44, 31, 5, [2, 2], { splay: 1, hump: 2, head: 'frontHeadStrain', shoulders: true, thing: 25, over: RIM }),
      ]),
      ...after([
        front('pop',  50, 24, 3, [3, 3], { head: 'frontHeadBack', tail: 0, thing: 24 }),
        front('rise', 67, 24, 2, [4, 4], { hump: 0, tail: 0, thing: 24 }),
        frontSit('sit', 300, 24, 24),
      ]),
    ],
    stuck: [
      rest(frontSit('sit', 200, 0, 0)),
      ...windup([front('windup', 33, -2, 6, [2, 2], { splay: 1, hump: 3, head: 'frontHeadBack', tail: -2, thing: 0, always: true })]),
      ...move([
        front('slam', 33, 6, 4, [4, 4], { head: 'frontHeadStrain', shoulders: true, thing: 1, over: RIM, fx: [['pip', X - 3, 9], ['pip', X + 16, 9]] }),
        front('hold', 77, 6, 4, [4, 4], { head: 'frontHeadStrain', shoulders: true, thing: 0, over: RIM }),
      ]),
      ...after([
        front('strainA', 50, 6, 5, [2, 2], { splay: 1, head: 'frontHeadStrain', shoulders: true, thing: 0, over: RIM, dust: [puff(X - 3, 14)] }),
        front('strainB', 50, 6, 4, [2, 2], { splay: 1, head: 'frontHeadStrain', shoulders: true, thing: 0, over: RIM, dust: [puff(X + 17, 15, 1)] }),
        front('bounce',  50, -2, 2, [4, 4], { hump: 0, head: 'frontHeadWide', thing: 0 }),
        front('land',    33, -1, 5, [2, 2], { splay: 1, hump: 2, head: 'frontHeadWide', tail: -2, thing: 0 }),
      ]),
      ...recovery('look', [front('look', 200, -1, 4, [3, 3], { head: 'frontHeadWide', tail: 0, thing: 0 })]),
      ...recovery('shake', shakes((n, d) => front(n, 50, -1, 4, [3, 3], { hx: d, tail: d > 0 ? 1 : 0, thing: 0 }))),
      ...recovery('hmph', [{ ...frontSit('hmph', 167, -1, 0, 'headAway', { hx: 2 }), seated: false }]),
      ...recovery('puff', [front('puff', 133, -1, 4, [3, 3], { head: 'frontHeadWide', tail: 'puff', thing: 0 })]),
      ...after([
        front('rise', 67, 0, 2, [4, 4], { hump: 0, tail: 0, thing: 0 }),
        frontSit('earDown', 117, 0, 0, 'frontHeadEar'),
        frontSit('sit', 300, 0, 0),
      ]),
    ],
    idle: [
      ...idleBeat('blink', [frontSit('flash', 50, 0, undefined, 'frontHeadWide'), frontSit('blink', 117, 0, undefined, 'frontHeadBlink')]),
      ...idleBeat('ear', [frontSit('ear', 100, 0, undefined, 'frontHeadEar'), frontSit('sit', 83, 0), frontSit('ear', 100, 0, undefined, 'frontHeadEar')]),
      ...idleBeat('flick', [frontSit('flick', 100, 0, undefined, 'frontHead', { flick: 2 }), frontSit('sit', 83, 0), frontSit('flick', 100, 0, undefined, 'frontHead', { flick: 2 })]),
      ...idleBeat('sniff', [frontSit('sniff', 100, 0, undefined, 'frontHeadSniff'), frontSit('sit', 83, 0), frontSit('sniff', 100, 0, undefined, 'frontHeadSniff'), frontSit('sit', 83, 0)]),
      ...idleBeat('look', [frontSit('stare', 500, 0, undefined, 'frontHeadWide')]),
      ...idleBeat('yawn', [frontSit('yawn', 367, 0, undefined, 'frontHeadYawn'), frontSit('blink', 83, 0, undefined, 'frontHeadBlink')]),
      ...idleBeat('scratch', [
        frontSit('lift', 67, 0, undefined, 'frontHead', { under: frontLeg([X + 17, 6]) }),
        ...[1, 2, 3].flatMap(() => [2, 3].map(y => frontSit('scratch', 50, 0, undefined, 'frontHeadBlink', { under: frontLeg([X + 16, y]) }))),
        frontSit('lower', 67, 0, undefined, 'frontHead', { under: frontLeg([X + 17, 6]) }),
      ]),
    ],
  },
  back: {
    crawl: [
      rest(backSit('sit', 200, 0)),
      ...windup([back('hunker', 33, 0, 10, FEET, { splay: 1, bow: 1, tail: 'up' })]),
      ...move([
        back('launch', 33,  8, 8, SOLES, { tail: 'up' }),
        back('wiggle', 33, 16, 9, ['sole', 'foot'], { sway: -1 }),
        back('land',   44, 25, 9, FEET, { splay: 1, sway: 1, wag: 1 }),
      ]),
      ...after([
        back('settle', 50, 24, 9, FEET, { wag: -1 }),
        back('rise',   67, 24, 9, FEET, { bow: -4 }),
        backSit('sit', 300, 24),
      ]),
    ],
    // Rump up, ears flat, head in under the thing's base; the hind feet kick up their soles.
    push: [
      rest(backSit('sit', 200, 0, 0)),
      ...windup([back('windup', 33, -2, 10, FEET, { splay: 1, bow: 1, tail: 'up', thing: 0 })]),
      ...move([
        back('slam',  33, 13, 7, SOLES, { skull: 'skullFlat', thing: 0, dust: [puff(X - 2, 15)] }),
        back('drive', 33, 25, 7, ['sole', 'foot'], { skull: 'skullFlat', sway: 1, thing: 12, dust: [puff(X + 16, 15, 1)] }),
        back('thud',  44, 37, 9, FEET, { splay: 1, tail: 'up', thing: 25 }),
      ]),
      ...after([
        back('pop',  50, 26, 9, FEET, { wag: -1, thing: 24 }),
        back('rise', 67, 24, 9, FEET, { bow: -4, thing: 24 }),
        backSit('sit', 300, 24, 24),
      ]),
    ],
    stuck: [
      rest(backSit('sit', 200, 0, 0)),
      ...windup([back('windup', 33, -2, 10, FEET, { splay: 1, bow: 1, tail: 'up', thing: 0, always: true })]),
      ...move([
        back('slam', 33, 13, 7, SOLES, { skull: 'skullFlat', thing: 1 }),
        back('hold', 77, 13, 7, FEET, { skull: 'skullFlat', thing: 0 }),
      ]),
      ...after([
        back('trembleA', 50, 13, 8, FEET, { skull: 'skullFlat', sway: 1, tail: 'stiff', thing: 0, dust: [puff(X - 2, 15)] }),
        back('trembleB', 50, 13, 8, FEET, { skull: 'skullFlat', sway: -1, tail: 'stiff', thing: 0, dust: [puff(X + 16, 15, 1)] }),
        back('bounce',   50, -2, 7, SOLES, { tail: 'up', thing: 0 }),
        back('land',     33, -1, 10, FEET, { splay: 1, bow: 1, tail: 'up', thing: 0 }),
      ]),
      ...recovery('look', [back('look', 200, -1, 9, FEET, { head: 'headWide', thing: 0 })]),
      ...recovery('shake', shakes((n, d) => back(n, 50, -1, 9, FEET, { hx: d, sway: -d, wag: d > 0 ? 1 : 0, thing: 0 }))),
      ...recovery('hmph', [back('hmph', 167, -1, 9, FEET, { skull: 'skullFlat', bow: 1, thing: 0 })]),
      ...recovery('puff', [back('puff', 133, -1, 9, FEET, { tail: 'puff', thing: 0 })]),
      ...after([
        back('rise', 67, 0, 9, FEET, { bow: -4, thing: 0 }),
        backSit('earDown', 117, 0, 0, 'backSitEar'),
        backSit('sit', 300, 0, 0),
      ]),
    ],
    idle: [
      ...idleBeat('ear', [backSit('ear', 100, 0, undefined, 'backSitEar'), backSit('sit', 83, 0), backSit('ear', 100, 0, undefined, 'backSitEar')]),
      ...idleBeat('flick', [backSit('flick', 100, 0, undefined, 'backSit', { flick: 2 }), backSit('sit', 83, 0), backSit('flick', 100, 0, undefined, 'backSit', { flick: 2 })]),
      ...idleBeat('look', [{ name: 'lookBack', ms: 500, dx: 0, seated: true, parts: [['backBody', X, 0], ['backSitTail', X, 0], ['head', X + 1, 0]] }]),
      ...idleBeat('scratch', [
        backSit('lift', 67, 0, undefined, 'backSit', { under: backLeg([X + 17, 6]) }),
        ...[1, 2, 3].flatMap(() => [2, 3].map(y => backSit('scratch', 50, 0, undefined, 'backSitEar', { under: backLeg([X + 16, y]) }))),
        backSit('lower', 67, 0, undefined, 'backSit', { under: backLeg([X + 17, 6]) }),
      ]),
    ],
  },
};

// The frame between two facings, its head leading: the old body with the new head on it. Facings
// opposite each other cross through a third: right and left through the front, up and down
// through the side.
const CROSS = {
  'r>d': [['sideBody', 11, 0], ['frontHead', 18, 0]],
  'r>u': [['sideBody', 11, 0], ['backHead', 18, 0]],
  'r>l': [['frontSitTail', X + 15, 11], ['frontSitBody', X, 12], ['frontHead', X, 0]],
  'd>r': [['frontSitTail', X + 15, 11], ['frontSitBody', X, 12], ['head', X + 2, 0]],
  'u>r': [['backBody', X, 0], ['backSitTail', X, 0], ['head', X + 1, 0]],
  'd>u': [['sit', 11, 0]],
  'u>d': [['sit', 11, 0]],
};
const OTHER = { r: 'l', l: 'r', u: 'u', d: 'd' };
/** The frames that turn him from facing `from` to facing `to`, each marked with whether it is drawn
 *  mirrored; none when they are the same. */
export function turn(from, to) {
  if (from === to) return [];
  const mirror = from === 'l' || (to === 'l' && from !== 'r');
  const key = mirror ? `${OTHER[from]}>${OTHER[to]}` : `${from}>${to}`;
  return [{ name: 'turn', ms: 67, dx: 0, thing: 0, beat: 'turn', mirror, parts: CROSS[key] }];
}

/** Frame `f` as pixels `{ w, h, px: [[x, y, colour]] }`, facing right. `dust` and `fx` draw the
 *  dust and the sparks, which are the effects, not the raccoon. `layer: 'over'` draws only the
 *  parts that go in front of a thing he pushes. */
export function draw(f, { dust = true, fx = true, layer = 'main' } = {}) {
  const out = new Map();
  const put = (x, y, ch) => {
    if (x < 0 || x >= W || y < 0 || y >= H) throw new Error(`${f.name}: off the frame at ${x},${y}`);
    out.set(`${x},${y}`, [x, y, ART.PAL[ch]]);
  };
  const art = (name, x, y, ...more) => {
    if (name === 'limb') { for (const [px, py, ch] of limb(x, y, ...more)) put(px, py, ch); return; }
    PARTS[name].forEach((row, r) => [...row].forEach((ch, c) => ch !== '.' && put(x + c, y + r, ch)));
  };
  if (layer === 'over') { for (const p of f.over ?? []) art(...p); return { w: W, h: H, px: [...out.values()] }; }
  if (f.parts) for (const p of f.parts) art(...p);
  else {
    if (f.smear) art(...f.smear);
    const [body, bx, by] = f.body, hip = HIPS[body];
    const leg = (kind, side, k) => {
      const L = LEGS[kind][side], [off, lift] = f.feet[k], hx = bx + hip[kind] + (side === 'far' ? 1 : 0), hy = by + hip.row;
      const n = GROUND - lift - hy;
      for (let r = 0; r <= n; r++) {
        const y = hy + r, x = hx + Math.round(off * r / Math.max(1, n));
        if (r === n) { for (let c = -1; c <= L.w; c++) put(x + c, y, 'a'); continue; }
        put(x - 1, y, 'a'); put(x + L.w, y, 'a');
        for (let c = 0; c < L.w; c++) put(x + c, y, r === n - 1 ? L.paw : L.fill);
      }
    };
    leg('fore', 'far', 1); leg('hind', 'far', 3);
    art(...f.tail); art(body, bx, by);
    leg('hind', 'near', 2); leg('fore', 'near', 0);
    art(...f.head);
  }
  for (const p of [...(dust ? f.dust ?? [] : []), ...(fx ? f.fx ?? [] : [])]) art(...p);
  return { w: W, h: H, px: [...out.values()] };
}

/** Pixels `px` facing left instead. */
export const mirror = ({ w, h, px }) => ({ w, h, px: px.map(([x, y, c]) => [w - 1 - x, y, c]) });
