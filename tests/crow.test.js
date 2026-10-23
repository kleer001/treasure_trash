import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const CROW = JSON.parse(readFileSync(new URL('../dialogue/crow.json', import.meta.url), 'utf8'));
const words = line => line.trim().split(/\s+/).length;

test('every crow event names itself, says whether it hints, and has something to say', () => {
  for (const [key, e] of Object.entries(CROW)) {
    assert.equal(typeof e.event, 'string', key);
    assert.ok(e.event.length, key);
    assert.equal(typeof e.hint, 'boolean', key);
    assert.ok(('lines' in e) !== ('byCount' in e), `${key}: lines or byCount, not both`);
  }
});

test('a count-staged event starts at the first time and only counts up', () => {
  for (const [key, e] of Object.entries(CROW)) {
    if (!e.byCount) continue;
    assert.equal(e.byCount[0].from, 1, key);
    e.byCount.forEach((s, i) => i && assert.ok(s.from > e.byCount[i - 1].from, `${key} step ${i}`));
  }
});

test('a crow line is ten words at most', () => {
  for (const [key, e] of Object.entries(CROW)) {
    const all = e.lines ?? e.byCount.flatMap(s => s.lines);
    assert.ok(all.length, key);
    for (const line of all) assert.ok(words(line) <= 10, `${key}: "${line}"`);
  }
});
