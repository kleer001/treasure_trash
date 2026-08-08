#!/usr/bin/env node
// Treasure Trash — run one pass over every candidate set, on every core.
//
// `resite` and `shrink` are the same shape: read `sets.jsonl`, put each set through a function,
// write the file back. Only the function differs, so only the function lives in those files.
//
// The ORDER is the part worth having once. Each set carries the index it came in on, because
// workers finish out of order and a file whose order depends on which core was quickest is a
// file that reorders itself every run — a diff on `sets.jsonl` would then say nothing about what
// changed. A set the pass cannot speak for comes through unchanged rather than dropped.

import { availableParallelism } from 'node:os';
import { Worker, parentPort, workerData } from 'node:worker_threads';

export const defaultWorkers = () => Math.max(1, availableParallelism() - 2);

/** The worker half: put this chunk through `pass` and hand it back with its indices. */
export function servePass(pass) {
  parentPort.postMessage(workerData.chunk.map(({ at, set }) => {
    try { return { at, set: pass(set) ?? set }; } catch { return { at, set }; }
  }));
}

/** The main half: deal the sets out, collect them back in the order they were dealt. */
export async function runPass({ self, tool, sets, workers, log = console.log }) {
  const chunks = Array.from({ length: workers }, () => []);
  sets.forEach((set, at) => chunks[at % workers].push({ at, set }));

  const t0 = Date.now();
  const out = new Array(sets.length);
  let done = 0;
  await Promise.all(chunks.filter(c => c.length).map(chunk => new Promise((res, rej) => {
    const w = new Worker(self, { workerData: { tool, chunk } });
    w.on('message', got => {
      for (const { at, set } of got) out[at] = set;
      done += got.length;
      log(`  ${done}/${sets.length} sets  (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
      res();
    });
    w.on('error', rej);
  })));
  return out;
}
