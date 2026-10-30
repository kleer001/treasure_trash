// One press by the cartoon raccoon, for a scene page that draws what the press does to a thing.
// Times are in 60 Hz frames, from the action's rest.
import { ACTIONS, RECOVERIES, draw, mirror } from './cartoon.js';
import { C } from './flight.js';

export const VIEW = { l: 'side', r: 'side', d: 'front', u: 'back' };
const STEP = { u: [0, -1], d: [0, 1], l: [-1, 0], r: [1, 0] };

/** The drawings of `act` toward `dir`, `{ f, t0, t1 }`. `holds` replaces each frame's authored hold. `lead` false drops the opening rest. */
export function press(act, dir, { recovery = RECOVERIES[0], holds = null, lead = true } = {}) {
  const fs = ACTIONS[VIEW[dir]][act].map((f, i) => ({ ...f, i }));
  if (holds?.length !== fs.length) holds = null;    // tuned before the action gained or lost a frame
  const segs = [];
  let t = 0;
  for (const f of fs) {
    if ((segs.length || !lead) && f.beat === 'rest' || f.recovery && f.recovery !== recovery) continue;
    const fr = holds?.[f.i] ?? f.fr;
    segs.push({ f, t0: t, t1: (t += fr) });
  }
  return segs;
}

export const moveStart = segs => (segs.find(s => s.f.beat === 'move') ?? segs[0]).t0;
export const moveStop = segs => segs.filter(s => s.f.beat === 'move').at(-1).t1;

export const segAt = (segs, g) => segs.find(s => g < s.t1) ?? segs[segs.length - 1];

/** How far through its cell the thing he pushes is `g` frames into the press, 0 to 1. */
export const travelAt = (segs, g) => {
  const f = segAt(segs, g).f;
  return Math.min(1, Math.max(0, (f.thing ?? f.dx) / C));
};

/** Its pixels, its top-left, and the parts that go in front of the thing he pushes. */
export function place(seg, dir, cx, cy) {
  const flip = s => (dir === 'l' ? mirror(s) : s);
  const spr = flip(draw(seg.f)), over = seg.f.over?.length ? flip(draw(seg.f, { layer: 'over' })).px : [];
  const [vx, vy] = STEP[dir], d = seg.f.dx;
  const x = cx * C + Math.floor((C - spr.w) / 2) + vx * d, y = cy * C + C - spr.h - 1 + vy * d;
  return { px: spr.px, over, x, y, w: spr.w, h: spr.h };
}
