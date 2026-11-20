// `afloat.js` draws things afloat in the water. Positions are px on the room.
import { BAYER, mixHex } from './spread.js';
import { soaked, waterColour } from './water.js';
import { clamp } from './timing.js';

/**
 * How a thing at rest in the water looks. Lengths are px. `murk`, `murkMix`, `reflect` and
 * `reflectMix` are percentages. A colour is a key of `WATER` or a `#rrggbb`; `murkColour` may also
 * be 'soak', the soaked shade of each pixel.
 */
export const REST = {
  sink: 1, line: 2,
  murk: 100, murkColour: 'MID', murkMix: 100,
  glint: 2, glintRows: 1, glintGap: 0, glintColour: 'LIGHT',
  contact: 2, contactRows: 2, contactColour: 'DEEP',
  reflect: 55, reflectRows: 6, reflectGap: 0, reflectColour: 'MID', reflectMix: 50,
};

const dithered = (pct, x, y) => pct / 100 * 16 > BAYER[(y & 3) * 4 + (x & 3)] + 0.5;

/**
 * Returns the `[x, y, colour]` pixels of sprite `s`, its top-left at (x0, y0) in px on the room, as it
 * meets the water. The pixels include the reflection, the contact line and the glints on the water
 * around it. `met` is how it meets the water, as `meets` in `solid.js` gives it. `wet(x, y)` says
 * whether a pixel is water. `open(x, y)` says whether a pixel is water clear of the rim.
 */
export function afloat(s, x0, y0, met, { wet, open }, k = REST) {
  const murk = k.murk / 100 * 16, out = [];
  const tint = k.murkColour === 'soak' ? col => mixHex(col, soaked(col), k.murkMix / 100)
    : col => mixHex(col, waterColour(k.murkColour), k.murkMix / 100);
  s.px.forEach(([px, py, col], i) => {
    const x = x0 + px, y = y0 + py, w = met.line.get(px);
    if (!met.under[i] || w === undefined || !wet(x, y0 + w)) out.push([x, y, col]);
    else if (wet(x, y) && murk <= BAYER[(y & 3) * 4 + (x & 3)] + 0.5) out.push([x, y, tint(col)]);
  });
  const xs = [...met.line.keys()];
  if (!xs.length) return out;
  const a = Math.min(...xs), b = Math.max(...xs), under = [];
  // The first row under water at column `x` of the sprite, in px on the room.
  const at = x => { const w = met.line.get(clamp(x, a, b)); return w === undefined ? null : y0 + w; };
  if (k.reflect > 0) {
    const toward = waterColour(k.reflectColour);
    for (const [px, py, col] of met.mirror) {
      const x = x0 + px, y = y0 + py + k.reflectGap;
      if (open(x, y) && dithered(k.reflect, x, y)) under.push([x, y, mixHex(col, toward, k.reflectMix / 100)]);
    }
  }
  if (k.contact > 0) {
    const col = waterColour(k.contactColour);
    for (let r = 0; r < k.contactRows; r++) for (let x = a - k.contact; x <= b + k.contact; x++) {
      const w = at(x);
      if (w !== null && wet(x0 + x, w + r)) under.push([x0 + x, w + r, col]);
    }
  }
  const glint = waterColour(k.glintColour);
  for (let i = k.glintGap + 1; i <= k.glintGap + k.glint; i++)
    for (let r = 0; r < k.glintRows; r++) for (const x of [a - i, b + i]) if (open(x0 + x, at(x) + r)) under.push([x0 + x, at(x) + r, glint]);
  return [...under, ...out];
}
