// The board, as compositor layers. Each honors the one contract — { name, draw(ctx, frame) }
// — and is added with `compositor.add(...)`, so a new pass (a CRT filter, a hint overlay, the
// studio mark) is a new module rather than an edit to a draw loop.
//
// The frame every layer reads:
//   { state, refusal, motion, blocked, armed, confetti }
// `state` is the board as the rules left it. The other four are presentation only: none of
// them is ever a board state, which is exactly why a refusal can show an illegal overlap
// without the player ever being in one.

import {
  BAG, CAN_FULL, CAN_EMPTY, DIRS, DIR_ORDER, bagsLeft, bridged, cell, fan, inGrid,
} from './rules.mjs';
import { BOARD } from './theme.js';
import { confettiAt, confettiAlpha } from './anim.js';
import {
  drawFloor, drawWater, drawExit, exitArrowDir, drawOccupant, drawTrash, drawBag,
  drawRaccoon, drawFanTint, drawLanding, drawAim, drawBlocked, drawEdgeBar, drawConfettiBit,
} from './sprites.js';

const key = (x, y) => `${x},${y}`;
// How many cells ahead of an armed shove to mark: the can itself, and for a full one the
// bag it ejects a cell further. Keyed by the engine's codes so the preview cannot disagree
// with what `explain()` will actually do.
const LANDINGS = { [CAN_FULL]: 2, [CAN_EMPTY]: 1 };

/** Layer 0: the ground — floor, canal, and the way out. Nothing here ever moves. */
export function createTerrainLayer() {
  return {
    name: 'terrain',
    draw(ctx, { state: s }) {
      const lit = bagsLeft(s) === 0;
      for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) {
        const c = cell(s, x, y);
        if (c.wall) continue;
        // Water is terrain with two looks, and the second one is the whole lesson: open
        // canal he won't cross, or the same cell full of his own trash and walkable.
        if (c.water) { drawWater(ctx, x, y, bridged(c)); continue; }
        drawFloor(ctx, x, y);
        if (c.exit) drawExit(ctx, x, y, lit, exitArrowDir(s.cols, s.rows, x, y));
      }
    },
  };
}

/** Layer 1: everything that can be somewhere else next frame, the raccoon included. */
export function createPiecesLayer() {
  return {
    name: 'pieces',
    draw(ctx, { state: s, refusal, motion }) {
      const ph = refusal?.phase ?? null;
      for (let y = 0; y < s.rows; y++) for (let x = 0; x < s.cols; x++) {
        const c = cell(s, x, y);
        if (c.wall || c.water) continue;                     // water draws its own contents
        if (motion?.hide.has(key(x, y))) continue;           // in flight — drawn below
        // A bag mid-refusal deflates as its phantom burst grows; everything else is at rest.
        const deflate = ph && refusal.bx === x && refusal.by === y ? 1 - ph.burst : 1;
        drawOccupant(ctx, c.o, x, y, deflate);
      }

      // The debris of a burst that is being refused: it flies out, reaches the cell that
      // won't take it, and retracts. None of it is board state.
      if (ph) for (const [x, y] of refusal.cells)
        if (inGrid(s, x, y) && !cell(s, x, y).wall) drawTrash(ctx, x, y, ph.burst, [refusal.bx, refusal.by]);

      // Pieces in flight: a torn bag deflating as its fan grows, a shoved can crossing the
      // gap, an ejected bag sailing past it. Drawn from where they were toward where they are.
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

/**
 * Layer 2: what the board is telling you — where a strike would land, what you have aimed,
 * and what it just refused. Over everything, including the exit sign: Law 1.7 says a dead
 * end must be foreseeable, and an exit trap only is if you can SEE the trash land.
 */
export function createGuidesLayer() {
  return {
    name: 'guides',
    draw(ctx, { state: s, refusal, motion, blocked, armed, preview }) {
      // The fan preview belongs to the rooms that teach the fan (`:preview on`, L1-L3).
      // After that you know the shape, and reading it off the board is the game. Where it
      // is on, aiming FOCUSES it: while armed, one direction draws, so two adjacent bags
      // are not ten yellow cells at once. Red is not a second opinion about the fan; it
      // belongs to the one cell doing the blocking, and only once you have tried.
      const red = new Set((blocked?.cells ?? []).map(([x, y]) => key(x, y)));
      const previews = !preview || refusal || motion ? [] : armed ? [armed] : DIR_ORDER;
      for (const dir of previews) {
        const [dx, dy] = DIRS[dir];
        const bx = s.rac.x + dx, by = s.rac.y + dy;
        if (!inGrid(s, bx, by) || cell(s, bx, by).o !== BAG) continue;   // bags only
        for (const [fx, fy] of fan(bx, by, dx, dy))
          if (inGrid(s, fx, fy) && !red.has(key(fx, fy))) drawFanTint(ctx, fx, fy);
      }

      if (armed) {
        const [dx, dy] = DIRS[armed];
        const ax = s.rac.x + dx, ay = s.rac.y + dy;
        // A push is as permanent as a tear, so it gets the same look-before-you-commit:
        // show where the piece lands, and for a full can where its ejected bag lands too.
        for (let n = 1; n <= (LANDINGS[cell(s, ax, ay).o] ?? 0); n++)
          if (inGrid(s, ax + n * dx, ay + n * dy)) drawLanding(ctx, ax + n * dx, ay + n * dy);
        drawAim(ctx, ax, ay, dx, dy);
      }

      // Blocked: you TRIED it and the rules said no. Held back until the refusal animation
      // reaches its flash, so the mark lands with the sound rather than ahead of the lunge.
      if (blocked && (!refusal?.phase || refusal.phase.flash)) {
        for (const [bx, by] of blocked.cells) drawBlocked(ctx, bx, by);
        if (!blocked.cells.length) drawEdgeBar(ctx, s.rac.x, s.rac.y, DIRS[blocked.dir]);
      }
    },
  };
}

/** Layer 3: the room is finished and nothing else needs reading, so this goes over all of it. */
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

/** The stack, in draw order. One call site owns which passes the game runs. */
export const boardLayers = () => [
  createTerrainLayer(), createPiecesLayer(), createGuidesLayer(), createConfettiLayer(),
];
