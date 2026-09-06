// The guard itself. A gate nobody has watched fail is a gate nobody can trust, so these pin the
// two properties it rests on: the fingerprint answers for BEHAVIOUR, and the ledger is readable.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fingerprint } from '../tools/fingerprint.mjs';

test('the fingerprint is deterministic', () => {
  assert.equal(fingerprint(), fingerprint());
});

test('the newest decision names the rules the engine actually plays', () => {
  const m = /^## \d{4}-\d{2}-\d{2} — ([0-9a-f]{16})\s*$/m.exec(readFileSync('DECISIONS.md', 'utf8'));
  assert.ok(m, 'DECISIONS.md has a `## <date> — <fingerprint>` heading to read');
  assert.equal(m[1], fingerprint(),
    'the engine answers differently from the newest entry — a rule moved with nothing recording it');
});
