// `bagRip.js` is the clip of a bag he tears, in 60 Hz frames from the start of his move.
import { DIRS } from '../rules.js';
import { mulberry32 } from '../rng.js';
import { C } from './flight.js';
import { press } from './press.js';
import { pileLayout, SHADOW } from './pile.js';
import { moved } from './stills.js';
import { stretch } from './stretch.js';
import { INK } from './tip.js';
import { createToPile } from './toPile.js';
import { N4 } from './spread.js';
import { arc, evenEnd, quadOut } from './timing.js';

/** The keys are frames, except `squash`, `bulge`, `scatter` and the arcs (px), `flat` and `spin` (%), `turns` (eighths of a turn), and `fewest`, `most` and `tumbles` (counts). */
export const RIP = { push: 7, rip: 3, press: 5, first: 6, spread: 10, sfirst: 4, sspread: 8, squash: 0, bulge: 2,
  fewest: 4, most: 10, sarc: 11, tumbles: 2, flat: 65, scatter: 5, ink: true, arc: 9, spin: 50, turns: 4 };

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/** Returns his push toward `dir` as drawing frames `{ f, t0, t1 }`, with `t0` and `t1` in 60 Hz frames from the start of the push. The drive repeats to fill the time up to the thud, so the thud lands at frame `push`. */
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

/** The clip's keys are in frames from the start of the move. */
export function ripKeys(k = RIP) {
  const rip = k.rip, first = rip + Math.max(2, k.first), sfirst = rip + Math.max(2, k.sfirst);
  return { squash: rip - Math.max(0, k.press), rip, first, last: first + Math.max(0, k.spread),
    sfirst, slast: sfirst + Math.max(0, k.sspread) };
}

/** Returns the clip for the bag drawing `BAG`, whose last row is the shadow it stands on. `LAY` and `STYLE`
 *  are the ones the piles are drawn with at rest, so the clip lands on the drawing the sprites make. */
export function createBagRip({ T, BAG, LAY, STYLE }) {
  const GRID = Array.from({ length: BAG.h }, () => Array(BAG.w).fill(null));
  for (const [x, y, c] of BAG.px) GRID[y][x] = c;
  const toPile = createToPile({ T, LAY, STYLE });

  /** `layers(t)` is the clip `t` frames into the move, as `{ kind, foot, px }`: `kind` is `bag`,
   *  `pile`, `shadow` or `air`, `foot` the row of room px it stands on, and `px` in px on the room.
   *  `piles[i]` is the `{ seed, scraps }` the sprite of the pile on `cells[i]` keeps once the clip
   *  is over: its layout seed, and the scraps under it in px on its cell. `end` is the first frame
   *  with everything at rest. */
  return ({ dir, bag: [bx, by], seed, cells, k = RIP }) => {
    const [dx, dy] = DIRS[dir], keys = ripKeys(k), rnd = mulberry32(seed);

    /** Returns the bag drawn `q` of the way into its squash, `q` from 0 to 1. */
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

    /** Returns the scrap `u` of the way through its flight as `{ px, x, y, vh, up }`: its drawing, its top-left, its visible height and its lift in px. */
    const scrapAt = (sc, u) => {
      const turn = Math.cos(Math.PI * k.tumbles * u), vh = sc.h * (1 + (k.flat / 100 - 1) * u) * Math.max(0.15, Math.abs(turn));
      const rows = stretch(sc.grid, Math.max(1, Math.round(vh)), 0, 0);
      const px = (turn < 0 && u < 1 ? rows.slice().reverse() : rows).flatMap((r, j) => r.flatMap((c, i) => (c ? [[i, j, c]] : [])));
      const cx = sc.from[0] + (sc.at[0] - sc.from[0]) * u, cy = sc.from[1] + (sc.at[1] - sc.from[1]) * u;
      return { px, x: Math.round(cx - sc.w / 2), y: Math.round(cy - vh / 2), vh, up: Math.round(arc(u, k.sarc * sc.lift)) };
    };
    const landed = scraps.map(sc => { const s = scrapAt(sc, 1); return moved(s.px, s.x, s.y); });

    const fling = toPile({ piles, from: [bx * C + C / 2, by * C + C - 1 - BAG.h / 2], go: keys.rip, first: keys.first, last: keys.last, k });
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
      const flung = fling.at(t);
      for (const a of flung.air) fly(a.px, a.x, a.y, a.up, a.foot);
      scraps.forEach((sc, i) => {
        const land = keys.sfirst + sc.when * (keys.slast - keys.sfirst), u = clamp((t - keys.rip) / Math.max(1, land - keys.rip), 0, 1);
        if (u >= 1) { under[sc.to].push(...landed[i]); return; }
        const s = scrapAt(sc, u);
        fly(s.px, s.x, s.y, s.up, s.y + s.vh);
      });
      piles.forEach(({ y }, i) => {
        if (flung.piles[i].length || under[i].length) out.push({ kind: 'pile', foot: (y + 1) * C, px: [...under[i], ...flung.piles[i]] });
      });
      return out;
    }

    const e = Math.max(keys.last, keys.slast);
    return {
      layers, end: evenEnd(e),
      piles: piles.map(({ x, y, seed: s }, i) => ({ seed: s,
        scraps: scraps.flatMap((sc, j) => (sc.to === i ? moved(landed[j], -x * C, -y * C) : [])) })),
    };
  };
}
