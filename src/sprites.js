// The stand-in art — one drawing of each thing in the alley, for everybody who draws one.
//
// `createSprites` takes the surface — ctx, cell size, palette — at the boundary, so these are
// reachable from anything that draws rather than welded to one module's scope.
//
// Nothing here knows about the rules or the board. It is handed coordinates — which may be
// fractional, mid-slide — and it draws.

import { pileLook, PILE_SHAPES } from './stage.js';

/** Every colour the alley is made of. Override any of it; the bench swaps for light/dark. */
export const PALETTE = {
  red: '#ff4b3e', yel: '#ffcf00', blu: '#2d7dd2', tea: '#17c3b2', pnk: '#ff5da2',
  ink: '#1a1a1a', grn: '#2e9e5b',
  floor: '#fff', floorLine: '#e6e6e2', outline: '#fff',
  canal: '#2e6f8e', bridge: '#7fb7c4', ripple: 'rgba(255,255,255,.45)',
  grease: '#6b6a4e', greaseSheen: 'rgba(190,215,120,.55)',
  tar: '#23232a', tarSheen: 'rgba(120,120,140,.35)',
  glass: '#b9d7de', glassEdge: '#5d8a95',
  covered: '#b08355', coveredEdge: '#7d5c39',
  grate: '#3a3d42', grateBar: '#8a9099',
  oneway: 'rgba(70,90,120,.55)',
  bagBody: '#161616', bagEdge: '#161616',    // edge == body: invisible on a light floor
  metal: '#b9c0c7', metalEdge: '#7d858c', metalRidge: '#9aa2a9',
  metalRim: '#cfd5da', metalMouth: '#3a4046',
  binBody: '#2d7dd2', binEdge: '#1b4f86', binLid: '#4a95e0', binMark: '#fff',
  binMouth: '#16365c',
  couch: '#9c6249', couchEdge: '#5c382a', couchCushion: 'rgba(255,255,255,.13)',
  jugAir: '#cdeef9', jugWater: '#2e6f8e', jugEdge: '#1b4f86',
  sponge: '#f2c14e', spongeEdge: '#b8892b', spongePore: 'rgba(120,80,20,.45)',
  card: '#c08a55', cardEdge: '#8a5f33',
  pane: 'rgba(190,225,235,.75)', paneEdge: '#7fb0bd',
  tyre: '#2f3238', tyreTread: '#585d66', hub: '#9aa1ab',
  bike: '#3f7fa8', bikeEdge: '#28536d',
  rug: '#a4485c', rugEdge: '#6f2c3c', rugTrim: '#e5c46a',
  chair: '#4a4f57', chairSeat: '#6d7480', castor: '#b9bec6',
  handle: '#a9793f', bristle: '#d8c07a', bristleEdge: '#8e7433',
  wheelie: '#3f7d4f', wheelieEdge: '#255034', wheelieRidge: '#2f6a40',
  wheelieLid: '#4f9a63', wheel: '#22252a',
  fur: '#9aa0a6', furEar: '#6b7076', mask: '#2b2f34', muzzle: '#eceef0',
  eye: '#fff', pupil: '#111', tail: '#8b8f95', tailTip: '#4a4e54',
};

/** Which way out of the room the exit's arrow points: at the nearest board edge. */
export const exitArrowDir = (cols, rows, x, y) =>
  [[y, [0, -1]], [rows - 1 - y, [0, 1]], [x, [-1, 0]], [cols - 1 - x, [1, 0]]]
    .reduce((a, b) => (b[0] < a[0] ? b : a))[1];

/**
 * Bind a canvas and a cell size, get the alley's drawings back. `pad` scales with the cell by
 * default, so the same sprites hold up at the game's 76px and at the bench's 30–72.
 */
export function createSprites({ ctx, cell, pad = Math.max(3, Math.round(cell * 0.118)), palette = {} }) {
  const CS = cell, PAD = pad, P = { ...PALETTE, ...palette };
  const px = n => n * CS;
  const TONES = [P.red, P.tea, P.yel, P.blu, P.pnk];

  const star = (cx, cy, r) => {
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4, rr = i % 2 ? r * 0.4 : r;
      ctx.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
  };
  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(x, y, w, h, r); return; }
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  };
  /** One scrap of rubbish, centred on the origin. `s` is its radius in pixels. */
  const scrap = (shape, s) => {
    ctx.beginPath();
    if (PILE_SHAPES[shape] === 'ball') ctx.arc(0, 0, s, 0, 7);
    else if (PILE_SHAPES[shape] === 'box') ctx.rect(-s, -s * 0.8, s * 2, s * 1.6);
    else if (PILE_SHAPES[shape] === 'wedge') {
      ctx.moveTo(0, -s); ctx.lineTo(s, s * 0.8); ctx.lineTo(-s, s * 0.8); ctx.closePath();
    } else roundRect(-s * 1.3, -s * 0.55, s * 2.6, s * 1.1, s * 0.55);
  };

  const api = {
    floor(x, y) {
      ctx.fillStyle = P.floor; ctx.strokeStyle = P.floorLine; ctx.lineWidth = 1;
      ctx.fillRect(px(x) + 1, px(y) + 1, CS - 2, CS - 2);
      ctx.strokeRect(px(x) + 1.5, px(y) + 1.5, CS - 3, CS - 3);
    },

    // Open water is drawn darker than anything else on the board, with ripples, so it reads as
    // not-walkable. A filled cell keeps the dark rim and takes the ordinary trash glyph.
    water(x, y, filled, seed = 0) {
      const x0 = px(x), y0 = px(y);
      ctx.fillStyle = filled ? P.bridge : P.canal;
      ctx.fillRect(x0 + 1, y0 + 1, CS - 2, CS - 2);
      if (filled) { api.trash(x, y, { seed }); return; }
      ctx.strokeStyle = P.ripple; ctx.lineWidth = 2; ctx.lineCap = 'round';
      for (let i = 1; i <= 2; i++) {
        const yy = y0 + CS * (i / 3);
        ctx.beginPath();
        ctx.moveTo(x0 + 6, yy);
        ctx.quadraticCurveTo(x0 + CS / 3, yy - 4, x0 + CS / 2, yy);
        ctx.quadraticCurveTo(x0 + (2 * CS) / 3, yy + 4, x0 + CS - 6, yy);
        ctx.stroke();
      }
    },

    // The lanes past water. Each is drawn on the same square the floor would have taken, so the
    // ground stays one pass and an occupant lands on top of whatever the cell turned out to be.
    grease(x, y) {
      const x0 = px(x), y0 = px(y);
      ctx.fillStyle = P.grease; ctx.fillRect(x0 + 1, y0 + 1, CS - 2, CS - 2);
      ctx.fillStyle = P.greaseSheen;
      for (const [ox, oy, r] of [[0.34, 0.38, 0.20], [0.64, 0.60, 0.14], [0.48, 0.74, 0.10]]) {
        ctx.beginPath(); ctx.ellipse(x0 + CS * ox, y0 + CS * oy, CS * r, CS * r * 0.62, 0.4, 0, 7); ctx.fill();
      }
    },

    tar(x, y) {
      const x0 = px(x), y0 = px(y);
      ctx.fillStyle = P.tar; ctx.fillRect(x0 + 1, y0 + 1, CS - 2, CS - 2);
      ctx.strokeStyle = P.tarSheen; ctx.lineWidth = 2;
      for (const [ox, oy, r] of [[0.36, 0.42, 0.11], [0.66, 0.64, 0.08]]) {
        ctx.beginPath(); ctx.arc(x0 + CS * ox, y0 + CS * oy, CS * r, 0, 7); ctx.stroke();
      }
    },

    // Shards, angular and pale, so it reads as a surface you would not put a foot on.
    glass(x, y) {
      const x0 = px(x), y0 = px(y);
      api.floor(x, y);
      ctx.fillStyle = P.glass; ctx.strokeStyle = P.glassEdge; ctx.lineWidth = 1.5;
      const shard = pts => {
        ctx.beginPath();
        pts.forEach(([a, b], i) => (i ? ctx.lineTo(x0 + CS * a, y0 + CS * b) : ctx.moveTo(x0 + CS * a, y0 + CS * b)));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      };
      shard([[0.18, 0.30], [0.44, 0.20], [0.36, 0.50]]);
      shard([[0.56, 0.34], [0.82, 0.44], [0.60, 0.58]]);
      shard([[0.28, 0.64], [0.52, 0.60], [0.44, 0.84]]);
    },

    // Something laid over a hazard: a flap of cardboard, seam down the middle.
    covered(x, y) {
      const x0 = px(x), y0 = px(y);
      ctx.fillStyle = P.covered; ctx.fillRect(x0 + 1, y0 + 1, CS - 2, CS - 2);
      ctx.strokeStyle = P.coveredEdge; ctx.lineWidth = 2;
      ctx.strokeRect(x0 + 2.5, y0 + 2.5, CS - 5, CS - 5);
      ctx.beginPath(); ctx.moveTo(x0 + CS / 2, y0 + 3); ctx.lineTo(x0 + CS / 2, y0 + CS - 3); ctx.stroke();
    },

    // A hole with bars across it: he walks over, and anything that fits goes down.
    grate(x, y) {
      const x0 = px(x), y0 = px(y);
      ctx.fillStyle = P.grate; ctx.fillRect(x0 + 1, y0 + 1, CS - 2, CS - 2);
      ctx.strokeStyle = P.grateBar; ctx.lineWidth = 2; ctx.lineCap = 'butt';
      for (let i = 1; i <= 3; i++) {
        const yy = y0 + (CS * i) / 4;
        ctx.beginPath(); ctx.moveTo(x0 + 4, yy); ctx.lineTo(x0 + CS - 4, yy); ctx.stroke();
      }
    },

    // Ordinary floor with the only direction through it painted on.
    oneway(x, y, dir) {
      api.floor(x, y);
      const cx = px(x) + CS / 2, cy = px(y) + CS / 2, r = CS * 0.24;
      const [dx, dy] = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] }[dir];
      const px_ = -dy, py_ = dx;
      ctx.strokeStyle = P.oneway; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (const back of [0.55, -0.15]) {
        ctx.beginPath();
        ctx.moveTo(cx + (dx * back - px_) * r, cy + (dy * back - py_) * r);
        ctx.lineTo(cx + dx * (back + 1) * r, cy + dy * (back + 1) * r);
        ctx.lineTo(cx + (dx * back + px_) * r, cy + (dy * back + py_) * r);
        ctx.stroke();
      }
    },

    // A sponge: soft corners and pores, so it reads as the one thing on the board that soaks up
    // rather than carries.
    sponge(x, y) {
      const x0 = px(x) + PAD, y0 = px(y) + PAD, w = CS - 2 * PAD, h = CS - 2 * PAD;
      ctx.fillStyle = P.sponge; ctx.strokeStyle = P.spongeEdge; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(x0, y0 + h * 0.16, w, h * 0.68, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.spongePore;
      for (const [ox, oy, r] of [[0.28, 0.40, 0.07], [0.52, 0.34, 0.05], [0.70, 0.50, 0.06],
                                 [0.38, 0.62, 0.05], [0.62, 0.66, 0.045]]) {
        ctx.beginPath(); ctx.arc(px(x) + CS * ox, px(y) + CS * oy, CS * r, 0, 7); ctx.fill();
      }
    },

    // A flattened sheet: seen from above it is a rectangle with one fold across it.
    cardboard(x, y) {
      const x0 = px(x) + PAD, y0 = px(y) + PAD + 2, w = CS - 2 * PAD, h = CS - 2 * PAD - 4;
      ctx.fillStyle = P.card; ctx.strokeStyle = P.cardEdge; ctx.lineWidth = 2;
      ctx.fillRect(x0, y0, w, h); ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
      ctx.beginPath(); ctx.moveTo(x0 + w / 2, y0 + 2); ctx.lineTo(x0 + w / 2, y0 + h - 2); ctx.stroke();
    },

    // A pane: mostly transparent, one highlight, so it reads as the fragile thing it is.
    pane(x, y) {
      const x0 = px(x) + PAD, y0 = px(y) + PAD, w = CS - 2 * PAD, h = CS - 2 * PAD;
      ctx.fillStyle = P.pane; ctx.strokeStyle = P.paneEdge; ctx.lineWidth = 2;
      ctx.fillRect(x0, y0, w, h); ctx.strokeRect(x0 + 0.5, y0 + 0.5, w - 1, h - 1);
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x0 + w * 0.22, y0 + h * 0.76); ctx.lineTo(x0 + w * 0.74, y0 + h * 0.20);
      ctx.stroke();
    },

    // A tyre, seen edge-on, so its axis is the long way it is drawn. That is the whole tell:
    // which way it lies is which way it rolls.
    tyre(x, y, horizontal) {
      const cx = px(x) + CS / 2, cy = px(y) + CS / 2;
      const a = CS * 0.40, b = CS * 0.20;
      const [rx, ry] = horizontal ? [a, b] : [b, a];
      ctx.fillStyle = P.tyre;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = P.tyreTread; ctx.lineWidth = 2;
      for (const t of [-0.5, 0, 0.5]) {
        ctx.beginPath();
        if (horizontal) { ctx.moveTo(cx + rx * t, cy - ry * 0.8); ctx.lineTo(cx + rx * t, cy + ry * 0.8); }
        else { ctx.moveTo(cx - rx * 0.8, cy + ry * t); ctx.lineTo(cx + rx * 0.8, cy + ry * t); }
        ctx.stroke();
      }
      ctx.fillStyle = P.hub;
      ctx.beginPath(); ctx.ellipse(cx, cy, rx * 0.28, ry * 0.28, 0, 0, 7); ctx.fill();
    },

    // Multi-cell pieces are drawn over their whole footprint, so these take the cell list the
    // couch does and read their own long axis off it, exactly as the rules do.
    bicycle(cells, x, y) {
      api.furniture(cells, x, y, { fill: P.bike, edge: P.bikeEdge });
      const cx = px(x) + CS / 2, cy = px(y) + CS / 2;
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, CS * 0.26, 0, 7); ctx.stroke();
    },

    rug(cells, x, y) {
      api.furniture(cells, x, y, { fill: P.rug, edge: P.rugEdge });
      ctx.strokeStyle = P.rugTrim; ctx.lineWidth = 2;
      ctx.strokeRect(px(x) + PAD + 3.5, px(y) + PAD + 3.5, CS - 2 * PAD - 7, CS - 2 * PAD - 7);
    },

    // An office chair from above: seat, back, and castors showing at the corners — the castors
    // are the tell that it rolls, which is a promise the rules keep.
    chair(x, y) {
      const x0 = px(x) + PAD, y0 = px(y) + PAD, w = CS - 2 * PAD, h = CS - 2 * PAD;
      ctx.fillStyle = P.castor;
      for (const [ox, oy] of [[0.22, 0.22], [0.78, 0.22], [0.22, 0.78], [0.78, 0.78]]) {
        ctx.beginPath(); ctx.arc(px(x) + CS * ox, px(y) + CS * oy, CS * 0.075, 0, 7); ctx.fill();
      }
      ctx.fillStyle = P.chair;
      ctx.beginPath(); ctx.roundRect(x0 + w * 0.12, y0 + h * 0.12, w * 0.76, h * 0.76, 5); ctx.fill();
      ctx.fillStyle = P.chairSeat;
      ctx.beginPath(); ctx.roundRect(x0 + w * 0.24, y0 + h * 0.30, w * 0.52, h * 0.50, 4); ctx.fill();
    },

    // A broom head-on: bristles wide across the cell, because what it does is take a whole line.
    broom(x, y) {
      const cx = px(x) + CS / 2, y0 = px(y) + PAD, h = CS - 2 * PAD;
      ctx.strokeStyle = P.handle; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(cx, y0 + 2); ctx.lineTo(cx, y0 + h * 0.52); ctx.stroke();
      ctx.fillStyle = P.bristle; ctx.strokeStyle = P.bristleEdge; ctx.lineWidth = 2;
      const bw = CS * 0.62, bh = h * 0.40;
      ctx.beginPath(); ctx.roundRect(cx - bw / 2, y0 + h * 0.50, bw, bh, 3); ctx.fill(); ctx.stroke();
      for (let i = 1; i <= 3; i++) {
        const bx = cx - bw / 2 + (bw * i) / 4;
        ctx.beginPath(); ctx.moveTo(bx, y0 + h * 0.56); ctx.lineTo(bx, y0 + h * 0.88); ctx.stroke();
      }
    },

    // The way out, drawn as what it is: an emergency exit sign. White-on-green is the ISO 3864
    // "safe condition" coding (ISO 7010 E002). The caller decides whether it is `lit`.
    // `dir` points at the board edge he is actually leaving by — see `exitArrowDir`.
    exit(x, y, lit, dir = [0, -1]) {
      const [dx, dy] = dir;
      const x0 = px(x), y0 = px(y), m = CS * 0.105, w = CS - 2 * m;
      const cx = x0 + CS / 2, cy = y0 + CS / 2;
      ctx.save();
      ctx.fillStyle = lit ? P.grn : 'rgba(46,158,91,.12)';
      ctx.fillRect(x0 + m, y0 + m, w, w);
      if (!lit) {
        ctx.strokeStyle = 'rgba(46,158,91,.6)'; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
        ctx.strokeRect(x0 + m + 1, y0 + m + 1, w - 2, w - 2); ctx.setLineDash([]);
      }
      const fg = lit ? '#fff' : 'rgba(46,158,91,.55)';
      ctx.fillStyle = fg;
      ctx.font = `700 ${Math.round(CS * 0.158)}px -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', cx, y0 + m + CS * 0.145);
      ctx.translate(cx, cy + CS * 0.092); ctx.rotate(Math.atan2(dy, dx));
      const a = w * 0.30, H = w * 0.24, h = w * 0.09;
      ctx.beginPath();
      ctx.moveTo(a, 0); ctx.lineTo(0, -H); ctx.lineTo(0, -h); ctx.lineTo(-a, -h);
      ctx.lineTo(-a, h); ctx.lineTo(0, h); ctx.lineTo(0, H); ctx.closePath();
      ctx.fill();
      ctx.restore();
    },

    /**
     * A pile of rubbish. Its look comes from `seed` — the thing's own, not the square's — so a
     * pile carried across the alley by a cart arrives as the same pile it left as.
     *
     * `src` is where it is flying out of, if it is: while k<1 every scrap is in the air between
     * that origin and its resting place, so a burst throws its mess outward across the board
     * instead of fading up in place. At rest the pile is clipped to its own cell.
     */
    trash(x, y, { seed = 0, k = 1, src = null } = {}) {
      if (k <= 0) return;
      const x0 = px(x), y0 = px(y), flying = k < 1 && src;
      ctx.save();
      if (!flying) { ctx.beginPath(); ctx.rect(x0 + 2, y0 + 2, CS - 4, CS - 4); ctx.clip(); }
      const sx = flying ? px(src[0]) + CS / 2 : x0 + CS / 2;
      const sy = flying ? px(src[1]) + CS / 2 : y0 + CS / 2;
      for (const pc of pileLook(seed)) {
        const tx = x0 + CS / 2 + pc.ox * CS, ty = y0 + CS / 2 + pc.oy * CS;
        ctx.save();
        ctx.translate(sx + (tx - sx) * k, sy + (ty - sy) * k);
        ctx.rotate(pc.rot);
        ctx.fillStyle = TONES[pc.tone];
        ctx.strokeStyle = P.outline; ctx.lineWidth = 1.5;
        scrap(pc.shape, pc.r * CS * Math.max(0.25, k));
        ctx.fill(); ctx.stroke();
        ctx.restore();
      }
      ctx.restore();
    },

    bag(x, y, k = 1) {
      if (k <= 0) return;
      const cx0 = px(x) + CS / 2, cy0 = px(y) + CS / 2;
      ctx.save();
      ctx.translate(cx0, cy0); ctx.scale(k, k); ctx.translate(-cx0, -cy0);
      const cx = px(x) + CS / 2, top = px(y) + PAD + 8, w = CS - 2 * PAD - 6, h = CS - 2 * PAD - 8;
      ctx.fillStyle = P.bagBody;
      ctx.beginPath();
      ctx.moveTo(cx - w / 2, top + 8);
      ctx.quadraticCurveTo(cx - w / 2, top + h, cx, top + h);
      ctx.quadraticCurveTo(cx + w / 2, top + h, cx + w / 2, top + 8);
      ctx.lineTo(cx + w / 2 - 4, top + 2); ctx.lineTo(cx + 6, top + 6);
      ctx.lineTo(cx - 6, top + 6); ctx.lineTo(cx - w / 2 + 4, top + 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = P.bagEdge; ctx.lineWidth = 2; ctx.stroke();  // a rim, for dark grounds
      ctx.fillStyle = P.yel; star(cx + 6, top + h * 0.5, 5);      // the shiny inside
      ctx.restore();
    },

    // The cart draws UNDER its load: a basket outline and a pair of wheels, with whatever it
    // is carrying at full size on top. Nothing shrinks to fit — being carried is a
    // relationship between two objects, not a smaller object. ox/oy offset the roll.
    cart(cells, ox = 0, oy = 0) {
      const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
      const x0 = px(Math.min(...xs) + ox), y0 = px(Math.min(...ys) + oy);
      const w = (Math.max(...xs) - Math.min(...xs) + 1) * CS;
      const h = (Math.max(...ys) - Math.min(...ys) + 1) * CS;
      const M = Math.max(3, Math.round(CS * 0.055)), R = CS * 0.1;
      ctx.save();
      ctx.fillStyle = P.floor;
      roundRect(x0 + M, y0 + M, w - 2 * M, h - 2 * M, R); ctx.fill();
      ctx.strokeStyle = P.pnk; ctx.lineWidth = Math.max(2, CS * 0.04);
      roundRect(x0 + M, y0 + M, w - 2 * M, h - 2 * M, R); ctx.stroke();
      ctx.globalAlpha = 0.35; ctx.lineWidth = Math.max(1, CS * 0.02);
      for (const [cx, cy] of cells) {                 // the mesh, one X per cell
        const a = px(cx + ox), b = px(cy + oy), q = CS * 0.13;
        ctx.beginPath();
        ctx.moveTo(a + q, b + CS - q); ctx.lineTo(a + CS - q, b + q);
        ctx.moveTo(a + q, b + q); ctx.lineTo(a + CS - q, b + CS - q);
        ctx.stroke();
      }
      ctx.globalAlpha = 1; ctx.fillStyle = P.pnk;
      for (const [cx, cy] of cells) {
        const a = px(cx + ox), b = px(cy + oy), r = Math.max(2.5, CS * 0.05);
        ctx.beginPath();
        ctx.arc(a + CS * 0.28, b + CS - r - 1, r, 0, 7);
        ctx.arc(a + CS * 0.72, b + CS - r - 1, r, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    },

    can(x, y, full) {
      const cx = px(x) + CS / 2, w = CS - 2 * PAD - 8, top = px(y) + PAD + 6, h = CS - 2 * PAD - 6;
      ctx.fillStyle = P.metal; ctx.strokeStyle = P.metalEdge; ctx.lineWidth = 2;
      ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
      ctx.strokeStyle = P.metalRidge; ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - w / 2, top + (i * h) / 3); ctx.lineTo(cx + w / 2, top + (i * h) / 3);
        ctx.stroke();
      }
      ctx.fillStyle = P.metalRim; ctx.strokeStyle = P.metalEdge; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(cx, top, w / 2, 6, 0, 0, 7); ctx.fill(); ctx.stroke();
      if (full) {                                    // black bag bulging out
        ctx.fillStyle = P.bagBody;
        ctx.beginPath(); ctx.ellipse(cx, top - 3, w / 2 - 3, 9, 0, 0, 7); ctx.fill();
        ctx.fillStyle = P.yel; star(cx + 5, top - 4, 4);
      } else {                                       // open dark mouth
        ctx.fillStyle = P.metalMouth;
        ctx.beginPath(); ctx.ellipse(cx, top, w / 2 - 3, 4, 0, 0, 7); ctx.fill();
      }
    },

    // Blue reads as "recycling" the world over, and it keeps the bin from being mistaken for
    // the grey metal can.
    recycleBin(x, y, full) {
      const cx = px(x) + CS / 2, w = CS - 2 * PAD - 6, top = px(y) + PAD + 6, h = CS - 2 * PAD - 8;
      ctx.save();
      ctx.fillStyle = P.binBody; ctx.strokeStyle = P.binEdge; ctx.lineWidth = 2;
      ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
      if (!full) {                                   // the mouth the tipped-back lid uncovers
        ctx.fillStyle = P.binMouth;
        ctx.fillRect(cx - w / 2 + 2, top + 1, w - 4, 6);
      }
      ctx.save();
      ctx.translate(cx - w / 2, top);
      if (!full) ctx.rotate(-0.38);                  // tipped back, and nothing left to hold in
      ctx.fillStyle = P.binLid; ctx.fillRect(0, 0, w, 7);
      ctx.strokeStyle = P.binEdge; ctx.strokeRect(0, 0, w, 7);
      ctx.restore();
      // chasing arrows as a plain triangle outline — legible small, unlike the real mark
      ctx.strokeStyle = P.binMark; ctx.lineWidth = 3; ctx.lineJoin = 'round';
      const r = w * 0.26, my = top + h * 0.62;
      ctx.beginPath();
      for (let i = 0; i < 3; i++) {
        const a = -Math.PI / 2 + (i * 2 * Math.PI) / 3;
        ctx[i ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * r, my + Math.sin(a) * r);
      }
      ctx.closePath(); ctx.stroke();
      ctx.restore();
    },

    // The couch is drawn from its whole footprint, not a cell at a time: only the outer edges
    // are stroked, because an internal seam would read as two couches. ox/oy offset the slide.
    // `skin` is what makes this one drawing serve every rigid multi-cell piece: the shape work
    // — which edges are outer, where the cushions go — is the same for all of them.
    furniture(cells, ox = 0, oy = 0, skin = {}) {
      const fill = skin.fill ?? P.couch, edge = skin.edge ?? P.couchEdge;
      const cushion = skin.cushion ?? P.couchCushion;
      const has = new Set(cells.map(([x, y]) => `${x},${y}`));
      const at = (x, y) => has.has(`${x},${y}`);
      const M = Math.max(3, Math.round(CS * 0.079));
      ctx.save();
      ctx.fillStyle = fill;
      for (const [cx, cy] of cells) {
        const x0 = px(cx + ox), y0 = px(cy + oy);
        const l = at(cx - 1, cy), r = at(cx + 1, cy), u = at(cx, cy - 1), d = at(cx, cy + 1);
        ctx.fillRect(x0 + (l ? 0 : M), y0 + (u ? 0 : M),
          CS - (l ? 0 : M) - (r ? 0 : M), CS - (u ? 0 : M) - (d ? 0 : M));
      }
      ctx.fillStyle = cushion;                        // one cushion per cell
      for (const [cx, cy] of cells)
        ctx.fillRect(px(cx + ox) + M + 6, px(cy + oy) + M + 6, CS - 2 * M - 12, CS - 2 * M - 12);
      ctx.strokeStyle = edge; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath();
      for (const [cx, cy] of cells) {
        const x0 = px(cx + ox), y0 = px(cy + oy), a = M, b = CS - M;
        if (!at(cx, cy - 1)) { ctx.moveTo(x0 + a, y0 + a); ctx.lineTo(x0 + b, y0 + a); }
        if (!at(cx, cy + 1)) { ctx.moveTo(x0 + a, y0 + b); ctx.lineTo(x0 + b, y0 + b); }
        if (!at(cx - 1, cy)) { ctx.moveTo(x0 + a, y0 + a); ctx.lineTo(x0 + a, y0 + b); }
        if (!at(cx + 1, cy)) { ctx.moveTo(x0 + b, y0 + a); ctx.lineTo(x0 + b, y0 + b); }
      }
      ctx.stroke();
      ctx.restore();
    },

    // A cooler bottle. Its water uses the canal's exact blue; the thin white inner rim keeps
    // it reading as translucent plastic against both floor and canal.
    jug(x, y, full = true) {
      const bx = px(x) + CS / 2 - 4, w = CS - 2 * PAD - 16, top = px(y) + PAD + 5, h = CS - 2 * PAD - 8;
      const neck = w * 0.32, shoulder = top + 10, wl = top + h * 0.34, bot = top + h;
      const L = bx - w / 2, R = bx + w / 2;
      const body = () => {
        ctx.beginPath();
        ctx.moveTo(bx - neck / 2, top); ctx.lineTo(bx + neck / 2, top);
        ctx.lineTo(bx + neck / 2, shoulder - 4); ctx.lineTo(R, shoulder);
        ctx.lineTo(R, bot); ctx.lineTo(L, bot);
        ctx.lineTo(L, shoulder); ctx.lineTo(bx - neck / 2, shoulder - 4);
        ctx.closePath();
      };
      ctx.save();
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.strokeStyle = P.jugEdge; ctx.lineWidth = 2;
      // the handle first, so the body's fill covers where it meets the shoulder
      ctx.beginPath(); ctx.moveTo(R - 2, shoulder + 8);
      ctx.quadraticCurveTo(R + 12, top + h * 0.48, R - 2, top + h * 0.74); ctx.stroke();
      ctx.fillStyle = P.jugEdge;
      ctx.fillRect(bx - neck / 2 - 2, top - 4, neck + 4, 5);       // the cap
      body();
      ctx.fillStyle = P.jugAir; ctx.fill();                        // the air above the water
      ctx.save(); ctx.clip();
      if (full) ctx.fillStyle = P.jugWater, ctx.fillRect(L, wl, w, bot - wl);
      ctx.strokeStyle = 'rgba(255,255,255,.65)'; ctx.lineWidth = 2; // two moulded ribs
      for (const t of [0.60, 0.82]) {
        const yy = top + h * t;
        ctx.beginPath(); ctx.moveTo(L, yy); ctx.lineTo(R, yy); ctx.stroke();
      }
      if (full) {
        ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2; // the waterline, brightest
        ctx.beginPath(); ctx.moveTo(L, wl + 2); ctx.quadraticCurveTo(bx, wl - 4, R, wl + 2); ctx.stroke();
      }
      ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 4; // clipped: only the inner half
      body(); ctx.stroke();
      ctx.restore();
      ctx.strokeStyle = P.jugEdge; ctx.lineWidth = 2;
      body(); ctx.stroke();
      ctx.restore();
    },

    // A loose bag riding a still-full can: the can sits low, the bag perches on top.
    stack(x, y) {
      const cx = px(x) + CS / 2, w = CS - 2 * PAD - 14, top = px(y) + CS * 0.46, h = CS * 0.36;
      ctx.save();
      ctx.fillStyle = P.metal; ctx.strokeStyle = P.metalEdge; ctx.lineWidth = 2;
      ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
      ctx.fillStyle = P.metalRim;
      ctx.beginPath(); ctx.ellipse(cx, top, w / 2, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.bagBody;
      ctx.beginPath(); ctx.ellipse(cx, top - 11, w / 2 + 3, 11, 0, 0, 7); ctx.fill();
      ctx.fillStyle = P.yel; star(cx + 6, top - 13, 4);
      ctx.restore();
    },

    // Taller than the can, on wheels. Full = lid propped open by the bag inside.
    wheelie(x, y, full) {
      const cx = px(x) + CS / 2, w = CS - 2 * PAD - 10, top = px(y) + PAD + 9, h = CS - 2 * PAD - 16;
      ctx.save();
      ctx.fillStyle = P.wheelie; ctx.strokeStyle = P.wheelieEdge; ctx.lineWidth = 2;
      ctx.fillRect(cx - w / 2, top, w, h); ctx.strokeRect(cx - w / 2, top, w, h);
      ctx.strokeStyle = P.wheelieRidge; ctx.lineWidth = 1;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(cx - w / 2, top + (i * h) / 3); ctx.lineTo(cx + w / 2, top + (i * h) / 3);
        ctx.stroke();
      }
      ctx.fillStyle = P.wheel;
      ctx.beginPath();
      ctx.arc(cx - w / 2 + 5, top + h + 4, 5, 0, 7); ctx.arc(cx + w / 2 - 5, top + h + 4, 5, 0, 7);
      ctx.fill();
      ctx.save();
      ctx.translate(cx - w / 2, top);
      if (full) ctx.rotate(-0.42);                    // the lid, propped by what is under it
      ctx.fillStyle = P.wheelieLid; ctx.strokeStyle = P.wheelieEdge; ctx.lineWidth = 2;
      ctx.fillRect(-2, -8, w + 4, 8); ctx.strokeRect(-2, -8, w + 4, 8);
      ctx.restore();
      if (full) {                                     // the bag showing through the gap
        ctx.fillStyle = P.bagBody;
        ctx.beginPath(); ctx.ellipse(cx + 3, top - 2, w / 2 - 4, 7, 0, 0, 7); ctx.fill();
        ctx.fillStyle = P.yel; star(cx + 8, top - 3, 4);
      }
      ctx.restore();
    },

    // Water going where water was not: the jug's pour, mid-flight. Not an occupant — it is
    // the moment before the cell becomes canal.
    splash(x, y) {
      const cx = px(x) + CS / 2, cy = px(y) + CS / 2, r = CS * 0.34;
      ctx.save();
      ctx.fillStyle = P.canal; ctx.globalAlpha = 0.7;
      for (let i = 0; i < 5; i++) {
        const a = i * 1.257;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6, r * 0.3, 0, 7);
        ctx.fill();
      }
      ctx.restore();
    },

    raccoon(x, y) {
      const cx = x * CS + CS / 2, cy = y * CS + CS / 2, r = CS / 2 - PAD - 4;   // x,y may be fractional
      ctx.fillStyle = P.tail;
      ctx.beginPath(); ctx.arc(cx + r * 0.7, cy + r * 0.6, r * 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = P.tailTip;
      ctx.beginPath(); ctx.arc(cx + r * 0.95, cy + r * 0.75, r * 0.28, 0, 7); ctx.fill();
      ctx.fillStyle = P.furEar;
      ctx.beginPath();
      ctx.arc(cx - r * 0.6, cy - r * 0.7, r * 0.32, 0, 7); ctx.arc(cx + r * 0.6, cy - r * 0.7, r * 0.32, 0, 7);
      ctx.fill();
      ctx.fillStyle = P.fur; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.fill();
      ctx.fillStyle = P.mask;
      ctx.beginPath(); ctx.ellipse(cx, cy - r * 0.05, r * 0.95, r * 0.42, 0, 0, 7); ctx.fill();
      ctx.fillStyle = P.muzzle;
      ctx.beginPath(); ctx.ellipse(cx, cy + r * 0.45, r * 0.5, r * 0.35, 0, 0, 7); ctx.fill();
      ctx.fillStyle = P.eye;
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy - r * 0.05, r * 0.2, 0, 7); ctx.arc(cx + r * 0.35, cy - r * 0.05, r * 0.2, 0, 7);
      ctx.fill();
      ctx.fillStyle = P.pupil;
      ctx.beginPath();
      ctx.arc(cx - r * 0.35, cy - r * 0.02, r * 0.1, 0, 7); ctx.arc(cx + r * 0.35, cy - r * 0.02, r * 0.1, 0, 7);
      ctx.fill();
      ctx.beginPath(); ctx.arc(cx, cy + r * 0.35, r * 0.12, 0, 7); ctx.fill();
    },
  };
  return api;
}

/**
 * Dispatch an occupant code to its drawing. Kept beside the sprites so a new piece is one
 * entry here rather than a search through every renderer. `codes` is the rules module's
 * occupant constants; passing them keeps this file free of any dependency on the rules.
 */
export function drawOccupant(sprites, codes, o, x, y, opts = {}) {
  const { k = 1, seed = 0, src = null } = opts;
  if (o === codes.TRASH) sprites.trash(x, y, { seed, k, src });
  else if (o === codes.BAG) sprites.bag(x, y, k);
  else if (o === codes.CAN_FULL) sprites.can(x, y, true);
  else if (o === codes.CAN_EMPTY) sprites.can(x, y, false);
  else if (o === codes.BIN) sprites.recycleBin(x, y, true);
  else if (o === codes.BIN_EMPTY) sprites.recycleBin(x, y, false);
  else if (o === codes.STACK) sprites.stack(x, y);
  else if (o === codes.WHEELIE) sprites.wheelie(x, y, true);
  else if (o === codes.WHEELIE_EMPTY) sprites.wheelie(x, y, false);
  else if (o === codes.JUG) sprites.jug(x, y, true);
  else if (o === codes.JUG_EMPTY) sprites.jug(x, y, false);
  else if (o === codes.SPONGE) sprites.sponge(x, y);
  else if (o === codes.CARDBOARD) sprites.cardboard(x, y);
  else if (o === codes.PANE) sprites.pane(x, y);
  else if (o === codes.TIRE_H) sprites.tyre(x, y, true);
  else if (o === codes.TIRE_V) sprites.tyre(x, y, false);
  else if (o === codes.CHAIR) sprites.chair(x, y);
  else if (o === codes.BROOM) sprites.broom(x, y);
  // Not silence. An occupant with no drawing here is invisible on the board, which reads as a
  // rules bug and is found by playing rather than by testing — so it stops the frame instead.
  else if (o !== codes.NONE) throw new Error(`no drawing for occupant ${o}`);
}
