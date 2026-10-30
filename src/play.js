// The game loop's bookkeeping, with no screen: the room in hand, its board and history, which way
// things face, the win, and a tear aimed but not committed. The game draws it and the headless
// harness times it; both play it through here, so the two cannot keep different books.
import { explain, isWon, cloneState, MOVE } from './rules.js';
import { toState } from './format.js';
import { decorAfter } from './stage.js';

/**
 * `levels` is the running order. Every call answers
 * with what happened, as `{ kind, ... }`; `tell` passes that on to the crow.
 */
export function createPlay({ levels, progress }) {
  let cur = 0, state = null, history = [], decor = null, won = false, armed = null;

  return {
    get cur() { return cur; },
    get state() { return state; },
    get decor() { return decor; },
    get moves() { return history.length; },
    /** The moves that made the board, as `lurd` letters: with the room, a replay. */
    get path() { return history.map(h => h.dir).join(''); },
    get won() { return won; },
    /** The direction of a tear that is aimed and not yet committed. */
    get armed() { return armed; },

    load(i, again = false) {
      cur = (i + levels.length) % levels.length;
      state = toState(levels[cur]); history = []; decor = null; won = false; armed = null;
      return { kind: 'loaded', again, cur, state };
    },

    /** A direction key. `moving`: a shove is still playing out, and his paws are busy. */
    press(dir, moving) {
      if (won) return { kind: 'handover' };
      const r = explain(state, dir, { trace: true });
      if (moving && (!r.ok || r.kind !== MOVE)) return { kind: 'busy', dir, r };
      const prev = state;
      if (!r.ok) {
        decor = decorAfter(state, decor, dir, r); armed = null;
        return { kind: 'refused', dir, r, prev };
      }
      if (levels[cur].arm === true && r.kind !== MOVE && armed !== dir) {
        armed = dir;
        return { kind: 'armed', dir, r };
      }
      history.push({ board: cloneState(state), decor, dir });
      decor = decorAfter(state, decor, dir, r);
      state = r.next; armed = null;
      const beat = isWon(state) && progress.record(levels[cur].id, history.length);
      won = isWon(state);
      return { kind: 'moved', dir, r, prev, won, beat };
    },

    undo() {
      if (!history.length) return { kind: 'none' };
      ({ board: state, decor } = history.pop());
      won = false; armed = null;
      return { kind: 'undone' };
    },
  };
}

/** The crow hears what a call to `play` did. Called last, once the caller's own work is done. */
export function tell(watch, t, res) {
  if (res.kind === 'busy') watch.busy(t);
  else if (res.kind === 'refused') watch.refused(t, res.dir, res.r, res.prev);
  else if (res.kind === 'armed') watch.key(t);
  else if (res.kind === 'moved') watch.action(t, res.dir, res.r, res.prev);
  else if (res.kind === 'undone') watch.undo(t);
  else if (res.kind === 'loaded') res.again ? watch.restart(t, res.state) : watch.room(t, res.cur, res.state);
}
