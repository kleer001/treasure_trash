// Play session: current room, board, undo stack, move count, arming and preview flags.
// Pure — no DOM, no canvas, no clock. `act()` returns an event; it draws nothing.

import { explain, isWon, cloneState, cell, inGrid, DIRS, NONE, MOVE } from './rules.mjs';
import { toState } from './format.mjs';

/**
 * @param {Array<object>} levels parsed level records, in play order.
 * @returns {object} the session.
 */
export function createSession(levels) {
  if (!Array.isArray(levels) || levels.length === 0) {
    throw new Error('createSession() requires a non-empty level list');
  }

  let index = 0, state = null, history = [], moves = 0, won = false;
  let blocked = null;
  let armed = null;

  const arming = () => levels[index].arm === true;
  const previewing = () => levels[index].preview === true;

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
    get armedTarget() { return armed ? ahead(armed) : NONE; },

    /** Start room `i`, wrapping in both directions. */
    load(i) {
      index = ((i % levels.length) + levels.length) % levels.length;
      state = toState(levels[index]);
      history = []; moves = 0; won = false; blocked = null; armed = null;
      return api;
    },
    next() { return api.load(index + 1); },
    prev() { return api.load(index - 1); },
    restart() { return api.load(index); },

    /** Step back one action. Returns false if there was nothing to undo. */
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
