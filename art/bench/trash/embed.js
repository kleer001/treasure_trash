// A scene page shown inside the Piece Gallery. With `?embed` in its address the page shows its
// view canvas and nothing else, keeps its own clock still, and hands the gallery `window.bench`:
// the gallery owns the clock and asks for one 60 Hz frame at a time. A scene page then draws the
// cartoon raccoon pushing, timed by `press.js`, where it would draw its own still raccoon.
import { press, moveStart, segAt, place, VIEW } from '../../../src/art/press.js';

export const EMBED = new URLSearchParams(location.search).has('embed');
export const FRAME_MS = 1000 / 60;

let segs = null, dir = 'r', g = 0, last = null;

/** Hide everything but `view`, and expose `api` to the gallery. */
export function embed(view, api) {
  if (!EMBED) return;
  for (let el = view; el && el !== document.body; el = el.parentElement)
    for (const sib of el.parentElement.children) if (sib !== el) sib.style.display = 'none';
  Object.assign(document.body.style, { margin: '0', padding: '0', background: 'transparent' });
  view.style.border = 'none';
  window.bench = api;
}

/** The press this page plays, `act` toward `to`, with the holds tuned on the cartoon page. */
export function setPress(to, act = 'push') {
  dir = to;
  let tuned = null;
  try { tuned = JSON.parse(localStorage.getItem('trash-cartoon-v3') ?? '{}').holds?.[`${VIEW[to]} ${act}`]; } catch {}
  segs = press(act, to, { holds: tuned });
}

/** Move the gallery's clock to frame `frame`, and return the scene's own time: ms after the thing
 *  starts to move, 0 while he winds up. */
export function sceneMs(frame) { g = frame; return Math.max(0, (g - moveStart(segs)) * FRAME_MS); }

/** Frames the press takes, beyond `ms` of scene time after the thing starts to move. */
export const pressLength = ms => Math.max(segs[segs.length - 1].t1, moveStart(segs) + Math.ceil(ms / FRAME_MS));

/** The raccoon behind the thing at cell (cx, cy): the cartoon press frame in a gallery, else `own()`. */
export function raccoon(ctx, cx, cy, own) {
  if (!EMBED || !segs) { last = null; own(); return; }
  last = place(segAt(segs, g), dir, cx, cy);
  for (const [x, y, col] of last.px) { ctx.fillStyle = col; ctx.fillRect(last.x + x, last.y + y, 1, 1); }
}

/** The raccoon's drawing behind the thing at cell (cx, cy), `{ w, h, px, x, y }`, for a page that
 *  sorts its own drawings; `null` outside a gallery. */
export function raccoonSprite(cx, cy) {
  if (!EMBED || !segs) return (last = null);
  return (last = place(segAt(segs, g), dir, cx, cy));
}

/** The parts of the raccoon that go in front of what he pushes, once everything else is down. */
export function raccoonOver(ctx) {
  if (!last) return;
  for (const [x, y, col] of last.over) { ctx.fillStyle = col; ctx.fillRect(last.x + x, last.y + y, 1, 1); }
}

/** Draw `tile` into `view` at `zoom` art pixels a screen pixel. */
export function blit(view, tile, zoom) {
  if (view.width !== tile.width * zoom || view.height !== tile.height * zoom) { view.width = tile.width * zoom; view.height = tile.height * zoom; }
  const g = view.getContext('2d');
  g.imageSmoothingEnabled = false;
  g.drawImage(tile, 0, 0, view.width, view.height);
}
