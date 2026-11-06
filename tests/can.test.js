import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spun } from '../src/art/can.js';

test('two sprites of one size and pixel count turn to their own pixels', () => {
  assert.deepEqual(spun({ w: 2, h: 2, px: [[0, 0, '#ff0000']] }, 0).px, [[0, 0, '#ff0000']]);
  assert.deepEqual(spun({ w: 2, h: 2, px: [[1, 1, '#00ff00']] }, 0).px, [[1, 1, '#00ff00']]);
});
