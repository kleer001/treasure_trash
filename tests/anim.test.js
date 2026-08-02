// Animation timelines: elapsed milliseconds in, numbers out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  confettiAlpha, confettiAt, easeOut, makeConfetti, progress, refusalDuration,
  refusalKindFor, refusalPhase,
} from '../src/anim.js';
import { BAG, CAN_FULL, CAN_EMPTY, TRASH, NONE } from '../src/rules.mjs';
import { WIN_MS, CONFETTI } from '../src/theme.js';

test('a refusal runs lunge, burst, flash, rewind, and then is over', () => {
  const d = refusalDuration('tear');
  assert.deepEqual(refusalPhase('tear', 0), { lunge: 0, burst: 0, flash: 0 });
  assert.equal(refusalPhase('tear', 75).lunge, 0.5, 'halfway into the lunge');
  assert.equal(refusalPhase('tear', 245).burst, 0.5, 'halfway into the burst');
  assert.equal(refusalPhase('tear', 400).flash, 1, 'holding on the flash');
  assert.ok(refusalPhase('tear', d - 1).lunge < 1, 'rewinding');
  assert.equal(refusalPhase('tear', d), null, 'and gone');
});

test('a refusal with nothing to burst still flashes', () => {
  assert.equal(refusalPhase('bump', 80).burst, 1);
  assert.equal(refusalPhase('bump', refusalDuration('bump')), null);
});

test('what a refusal shows depends on what is in the way', () => {
  assert.equal(refusalKindFor(BAG), 'tear');
  assert.equal(refusalKindFor(CAN_FULL), 'push');
  assert.equal(refusalKindFor(CAN_EMPTY), 'push');
  assert.equal(refusalKindFor(TRASH), 'bump');
  assert.equal(refusalKindFor(NONE), 'bump');
});

test('progress eases and then reports done', () => {
  assert.equal(progress(0, 100), 0);
  assert.equal(progress(50, 100), easeOut(0.5));
  assert.equal(progress(100, 100), null);
  assert.equal(progress(1000, 100), null);
});

test('confetti is seeded, so a replay of a room throws the same blast', () => {
  assert.deepEqual(makeConfetti(7), makeConfetti(7));
  assert.notDeepEqual(makeConfetti(7), makeConfetti(8));
  assert.equal(makeConfetti(7).length, CONFETTI.count);
});

test('confetti falls and fades out before the room hands over', () => {
  const [bit] = makeConfetti(1);
  assert.ok(confettiAt(bit, 1).dy > confettiAt(bit, 0.5).dy, 'gravity wins eventually');
  assert.equal(confettiAlpha(0), 1);
  assert.equal(confettiAlpha(WIN_MS / 1000), 0, 'transparent by the hand-over');
});
