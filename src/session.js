// A play session: which room you are in, the board, the undo stack, the move count, and
// the two pieces of interface state that survive between inputs (what was refused, what is
// aimed). Pure — no DOM, no canvas, no clock. Everything here can be driven from a test.
//
// `act()` returns an EVENT rather than drawing anything. The view decides what a refusal
// looks like and how long a slide takes; the session decides only what happened. That split
// is what lets the rules stay the single authority: `explain()` is asked once, and both the
// board and the animation are derived from the same answer.

import { explain, isWon, cloneState, cell, inGrid, DIRS, NONE, MOVE } from './rules.mjs';
import { toState } from './format.mjs';

/**
 * @param {Array<object>} levels parsed level records, in play order.
 * @returns {object} the session.
 */
export function createSession(levels) {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new Error('createSession() requires a non-empty level list'); // boundary
  }

  let index = 0, state = null, history = [], moves = 0, won = false;
  let blocked = null;   // { cells, reason, dir } — what the rules last said no to
  let armed = null;     // direction of an action that is aimed but not yet committed

  // ARMING IS A SCAFFOLD, NOT AN INPUT MODE. `:arm on` in the level file makes
  // board-changing actions ask twice, and it belongs on the room that INTRODUCES a piece —
  // the bag in L1, the can in L2. Everywhere else it is off, which is the default and the
  // normal Sokoban feel: one press, one action, undo if you hate it.
  //
  // Which actions it covers is settled by Sokoban's root law — you cannot pull, so anything
  // that touches the board is permanent. Measured over the pack: moves are 100% reversible
  // by play, tears 0%, full-can pushes 0%, empty-can pushes 44% and only by walking round to
  // the far side. So walking is free and everything else arms.
  //
  // `rules.mjs` does not know about arming, the solver never sees it, and it cannot change a
  // par: aiming is not a move.
  const arming = () => levels[index].arm === true;

  // `:preview on` tints the cells a strike would fill before you make it. Like arming, it
  // is a scaffold on the rooms that teach the fan (L1-L3) and comes off afterwards: from
  // L4 on, knowing the fan's shape is part of playing the game. Also like arming, it lives
  // above the rules — the solver never sees it, so it cannot change a par.
  const previewing = () => levels[index].preview === true;

  /** The occupant one step ahead — NONE off-grid, so callers never have to bounds-check. */
  const ahead = (dir) => {
    const [dx, dy] = DIRS[dir];
    const tx = state.rac.x + dx, ty = state.rac.y + dy;
    return inGrid(state, tx, ty) ? cell(state, tx, ty).o : NONE;
  };

  const api = {
    get level() { return levels[index]; },
    get levels() { return levels; },
    get index() { return index; },
    get state() { return state; },
    get moves() { return moves; },
    get won() { return won; },
    get blocked() { return blocked; },
    get armed() { return armed; },
    get preview() { return previewing(); },
    get canUndo() { return history.length > 0; },
    /** What the aimed action would do to, so the HUD can name it. */
    get armedTarget() { return armed ? ahead(armed) : NONE; },

    /** Start room `i`, wrapping in both directions so Prev on L0 lands on the last room. */
    load(i) {
      index = ((i % levels.length) + levels.length) % levels.length;
      state = toState(levels[index]);
      history = []; moves = 0; won = false; blocked = null; armed = null;
      return api;
    },
    next() { return api.load(index + 1); },
    prev() { return api.load(index - 1); },
    restart() { return api.load(index); },

    /** Step back one action. Returns whether there was anything to undo. */
    undo() {
      if (!history.length) return false;
      state = history.pop();
      moves--; won = false; blocked = null; armed = null;
      return true;
    },

    /**
     * Try a direction.
     * @returns {{type:'refused'|'armed'|'acted', ...}} what the board did about it.
     */
    act(dir) {
      const r = explain(state, dir);

      if (!r.ok) {
        blocked = { cells: r.blame, reason: r.reason, dir };
        armed = null;
        return { type: 'refused', dir, reason: r.reason, blame: r.blame, target: ahead(dir) };
      }
      if (arming() && r.kind !== MOVE && armed !== dir) {
        armed = dir; blocked = null;
        return { type: 'armed', dir };
      }

      const from = state;
      history.push(cloneState(state));
      state = r.next; moves++;
      blocked = null; armed = null;
      won = isWon(state);
      return { type: 'acted', dir, kind: r.kind, from, won };
    },
  };

  return api.load(0);
}
