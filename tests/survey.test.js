import { test } from 'node:test';
import assert from 'node:assert/strict';
import { analyze, TooManyStates } from '../src/solver.js';
import { toState } from '../src/format.js';
import { groups, place, staticallyDead } from '../tools/survey.mjs';
import { mulberry32 } from '../src/rng.js';

const S = grid => toState({ id: 't', grid });

// --- the state bound ---------------------------------------------------------
// A survey samples boards it knows nothing about, and a mixed group on an open board can
// exhaust the heap. The bound is what makes that a result instead of a crash.

test('a bound below the true graph size throws rather than reporting a short par', () => {
  const s = S(['------', '--$---', '--@---', 'E-----']);
  const full = analyze(s);
  assert.ok(full.reachable > 10, 'the fixture needs a graph worth bounding');
  assert.throws(() => analyze(s, { maxStates: 5 }), TooManyStates);
});

test('a bound above the true graph size changes nothing', () => {
  const s = S(['------', '--$---', '--@---', 'E-----']);
  const full = analyze(s);
  const bounded = analyze(s, { maxStates: full.reachable + 1 });
  assert.equal(bounded.minMoves, full.minMoves);
  assert.equal(bounded.reachable, full.reachable);
  assert.equal(bounded.traps.length, full.traps.length);
});

// --- the alphabet ------------------------------------------------------------

test('every surveyed group can actually be cleared and lands in the target bag band', () => {
  const BAGS = { $: 1, C: 1, W: 1, S: 2, B: 1 };
  const all = groups();
  assert.ok(all.length > 0);
  for (const g of all) {
    const bags = [...g].reduce((n, c) => n + (BAGS[c] ?? 0), 0);
    assert.ok(bags >= 2 && bags <= 4, `${g} carries ${bags} bags`);
    assert.equal(g.length, 4, `${g} is not a group of four`);
    assert.ok([...g].filter(c => c === 'P').length <= 3, `${g} wants more carts than CART_POOL has`);
    assert.ok([...g].filter(c => c === 'F').length <= 6, `${g} wants more couches than FURN_POOL has`);
  }
});

// Emptied, a recycle bin slides one and sheds nothing — which is the empty can's whole
// behaviour. Sampling both would rank one piece twice under two names.
test('the empty bin is not a starting piece: it is what a full one becomes', () => {
  assert.ok(!groups().some(g => g.includes('b')));
  assert.ok(groups().some(g => g.includes('B')), 'the full bin is drawn');
});

test('groups are multisets, listed once each', () => {
  const all = groups();
  assert.equal(new Set(all).size, all.length);
  for (const g of all) assert.deepEqual([...g], [...g].sort(cmpAlphabet), `${g} is not canonical`);
});
const ORDER = [...'$CcxSWwBjFP'];
const cmpAlphabet = (a, b) => ORDER.indexOf(a) - ORDER.indexOf(b);

// --- the pre-filter ----------------------------------------------------------
// It exists only to skip work, so the property that matters is that it never skips a room
// that could have been played. A false reject is a room silently lost from the survey.

test('the pre-filter never discards a board that can be won', () => {
  const rnd = mulberry32(7);
  let rejected = 0, checked = 0;
  for (const g of ['$$cc', '$Ccx', '$$cw', '$$cP']) {
    for (let i = 0; i < 120; i++) {
      const room = place(g, rnd);
      if (!room) continue;
      let s;
      try { s = toState(room); } catch { continue; }
      if (!staticallyDead(s)) continue;
      // Bounded, at the cap the survey itself uses. A loaded cart shuffles a cell at a time
      // rather than rolling to the wall, so a cart on an open board can out-grow the heap — and
      // a board too big to enumerate proves nothing either way, so it is not a sample at all.
      let shortest;
      try { shortest = analyze(s, { maxStates: 50_000 }).minMoves; }
      catch (e) { if (e instanceof TooManyStates) continue; throw e; }
      rejected++;
      checked++;
      assert.equal(shortest, null,
        `pre-filter rejected a solvable board:\n${room.grid.join('\n')}`);
    }
  }
  assert.ok(rejected > 0, 'the sample needs some rejections for this to mean anything');
});

test('a bag boxed against a corner has no fan and is caught statically', () => {
  // Every direction's fan runs off the grid or into the exit, so it can never be burst.
  assert.equal(staticallyDead(S(['$#', '@#', 'E#'])), true);
});

test('a board whose bags are all still inside containers is not pre-judged', () => {
  // No loose bag to measure a fan against; whether the can can be opened is the solver's call.
  assert.equal(staticallyDead(S(['-----', '--C--', '--@--', 'E----'])), false);
});

// --- placement ---------------------------------------------------------------

test('a placed board carries exactly the pieces its group named', () => {
  const rnd = mulberry32(3);
  for (const g of ['$$cc', '$CWj', '$$cP', '$$cF']) {
    const room = place(g, rnd);
    assert.ok(room, `${g} should be drawable on an open board`);
    const flat = room.grid.join('');
    assert.equal((flat.match(/@/g) ?? []).length, 1, `${g}: one raccoon`);
    assert.equal((flat.match(/E/g) ?? []).length, 1, `${g}: one exit`);
    // A domino covers two cells; a point covers one.
    for (const ch of new Set(g)) {
      const want = [...g].filter(c => c === ch).length * (ch === 'F' || ch === 'P' ? 2 : 1);
      const mask = ch === 'P' ? room.cart.join('') : flat;
      const pool = ch === 'P' ? 'PQR' : ch === 'F' ? 'FGHKMN' : ch;
      const got = [...mask].filter(c => pool.includes(c)).length;
      assert.equal(got, want, `${g}: ${ch} should cover ${want} cells`);
    }
    assert.ok(toState(room), `${g} should read back as a legal board`);
  }
});

test('a cart group gets a cart mask and a cartless one does not', () => {
  const rnd = mulberry32(11);
  assert.ok(place('$$cP', rnd).cart, 'a cart needs its own mask');
  assert.equal(place('$$cc', rnd).cart, undefined, 'no cart, no mask');
});
