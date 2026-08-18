// The embed steals the keyboard, and the fix is invisible to any test that does not look for it:
// nothing on screen changes, no board moves, and the failure only exists inside somebody else's
// page. So the listeners themselves are what is asserted.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { installFocusReclaim } from '../src/focus.js';

const fakeWindow = () => {
  const on = [];
  return { on, focused: 0, focus() { this.focused++; },
           addEventListener(type, fn, capture) { on.push({ type, fn, capture }); } };
};

test('both signals are listened for, and each one takes the focus back', () => {
  const win = fakeWindow();
  installFocusReclaim(win);
  const types = win.on.map(l => l.type).sort();
  assert.deepEqual(types, ['pointerdown', 'resize']);
  for (const l of win.on) l.fn();
  assert.equal(win.focused, 2, 'each listener reclaims');
});

// Capture puts it ahead of the handler that cancels the press. Without it the reclaim is queued
// behind a `preventDefault` that has already swallowed the click it needed.
test('the pointer listener runs in the capture phase', () => {
  const win = fakeWindow();
  installFocusReclaim(win);
  assert.equal(win.on.find(l => l.type === 'pointerdown').capture, true);
});
