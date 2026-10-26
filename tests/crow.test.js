import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { RANK_ENTRIES, rankTable } from '../src/crow.js';
import { builtNames } from '../src/crowWatch.js';

const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const CROW = read('../dialogue/crow.json');
// A slot counts as long as the longest thing it is filled with: "eleven bags and twelve cans".
const SLOT_WORDS = { n: 1, left: 5 };
const words = line => line.trim().split(/\s+/).reduce((a, w) => {
  const slot = w.match(/\{(\w+)\}/)?.[1];
  if (slot && !(slot in SLOT_WORDS)) throw new Error(`no width for the slot {${slot}} in "${line}"`);
  return a + (slot ? SLOT_WORDS[slot] : 1);
}, 0);
// A variant is one line, or a list of lines: a monologue.
const linesOf = e => (e.lines ?? e.byCount.flatMap(s => s.lines)).flat();

// A face is a still frame of the portrait (the talking frames are the beak's, not a face) or a
// banked expression clip.
const FRAMES = read('../art/bench/crow/68B_frames.json').frames.map(f => f.name);
const STILLS = ['closed', 'blink', 'squint', 'away'];
const FACES = new Set([...STILLS, ...read('../art/bench/crow/h3/clips.json')
  .filter(c => c.kind === 'expression').map(c => c.name)]);
const TALK = ['quiet', 'chatty', 'verbose'];

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

test('a crow line is ten words at most, or as many as its event allows', () => {
  for (const [key, e] of Object.entries(CROW)) {
    const all = linesOf(e);
    assert.ok(all.length, key);
    if ('words' in e) assert.ok(Number.isInteger(e.words) && e.words > 10, `${key}: words ${e.words}`);
    for (const line of all) assert.ok(words(line) <= (e.words ?? 10), `${key}: "${line}"`);
  }
});

test('every face the crow makes is a still frame or a banked expression clip', () => {
  for (const f of STILLS) assert.ok(FRAMES.includes(f), f);
  for (const [key, e] of Object.entries(CROW)) {
    assert.ok(FACES.has(e.face), `${key}: ${e.face}`);
    for (const s of e.byCount ?? []) assert.ok(FACES.has(s.face), `${key} from ${s.from}: ${s.face}`);
  }
});

test('every crow event says the quietest talk setting that still hears it', () => {
  for (const [key, e] of Object.entries(CROW)) assert.ok(TALK.includes(e.talk), `${key}: ${e.talk}`);
});

test('a variant is a line or a monologue of two lines or more, and a stretch or act mark is only ever set', () => {
  for (const [key, e] of Object.entries(CROW)) {
    for (const v of e.lines ?? e.byCount.flatMap(s => s.lines)) {
      if (typeof v === 'string') continue;
      assert.ok(Array.isArray(v) && v.length > 1, `${key}: a monologue needs two lines or more`);
      for (const line of v) assert.equal(typeof line, 'string', key);
    }
    if ('stretch' in e) assert.equal(e.stretch, true, key);
    if ('actBound' in e) assert.equal(e.actBound, true, key);
    if ('speech' in e) assert.equal(e.speech, true, key);
  }
});

test('a once-only event names its scope, and a callback names an event', () => {
  const ONCE = ['ever', 'room', 'sitting', 'visit'];
  for (const [key, e] of Object.entries(CROW)) {
    if ('once' in e) assert.ok(ONCE.includes(e.once), `${key}: once ${e.once}`);
    if ('after' in e) assert.ok(e.after in CROW, `${key}: after ${e.after}`);
  }
});

test('nothing the crow says mentions death', () => {
  const DEATH = /\b(dead|death|die[sd]?|dying|corpse|alive|kill\w*|grave|ghost|afterlife)\b/i;
  for (const [key, e] of Object.entries(CROW))
    for (const line of linesOf(e)) assert.ok(!DEATH.test(line), `${key}: "${line}"`);
});

test('the game fills {n}, and {left} only in the events it fires with the full ones left', () => {
  const LEFT = ['tear.half', 'tear.oneLeft', 'walk.exitDark', 'walk.exitDarkAgain'];
  for (const [key, e] of Object.entries(CROW))
    for (const line of linesOf(e)) for (const [m] of line.matchAll(/\{[^}]*\}/g))
      assert.ok(m === '{n}' || (m === '{left}' && LEFT.includes(key)), `${key}: "${line}"`);
});

test('every place in the rank names an event, and every event has a place', () => {
  const keys = Object.keys(CROW);
  for (const p of RANK_ENTRIES)
    assert.ok(p.endsWith('.') ? keys.some(k => k.startsWith(p)) : p in CROW, `rank entry ${p}`);
  rankTable(CROW);
});

// Every event name the code spells out: quoted in the watcher, or said by the director itself.
const SPELT = ['../src/crowWatch.js', '../src/crow.js'].flatMap(f =>
  [...readFileSync(new URL(f, import.meta.url), 'utf8')
    .matchAll(/'(lost|(?:room|meet|walk|tear|piece|refuse|undo|restart|lost|idle|win|progress|story)\.[A-Za-z0-9.]+)'/g)]
    .map(m => m[1]));

test('every event name the code fires is a crow event', () => {
  for (const k of [...SPELT, ...builtNames()]) assert.ok(k in CROW, k);
});

test('every crow event is fired by something', () => {
  const fired = new Set([...SPELT, ...builtNames()]);
  for (const [key, e] of Object.entries(CROW)) {
    if (e.stretch || fired.has(key) || fired.has(key.replace(/\.act\d+$/, ''))) continue;
    // A refusal is named after the rules' reason for it, which the code does not spell out.
    assert.ok(/^refuse\.[a-z]+[A-Za-z]*$/.test(key), `${key} is never fired`);
  }
});
