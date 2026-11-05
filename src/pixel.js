// The pixel art as a sprite set: the calls `createSprites` in sprites.js answers, drawn at C px a
// cell with every pixel whole. A position comes in cells and may be part way through a move; it
// is rounded to the pixel.
import { C, FLOOR, SEAM } from './art/flight.js';
import { createTrash, pileLayout, drawPile } from './art/pile.js';
import { wallTile } from './art/room.js';
import { createStills } from './art/stills.js';
import { createCanTip } from './art/canTip.js';
import { createJugTip, bakedJug } from './art/jugTip.js';
import { createBagRip } from './art/bagRip.js';
import { createBoxTip } from './art/boxTip.js';
import { paneShatter } from './art/paneShatter.js';
import { puddle, crossing, outline } from './art/water.js';
import { FLOAT, afloat, bobbing, bobEnd, waterline } from './art/afloat.js';
import { SKATEBOARD } from './art/skateboard.js';
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
import { RUG, TURNS } from './art/rug.js';
import { COUCH } from './art/couch.js';
import { MAGNET } from './art/magnet.js';
import { LOOKS, slickCell } from './art/slick.js';
import { GLASS_LOOK, glassCell } from './art/glass.js';
import { ACTIONS, draw, mirror } from './art/cartoon.js';
import { VIEW, place } from './art/press.js';
import { cell, inGrid, BAG, CAN_FULL, CAN_EMPTY, BIN, BIN_EMPTY, JUG, JUG_EMPTY, WHEELIE_EMPTY, PANE, GREASE, TAR, GLASS } from './rules.js';

export const PIXEL_CELL = C;

/** The art's data files, fetched relative to `base`, the URL of `src/art/`. */
export async function loadPixelArt(base) {
  const get = f => fetch(new URL(f, base)).then(r => { if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`); return r.json(); });
  const [A, D, LOOK, O, W, J] = await Promise.all(['assets.json', 'items.json', 'look.json', 'objects.json', 'wheelie.json', 'jug.json'].map(get));
  return { A, D, LOOK, O, W, J };
}

export function createPixelSprites({ ctx, art: { A, D, LOOK, O, W, J } }) {
  const T = createTrash(D, { accents: LOOK.accents, diagonals: LOOK.diagonals });
  const still = createStills({ T, A, O, LOOK, J });
  const tipClip = createCanTip(A.bag);
  const pourClip = createJugTip({ drawing: bakedJug(J).drawing, full: J.full, dy: J.dy });
  const STYLE = { outline: LOOK.outline, shadow: LOOK.shadow }, LAY = { min: LOOK.min, max: LOOK.max, C, spill: LOOK.spill };
  const ripClip = createBagRip({ T, BAG: A.bag, LAY, STYLE });
  const boxClip = createBoxTip({ T, still, LAY, STYLE, SPREAD: LOOK.spread });
  const BIKE = bicycle();
  // The sitting frame of each facing, which he holds between presses.
  const SIT = Object.fromEntries(['u', 'd', 'l', 'r'].map(d => {
    const s = draw(ACTIONS[VIEW[d]].crawl[0]);
    return [d, d === 'l' ? mirror(s) : s];
  }));
  let board = null;
  const wet = (x, y) => inGrid(board, x, y) && (cell(board, x, y).water || cell(board, x, y).bridge);
  const lane = ter => (x, y) => inGrid(board, x, y) && cell(board, x, y).ter === ter;

  const P = v => Math.round(v * C);
  const put = (px, x0, y0) => { for (const [a, b, col] of px) { ctx.fillStyle = col; ctx.fillRect(x0 + a, y0 + b, 1, 1); } };
  const standing = (spr, x, y) => put(spr.px, P(x) + Math.floor((C - spr.w) / 2), P(y) + C - spr.h - 1);
  // Each water cell's outline gives the pixels of the room that are water.
  let shores = new Map(), shoresOf = null;
  const shore = (cx, cy) => {
    if (shoresOf !== board) { shores = new Map(); shoresOf = board; }
    const id = `${cx},${cy}`;
    if (!shores.has(id)) {
      const c = inGrid(board, cx, cy) && cell(board, cx, cy);
      shores.set(id, c && c.water && !c.bridge ? outline(cx, cy, C, wet) : null);
    }
    return shores.get(id);
  };
  const water = {
    wet: (x, y) => { const cx = Math.floor(x / C), cy = Math.floor(y / C); return !!shore(cx, cy)?.inside(x - cx * C, y - cy * C); },
    open: (x, y) => { const cx = Math.floor(x / C), cy = Math.floor(y / C), s = shore(cx, cy); return !!s?.inside(x - cx * C, y - cy * C) && !s.rim(x - cx * C, y - cy * C); },
  };
  /** How far into the water a thing drawn at (x, y) has come, 0 to 1. */
  const afloatAt = (x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y), fx = x - x0, fy = y - y0, w = (cx, cy) => (shore(cx, cy) ? 1 : 0);
    return (1 - fx) * (1 - fy) * w(x0, y0) + fx * (1 - fy) * w(x0 + 1, y0) + (1 - fx) * fy * w(x0, y0 + 1) + fx * fy * w(x0 + 1, y0 + 1);
  };
  /** Thing `o` drawn at (x, y) as far into the water as it has come: its sprite `s`, `w` px wide,
   *  its top-left `x0, y0` and its waterline `yw`. The bag's last row is the shadow it stands on. */
  const floating = (o, x, y, seed, lie) => {
    const st = still(o, 0, 0, seed, lie), a = afloatAt(x, y);
    const s = o === BAG && a >= 1 ? { ...st, px: st.px.filter(p => p[1] < st.h - 1) } : st;
    const x0 = P(x) + st.x, y0 = P(y) + st.y + Math.round(FLOAT.drop * a);
    return { a, s, w: Math.max(...s.px.map(p => p[0])) + 1, x0, y0, yw: waterline(s, y0) };
  };
  const thing = (o, x, y, seed, lie) => {
    const fl = floating(o, x, y, seed, lie);
    put(fl.a ? afloat(fl.s, fl.x0, fl.y0, fl.yw, water) : fl.s.px.map(([a, b, c]) => [fl.x0 + a, fl.y0 + b, c]), 0, 0);
  };
  const placeholder = (x, y, label, w = 1, h = 1) => {
    const x0 = P(x) + 2, y0 = P(y) + 2, W = w * C - 4, H = h * C - 4;
    ctx.fillStyle = '#5b5560'; ctx.fillRect(x0, y0, W, H);
    ctx.fillStyle = '#c9c1cc';
    ctx.fillRect(x0, y0, W, 1); ctx.fillRect(x0, y0 + H - 1, W, 1); ctx.fillRect(x0, y0, 1, H); ctx.fillRect(x0 + W - 1, y0, 1, H);
    ctx.font = '7px monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x0 + W / 2, y0 + H / 2);
  };
  // The wheelie bin's drawings, rendered from its 3D model. Its pixels are two hex digits into the
  // palette, '..' for none.
  const decoded = new Map();
  const wheelieFrame = f => {
    if (!decoded.has(f)) decoded.set(f, f.rows.flatMap((r, y) => Array.from({ length: f.w }, (_, x) => r.slice(2 * x, 2 * x + 2))
      .flatMap((h, x) => (h === '..' ? [] : [[f.x + x, f.y + y, W.palette[parseInt(h, 16)]]]))));
    return decoded.get(f);
  };
  const drawLayers = (layers, f, along) => { for (const [, px] of layers(f, along).sort((a, b) => a[0] - b[0])) put(px, 0, 0); };
  /** The clip of a container that has just emptied onto cell `shedTo`, keyed by what it is once it
   *  has: `{ end, draw(f) }`, drawn `f` screen frames from the start of its move, and `ground(f)`, what
   *  lies on that cell's floor, for one whose clip draws it; `null` when it cannot draw where its
   *  contents went. */
  const DUMPS = {
    [CAN_EMPTY]: ({ container, from, to, shedTo, moveFrames, down }) => {
      const { layers, end } = tipClip({ dir: container.lie, from, to, bagTo: shedTo, moveFrames, down });
      return { end, draw: f => drawLayers(layers, f, container.along) };
    },
    [JUG_EMPTY]: ({ container, from, to, shedTo: [wx, wy], moveFrames }) => {
      const { layers, ground, end } = pourClip({ dir: container.lie, from, to, wetAt: [wx, wy], moveFrames,
        wet: (x, y) => (x === wx && y === wy) || wet(x, y) });
      return { end, draw: f => drawLayers(layers, f, container.along), ground: f => put(ground(f) ?? [], 0, 0) };
    },
    [BIN_EMPTY]: ({ container, shed, from, to, shedTo, moveFrames, down }) => {
      if (down) return null;
      const { layers, end } = boxClip({ dir: container.lie, from, to, pileAt: shedTo, seed: container.seed, pileSeed: shed.seed, moveFrames });
      return { end, draw: f => drawLayers(layers, f, container.along) };
    },
    [WHEELIE_EMPTY]: ({ container: c, down }) => (down ? null : {
      end: W.dump.r.length * 2,
      draw: f => { const fs = W.dump[c.heading]; put(wheelieFrame(fs[Math.min(fs.length - 1, Math.floor(f / 2))]), P(c.x), P(c.y)); },
    }),
  };
  const span = cells => {
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs) + 1, h: Math.max(...ys) - Math.min(...ys) + 1 };
  };

  return {
    /** Sets the board the ground is read from. */
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
    covered(x, y) { this.floor(x, y); put(wetCardboard(Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)).px, P(x), P(y)); },
    grate(x, y) { this.floor(x, y); put(GRATE.px, P(x), P(y)); },
    oneway(x, y, dir) { this.floor(x, y); put(ONEWAY[dir].px, P(x), P(y)); },
    /** `roll` is how far the shutter is up and the shimmer's frame. */
    exit(x, y, lit, dir, roll = { open: lit ? 1 : 0, frame: 0 }) { put(door(roll.open, roll.frame), P(x), P(y)); },

    /** `scraps` lie under the pile, in px on its cell. */
    trash(x, y, { seed = 0, k = 1, scraps = null } = {}) {
      const pile = pileLayout(T, seed, LAY);
      const pieces = k >= 1 ? pile.pieces : pile.pieces.slice(0, Math.round(pile.pieces.length * k));
      if (scraps) put(scraps, P(x), P(y));
      drawPile(ctx, T, { ...pile, pieces }, P(x), P(y), STYLE);
    },
    bag(x, y, k = 1) {
      if (k >= 1 && afloatAt(x, y)) thing(BAG, x, y);
      else if (k > 0) standing(k > 0.66 ? A.bag : k > 0.33 ? A.open : A.burst, x, y);
    },
    /** Thing `o` afloat at (x, y), `f` frames after it came down in the water. */
    bob(o, x, y, f, lie = null) {
      const fl = floating(o, x, y, 1, lie), b = bobbing({ w: fl.w, x0: fl.x0, yw: fl.yw, f, open: water.open, seed: Math.round(x + y) });
      put(b.under, 0, 0);
      put(afloat(fl.s, fl.x0, fl.y0 + b.sink, fl.yw, water), 0, 0);
      put(b.over, 0, 0);
    },
    bobEnd: bobEnd(),
    can(x, y, full, lie = null) { thing(full ? CAN_FULL : CAN_EMPTY, x, y, 1, lie); },
    recycleBin(x, y, full, lie = null) { thing(full ? BIN : BIN_EMPTY, x, y, 1, lie); },
    jug(x, y, full = true, lie = null) { thing(full ? JUG : JUG_EMPTY, x, y, 1, lie); },
    wheelie(x, y, full) { put(wheelieFrame(full ? W.full : W.empty), P(x), P(y)); },
    /** `o`'s entry in `DUMPS` for `spec`, or `null` when `o` has none. */
    dump(o, spec) { return DUMPS[o]?.(spec) ?? null; },
    /** The clip of a torn bag from `createBagRip`, each layer's `px` given as `paint()`. */
    rip(spec) {
      const clip = ripClip(spec);
      return { ...clip, layers: t => clip.layers(t).map(({ kind, foot, px }) => ({ kind, foot, paint: () => put(px, 0, 0) })) };
    },
    /** The clip of a pane breaking from `paneShatter`, each layer's `px` given as `paint()`, and
     *  `ground(f)` drawing the glass down on its cell's floor. */
    shatter(spec) {
      const clip = paneShatter({ ...spec, look: GLASS_LOOK });
      return { end: clip.end, ground: f => put(clip.ground(f), 0, 0),
        layers: f => clip.layers(f).map(({ kind, foot, px }) => ({ kind, foot, paint: () => put(px, 0, 0) })) };
    },
    pane(x, y) { thing(PANE, x, y); },
    skateboard(cells, ox = 0, oy = 0) {
      const s = span(cells), b = SKATEBOARD[s.w > 1 ? 'x' : 'y'];
      put(b.px, P(s.x + ox) + Math.floor((s.w * C - b.w) / 2), P(s.y + oy) + Math.floor((s.h * C - b.h) / 2));
    },
    furniture(cells, ox = 0, oy = 0) {
      const s = span(cells);
      const v = s.w === 2 && s.h === 1 ? COUCH.front : s.w === 1 && s.h === 2 ? COUCH.left : null;
      if (v) put(v.px, P(s.x + ox) + Math.floor((s.w * C - v.w) / 2), P(s.y + oy) + s.h * C - v.h - 1);
      else placeholder(s.x + ox, s.y + oy, 'couch', s.w, s.h);
    },
    raccoon(x, y, heading = 'd') { standing(SIT[heading], x, y); },
    /** Draws the raccoon mid-press: `seg` toward `dir` from cell (x, y). `stay`: he ends on the cell he
     *  started from. `over` draws only the parts that go in front of what he pushes. */
    pressing(seg, dir, x, y, { stay = false, over = false } = {}) {
      const p = place(stay && seg.f.dx > 0 ? { f: { ...seg.f, dx: 0 } } : seg, dir, x, y);
      put(over ? p.over : p.px, p.x, p.y);
    },
    /** A lone splash has no look of its own: the clip of the pour draws the whole spray. */
    splash() {},

    sponge(x, y) { put(SPONGE.px, P(x) + Math.floor((C - SPONGE.w) / 2) + SPONGE.dx, P(y) + C - SPONGE.h - 1 + SPONGE.dy); },
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
    rug(cells, ox = 0, oy = 0) {
      const s = span(cells), x = s.x + ox, y = s.y + oy, across = s.w > s.h;
      const k = ((Math.round((across ? y : x) * 4) % TURNS) + TURNS) % TURNS;
      const d = RUG[across ? 'across' : 'up'][k];
      put(d.px, P(x) + Math.floor(s.w * C / 2) - d.ax, P(y) + Math.floor(s.h * C / 2) - d.ay);
    },
    hold(x0, y0, x1, y1) {
      ctx.fillStyle = '#d6d3b0';
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * C;
      for (let i = 0; i <= n; i += 2) ctx.fillRect(P(x0 + 0.5 + (x1 - x0) * i / n), P(y0 + 0.5 + (y1 - y0) * i / n), 1, 1);
    },
    grip(x, y) { ctx.fillStyle = '#ffcf00'; ctx.fillRect(P(x + 0.5) - 1, P(y + 0.5) - 1, 3, 3); },
  };
}
