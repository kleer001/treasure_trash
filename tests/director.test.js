import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createCrow, createCrowMemory, TUNING, beatMs, lineMs } from '../src/crow.js';

const ev = o => ({ event: 'x', hint: false, face: 'closed', talk: 'quiet', ...o });
const EVENTS = {
  'story.act1': ev({ once: 'ever', lines: [['One.', 'Two.']] }),
  'room.firstEver': ev({ once: 'ever', speech: true, lines: [['Hello.', 'Go on.']] }),
  'room.teach': ev({ once: 'room', lines: [['Look.', 'Go.']] }),
  'room.actFirst': ev({ once: 'room', lines: ['Act.'] }),
  'room.actFirst.act2': ev({ once: 'room', lines: ['Act two.'] }),
  'meet.bag': ev({ once: 'ever', face: 'blink', lines: ['Bag.'] }),
  'meet.couch': ev({ once: 'ever', lines: ['Couch!'] }),
  'win.nemesis': ev({ lines: ['Got it.'] }),
  'win.cameBack': ev({ once: 'room', lines: ['Back.'] }),
  'tear.first': ev({ once: 'visit', lines: ['Tore.'] }),
  'tear.oneLeft': ev({ once: 'visit', lines: ['Last one: {left}.'] }),
  'room.new': ev({ lines: ['New.', 'Fresh.', 'Another.'] }),
  'room.hasCouch': ev({ after: 'meet.couch', lines: ['Couch.'] }),
  'refuse.wall': ev({ lines: ['Wall.'] }),
  'refuse.edge': ev({ lines: [['Edge.', 'Again.']] }),
  'refuse.same3': ev({ lines: ['Third wall.'] }),
  'undo.fine': ev({ talk: 'verbose', face: 'squint', lines: ['Fine.'] }),
  'lost': ev({ byCount: [{ from: 1, face: 'away', lines: ['Oof.'] }, { from: 3, face: 'blink', lines: ['Third {n}.'] }] }),
  'progress.halfAct': ev({ once: 'room', lines: ['Half.'] }),
  'progress.skipped': ev({ lines: ['Fine, then.'] }),
  'progress.quieter': ev({ lines: ['Quiet, then.'] }),
};
const store = () => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => { m[k] = v; } }; };

function crow({ rng = () => 0, tuning = TUNING, memory = createCrowMemory(store()) } = {}) {
  const log = [];
  const c = createCrow({ events: EVENTS, rng, memory, tuning, onLog: r => log.push(r) });
  return { c, log, said: () => log.filter(r => r.type === 'say').map(r => r.key) };
}
const beat = s => beatMs([s], 0, false);
const pre = TUNING.preWaitMs;
const ACT1 = ['One.', 'Two.'];

test('he waits before he starts to talk, and types the line out', () => {
  const { c } = crow();
  c.fire('meet.bag', 0);
  assert.equal(c.view(pre - 1).talking, false);
  const v = c.view(pre);
  assert.equal(v.talking, true);
  assert.equal(v.text, '');
  assert.equal(v.face, 'blink');
  assert.equal(c.view(pre + 100).text, 'Bag.');
  assert.equal(c.view(pre + beat('Bag.')).talking, false);
});

test('only the highest-ranked event plays, and the rank is the order of the list', () => {
  const { c, said } = crow();
  c.fire('room.new', 0);
  c.fire('refuse.wall', 10);
  c.fire('meet.bag', 20);
  c.fire('room.teach', 30, { room: 'L1' });
  c.view(pre);
  assert.deepEqual(said(), ['room.teach']);
});

test('an event does not replace the line on screen: a common one is dropped, a once-only one waits', () => {
  const { c, said, log } = crow();
  c.fire('room.new', 0);
  c.view(pre + 10);
  c.fire('refuse.wall', pre + 20);
  c.fire('meet.bag', pre + 30);
  assert.ok(log.some(r => r.type === 'drop' && r.key === 'refuse.wall'));
  const done = pre + beat('New.');
  c.view(done + pre - 1);
  assert.deepEqual(said(), ['room.new']);
  c.view(done + pre);
  assert.deepEqual(said(), ['room.new', 'meet.bag']);
});

test('a waiting line about a room he has left is dropped unsaid, and fires again later', () => {
  const { c, said } = crow();
  c.fire('refuse.wall', 0);
  c.view(pre);
  c.fire('meet.bag', pre + 1);
  c.arrive(pre + 2);
  c.view(pre + beat('Wall.') + pre);
  assert.deepEqual(said(), ['refuse.wall']);
  c.fire('meet.bag', 20000);
  c.view(20000 + pre);
  assert.deepEqual(said(), ['refuse.wall', 'meet.bag']);
});

test('an undo drops what waited about the moves it took back; lines about the room and the win stay', () => {
  const { c, said } = crow();
  c.fire('tear.first', 0);
  c.rewind(10);
  c.view(pre + 10);
  assert.deepEqual(said(), []);
  c.fire('refuse.wall', 2000);
  c.view(2000 + pre);
  c.fire('tear.first', 2000 + pre + 1);
  c.fire('meet.bag', 2000 + pre + 2);
  c.fire('win.cameBack', 2000 + pre + 3, { room: 'L1' });
  c.rewind(2000 + pre + 4);
  c.view(60000);
  assert.deepEqual(said(), ['refuse.wall', 'meet.bag', 'win.cameBack']);
});

test('every event has a place in the rank, so a specific line beats its family whatever the order', () => {
  const { c, said } = crow();
  c.fire('refuse.wall', 0);
  c.fire('refuse.same3', 1);
  c.view(pre + 1);
  assert.deepEqual(said(), ['refuse.same3']);
});

test('a speech is flagged from the moment it is due until it ends', () => {
  const { c } = crow();
  c.fire('room.firstEver', 0);
  assert.equal(c.view(1).speech, true);
  assert.equal(c.view(pre + 1).speech, true);
  assert.equal(c.view(pre + lineMs(['Hello.', 'Go on.'], true) + 1).speech, false);
});

test('one press speeds the monologue up, a second press skips the rest of it', () => {
  const { c, log } = crow();
  c.fire('story.act1', 0);
  c.view(pre + 50);
  c.press(pre + 50);
  assert.ok(log.some(r => r.type === 'fast'));
  const left = (beatMs(ACT1, 0, false) - 50) / TUNING.fastX;
  assert.equal(c.view(pre + 50 + left + 1).beat, 1);
  c.press(pre + 50 + left + 2);
  assert.equal(c.view(pre + 50 + left + 3).talking, false);
  assert.ok(log.some(r => r.type === 'skip' && r.key === 'story.act1'));
});

test('a move is not an input to him: only press, fire and the clock move him on', () => {
  const { c } = crow();
  c.fire('story.act1', 0);
  assert.equal(c.view(pre + beatMs(ACT1, 0, false) - 1).beat, 0);
  assert.equal(c.view(pre + beatMs(ACT1, 0, false) + 1).beat, 1);
});

test('after a monologue, another monologue waits; a single line does not', () => {
  const { c, said } = crow();
  c.fire('story.act1', 0);
  const done = pre + lineMs(ACT1, false);
  c.view(done);
  c.fire('refuse.edge', done + 10);
  c.view(done + 10 + pre);
  assert.deepEqual(said(), ['story.act1']);
  c.fire('refuse.wall', done + 20 + pre);
  c.view(done + 20 + 2 * pre);
  assert.deepEqual(said(), ['story.act1', 'refuse.wall']);
});

test('a waiting once-only monologue starts when the monologue timer runs out', () => {
  const { c, said } = crow();
  c.fire('story.act1', 0);
  const done = pre + lineMs(ACT1, false);
  c.view(done);
  c.fire('room.teach', done + 10, { room: 'L1' });
  c.view(done + TUNING.monoGapMs - 1);
  assert.deepEqual(said(), ['story.act1']);
  c.view(done + TUNING.monoGapMs);
  assert.deepEqual(said(), ['story.act1', 'room.teach']);
});

test('a monologue waiting out the timer does not hold back a single line', () => {
  const { c, said } = crow();
  c.fire('story.act1', 0);
  const done = pre + lineMs(ACT1, false);
  c.view(done);
  c.fire('room.teach', done + 10, { room: 'L1' });
  c.view(done + 10 + pre);
  c.fire('refuse.wall', done + 20 + pre);
  c.view(done + 20 + 2 * pre);
  assert.deepEqual(said(), ['story.act1', 'refuse.wall']);
});

test('variants come out of a shuffle bag: none repeats until all have been said', () => {
  const seq = [0.9, 0.5, 0.1, 0.5, 0.5, 0.5];
  let i = 0;
  const { c, log } = crow({ rng: () => seq[i++ % seq.length], tuning: { ...TUNING, eventGapMs: 0, repeatChance: { quiet: 1, chatty: 1, verbose: 1 } } });
  let t = 0;
  for (let k = 0; k < 3; k++) { c.fire('room.new', t); t += pre + 5000; c.view(t); }
  const lines = log.filter(r => r.type === 'say').map(r => r.beats[0]);
  assert.equal(new Set(lines).size, 3);
});

test('a refilled shuffle bag never opens on the line said last', () => {
  let roll = 0;
  const { c, log } = crow({ rng: () => roll, tuning: { ...TUNING, eventGapMs: 0, repeatChance: { quiet: 1, chatty: 1, verbose: 1 } } });
  let t = 0;
  for (const r of [0, 0, 0, 0.99]) { roll = r; c.fire('room.new', t); t += pre + 5000; c.view(t); }
  const lines = log.filter(r => r.type === 'say').map(r => r.beats[0]);
  assert.equal(lines.length, 4);
  assert.notEqual(lines[3], lines[2]);
});

test('lines about the act and the progress outlive a room change; lines about the room and the win do not', () => {
  const { c, said } = crow();
  c.fire('refuse.wall', 0);
  c.view(pre);
  for (const key of ['room.actFirst', 'progress.halfAct', 'win.cameBack', 'room.teach']) c.fire(key, pre + 1, { act: 1, room: 'L0' });
  c.arrive(pre + 2);
  c.view(60000);
  assert.deepEqual(said(), ['refuse.wall', 'room.actFirst', 'progress.halfAct']);
});

test('a progress line does not go stale while it waits; a win line does', () => {
  const { c, said } = crow({ tuning: { ...TUNING, momentMs: 0 } });
  c.fire('meet.bag', 0);
  c.view(pre);
  c.fire('win.cameBack', pre + 1, { room: 'L0' });
  c.fire('progress.halfAct', pre + 1, { room: 'L0' });
  c.view(60000);
  assert.deepEqual(said(), ['meet.bag', 'progress.halfAct']);
});

test('a progress line outranks the win lines', () => {
  const { c, said } = crow();
  c.fire('win.cameBack', 0, { room: 'L0' });
  c.fire('progress.halfAct', 0, { room: 'L0' });
  c.view(pre);
  assert.deepEqual(said(), ['progress.halfAct']);
});

test('a common event that has played before speaks again only by chance', () => {
  let roll = 0;
  const { c, said } = crow({ rng: () => roll, tuning: { ...TUNING, eventGapMs: 0 } });
  c.fire('room.new', 0); c.view(10000);
  roll = 0.99;
  c.fire('room.new', 10000); c.view(20000);
  assert.deepEqual(said(), ['room.new']);
  roll = 0;
  c.fire('room.new', 20000); c.view(30000);
  assert.deepEqual(said(), ['room.new', 'room.new']);
});

test('a common event has a timer of its own', () => {
  const { c, said } = crow();
  c.fire('room.new', 0); c.view(10000);
  c.fire('room.new', 10000); c.view(20000);
  assert.deepEqual(said(), ['room.new']);
  c.fire('room.new', TUNING.eventGapMs + 10); c.view(TUNING.eventGapMs + 10000);
  assert.deepEqual(said(), ['room.new', 'room.new']);
});

test('a lost-board line has a timer of its own, but no dice', () => {
  const { c, said } = crow();
  c.fire('lost', 0, { count: 1, n: 1 }); c.view(10000);
  c.fire('lost', 10000, { count: 2, n: 2 }); c.view(20000);
  assert.deepEqual(said(), ['lost']);
  c.fire('lost', TUNING.eventGapMs + 10, { count: 3, n: 3 }); c.view(TUNING.eventGapMs + 10000);
  assert.deepEqual(said(), ['lost', 'lost']);
});

test('a callback waits for the line it calls back to', () => {
  const { c, said } = crow();
  c.fire('room.hasCouch', 0); c.view(5000);
  c.fire('meet.couch', 5000); c.view(10000);
  c.fire('room.hasCouch', 10000); c.view(15000);
  assert.deepEqual(said(), ['meet.couch', 'room.hasCouch']);
});

test('once a room is once for each room; once ever is once', () => {
  const { c, said } = crow();
  c.fire('room.teach', 0, { room: 'L1' }); c.view(20000);
  c.fire('room.teach', 20000, { room: 'L1' }); c.view(40000);
  c.fire('room.teach', 40000, { room: 'L2' }); c.view(60000);
  c.fire('meet.bag', 60000); c.view(70000);
  c.fire('meet.bag', 70000); c.view(80000);
  assert.deepEqual(said(), ['room.teach', 'room.teach', 'meet.bag']);
});

test('what he remembers outlives the sitting', () => {
  const memory = createCrowMemory(store());
  const a = crow({ memory });
  a.c.fire('meet.bag', 0); a.c.view(5000);
  const b = crow({ memory: createCrowMemory({ getItem: () => JSON.stringify(memory.data), setItem() {} }) });
  b.c.fire('meet.bag', 0); b.c.view(5000);
  assert.deepEqual(b.said(), []);
});

test('an event his talk setting does not hear still shows its face, on its own timer', () => {
  const { c, said, log } = crow();
  c.fire('undo.fine', 0);
  assert.equal(c.view(pre).face, 'squint');
  assert.equal(c.view(pre).talking, false);
  assert.equal(c.view(pre + TUNING.faceMs).face, 'closed');
  assert.deepEqual(said(), []);
  assert.ok(log.some(r => r.type === 'face'));
  c.fire('undo.fine', 5000);
  assert.equal(c.view(5000 + pre).face, 'closed');
  assert.ok(log.some(r => r.type === 'drop' && r.key === 'undo.fine' && r.why === 'gap'));
});

test('an act start is said in its act\'s own words, when it has some', () => {
  const { c, log } = crow();
  c.fire('room.actFirst', 0, { act: 2, room: 'L20' }); c.view(5000);
  c.fire('room.actFirst', 5000, { act: 3, room: 'L40' }); c.view(10000);
  assert.deepEqual(log.filter(r => r.type === 'say').map(r => r.beats[0]), ['Act two.', 'Act.']);
});

test('a counted event picks its step, and fills in the count', () => {
  const { c, log } = crow();
  c.fire('lost', 0, { count: 3, n: 3 }); c.view(5000);
  const say = log.find(r => r.type === 'say');
  assert.equal(say.face, 'blink');
  assert.deepEqual(say.beats, ['Third 3.']);
});

test('a line that names a count fails loudly when it was fired without one', () => {
  const { c } = crow();
  c.fire('lost', 0, { count: 3 });
  assert.throws(() => c.view(5000), /without its \{n\}/);
});

test('a line fills any slot it names from what the event was fired with', () => {
  const { c, log } = crow();
  c.fire('tear.oneLeft', 0, { left: 'a can' }); c.view(5000);
  assert.deepEqual(log.find(r => r.type === 'say').beats, ['Last one: a can.']);
  const { c: c2 } = crow();
  c2.fire('tear.oneLeft', 0, { left: null });
  assert.throws(() => c2.view(5000), /without its \{left\}/);
});

test('a waiting line that counts the full ones is over when the count changes, and not before', () => {
  for (const [now, said] of [['a can', ['refuse.edge', 'tear.oneLeft']], ['a bag', ['refuse.edge']], [null, ['refuse.edge']]]) {
    const { c, log, said: heard } = crow();
    c.fire('refuse.edge', 0); c.view(pre);
    c.fire('tear.oneLeft', pre + 10, { left: 'a can' });
    c.recount(pre + 20, now);
    c.view(30000);
    assert.deepEqual(heard(), said, `recount to ${now}`);
    assert.equal(log.some(r => r.type === 'drop' && r.why === 'recount'), said.length === 1);
  }
});

test('skips make him quieter a setting at a time, and he says so; a press that only speeds a line up is no skip', () => {
  const tuning = { ...TUNING, talkStart: 'verbose', eventGapMs: 0, repeatChance: { quiet: 1, chatty: 1, verbose: 1 } };
  const { c, said } = crow({ tuning });
  let t = 0;
  const line = skip => {
    c.fire('refuse.wall', t);
    t += pre + 10; c.view(t);
    c.press(t); if (skip) c.press(t + 1);
    t += 20000; c.view(t);
  };
  for (let k = 0; k < 8; k++) line(false);
  assert.equal(c.talk(), 'verbose');
  for (let k = 0; k < 5; k++) line(true);
  assert.equal(c.talk(), 'chatty');
  assert.equal(said().filter(k => k === 'progress.quieter').length, 1);
  for (let k = 0; k < 4; k++) line(true);
  assert.equal(c.talk(), 'quiet');
  assert.equal(said().filter(k => k === 'progress.quieter').length, 2);
});

test('an unknown event and time running backwards both fail loudly', () => {
  const { c } = crow();
  assert.throws(() => c.fire('nope', 0), /no event/);
  c.view(100);
  assert.throws(() => c.view(50), /time went back/);
});

test('peek shows the line on screen, its timer and what waits, and moves nothing', () => {
  const { c, log } = crow();
  c.fire('refuse.wall', 0);
  assert.deepEqual(c.peek().wants.map(w => w.key), ['refuse.wall']);
  assert.equal(c.peek().dueAt, pre);
  c.view(pre + 50);
  const n = log.length, p = c.peek();
  assert.equal(p.now, pre + 50);
  assert.equal(p.line.key, 'refuse.wall');
  assert.equal(p.line.tier, 'common');
  assert.equal(p.line.typed, Math.floor(50 / 1000 * TUNING.cps));
  assert.equal(p.line.said, 1);
  assert.deepEqual([p.line.bagLeft, p.line.bagSize], [0, 1]);
  assert.equal(p.line.lineLeft, beat('Wall.') - 50);
  assert.deepEqual(p.gaps, [['refuse.wall', pre + TUNING.eventGapMs]]);
  assert.deepEqual(p.wants, []);
  assert.equal(log.length, n);
});

test('peek names the event behind a face with no words', () => {
  const { c } = crow();
  c.fire('undo.fine', 0);
  c.view(pre);
  assert.deepEqual(c.peek().face, { key: 'undo.fine', face: 'squint', until: pre + TUNING.faceMs });
});

test('the wall cues him: a line fired before it starts at the cue, not after the usual pause', () => {
  const { c } = crow();
  c.fire('meet.bag', 0);
  c.cue(100);
  assert.equal(c.view(100).talking, true);
  const quiet = crow();
  quiet.c.cue(100);
  assert.equal(quiet.c.view(100).talking, false, 'with nothing fired, a cue starts nothing');
});

test('between the beats of a line he pauses less than at its end; a speech keeps its own pace', () => {
  const T = TUNING, beats = ['Look.', 'Go.'];
  const read = (s, per) => Math.max(s.length / T.cps * 1000, per * s.length);
  assert.equal(beatMs(beats, 0, false), read('Look.', T.readPerCharMs) + T.beatGapMs);
  assert.equal(beatMs(beats, 1, false), read('Go.', T.readPerCharMs) + T.holdMs);
  assert.equal(beatMs(beats, 0, true), read('Look.', T.speechPerCharMs) + T.holdMs);
  assert.equal(lineMs(beats, false), beatMs(beats, 0, false) + beatMs(beats, 1, false));
  assert.equal(lineMs('Go.', false), beatMs(['Go.'], 0, false));
});
