// A thing that stands on its cell, seen straight from the side, falling over.
//
// A fall left or right turns its drawing in the picture about its bottom corner. A fall toward the
// viewer or away folds it instead: the front face shortens as the face it falls onto the view
// grows in — the face that looks at the viewer once it lies fallen toward them, or the face that
// looked at the floor. A thing can bring its own fall those two ways.
export const INK = '#19152b';

/** A w×h drawing of the pixels `inMask` holds: ink where one touches the outside, `colour` within. */
export function paint(w, h, inMask, colour) {
  const px = [];
  for (let r = 0; r < h; r++) for (let c = 0; c < w; c++) if (inMask(c, r)) {
    const edge = !inMask(c + 1, r) || !inMask(c - 1, r) || !inMask(c, r + 1) || !inMask(c, r - 1);
    px.push([c, r, edge ? INK : colour(c, r)]);
  }
  return { w, h, px };
}

const trig = deg => deg === 0 ? [1, 0] : deg === 90 ? [0, 1] : [Math.cos(deg * Math.PI / 180), Math.sin(deg * Math.PI / 180)];
const at = spr => { const m = new Map(spr.px.map(([x, y, col]) => [`${x},${y}`, col])); return (x, y) => m.get(`${x},${y}`); };

/** A drawing from `px` in px from the upright thing's top-left: `s`, and `ox, oy`, where it goes. */
function placed(px) {
  const ox = Math.min(...px.map(p => p[0])), oy = Math.min(...px.map(p => p[1]));
  return { s: { w: Math.max(...px.map(p => p[0])) - ox + 1, h: Math.max(...px.map(p => p[1])) - oy + 1,
    px: px.map(([x, y, col]) => [x - ox, y - oy, col]) }, ox, oy };
}

/** The falls of a thing drawn upright as `front`. End on, fallen toward the viewer, it shows
 *  `toward`, and fallen away `away`, both as wide as `front` and as deep as each other; its foot
 *  moves `fold` px as it falls either of those ways. Given `fall(dir, deg)`, it falls toward the
 *  viewer or away as that draws it instead: its pixels `px` and its `place(bx, by, d)`, in px from
 *  the upright thing's top-left. What it holds also shows where `opens(bx, by)` says its upright
 *  drawing looks into it. */
export function tipper(front, toward, away, fold, fall = null, opens = () => false) {
  const W = front.w, H = front.h, D = toward.h, FRONT = at(front), TOWARD = at(toward), AWAY = at(away);
  /** The front turned a quarter: clockwise lays its top to the right. */
  const quarter = cw => ({ w: H, h: W, px: front.px.map(([x, y, col]) => cw ? [H - 1 - y, x, col] : [y, W - 1 - x, col]) });
  const RESTS = { r: quarter(true), l: quarter(false), d: fall ? fallen('d', 90).s : toward, u: fall ? fallen('u', 90).s : away };

  /** The px of `faces`, `[face, rows, shown]` from the foot up, each squeezed to the height it shows,
   *  stacked up from `bottom`. */
  function stacked(bottom, faces) {
    const px = [];
    for (let y = bottom - (H + D); y < bottom; y++) {
      let up = bottom - y - 0.5, src = null;
      for (const [face, h, shown] of faces) {
        if (up < shown) { src = [face, h - 1 - Math.floor(up / (shown / h))]; break; }
        up -= shown;
      }
      if (src) for (let x = 0; x < W; x++) { const col = src[0](x, src[1]); if (col) px.push([x, y, col]); }
    }
    return px;
  }

  /** A fall left or right, `deg` degrees over: the front turned about its bottom corner on that side. */
  function turned(dir, deg) {
    const [cos, sin] = trig(deg), sg = dir === 'r' ? 1 : -1, pv = [dir === 'r' ? W : 0, H];
    const fwd = (u, v) => [u * cos - sg * v * sin, sg * u * sin + v * cos];
    const back = (u, v) => [u * cos + sg * v * sin, -sg * u * sin + v * cos];
    const upright = (x, y) => { const [u, v] = back(x + 0.5 - pv[0], y + 0.5 - pv[1]); return [u + pv[0], v + pv[1]]; };
    const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([x, y]) => fwd(x - pv[0], y - pv[1]));
    const xs = corners.map(p => p[0] + pv[0]), ys = corners.map(p => p[1] + pv[1]), px = [];
    for (let y = Math.floor(Math.min(...ys)); y < Math.ceil(Math.max(...ys)); y++)
      for (let x = Math.floor(Math.min(...xs)); x < Math.ceil(Math.max(...xs)); x++) {
        const [bx, by] = upright(x, y), col = FRONT(Math.floor(bx), Math.floor(by));
        if (col) px.push([x, y, col]);
      }
    return { ...placed(px),
      place: (bx, by) => { const [u, v] = fwd(bx - pv[0], by - pv[1]); return [u + pv[0], v + pv[1]]; },
      shows: (x, y) => { const [bx, by] = upright(x, y); return by < 0 && bx >= 1 && bx < W - 1 || opens(Math.floor(bx), Math.floor(by)); },
      hides: (x, y) => { const [bx, by] = upright(x, y); return bx >= 0 && bx < W && by >= 0 && by < H; } };
  }

  /** A fall toward the viewer ('d') or away ('u'), `deg` degrees over: two faces stacked from the
   *  foot up, each squeezed to the height it shows at that angle. */
  function folded(dir, deg) {
    const [cos, sin] = trig(deg), towardViewer = dir === 'd';
    const bottom = H + Math.round((towardViewer ? 1 : -1) * fold * (1 - cos));
    const faces = towardViewer ? [[FRONT, H, H * cos], [TOWARD, D, D * sin]] : [[AWAY, D, D * sin], [FRONT, H, H * cos]];
    const rim = faces[0][2] + (towardViewer ? 0 : faces[1][2]);        // how high the front face's top edge stands
    const tall = faces[0][2] + faces[1][2];
    return { ...placed(stacked(bottom, faces)),
      place: (bx, by, d) => [bx, bottom - ((H - by) * cos + (towardViewer ? d : D - d) * sin)],
      shows: (x, y) => {
        if (x >= 1 && x < W - 1 && bottom - y - 0.5 >= rim) return true;
        // Which row of the upright front this pixel shows, squeezed as the front face is.
        const up = bottom - y - 0.5 - (towardViewer ? 0 : D * sin), shown = H * cos;
        return up >= 0 && up < shown && opens(x, H - 1 - Math.floor(up / (shown / H)));
      },
      hides: (x, y) => !towardViewer && x >= 0 && x < W && y < bottom && bottom - y - 0.5 < tall };
  }

  /** A fall toward the viewer or away, `deg` degrees over, as the thing's own `fall` draws it.
   *  What it holds shows where its `shows` says, if it has one; its body hides nothing. */
  function fallen(dir, deg) {
    const { px, place, shows = () => false } = fall(dir, deg);
    return { ...placed(px), place, shows, hides: () => false };
  }

  const FRAMES = new Map();
  return {
    /** The thing lying where it fell toward `dir`. */
    rest: dir => RESTS[dir],
    /** The top-left of the thing in cell (cx, cy), upright, or lying where it fell toward `fell`.
     *  Its foot stands one pixel above the cell's bottom edge, as every sprite's does. */
    restAt(cx, cy, C, fell = null) {
      const s = fell ? RESTS[fell] : front;
      return [cx * C + Math.floor((C - s.w) / 2), cy * C + C - s.h - 1];
    },
    /** The thing `deg` degrees into a fall toward `dir`, 0 upright and 90 lying where it fell: its
     *  drawing `s` at `ox, oy`; `place(bx, by, d)`, where a point of the upright thing `d` px back
     *  from its front has gone; `shows(x, y)`, whether what it holds shows at that pixel over its
     *  rim; and `hides(x, y)`, whether its body is in front of that pixel. All in px from the
     *  upright thing's top-left. */
    frame(dir, deg) {
      const key = `${dir},${deg}`;
      if (!FRAMES.has(key)) FRAMES.set(key, dir === 'l' || dir === 'r' ? turned(dir, deg) : fall ? fallen(dir, deg) : folded(dir, deg));
      return FRAMES.get(key);
    },
  };
}
