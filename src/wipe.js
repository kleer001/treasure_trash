// The curtain between rooms: a wall laid over the board brick by brick in a pattern, then taken
// down once the next room is behind it. Counted in art pixels of P canvas pixels, so every brick
// is a block of whole pixels at any board size, and in 60 Hz frames, like every other motion.
import { mulberry32 } from './rng.js';
import { easeOut } from './stage.js';
import { PALETTE } from './sprites.js';

export const P = 4;
export const PATTERNS = ['right', 'left', 'down', 'up', 'downRight', 'downLeft', 'upRight', 'upLeft', 'spiralCw', 'spiralCcw'];

// `w` is a brick's length with its mortar, or a [shortest, longest] range for stone laid in no
// bond; `h` its course; `bond` how far each other course is shifted.
export const KINDS = {
  brick: { w: 8, h: 4, bond: 4, mortar: '#34192b', faces: ['#6f383a', '#a84f38', '#8a4436'], lit: '#c46a4c' },
  cinder: { w: 12, h: 6, bond: 6, mortar: '#55544f', faces: ['#9b9a94', '#8d8c86', '#a8a7a0'], lit: '#c2c1ba', specks: ['#6f6e69'] },
  stone: { w: [5, 11], h: 5, mortar: '#3e434b', faces: ['#7d8590', '#6b7380', '#8f96a0'], lit: '#aab1ba' },
  glass: { w: 8, h: 8, bond: 0, mortar: '#d9e4e6', faces: ['#a9d6db', '#bfe3e6'], lit: '#ffffff', glint: true },
  bale: { w: 12, h: 9, bond: 6, mortar: '#2b2620', faces: ['#7a6a55', '#6d6150', '#857358'], lit: '#9c8a6c',
    specks: [PALETTE.red, PALETTE.yel, PALETTE.blu, PALETTE.tea, PALETTE.pnk], wire: '#2b2620' },
};

/** Bricks over a w×h canvas, `p` canvas pixels to an art pixel, the edges overhanging. */
export function layWall(kind, w, h, seed, p = P) {
  const K = KINDS[kind], rnd = mulberry32(seed), W = Math.ceil(w / p), H = Math.ceil(h / p);
  const pick = list => list[Math.floor(rnd() * list.length)];
  const len = Array.isArray(K.w) ? () => K.w[0] + Math.floor(rnd() * (K.w[1] - K.w[0] + 1)) : () => K.w;
  const bricks = [];
  for (let row = 0, y = 0; y < H; row++, y += K.h) {
    let x = Array.isArray(K.w) ? -Math.floor(rnd() * K.w[0]) : -(row % 2) * K.bond;
    while (x < W) {
      const bw = len();
      const specks = (K.specks ? Array.from({ length: K.wire ? 5 : 2 }, () =>
        [1 + Math.floor(rnd() * (bw - 3)), 1 + Math.floor(rnd() * (K.h - 3)), pick(K.specks)]) : []);
      bricks.push({ x, y, w: bw, h: K.h, face: pick(K.faces), specks });
      x += bw;
    }
  }
  return { kind, p, W, H, bricks, ranks: {} };
}

/** Where each brick falls in the pattern's order: 0 is laid first and 1 last. */
export function rankWall(wall, pattern) {
  if (wall.ranks[pattern]) return wall.ranks[pattern];
  const { W, H } = wall, ring = KINDS[wall.kind].h;
  const raw = wall.bricks.map(b => {
    const x = b.x + b.w / 2, y = b.y + b.h / 2;
    switch (pattern) {
      case 'right': return x;
      case 'left': return -x;
      case 'down': return y;
      case 'up': return -y;
      case 'downRight': return x / W + y / H;
      case 'downLeft': return -x / W + y / H;
      case 'upRight': return x / W - y / H;
      case 'upLeft': return -x / W - y / H;
      case 'spiralCw': case 'spiralCcw': {
        // Ring by ring inward, a course deep, each ring walked round from its top-left corner.
        const k = Math.floor(Math.max(0, Math.min(x, W - x, y, H - y)) / ring), i = k * ring;
        const x0 = i, y0 = i, x1 = W - i, y1 = H - i, top = y - y0, right = x1 - x, bottom = y1 - y, left = x - x0;
        const m = Math.min(top, right, bottom, left), across = x1 - x0, down = y1 - y0;
        const pos = m === top ? x - x0 : m === right ? across + (y - y0) : m === bottom ? across + down + (x1 - x)
          : 2 * across + down + (y1 - y);
        const along = Math.max(0, Math.min(1, pos / (2 * (across + down))));
        return k + (pattern === 'spiralCw' ? along : (1 - along) % 1);
      }
      default: throw new Error(`wipe: no pattern "${pattern}"`);
    }
  });
  const lo = Math.min(...raw), hi = Math.max(...raw);
  return (wall.ranks[pattern] = raw.map(r => (r - lo) / (hi - lo)));
}

const clamp = v => Math.max(0, Math.min(1, v));

/** How far down (`laid`) and how far gone (`gone`) a brick of rank `r` is, `f` frames into the cover. */
export function brickPhase(r, f, t) {
  const laid = clamp((f - r * (t.cover - t.lay)) / t.lay);
  const out = t.order === 'same' ? r : 1 - r;
  const gone = clamp((f - t.cover - t.hold - out * (t.reveal - t.lay)) / t.lay);
  return { laid, gone };
}

/** Frames a line stays on screen: as long as it takes to type and to read, then `holdMs` more. */
export function lineFrames(line, T) {
  const beatMs = Math.max(line.length / T.cps * 1000, T.readPerCharMs * line.length) + T.holdMs;
  return Math.ceil(beatMs * 60 / 1000);
}

/** A hold that began at frame `from`: `hold` frames at least, and while he talks up to `holdMax`. */
export function holdOf(from, s) {
  return s.wait === 'fixed' ? { from, min: s.hold, max: s.hold, wait: false }
    : { from, min: s.hold, max: s.holdMax, wait: true };
}

/** Whether a hold that has run `held` frames may end: `min` at least, and `max` at most while `busy`. */
export function holdEnds(held, min, max, busy) {
  if (max < min) throw new Error(`wipe: the longest hold (${max}) is shorter than the shortest (${min})`);
  return held >= max || (held >= min && !busy);
}

/** The frame the first brick drops, counted from when he starts to leave: he goes, then the room stands empty. */
export const wallFrom = t => t.exit + t.empty;

/** The wall's length in frames, from the least it can take to the most, for the settings `t`. */
export function wallFrames(t, wait) {
  const fixed = wallFrom(t) + t.cover + t.hold + t.reveal;
  if (wait === 'fixed') return { min: fixed, max: fixed };
  return { min: fixed, max: fixed + (t.holdMax - t.hold) * (wait === 'both' ? 2 : 1) };
}

/** The wall `f` frames into the cover. A brick drops into its course; it shrinks away on the way out. */
export function drawWipe(ctx, wall, pattern, t, f) {
  const K = KINDS[wall.kind], ranks = rankWall(wall, pattern), drop = 2 * K.h;
  const px = (x, y, w, h) => ctx.fillRect(x * wall.p, y * wall.p, w * wall.p, h * wall.p);
  wall.bricks.forEach((b, i) => {
    const { laid, gone } = brickPhase(ranks[i], f, t);
    if (laid <= 0 || gone >= 1) return;
    const y = b.y - Math.round((1 - easeOut(laid)) * drop);
    if (gone > 0) {
      const w = Math.round(b.w * (1 - gone)), h = Math.round(b.h * (1 - gone));
      ctx.fillStyle = b.face;
      px(b.x + Math.floor((b.w - w) / 2), y + Math.floor((b.h - h) / 2), w, h);
      return;
    }
    ctx.fillStyle = K.mortar; px(b.x, y, b.w, b.h);
    ctx.fillStyle = b.face; px(b.x, y, b.w - 1, b.h - 1);
    ctx.fillStyle = K.lit; px(b.x, y, b.w - 1, 1);
    if (K.glint) { px(b.x, y, 1, b.h - 1); ctx.fillStyle = '#ffffff'; px(b.x + 1, y + 1, 2, 1); px(b.x + 1, y + 1, 1, 2); }
    for (const [sx, sy, col] of b.specks) { ctx.fillStyle = col; px(b.x + sx, y + sy, 1, 1); }
    if (K.wire) { ctx.fillStyle = K.wire; px(b.x + Math.floor(b.w / 3), y, 1, b.h - 1); px(b.x + Math.floor(2 * b.w / 3), y, 1, b.h - 1); }
  });
}
