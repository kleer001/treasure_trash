// The play session: undo, arming, room navigation, and the events the view animates from.
// None of this needs a browser — which is the point of keeping the session pure.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSession } from '../src/session.js';
import { BAG, NONE } from '../src/rules.mjs';

const room = (grid, extra = {}) => ({ id: 'T', name: 'test', par: 0, grid, ...extra });

// A bag with clear ground all round it, the raccoon under it, the way out bottom-left.
const BAG_ROOM = ['-----', '--$--', '--@--', 'E----'];

test('createSession refuses an empty pack at the boundary', () => {
  assert.throws(() => createSession([]), /non-empty/);
});

test('a refusal costs no move and names the cell to blame', () => {
  const s = createSession([room(['#@-E'])]);
  const event = s.act('l');
  assert.equal(event.type, 'refused');
  assert.equal(event.reason, 'wall');
  assert.deepEqual(event.blame, [[0, 0]]);
  assert.equal(s.moves, 0);
  assert.equal(s.state.rac.x, 1);
  assert.deepEqual(s.blocked, { cells: [[0, 0]], reason: 'wall', dir: 'l' });
});

test('an accepted action reports where it came from, so the view can animate it', () => {
  const s = createSession([room(BAG_ROOM)]);
  const event = s.act('u');
  assert.equal(event.type, 'acted');
  assert.equal(event.kind, 'tear');
  assert.equal(event.from.rac.y, 2, 'the event carries the board as it was');
  assert.equal(s.state.rac.y, 1, 'the session already holds the board as it is');
});

test('undo rewinds one action and reports when there is nothing left', () => {
  const s = createSession([room(['-@-E'])]);
  s.act('l');
  assert.equal(s.moves, 1);
  assert.equal(s.undo(), true);
  assert.equal(s.moves, 0);
  assert.equal(s.state.rac.x, 1);
  assert.equal(s.undo(), false);
});

test('arming makes a tear ask twice; walking is never armed', () => {
  const s = createSession([room(BAG_ROOM, { arm: true })]);
  assert.equal(s.act('u').type, 'armed');
  assert.equal(s.moves, 0, 'aiming is not a move');
  assert.equal(s.armed, 'u');
  assert.equal(s.armedTarget, BAG);
  assert.equal(s.act('u').type, 'acted');
  assert.equal(s.moves, 1);
  assert.equal(s.armed, null);

  s.restart();
  assert.equal(s.act('l').type, 'acted', 'a plain step commits on the first press');
});

test('aiming somewhere else re-aims rather than firing', () => {
  const s = createSession([room(BAG_ROOM, { arm: true })]);
  s.act('u');
  assert.equal(s.act('l').type, 'acted', 'walking away drops the aim');
  assert.equal(s.armed, null);
});

test('the fan preview is per-room data, not a global', () => {
  const s = createSession([
    room(BAG_ROOM, { id: 'teaching', preview: true }),
    room(BAG_ROOM, { id: 'plain' }),
  ]);
  assert.equal(s.preview, true);
  s.next();
  assert.equal(s.preview, false, 'absent means off — the scaffold comes off by default');
});

test('a refusal clears an aim', () => {
  const s = createSession([room(['-----', '--$--', '#-@--', 'E----'], { arm: true })]);
  s.act('u');
  assert.equal(s.armed, 'u');
  s.act('l');                                   // into the wall
  assert.equal(s.armed, null);
  assert.equal(s.armedTarget, NONE);
});

test('winning is standing on the exit with every bag torn', () => {
  const s = createSession([room(['E@-'])]);
  assert.equal(s.act('l').won, true);
  assert.equal(s.won, true);
});

test('rooms wrap in both directions', () => {
  const s = createSession([room(['-@-E'], { id: 'A' }), room(['-@-E'], { id: 'B' })]);
  assert.equal(s.index, 0);
  s.prev();
  assert.equal(s.level.id, 'B', 'Prev on the first room lands on the last');
  s.next();
  assert.equal(s.level.id, 'A');
});

test('loading a room drops the undo stack, the count and the refusal', () => {
  const s = createSession([room(['#@-E'])]);
  s.act('l'); s.act('r');
  s.restart();
  assert.equal(s.moves, 0);
  assert.equal(s.blocked, null);
  assert.equal(s.canUndo, false);
});
