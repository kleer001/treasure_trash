#!/usr/bin/env node
// Treasure Trash — talking to the sanctioned Rust engine.
//
// The engine is `engine/`, it is OFFLINE ONLY, and what it is for is level discovery: the
// survey is thirty-one CPU-hours and that is where the pipeline's time goes. See **One engine**
// in CLAUDE.md for what it owes before it may be used at all — the short version is that
// `tools/conform.mjs` proves it agrees with `src/rules.js` on every build, which is the only
// reason a caller here may trust an answer it did not compute itself.
//
// This is the client half. `conform.mjs` and the pipeline tools both speak to a child process
// over the same protocol, so the plumbing lives here once rather than in each of them.

import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { root } from './packs.mjs';
import { analyze, TooManyStates } from '../src/solver.js';
import { shapeOf, measureOf } from './conform-ref.mjs';

export const ENGINE_BIN = 'engine/target/release/tt-engine';
export const BUILD_IT = 'cargo build --release --manifest-path engine/Cargo.toml';

export const engineBuilt = () => existsSync(resolve(root, ENGINE_BIN));

/**
 * A child process that speaks the protocol. Replies are matched by id rather than by arrival,
 * so requests may be in flight together — how many at once is the caller's to choose.
 */
export function connect(command = ENGINE_BIN) {
  const child = spawn(command, { shell: true, stdio: ['pipe', 'pipe', 'inherit'], cwd: root });
  const pending = new Map();
  let nextId = 1;

  createInterface({ input: child.stdout }).on('line', line => {
    if (!line.trim()) return;
    const reply = JSON.parse(line);
    pending.get(reply.id)?.(reply);
    pending.delete(reply.id);
  });
  // An engine that dies mid-corpus would otherwise leave the caller waiting on a reply that is
  // never coming, and a hang reads like a slow port rather than a broken one.
  const died = new Promise((_, no) => child.on('exit', code => {
    if (pending.size) no(new Error(`engine exited (${code}) with ${pending.size} unanswered`));
  }));

  return {
    ask(req) {
      const id = nextId++;
      const reply = new Promise(ok => pending.set(id, ok));
      child.stdin.write(JSON.stringify({ id, ...req }) + '\n');
      return Promise.race([reply, died]);
    },
    close() { child.stdin.end(); },
  };
}

/** A room too big to enumerate. A finding about the room, not a failure of the engine. */
export const TOO_BIG = Symbol('tooBig');

/**
 * `measure` for a whole batch of boards, answers in the order the boards were given.
 *
 * A batch rather than a board at a time because the requests are independent and the replies
 * are matched by id: one round trip costs about 0.08ms and a board costs a couple of
 * milliseconds to enumerate, so asking one at a time would spend the saving on handshakes.
 * Callers that draw their boards from a seeded stream can draw the whole batch first — nothing
 * about a draw depends on how the last one scored.
 */
export async function measureMany(engine, states, maxStates) {
  const replies = await Promise.all(states.map(s =>
    engine.ask({ op: 'measure', ...shapeOf(s), maxStates })));
  return replies.map(r => {
    if (!r.error) return r;
    // The bound is the one error that is an answer. Anything else is the engine failing, and a
    // pipeline that shrugged that off would write a data file nobody could account for.
    if (r.error.startsWith('state graph exceeds')) return TOO_BIG;
    throw new Error(`engine: ${r.error}`);
  });
}

/**
 * The same reply `measureMany` gets from the port, computed in process instead.
 *
 * Built from `measureOf` — the very function `conform.mjs` compares the port against — so the
 * two paths cannot drift into returning different field sets. This is what `--no-engine` runs,
 * and what a checkout with no Rust toolchain gets.
 */
export function measureHere(s, maxStates) {
  try {
    return measureOf(analyze(s, { maxStates }));
  } catch (e) {
    if (e instanceof TooManyStates) return TOO_BIG;
    throw e;
  }
}

/**
 * Which engine a pipeline run should use: a path to spawn, or null to enumerate in process.
 * Decided once on the main side and passed down, so every worker uses the same one.
 *
 * Auto-detected rather than opt-in, because the whole point is that the hours come down and a
 * flag nobody remembers saves nobody anything. ANNOUNCED on every run, because "why did that
 * take sixteen hours" should be answerable by reading the log — a fallback nobody is told about
 * is the kind this codebase does not allow. `--no-engine` forces the JS path. A build that is
 * present but stale is the same hazard as any build artifact, and `conform.mjs` is how you
 * check it.
 */
export function engineFor(argv, log = console.log) {
  if (argv.includes('--no-engine')) {
    log('engine: src/solver.js (--no-engine)');
    return null;
  }
  if (!engineBuilt()) {
    log(`engine: src/solver.js — build the port for ~10x:  ${BUILD_IT}`);
    return null;
  }
  log(`engine: ${ENGINE_BIN}`);
  return ENGINE_BIN;
}
