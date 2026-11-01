// The undo rewind's recording. A picture is `{ width, height, data }` in RGBA, as ImageData has it.

/**
 * The step that turns `next` back into `prev`, or null when they are the same picture:
 * `{ x, y, w, h, old }`, where `old` is the w×h RGBA rectangle of `prev` at (x, y) that holds
 * every pixel the two pictures do not share.
 */
export function reverseStep(prev, next) {
  const w = next.width, a = prev.data, b = next.data;
  let x0 = w, y0 = -1, x1 = -1, y1 = -1;
  for (let i = 0; i < b.length; i += 4) {
    if (a[i] === b[i] && a[i + 1] === b[i + 1] && a[i + 2] === b[i + 2] && a[i + 3] === b[i + 3]) continue;
    const p = i >> 2, x = p % w, y = (p - x) / w;
    if (x < x0) x0 = x;
    if (x > x1) x1 = x;
    if (y0 < 0) y0 = y;
    y1 = y;
  }
  if (x1 < 0) return null;
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, old = new Uint8ClampedArray(cw * ch * 4);
  for (let y = 0; y < ch; y++) {
    const row = ((y0 + y) * w + x0) * 4;
    old.set(a.subarray(row, row + cw * 4), y * cw * 4);
  }
  return { x: x0, y: y0, w: cw, h: ch, old };
}
