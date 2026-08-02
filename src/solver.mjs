// Treasure Trash — exhaustive analysis. The rooms are tiny, so we do not estimate
// anything: every reachable state is enumerated, and liveness is computed exactly.
//
// This is the small-board version of what a Sokoban solver approximates with deadlock
// tables (Junghanns & Schaeffer, Rolling Stone): rather than pattern-matching a 5x4
// window, we label the whole reachable graph live-or-dead and read the answers off it.

import { DIR_ORDER, MOVE, explain, isWon, stateKey, cloneState, cell } from './rules.mjs';
import { formatLurd } from './format.mjs';

/**
 * Enumerate the level's whole state graph.
 * Returns:
 *   states       Map key -> { state, depth, edges:[{dir,kind,to}] }
 *   minMoves     length of the shortest win, or null if unsolvable
 *   shortestLurd one canonical shortest solution (ties broken by DIR_ORDER)
 *   shortestCount how many distinct shortest action-sequences exist (>1 = unintended solves)
 *   dead         Set of keys from which no win is reachable
 *   traps        [{ lurd, dir, kind, buriesExit }] live -> dead transitions
 *   silentTraps  subset of traps whose action is a plain MOVE (see LAW below)
 */
export function analyze(start) {
  const states = new Map();
  const rootKey = stateKey(start);
  states.set(rootKey, { state: start, depth: 0, edges: [], prev: null, prevAction: null });

  // --- forward BFS over the full reachable graph
  let frontier = [rootKey];
  while (frontier.length) {
    const next = [];
    for (const key of frontier) {
      const node = states.get(key);
      for (const dir of DIR_ORDER) {
        const r = explain(node.state, dir);
        if (!r.ok) continue;
        const k = stateKey(r.next);
        if (!states.has(k)) {
          states.set(k, { state: r.next, depth: node.depth + 1, edges: [], prev: key, prevAction: { dir, kind: r.kind } });
          next.push(k);
        }
        node.edges.push({ dir, kind: r.kind, to: k });
      }
    }
    frontier = next;
  }

  // --- liveness: reverse-reachability from every winning state
  const reverse = new Map();
  for (const [key, node] of states) for (const e of node.edges) {
    if (!reverse.has(e.to)) reverse.set(e.to, []);
    reverse.get(e.to).push(key);
  }

  const live = new Set();
  const queue = [];
  for (const [key, node] of states) if (isWon(node.state)) { live.add(key); queue.push(key); }
  while (queue.length) {
    const k = queue.pop();
    for (const p of reverse.get(k) ?? []) if (!live.has(p)) { live.add(p); queue.push(p); }
  }
  const dead = new Set([...states.keys()].filter(k => !live.has(k)));

  // --- shortest win: depth, a canonical path, and how many distinct ones exist
  const wins = [...states.entries()].filter(([, n]) => isWon(n.state));
  const minMoves = wins.length ? Math.min(...wins.map(([, n]) => n.depth)) : null;
  let shortestLurd = null, shortestCount = 0;
  if (minMoves !== null) {
    const best = wins.filter(([, n]) => n.depth === minMoves).map(([k]) => k);
    shortestLurd = formatLurd(pathTo(states, best[0]));
    shortestCount = countShortestPaths(states, rootKey, new Set(best), minMoves);
  }

  // --- traps: a legal action that takes a live state to a dead one
  const traps = [];
  for (const [key, node] of states) {
    if (!live.has(key)) continue;
    for (const e of node.edges) {
      if (!dead.has(e.to)) continue;
      traps.push({
        lurd: formatLurd([...pathTo(states, key), { dir: e.dir, kind: e.kind }]),
        dir: e.dir, kind: e.kind,
        // How many actions in the trap is sprung. Carried here because it is free — the
        // node already knows — and recovering it from `lurd` means parsing back a string
        // we just formatted.
        depth: node.depth,
      });
    }
  }
  // How often does the exit itself refuse an action? This is what replaced the
  // exit-burying trap: the room's way out no longer punishes you after the fact, it
  // says no at the moment you try. A room where this is zero has an exit that forbids
  // nothing — a walk-back tax.
  let exitRefusals = 0;
  for (const [, node] of states)
    for (const dir of DIR_ORDER) {
      const r = explain(node.state, dir);
      if (!r.ok && r.reason === 'exit') exitRefusals++;
    }

  return {
    states, minMoves, shortestLurd, shortestCount, dead, traps, exitRefusals,
    silentTraps: traps.filter(t => t.kind === MOVE),
    reachable: states.size,
  };
}

function pathTo(states, key) {
  const out = [];
  for (let k = key; states.get(k).prev !== null; k = states.get(k).prev) out.push(states.get(k).prevAction);
  return out.reverse();
}

/** Count distinct shortest action-sequences by DP over BFS layers. */
function countShortestPaths(states, rootKey, targets, minMoves) {
  const byDepth = [];
  for (const [k, n] of states) (byDepth[n.depth] ??= []).push(k);
  const ways = new Map([[rootKey, 1]]);
  for (let d = 0; d < minMoves; d++) {
    for (const k of byDepth[d] ?? []) {
      const w = ways.get(k) ?? 0;
      if (!w) continue;
      for (const e of states.get(k).edges) {
        if (states.get(e.to).depth !== d + 1) continue;   // stay on the shortest-path DAG
        ways.set(e.to, (ways.get(e.to) ?? 0) + w);
      }
    }
  }
  return [...targets].reduce((a, k) => a + (ways.get(k) ?? 0), 0);
}

/** Replay a declared solution through the engine. Throws on the first disagreement. */
export function replay(start, actions) {
  let s = cloneState(start);
  const trace = [s];
  actions.forEach((a, i) => {
    const r = explain(s, a.dir);
    if (!r.ok) throw new Error(`move ${i + 1} (${a.kind} ${a.dir}): illegal — blocked by ${r.reason}`);
    if (r.kind !== a.kind) throw new Error(`move ${i + 1} (${a.dir}): declared ${a.kind}, board gives ${r.kind}`);
    s = r.next; trace.push(s);
  });
  return { final: s, trace };
}
