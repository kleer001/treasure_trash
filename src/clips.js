// The clips that play over a move in the pixel art: a container's dump, a bag's tear, a pane's
// shatter and a thing bobbing in the water. A clip starts when the rules report its step, takes the
// sprites it draws so they wait under it, and ends when its drawing does. Nothing here touches the
// page: the sprite set, the stage, the clock and the frame length come in at the boundary.
import { BAG, TRASH, PANE, DIRS, inGrid, cell, restsOn, isGlass } from './rules.js';
import { shedOf, dressPiles, SPLASH } from './stage.js';
import { moveStart } from './art/press.js';
import { onTwos } from './art/timing.js';
import { PIXEL_CELL } from './pixel.js';

const RIP_BAND = { pile: 0.02, shadow: 0.0205, air: 0.021, bag: 0.04, pane: 0.04 };
/** A tear's or a break's layer's place in the sort, as the row of cells its foot is on and a band in that row. */
const ripFoot = ({ kind, foot }) => {
  const row = Math.ceil(foot / PIXEL_CELL) - 1;
  return row + RIP_BAND[kind] + (kind === 'air' ? 0.004 * (foot / PIXEL_CELL - row) : 0);
};

/**
 * `pixel` is whether the pixel art is on, the only mode with clips. `art` is its sprite set,
 * `stage()` the stage standing now, `clock()` the clock in ms, `since(t0)` the time since `t0` as
 * the drawings count it, and `frame` the length of one 60 Hz frame in ms.
 */
export function createClips({ pixel, art, stage, clock, since, frame }) {
  let dumps = [], rips = [], breaks = [], floats = [];
  const sprites = () => stage().sprites;

  const dumpAt = d => Math.round(since(d.t0) / frame);
  const breakAt = b => Math.round(since(b.t0) / frame);
  const bobAt = fl => Math.round(since(fl.t0) / frame) - fl.tin;
  const ripAt = r => { const g = Math.floor(since(r.t0) / frame); return onTwos(g) - r.move; };
  const dumpLive = d => since(d.t0) < d.end * frame && sprites().includes(d.container)
    && d.container.tx === d.at[0] && d.container.ty === d.at[1];
  const ripLive = r => ripAt(r) < r.clip.end
    && (!r.piles || r.piles.every((sp, i) => sprites().includes(sp) && sp.tx === r.cells[i][0] && sp.ty === r.cells[i][1]));
  const floatLive = fl => bobAt(fl) < art.bobEnd && sprites().includes(fl.sp)
    && fl.sp.tx === fl.at[0] && fl.sp.ty === fl.at[1];

  // The clip draws what the container shed as well, so that sprite waits under it.
  function noteDump(step, frames) {
    for (const m of step.moved) {
      if (m.o === m.becomes.o) continue;
      const out = shedOf(step, m), kind = out?.o === BAG || out?.o === TRASH ? out.o : out?.effect === 'pours' ? SPLASH : null;
      if (!kind) continue;
      const [x, y] = restsOn(m), [bx, by] = out.cells[0];
      const container = sprites().find(sp => sp.kind === m.becomes.o && sp.tx === x && sp.ty === y);
      const shed = sprites().find(sp => sp.kind === kind && sp.tx === bx && sp.ty === by
        && !sp.dying && (kind === SPLASH || !sp.spent || sp.falls));
      const clip = container && shed
        && art.dump(m.becomes.o, { container, shed, from: m.cells[0], to: [x, y], shedTo: [bx, by], moveFrames: frames, down: !!shed.falls });
      if (clip) dumps.push({ container, shed, at: [x, y], shedTo: [bx, by], t0: clock(), ...clip });
    }
  }

  // The clip draws the pane and the glass it breaks into, and lays their ground while it plays.
  function noteBreak(step, after) {
    const gone = step.gone.find(g => g.o === PANE), out = gone && step.spawned.find(e => e.from);
    if (!out || !isGlass(cell(after, ...out.cells[0]))) return;
    const [fx, fy] = gone.cells[0], [tx, ty] = out.cells[0];
    const dir = Object.keys(DIRS).find(d => DIRS[d][0] === tx - fx && DIRS[d][1] === ty - fy);
    breaks.push({ pane: sprites().find(sp => sp.handle === gone.handle), at: [tx, ty], t0: clock(),
      ...art.shatter({ dir, from: [fx, fy], to: [tx, ty], has: (x, y) => inGrid(after, x, y) && isGlass(cell(after, x, y)) }) });
  }

  function noteFloat(step, after, frames) {
    for (const m of step.moved) {
      if (m.o !== m.becomes.o) continue;
      const [x, y] = restsOn(m), c = cell(after, x, y);
      if (!c.water || c.bridge) continue;
      const thing = sprites().find(sp => sp.kind === m.o && sp.tx === x && sp.ty === y);
      if (thing) floats.push({ sp: thing, at: [x, y], t0: clock(), tin: frames });
    }
  }

  // The piles take their seeds and scraps from the clip when the step lands.
  function landRip(step) {
    const r = rips.find(r => !r.piles && step.gone.some(g => g.handle === r.handle));
    if (!r) return;
    r.piles = dressPiles(stage(), r.handles, r.clip.piles);
  }

  return {
    /** `after` is the board once the step has landed. `frames` is how many screen frames its beat takes. */
    note(step, after, frames) {
      if (!pixel) return;
      noteDump(step, frames);
      noteBreak(step, after);
      noteFloat(step, after, frames);
      landRip(step);
    },

    /** A tear aimed `dir` by the press that began at `pose`. */
    startRip(dir, step, pose) {
      if (!pixel) return;
      const gone = step.gone.find(g => g.o === BAG), spawned = step.spawned.filter(e => e.o === TRASH);
      const bag = sprites().find(sp => sp.handle === gone.handle), cells = spawned.map(e => e.cells[0]);
      rips.push({ t0: pose.t0, move: moveStart(pose.segs), handle: gone.handle, bag, cells, handles: spawned.map(e => e.handle),
        piles: null, clip: art.rip({ dir, bag: gone.cells[0], seed: bag.seed, cells }) });
    },

    reset() { dumps = []; rips = []; breaks = []; floats = []; },

    prune() {
      dumps = dumps.filter(dumpLive);
      rips = rips.filter(ripLive);
      breaks = breaks.filter(b => breakAt(b) < b.end);
      floats = floats.filter(floatLive);
    },

    /** Read after `prune`. Until then a finished clip still counts as live. */
    anyLive: () => !!(dumps.length || rips.length || breaks.length || floats.length),

    /** A thunk that draws the ground a live clip lays on cell (x, y), or null when none does. */
    groundOn(x, y) {
      const pour = dumps.find(d => d.ground && d.shedTo[0] === x && d.shedTo[1] === y);
      if (pour) return () => pour.ground(dumpAt(pour));
      const broke = breaks.find(b => b.at[0] === x && b.at[1] === y);
      return broke ? () => broke.ground(breakAt(broke)) : null;
    },

    /** Whether a live clip draws `sp`'s own sprite: a torn bag, its piles or a broken pane. */
    owns: sp => rips.some(r => r.bag === sp || r.piles?.includes(sp)) || breaks.some(b => b.pane === sp),

    /** Returns true when a live clip has `sp`, drawn or hidden, so the caller leaves it alone. */
    paint(sp) {
      if (dumps.some(d => d.shed === sp)) return true;
      const dump = dumps.find(d => d.container === sp);
      if (dump) { dump.draw(dumpAt(dump)); return true; }
      const fl = floats.find(fl => fl.sp === sp && bobAt(fl) >= 0);
      if (fl) { art.bob(sp.kind, sp.x, sp.y, bobAt(fl), sp.lie); return true; }
      return false;
    },

    /** Every live tear's and break's layers as `[foot, paint]`, tears first. */
    layers() {
      return [...rips.flatMap(r => r.clip.layers(ripAt(r))), ...breaks.flatMap(b => b.layers(breakAt(b)))]
        .map(l => [ripFoot(l), l.paint]);
    },
  };
}
