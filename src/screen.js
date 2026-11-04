// The pixel screen: the strip over the room, the room on the alley, and the crow's dock. It draws
// what it is handed and keeps no game state.
import { wallTile } from './art/room.js';

/** Sizes in screen px. The room is drawn at `BOARD` screen px an art px, and the screen at `ZOOM`
 *  device px a screen px. `SETTLE` is frames for his panel to drop to its dock after a speech. */
export const SCREEN = { W: 480, H: 270, STRIP: 16, DOCK: 48, PORTRAIT: 40, GAP: 4, BOARD: 1.5, ZOOM: 2, SETTLE: 40 };
const INK = '#f2ead8', STRIP_INK = '#e8dcc8', STRIP_BG = '#120d14', DOCK_BG = '#0f171c', BOX_BG = '#1c2b33';
const FRAME_MS = 1000 / 60;
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/** The baked font, `src/art/font.json`, and the crow's portraits: `src/art/crow.json` and the
 *  atlas `src/art/crow.png`, one 40 px frame a cell, his stills on the first row. */
export async function loadScreenArt(base) {
  const get = async f => { const r = await fetch(new URL(f, base)); if (!r.ok) throw new Error(`cannot load ${f} (${r.status})`); return r; };
  const [font, crow, atlas] = await Promise.all([get('font.json').then(r => r.json()), get('crow.json').then(r => r.json()),
    get('crow.png').then(r => r.blob()).then(b => createImageBitmap(b))]);
  return { font, crow, atlas };
}

export function createScreen({ canvas, art: { font, crow, atlas }, C }) {
  const { W, H, STRIP, DOCK, PORTRAIT, GAP, BOARD, ZOOM, SETTLE } = SCREEN, AREA = H - STRIP - DOCK;
  const layer = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const g = canvas.getContext('2d'), hud = layer(W, H), hg = hud.getContext('2d'), panel = layer(W, DOCK), pg = panel.getContext('2d');
  canvas.width = W * ZOOM; canvas.height = H * ZOOM;

  const glyph = ch => { const gl = font.glyphs[ch]; if (!gl) throw new Error(`the font has no ${JSON.stringify(ch)}`); return gl; };
  const widthOf = str => [...str].reduce((w, ch) => w + glyph(ch).adv, 0);
  function text(ctx, str, x, y, col) {
    ctx.fillStyle = col;
    for (const ch of str) { const gl = glyph(ch); for (const [a, b] of gl.px) ctx.fillRect(x + a, y + b, 1, 1); x += gl.adv; }
  }
  function wrap(str, max) {
    const out = [];
    for (const word of str.split(' ')) {
      const next = out.length ? `${out.at(-1)} ${word}` : word;
      if (out.length && widthOf(next) <= max) out[out.length - 1] = next; else out.push(word);
    }
    return out;
  }

  // The alley round the room, in art px: as much of it as the board area shows once scaled.
  let alley = null;
  function alleyFor(cols, rows) {
    if (alley?.cols === cols && alley.rows === rows) return alley;
    const bw = Math.ceil(W / BOARD), bh = Math.ceil(AREA / BOARD), c = layer(bw, bh), ag = c.getContext('2d');
    const rx = Math.floor((bw - cols * C) / 2), ry = Math.floor((bh - rows * C) / 2);
    ag.translate(rx, ry);
    for (let y = -Math.ceil(ry / C); y * C + ry < bh; y++) for (let x = -Math.ceil(rx / C); x * C + rx < bw; x++) wallTile(ag, x, y, C);
    ag.setTransform(1, 0, 0, 1, 0, 0);
    ag.fillStyle = 'rgba(12, 8, 16, 0.5)'; ag.fillRect(0, 0, bw, bh);
    return (alley = { cols, rows, c, rx, ry });
  }

  /** `face` is one of his stills or clips, `ms` how long it has been up. */
  function portrait(ctx, x, y, face, ms) {
    const still = crow.stills.indexOf(face), clip = crow.clips[face];
    if (still < 0 && !clip) throw new Error(`the crow has no face ${face}`);
    const on2 = Math.floor(ms / FRAME_MS / 2) * 2;
    const [col, row] = clip ? [Math.min(clip.frames - 1, Math.floor(on2 * crow.fps / 60)), clip.row] : [still, 0];
    ctx.drawImage(atlas, col * crow.size, row * crow.size, crow.size, crow.size, x, y, PORTRAIT, PORTRAIT);
  }

  function paintPanel(v, faceMs) {
    const px = GAP + PORTRAIT + GAP;
    pg.fillStyle = DOCK_BG; pg.fillRect(0, 0, W, DOCK);
    portrait(pg, GAP, GAP, v.face, faceMs);
    pg.fillStyle = BOX_BG; pg.fillRect(px, GAP, W - px - GAP, PORTRAIT);
    if (!v.talking) return;
    let start = 0;
    wrap(v.line, W - px - GAP - 10).forEach((l, i) => {
      text(pg, l.slice(0, Math.max(0, v.text.length - start)), px + 5, GAP + 5 + i * font.line, INK);
      start += l.length + 1;
    });
  }

  // The veil over the room during a speech, `n` sixteenths of its pixels.
  const veils = Array.from({ length: 17 }, (_, n) => {
    const c = layer(4, 4), vg = c.getContext('2d');
    vg.fillStyle = DOCK_BG;
    for (let i = 0; i < 16; i++) if (BAYER[i] < n) vg.fillRect(i % 4, Math.floor(i / 4), 1, 1);
    return hg.createPattern(c, 'repeat');
  });

  // His panel `k` of the way through its drop to the dock: px its middle is over the dock's, and its squash.
  const MIDDLE = H - DOCK / 2 - H / 2;
  const KEYS = [[0, MIDDLE, 1, 1], [0.55, 0, 1.06, 0.88], [0.75, 14, 0.98, 1.04], [0.9, 0, 1.03, 0.96], [1, 0, 1, 1]];
  const EASE = [u => u * u, u => 1 - (1 - u) ** 2, u => u * u, u => u];
  function drop(k) {
    const i = Math.max(0, KEYS.findIndex(([at]) => at >= k) - 1);
    const [k0, up0, sx0, sy0] = KEYS[i], [k1, up1, sx1, sy1] = KEYS[i + 1], e = EASE[i]((k - k0) / (k1 - k0));
    return { up: up0 + (up1 - up0) * e, sx: sx0 + (sx1 - sx0) * e, sy: sy0 + (sy1 - sy0) * e };
  }

  return {
    /** `room` is the room's canvas in art px, `cols` by `rows` cells. `crow` is the crow's view;
     *  `faceMs` how long his face has been up, `settle` frames since his last speech ended, null
     *  during one. `wall(ctx, w, h)` draws the wipe over a board area of w by h screen px. */
    paint({ room, cols, rows, left, right, crow: v, faceMs, settle, wall }) {
      const a = alleyFor(cols, rows), s = BOARD * ZOOM;
      g.imageSmoothingEnabled = false;
      g.save(); g.beginPath(); g.rect(0, STRIP * ZOOM, W * ZOOM, AREA * ZOOM); g.clip();
      g.drawImage(a.c, 0, STRIP * ZOOM, a.c.width * s, a.c.height * s);
      g.drawImage(room, a.rx * s, STRIP * ZOOM + a.ry * s, room.width * s, room.height * s);
      g.restore();

      hg.clearRect(0, 0, W, H);
      if (wall) { hg.save(); hg.translate(0, STRIP); hg.beginPath(); hg.rect(0, 0, W, AREA); hg.clip(); wall(hg, W, AREA); hg.restore(); }
      hg.fillStyle = STRIP_BG; hg.fillRect(0, 0, W, STRIP);
      text(hg, left, 6, 4, STRIP_INK);
      text(hg, right, W - 6 - widthOf(right), 4, STRIP_INK);

      paintPanel(v, faceMs);
      const k = settle === null ? 0 : Math.min(1, settle / SETTLE), veil = settle === null ? 16 : Math.round(16 * Math.max(0, 1 - k / 0.6));
      if (veil) { hg.fillStyle = veils[veil]; hg.fillRect(0, 0, W, H - DOCK); }
      hg.fillStyle = DOCK_BG; hg.fillRect(0, H - DOCK, W, DOCK);
      const d = settle === null ? { up: MIDDLE, sx: 1, sy: 1 } : drop(k);
      const w = Math.round(W * d.sx), h = Math.round(DOCK * d.sy);
      hg.drawImage(panel, Math.round((W - w) / 2), Math.round(H - DOCK / 2 - d.up - h / 2), w, h);
      g.drawImage(hud, 0, 0, W * ZOOM, H * ZOOM);
    },
  };
}
