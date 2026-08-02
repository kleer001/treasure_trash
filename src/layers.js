// The board's four compositor passes. Each reads only the frame it is handed:
// { state, refusal, motion, blocked, armed, preview, confetti }.

import {
  BAG, CAN_FULL, CAN_EMPTY, DIRS, DIR_ORDER, bagsLeft, bridged, cell, fan, forEachCell, inGrid,
} from './rules.mjs';
import { BOARD } from './theme.js';
import { confettiAt, confettiAlpha } from './anim.js';
import {
  drawFloor, drawWater, drawExit, exitArrowDir, drawOccupant, drawTrash, drawBag,
  drawRaccoon, drawFanTint, drawLanding, drawAim, drawBlocked, drawEdgeBar, drawConfettiBit,
} from './sprites.js';

const key = (x, y) => `${x},${y}`;
const LANDINGS = { [CAN_FULL]: 2, [CAN_EMPTY]: 1 };

/** Floor, canal and exit sign. */
export function createTerrainLayer() {
  return {
    name: 'terrain',
    draw(ctx, { state: s }) {
      const lit = bagsLeft(s) === 0;
      forEachCell(s, (c, x, y) => {
        if (c.wall) return;
        if (c.water) { drawWater(ctx, x, y, bridged(c)); return; }
        drawFloor(ctx, x, y);
        if (c.exit) drawExit(ctx, x, y, lit, exitArrowDir(s.cols, s.rows, x, y));
      });
    },
  };
}

/** Occupants at rest, pieces in flight, refused debris, and the raccoon. */
export function createPiecesLayer() {
  return {
    name: 'pieces',
    draw(ctx, { state: s, refusal, motion }) {
      const ph = refusal?.phase ?? null;
      forEachCell(s, (c, x, y) => {
        if (c.wall || c.water || motion?.hide.has(key(x, y))) return;
        const deflate = ph && refusal.bx === x && refusal.by === y ? 1 - ph.burst : 1;
        drawOccupant(ctx, c.o, x, y, deflate);
      });

      if (ph) for (const [x, y] of refusal.cells)
        if (inGrid(s, x, y) && !cell(s, x, y).wall) drawTrash(ctx, x, y, ph.burst, [refusal.bx, refusal.by]);

      if (motion) for (const p of motion.parts) {
        const x = p.from[0] + (p.to[0] - p.from[0]) * motion.t;
        const y = p.from[1] + (p.to[1] - p.from[1]) * motion.t;
        if (p.what === 'trash') drawTrash(ctx, p.from[0], p.from[1], motion.t, p.src);
        else if (p.what === 'bag') drawBag(ctx, x, y, 1 - motion.t);
        else drawOccupant(ctx, p.o, x, y);
      }

      if (ph) {
        const k = ph.lunge * 0.42;
        drawRaccoon(ctx, s.rac.x + refusal.dx * k, s.rac.y + refusal.dy * k);
      } else if (motion) {
        const [ax, ay, bx, by] = motion.rac;
        drawRaccoon(ctx, ax + (bx - ax) * motion.t, ay + (by - ay) * motion.t);
      } else {
        drawRaccoon(ctx, s.rac.x, s.rac.y);
      }
    },
  };
}

/** Fan preview, aim ring, landing markers and the red blame cells, over everything. */
export function createGuidesLayer() {
  return {
    name: 'guides',
    draw(ctx, { state: s, refusal, motion, blocked, armed, preview }) {
      const red = new Set((blocked?.cells ?? []).map(([x, y]) => key(x, y)));
      const previews = !preview || refusal || motion ? [] : armed ? [armed] : DIR_ORDER;
      for (const dir of previews) {
        const [dx, dy] = DIRS[dir];
        const bx = s.rac.x + dx, by = s.rac.y + dy;
        if (!inGrid(s, bx, by) || cell(s, bx, by).o !== BAG) continue;
        for (const [fx, fy] of fan(bx, by, dx, dy))
          if (inGrid(s, fx, fy) && !red.has(key(fx, fy))) drawFanTint(ctx, fx, fy);
      }

      if (armed) {
        const [dx, dy] = DIRS[armed];
        const ax = s.rac.x + dx, ay = s.rac.y + dy;
        for (let n = 1; n <= (LANDINGS[cell(s, ax, ay).o] ?? 0); n++)
          if (inGrid(s, ax + n * dx, ay + n * dy)) drawLanding(ctx, ax + n * dx, ay + n * dy);
        drawAim(ctx, ax, ay, dx, dy);
      }

      if (blocked && (!refusal?.phase || refusal.phase.flash)) {
        for (const [bx, by] of blocked.cells) drawBlocked(ctx, bx, by);
        if (!blocked.cells.length) drawEdgeBar(ctx, s.rac.x, s.rac.y, DIRS[blocked.dir]);
      }
    },
  };
}

/** The win blast. */
export function createConfettiLayer() {
  return {
    name: 'confetti',
    draw(ctx, { confetti }) {
      if (!confetti) return;
      const cx = (confetti.x + .5) * BOARD.cell, cy = (confetti.y + .5) * BOARD.cell;
      ctx.globalAlpha = confettiAlpha(confetti.t);
      for (const bit of confetti.bits) {
        const p = confettiAt(bit, confetti.t);
        drawConfettiBit(ctx, bit, cx + p.dx, cy + p.dy, p.rot);
      }
    },
  };
}

/** The stack, in draw order. */
export const boardLayers = () => [
  createTerrainLayer(), createPiecesLayer(), createGuidesLayer(), createConfettiLayer(),
];
