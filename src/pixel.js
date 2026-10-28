// The pixel art as a sprite set: the calls `createSprites` in sprites.js answers, drawn at C px a
// cell with every pixel whole. A position comes in cells and may be part way through a move; it
// is rounded to the pixel. A piece with no pixel art yet is drawn as a labelled placeholder.
import { C, FLOOR, SEAM } from './art/flight.js';
import { createTrash, pileLayout, drawPile } from './art/pile.js';
import { wallTile } from './art/room.js';
import { createStills } from './art/stills.js';
import { puddle, crossing } from './art/water.js';
import { deckAbove } from './art/skate.js';
import { door } from './art/door.js';
import { BARROW } from './art/barrow.js';
import { SPONGE } from './art/sponge.js';
import { CARDBOARD, wetCardboard } from './art/cardboard.js';
import { GRATE } from './art/grate.js';
import { ONEWAY } from './art/oneway.js';
import { TYRE } from './art/tyre.js';
import { bicycle } from './art/bicycle.js';
import { CHAIR } from './art/chair.js';
import { BROOM } from './art/broom.js';
import { CABINET, CABINET_OPEN } from './art/cabinet.js';
import { MAGNET } from './art/magnet.js';
import { LOOKS, slickCell } from './art/slick.js';
import { GLASS_LOOK, glassCell } from './art/glass.js';
import { ACTIONS, draw, mirror } from './art/cartoon.js';
import { VIEW, place } from './art/press.js';
import { cell, inGrid, CAN_FULL, CAN_EMPTY, BIN, BIN_EMPTY, JUG, JUG_EMPTY, WHEELIE, WHEELIE_EMPTY, PANE, GREASE, TAR, GLASS } from './rules.js';

export const PIXEL_CELL = C;

/** The art's data files, fetched relative to `base`, the URL of `src/art/`. */
export async function loadPixelArt(base) {
  const get = f => fetch(new URL(f, base)).then(r => { if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`); return r.json(); });
  const [A, D, LOOK, O] = await Promise.all(['assets.json', 'items.json', 'look.json', 'objects.json'].map(get));
  return { A, D, LOOK, O };
}

export function createPixelSprites({ ctx, art: { A, D, LOOK, O } }) {
  const T = createTrash(D, { accents: LOOK.accents, diagonals: LOOK.diagonals });
  const still = createStills({ T, A, O, LOOK });
  const STYLE = { outline: LOOK.outline, shadow: LOOK.shadow };
  const BIKE = bicycle();
  // The sitting frame of each facing, the way he sits between presses.
  const SIT = Object.fromEntries(['u', 'd', 'l', 'r'].map(d => {
    const s = draw(ACTIONS[VIEW[d]].crawl[0]);
    return [d, d === 'l' ? mirror(s) : s];
  }));
  let board = null;
  const wet = (x, y) => inGrid(board, x, y) && (cell(board, x, y).water || cell(board, x, y).bridge);
  const lane = ter => (x, y) => inGrid(board, x, y) && cell(board, x, y).ter === ter;

  const P = v => Math.round(v * C);
  const put = (px, x0, y0) => { for (const [a, b, col] of px) { ctx.fillStyle = col; ctx.fillRect(x0 + a, y0 + b, 1, 1); } };
  /** A sprite standing centred on cell (x, y), its foot a pixel above the cell's bottom edge. */
  const standing = (spr, x, y) => put(spr.px, P(x) + Math.floor((C - spr.w) / 2), P(y) + C - spr.h - 1);
  const thing = (o, x, y, seed) => { const s = still(o, 0, 0, seed); put(s.px, P(x) + s.x, P(y) + s.y); };
  const placeholder = (x, y, label, w = 1, h = 1) => {
    const x0 = P(x) + 2, y0 = P(y) + 2, W = w * C - 4, H = h * C - 4;
    ctx.fillStyle = '#5b5560'; ctx.fillRect(x0, y0, W, H);
    ctx.fillStyle = '#c9c1cc';
    ctx.fillRect(x0, y0, W, 1); ctx.fillRect(x0, y0 + H - 1, W, 1); ctx.fillRect(x0, y0, 1, H); ctx.fillRect(x0 + W - 1, y0, 1, H);
    ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x0 + W / 2, y0 + H / 2);
  };
  const span = cells => {
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
  };

  return {
    /** The board the ground is read from: whether a neighbouring cell is water. */
    setBoard(b) { board = b; },
    wall(x, y) { wallTile(ctx, x, y, C); },
    floor(x, y) {
      ctx.fillStyle = FLOOR; ctx.fillRect(P(x), P(y), C, C);
      ctx.fillStyle = SEAM; ctx.fillRect(P(x) + C - 1, P(y), 1, C); ctx.fillRect(P(x), P(y) + C - 1, C, 1);
    },
    water(x, y, filled, seed = 0, fill = 0) {
      this.floor(x, y);
      put(filled || fill >= 1 ? crossing(T, x, y, C, wet, 6) : puddle(x, y, C, wet), 0, 0);
    },
    grease(x, y) { this.floor(x, y); put(slickCell(x, y, lane(GREASE), LOOKS.grease), P(x), P(y)); },
    tar(x, y) { this.floor(x, y); put(slickCell(x, y, lane(TAR), LOOKS.tar), P(x), P(y)); },
    glass(x, y) { this.floor(x, y); put(glassCell(x, y, lane(GLASS), GLASS_LOOK), P(x), P(y)); },
    // A covered cell is the cardboard lying soaked where it went down, each cell its own soak.
    covered(x, y) { this.floor(x, y); put(wetCardboard(Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)).px, P(x), P(y)); },
    grate(x, y) { this.floor(x, y); put(GRATE.px, P(x), P(y)); },
    oneway(x, y, dir) { this.floor(x, y); put(ONEWAY[dir].px, P(x), P(y)); },
    /** `roll` is how far the shutter is up and the shimmer's frame; without one it is at rest. */
    exit(x, y, lit, dir, roll = { open: lit ? 1 : 0, frame: 0 }) { put(door(roll.open, roll.frame), P(x), P(y)); },

    trash(x, y, { seed = 0, k = 1 } = {}) {
      const pile = pileLayout(T, seed, { min: LOOK.min, max: LOOK.max, C, spill: LOOK.spill });
      // A burst being refused: its pieces come out and go back in, so only some are down.
      const pieces = k >= 1 ? pile.pieces : pile.pieces.slice(0, Math.round(pile.pieces.length * k));
      drawPile(ctx, T, { ...pile, pieces }, P(x), P(y), STYLE);
    },
    bag(x, y, k = 1) { if (k > 0) standing(k > 0.66 ? A.bag : k > 0.33 ? A.open : A.burst, x, y); },
    can(x, y, full) { thing(full ? CAN_FULL : CAN_EMPTY, x, y); },
    recycleBin(x, y, full, seed = 1) { thing(full ? BIN : BIN_EMPTY, x, y, seed); },
    jug(x, y, full = true) { thing(full ? JUG : JUG_EMPTY, x, y); },
    wheelie(x, y, full) { thing(full ? WHEELIE : WHEELIE_EMPTY, x, y); },
    pane(x, y) { thing(PANE, x, y); },
    skateboard(cells, ox = 0, oy = 0) {
      const s = span(cells);
      put(deckAbove(s.w > 1 ? 'x' : 'y'), P(s.x + ox), P(s.y + oy));
    },
    furniture(cells, ox = 0, oy = 0) {
      const s = span(cells);
      if (s.w === 2 && s.h === 1) put(O.couch.px, P(s.x + ox) + Math.floor((2 * C - O.couch.w) / 2), P(s.y + oy) + C - O.couch.h - 1);
      else placeholder(s.x + ox, s.y + oy, 'couch', s.w, s.h);
    },
    raccoon(x, y, heading = 'd') { standing(SIT[heading], x, y); },
    /** He mid-press: drawing `seg` toward `dir` from cell (x, y). `stay`: he ends on the cell he
     *  started from, so the drawing gives up its travel forward. `over` draws only the parts that go
     *  in front of what he pushes. */
    pressing(seg, dir, x, y, { stay = false, over = false } = {}) {
      const p = place(stay && seg.f.dx > 0 ? { f: { ...seg.f, dx: 0 } } : seg, dir, x, y);
      put(over ? p.over : p.px, p.x, p.y);
    },
    splash(x, y) { placeholder(x, y, 'splash'); },

    sponge(x, y) { standing(SPONGE, x, y); },
    cardboard(x, y) { put(CARDBOARD.px, P(x), P(y)); },
    tyre(x, y, horizontal) { standing(TYRE[horizontal ? 'H' : 'V'], x, y); },
    chair(x, y) { standing(CHAIR, x, y); },
    broom(x, y) { standing(BROOM, x, y); },
    magnet(x, y, face) { standing(MAGNET[face], x, y); },
    barrow(x, y, face) { standing(BARROW[face], x, y); },
    cabinet(x, y, face, open) {
      const s = (open ? CABINET_OPEN : CABINET)[face];
      put(s.px, P(x) + Math.floor(C / 2) - s.ax, P(y) + C - s.foot - 2);
    },
    // The open cabinet's drawing carries its drawer.
    drawer() {},
    bicycle(cells, ox = 0, oy = 0) {
      const s = span(cells);
      const b = s.h > 1 ? BIKE.up : BIKE.side;
      put(b.px, P(s.x + ox) + Math.floor((s.w * C - b.w) / 2), P(s.y + oy) + s.h * C - b.h - 1);
    },
    rug(cells, ox = 0, oy = 0) { const s = span(cells); placeholder(s.x + ox, s.y + oy, 'rug', s.w, s.h); },
    hold(x0, y0, x1, y1) {
      ctx.fillStyle = '#d6d3b0';
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * C;
      for (let i = 0; i <= n; i += 2) ctx.fillRect(P(x0 + 0.5 + (x1 - x0) * i / n), P(y0 + 0.5 + (y1 - y0) * i / n), 1, 1);
    },
    grip(x, y) { ctx.fillStyle = '#ffcf00'; ctx.fillRect(P(x + 0.5) - 1, P(y + 0.5) - 1, 3, 3); },
  };
}
