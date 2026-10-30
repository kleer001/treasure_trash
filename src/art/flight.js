// The bag rip frame by frame; its board and tear come from src/rules.js.
import { explain, TRASH, cell } from '../rules.js';
import { toState } from '../format.js';
import { cellSeed } from '../stage.js';
import { mulberry32 } from '../rng.js';
import { settle, drawPile, SHADOW, ORDER } from './pile.js';
import { spreadPiles, hash } from './spread.js';
import { wallTile } from './room.js';

export const C = 24, FLOOR = '#896e6e', SEAM = '#584c62';
const DIRS = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
// The bag and the raccoon from the push on, ms: from each key's time, the bag sprite, the bag's nudge and the raccoon's lunge toward the bag, px.
export const KEYS = [
  { t: 0, body: 'bag', lunge: 0 },
  { t: 160, body: 'bag', nudge: 1, lunge: 3 },
  { t: 240, body: 'open', lunge: 6 },
  { t: 320, body: 'burst', lunge: 6 },
  { t: 480, lunge: 10 }, { t: 540, lunge: 15 }, { t: 600, lunge: 20 }, { t: 660, lunge: C },
];
export const TEAR = KEYS.find(k => k.body === 'burst').t;
export const MIN_FLIGHT = 60;                          // ms, the shortest flight a piece makes
// The settings plan() reads, as sliders: label, least, most, step, readout.
export const FLIGHT_SLIDERS = {
  launch: ['Pieces leave over', 0, 300, 10, v => `${v} ms`],
  first: ['First piece lands', MIN_FLIGHT, 900, 10, v => `${v} ms after the first leaves`],
  last: ['Last piece lands', MIN_FLIGHT, 1200, 10, v => `${v} ms after the first leaves`],
  spread: ['Speed spread', 0, 90, 5, v => `±${v}%`],
  far: ['Far pieces land later', 0, 100, 5, v => `${v}%`],
  heavy: ['Heavy pieces land first', 0, 100, 5, v => `${v}%`],
  arc: ['Arc height, average flight', 0, 30, 1, v => `${v} px`],
  spin: ['Spinning pieces', 0, 100, 5, v => `${v}%`],
  turns: ['Most turns in a spin', 1, 8, 1, v => `${v} × 45°`],
  hold: ['Hold the last frame', 100, 2000, 50, v => `${v} ms`],
};

const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const DARKEN = rgb(SHADOW).map((c, i) => c / rgb(FLOOR)[i]);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
// The shadow a landed piece has in each pile shadow style: how far it reaches past the piece, px, and its offset.
const LANDED = { base: { r: 1.5, dx: 0, dy: 0 }, drop: { r: 0.5, dx: 1, dy: 1 }, none: { r: 0.5, dx: 0, dy: 0 } };
const DRIFT = { s: [0, 1], se: [Math.SQRT1_2, Math.SQRT1_2], e: [1, 0] };

/** Drawing and flight for one trash set `T`, sprites `A`, pile look `STYLE`, and `OBJ`, the sprite of each occupant code. */
export function createFlight({ T, A, STYLE, OBJ }) {
  const drawSpr = (ctx, spr, x, y) => { for (const [px, py, col] of spr.px) { ctx.fillStyle = col; ctx.fillRect(x + px, y + py, 1, 1); } };
  const at = (spr, cx, cy) => [cx * C + Math.floor((C - spr.w) / 2), cy * C + C - spr.h - 1];

  /** A square N×N board, each `[x, y, glyph]` of `put` placed on it. */
  function board(N, room, put) {
    const rows = Array.from({ length: N }, (_, y) => Array.from({ length: N }, (_, x) =>
      room === 'walled' && (x === 0 || y === 0 || x === N - 1 || y === N - 1) ? '#' : '-'));
    rows[0][0] = 'E';
    for (const [x, y, ch] of put) rows[y][x] = ch;
    return toState({ id: 'bench', grid: rows.map(r => r.join('')) });
  }

  function rest(s, next, N, lay) {
    const isTrash = (x, y) => x >= 0 && y >= 0 && x < N && y < N && cell(next, x, y).o === TRASH;
    const cells = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (isTrash(x, y)) cells.push([x, y]);
    const blockedOn = (cx, cy) => (x, y) => {
      const px = cx * C + x, py = cy * C + y;
      return px < 0 || py < 0 || px >= N * C || py >= N * C || cell(s, Math.floor(px / C), Math.floor(py / C)).wall;
    };
    const piles = lay(cells, isTrash);
    for (const [k, pile] of piles) { const [x, y] = k.split(',').map(Number); piles.set(k, settle(T, pile, blockedOn(x, y))); }
    const pieces = cells.flatMap(([x, y]) => (piles.get(`${x},${y}`)?.pieces ?? []).map((p, i) => ({ cx: x, cy: y, i, p })));
    return { cells, pieces };
  }

  /** The piles the TRASH cells hold after the tear, laid as the Trash Spread page `S` lays B. */
  function setup(dir, room, S) {
    const [dx, dy] = DIRS[dir], N = room === 'walled' ? 5 : 7, b = (N - 1) / 2;
    const s = board(N, room, [[b, b, '$'], [b - dx, b - dy, '@']]);
    const r = explain(s, dir, { trace: true });
    if (!r.ok || r.kind !== 'tear') throw new Error(`no tear: ${r.reason}`);
    const spawned = r.steps[0].spawned.filter(e => e.o === TRASH);
    const [bx, by] = spawned[0].from;
    const middle = { x: bx * C + C / 2, y: by * C + C - 1 - A.bag.h / 2 };
    return { s, r, N, W: N * C, dx, dy, bx, by, sourceOf: () => middle, aimed: spawned.map(e => e.cells[0]), ...rest(s, r.next, N, (cells, isTrash) => spreadPiles(T, 'edges', S.edges, { C, W: N, H: N, cells, isTrash, seed: S.seed, hues: S.hues })), wrap: S.wrap };
  }

  /** Each piece's leave and land times, in ms after the first could leave, its arc height and turn, from the settings `f`.
   *  `B.sourceOf(q, launch)` is where piece `q` is when it leaves. */
  function plan(B, f) {
    const v = f.spread / 100, far = f.far / 100, heavy = f.heavy / 100, BIAS = { hero: -1, mid: 0, bit: 1 };
    const P = B.pieces.map(q => {
      const s = T.sprite(q.p.name, q.p.alt, q.p.turn), rnd = mulberry32(hash(cellSeed(q.cx, q.cy), q.i, 5));
      const rx = q.cx * C + q.p.x + s.w / 2, ry = q.cy * C + q.p.y + s.h / 2;
      const launch = f.launch * rnd(), speed = 1 + v * (2 * rnd() - 1);
      const spin = rnd() * 100 < f.spin ? (1 + Math.floor(rnd() * f.turns)) * (rnd() < 0.5 ? -1 : 1) : 0;
      const { x: sx, y: sy } = B.sourceOf(q, launch);
      return { ...q, rx, ry, dist: Math.hypot(rx - sx, ry - sy), launch, speed, spin };
    });
    const mean = P.reduce((a, q) => a + q.dist, 0) / P.length, K = (f.first + f.last) / 2 - f.launch / 2;
    for (const q of P) q.natural = q.launch + K * (1 - far + far * q.dist / mean) / q.speed * (1 + 0.5 * heavy * BIAS[q.p.size]);
    const lo = Math.min(...P.map(q => q.natural)), hi = Math.max(...P.map(q => q.natural));
    for (const q of P) {
      q.land = hi > lo ? f.first + (f.last - f.first) * (q.natural - lo) / (hi - lo) : (f.first + f.last) / 2;
      q.launch = Math.min(q.launch, q.land - MIN_FLIGHT);
      q.dur = q.land - q.launch;
      ({ x: q.sx, y: q.sy } = B.sourceOf(q, q.launch));
    }
    const meanDur = P.reduce((a, q) => a + q.dur, 0) / P.length;
    for (const q of P) q.height = Math.min(3 * f.arc, f.arc * (q.dur / meanDur) ** 2);
    return P;
  }

  /** Piece `q` in the air `since` ms after the tear: its sprite at its ground position, its height
   *  `hc` and that height in whole pixels `h`. */
  function inAir(q, since) {
    const u = (since - q.launch) / q.dur, { m, k } = T.poseOf(q.p.name, q.p.turn);
    const s = T.sprite(q.p.name, q.p.alt, T.pose(q.p.name, m, k - Math.round(q.spin * (1 - u))));
    const hc = q.height * 4 * u * (1 - u);
    return { s, gx: Math.round(q.sx + (q.rx - q.sx) * u - s.w / 2), gy: Math.round(q.sy + (q.ry - q.sy) * u - s.h / 2), hc, h: Math.round(hc) };
  }

  /** How strongly each pixel of a W×H canvas lies in the shadow of `flying`, 0..1. */
  function shade(W, H, flying, cast) {
    const a = new Float32Array(W * H), L = LANDED[STYLE.shadow], [ux, uy] = DRIFT[cast.light];
    for (const f of flying) {
      const e = Math.min(1, f.hc / cast.height) ** (cast.curve / 10);
      const r = L.r + cast.spread * e, soft = cast.soft * e, round = cast.round / 100 * e, strength = 1 + (cast.faint / 100 - 1) * e;
      const ox = f.gx + L.dx + cast.slant / 10 * f.hc * ux, oy = f.gy + L.dy + cast.slant / 10 * f.hc * uy;
      const xs = f.s.px.map(p => p[0]), ys = f.s.px.map(p => p[1]);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      const rx = (Math.max(...xs) - Math.min(...xs)) / 2 + 0.5, ry = (Math.max(...ys) - Math.min(...ys)) / 2 + 0.5;
      const x0 = Math.max(0, Math.floor(ox - r - 1)), x1 = Math.min(W - 1, Math.ceil(ox + f.s.w + r + 1));
      const y0 = Math.max(0, Math.floor(oy - r - 1)), y1 = Math.min(H - 1, Math.ceil(oy + f.s.h + r + 1));
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const lx = x - ox, ly = y - oy;
        let dm = Infinity;
        for (const [mx, my] of f.s.px) { const d = Math.hypot(lx - mx, ly - my); if (d < dm) dm = d; }
        const db = Math.max(0, Math.hypot((lx - cx) / rx, (ly - cy) / ry) - 1) * Math.min(rx, ry);
        const d = (1 - round) * dm + round * db;
        const c = d <= r - soft ? 1 : d >= r ? 0 : (r - d) / soft;
        if (c * strength > a[y * W + x]) a[y * W + x] = c * strength;
      }
    }
    return a;
  }

  /** Darken a W×H canvas by the shade `a`, as `blend`. A dither is pinned to the canvas so it does not crawl as a shadow moves. */
  function darken(ctx, W, H, a, blend) {
    const img = ctx.getImageData(0, 0, W, H), d = img.data;
    for (let i = 0; i < a.length; i++) {
      let v = a[i];
      if (!v) continue;
      if (blend === 'steps') v = Math.round(v * 4) / 4;
      else if (blend === 'dither') v = v * 16 > BAYER[(Math.floor(i / W) & 3) * 4 + (i % W & 3)] + 0.5 ? 1 : 0;
      if (v) for (let c = 0; c < 3; c++) d[i * 4 + c] = Math.round(d[i * 4 + c] * (1 - v + v * DARKEN[c]));
    }
    ctx.putImageData(img, 0, 0);
  }

  /** The shadows things at height `hc` cast on a W×H canvas, each `{ s, gx, gy, hc }`. */
  const castShadows = (ctx, W, H, casters, cast) => darken(ctx, W, H, shade(W, H, casters, cast), cast.blend);
  const drawAirborne = (ctx, flying) => { for (const f of [...flying].sort((a, b) => a.hc - b.hc)) drawSpr(ctx, f.s, f.gx, f.gy - f.h); };

  function drawFlying(ctx, W, H, flying, cast) {
    castShadows(ctx, W, H, flying, cast);
    drawAirborne(ctx, flying);
  }

  function drawTrash(ctx, B, list) {
    if (B.wrap === 'cell') {
      for (const [x, y] of B.cells) {
        const own = list.filter(q => q.cx === x && q.cy === y).map(q => q.p);
        if (own.length) drawPile(ctx, T, { pieces: own }, x * C, y * C, STYLE);
      }
    } else if (list.length) {
      const world = list.map(q => ({ ...q.p, x: q.p.x + q.cx * C, y: q.p.y + q.cy * C }));
      drawPile(ctx, T, { pieces: world.sort((a, b) => ORDER[a.layer] - ORDER[b.layer]) }, 0, 0, STYLE);
    }
  }
  function ground(ctx, B) {
    ctx.fillStyle = FLOOR; ctx.fillRect(0, 0, B.W, B.W);
    ctx.fillStyle = SEAM;
    for (let k = 0; k < B.N; k++) { ctx.fillRect(k * C + C - 1, 0, 1, B.W); ctx.fillRect(0, k * C + C - 1, B.W, 1); }
  }
  function walls(ctx, B) { for (let y = 0; y < B.N; y++) for (let x = 0; x < B.N; x++) if (cell(B.s, x, y).wall) wallTile(ctx, x, y, C); }

  function still(ctx, B, s, trash) {
    ground(ctx, B);
    drawTrash(ctx, B, trash);
    walls(ctx, B);
    for (let y = 0; y < B.N; y++) for (let x = 0; x < B.N; x++) {
      const spr = OBJ[cell(s, x, y).o];
      if (spr) drawSpr(ctx, spr, ...at(spr, x, y));
    }
    drawSpr(ctx, A.raccoon, ...at(A.raccoon, s.rac.x, s.rac.y));
  }

  /** The frame `t` ms after the push. */
  function frameAt(ctx, B, P, t, cast) {
    const since = t - TEAR;
    ground(ctx, B);
    drawTrash(ctx, B, P.filter(q => since >= q.land));
    walls(ctx, B);
    const key = KEYS.findLast(k => k.t <= t);
    if (key.body) {
      const spr = A[key.body], [x, y] = at(spr, B.bx, B.by);
      drawSpr(ctx, spr, x + B.dx * (key.nudge ?? 0), y + B.dy * (key.nudge ?? 0));
    }
    drawFlying(ctx, B.W, B.W, P.filter(q => since >= q.launch && since < q.land).map(q => inAir(q, since)), cast);
    const [rx, ry] = at(A.raccoon, B.bx - B.dx, B.by - B.dy);
    drawSpr(ctx, A.raccoon, rx + B.dx * key.lunge, ry + B.dy * key.lunge);
  }

  const endOf = f => Math.max(KEYS.at(-1).t, TEAR + f.last);
  return { setup, plan, still, frameAt, endOf, drawFlying, castShadows, drawAirborne, inAir, board, rest, drawTrash, ground, walls, drawSpr, at };
}
