// `toPile.js` flies pieces of trash from one point into the piles they land as, in 60 Hz frames.
import { mulberry32 } from '../rng.js';
import { C } from './flight.js';
import { drawPile, pileLayout } from './pile.js';
import { arc } from './timing.js';

const seeded = (seed, i) => mulberry32((seed ^ Math.imul(i + 1, 2654435761)) >>> 0);

/** Lays piles as `LAY` and draws them in `STYLE`, as the pile sprites lay and draw them at rest. */
export function createToPile({ T, LAY, STYLE }) {
  const POSES = new Map();
  const poseOf = p => {
    const id = `${p.name}/${p.turn}`;
    if (!POSES.has(id)) POSES.set(id, T.poseOf(p.name, p.turn));
    return POSES.get(id);
  };

  /** Takes the piles `{ x, y, seed }`. Each pile's pieces fly from px `from` at frame `go`.
   *  They land from frame `first` to frame `last`. `k.arc` is the flight height in px.
   *  `k.spin` is the % of pieces that turn. `k.turns` is the most eighths of a turn a piece turns.
   *  `at(t)` returns `{ air, piles }`. Each piece in the air is `{ px, x, y, up, foot }`: `px` is its pixels from (x, y) on the floor, and `up` is how many px above it it is.
   *  Each pile gives its landed pieces as `px` on the room. */
  return ({ piles, from: [sx, sy], go, first, last, k }) => {
    const laid = piles.map(p => ({ ...p, pile: pileLayout(T, p.seed, LAY) }));
    const flights = laid.map(({ seed, pile }) => pile.pieces.map((_, i) => {
      const r = seeded(seed, i), v = [r(), r(), r(), r(), r(), r(), r()];
      return { when: v[0], lift: 0.6 + 0.8 * v[1], spin: v[2] * 100 < k.spin ? (1 + Math.floor(v[3] * k.turns)) * (v[4] < 0.5 ? -1 : 1) : 0,
        jitter: [(v[5] - 0.5) * 8, (v[6] - 0.5) * 6] };
    }));
    const DRAWN = new Map();
    const pileDrawing = (i, down) => {
      const id = `${i} ${down.length}`;
      if (!DRAWN.has(id)) {
        const out = [], p = laid[i];
        const rec = { fillStyle: '', fillRect(x, y) { out.push([x, y, this.fillStyle]); } };
        drawPile(rec, T, { ...p.pile, pieces: down }, p.x * C, p.y * C, STYLE);
        DRAWN.set(id, out);
      }
      return DRAWN.get(id);
    };
    function at(t) {
      const air = [];
      const downs = laid.map(({ x, y, pile }, i) => pile.pieces.filter((p, j) => {
        const fl = flights[i][j], land = first + fl.when * (last - first), u = (t - go) / Math.max(1, land - go);
        if (u >= 1) return true;
        if (u < 0) return false;
        const rest = T.sprite(p.name, p.alt, p.turn), { m, k: turn } = poseOf(p);
        const spr = T.sprite(p.name, p.alt, T.pose(p.name, m, turn - Math.round(fl.spin * (1 - u))));
        const ox = sx + fl.jitter[0], oy = sy + fl.jitter[1], rx = x * C + p.x + rest.w / 2, ry = y * C + p.y + rest.h / 2;
        const gx = Math.round(ox + (rx - ox) * u - spr.w / 2), gy = Math.round(oy + (ry - oy) * u - spr.h / 2);
        air.push({ px: spr.px, x: gx, y: gy, up: Math.round(arc(u, k.arc * fl.lift)), foot: gy + spr.h });
        return false;
      }));
      return { air, piles: laid.map((_, i) => pileDrawing(i, downs[i])) };
    }
    return { at, laid };
  };
}
