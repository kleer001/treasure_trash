// Treasure Trash — what the player has finished, and how well. No DOM, no canvas: the store
// is handed in at the boundary, so this is testable with a plain object.

export const STORE_KEY = 'treasure-trash:progress:1';

export const SLACK = 1.25;

export function stars(best, par) {
  if (best == null) return 0;
  if (best <= par) return 3;
  if (best <= Math.ceil(par * SLACK)) return 2;
  return 1;
}

/**
 * Progress over a `Storage`-shaped object — anything with getItem/setItem. Records the BEST
 * run per room, never the latest: finishing a room badly after finishing it well must not take
 * the stars away.
 */
export function createProgress(store) {
  // Storage is outside the program: a user can edit it, and an older build can have left
  // something else there. Validated at this boundary and then trusted everywhere else.
  //
  // A store that throws on read, or that holds something other than a record, holds something
  // unknown, so `write` leaves it alone.
  const read = () => {
    let raw = null;
    try { raw = store.getItem(STORE_KEY); } catch { return null; }
    if (!raw) return {};
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return null; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const clean = {};
    for (const [id, moves] of Object.entries(parsed))
      if (Number.isInteger(moves) && moves > 0) clean[id] = moves;
    return clean;
  };

  const stored = read();
  let best = stored ?? {};
  const write = () => { if (stored === null) return; try { store.setItem(STORE_KEY, JSON.stringify(best)); } catch { /* full or blocked: play on */ } };

  return {
    /** Fewest actions this room has ever been finished in, or null. */
    best: id => best[id] ?? null,
    done: id => best[id] !== undefined,
    stars: (id, par) => stars(best[id] ?? null, par),

    /** Returns true when this run beat the record, so the caller can say so. */
    record(id, moves) {
      if (!Number.isInteger(moves) || moves <= 0) return false;
      if (best[id] !== undefined && best[id] <= moves) return false;
      best[id] = moves;
      write();
      return true;
    },

    /** How far through a run of rooms the player is. `levels` are the rooms in question. */
    tally(levels) {
      let done = 0, earned = 0, possible = 0;
      for (const l of levels) {
        possible += 3;
        if (best[l.id] === undefined) continue;
        done++;
        earned += stars(best[l.id], l.par);
      }
      return { done, total: levels.length, earned, possible, complete: done === levels.length };
    },

    clear() { best = {}; write(); },
  };
}
