// Exhaustive analysis: every reachable state is enumerated and liveness computed exactly.

import { DIR_ORDER, MOVE, explain, isWon, stateKey, cloneState } from './rules.mjs';
import { formatLurd } from './format.mjs';

/**
 * Enumerate the level's whole state graph.
 * @returns {object} states, minMoves, shortestLurd, shortestCount, dead, traps,
 *   silentTraps (traps whose action is a plain move), exitRefusals, reachable.
 */
export function analyze(start) {
  const states = new Map();
  const rootKey = stateKey(start);
  states.set(rootKey, { state: start, depth: 0, edges: [], prev: null, prevAction: null });

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

  const wins = [...states.entries()].filter(([, n]) => isWon(n.state));
  const minMoves = wins.length ? Math.min(...wins.map(([, n]) => n.depth)) : null;
  let shortestLurd = null, shortestCount = 0;
  if (minMoves !== null) {
    const best = wins.filter(([, n]) => n.depth === minMoves).map(([k]) => k);
    shortestLurd = formatLurd(pathTo(states, best[0]));
    shortestCount = countShortestPaths(states, rootKey, new Set(best), minMoves);
  }

  const traps = [];
  for (const [key, node] of states) {
    if (!live.has(key)) continue;
    for (const e of node.edges) {
      if (!dead.has(e.to)) continue;
      traps.push({
        lurd: formatLurd([...pathTo(states, key), { dir: e.dir, kind: e.kind }]),
        dir: e.dir, kind: e.kind, depth: node.depth,
      });
    }
  }

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
        if (states.get(e.to).depth !== d + 1) continue;
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
