// The dead-board scan, run on idle time: whether the board in hand can no longer be won.
import { stateKey } from './rules.js';
import { deadScan } from './solver.js';

const SCAN_BUDGET_MS = 1200;

/**
 * `askIdle(cb)` schedules `cb(deadline)` on idle time and returns a handle that `dropIdle` takes.
 * `onVerdict(dead)` hears a finished scan; `dead(key)` says whether a state key cannot be won.
 */
export function createLostScan({ askIdle, dropIdle, onVerdict }) {
  // `deadKeys` holds the state keys of this room that cannot be won.
  let deadKeys = null, scan = null, idle = 0, lost = false, spent = 0;

  // The player is owed a responsive first move more than an instant verdict.
  function pump(deadline){
    idle = 0;
    const t0 = performance.now();
    const slice = Math.min(12, Math.max(3, deadline?.timeRemaining?.() ?? 6));
    while(performance.now() - t0 < slice){
      const r = scan.next();
      if(!r.done) continue;
      // Null is the scan giving up on a room too big to enumerate.
      deadKeys = r.value; scan = null;
      if(deadKeys){                            // the room may already have been lost while it thought
        const dead = deadKeys;
        onVerdict(k => dead.has(k));
      }
      return;
    }
    spent += performance.now() - t0;
    if(spent >= SCAN_BUDGET_MS){ scan = null; return; }
    idle = askIdle(pump);
  }

  return {
    /** Starts the scan of a newly loaded room. */
    start(state){
      if(idle) dropIdle(idle);
      deadKeys = null; lost = false; spent = 0;
      scan = deadScan(state);
      idle = askIdle(pump);
    },
    check(state, won){ lost = !!deadKeys && !won && deadKeys.has(stateKey(state)); },
    get lost(){ return lost; },
  };
}
