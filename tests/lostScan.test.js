import { test } from 'node:test';
import assert from 'node:assert/strict';
import { toState } from '../src/format.js';
import { explain } from '../src/rules.js';
import { createLostScan } from '../src/lostScan.js';

const ROOM = toState({ id: 'lost', grid: ['-FF--', '#-$--', '#---@', '##E--'], cart: ['-----', '-----', '--PP-', '-----'] });

const syncScan = () => {
  const heard = [];
  const scan = createLostScan({
    askIdle: cb => { queueMicrotask(() => cb({ timeRemaining: () => 12 })); return 1; },
    dropIdle: () => {},
    onVerdict: dead => heard.push(dead),
  });
  return { scan, heard };
};
const settle = () => new Promise(done => setTimeout(done, 0));

test('the scan hears a verdict, and a losing move reads as lost', async () => {
  const { scan, heard } = syncScan();
  scan.start(ROOM);
  while (!heard.length) await settle();
  scan.check(ROOM, false);
  assert.equal(scan.lost, false);
  const next = explain(ROOM, 'l').next;
  scan.check(next, false);
  assert.equal(scan.lost, true);
  scan.check(next, true);
  assert.equal(scan.lost, false);
});

test('a board checked before the verdict is not lost', () => {
  const { scan } = syncScan();
  scan.start(ROOM);
  scan.check(explain(ROOM, 'l').next, false);
  assert.equal(scan.lost, false);
});
