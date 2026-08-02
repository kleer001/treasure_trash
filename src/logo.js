// Trace ROM Studio wordmark, drawn procedurally to Canvas: three justified rows cut
// by scanlines whose thickness follows a cos-squared taper.

/** Tuning for the mark. Tuned against a 900x560 field; scales via options. */
export const LOGO_DEFAULTS = {
  width: 900,
  height: 560,
  background: '#0a0a0a',
  foreground: '#ffb000',
  fontFamily: '"Arial Black", "Helvetica Neue", Helvetica, Arial, sans-serif',
  fontWeight: 900,
  fontSize: 130,
  rows: ['TRACE', 'ROM', 'STUDIO'],
  targetWidth: 600,
  rowGap: 100,
  pitch: 11,
  thicknessMax: 9.0,
  thicknessMin: 1.4,
};

function taperAt(y, height) {
  const d = (y - height / 2) / (height / 2);
  const c = Math.cos((d * Math.PI) / 2);
  return c * c;
}

/**
 * The scanline mask stripes for a field of the given height. Pure geometry.
 * @returns {Array<{y: number, thickness: number}>} top-edge y and height per band.
 */
export function scanlineBands(height, cfg = LOGO_DEFAULTS) {
  const { pitch, thicknessMin, thicknessMax } = cfg;
  const bands = [];
  for (let center = 0; center <= height; center += pitch) {
    const t = thicknessMin + (thicknessMax - thicknessMin) * taperAt(center, height);
    bands.push({ y: center - t / 2, thickness: t });
  }
  return bands;
}

/**
 * Vertical placement of the rows, centred as a block. Pure.
 * @returns {Array<{text: string, cy: number}>} each row's text and midline y.
 */
export function rowLayout(cfg = LOGO_DEFAULTS) {
  const { rows, rowGap, height } = cfg;
  const firstCy = height / 2 - ((rows.length - 1) * rowGap) / 2;
  return rows.map((text, i) => ({ text, cy: firstCy + i * rowGap }));
}

function drawJustifiedRow(ctx, text, cy, cfg) {
  const natural = ctx.measureText(text).width;
  const scaleX = natural > 0 ? cfg.targetWidth / natural : 1;
  ctx.save();
  ctx.translate(cfg.width / 2, cy);
  ctx.scale(scaleX, 1);
  ctx.fillText(text, 0, 0);
  ctx.restore();
}

/**
 * Render the wordmark to a 2D canvas context.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} [options] shallow overrides of LOGO_DEFAULTS.
 */
export function drawLogo(ctx, options = {}) {
  if (!ctx || typeof ctx.fillRect !== 'function' || typeof ctx.clip !== 'function') {
    throw new Error('drawLogo() requires a 2D canvas context');
  }
  const cfg = { ...LOGO_DEFAULTS, ...options };

  ctx.fillStyle = cfg.background;
  ctx.fillRect(0, 0, cfg.width, cfg.height);

  ctx.fillStyle = cfg.foreground;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${cfg.fontWeight} ${cfg.fontSize}px ${cfg.fontFamily}`;

  const rows = rowLayout(cfg);
  for (const band of scanlineBands(cfg.height, cfg)) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, band.y, cfg.width, band.thickness);
    ctx.clip();
    for (const row of rows) drawJustifiedRow(ctx, row.text, row.cy, cfg);
    ctx.restore();
  }
}

if (typeof document !== 'undefined') {
  const canvas = document.getElementById('logo');
  if (canvas) {
    drawLogo(canvas.getContext('2d'), { width: canvas.width, height: canvas.height });
  }
}
