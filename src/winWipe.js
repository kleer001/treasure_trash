// The win: he leaves, a wall comes down over the room, and goes up again on the next one.
import { PATTERNS, KINDS, layWall, drawWipe, wallFrom, roomBeats, P } from './wipe.js';
import { FRAME_MS } from './art/timing.js';

// Frames at 60 Hz. `lay` is one brick's drop into its course.
export const WIPE = { exit: 12, empty: 30, cover: 40, roomHold: 60, roomHoldMax: 120, reveal: 30, revealMax: 90, tail: 60,
  lay: 8, order: 'same', leave: 'hop', pattern: 'room', kind: 'room' };

/**
 * `settings()` is the wipe's timing table, `WIPE` or the `?wipe` tuner's. `room()` is the room's
 * index in the running order. `clock()` is the animation clock and `since(t0)` its time on twos.
 * `crow()` is the crow and `now()` his clock. `chime()` plays the win, `kick()` asks for a frame.
 */
export function createWinWipe({ pixel, settings, room, crow, now, clock, since, chime, kick }){
  let wipe = null, last = null;
  let wall = null;      // laid once per board size and kind, since laying one is costly

  /** Frames since he started to leave; negative while the winning step is still on its way. */
  const at = () => wipe.t0 === null ? -1 : since(wipe.t0) / FRAME_MS;
  function roomIn(w){
    crow().cue(now());
    const { hold, reveal } = roomBeats((crow().peek().line?.lineLeft ?? 0) / FRAME_MS, w.set);
    w.loaded = true;
    w.t.hold = at() - wallFrom(w.t) - w.t.cover + hold; w.t.reveal = reveal;
  }

  return {
    start(replay = false){
      if(!replay) chime();
      const h = ((room() + 1) * 2654435761) >>> 0, s = settings(), kinds = Object.keys(KINDS);
      wipe = { t0: null, replay, loaded: false, set: s, t: { ...s, hold: Infinity },
        pattern: s.pattern === 'room' ? PATTERNS[h % PATTERNS.length] : s.pattern,
        kind: s.kind === 'room' ? kinds[(h >>> 8) % kinds.length] : s.kind };
      last = { pattern: wipe.pattern, kind: wipe.kind };
      kick();
    },
    /** One frame of the wipe. `moving`: the winning step is still playing. Returns 'handover' when
     *  the wall is down and the next room is due. */
    step(moving){
      if(!wipe) return;
      if(wipe.t0 === null && !moving){ wipe.t0 = clock(); crow().cue(now()); }
      const f = at(), t = wipe.t;
      if(!wipe.loaded && f >= wallFrom(t) + t.cover && !crow().view(now()).talking){
        if(!wipe.replay) return 'handover';
        roomIn(wipe);
      }
      if(f >= wallFrom(t) + t.cover + t.hold + t.reveal) wipe = null;
    },
    cancel(){ wipe = null; },
    /** Takes the wipe off, to carry it across a room load. */
    detach(){ const w = wipe; wipe = null; return w; },
    /** Puts a carried wipe back on, over the room just loaded. */
    attach(w){ wipe = w; roomIn(w); },
    /** How far gone he is, 0 to 1, until the wall comes down; null when he is simply there. */
    leaving(){
      if(!wipe || wipe.t0 === null) return null;
      const f = at(), t = wipe.t;
      return f >= wallFrom(t) + t.cover + t.hold ? null : Math.min(1, f / t.exit);
    },
    drawWall(ctx, f){
      const fr = at() - wallFrom(wipe.t);
      if(fr < 0) return;
      if(wall?.kind !== wipe.kind || wall.w !== f.w || wall.h !== f.h)
        wall = Object.assign(layWall(wipe.kind, f.w, f.h, 1, pixel ? 1 : P), { w: f.w, h: f.h });
      drawWipe(ctx, wall, wipe.pattern, wipe.t, fr);
    },
    get live(){ return !!wipe; },
    /** He has started to leave. */
    get started(){ return wipe?.t0 != null; },
    /** How he leaves: 'fade', 'hop' or the dither. */
    get style(){ return wipe.t.leave; },
    /** The pattern and kind of the last wipe started. */
    get last(){ return last; },
  };
}
