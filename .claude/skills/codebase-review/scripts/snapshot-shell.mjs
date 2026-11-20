// Dumps the drawing and timing outputs of the shell (sprites, press, door, stills, timeline,
// wipe panel), for a before/after diff.
// Usage: ROOT=<tree with src/> node snapshot-shell.mjs <out.json>
import { writeFileSync, readFileSync } from 'node:fs';
const ROOT = process.env.ROOT, OUT = process.argv[2];
const u = p => import(`${ROOT}/${p}`);
const { DIRS, explain } = await u('src/rules.js');
const { toState } = await u('src/format.js');
const { createSprites, exitArrowDir } = await u('src/sprites.js');
const { press, VIEW } = await u('src/art/press.js');
const { ACTIONS } = await u('src/art/cartoon.js');
const { tearPress } = await u('src/art/bagRip.js');
const { door } = await u('src/art/door.js');
const { N4 } = await u('src/art/spread.js');
const { createStills, lyingOf } = await u('src/art/stills.js');
const { timeline, CELL_MS } = await u('src/stage.js');
const { createWipeTune } = await u('src/wipeTune.js');
const J = JSON.parse(readFileSync(`${ROOT}/src/art/jug.json`, 'utf8'));
const out = {};
const safe = (k, f) => { try { out[k] = f(); } catch (e) { out[k] = `ERR ${e.message}`; } };
const DIR_NAMES = ['u', 'd', 'l', 'r'];

// A recording canvas context: every call and assignment is logged, and calls return recorders.
const made = new WeakSet();
const enc = v => (made.has(v) ? 'REC' : (v && typeof v === 'object' ? JSON.stringify(v) : String(v)));
function recorder(log) {
  const state = new Map();
  const p = new Proxy(function () {}, {
    get(_, k) {
      if (k === Symbol.toPrimitive || k === 'toJSON' || k === 'then') return undefined;
      if (state.has(k)) return state.get(k);
      return (...args) => { log.push(['call', String(k), args.map(enc)]); return recorder(log); };
    },
    set(_, k, v) { log.push(['set', String(k), enc(v)]); state.set(k, v); return true; },
  });
  made.add(p);
  return p;
}
const drawLog = f => { const log = []; try { f(recorder(log)); } catch (e) { log.push(['ERR', e.message]); } return log; };

// Sprites: each method, once per direction where it takes one.
safe('exitArrowDir', () => { const r = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) r.push(exitArrowDir(6, 4, x, y)); return r; });
const SPRITE_CALLS = [
  ['floor', [1, 1]], ['water', [1, 1, true, 3, 0]], ['water', [1, 1, false, 3, 2]], ['grease', [1, 1]], ['tar', [1, 1]],
  ['glass', [1, 1]], ['covered', [1, 1]], ['grate', [1, 1]], ['sponge', [1, 1]], ['cardboard', [1, 1]], ['pane', [1, 1]],
  ['tyre', [1, 1, true]], ['tyre', [1, 1, false]], ['chair', [1, 1]], ['broom', [1, 1]], ['hold', [1, 1, 2, 1]], ['grip', [1, 1]],
  ['trash', [1, 1, { seed: 4, k: 1, wet: 0 }]], ['bag', [1, 1, 1]], ['can', [1, 1, true]], ['can', [1, 1, false]],
  ['recycleBin', [1, 1, true]], ['jug', [1, 1, true]], ['wheelie', [1, 1, false]], ['splash', [1, 1]], ['raccoon', [1, 1]],
  ['bicycle', [[[0, 0], [1, 0]], 0, 0]], ['rug', [[[0, 0], [1, 0], [0, 1]], 0, 0]], ['skateboard', [[[0, 0], [1, 0]], 0, 0]],
  ['furniture', [[[0, 0], [1, 0]], 0, 0, {}]],
];
for (const d of DIR_NAMES) {
  SPRITE_CALLS.push(['oneway', [1, 1, d]], ['cabinet', [1, 1, d, true]], ['cabinet', [1, 1, d, false]],
    ['drawer', [1, 1, d]], ['barrow', [1, 1, d]], ['magnet', [1, 1, d]], ['exit', [1, 1, true, DIRS[d]]], ['exit', [1, 1, false, DIRS[d]]]);
}
SPRITE_CALLS.push(['drawer', [1, 1, null]], ['exit', [1, 1, true]]);
for (const [name, args] of SPRITE_CALLS) {
  out[`sprite.${name}(${JSON.stringify(args)})#${Object.keys(out).length}`] = drawLog(ctx => createSprites({ ctx, cell: 24 })[name](...args));
}

// Press and tear drawings for each direction and action.
const acts = [...new Set(Object.values(ACTIONS).flatMap(v => Object.keys(v)))];
for (const d of DIR_NAMES) {
  for (const a of acts) safe(`press.${a}.${d}`, () => press(a, d));
  safe(`press.${d}.nolead`, () => press(acts[0], d, { lead: false }));
  safe(`tearPress.${d}`, () => tearPress(d));
}
out.VIEW = VIEW;

// Door frames.
for (const open of [0, 0.25, 0.5, 1]) for (let f = 0; f <= 80; f += 7) safe(`door.${open}.${f}`, () => door(open, f));

// Lying things and their falls.
const still = createStills({ J });
for (const o of Object.keys(lyingOf(J))) {
  safe(`still.${o}.up`, () => still(Number(o), 2, 3));
  for (const d of DIR_NAMES) safe(`still.${o}.${d}`, () => still(Number(o), 2, 3, 1, d));
}

// Timing and direction constants.
out.CELL_MS = CELL_MS;
out.DIRS = DIRS;
out.N4 = N4;
const POUR = toState({ id: 'pour', grid: ['#########', '#@j-----#', '#-------#', '#E#######'] });
const BAGROOM = toState({ id: 'bag', grid: ['#########', '#@B--C--#', '#-------#', '#E#######'] });
for (const [label, st] of [['pour', POUR], ['bag', BAGROOM]]) for (const d of DIR_NAMES) {
  safe(`timeline.${label}.${d}`, () => timeline(explain(st, d, { trace: true }), CELL_MS));
}

// The wipe panel readout, with a stub element.
const WIPE = { exit: 12, empty: 30, cover: 40, roomHold: 60, roomHoldMax: 120, reveal: 30, revealMax: 90, tail: 60, lay: 8, order: 'same', leave: 'hop', pattern: 'room', kind: 'room' };
const els = new Map();
const node = () => ({ value: '', textContent: '', className: '', dataset: {}, setAttribute() {}, blur() {} });
const el = { hidden: true, innerHTML: '', addEventListener() {}, querySelector(s) { if (!els.has(s)) els.set(s, node()); return els.get(s); }, querySelectorAll() { return []; } };
createWipeTune(el, WIPE, { replay() {}, snap() {}, send() {} });
out.wipeInnerHTML = el.innerHTML;
out.wipeSum = els.get('[data-say="sum"]').textContent;

writeFileSync(OUT, JSON.stringify(out, null, 1));
console.log(`wrote ${Object.keys(out).length} entries to ${OUT}`);
