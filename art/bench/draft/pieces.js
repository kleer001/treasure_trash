// Pixel-art drafts for the pieces that have no pixel art yet.
//
// Each draft is a grid of palette characters, one row per pixel row, one character per pixel.
// `.` is nothing drawn, so a top-down piece leaves the floor and the seam showing. A standing
// piece sits with its foot on the bottom row of its cell. `rise` counts the rows above the top
// of the first cell that the piece uses, for a thing that stands taller than its cell.

const INK = '#19152b';

/** Ink on every empty pixel that touches a drawn one, so a standing piece keeps a dark edge. */
function outline(g, ink) {
  const H = g.length, W = g[0].length, out = g.map(r => [...r]);
  const drawn = (x, y) => x >= 0 && y >= 0 && x < W && y < H && g[y][x] !== '.';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++)
    if (g[y][x] === '.' && (drawn(x + 1, y) || drawn(x - 1, y) || drawn(x, y + 1) || drawn(x, y - 1))) out[y][x] = ink;
  return out;
}

/** A grid of `cw` by `ch` cells, drawn by `draw(p)` in cell pixels; returns the rows. */
function paint(cw, ch, draw, { rise = 0, edge = true } = {}) {
  const W = 24 * cw, H = 24 * ch + rise;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const put = (x, y, c) => { const r = y + rise; if (x >= 0 && x < W && r >= 0 && r < H) g[r][x] = c; };
  const p = {
    set: put,
    fill(x, y, w, h, c) { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(x + i, y + j, c); },
    /** Pixels whose centre lies within `r` of (cx, cy). */
    disc(cx, cy, r, c) {
      for (let y = Math.floor(cy - r) - 1; y <= cy + r + 1; y++)
        for (let x = Math.floor(cx - r) - 1; x <= cx + r + 1; x++)
          if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) put(x, y, c);
    },
    /** A line from centre to centre; `t` 2 makes it two pixels thick. */
    line(x0, y0, x1, y1, c, t = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2 || 1;
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n), y = Math.round(y0 + ((y1 - y0) * i) / n);
        put(x, y, c);
        if (t > 1) { if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) put(x, y + 1, c); else put(x + 1, y, c); }
      }
    },
    /** Each pixel in [x0,x1) × [y0,y1) takes `f(x, y)`, or stays as it is when `f` gives null. */
    area(x0, y0, x1, y1, f) { for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) { const c = f(x, y); if (c) put(x, y, c); } },
    /** A filled triangle, its corners in pixel coordinates. */
    tri(pts, c) {
      const side = (x, y, [ax, ay], [bx, by]) => (x - ax) * (by - ay) - (bx - ax) * (y - ay);
      p.area(0, 0, 24 * cw, 24 * ch, (x, y) => {
        const s = [side(x + 0.5, y + 0.5, pts[0], pts[1]), side(x + 0.5, y + 0.5, pts[1], pts[2]), side(x + 0.5, y + 0.5, pts[2], pts[0])];
        return s.every(v => v >= 0) || s.every(v => v <= 0) ? c : null;
      });
    },
  };
  draw(p);
  return (edge ? outline(g, 'k') : g).map(r => r.join(''));
}

/** A draft as data: its id, what it is, and the grid. */
function mk({ id, group, piece, version, facing = null, state = null, cw = 1, ch = 1, rise = 0, pal, edge = true, mirror = false, draw }) {
  const rows = paint(cw, ch, draw, { rise, edge });
  return { id, group, piece, version, facing, state, cells: [cw, ch], rise, palette: pal,
    rows: mirror ? rows.map(r => [...r].reverse().join('')) : rows };
}

// --- palettes ---------------------------------------------------------------------------------
// Ramps are the ones in items.json and the bench's box, can and room files. Each palette maps a
// character to its colour; `k` is always the ink.
const palette = (ramp, extra = {}) => ({ k: INK, ...ramp, ...extra });
const SLATE = palette({ a: '#262440', b: '#453d51', c: '#67819e', d: '#7dafb3', e: '#d6d3b0' });
const RUST = palette({ a: '#34192b', b: '#6f383a', c: '#a84f38', d: '#ca8b68', e: '#d9ac87' });
const BLUE = palette({ a: '#19152b', b: '#244287', c: '#3169b0', d: '#7dafb3', e: '#f1eccb' });
const GREEN = palette({ a: '#255034', b: '#3f7d4f', c: '#4f9a63', d: '#7fa84e', e: '#c8d68a' });
const BLACK = { k: '#06050e', a: '#19152b', b: '#453d51', c: '#67819e', d: '#7dafb3', e: '#d6d3b0' };
const YELLOW = palette({ a: '#6f5a2e', b: '#b8913a', c: '#e3c35a', d: '#f1eccb', e: '#f1eccb' });
const KRAFT = palette({ a: '#453d51', b: '#a8826e', c: '#ca8b68', d: '#d9ac87', e: '#f1eccb' });
const OLIVE = palette({ a: '#19152b', b: '#453d51', c: '#66734e', d: '#c8d68a', e: '#d6d3b0' });
const TEAL = palette({ a: '#2b2d55', b: '#67819e', c: '#7dafb3', d: '#f1eccb', e: '#f1eccb' });
const SIGN = { g: '#1d3b2c', h: '#2e5d44', s: '#2e9e5b', w: '#f1eccb' };

// --- exit door ----------------------------------------------------------------------------------
// The exit sign: EXIT in a 3 by 5 pixel face, the letters on the sign's middle rows.
const LETTERS = {
  E: ['###', '#..', '##.', '#..', '###'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
};
function exitWord(p, x0, y0, col) {
  [...'EXIT'].forEach((ch, i) => LETTERS[ch].forEach((row, r) =>
    [...row].forEach((c, k) => { if (c === '#') p.set(x0 + i * 4 + k, y0 + r, col); })));
}
const DOOR = palette({ a: '#262440', b: '#453d51', c: '#67819e', d: '#7dafb3', e: '#d6d3b0', r: '#a84f38', o: '#ca8b68', y: '#e3c35a' }, SIGN);

const doorA = lit => p => {                      // steel leaf, a bar across it
  p.fill(1, -8, 22, 32, 'a');
  p.fill(3, -6, 18, 7, lit ? 's' : 'g');
  exitWord(p, 5, -5, lit ? 'w' : 'h');
  if (!lit) {
    p.fill(3, 2, 18, 21, 'b');
    p.fill(4, 3, 16, 1, 'c');
    p.fill(4, 12, 16, 1, 'a');
    p.fill(16, 14, 2, 2, 'd');
  } else {
    p.fill(3, 2, 18, 21, 'b');
    p.fill(5, 3, 14, 20, 'o');
    p.fill(5, 3, 14, 5, 'y');
    p.fill(7, 9, 3, 14, 'w');
    p.fill(3, 2, 2, 21, 'c');                   // the leaf, swung back to the frame
  }
};
const doorB = lit => p => {                      // roller shutter, rolled up when lit
  p.fill(1, -8, 22, 32, 'a');
  p.fill(3, -6, 18, 7, lit ? 's' : 'g');
  exitWord(p, 5, -5, lit ? 'w' : 'h');
  if (!lit) {
    for (let y = 2; y < 23; y++) p.fill(3, y, 18, 1, y % 2 ? 'b' : 'c');
    p.fill(3, 22, 18, 1, 'a');
  } else {
    p.fill(3, 2, 18, 3, 'c');
    p.fill(3, 2, 18, 1, 'd');
    p.fill(3, 5, 18, 18, 'o');
    p.fill(3, 5, 18, 4, 'y');
    p.fill(4, 11, 16, 1, 'w');
  }
};
const doorC = lit => p => {                      // wood leaf, a window, sign on the lintel
  p.fill(1, -3, 22, 27, 'a');
  p.fill(3, -10, 18, 7, lit ? 's' : 'g');
  exitWord(p, 5, -9, lit ? 'w' : 'h');
  if (!lit) {
    p.fill(3, -2, 18, 25, 'r');
    p.fill(6, 1, 12, 8, 'b');
    p.fill(6, 11, 12, 1, 'a');
    p.fill(6, 14, 12, 1, 'a');
    p.fill(16, 14, 1, 3, 'd');
  } else {
    p.fill(3, -2, 18, 25, 'r');
    p.fill(7, -1, 13, 24, 'o');
    p.fill(7, -1, 13, 4, 'y');
    p.fill(3, -2, 4, 25, 'r');
    p.fill(6, 1, 12, 8, 'w');
    p.fill(12, 1, 1, 8, 'y');
  }
};

// --- barrow -------------------------------------------------------------------------------------
// A wheelbarrow from the side (right; left mirrors it), from the back (up) and from the front
// (down). `lift` raises the wheel off the floor: the carried barrow of a BAR_ cell.
const wheel = (p, cx, cy, r) => { p.disc(cx, cy, r, 'a'); p.disc(cx, cy, r - 1.3, 'b'); p.disc(cx, cy, 1, 'd'); };
function barrowSide(p, lift) {
  for (let y = 9; y <= 14; y++) {
    const xr = Math.round(22 - ((y - 9) * 6) / 5);
    p.fill(3, y, xr - 2, 1, y === 9 ? 'd' : y === 14 ? 'a' : 'b');
  }
  p.fill(3, 9, 20, 1, 'e');
  p.fill(3, 10, 1, 4, 'a');
  p.fill(15, 14, 2, 2, 'a');
  p.line(0, 8, 4, 10, 'h', 2);
  p.fill(0, 7, 2, 2, 'g');
  wheel(p, 17, 20 - lift, 3.6);
}
function barrowFront(p, lift) {
  p.fill(2, 4, 2, 4, 'h');
  p.fill(20, 4, 2, 4, 'h');
  for (let y = 7; y <= 15; y++) {
    const hw = 9 - ((y - 7) * 3) / 8;
    p.fill(Math.round(12 - hw), y, Math.round(2 * hw), 1, 'b');
  }
  p.fill(3, 7, 18, 1, 'e');
  p.fill(6, 9, 12, 4, 'a');
  p.fill(8, 16, 2, 3, 'a');
  p.fill(14, 16, 2, 3, 'a');
  wheel(p, 12, 19 - lift, 4);
}
function barrowBack(p, lift) {
  wheel(p, 12, 18 - lift, 3.7);
  for (let y = 6; y <= 15; y++) {
    const hw = 9.5 - ((y - 6) * 3.5) / 9;
    p.fill(Math.round(12 - hw), y, Math.round(2 * hw), 1, y === 6 ? 'd' : y === 15 ? 'a' : 'b');
  }
  p.fill(6, 8, 2, 6, 'c');
  p.line(7, 14, 5, 22, 'h', 2);
  p.line(16, 14, 18, 22, 'h', 2);
  p.fill(4, 22, 2, 2, 'g');
  p.fill(17, 22, 2, 2, 'g');
}
/** The left facing is the right one mirrored, so only the right is drawn. */
const barrowDraw = (face, lift = 0, strap = false) => p => {
  if (face === 'r' || face === 'l') barrowSide(p, lift);
  else if (face === 'd') barrowFront(p, lift);
  else barrowBack(p, lift);
  if (strap) p.line(4, 15, 19, 15, 'e');
};

// --- sofa standing on its end, two cells deep -----------------------------------------------------
const sofa = seam => p => {
  p.fill(4, 21, 16, 13, 'b');                  // the far back, raised by the depth
  p.fill(4, 21, 16, 2, 'c');
  p.fill(2, 34, 4, 13, 'c');                   // the two arms
  p.fill(18, 34, 4, 13, 'c');
  p.fill(2, 34, 20, 1, 'd');
  p.fill(6, 35, 12, 11, 'c');                  // the seat between them
  p.fill(6, 35, 12, 1, 'd');
  p.fill(6, seam, 12, 1, 'b');
  p.fill(2, 46, 20, 1, 'a');
  for (const [x, y] of [[2, 34], [21, 34], [2, 46], [21, 46]]) p.set(x, y, '.');
  p.fill(5, 47, 2, 1, 'a');
  p.fill(17, 47, 2, 1, 'a');
};

// --- sponge, cardboard, tyres -------------------------------------------------------------------
const sponge = (pores, cap) => p => {
  p.fill(2, 9, 20, 13, 'c');
  p.fill(4, 8, 16, 1, 'c');
  p.fill(2, 9, 20, 1, 'd');
  p.fill(2, 21, 20, 1, 'b');
  for (const [x, y] of [[2, 8], [21, 8], [2, 21], [21, 21]]) p.set(x, y, '.');
  for (const [x, y] of pores) p.fill(x, y, 2, 1, 'a');
  p.fill(6, 8, 10, 1, cap);
};
/** A flat sheet, its panel and the four flaps folded out from it; `style` picks the tape. */
const cardboard = style => p => {
  p.fill(3, 3, 18, 18, 'b');
  p.fill(7, 3, 10, 4, 'c');
  p.fill(7, 17, 10, 4, 'c');
  p.fill(3, 7, 4, 10, 'c');
  p.fill(17, 7, 4, 10, 'c');
  p.fill(7, 7, 10, 10, 'b');
  for (const y of [7, 16]) p.fill(7, y, 10, 1, 'a');
  for (const x of [7, 16]) p.fill(x, 7, 1, 10, 'a');
  if (style === 1) p.fill(7, 4, 10, 2, 'e');
  if (style === 2) p.fill(7, 10, 10, 1, 'd');
};
/** A tyre standing on its tread, its face to the viewer: it rolls across the picture. */
const tyreFace = (rim, tread) => p => {
  p.disc(11.5, 13, 10.5, 'a');
  p.disc(11.5, 13, 8, 'b');
  p.disc(11.5, 13, 6, rim);
  p.disc(11.5, 13, 2.2, 'd');
  if (tread) p.area(0, 0, 24, 24, (x, y) => {
    const d = Math.hypot(x + 0.5 - 11.5, y + 0.5 - 13);
    return d > 8.6 && d <= 10.5 && (Math.round(Math.atan2(y + 0.5 - 13, x + 0.5 - 11.5) * 6 / Math.PI) % 2 === 0) ? 'c' : null;
  });
};
/** A tyre lying flat, seen from above: it rolls across the floor, the hole in its middle. */
const tyreFlat = (dashes, sheen) => p => {
  p.disc(11.5, 11.5, 10.5, 'a');
  p.area(0, 0, 24, 24, (x, y) => {
    const dx = x + 0.5 - 11.5, dy = y + 0.5 - 11.5, d = Math.hypot(dx, dy);
    if (d > 9.5 || d < 5.5) return null;
    return Math.round(Math.atan2(dy, dx) * 6 / Math.PI) % dashes === 0 ? 'b' : null;
  });
  p.area(0, 0, 24, 24, (x, y) => {
    const dx = x + 0.5 - 11.5, dy = y + 0.5 - 11.5, d = Math.hypot(dx, dy);
    return d <= 5.5 ? 'k' : (sheen && dx < -3 && dy < -3 && d >= 7 && d <= 8.3 ? 'c' : null);
  });
};

// --- bicycle lying on its wheels, the side profile, two cells long -------------------------------
const bicycle = (frame, hi) => p => {
  const R = [9, 16], F = [39, 16], B = [23, 16], S = [14, 8], H = [34, 8];
  for (const [hx, hy] of [R, F]) {
    p.disc(hx, hy, 7.2, 'a');
    p.disc(hx, hy, 5.8, '.');
    p.disc(hx, hy, 6.4, hi);
    p.disc(hx, hy, 5.8, '.');
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      p.line(hx, hy, hx + Math.cos(a) * 5.4, hy + Math.sin(a) * 5.4, 'e');
    }
    p.disc(hx, hy, 1.2, 'd');
  }
  p.line(...S, ...B, frame, 2);
  p.line(...H, ...B, frame, 2);
  p.line(...S, ...H, frame, 2);
  p.line(...R, ...B, frame, 2);
  p.line(...R, ...S, frame, 2);
  p.line(...H, ...F, frame, 2);
  p.line(11, 6, 17, 6, 'a', 2);                // saddle
  p.line(34, 8, 35, 3, 'a', 2);                // head post
  p.line(33, 3, 39, 3, 'a', 2);                // bars
  p.disc(B[0], B[1], 2.2, 'a');                // chainring and pedals
};

// --- rolled rug, two cells long, seen from above ------------------------------------------------
const rug = (body, shade, ties) => p => {
  p.fill(1, 3, 46, 18, body);
  p.fill(1, 3, 46, 3, shade[0]);
  p.fill(1, 17, 46, 4, shade[1]);
  for (const x of ties) p.fill(x, 3, 1, 18, 'k');
  p.fill(1, 3, 1, 18, 'k');
  p.fill(46, 3, 1, 18, 'k');
};

// --- office chair, rolling on its castors -------------------------------------------------------
const chair = (back, seat, base) => p => {
  p.fill(5, 2, 4, 12, back);
  p.fill(5, 2, 4, 1, 'd');
  p.fill(6, 13, 13, 3, seat);
  p.fill(6, 13, 13, 1, 'd');
  p.fill(11, 16, 2, 4, 'a');
  p.line(5, 20, 18, 20, base, 2);
  for (const x of [6, 11, 17]) p.disc(x, 22.5, 1.6, 'k');
};

// --- broom, head on: bristles across the cell ----------------------------------------------------
const broom = (bristle, tip, handle) => p => {
  p.fill(11, 1, 2, 14, handle);
  p.fill(11, 1, 1, 14, 'd');
  p.fill(9, 13, 6, 2, 'c');
  p.fill(4, 15, 16, 8, bristle);
  for (const x of [6, 9, 12, 15, 18]) p.fill(x, 15, 1, 7, tip);
  p.fill(4, 22, 16, 1, tip);
};

// --- filing cabinet, closed: its drawers face `f`, four of them ----------------------------------
const drawerSeams = [7, 12, 17];
/** `f` u is the back, d the drawers toward you, r the side with the drawer edge on the right. */
const cabinetClosed = (f, body, face, pull) => p => {
  if (f === 'u') {
    p.fill(5, 2, 14, 21, body);
    p.fill(5, 2, 14, 1, 'd');
    p.fill(9, 9, 6, 1, 'a');
    p.fill(9, 14, 6, 1, 'a');
  } else if (f === 'd') {
    p.fill(5, 2, 14, 21, face);
    p.fill(5, 2, 14, 1, 'd');
    for (const y of drawerSeams) p.fill(5, y, 14, 1, 'a');
    for (const y of [3, 8, 13, 18]) p.fill(9, y, 6, 1, pull);
  } else {
    p.fill(3, 2, 13, 21, body);
    p.fill(3, 2, 13, 1, 'd');
    p.fill(16, 2, 3, 21, face);
    for (const y of drawerSeams) p.fill(16, y, 3, 1, 'a');
    p.fill(19, 9, 2, 2, pull);
  }
};

// --- filing cabinet, open: a drawer two cells long, drawn out on its facing side -----------------
// Footprint: the drawer's cell at the facing, the body's cell opposite. Left and right are the same
// drawing turned over; up and down stack the body and the drawer.
/** The right-facing open cabinet is this drawing mirrored, so `r` is never drawn. */
const cabinetOpen = (body, face, pull) => (f) => p => {
  if (f === 'l') {
    p.fill(26, 2, 18, 21, body);
    p.fill(26, 2, 18, 1, 'd');
    for (const y of drawerSeams) p.fill(26, y, 18, 1, 'a');
    p.fill(7, 11, 20, 10, body);
    p.fill(7, 11, 20, 1, 'd');
    p.fill(3, 8, 4, 15, face);
    p.fill(3, 8, 4, 1, 'd');
    p.fill(0, 14, 2, 2, pull);
  } else if (f === 'u') {
    p.fill(5, 24, 14, 22, body);
    p.fill(5, 24, 14, 1, 'd');
    p.fill(7, 6, 10, 18, face);
    p.fill(7, 6, 10, 1, 'd');
    p.fill(9, 10, 6, 1, 'a');
  } else {
    p.fill(5, 0, 14, 23, body);
    p.fill(5, 0, 14, 1, 'd');
    for (const y of [7, 12, 17]) p.fill(5, y, 14, 1, 'a');
    p.fill(4, 26, 16, 21, face);
    p.fill(4, 26, 16, 1, 'd');
    p.fill(9, 33, 6, 1, pull);
  }
};

// --- horseshoe magnet, its opening toward the way it pulls ---------------------------------------
const magnet = (body, tip) => f => p => {
  const [fx, fy] = { r: [1, 0], l: [-1, 0], u: [0, -1], d: [0, 1] }[f];
  const cx = 11.5, cy = 11.5, R = 10, r = 5.5, OPEN = 0.75, POLE = 0.3;
  p.area(0, 0, 24, 24, (x, y) => {
    const dx = x + 0.5 - cx, dy = y + 0.5 - cy, d = Math.hypot(dx, dy);
    if (d > R || d < r) return null;
    const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dy * fy) / d)));
    if (ang < OPEN) return null;
    return ang < OPEN + POLE ? tip : body;
  });
};

// --- a barrow carried as cargo: the barrow drawing with its wheel off the floor ------------------
// (the BAR_ cells, which ride inside another piece)

// --- ground hazards, one cell each, seen from above ----------------------------------------------
const grease = spots => p => {
  p.area(0, 0, 23, 23, () => 'b');
  p.area(0, 0, 23, 23, (x, y) => ((x % 5 === 2 && y % 6 === 1) ? 'a' : null));
  for (const [cx, cy, rx, ry] of spots) p.area(0, 0, 23, 23, (x, y) =>
    ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 ? 'c' : null);
  for (const [cx, cy] of spots) p.set(Math.round(cx) - 2, Math.round(cy) - 1, 'e');
};
const tar = gleams => p => {
  p.area(0, 0, 23, 23, () => 'a');
  p.area(0, 0, 23, 23, (x, y) => ((x + y) % 7 === 3 ? 'b' : null));
  for (const [cx, cy, r] of gleams) p.area(0, 0, 23, 23, (x, y) => {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    return d >= r - 0.9 && d <= r + 0.1 ? 'c' : null;
  });
};
const glass = shards => p => {
  for (const pts of shards) {
    p.tri(pts, 'e');
    p.line(...pts[0], ...pts[1], 'b');
    p.line(...pts[1], ...pts[2], 'b');
    p.line(...pts[2], ...pts[0], 'b');
  }
};
const covered = (seam, torn, tape) => p => {
  p.area(0, 0, 23, 23, () => 'b');
  p.area(0, 0, 23, 1, () => 'c');
  p.area(0, 22, 23, 1, () => 'a');
  p.area(22, 0, 1, 23, () => 'a');
  p.area(0, 0, 23, 23, (x, y) => (x === seam ? 'a' : null));
  if (torn) p.area(torn[0], torn[1], torn[0] + 5, torn[1] + 4, () => 'k');
  if (tape) p.line(0, 11, 22, 11, 'e', 2);
};
const grate = kind => p => {
  if (kind === 'square') {
    p.area(0, 0, 23, 23, () => 'b');
    p.area(1, 1, 22, 22, () => 'k');
    for (const y of [4, 8, 12, 16, 20]) p.area(1, y, 22, y + 1, () => 'c');
    p.area(1, 3, 22, 4, () => 'd');
  } else if (kind === 'round') {
    p.disc(11.5, 11.5, 11, 'b');
    p.disc(11.5, 11.5, 9.5, 'k');
    p.area(0, 0, 23, 23, (x, y) => (Math.hypot(x + 0.5 - 11.5, y + 0.5 - 11.5) <= 9.5 && y % 4 === 1 ? 'c' : null));
  } else {
    p.area(0, 0, 23, 23, () => 'b');
    p.area(1, 1, 22, 22, () => 'k');
    p.area(1, 1, 22, 22, (x, y) => ((x % 5 === 3 || y % 5 === 3) ? 'c' : null));
  }
};
const DIRV = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };
const oneway = (kind, dir) => p => {
  const [dx, dy] = DIRV[dir], px = -dy, py = dx, cx = 11.5, cy = 11.5, r = 6;
  if (kind === 'solid') {
    p.tri([[cx + dx * 6, cy + dy * 6], [cx + (-dx * 1 - px) * 5, cy + (-dy * 1 - py) * 5],
      [cx + (-dx * 1 + px) * 5, cy + (-dy * 1 + py) * 5]], 'e');
    p.line(cx - dx * 7, cy - dy * 7, cx - dx * 1, cy - dy * 1, 'e', 2);
    return;
  }
  for (const back of [0.6, -0.1]) {
    const a = [cx + (dx * back - px) * r, cy + (dy * back - py) * r];
    const b = [cx + dx * (back + 1) * r, cy + dy * (back + 1) * r];
    const c = [cx + (dx * back + px) * r, cy + (dy * back + py) * r];
    p.line(...a, ...b, 'c', 2);
    p.line(...b, ...c, 'c', 2);
  }
  if (kind === 'lane') {
    p.area(0, 0, 23, 23, (x, y) => ((x === 1 || y === 1 || x === 21 || y === 21) && (x + y) % 4 < 2 ? 'b' : null));
  }
};

// --- the drafts ----------------------------------------------------------------------------------
const VERS = ['A', 'B', 'C'];
const FACES = ['u', 'd', 'l', 'r'];
const out = [];
const add = d => out.push(mk(d));

// 1. the exit door, dark and lit
for (const [i, v] of VERS.entries()) {
  const draws = [doorA, doorB, doorC][i];
  for (const lit of [false, true]) add({
    id: `door-${v}-${lit ? 'lit' : 'dark'}`, group: 'exit door', piece: 'EXIT', version: v,
    state: lit ? 'lit' : 'dark', rise: 10, pal: DOOR, draw: draws(lit),
  });
}

// 2. the barrow, four facings
const BARROW_PAL = [SLATE, GREEN, RUST];
for (const [i, v] of VERS.entries()) for (const f of FACES) add({
  id: `barrow-${v}-${f}`, group: 'barrow', piece: 'BARROW', version: v, facing: f,
  pal: palette(BARROW_PAL[i], { h: '#ca8b68', g: '#06050e' }),
  draw: barrowDraw(f), mirror: f === 'l',
});

// 3. the vertical couch: a two-cell piece standing on its end
for (const [i, v] of VERS.entries()) add({
  id: `furn-v-${v}`, group: 'furniture', piece: 'FURNITURE (1x2)', version: v, cw: 1, ch: 2,
  pal: [RUST, TEAL, OLIVE][i], draw: sofa([38, 40, 42][i]),
});

// 4. sponge, cardboard, tyres, bicycle, rug, chair, broom
for (const [i, v] of VERS.entries()) add({
  id: `sponge-${v}`, group: 'sponge and cardboard', piece: 'SPONGE', version: v,
  pal: palette({ a: '#6f5a2e', b: '#b8913a', c: '#e3c35a', d: '#f1eccb', e: '#f1eccb' }, {}),
  draw: sponge([[5, 12], [12, 11], [16, 16], [8, 17]].slice(0, 4 - i), 'b'),
});
for (const [i, v] of VERS.entries()) add({
  id: `cardboard-${v}`, group: 'sponge and cardboard', piece: 'CARDBOARD', version: v,
  pal: KRAFT, edge: true, draw: cardboard(i),
});
for (const [i, v] of VERS.entries()) add({
  id: `tireH-${v}`, group: 'tyres', piece: 'TIRE_H', version: v,
  pal: [palette({ a: '#19152b', b: '#453d51', c: '#9aa2a9', d: '#d6d3b0' }), palette({ a: '#244287', b: '#3169b0', c: '#7dafb3', d: '#d6d3b0' }), palette({ a: '#19152b', b: '#3a3d42', c: '#765c62', d: '#9aa2a9' })][i],
  draw: tyreFace('c', i === 2),
});
for (const [i, v] of VERS.entries()) add({
  id: `tireV-${v}`, group: 'tyres', piece: 'TIRE_V', version: v,
  pal: [palette({ a: '#262440', b: '#453d51', c: '#67819e', d: '#7dafb3' }), palette({ a: '#19152b', b: '#67819e', c: '#7dafb3', d: '#d6d3b0' }), palette({ a: '#19152b', b: '#453d51', c: '#765c62', d: '#7dafb3' })][i],
  draw: tyreFlat(4 + i, i === 1),
});
for (const [i, v] of VERS.entries()) add({
  id: `bicycle-${v}`, group: 'bicycle and rug', piece: 'BICYCLE (2x1)', version: v, cw: 2,
  pal: [BLUE, RUST, BLACK][i], draw: bicycle(['c', 'c', 'c'][i], ['d', 'd', 'd'][i]),
});
for (const [i, v] of VERS.entries()) add({
  id: `rug-${v}`, group: 'bicycle and rug', piece: 'RUG (2x1)', version: v, cw: 2,
  pal: [palette({ a: '#82847d', b: '#c8c9c2', c: '#d2d3ce', d: '#e4e4df', e: '#9aa2a9' }), palette({ a: '#8a2a26', b: '#c8453f', c: '#a84f38', d: '#d9ac87', e: '#8a2a26' }), palette({ a: '#244287', b: '#3169b0', c: '#7dafb3', d: '#f1eccb', e: '#244287' })][i],
  draw: rug(['c', 'c', 'c'][i], [['d', 'b'], ['e', 'a'], ['d', 'a']][i], [[8, 24, 40], [12, 36], [8, 40]][i]),
});
for (const [i, v] of VERS.entries()) add({
  id: `chair-${v}`, group: 'chair and broom', piece: 'CHAIR', version: v,
  pal: [BLACK, BLUE, SLATE][i],
  draw: chair(['b', 'b', 'c'][i], ['c', 'c', 'd'][i], ['a', 'a', 'b'][i]),
});
for (const [i, v] of VERS.entries()) add({
  id: `broom-${v}`, group: 'chair and broom', piece: 'BROOM', version: v,
  pal: [KRAFT, BLACK, GREEN][i],
  draw: broom(['d', 'b', 'd'][i], ['b', 'a', 'a'][i], ['c', 'b', 'c'][i]),
});

// 5. filing cabinets, closed and open, four facings
for (const [i, v] of VERS.entries()) for (const f of FACES) add({
  id: `cabinet-closed-${v}-${f}`, group: 'filing cabinet', piece: 'CABC', version: v, facing: f,
  pal: [SLATE, BLUE, TEAL][i], draw: cabinetClosed(f === 'l' ? 'r' : f, ['b', 'c', 'b'][i], 'c', 'e'), mirror: f === 'l',
});
for (const [i, v] of VERS.entries()) for (const f of FACES) add({
  id: `cabinet-open-${v}-${f}`, group: 'filing cabinet', piece: 'CABO', version: v, facing: f,
  cw: f === 'l' || f === 'r' ? 2 : 1, ch: f === 'u' || f === 'd' ? 2 : 1,
  pal: [SLATE, BLUE, TEAL][i], draw: cabinetOpen(['b', 'c', 'b'][i], 'c', 'e')(f === 'l' ? 'l' : f), mirror: f === 'r',
});

// 6. magnets and carried barrows, four facings
for (const [i, v] of VERS.entries()) for (const f of FACES) add({
  id: `magnet-${v}-${f}`, group: 'magnet', piece: 'MAG', version: v, facing: f,
  pal: palette({ a: '#7d1f1b', b: '#c2352f', c: '#dfe3e8', d: '#9aa2a9', e: '#67819e' }),
  draw: magnet(['b', 'e', 'b'][i], ['c', 'c', 'd'][i])(f),
});
for (const [i, v] of VERS.entries()) for (const f of FACES) add({
  id: `bar-${v}-${f}`, group: 'bar (carried barrow)', piece: 'BAR', version: v, facing: f,
  pal: palette(BARROW_PAL[i], { h: '#ca8b68', g: '#06050e', e: '#d9ac87' }),
  draw: barrowDraw(f === 'l' ? 'r' : f, 4, i > 0), mirror: f === 'l',
});

// 7. ground hazards, one cell each, seen from above
for (const [i, v] of VERS.entries()) add({
  id: `grease-${v}`, group: 'ground hazards', piece: 'GREASE', version: v, edge: false,
  pal: palette({ a: '#453d51', b: '#66734e', c: '#c8d68a', d: '#d6d3b0', e: '#f1eccb' }),
  draw: grease([[[7, 8, 4.5, 2.8], [15, 14, 3, 2], [11, 19, 2, 1.4]], [[15, 7, 3.5, 2.2], [7, 16, 4, 2.4], [18, 19, 2, 1.2]], [[10, 10, 5, 2.5], [18, 11, 2, 2], [6, 18, 2, 1.3]]][i]),
});
for (const [i, v] of VERS.entries()) add({
  id: `tar-${v}`, group: 'ground hazards', piece: 'TAR', version: v, edge: false,
  pal: palette({ a: '#19152b', b: '#262440', c: '#67819e' }),
  draw: tar([[[8, 9, 3], [16, 15, 2]], [[15, 7, 2], [7, 16, 3]], [[11, 12, 4]]][i]),
});
const SHARDS = [
  [[[4, 6], [10, 4], [7, 12]], [[13, 8], [19, 10], [14, 14]], [[6, 15], [12, 13], [10, 20]]],
  [[[3, 5], [9, 9], [5, 11]], [[12, 3], [18, 6], [14, 11]], [[10, 15], [17, 13], [15, 20]], [[4, 16], [7, 19], [3, 20]]],
  [[[5, 4], [13, 6], [8, 10]], [[15, 12], [20, 14], [14, 19]]],
];
for (const [i, v] of VERS.entries()) add({
  id: `glass-${v}`, group: 'ground hazards', piece: 'GLASS', version: v, edge: false,
  pal: palette({ a: '#2b2d55', b: '#2b2d55', c: '#67819e', d: '#7dafb3', e: '#d6d3b0' }),
  draw: glass(SHARDS[i]),
});
for (const [i, v] of VERS.entries()) add({
  id: `covered-${v}`, group: 'ground hazards', piece: 'COVERED', version: v, edge: false,
  pal: palette({ a: '#453d51', b: '#a8826e', c: '#ca8b68', d: '#d9ac87', e: '#f1eccb' }),
  draw: covered(11, [[16, 2], [2, 16], [16, 16]][i], i !== 0),
});
for (const [i, v] of VERS.entries()) add({
  id: `grate-${v}`, group: 'ground hazards', piece: 'GRATE', version: v, edge: false,
  pal: palette({ a: '#3a3d42', b: '#4a4f57', c: '#67819e', d: '#8a9099' }),
  draw: grate(['square', 'round', 'cross'][i]),
});
for (const [i, v] of VERS.entries()) for (const f of FACES) add({
  id: `oneway-${v}-${f}`, group: 'ground hazards', piece: 'ONEWAY', version: v, facing: f, edge: false,
  pal: palette({ a: '#2b2d55', b: '#453d51', c: '#7dafb3', e: '#f1eccb' }),
  draw: oneway(['chevron', 'solid', 'lane'][i], f),
});

export const DRAFTS = out;
export const GROUPS = [...new Set(out.map(d => d.group))];
