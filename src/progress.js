// Treasure Trash — what the player has finished, and how well. No DOM, no canvas: the store
// is handed in at the boundary, so this is testable with a plain object.

export const STORE_KEY = 'treasure-trash:progress:1';

// Three stars is not "very good", it is OPTIMAL. Par here is the provably minimal action count
// — `tools/verify.mjs` re-proves it against the whole state graph for every shipped room — so a
// player matching it has matched the machine, and the game can say so without hedging.
//
// The second band is proportional rather than a flat "+3": being three actions over on a par-8
// room is a different mistake from being three over on a par-38 one, and a flat band would
// make the short rooms brutal and the long ones free.
export const SLACK = 1.25;

/** 3 optimal, 2 close, 1 finished, 0 never finished. */
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
  const read = () => {
    let raw = null;
    try { raw = store.getItem(STORE_KEY); } catch { return {}; }
    if (!raw) return {};
    let parsed;
    try { parsed = JSON.parse(raw); } catch { return {}; }
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    const clean = {};
    for (const [id, moves] of Object.entries(parsed))
      if (Number.isInteger(moves) && moves > 0) clean[id] = moves;
    return clean;
  };

  let best = read();
  const write = () => { try { store.setItem(STORE_KEY, JSON.stringify(best)); } catch { /* full or blocked: play on */ } };

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
