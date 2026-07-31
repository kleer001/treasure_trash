// Entry point for the vertical slice. Keep it small; grow it into a real loop.
// House rule: validate at boundaries, then trust internal functions. Fail loudly.
//
// Rendering here is LAYERED by default (see compositor.js): the character grid is
// layer 0, and a scanline overlay composites on top of it. That's the house stance
// in miniature — the grid is one layer, not the whole frame. Add sprites, a HUD,
// the studio logo, or a real WebGL CRT pass by writing another layer and calling
// `scene.add(...)` — no edit to `start()` required (open/closed).

import { mulberry32 } from './rng.js';
import { createCompositor } from './compositor.js';

const SEED = 1983;

// --- data: tuning for the placeholder layers (code/data separation) ---------
const GRID = { cols: 80, rows: 40, glyphs: '.:-=+*#%@', bg: '#001100', fg: '#33ff66' };
const SCANLINES = { color: 'rgba(0, 0, 0, 0.25)', gap: 3 };

// --- layers: each honors the { name, draw(ctx, frame) } contract ------------

/** Layer 0: a seeded character grid — the house default base, not the whole show. */
export function createGridLayer(cfg = GRID) {
  return {
    name: 'grid',
    draw(ctx, frame) {
      const rand = mulberry32(frame.seed ?? SEED);
      const cellW = frame.width / cfg.cols;
      const cellH = frame.height / cfg.rows;
      ctx.fillStyle = cfg.bg;
      ctx.fillRect(0, 0, frame.width, frame.height);
      ctx.fillStyle = cfg.fg;
      ctx.font = `${cellH}px monospace`;
      ctx.textBaseline = 'top';
      for (let row = 0; row < cfg.rows; row++) {
        for (let col = 0; col < cfg.cols; col++) {
          const glyph = cfg.glyphs[Math.floor(rand() * cfg.glyphs.length)];
          ctx.fillText(glyph, col * cellW, row * cellH);
        }
      }
    },
  };
}

/** Overlay: faint scanlines drawn *over* everything below — proof that layers
 *  composite on top of the grid, and a stand-in for the future WebGL CRT pass. */
export function createScanlineLayer(cfg = SCANLINES) {
  return {
    name: 'scanlines',
    draw(ctx, frame) {
      ctx.fillStyle = cfg.color;
      for (let y = 0; y < frame.height; y += cfg.gap) {
        ctx.fillRect(0, y, frame.width, 1);
      }
    },
  };
}

/**
 * Wire up the canvas and composite one frame.
 * @param {HTMLCanvasElement} canvas
 */
export function start(canvas) {
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('start() requires a <canvas> element'); // boundary check
  }
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const scene = createCompositor()
    .add(createGridLayer())
    .add(createScanlineLayer());

  const frame = { width: canvas.width, height: canvas.height, seed: SEED };
  scene.render(ctx, frame);
  // Growing into an animation? Call scene.render(ctx, { ...frame, tick }) from a
  // requestAnimationFrame loop — the compositor and its layers stay the same.
}

// Auto-start when loaded in the browser (skipped under `node --test`).
if (typeof document !== 'undefined') {
  const canvas = document.getElementById('screen');
  if (canvas) start(canvas);
}
