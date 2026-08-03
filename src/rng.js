// Seeded pseudo-random generator. Deterministic: same seed → same sequence.

/**
 * mulberry32 — a fast, seedable 32-bit PRNG. Returns floats in [0, 1).
 * `seed` is any integer; it is coerced to uint32.
 */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
