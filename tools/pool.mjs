#!/usr/bin/env node
// Treasure Trash — put a list of things through a function, on every core.
//
// `survey`, `harvest`, `resite` and `shrink` are the same shape: deal a list out to workers, run
// one function per item, write the results to a file. Only the function differs, so only the
// function lives in those files.
//
// The ORDER is the part worth having once. Each item carries the index it came in on, because
// workers finish out of order and a file whose order depends on which core was quickest is a
// file that reorders itself every run — a diff on it would then say nothing about what changed.
// It matters even where the caller sorts afterwards: a sort breaks ties by arrival, so arrival
// order is the tie-break whether or not anyone chose it.

import { availableParallelism } from 'node:os';
import { Worker, parentPort, workerData } from 'node:worker_threads';

export const defaultWorkers = () => Math.max(1, availableParallelism() - 2);

/**
 * The worker half: one message per item, then a null saying this worker has no more. Per item
 * rather than per chunk because a chunk takes long enough that a run reporting only on
 * completion gives no way to tell slow from stuck.
 *
 * `each(item, i)` gets the item's position WITHIN THIS CHUNK, which is what the seeded tools
 * offset their per-worker seed by.
 */
export function serve(each) {
  workerData.chunk.forEach(({ at, item }, i) => parentPort.postMessage({ at, got: each(item, i) }));
  parentPort.postMessage(null);
}

/** `serve` for a pass that maps a set to a set: one it cannot speak for comes through
 *  unchanged rather than dropped. */
export const servePass = pass => serve(set => {
  try { return pass(set) ?? set; } catch { return set; }
});

/**
 * The main half: deal the items out, collect them back in the order they were dealt.
 *
 * `extra(w)` is whatever else that worker needs in `workerData`. `w` is its index among the
 * workers that actually got a chunk — the seeded tools derive their seed from it, so it has to
 * stay the filtered index rather than the raw one.
 */
export async function run({ self, tool, items, workers, extra = () => ({}), onItem = report }) {
  const chunks = Array.from({ length: workers }, () => []);
  items.forEach((item, at) => chunks[at % workers].push({ at, item }));
  const live = chunks.filter(c => c.length);

  const t0 = Date.now();
  const out = new Array(items.length);
  let done = 0;
  await Promise.all(live.map((chunk, w) => new Promise((ok, no) => {
    const worker = new Worker(self, { workerData: { tool, chunk, ...extra(w) } });
    worker.on('message', msg => {
      if (msg === null) return ok();
      out[msg.at] = msg.got;
      onItem({ got: msg.got, done: ++done, total: items.length, ms: Date.now() - t0 });
    });
    worker.on('error', no);
  })));
  return out;
}

const report = ({ done, total, ms }) => console.log(`  ${done}/${total}  (${(ms / 1000).toFixed(0)}s)`);
