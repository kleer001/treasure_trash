// Treasure Trash — exhaustive analysis. The rooms are tiny, so we do not estimate
// anything: every reachable state is enumerated, and liveness is computed exactly.
//
// This is the small-board version of what a Sokoban solver approximates with deadlock
// tables (Junghanns & Schaeffer, Rolling Stone): rather than pattern-matching a 5x4
// window, we label the whole reachable graph live-or-dead and read the answers off it.

import { DIR_ORDER, MOVE, explain, isWon, stateKey, cloneState, cell } from './rules.js';
import { formatLurd } from './format.js';

/** Thrown by `analyze` when `maxStates` is exceeded, so a caller can tell a room that is too
 *  big to enumerate from one that is merely unsolvable. */
export class TooManyStates extends Error {
  constructor(limit) { super(`state graph exceeds ${limit} states`); this.limit = limit; }
}

/**
 * Enumerate the level's whole state graph.
 *
 * `opts.maxStates` bounds the enumeration and THROWS `TooManyStates` when the bound is passed.
 * It never truncates: a partial graph would report a wrong par and a wrong trap count, and
 * every claim downstream of this function is only worth anything because the graph is whole.
 * Unbounded by default — a caller that has not thought about the bound gets the exact answer
 * or an out-of-memory crash, never a quiet lie.
 *
 * Returns:
 *   states       Map key -> { state, depth, edges:[{dir,kind,to}] }
 *   minMoves     length of the shortest win, or null if unsolvable
 *   shortestLurd one canonical shortest solution (ties broken by DIR_ORDER)
 *   shortestCount how many distinct shortest action-sequences exist (>1 = unintended solves)
 *   dead         Set of keys from which no win is reachable
 *   traps        [{ lurd, dir, kind, buriesExit }] live -> dead transitions
 *   silentTraps  subset of traps whose action is a plain MOVE
 */
export function analyze(start, opts = {}) {
  const maxStates = opts.maxStates ?? Infinity;
  const states = new Map();
  const rootKey = stateKey(start);
  states.set(rootKey, { state: start, depth: 0, edges: [], prev: null, prevAction: null });

  // --- forward BFS over the full reachable graph
  // How often the exit itself refuses an action is counted here rather than in a second sweep:
  // the BFS already visits every state and every direction, and already has the reason in hand.
  let exitRefusals = 0;
  let frontier = [rootKey];
  while (frontier.length) {
    const next = [];
    for (const key of frontier) {
      const node = states.get(key);
      for (const dir of DIR_ORDER) {
        const r = explain(node.state, dir);
        if (!r.ok) { if (r.reason === 'exit') exitRefusals++; continue; }
        const k = stateKey(r.next);
        if (!states.has(k)) {
          if (states.size >= maxStates) throw new TooManyStates(maxStates);
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
      });
    }
  }
  return {
    states, minMoves, shortestLurd, shortestCount, dead, traps, exitRefusals,
    silentTraps: traps.filter(t => t.kind === MOVE),
    reachable: states.size,
  };
}

/**
 * The set of boards from which the room can no longer be won — everything `analyze` computes
 * about liveness, and nothing else.
 *
 * A GENERATOR, driven a slice at a time, because this runs in the page: the rooms this pack
 * is heading toward reach tens of thousands of states, and computing that in one go would
 * stall the frame it started on. Yields `{ scanned }` every `budget` expansions and RETURNS
 * the dead set.
 *
 * Where `analyze` keeps a cloned board per state so it can report paths and pars, this keeps
 * only keys and adjacency — boards are dropped as soon as they are expanded. That is what
 * makes it affordable to run for every room the player opens.
 */
export function* deadScan(start, opts = {}) {
  const budget = opts.budget ?? 1200;
  const adj = new Map();                       // key -> [key], the only thing retained
  const wins = [];
  const seen = new Set([stateKey(start)]);
  let frontier = [[stateKey(start), start]];
  let work = 0;

  while (frontier.length) {
    const next = [];
    for (const [key, s] of frontier) {
      const outs = [];
      for (const dir of DIR_ORDER) {
        const r = explain(s, dir);
        if (!r.ok) continue;
        const k = stateKey(r.next);
        outs.push(k);
        if (!seen.has(k)) { seen.add(k); next.push([k, r.next]); }
      }
      adj.set(key, outs);
      if (isWon(s)) wins.push(key);
      if (++work % budget === 0) yield { scanned: work };
    }
    frontier = next;                           // the previous layer's boards go out of scope
  }

  const rev = new Map();
  for (const [k, outs] of adj) for (const o of outs) {
    if (!rev.has(o)) rev.set(o, []);
    rev.get(o).push(k);
  }
  const live = new Set(wins);
  const stack = [...wins];
  while (stack.length) {
    const k = stack.pop();
    for (const p of rev.get(k) ?? []) if (!live.has(p)) { live.add(p); stack.push(p); }
    if (++work % budget === 0) yield { scanned: work };
  }

  const dead = new Set();
  for (const k of adj.keys()) if (!live.has(k)) dead.add(k);
  return dead;
}

function pathTo(states, key) {
  const out = [];
  for (let k = key; states.get(k).prev !== null; k = states.get(k).prev) out.push(states.get(k).prevAction);
  return out.reverse();
}

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

/** Throws on the first disagreement between the declared solution and the engine. */
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
