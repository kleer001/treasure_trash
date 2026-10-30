// The raccoon, drawn by hand from its parts.
// Seen from the front it is the bench sprite cut into those parts, so at rest it is that sprite
// exactly. From the side and from behind it is drawn here, in the same colours.

const PAL = { a: '#020106', b: '#06050e', c: '#19152b', d: '#3a2a40', e: '#453d51', f: '#584c62', g: '#765c62',
  h: '#896e6e', i: '#a8826e', j: '#ca8b68', k: '#d6d3b0', l: '#d9ac87', m: '#f1eccb' };

/** The parts of a drawing: `art` in palette letters, `cut` naming the part each pixel belongs to. */
function parts(art, cut) {
  const out = {};
  art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === '.') return;
    const p = cut[y][x];
    if (p === '.') throw new Error(`pixel ${x},${y} is in no part`);
    (out[p] ??= []).push([x, y, PAL[ch]]);
  }));
  return out;
}

/** The bench sprite `front`, cut: H head, B body, L and R the legs, T the tail's tip, U its root. */
const FRONT_CUT = [
  '..HH........HH.....',
  '.HHHH......HHHH....',
  '.HHHHHHHHHHHHHH....',
  '.HHHHHHHHHHHHHHT...',
  '.HHHHHHHHHHHHHHTT..',
  '.HHHHHHHHHHHHHHTTT.',
  '.HHHHHHHHHHHHHHTTTT',
  'HHHHHHHHHHHHHHHTTTT',
  'HHHHHHHHHHHHHHHTTTT',
  '.HHHHHHHHHHHHHHTTT.',
  '..HHHHHHHHHHHHH....',
  '..HHHHHHHHHHHHUU...',
  '..BBBBBBBBBBBBBU...',
  '.BBBBBBBBBBBBB.U...',
  '...LLL.BB.RRR..U...',
  '...LL..BB..RR..U...',
  '.LLL...BB...RR.U...',
  '..L..LL..RR........',
];

/** Seen from its left side, facing right. */
const SIDE_ART = [
  '............aa........',
  '...........alla.......',
  '.aa........adlaaaa....',
  'adda......aiiiiiiia...',
  'aiia.....aiiiiiiiiia..',
  'adda.....aiiimmmmiiia.',
  'aiiia....akdddddddiia.',
  '.addda...akddmadddkka.',
  '.aiiia...aikddddddkkaa',
  '..addaaaaaaikkkkkkjka.',
  '...aiaffff.aiiiiiiaa..',
  '...aafffggfaaaaaaa....',
  '..affgggggfffiiia.....',
  '..afgggggggffilia.....',
  '..afgggggffffaiia.....',
  '...agggggafffaiia.....',
  '...aggaaaaaaaaeea.....',
  '.....aaaaaaa.aaaaa....',
];
const SIDE_CUT = [
  '............HH........',
  '...........HHHH.......',
  '.TT........HHHHHHH....',
  'TTTT......HHHHHHHHH...',
  'TTTT.....HHHHHHHHHHH..',
  'TTTT.....HHHHHHHHHHHH.',
  'TTTTT....HHHHHHHHHHHH.',
  '.TTTTT...HHHHHHHHHHHH.',
  '.TTTTT...HHHHHHHHHHHHH',
  '..UUUBBBBBHHHHHHHHHHH.',
  '...UUBBBBB.HHHHHHHHH..',
  '...UBBBBBBBHHHHHHH....',
  '..BBBBBBBBBBBBBBB.....',
  '..BBBBBBBBBBBBBBB.....',
  '..BBBBBBBBBBBFFFF.....',
  '...BBBBBBBBBBFFFF.....',
  '...KKKKKKKKKKFFFF.....',
  '.....KKKKKKK.FFFFF....',
];

/** Seen from behind, facing up the picture. */
const BACK_ART = [
  '..aa........aa.....',
  '.adda......adda....',
  '.adddaaaaaaddda....',
  '.addlliiiiiidda....',
  '.aillliiiiiiiga....',
  'aiilliiiiiiiigga...',
  'adiiiiiiiiiiigda...',
  'addiiiiiiiiigdda...',
  'adgiiiiiiiiiigda...',
  '.aggiiiiiiiigga....',
  '..aagggggggaa......',
  '...aaaaaaaaaa......',
  '..afffffeffffa.....',
  '.affffffefffffa....',
  '.afgffffeffffga....',
  '.afggfffefffgga....',
  '.aaggaaaaaaggaa....',
  '..aaaa.....aaaa....',
];
/** The tail seen from behind. */
const BACK_TAIL = [
  '...................',
  '...................',
  '...................',
  '...................',
  '...................',
  '.aa................',
  'adda...............',
  'aiia...............',
  'adda...............',
  'aiiia..............',
  '.addda.............',
  '.aiiia.............',
  '..addaa............',
  '..aiiiia...........',
  '...addda...........',
  '....aaa............',
  '...................',
  '...................',
];
const BACK_CUT = [
  '..HH........HH.....',
  '.HHHH......HHHH....',
  '.HHHHHHHHHHHHHH....',
  '.HHHHHHHHHHHHHH....',
  '.HHHHHHHHHHHHHH....',
  'HHHHHHHHHHHHHHHH...',
  'HHHHHHHHHHHHHHHH...',
  'HHHHHHHHHHHHHHHH...',
  'HHHHHHHHHHHHHHHH...',
  '.HHHHHHHHHHHHHH....',
  '..HHHHHHHHHHH......',
  '...HHHHHHHHHH......',
  '..BBBBBBBBBBBB.....',
  '.BBBBBBBBBBBBBB....',
  '.BBBBBBBBBBBBBB....',
  '.BBBBBBBBBBBBBB....',
  '.LLLLBBBBBBRRRR....',
  '..LLLL.....RRRR....',
];

export const ART = { PAL, FRONT_CUT, SIDE_ART, SIDE_CUT, BACK_ART, BACK_CUT, BACK_TAIL, parts };

const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
export const ACTIONS = ['sit', 'crawl', 'push', 'stuck'];
/** Each action's phases, in order, by the setting that times each one. */
const PHASES = {
  sit: ['idle'],
  crawl: ['crouch', 'pull', 'pull', 'settle'],
  push: ['brace', 'shove', 'follow', 'settle'],
  stuck: ['brace', 'shove', 'strain', 'giveUp', 'settle'],
};
const BETWEEN = { l: { r: 'd' }, r: { l: 'd' }, u: { d: 'r' }, d: { u: 'r' } };
const LEG = 3;                                 // px
const REST = { root: 0, lean: 0, crouch: 0, reach: 0, trail: 0, sway: 0, breath: 0, blink: false, stepA: 0, stepB: 0 };
const ease = u => u < 0.5 ? 2 * u * u : 1 - (-2 * u + 2) ** 2 / 2;
const out = u => 1 - (1 - u) ** 2;
const mix = (a, b, u) => a + (b - a) * u;

export function createRaccoon(front) {
  const frontArt = Array.from({ length: front.h }, () => Array(front.w).fill('.'));
  const letter = Object.fromEntries(Object.entries(PAL).map(([k, v]) => [v, k]));
  for (const [x, y, col] of front.px) frontArt[y][x] = letter[col];
  const tail = parts(BACK_TAIL, BACK_TAIL.map(r => r.replace(/[^.]/g, 'T'))).T;
  const VIEWS = {
    front: { w: front.w, h: front.h, parts: parts(frontArt.map(r => r.join('')), FRONT_CUT),
      order: ['T', 'U', 'B', 'L', 'R', 'H'], fore: ['L', 'R'], hind: [],
      blink: [[5, 7, 'd'], [10, 7, 'd'], [4, 8, 'e'], [5, 8, 'e'], [10, 8, 'e'], [11, 8, 'e']] },
    side: { w: SIDE_ART[0].length, h: SIDE_ART.length, parts: parts(SIDE_ART, SIDE_CUT),
      order: ['T', 'U', 'B', 'K', 'F', 'H'], fore: ['F'], hind: ['K'], blink: [[13, 7, 'd'], [14, 7, 'e']] },
    back: { w: BACK_ART[0].length, h: BACK_ART.length, parts: { ...parts(BACK_ART, BACK_CUT), T: tail },
      order: ['B', 'L', 'R', 'H', 'T'], fore: [], hind: ['L', 'R'], blink: [] },
  };
  const viewOf = facing => facing === 'd' ? 'front' : facing === 'u' ? 'back' : 'side';

  /** Leg `list` with its top `from` px and its foot `to` px along `[fx, fy]`. */
  function leg(list, from, to, fx, fy) {
    const ys = list.map(p => p[1]), y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (fx) return list.map(([x, y, col]) => [x + fx * Math.round(from + (to - from) * (y - y0) / Math.max(1, y1 - y0)), y, col]);
    const top = y0 + fy * from, shift = fy * to, px = [];
    for (const [x, y, col] of list) if (y + shift >= top) px.push([x, y + shift, col]);
    const hip = list.filter(p => p[1] === y0);
    for (let y = top; y < y0 + shift; y++) for (const [x, , col] of hip) px.push([x, y, col]);
    return px;
  }

  /** The raccoon in view `view`, mirrored when it faces left, posed by `k` with forward along `[fx, fy]`: its pixels in px from its box's top-left, which may stray outside the box. */
  function pose(view, mirror, [fx, fy], k) {
    const V = VIEWS[view], px = [];
    const along = n => [Math.round(n * fx), Math.round(n * fy)];
    const put = (list, [ox, oy], swap = null) => {
      for (const [x, y, col] of list) {
        const c = swap?.get(`${x},${y}`) ?? col;
        px.push([(mirror ? V.w - 1 - x : x) + ox, y + oy, c]);
      }
    };
    const [lx, ly] = along(k.lean), sink = Math.ceil(k.crouch / 2);
    const blink = k.blink ? new Map(V.blink.map(([x, y, ch]) => [`${x},${y}`, PAL[ch]])) : null;
    for (const name of V.order) {
      const list = V.parts[name];
      if (!list) continue;
      if (name === 'H') put(list, [lx, ly + k.crouch + k.breath], blink);
      else if (name === 'B' || name === 'U') put(list, [lx, ly + sink]);
      else if (name === 'T') put(list, [lx + k.sway, ly + sink]);
      else {
        const fore = V.fore.includes(name), step = (fore ? V.fore : V.hind).indexOf(name) ? k.stepB : k.stepA;
        const to = Math.max((fore ? k.reach : -k.trail) + step, k.lean - LEG);
        put(leg(list, k.lean, to, mirror ? -fx : fx, fy), [0, 0]);
      }
    }
    return { w: V.w, h: V.h, px };
  }

  /** The phases action `action` takes, the raccoon facing `from` and pressed `dir`, each `[name, ms]`, timed by `ui`. */
  const phases = (action, from, dir, ui) => {
    const main = PHASES[action].map(p => [p, p === 'idle' ? ui.breaths * ui.breath : ui[p]]);
    return action === 'sit' || from === dir ? main : [['turn', ui.turn], ...main];
  };

  /** The pose `t` ms into action `action`: the way it faces, its view, whether that is mirrored, and the pose keys. */
  function at(action, from, dir, t, ui, dist, gap = 0) {
    const k = { ...REST }, lunge = gap + ui.lunge;
    let face = action === 'sit' ? from : dir, name = null, u = 1, start = 0, hitch = 0;
    for (const [p, ms] of phases(action, from, dir, ui)) {
      if (t < start + ms) { name = p; u = ms ? (t - start) / ms : 1; break; }
      if (p === 'pull') hitch++;
      start += ms;
    }
    const half = dist / 2;
    switch (name) {
      case null: k.root = dist; break;
      case 'turn': {
        const way = [from, BETWEEN[from][dir], dir].filter(Boolean);
        face = way[Math.min(way.length - 1, Math.floor(u * way.length))];
        k.crouch = Math.round(Math.sin(u * Math.PI));
        break;
      }
      case 'idle': {
        const span = ui.breaths * ui.breath, ms = u * span;
        k.breath = Math.round(ui.breathPx * (1 - Math.cos(2 * Math.PI * ms / ui.breath)) / 2);
        k.sway = Math.round(ui.sway * Math.sin(2 * Math.PI * ms / (span / Math.max(1, ui.swings))));
        k.blink = Math.abs(ms - span * 0.6) < ui.blink / 2;
        break;
      }
      case 'crouch': k.crouch = Math.round(ui.crouchPx * ease(u)); break;
      case 'pull': {
        k.crouch = ui.crouchPx;
        const reach = u < 0.4 ? out(u / 0.4) : 1 - ease((u - 0.4) / 0.6);
        k.reach = Math.round(ui.reach * reach);
        k.root = hitch * half + (u < 0.4 ? 0 : half * ease((u - 0.4) / 0.6));
        k.trail = Math.round(ui.trail * Math.sin(Math.max(0, (u - 0.4) / 0.6) * Math.PI));
        k.sway = Math.round(ui.sway * Math.sin(u * Math.PI) * (hitch ? -1 : 1));
        k.stepA = hitch ? 0 : Math.round(Math.sin(u * Math.PI));
        k.stepB = hitch ? Math.round(Math.sin(u * Math.PI)) : 0;
        break;
      }
      case 'settle': {
        const from = action === 'crawl' ? ui.crouchPx : 1;
        k.crouch = Math.round(from * (1 - ease(u)));
        if (action === 'stuck') k.lean = -Math.round(1 - ease(u));
        if (action === 'push') { k.lean = Math.round(lunge * (1 - ease(u))); k.reach = Math.round(ui.reach * (1 - ease(u))); }
        k.root = dist;
        break;
      }
      case 'brace':
        k.lean = -Math.round(ui.bracePx * ease(u));
        k.crouch = Math.round(ease(u));
        break;
      case 'shove':
        k.lean = Math.round(mix(-ui.bracePx, lunge, out(u)));
        k.reach = Math.round(ui.reach * out(u));
        k.crouch = 1;
        k.sway = Math.round(ui.sway * Math.sin(u * Math.PI));
        break;
      case 'follow':
        k.root = Math.round(dist * ease(u));
        k.lean = lunge;
        k.reach = ui.reach;
        k.crouch = 1;
        break;
      case 'strain': {
        const shake = Math.floor(u * ui.strain / 60) % 2;
        k.lean = lunge + shake;
        k.reach = ui.reach;
        k.crouch = 1 + (1 - shake);
        break;
      }
      case 'giveUp':
        k.lean = Math.round(mix(lunge, -1, ease(u)));
        k.reach = Math.round(ui.reach * (1 - ease(u)));
        k.crouch = 1 + Math.round(Math.sin(u * Math.PI));
        k.sway = -Math.round(ui.sway * Math.sin(u * Math.PI));
        break;
    }
    return { face, view: viewOf(face), mirror: face === 'l', k };
  }

  /** Where the thing a push shoves is, `t` ms into it: px along the push, of `dist`. */
  function thing(action, from, dir, t, ui, dist) {
    let start = 0;
    for (const [p, ms] of phases(action, from, dir, ui)) {
      if (p === 'follow') return t < start ? 0 : Math.round(dist * ease(Math.min(1, (t - start) / ms)));
      if (p === 'strain' && t >= start && t < start + ms) return Math.floor((t - start) / 60) % 2;
      start += ms;
    }
    return 0;
  }

  const end = (action, from, dir, ui) => phases(action, from, dir, ui).reduce((t, [, ms]) => t + ms, 0);

  const draw = (p, dir) => pose(p.view, p.mirror, DIRS[dir], p.k);
  const rest = face => pose(viewOf(face), face === 'l', DIRS[face], REST);
  return { VIEWS, viewOf, phases, end, at, thing, draw, rest, pose, REST };
}
