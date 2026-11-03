// The clip of a bag he tears: it bulges, splits into scraps, and its trash and the scraps fly to
// the piles the tear spills. In 60 Hz frames, counted from the start of his move.
import { DIRS } from '../rules.js';
import { mulberry32 } from '../rng.js';
import { C } from './flight.js';
import { press } from './press.js';
import { drawPile, pileLayout, SHADOW } from './pile.js';
import { moved } from './stills.js';
import { stretch } from './stretch.js';
import { INK } from './tip.js';

/** `push` is the frame of his thud. `press` is the frames the bag swells before `rip`; `first` and
 *  `sfirst` are the frames from the rip to the first landing, `spread` and `sspread` from the first
 *  landing to the last. `squash`, `bulge`, `scatter` and the arcs are px; `flat` and `spin` are %;
 *  `turns` are eighths of a turn. */
export const RIP = { push: 7, rip: 3, press: 5, first: 6, spread: 10, sfirst: 4, sspread: 8, squash: 0, bulge: 2,
  fewest: 4, most: 10, sarc: 11, tumbles: 2, flat: 65, scatter: 5, ink: true, arc: 9, spin: 50, turns: 4 };

const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const quadOut = u => 1 - (1 - u) ** 2;
const seeded = (seed, i) => mulberry32((seed ^ Math.imul(i + 1, 2654435761)) >>> 0);

/** His push toward `dir` with the drive drawn out, a stride every two frames, so that the thud
 *  lands `push` frames into the move. */
export function tearPress(dir, push = RIP.push) {
  const fs = press('push', dir, { lead: false }).map(sg => sg.f);
  const slam = fs.find(f => f.name === 'slam'), drive = fs.find(f => f.name === 'drive'), thud = fs.find(f => f.name === 'thud');
  const strides = [drive, drive.alt], n = Math.max(1, Math.round((push - slam.fr) / 2));
  const drawn = fs.flatMap(f => (f === drive
    ? Array.from({ length: n }, (_, i) => ({ ...strides[i % 2], beat: drive.beat, fr: 2,
      dx: Math.round(slam.dx + (thud.dx - slam.dx) * (i + 1) / (n + 1)) }))
    : [f]));
  let t = 0;
  return drawn.map(f => ({ f, t0: t, t1: (t += f.fr) }));
}

/** The clip's keys, in frames from the start of the move. */
export function ripKeys(k = RIP) {
  const rip = k.rip, first = rip + Math.max(2, k.first), sfirst = rip + Math.max(2, k.sfirst);
  return { squash: rip - Math.max(0, k.press), rip, first, last: first + Math.max(0, k.spread),
    sfirst, slast: sfirst + Math.max(0, k.sspread) };
}

/** The clip for the bag drawing `BAG`, whose last row is the shadow it stands on. `LAY` and `STYLE`
 *  are the ones the piles are drawn with at rest, so the clip lands on the drawing the sprites make. */
export function createBagRip({ T, BAG, LAY, STYLE }) {
  const GRID = Array.from({ length: BAG.h }, () => Array(BAG.w).fill(null));
  for (const [x, y, c] of BAG.px) GRID[y][x] = c;
  const POSES = new Map();
  const poseOf = p => {
    const id = `${p.name}/${p.turn}`;
    if (!POSES.has(id)) POSES.set(id, T.poseOf(p.name, p.turn));
    return POSES.get(id);
  };

  /** `layers(t)` is the clip `t` frames into the move, as `{ kind, foot, px }`: `kind` is `bag`,
   *  `pile`, `shadow` or `air`, `foot` the row of room px it stands on, and `px` in px on the room.
   *  `piles[i]` is the `{ seed, scraps }` the sprite of the pile on `cells[i]` keeps once the clip
   *  is over: its layout seed, and the scraps under it in px on its cell. `end` is the first frame
   *  with everything at rest. */
  return ({ dir, bag: [bx, by], seed, cells, k = RIP }) => {
    const [dx, dy] = DIRS[dir], keys = ripKeys(k), rnd = mulberry32(seed);

    /** The bag `q` of the way into its squash. */
    const bagAt = q => {
      const across = dx !== 0, sq = Math.round(q * k.squash), bu = Math.round(q * k.bulge);
      const w = BAG.w + (across ? -sq : bu), h = BAG.h + (across ? bu : -sq);
      const rows = stretch(GRID, h, 1, 1).map(r => stretch(r, w, 1, 1));
      const x = bx * C + Math.floor((C - BAG.w) / 2) + (dx > 0 ? BAG.w - w : dx < 0 ? 0 : Math.floor((BAG.w - w) / 2));
      const y = by * C + C - BAG.h - 1 + (dy < 0 ? 0 : BAG.h - h);
      return { x, y, w, h, px: rows.flatMap((r, j) => r.flatMap((c, i) => (c ? [[i, j, c]] : []))) };
    };

    const piles = cells.map(([x, y]) => {
      const s = (rnd() * 2 ** 32) >>> 0;
      return { x, y, seed: s, pile: pileLayout(T, s, LAY) };
    });

    const scraps = (() => {
      const lo = Math.min(k.fewest, k.most), n = lo + Math.floor(rnd() * (Math.max(k.fewest, k.most) - lo + 1));
      const full = bagAt(1), body = full.px.filter(([, y]) => y < full.h - 1);
      const sites = [];
      while (sites.length < n) { const p = body[Math.floor(rnd() * body.length)]; if (!sites.includes(p)) sites.push(p); }
      const owner = new Map(body.map(([x, y]) => [`${x},${y}`, sites.reduce((best, [sx, sy], i) =>
        (Math.hypot(x - sx, y - sy) < Math.hypot(x - sites[best][0], y - sites[best][1]) ? i : best), 0)]));
      const order = piles.map((_, i) => [rnd(), i]).sort((p, q) => p[0] - q[0]).map(p => p[1]);
      return sites.map((_, i) => {
        const mine = body.filter(([x, y]) => owner.get(`${x},${y}`) === i);
        const torn = ([x, y]) => N4.some(([a, b]) => { const o = owner.get(`${x + a},${y + b}`); return o !== undefined && o !== i; });
        const x0 = Math.min(...mine.map(p => p[0])), y0 = Math.min(...mine.map(p => p[1]));
        const w = Math.max(...mine.map(p => p[0])) - x0 + 1, h = Math.max(...mine.map(p => p[1])) - y0 + 1;
        const grid = Array.from({ length: h }, () => Array(w).fill(null));
        for (const p of mine) grid[p[1] - y0][p[0] - x0] = k.ink && torn(p) ? INK : p[2];
        const to = order[i % order.length], { x, y, pile } = piles[to];
        return { grid, w, h, to, from: [full.x + x0 + w / 2, full.y + y0 + h / 2],
          at: [x * C + pile.cx + (rnd() - 0.5) * 2 * k.scatter, y * C + pile.cy + (rnd() - 0.5) * 2 * k.scatter],
          when: rnd(), lift: 0.7 + 0.6 * rnd() };
      });
    })();

    /** A scrap `u` of the way through its flight: its drawing, its top-left on the floor, and how high it is. */
    const scrapAt = (sc, u) => {
      const turn = Math.cos(Math.PI * k.tumbles * u), vh = sc.h * (1 + (k.flat / 100 - 1) * u) * Math.max(0.15, Math.abs(turn));
      const rows = stretch(sc.grid, Math.max(1, Math.round(vh)), 0, 0);
      const px = (turn < 0 && u < 1 ? rows.slice().reverse() : rows).flatMap((r, j) => r.flatMap((c, i) => (c ? [[i, j, c]] : [])));
      const cx = sc.from[0] + (sc.at[0] - sc.from[0]) * u, cy = sc.from[1] + (sc.at[1] - sc.from[1]) * u;
      return { px, x: Math.round(cx - sc.w / 2), y: Math.round(cy - vh / 2), vh, up: Math.round(k.sarc * sc.lift * 4 * u * (1 - u)) };
    };
    const landed = scraps.map(sc => { const s = scrapAt(sc, 1); return moved(s.px, s.x, s.y); });

    /** How piece `i` of a pile flies: when it lands (0..1 of the landing window), how high it arcs,
     *  how many eighths it turns, and how far from the middle of the bag it starts. */
    const flights = piles.map(({ seed: s, pile }) => pile.pieces.map((_, i) => {
      const r = seeded(s, i), v = [r(), r(), r(), r(), r(), r(), r()];
      return { when: v[0], lift: 0.6 + 0.8 * v[1], spin: v[2] * 100 < k.spin ? (1 + Math.floor(v[3] * k.turns)) * (v[4] < 0.5 ? -1 : 1) : 0,
        jitter: [(v[5] - 0.5) * 8, (v[6] - 0.5) * 6] };
    }));

    const DRAWN = new Map();
    const pileDrawing = (i, down) => {
      const id = `${i} ${down.length}`;
      if (!DRAWN.has(id)) {
        const out = [], p = piles[i];
        const rec = { fillStyle: '', fillRect(x, y) { out.push([x, y, this.fillStyle]); } };
        drawPile(rec, T, { ...p.pile, pieces: down }, p.x * C, p.y * C, STYLE);
        DRAWN.set(id, out);
      }
      return DRAWN.get(id);
    };

    const sx = bx * C + C / 2, sy = by * C + C - 1 - BAG.h / 2;
    function layers(t) {
      if (t < keys.rip) {
        const b = bagAt(quadOut(clamp((t - keys.squash) / Math.max(1, keys.rip - keys.squash), 0, 1)));
        return [{ kind: 'bag', foot: (by + 1) * C, px: moved(b.px, b.x, b.y) }];
      }
      const out = [], under = piles.map(() => []);
      const fly = (px, x, y, up, foot) => {
        if (up) out.push({ kind: 'shadow', foot, px: px.map(([a, b]) => [x + a, y + b, SHADOW]) });
        out.push({ kind: 'air', foot, px: moved(px, x, y - up) });
      };
      const downs = piles.map(({ x, y, pile }, i) => pile.pieces.filter((p, j) => {
        const fl = flights[i][j], land = keys.first + fl.when * (keys.last - keys.first), u = (t - keys.rip) / Math.max(1, land - keys.rip);
        if (u >= 1) return true;
        const rest = T.sprite(p.name, p.alt, p.turn), { m, k: at } = poseOf(p);
        const spr = T.sprite(p.name, p.alt, T.pose(p.name, m, at - Math.round(fl.spin * (1 - u))));
        const ox = sx + fl.jitter[0], oy = sy + fl.jitter[1], rx = x * C + p.x + rest.w / 2, ry = y * C + p.y + rest.h / 2;
        const gx = Math.round(ox + (rx - ox) * u - spr.w / 2), gy = Math.round(oy + (ry - oy) * u - spr.h / 2);
        fly(spr.px, gx, gy, Math.round(k.arc * fl.lift * 4 * u * (1 - u)), gy + spr.h);
        return false;
      }));
      scraps.forEach((sc, i) => {
        const land = keys.sfirst + sc.when * (keys.slast - keys.sfirst), u = clamp((t - keys.rip) / Math.max(1, land - keys.rip), 0, 1);
        if (u >= 1) { under[sc.to].push(...landed[i]); return; }
        const s = scrapAt(sc, u);
        fly(s.px, s.x, s.y, s.up, s.y + s.vh);
      });
      piles.forEach(({ y }, i) => {
        if (downs[i].length || under[i].length) out.push({ kind: 'pile', foot: (y + 1) * C, px: [...under[i], ...pileDrawing(i, downs[i])] });
      });
      return out;
    }

    const e = Math.max(keys.last, keys.slast);
    return {
      layers, end: e + (e % 2),
      piles: piles.map(({ x, y, seed: s }, i) => ({ seed: s,
        scraps: scraps.flatMap((sc, j) => (sc.to === i ? moved(landed[j], -x * C, -y * C) : [])) })),
    };
  };
}
