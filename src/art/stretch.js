/** Returns `list` stretched or squeezed to `n` by its middle. The first `lo` items and the last `hi` items stay as drawn. The middle is resampled to fill the rest. So a drawing's rims and ink outline keep their width. */
export const stretch = (list, n, lo, hi) => {
  const mid = list.slice(lo, list.length - hi), m = n - lo - hi;
  return [...list.slice(0, lo), ...Array.from({ length: m }, (_, i) => mid[Math.floor((i * mid.length) / m)]), ...list.slice(list.length - hi)];
};
