// The raccoon, cartoon, in three views. From the side the body is drawn in four shapes (squash,
// normal, gather, stretch), and every frame places body, head, tail and feet by hand, the legs drawn
// from the hip down to where the frame puts the foot; facing left is the mirror. From the front
// and the back every frame is a list of whole parts and where each goes, in drawing order.

import { ART } from './raccoon.js';

export const W = 44, H = 18;
const GROUND = H - 1;

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
const eye = row => h => h.map((r, y) => (y === 7 ? row : r));
const blink = eye('akdddedddkka.'), squint = eye('akddmmdddkka.');

const FRONT_HEAD = [
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
];
/** Rows `rows` with the pixels `[x, y, colour]` changed. */
const swap = (rows, list) => rows.map((r, y) => [...r].map((c, x) => list.find(([px, py]) => px === x && py === y)?.[2] ?? c).join(''));
const flat = rows => ['................', '.aal........laa.', ...rows.slice(2)];

const sideEar = rows => ['......................', '...........aaa........', rows[2].slice(0, 9) + '.alldaaaa....', ...rows.slice(3)];
const sideFlick = rows => rows.map((r, y) => (y >= 2 && y <= 5 ? '.' + r.slice(0, 5) + r.slice(6) : r));

const PARTS = {
  sit: ART.SIDE_ART,
  sitBlink: swap(ART.SIDE_ART, [[13, 7, 'd'], [14, 7, 'e']]),
  sitEar: sideEar(ART.SIDE_ART),
  sitFlick: sideFlick(ART.SIDE_ART),
  head: HEAD,
  headBack: earsBack(HEAD),
  headStrain: squint(earsBack(HEAD)),
  headBlink: blink(HEAD),
  normal: [
    '...aaaaaa......',
    '.aaggggggaaa...',
    'aggggggggggfaa.',
    'agggggggggggffa',
    'aggggggggggggfa',
    'afgggggggggiila',
    'afggggggggiiiia',
    '.affffffffffffa',
    '..aaaaaaaaaaaa.',
  ],
  stretch: [
    '...aaaaaaaa.......',
    '.aagggggggggaaaa..',
    'agggggggggggggggaa',
    'afgggggggggggggiia',
    'affggggggggggfiiia',
    '.afffffffffffffffa',
    '..aaaaaaaaaaaaaaa.',
  ],
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
  tailLow: [
    '....aaaaaaa',
    '..aallddlld',
    '.addllddlld',
    '.addllddlld',
    '..aaaaaaaaa',
  ],
  tailUp: [
    '.aaa.....',
    'addda....',
    'allllaa..',
    '.adddddа.',
    '..alllla.',
    '...addda.',
    '....aaa..',
  ].map(r => r.replace(/а/g, 'a')),
  dust: ['.k.', 'khk', '.k.'],
  dustSmall: ['k.', '.k'],
  // From the front: the head of the front sprite, the haunches it sits on, and for the low frames
  // the hump of the back over the head, a chest between the fore legs, a leg of each length.
  frontHead: FRONT_HEAD,
  frontHeadBlink: swap(FRONT_HEAD, [[5, 7, 'd'], [10, 7, 'd'], [4, 8, 'e'], [5, 8, 'e'], [10, 8, 'e'], [11, 8, 'e']]),
  frontHeadStrain: flat(swap(FRONT_HEAD, [[5, 7, 'd'], [10, 7, 'd'], [4, 8, 'm'], [5, 8, 'm'], [10, 8, 'm'], [11, 8, 'm']])),
  frontHeadBack: flat(FRONT_HEAD),
  frontHeadEar: ['..aa............', '.alll.......aaa.', ...FRONT_HEAD.slice(2)],
  frontSitBody: [
    '.afggiiggiiggfa.',
    'afgggiiggiigggfa',
    'afgggiiggiigggfa',
    'afgggiiggiigggfa',
    'aeeeaddaaddaeeea',
    '.aaa.aa..aa.aaa.',
  ],
  frontSitTail: ['.aa.', 'adda', 'alla', 'adda', 'alla', 'aaa.'],
  hump: ['...aaaaaaaa...', '.aaggggggggaa.', 'agggggggggggga', 'agggggggggggga', 'agggggggggggga'],
  chest: ['aaaaaaaaaa', 'afffccfffa', 'afffccfffa', 'afffccfffa', 'afffccfffa', 'aaaaaaaaaa'],
  tailTip: ['.aa.', 'adda', 'aiia', 'adda', '.aa.'],
  leg1: ['adda', 'aaaa'],
  leg2: ['aiia', 'adda', 'aaaa'],
  leg3: ['aiia', 'aiia', 'adda', 'aaaa'],
  leg4: ['aiia', 'aiia', 'aiia', 'adda', 'aaaa'],
  // From the back: the back sprite to sit, and for the low frames its skull over a round rump, the
  // tail hanging down the rump or curled up one side, the hind feet flat or kicking up their soles.
  backSit: ART.BACK_ART,
  backSitEar: ['..aa...............', '.adda.......aaa....', ...ART.BACK_ART.slice(2)],
  backSitTail: ART.BACK_TAIL,
  skull: ART.BACK_ART.slice(0, 10).map(r => r.slice(0, 16)),
  rump: [
    '....aaaaaa....',
    '..aaggggggaa..',
    '.afggggggggfa.',
    'affggggggggffa',
    'affggggggggffa',
    '.afffggggfffa.',
    '..aaaaaaaaaa..',
  ],
  backTailDown: ['.aa.', 'adda', 'aiia', 'adda', 'aiia', 'adda', 'aiia', '.aa.'],
  backTailUp: ['.aa..', 'adda.', 'aiia.', 'adda.', 'aiiia', '.adda', '.aiia', '..aa.'],
  foot: ['adda', 'aaaa'],
  sole: ['akka', 'alla', 'aaaa'],
};
// Each body shape: where the hind and fore legs leave it, and the row they start on.
const HIPS = {
  normal: { hind: 3, fore: 10, row: 7 }, stretch: { hind: 3, fore: 13, row: 5 },
  gather: { hind: 2, fore: 8, row: 8 }, squash: { hind: 3, fore: 12, row: 6 },
};
const LEGS = {
  fore: { near: { fill: 'i', paw: 'd', w: 2 }, far: { fill: 'f', paw: 'c', w: 2 } },
  hind: { near: { fill: 'f', paw: 'd', w: 2 }, far: { fill: 'e', paw: 'c', w: 2 } },
};
// The tail's root, in its own px, so a frame sets it against the body's rump.
const ROOT = { tailLow: [10, 2], tailUp: [6, 5] };
// The rump on each body shape, and where the head sits against its shoulder.
const RUMP = { normal: [1, 3], stretch: [1, 2], gather: [1, 3], squash: [1, 3] };
const NECK = { normal: [11, -3], stretch: [14, -4], gather: [8, -2], squash: [12, -3] };

/** A frame. `b`: body shape, its x and its top row. `h`: head [variant, dx from the neck, dy].
 *  `t`: tail [variant, dy]. `feet`: [offset, lift] near fore, far fore, near hind, far hind. */
const F = (name, ms, dx, [body, bx, by], [head, hdx, hdy], [tail, tdy], feet, o = {}) => {
  const [rx, ry] = RUMP[body], [nx, ny] = NECK[body], [ox, oy] = ROOT[tail];
  by += 2;
  return { name, ms, dx, thing: o.thing, body: [body, bx, by], head: [head, bx + nx + hdx, by + ny + hdy],
    tail: [tail, bx + rx - ox, by + ry - oy + tdy], feet, extra: o.extra ?? [] };
};
const P = [0, 0], PLANT = [P, P, P, P];
/** The sit, the raccoon's rest, centred as the game centres it. */
const S = (name, ms, dx, thing, art = 'sit') => ({ name, ms, dx, thing, parts: [[art, 11, 0]] });
const SIDE = {
  // Hunker, launch, a patter of feet with the body bobbing, a skid past the mark, back to it.
  crawl: [
    S('sit', 200, 0),
    F('anticipate', 70,  0, ['squash', 14, 6], ['head', 0, 1], ['tailUp', 0], PLANT),
    F('launch',     40,  4, ['stretch', 13, 7], ['head', 0, 0], ['tailLow', 0], [[1, 1], P, [-3, 0], [-2, 1]]),
    F('patterA',    35,  8, ['normal', 14, 4], ['head', 0, 0], ['tailLow', 0], [[2, 1], [-2, 0], [-2, 0], [2, 1]]),
    F('patterB',    35, 12, ['normal', 14, 5], ['head', 0, 0], ['tailLow', 1], [[-2, 0], [2, 1], [2, 1], [-2, 0]]),
    F('patterA',    35, 16, ['normal', 14, 4], ['head', 0, 0], ['tailLow', 0], [[2, 1], [-2, 0], [-2, 0], [2, 1]]),
    F('patterB',    35, 20, ['normal', 14, 5], ['head', 0, 0], ['tailLow', 1], [[-2, 0], [2, 1], [2, 1], [-2, 0]]),
    F('skid',       50, 25, ['squash', 14, 6], ['head', 1, 1], ['tailUp', 0], [[2, 0], [2, 0], [-2, 0], [-2, 0]]),
    F('settle',     90, 24, ['normal', 14, 5], ['head', 0, -1], ['tailUp', 0], PLANT),
    S('sit', 300, 24),
  ],
  // Back off, slam the head in, scrabble it across with dust off the hind feet, thud, pop back.
  push: [
    S('sit', 200, 0, 0),
    F('windup',   80, -3, ['squash', 14, 6], ['headBack', -1, 0], ['tailUp', 0], [P, P, [-1, 0], [-1, 0]], { thing: 0 }),
    F('slam',     50, -1, ['stretch', 13, 7], ['headStrain', 0, 0], ['tailLow', 0], [[0, 0], [1, 0], [-3, 0], [-2, 0]], { thing: 0 }),
    F('scrabA',   50,  3, ['stretch', 13, 7], ['headStrain', 0, 0], ['tailLow', 0], [[1, 1], [-1, 0], [-4, 0], [-1, 1]], { thing: 4, extra: [['dust', 9, 15]] }),
    F('scrabB',   50,  7, ['stretch', 13, 7], ['headStrain', 0, 0], ['tailLow', 1], [[-1, 0], [1, 1], [-1, 1], [-4, 0]], { thing: 8, extra: [['dustSmall', 10, 16]] }),
    F('scrabA',   50, 11, ['stretch', 13, 7], ['headStrain', 0, 0], ['tailLow', 0], [[1, 1], [-1, 0], [-4, 0], [-1, 1]], { thing: 12, extra: [['dust', 9, 15]] }),
    F('scrabB',   50, 15, ['stretch', 13, 7], ['headStrain', 0, 0], ['tailLow', 1], [[-1, 0], [1, 1], [-1, 1], [-4, 0]], { thing: 16, extra: [['dustSmall', 10, 16]] }),
    F('scrabA',   50, 19, ['stretch', 13, 7], ['headStrain', 0, 0], ['tailLow', 0], [[1, 1], [-1, 0], [-4, 0], [-1, 1]], { thing: 20, extra: [['dust', 9, 15]] }),
    F('thud',     60, 24, ['squash', 14, 6], ['headStrain', 0, 0], ['tailUp', 0], [[1, 0], [1, 0], [-2, 0], [-2, 0]], { thing: 24 }),
    F('pop',     100, 24, ['normal', 14, 5], ['head', 0, -1], ['tailUp', 0], PLANT, { thing: 24 }),
    S('sit', 300, 24, 24),
  ],
  // The same slam; the thing shudders and holds; he strains, bounces off it, and shakes it off.
  stuck: [
    S('sit', 200, 0, 0),
    F('windup',   80, -3, ['squash', 14, 6], ['headBack', -1, 0], ['tailUp', 0], [P, P, [-1, 0], [-1, 0]], { thing: 0 }),
    F('slam',     50,  0, ['stretch', 13, 7], ['headStrain', 0, 0], ['tailLow', 0], [[0, 0], [1, 0], [-3, 0], [-2, 0]], { thing: 1 }),
    F('strainA',  60,  0, ['squash', 14, 6], ['headStrain', 0, 0], ['tailLow', 0], [[1, 0], [1, 0], [-3, 0], [-3, 0]], { thing: 0, extra: [['dust', 10, 15]] }),
    F('strainB',  60,  1, ['squash', 14, 6], ['headStrain', 0, 0], ['tailLow', 1], [[1, 0], [1, 0], [-3, 0], [-3, 0]], { thing: 1, extra: [['dustSmall', 11, 16]] }),
    F('strainA',  60,  0, ['squash', 14, 6], ['headStrain', 0, 0], ['tailLow', 0], [[1, 0], [1, 0], [-3, 0], [-3, 0]], { thing: 0, extra: [['dust', 10, 15]] }),
    F('bounce',   60, -5, ['stretch', 13, 6], ['headBlink', -1, -1], ['tailUp', 0], [[-3, 1], [-2, 1], [2, 1], [3, 1]], { thing: 0 }),
    F('land',     60, -4, ['squash', 14, 6], ['headBlink', 0, 0], ['tailUp', 0], PLANT, { thing: 0 }),
    F('shakeL',   50, -3, ['normal', 14, 5], ['head', -1, 0], ['tailLow', 0], PLANT, { thing: 0 }),
    F('shakeR',   50, -3, ['normal', 14, 5], ['head', 1, 0], ['tailUp', 0], PLANT, { thing: 0 }),
    F('shakeL',   50, -3, ['normal', 14, 5], ['head', -1, 0], ['tailLow', 0], PLANT, { thing: 0 }),
    S('sit', 300, 0, 0),
  ],
};

/** The sit at rest: a blink, an ear flicked back twice, the tail tip flicked twice. Nothing moves
 *  him; it is the beat a sitting raccoon plays between presses. */
const IDLE = [['sit', 900], ['blink', 90], ['sit', 1400], ['ear', 70], ['sit', 80], ['ear', 70], ['sit', 1000],
  ['flick', 80], ['sit', 60], ['flick', 80], ['sit', 800]];
const idle = beat => IDLE.map(([name, ms]) => beat(name, ms));
SIDE.idle = idle((n, ms) => S(n, ms, 0, undefined, { sit: 'sit', blink: 'sitBlink', ear: 'sitEar', flick: 'sitFlick' }[n]));

// The front and back parts' left edge in the frame, so they stand centred as the sit does.
const X = 14;
/** From the front, low: the hump `hump` px over the head, the head `hy` from the top, a fore leg of
 *  length `lh` and `rh` each side of the chest. */
const front = (name, ms, dx, hy, [lh, rh], o = {}) => ({ name, ms, dx, thing: o.thing, parts: [
  ...(o.tail === undefined ? [] : [['tailTip', X + 13, hy + 5 + o.tail]]),
  ['hump', X + 1, hy - (o.hump ?? 1)],
  ['chest', X + 3, H - 6],
  [`leg${lh}`, X + 3 - (o.splay ?? 0), H - lh - 1], [`leg${rh}`, X + 9 + (o.splay ?? 0), H - rh - 1],
  [o.head ?? 'frontHead', X + (o.hx ?? 0), hy],
  ...(o.extra ?? []),
] });
const frontSit = (name, ms, dx, thing, head = 'frontHead', flick = 0) => ({ name, ms, dx, thing,
  parts: [['frontSitTail', X + 15 + flick, 11 - flick], ['frontSitBody', X, 12], [head, X, 0]] });
/** From the back, low: the rump's top on row `ry`, the skull over it, the hind feet `lf` and `rf`. */
const back = (name, ms, dx, ry, [lf, rf], o = {}) => {
  const sway = o.sway ?? 0, s = o.splay ?? 0;
  return { name, ms, dx, thing: o.thing, parts: [
    ['skull', X + (o.hx ?? 0), ry - 7 + (o.bow ?? 0)],
    ...[[lf, X + 2 - s], [rf, X + 10 + s]].map(([f, x]) => [f, x + sway, H - PARTS[f].length]),
    ['rump', X + 1 + sway, ry],
    o.tail === 'up' ? ['backTailUp', X - 1 + sway, ry - 6] : ['backTailDown', X + 6 - sway, ry + 1],
    ...(o.extra ?? []),
  ] };
};
const backSit = (name, ms, dx, thing, art = 'backSit', flick = 0) => ({ name, ms, dx, thing,
  parts: [[art, X, 0], ['backSitTail', X - flick, -flick]] });
const puff = (x, y, small) => [small ? 'dustSmall' : 'dust', x, y];

/** Every action in every view: `side` faces right, `front` comes down the screen toward the viewer,
 *  `back` goes up it, away. */
export const ACTIONS = {
  side: SIDE,
  front: {
    crawl: [
      frontSit('sit', 200, 0),
      front('hunker',  40,  0, 5, [2, 2], { splay: 1, hump: 2, tail: -2 }),
      front('launch',  35,  6, 3, [4, 4], { hump: 0 }),
      front('patterA', 30, 12, 4, [3, 2], { hx: -1, tail: 0 }),
      front('patterB', 30, 18, 4, [2, 3], { hx: 1, tail: 1 }),
      front('skid',    45, 25, 5, [2, 2], { splay: 1, hump: 2, tail: -2 }),
      front('settle',  80, 24, 4, [3, 3], { tail: 0 }),
      frontSit('sit', 300, 24),
    ],
    // He rests his chin on the thing's rim and shoves; dust spurts out past it either side.
    push: [
      frontSit('sit', 200, 0, 0),
      front('windup',  80, -3, 6, [2, 2], { splay: 1, hump: 3, head: 'frontHeadBack', tail: -2, thing: 0 }),
      front('slam',    50,  6, 4, [4, 4], { head: 'frontHeadStrain', thing: 0 }),
      front('scrabA',  50, 10, 4, [3, 2], { hx: -1, head: 'frontHeadStrain', thing: 4, extra: [puff(X - 3, 14)] }),
      front('scrabB',  50, 14, 4, [2, 3], { hx: 1, head: 'frontHeadStrain', thing: 8, extra: [puff(X + 17, 15, 1)] }),
      front('scrabA',  50, 18, 4, [3, 2], { hx: -1, head: 'frontHeadStrain', thing: 12, extra: [puff(X - 3, 14)] }),
      front('scrabB',  50, 22, 4, [2, 3], { hx: 1, head: 'frontHeadStrain', thing: 16, extra: [puff(X + 17, 15, 1)] }),
      front('scrabA',  50, 26, 4, [3, 2], { hx: -1, head: 'frontHeadStrain', thing: 20, extra: [puff(X - 3, 14)] }),
      front('thud',    60, 29, 5, [2, 2], { splay: 1, hump: 2, head: 'frontHeadStrain', thing: 24 }),
      front('pop',    100, 24, 3, [3, 3], { tail: 0, thing: 24 }),
      frontSit('sit', 300, 24, 24),
    ],
    // The same slam; the thing shudders and holds; he strains, hops back off it, shakes his head.
    stuck: [
      frontSit('sit', 200, 0, 0),
      front('windup',  80, -3, 6, [2, 2], { splay: 1, hump: 3, head: 'frontHeadBack', tail: -2, thing: 0 }),
      front('slam',    50,  6, 4, [4, 4], { head: 'frontHeadStrain', thing: 1 }),
      front('strainA', 60,  6, 5, [2, 2], { splay: 1, head: 'frontHeadStrain', thing: 0, extra: [puff(X - 3, 14)] }),
      front('strainB', 60,  7, 5, [2, 2], { splay: 1, head: 'frontHeadStrain', thing: 1, extra: [puff(X + 17, 15, 1)] }),
      front('strainA', 60,  6, 5, [2, 2], { splay: 1, head: 'frontHeadStrain', thing: 0, extra: [puff(X - 3, 14)] }),
      front('bounce',  60, -4, 2, [4, 4], { hump: 0, head: 'frontHeadBlink', thing: 0 }),
      front('land',    60, -3, 5, [2, 2], { splay: 1, hump: 2, head: 'frontHeadBlink', tail: -2, thing: 0 }),
      front('shakeL',  50, -2, 4, [3, 3], { hx: -1, tail: 0, thing: 0 }),
      front('shakeR',  50, -2, 4, [3, 3], { hx: 1, tail: 1, thing: 0 }),
      front('shakeL',  50, -2, 4, [3, 3], { hx: -1, tail: 0, thing: 0 }),
      frontSit('sit', 300, 0, 0),
    ],
    idle: idle((n, ms) => frontSit(n, ms, 0, undefined,
      { sit: 'frontHead', blink: 'frontHeadBlink', ear: 'frontHeadEar', flick: 'frontHead' }[n], n === 'flick' ? 1 : 0)),
  },
  back: {
    crawl: [
      backSit('sit', 200, 0),
      back('hunker',  40,  0, 10, ['foot', 'foot'], { splay: 1, bow: 2, tail: 'up' }),
      back('launch',  35,  6,  8, ['sole', 'sole'], { tail: 'up' }),
      back('patterA', 30, 12,  9, ['sole', 'foot'], { sway: 1 }),
      back('patterB', 30, 18,  9, ['foot', 'sole'], { sway: -1 }),
      back('skid',    45, 25, 10, ['foot', 'foot'], { splay: 1, bow: 2, tail: 'up' }),
      back('settle',  80, 24,  9, ['foot', 'foot']),
      backSit('sit', 300, 24),
    ],
    // Rump up, head in under the thing's base; the hind feet kick up their soles and the dust.
    push: [
      backSit('sit', 200, 0, 0),
      back('windup',  80, -3, 10, ['foot', 'foot'], { splay: 1, bow: 2, tail: 'up', thing: 0 }),
      back('slam',    50, 10,  8, ['sole', 'sole'], { thing: 0 }),
      back('scrabA',  50, 14,  8, ['sole', 'foot'], { sway: 1, thing: 4, extra: [puff(X - 2, 15)] }),
      back('scrabB',  50, 18,  8, ['foot', 'sole'], { sway: -1, thing: 8, extra: [puff(X + 16, 15)] }),
      back('scrabA',  50, 22,  8, ['sole', 'foot'], { sway: 1, thing: 12, extra: [puff(X - 2, 15)] }),
      back('scrabB',  50, 26,  8, ['foot', 'sole'], { sway: -1, thing: 16, extra: [puff(X + 16, 15)] }),
      back('scrabA',  50, 30,  8, ['sole', 'foot'], { sway: 1, thing: 20, extra: [puff(X - 2, 15)] }),
      back('thud',    60, 33,  9, ['foot', 'foot'], { splay: 1, tail: 'up', thing: 24 }),
      back('pop',    100, 26,  9, ['foot', 'foot'], { thing: 24 }),
      backSit('sit', 300, 24, 24),
    ],
    stuck: [
      backSit('sit', 200, 0, 0),
      back('windup',  80, -3, 10, ['foot', 'foot'], { splay: 1, bow: 2, tail: 'up', thing: 0 }),
      back('slam',    50, 10,  8, ['sole', 'sole'], { thing: 1 }),
      back('strainA', 60, 10,  9, ['foot', 'foot'], { splay: 1, thing: 0, extra: [puff(X - 2, 15)] }),
      back('strainB', 60, 11,  9, ['foot', 'foot'], { splay: 1, thing: 1, extra: [puff(X + 16, 15, 1)] }),
      back('strainA', 60, 10,  9, ['foot', 'foot'], { splay: 1, thing: 0, extra: [puff(X - 2, 15)] }),
      back('bounce',  60, -4,  7, ['sole', 'sole'], { tail: 'up', thing: 0 }),
      back('land',    60, -3, 10, ['foot', 'foot'], { splay: 1, bow: 2, tail: 'up', thing: 0 }),
      back('shakeL',  50, -2,  9, ['foot', 'foot'], { hx: -1, sway: 1, thing: 0 }),
      back('shakeR',  50, -2,  9, ['foot', 'foot'], { hx: 1, sway: -1, thing: 0 }),
      back('shakeL',  50, -2,  9, ['foot', 'foot'], { hx: -1, sway: 1, thing: 0 }),
      backSit('sit', 300, 0, 0),
    ],
    idle: idle((n, ms) => backSit(n, ms, 0, undefined, n === 'ear' ? 'backSitEar' : 'backSit', n === 'flick' ? 1 : 0)),
  },
};

/** Frame `f` as pixels `{ w, h, px: [[x, y, colour]] }`, facing right. */
export function draw(f) {
  const out = new Map();
  const put = (x, y, ch) => {
    if (x < 0 || x >= W || y < 0 || y >= H) throw new Error(`${f.name}: off the frame at ${x},${y}`);
    out.set(`${x},${y}`, [x, y, ART.PAL[ch]]);
  };
  const art = (name, x, y) => PARTS[name].forEach((row, r) => [...row].forEach((ch, c) => ch !== '.' && put(x + c, y + r, ch)));
  if (f.parts) { for (const [n, x, y] of f.parts) art(n, x, y); return { w: W, h: H, px: [...out.values()] }; }
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
  for (const e of f.extra) art(...e);
  return { w: W, h: H, px: [...out.values()] };
}

/** Pixels `px` facing left instead. */
export const mirror = ({ w, h, px }) => ({ w, h, px: px.map(([x, y, c]) => [w - 1 - x, y, c]) });
