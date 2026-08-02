// Each new piece, checked against the row it has in the levels.md item table.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { explain, bagsLeft } from '../spike/rules.mjs';
import { toState, toGrid } from '../spike/format.mjs';

const S = grid => toState({ id: 't', grid });
const after = (grid, dir) => {
  const r = explain(S(grid), dir);
  assert.ok(r.ok, `expected a legal action, got refused (${r.reason})`);
  return toGrid(r.next);
};
const refused = (grid, dir) => {
  const r = explain(S(grid), dir);
  assert.ok(!r.ok, 'expected a refusal');
  return r.reason;
};

test('recycle bin slides one and drops one cell of trash directly ahead', () => {
  assert.deepEqual(after(['-----', '-----', '--b--', '--@--', 'E----'], 'u'),
                          ['--x--', '--b--', '--@--', '-----', 'E----']);
});

test('recycle bin is refused when its trash would land on the exit', () => {
  assert.equal(refused(['--E--', '-----', '--b--', '--@--', '-----'], 'u'), 'exit');
});

test('bag-on-can stack launches the bag two and slides the can one, still full', () => {
  assert.deepEqual(after(['-----', '-----', '--S--', '--@--', 'E----'], 'u'),
                          ['--$--', '--C--', '--@--', '-----', 'E----']);
});

test('a stack is worth two bags — the loose one and the one still in the can', () => {
  assert.equal(bagsLeft(S(['--S--', '--@--', 'E----'])), 2);
  assert.equal(bagsLeft(S(['--$--', '--C--', '--@--', 'E----'])), 2);
});

test('wheelie bin rolls until stopped, dumps out the back, raccoon stays put', () => {
  assert.deepEqual(after(['-----', '-----', '-----', '--W--', 'E-@--'], 'u'),
                          ['--w--', '--$--', '-----', '-----', 'E-@--']);
});

test('a one-cell roll drops the bag on the cell the bin just vacated', () => {
  assert.deepEqual(after(['--#--', '-----', '--W--', '--@--', 'E----'], 'u'),
                          ['--#--', '--w--', '--$--', '--@--', 'E----']);
});

test('an emptied wheelie bin still rolls', () => {
  assert.deepEqual(after(['-----', '-----', '--w--', '--@--', 'E----'], 'u'),
                          ['--w--', '-----', '-----', '--@--', 'E----']);
});

test('a wheelie bin with nowhere to roll is refused', () => {
  assert.equal(refused(['--#--', '--W--', '--@--', 'E----'], 'u'), 'canRoom');
});

test('a rolling bin stops short of the exit rather than occupying it', () => {
  assert.deepEqual(after(['--E--', '-----', '--w--', '--@--', '-----'], 'u'),
                          ['--E--', '--w--', '-----', '--@--', '-----']);
});

test('the raccoon will not step into open water', () => {
  assert.equal(refused(['-----', '--~--', '--@--', 'E----'], 'u'), 'water');
});

test('a fan fires into water and fills it — trash on water is a bridge', () => {
  assert.deepEqual(after(['-----', '~~~~~', '--$--', '--@--', 'E----'], 'u'),
                          ['-----', '~===~', '-x@x-', '-----', 'E----']);
});

test('a bridge is walkable, and stays walkable', () => {
  assert.deepEqual(after(['-----', '~===~', '-x@x-', '-----', 'E----'], 'u'),
                          ['-----', '~=*=~', '-x-x-', '-----', 'E----']);
});

test('water takes trash and nothing else — a can shoved at it is refused', () => {
  assert.equal(refused(['-----', '--~--', '--c--', '--@--', 'E----'], 'u'), 'water');
});

test('a full can may not eject its bag into the water, even with dry ground to slide to', () => {
  assert.equal(refused(['--~--', '-----', '--C--', '--@--', 'E----'], 'u'), 'water');
});

test('the recycle bin bridges one cell — one spent for one gained', () => {
  assert.deepEqual(after(['--~--', '-----', '--b--', '--@--', 'E----'], 'u'),
                          ['--=--', '--b--', '--@--', '-----', 'E----']);
});

// The corollary of that push, and it rules out a whole class of room: the bin lands on
// the ONLY cell that approaches the bridge it just made, because a water cell's only dry
// neighbours are the two banks. So the recycle bin can never bridge a canal for the
// raccoon — only a bag can, since he ends a tear on the bag's cell, behind the fan.
test('the bin parks itself on the far side of the bridge it just built', () => {
  const r = explain(S(['--~--', '-----', '--b--', '--@--', 'E----']), 'u');
  assert.ok(r.ok);
  assert.equal(explain(r.next, 'u').reason, 'canRoom');   // the bin is in the way now
});

test('a wheelie bin will not roll into the canal', () => {
  assert.deepEqual(after(['--~--', '-----', '--w--', '--@--', 'E----'], 'u'),
                          ['--~--', '--w--', '-----', '--@--', 'E----']);
});

// The water jug: the recycle bin's mirror. Same two-cell shove, but what lands two ahead
// is terrain rather than an occupant — a hole instead of a wall. It never runs dry, for the
// same reason the bin never does: the interesting question is where you put the obstacle.
test('water jug slides one and spills a cell of water directly ahead', () => {
  assert.deepEqual(after(['-----', '-----', '--j--', '--@--', 'E----'], 'u'),
                          ['--~--', '--j--', '--@--', '-----', 'E----']);
});

// The jug's adjacency tax, and it is total: whichever way you shove it, the cell it must
// slide into next is the water it just poured. It can never be shoved twice running in the
// same direction — the piece walls off its own line of travel.
test('a jug shoved twice the same way pours into its own path and is refused', () => {
  const once = after(['-----', '-----', '-----', '--j--', '--@--', 'E----'], 'u');
  assert.deepEqual(once, ['-----', '--~--', '--j--', '--@--', '-----', 'E----']);
  assert.equal(refused(once, 'u'), 'water');
});

// It never runs dry, for the same reason the recycle bin never does: the question the
// piece asks is where you put the obstacle, not how many you have left.
test('the jug never runs dry — walk round and it spills again', () => {
  const once = after(['-----', '-----', '-----', '--j--', '--@--', 'E----'], 'u');
  assert.deepEqual(after(after(after(once, 'l'), 'u'), 'r'),
    ['-----', '--~--', '--@j~', '-----', '-----', 'E----']);
});

test('the jug is refused when its water would land on the exit', () => {
  assert.equal(refused(['--E--', '-----', '--j--', '--@--', '-----'], 'u'), 'exit');
});

// Water is the only thing that goes onto DRY ground and makes it worse, so it is held to
// the strict test rather than trash's loose one: it needs bare floor.
test('the jug will not pour into water it has already spilled', () => {
  assert.equal(refused(['--~--', '-----', '--j--', '--@--', 'E----'], 'u'), 'water');
});

test('the jug will not pour onto spilled trash — nothing in this game un-blocks a cell', () => {
  assert.equal(refused(['--x--', '-----', '--j--', '--@--', 'E----'], 'u'), 'canRoom');
});

test('the jug itself needs dry ground — it will not be shoved into the canal', () => {
  assert.equal(refused(['-----', '--~--', '--j--', '--@--', 'E----'], 'u'), 'water');
});

// The piece's whole point: the jug's obstacle is the only one in the game you can take
// back, because trash — which blocks everywhere else — is what makes water walkable.
test('a fan bridges water the jug poured, and the raccoon walks over it', () => {
  const bridged = after(['-----', '-~---', '-$---', '-@---', 'E----'], 'u');
  assert.deepEqual(bridged, ['-----', 'x=x--', 'x@x--', '-----', 'E----']);
  assert.deepEqual(after(bridged, 'u'), ['-----', 'x*x--', 'x-x--', '-----', 'E----']);
});

// Furniture: the first piece that spans cells. A rigid polyomino, translate-only, and the
// clearance test covers only the ground it moves INTO — not the ground it moves out of.
test('a couch shoves as one unit and the raccoon takes the cell he pushed', () => {
  assert.deepEqual(after(['-----', '-FF--', '-@---', 'E----'], 'u'),
                          ['-FF--', '-@---', '-----', 'E----']);
});

// A three-long couch shoved along its own length asks for ONE new cell, not three — the two
// it is stepping out of are its own. That is the difference between clearing the translated
// footprint and clearing the leading edge, and it is what makes long pieces manoeuvrable.
test('a couch may slide along its own length — vacated cells are not blockers', () => {
  assert.deepEqual(after(['-----', '--F--', '--F--', '--F--', '--@--', 'E----'], 'u'),
                          ['--F--', '--F--', '--F--', '--@--', '-----', 'E----']);
});

test('one blocked cell of the leading edge refuses the whole shove', () => {
  assert.equal(refused(['-#---', '-FF--', '-@---', 'E----'], 'u'), 'canRoom');
});

test('a couch will not be shoved onto the exit, or into water', () => {
  assert.equal(refused(['-E---', '-FF--', '-@---', '-----'], 'u'), 'exit');
  assert.equal(refused(['-~---', '-FF--', '-@---', 'E----'], 'u'), 'water');
});

// The two-couch problem, and the reason the glyphs are a pool rather than one letter.
test('two letters flush together are two couches, and shove independently', () => {
  const g = ['-----', '-FFGG', '-@---', 'E----'];
  assert.deepEqual(after(g, 'u'), ['-FF--', '-@-GG', '-----', 'E----']);
});

test('the same letter, touching, is one couch and shoves whole', () => {
  const g = ['-----', '-FFFF', '-@---', 'E----'];
  assert.deepEqual(after(g, 'u'), ['-FFFF', '-@---', '-----', 'E----']);
});

test('the same letter used twice, not touching, is two couches', () => {
  // Written with one letter; the writer hands out canonical letters, so it comes back F and G.
  assert.deepEqual(toGrid(S(['FF-FF', '--@--', 'E----'])), ['FF-GG', '--@--', 'E----']);
});

test('a one-cell couch is refused — that piece already exists, and it is the can', () => {
  assert.throws(() => S(['-F---', '-@---', 'E----']), /single cell/);
});

test('furniture blocks a fan, like anything else standing in one', () => {
  assert.equal(refused(['-----', 'FF---', '-$---', '-@---', 'E----'], 'u'), 'fan');
});

test('glyphs round-trip through the serialiser', () => {
  const g = ['Sb---', '-Wwj-', '--@--', 'E-~=-', 'FFGG-'];
  assert.deepEqual(toGrid(S(g)), g);
});
