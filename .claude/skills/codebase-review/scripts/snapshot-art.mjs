// Records what the art modules draw and compute, for a before/after diff.
// Usage: ROOT=<tree with src/, levels/> node snapshot-art.mjs <out.json>
// Each entry is a name, a sha256 of its canonical text, and its length. Set ONLY=<name prefix>
// to keep the full canonical text of matching entries under <out.json>.full.json.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const ROOT = process.env.ROOT, OUT = process.argv[2], ONLY = process.env.ONLY ?? null;
if (!ROOT || !OUT) throw new Error('usage: ROOT=<tree> node snapshot-art.mjs <out.json>');
const u = p => import(`${ROOT}/${p}`);
const artJson = f => JSON.parse(readFileSync(`${ROOT}/src/art/${f}`, 'utf8'));

const ENTRIES = [], FULL = {}, CONTENT_ERRS = [];
function canon(v) {
  if (v === undefined) return 'undef';
  if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
  if (typeof v === 'string' || typeof v === 'boolean' || v === null) return JSON.stringify(v);
  if (typeof v === 'function') return 'fn';
  if (Array.isArray(v)) return `[${v.map(canon).join(',')}]`;
  if (v instanceof Map) return `Map{${[...v].map(([k, x]) => `${canon(k)}:${canon(x)}`).join(',')}}`;
  if (v instanceof Set) return `Set[${[...v].map(canon).join(',')}]`;
  if (ArrayBuffer.isView(v)) return `TA[${Array.from(v).join(',')}]`;
  return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${canon(v[k])}`).join(',')}}`;
}
const rec = (name, v) => {
  const s = canon(v);
  if (s.includes("ERR")) CONTENT_ERRS.push(name);
  ENTRIES.push([name, createHash('sha256').update(s).digest('hex').slice(0, 20), s.length]);
  if (ONLY !== null && name.startsWith(ONLY)) FULL[name] = s;
};
const safe = (name, fn) => { let v; try { v = fn(); } catch (e) { v = { ERR: e.message }; } rec(name, v); };

// A recording canvas context: every call and assignment goes to the log `getLog()` returns.
const made = new WeakSet();
const enc = v => (made.has(v) ? 'REC' : (v && typeof v === 'object' ? canon(v) : String(v)));
function recorder(getLog) {
  const state = new Map();
  const p = new Proxy(function () {}, {
    get(_, k) {
      if (k === Symbol.toPrimitive || k === 'toJSON' || k === 'then') return undefined;
      if (state.has(k)) return state.get(k);
      return (...args) => { getLog().push(['call', String(k), args.map(enc)]); return recorder(getLog); };
    },
    set(_, k, v) { getLog().push(['set', String(k), enc(v)]); state.set(k, v); return true; },
  });
  made.add(p);
  return p;
}
let CUR = [];
const drawLog = (name, f) => { CUR = []; try { f(); } catch (e) { CUR.push(['ERR', e.message]); } rec(name, CUR); };
const ctxFor = recorder(() => CUR);

// ---- Art data, read the way pixel.js reads it.
const D = artJson('items.json'), LOOK = artJson('look.json');
const art = { A: artJson('assets.json'), D, LOOK, O: artJson('objects.json'), W: artJson('wheelie.json'), J: artJson('jug.json') };
const J = art.J;

// ---- Timing and easing.
const TM = await u('src/art/timing.js');
for (const keys of [{ tip: -3, flat: 4 }, { tip: 0, flat: 8 }, { tip: 5, flat: 7 }, { tip: 2, flat: 2 }]) {
  for (let f = -4; f <= 60; f++) safe(`timing.degAt.${keys.tip}.${keys.flat}.${f}`, () => TM.degAt(keys, f));
}
for (let i = -2; i <= 20; i++) safe(`timing.quadOut.${i}`, () => TM.quadOut(i / 10));
for (let i = -2; i <= 12; i++) safe(`timing.arc.${i}`, () => TM.arc(i / 10, 9));

// ---- Shared pixel helpers in spread.js, and the trash layouts that use them.
const SP = await u('src/art/spread.js');
for (let s = 0; s < 3; s++) for (let x = -2; x <= 4; x++) for (let y = -2; y <= 4; y++) {
  safe(`spread.hash.${s}.${x}.${y}`, () => SP.hash(s, x, y));
  safe(`spread.noise.${s}.${x}.${y}`, () => SP.noise(s, x * 3.5, y * 2.25, 6));
}
const PL = await u('src/art/pile.js');
const T = PL.createTrash(D, { accents: LOOK.accents, diagonals: LOOK.diagonals });
for (const name of Object.keys(D.items)) for (let alt = 0; alt < 3; alt++) for (let turn = 0; turn < 4; turn++)
  safe(`pile.sprite.${name}.${alt}.${turn}`, () => T.sprite(name, alt, turn));
const LAY = { min: LOOK.min, max: LOOK.max, C: 24, spill: LOOK.spill };
for (let seed = 0; seed < 24; seed++) safe(`pile.pileLayout.${seed}`, () => PL.pileLayout(T, seed, LAY));

const spill = Math.round(LOOK.spill * 100);
const SETTINGS = {
  mound: { min: LOOK.min, max: LOOK.max, spill },
  flat: { min: LOOK.min, max: LOOK.max, spill, jitter: 100 },
  edges: { ...LOOK.spread.edges },
  field: { n: Math.round((LOOK.min + LOOK.max) / 2), spill, falloff: 15, rough: 4, jitter: 100 },
};
const VARIANTS = {
  mound: [SETTINGS.mound],
  flat: [SETTINGS.flat, { ...SETTINGS.flat, spill: 0, jitter: 0 }, { ...SETTINGS.flat, spill: 140, jitter: 60 }],
  edges: [SETTINGS.edges, { ...SETTINGS.edges, knit: 0 }, { ...SETTINGS.edges, knit: 3, falloff: 0 }, { ...SETTINGS.edges, rough: 9 }],
  field: [SETTINGS.field, { ...SETTINGS.field, n: 5, spill: 0 }, { ...SETTINGS.field, n: 30, spill: 50, rough: 0 }],
};
const CELL_SETS = [[[1, 1], [2, 1], [1, 2], [4, 3]], [[0, 0], [1, 0], [2, 0], [0, 1], [5, 4]]];
for (const [si, CELLS] of CELL_SETS.entries()) {
  const isTrash = (x, y) => CELLS.some(([a, b]) => a === x && b === y);
  for (const [method, list] of Object.entries(VARIANTS)) list.forEach((o, oi) => {
    for (const seed of [0, 1, 7]) for (const hues of ['piece', 'cell']) {
      safe(`spread.${method}.set${si}.o${oi}.seed${seed}.${hues}`, () => {
        const piles = SP.spreadPiles(T, method, o, { C: 24, W: 6, H: 5, cells: CELLS, isTrash, seed, hues });
        return [...piles].map(([k, pile]) => [k, pile.cx, pile.cy, pile.pieces.map(p => [p, T.sprite(p.name, p.alt, p.turn).px])]);
      });
    }
  });
}
const POUR_NAMES = Object.keys(D.items);
const POUR_GIVEN = [0, 3, 6, 9, 12].map(i => ({ name: POUR_NAMES[i], alt: 0, turn: 0 }));
for (const [oi, o] of [LOOK.spread.edges, { ...LOOK.spread.edges, knit: 0 }, { ...LOOK.spread.edges, knit: 2, rough: 9 }].entries()) {
  for (const seed of [0, 3]) for (const [cx, cy] of [[1, 1], [2, 2]]) {
    const isTrash = (x, y) => (x + y) % 3 !== 1;
    safe(`spread.pour.o${oi}.seed${seed}.${cx}.${cy}`, () => {
      const pile = SP.pourPile(T, o, { C: 24, cell: [cx, cy], given: POUR_GIVEN.slice(0, 3 + (cx % 3)), isTrash, seed, key: `k${cx}${cy}` });
      return [pile.cx, pile.cy, pile.pieces.map(p => [p, T.sprite(p.name, p.alt, p.turn).px])];
    });
  }
}

// ---- Slicks and broken glass.
const SL = await u('src/art/slick.js');
const GL = await u('src/art/glass.js');
const has = (x, y) => ((x * 7 + y * 3) % 5) !== 0 || x === y;
for (const kind of ['grease', 'tar']) for (let cx = -1; cx <= 3; cx++) for (let cy = -1; cy <= 3; cy++) {
  for (const off of [[0, 0], [3, 1], [-7, 5]]) safe(`slick.${kind}.${cx}.${cy}.${off}`, () => SL.slickCell(cx, cy, has, SL.LOOKS[kind], off));
  safe(`slick.shape.${kind}.${cx}.${cy}`, () => {
    const on = SL.slickShape(cx, cy, has, SL.LOOKS[kind]), r = [];
    for (let y = cy * 24 - 2; y < cy * 24 + 26; y += 2) for (let x = cx * 24 - 2; x < cx * 24 + 26; x += 2) r.push(on(x, y));
    return r;
  });
}
for (let cx = -1; cx <= 3; cx++) for (let cy = -1; cy <= 3; cy++) for (const hs of [has, () => true, (x, y) => x === cx && y === cy])
  safe(`glass.cell.${cx}.${cy}`, () => GL.glassCell(cx, cy, hs, GL.GLASS_LOOK));
for (let cx = -1; cx <= 3; cx++) for (let cy = -1; cy <= 3; cy++)
  safe(`glass.shards.${cx}.${cy}`, () => GL.glassShards(cx, cy, has, GL.GLASS_LOOK));

// ---- Water, crossings and canals.
const WA = await u('src/art/water.js');
const wetFn = (x, y) => ((x + 2 * y) % 4) !== 0;
for (let cx = -1; cx <= 3; cx++) for (let cy = -1; cy <= 3; cy++) {
  safe(`water.puddle.${cx}.${cy}`, () => WA.puddle(cx, cy, 24, wetFn));
  for (const bits of [1, 4, 6]) safe(`water.crossing.${cx}.${cy}.${bits}`, () => WA.crossing(T, cx, cy, 24, wetFn, bits));
}
for (const pattern of ['dither', 'noise', 'speckle']) for (const [inside, outside, curve] of [[2, 2, 10], [0, 0, 10], [3, -1, 5], [1, 4, 20], [-2, 1, 10]]) {
  const look = { inside, outside, curve, bits: 4, outlast: 1, pattern, scale: 6 };
  const kind = (x, y) => (x < 0 || y < 0 || x >= 6 || y >= 6 ? 'dry' : ((x + y) % 3 === 0 ? 'crossing' : (x > 1 && y % 2 ? 'water' : 'dry')));
  safe(`water.canal.${pattern}.${inside}.${outside}.${curve}`, () => [...WA.canal(T, 6, 24, kind, look)]);
}
for (const hex of ['#7dafb3', '#ffffff', '#101010', '#f1eccb']) safe(`water.soaked.${hex}`, () => WA.soaked(hex));

// ---- Wet cardboard, soaked marks and sponges.
const CB = await u('src/art/cardboard.js');
const SO = await u('src/art/soaked.js');
const SPG = await u('src/art/sponge.js');
for (let seed = 0; seed < 60; seed++) safe(`cardboard.wet.${seed}`, () => CB.wetCardboard(seed));
for (let x = 0; x < 8; x++) for (let y = 0; y < 5; y++) safe(`cardboard.covered.${x}.${y}`, () => CB.wetCardboard(Math.imul(x + 1, 73856093) ^ Math.imul(y + 1, 19349663)));
const WET_VARIANTS = [{ count: 0 }, { count: 1, rmin: 1, rmax: 1 }, { count: 6, rmin: 0.5, rmax: 5 }, { soak: 0 }, { soak: 3, count: 2 }];
WET_VARIANTS.forEach((v, i) => { for (let seed = 0; seed < 8; seed++) safe(`cardboard.wet.look${i}.${seed}`, () => CB.wetCardboard(seed, { ...CB.WET_LOOK, ...v })); });
rec('cardboard.exports', { CARDBOARD: CB.CARDBOARD, ROWS: CB.CARDBOARD_ROWS, PAL: CB.CARDBOARD_PALETTE, WET_LOOK: CB.WET_LOOK });
for (const kind of Object.keys(SO.SOAKED_LOOK.cardboard)) safe(`soaked.cardboard.${kind}`, () => SO.soakedCardboard(kind));
for (const kind of Object.keys(SO.SOAKED_LOOK.sponge)) safe(`soaked.sponge.${kind}`, () => SO.soakedSponge(kind));
const SOAK_VARIANTS = [{ soak: 0 }, { soak: 3, count: 0 }, { soak: 2, rmin: 0.5, rmax: 3 }, { ooze: 4, oozeSize: 3 }, { coat: 3 }];
for (const kind of Object.keys(SO.SOAKED_LOOK.cardboard)) SOAK_VARIANTS.forEach((v, i) =>
  safe(`soaked.cardboard.${kind}.look${i}`, () => SO.soakedCardboard(kind, { ...SO.SOAKED_LOOK.cardboard[kind], ...v })));
for (const kind of Object.keys(SO.SOAKED_LOOK.sponge)) for (const size of [SPG.SPONGE_LOOK, { w: 15, h: 13, dx: 1, dy: 0 }, { w: 27, h: 25, dx: 0, dy: 2 }])
  safe(`soaked.sponge.${kind}.${size.w}`, () => SO.soakedSponge(kind, SO.SOAKED_LOOK.sponge[kind], size));
for (const size of [SPG.SPONGE_LOOK, { w: 15, h: 13, dx: 1, dy: 0 }]) safe(`sponge.rows.${size.w}`, () => SPG.spongeRows(size));
safe('sponge.sprite', () => SPG.spongeSprite(SPG.SPONGE_LOOK));
safe('sponge.SPONGE', () => SPG.SPONGE);
safe('sponge.sprite.small', () => SPG.spongeSprite({ w: 15, h: 13, dx: 1, dy: 0 }));

// ---- Furniture, vehicles and their views.
const BK = await u('src/art/bicycle.js');
for (const f of Object.keys(BK.FRAMES)) safe(`bicycle.${f}`, () => BK.bicycle(f));
safe('bicycle.default', () => BK.bicycle());
const ON = await u('src/art/oneway.js');
for (const d of Object.keys(ON.ONEWAY)) safe(`oneway.${d}`, () => ON.ONEWAY[d]);
const BA = await u('src/art/barrow.js');
for (const d of Object.keys(BA.BARROW)) safe(`barrow.${d}`, () => BA.BARROW[d]);
const MG = await u('src/art/magnet.js');
for (const d of Object.keys(MG.MAGNET)) safe(`magnet.${d}`, () => MG.MAGNET[d]);
const TY = await u('src/art/tyre.js');
for (const d of Object.keys(TY.TYRE)) safe(`tyre.${d}`, () => TY.TYRE[d]);
const SK = await u('src/art/skateboard.js');
safe('skateboard', () => SK.SKATEBOARD);
const CH = await u('src/art/chair.js');
for (let stem = 0; stem <= 4; stem++) safe(`chair.${stem}`, () => CH.chair(stem));
safe('chair.CHAIR', () => CH.CHAIR);
const BR = await u('src/art/broom.js');
safe('broom', () => BR.BROOM);
const GR = await u('src/art/grate.js');
safe('grate', () => GR.GRATE);
const CA = await u('src/art/cabinet.js');
safe('cabinet.closed', () => CA.CABINET);
safe('cabinet.open', () => CA.CABINET_OPEN);
for (const look of [CA.CABINET_LOOK, { ...CA.CABINET_LOOK, front: 30, side: 18 }, { ...CA.CABINET_LOOK, depthD: 2, depthS: 3 }]) {
  safe(`cabinet.views.${look.front}.${look.depthD}`, () => CA.cabinetViews(look));
  safe(`cabinet.sprites.${look.front}.${look.depthD}`, () => CA.cabinetSprites(look));
}
const CO = await u('src/art/couch.js');
[CO.COUCH_LOOK, { ...CO.COUCH_LOOK, light: 120 }, { ...CO.COUCH_LOOK, light: -20 }, { ...CO.COUCH_LOOK, sat: 0 }, { ...CO.COUCH_LOOK, sat: 100, hue: 200 }]
  .forEach((look, i) => safe(`couch.views.${i}`, () => CO.couchViews(look)));
safe('couch.COUCH', () => CO.COUCH);
const RG = await u('src/art/rug.js');
safe('rug.RUG', () => RG.RUG);
safe('rug.TURNS', () => RG.TURNS);

// ---- The can, the jug, the pane and the box: fall and turn frames, every degree.
const CN = await u('src/art/can.js');
const JG = await u('src/art/jug.js');
const PN = await u('src/art/pane.js');
const BX = await u('src/art/box.js');
const frameRec = (fr, w, h) => ({ s: fr.s, ox: fr.ox, oy: fr.oy,
  place: [-2, 0, 5, 12].flatMap(bx => [-2, 0, 7, 20].flatMap(by => [0, 5, 10].map(d => fr.place(bx, by, d)))),
  shows: Array.from({ length: w + 4 }, (_, i) => Array.from({ length: h + 4 }, (_, j) => fr.shows(i - 2, j - 2))).flat(),
  hides: Array.from({ length: w + 4 }, (_, i) => Array.from({ length: h + 4 }, (_, j) => fr.hides(i - 2, j - 2))).flat() });
for (const dir of ['u', 'd', 'l', 'r']) for (let deg = 0; deg <= 90; deg++) {
  safe(`can.frame.${dir}.${deg}`, () => frameRec(CN.frame(dir, deg), CN.CAN.W, CN.CAN.H + 10));
  safe(`jug.frame.${dir}.${deg}`, () => frameRec(JG.frame(dir, deg, 0.5), JG.JUG.W, JG.JUG.H + 10));
  safe(`pane.frame.${dir}.${deg}`, () => frameRec(PN.frame(dir, deg), PN.PANE.W, PN.PANE.H + 10));
  safe(`box.frame.${dir}.${deg}`, () => frameRec(BX.frame(dir, deg), BX.BOX.W, BX.BOX.H + 10));
}
for (const dir of ['u', 'd', 'l', 'r']) for (const level of [0, 0.31, 0.5, 1, 1.4, -0.2]) for (const deg of [0, 17, 45, 90])
  safe(`jug.frame.level.${dir}.${deg}.${level}`, () => frameRec(JG.frame(dir, deg, level), JG.JUG.W, JG.JUG.H + 10));
safe('jug.rest.d', () => JG.rest('d'));
safe('jug.rest.u', () => JG.rest('u'));
safe('jug.full', () => JG.full);
safe('jug.MOUTH', () => JG.MOUTH);
for (const fell of [null, 'u', 'd', 'l', 'r']) safe(`jug.restAt.${fell}`, () => JG.restAt(2, 3, 24, fell));
safe('can.rest.d', () => CN.rest('d'));
safe('can.rest.u', () => CN.rest('u'));
safe('can.front', () => CN.front);
safe('can.PROFILE', () => CN.PROFILE);
for (const r of [[6, 20, 2, 3], [8, 26, 0, 0], [5, 14, 1, 2]]) safe(`can.galvanized.${r.join('.')}`, () => CN.galvanized({ r: r[0], h: r[1], taper: r[2], flutes: r[3] }));
for (const [name, spr] of [['front', CN.front], ['profile', CN.PROFILE], ['small', CN.galvanized({ r: 5, h: 14, taper: 1, flutes: 2 })]]) {
  for (let deg = -400; deg <= 400; deg += 1) safe(`can.spun.${name}.${deg}`, () => CN.spun(spr, deg));
  for (const deg of [720, 1080, -720, 45.5, 89.9]) safe(`can.spun.${name}.${deg}`, () => CN.spun(spr, deg));
}
safe('can.bagIn', () => CN.bagIn(CN.front));
safe('can.restAt', () => CN.restAt(2, 3, 24, 'u'));
safe('can.CAN', () => CN.CAN);

// ---- Presses, tears, doors and splashes.
const PR = await u('src/art/press.js');
const CT = await u('src/art/cartoon.js');
const BG = await u('src/art/bagRip.js');
const SPL = await u('src/art/splash.js');
const DR = await u('src/art/door.js');
for (const dir of ['u', 'd', 'l', 'r']) {
  for (const act of Object.keys(CT.ACTIONS[PR.VIEW[dir]])) for (const opts of [{}, { lead: false }]) {
    const tag = `${dir}.${act}.${opts.lead}`;
    safe(`press.${tag}`, () => PR.press(act, dir, opts));
    const segs = PR.press(act, dir, opts);
    const total = segs.length ? segs[segs.length - 1].t1 : 0;
    for (let g = -2; g <= total + 2; g++) safe(`press.travelAt.${tag}.${g}`, () => PR.travelAt(segs, g));
    segs.forEach((seg, i) => safe(`press.place.${tag}.${i}`, () => PR.place(seg, dir, 3, 4)));
  }
  safe(`bagRip.tearPress.${dir}`, () => BG.tearPress(dir));
  safe(`bagRip.tearPress.${dir}.push9`, () => BG.tearPress(dir, 9));
}
for (let open = -0.2; open <= 1.2; open += 0.1) for (let f = 0; f <= 80; f += 7) safe(`door.${open.toFixed(2)}.${f}`, () => DR.door(open, f));
for (const [ki, k] of [SPL.SPLASH, { ...SPL.SPLASH, wide: 30 }, { ...SPL.SPLASH, wide: 180, ring: 0, rim: true, shadow: false }, { ...SPL.SPLASH, colour: 'MID', size: 2, drops: 5 }].entries()) {
  for (const [di, dir] of [[1, 0], [0, -1], [-0.6, 0.8]].entries()) {
    const sp = SPL.pourSplash({ at: [40, 52], dir, pour: 3, dry: 12, k });
    for (let f = 0; f <= sp.end + 2; f++) safe(`splash.k${ki}.d${di}.${f}`, () => sp.drops(f));
    safe(`splash.k${ki}.d${di}.end`, () => sp.end);
  }
}

// ---- Clips: the jug pour, the can tip, the bag tear and the pane break, every frame.
const JT = await u('src/art/jugTip.js');
const CTP = await u('src/art/canTip.js');
const PS = await u('src/art/paneShatter.js');
const GLASS = GL.GLASS_LOOK;
const JUG_KEYS = [JT.JUG_TIP, { ...JT.JUG_TIP, ease: 1.5 }, { ...JT.JUG_TIP, ease: 3 }, { ...JT.JUG_TIP, bounce: 2, glide: 40 }];
const JUG_MOVES = { u: { from: [3, 4], to: [3, 3], wetAt: [3, 2] }, d: { from: [3, 2], to: [3, 3], wetAt: [3, 4] },
  l: { from: [4, 3], to: [3, 3], wetAt: [2, 3] }, r: { from: [2, 3], to: [3, 3], wetAt: [4, 3] } };
// The baked jug has drawings only at its own angles, so the eased variants draw a stub that carries
// the angle and the water fraction in its one pixel's colour.
const STUB = (dir, deg, F) => ({ x: 0, y: 0, w: 6, h: 4, mouth: [3, 0], px: [[0, 0, `#${(deg * 4096 + Math.round(F * 100)).toString(16).padStart(6, '0')}`]] });
JUG_KEYS.forEach((k, ki) => {
  const pourJug = JT.createJugTip({ drawing: ki === 0 ? JT.bakedJug(J).drawing : STUB, full: J.full, dy: J.dy });
  for (const [dir, mv] of Object.entries(JUG_MOVES)) {
    const name = `jugTip.k${ki}.${dir}`;
    const clip = pourJug({ dir, ...mv, moveFrames: 10, k });
    rec(`${name}.keys`, [clip.keys, clip.end]);
    for (let f = 0; f <= clip.end + 1; f++) {
      for (const along of [0, 0.5, 1]) safe(`${name}.layers.${f}.${along}`, () => clip.layers(f, along));
      safe(`${name}.ground.${f}`, () => clip.ground(f));
    }
  }
});
const pourCan = CTP.createCanTip(art.A.bag);
for (const [ki, k] of [CTP.TIP, { ...CTP.TIP, spin: false }, { ...CTP.TIP, depth: 4, hop: 9 }].entries()) for (const dir of ['u', 'd', 'l', 'r']) for (const down of [false, true]) {
  const name = `canTip.k${ki}.${dir}.${down}`;
  const clip = pourCan({ dir, from: [2, 2], to: [3, 2], bagTo: [3, 3], moveFrames: 10, down, k });
  rec(`${name}.keys`, [clip.keys, clip.end]);
  for (let f = 0; f <= clip.end + 1; f++) for (const along of [0, 0.5, 1]) safe(`${name}.layers.${f}.${along}`, () => clip.layers(f, along));
}
for (const [ki, k] of [PS.SHATTER, { ...PS.SHATTER, tip: 3 }, { ...PS.SHATTER, tip: 13, burst: 0.6 }].entries()) for (const dir of ['u', 'd', 'l', 'r']) {
  const sh = PS.paneShatter({ dir, from: [2, 2], to: [3, 2], has: (x, y) => x >= 3 && y >= 1 && y <= 3, look: GLASS, k });
  rec(`paneShatter.k${ki}.${dir}.end`, sh.end);
  for (let f = 0; f <= sh.end + 2; f++) {
    safe(`paneShatter.k${ki}.${dir}.layers.${f}`, () => sh.layers(f));
    safe(`paneShatter.k${ki}.${dir}.ground.${f}`, () => sh.ground(f));
  }
}
const ripClip = BG.createBagRip({ T, BAG: art.A.bag, LAY, STYLE: { outline: LOOK.outline, shadow: LOOK.shadow } });
for (const dir of ['u', 'd', 'l', 'r']) {
  const clip = ripClip({ dir, bag: [3, 3], seed: 11, cells: [[3, 3], [4, 3], [3, 4]] });
  rec(`bagRip.${dir}.end`, clip.end);
  for (let t = 0; t <= 90; t++) safe(`bagRip.${dir}.layers.${t}`, () => clip.layers(t));
}

// ---- Sprites from sprites.js (createSprites), the same calls the sprite bench makes.
const { createSprites, exitArrowDir } = await u('src/sprites.js');
const { DIRS, CAN_EMPTY, JUG_EMPTY, BIN_EMPTY, WHEELIE_EMPTY, CAN_FULL, JUG } = await u('src/rules.js');
const { toState, parseLevelPack } = await u('src/format.js');
const SPRITE_CALLS = [
  ['floor', [1, 1]], ['water', [1, 1, true, 3, 0]], ['water', [1, 1, false, 3, 2]], ['grease', [1, 1]], ['tar', [1, 1]],
  ['glass', [1, 1]], ['covered', [1, 1]], ['grate', [1, 1]], ['sponge', [1, 1]], ['cardboard', [1, 1]], ['pane', [1, 1]],
  ['tyre', [1, 1, true]], ['tyre', [1, 1, false]], ['chair', [1, 1]], ['broom', [1, 1]], ['hold', [1, 1, 2, 1]], ['grip', [1, 1]],
  ['trash', [1, 1, { seed: 4, k: 1, wet: 0 }]], ['bag', [1, 1, 1]], ['can', [1, 1, true]], ['can', [1, 1, false]],
  ['recycleBin', [1, 1, true]], ['jug', [1, 1, true]], ['wheelie', [1, 1, false]], ['splash', [1, 1]], ['raccoon', [1, 1]],
  ['bicycle', [[[0, 0], [1, 0]], 0, 0]], ['rug', [[[0, 0], [1, 0], [0, 1]], 0, 0]], ['skateboard', [[[0, 0], [1, 0]], 0, 0]],
  ['furniture', [[[0, 0], [1, 0]], 0, 0, {}]],
];
for (const d of ['u', 'd', 'l', 'r']) SPRITE_CALLS.push(['oneway', [1, 1, d]], ['cabinet', [1, 1, d, true]], ['cabinet', [1, 1, d, false]],
  ['drawer', [1, 1, d]], ['barrow', [1, 1, d]], ['magnet', [1, 1, d]], ['exit', [1, 1, true, DIRS[d]]], ['exit', [1, 1, false, DIRS[d]]]);
SPRITE_CALLS.push(['drawer', [1, 1, null]], ['exit', [1, 1, true]]);
safe('sprites.exitArrowDir', () => { const r = []; for (let y = 0; y < 4; y++) for (let x = 0; x < 6; x++) r.push(exitArrowDir(6, 4, x, y)); return r; });
SPRITE_CALLS.forEach(([name, args], i) => drawLog(`sprites.${i}.${name}`, () => createSprites({ ctx: ctxFor, cell: 24 })[name](...args)));

// ---- The pixel sprite set: every method, over every cell of the boards.
const PX = await u('src/pixel.js');
const S = PX.createPixelSprites({ ctx: ctxFor, art });
const pack = parseLevelPack(readFileSync(`${ROOT}/levels/sandbox.tt`, 'utf8'));
const act1 = parseLevelPack(readFileSync(`${ROOT}/levels/act1.tt`, 'utf8'));
const BOARDS = [['sandbox', toState(pack.levels[0])], ...act1.levels.slice(0, 4).map((l, i) => [`act1.${i}`, toState(l)])];
const DIRS4 = ['u', 'd', 'l', 'r'];
const ACTS_BY_DIR = Object.fromEntries(DIRS4.map(d => [d, Object.keys(CT.ACTIONS[PR.VIEW[d]])]));
const CLOSED = Object.keys(CA.CABINET);
for (const [bname, board] of BOARDS) {
  S.setBoard(board);
  rec(`board.${bname}.water`, board.cells.flat().filter(c => c.water).length);
  for (let y = 0; y < board.rows; y++) for (let x = 0; x < board.cols; x++) {
    const call = (label, fn) => drawLog(`pixel.${label}.${bname}.${x}.${y}`, fn);
    call('wall', () => S.wall(x, y));
    call('floor', () => S.floor(x, y));
    call('water.dry', () => S.water(x, y, false, 0, 0));
    call('water.filled', () => S.water(x, y, true, 0, 1));
    call('grease', () => S.grease(x, y));
    call('tar', () => S.tar(x, y));
    call('glass', () => S.glass(x, y));
    call('covered', () => S.covered(x, y));
    call('grate', () => S.grate(x, y));
    for (const d of DIRS4) call(`oneway.${d}`, () => S.oneway(x, y, d));
    call('exit.lit', () => S.exit(x, y, true, 'r'));
    call('exit.shut', () => S.exit(x, y, false, 'u', { open: 0.4, frame: 9 }));
    call('trash.0', () => S.trash(x, y, { seed: x * 7 + y, k: 1 }));
    call('trash.half', () => S.trash(x, y, { seed: y + 3, k: 0.5, scraps: [[0, 0, '#ffffff'], [3, 5, '#000000']] }));
    for (const k of [1, 0.5, 0.2]) call(`bag.${k}`, () => S.bag(x, y, k));
    for (const lie of [null, ...DIRS4]) {
      call(`can.full.${lie}`, () => S.can(x, y, true, lie));
      call(`can.empty.${lie}`, () => S.can(x, y, false, lie));
    }
    for (const lie of [null, 'u']) {
      call(`bin.full.${lie}`, () => S.recycleBin(x, y, true, lie));
      call(`bin.empty.${lie}`, () => S.recycleBin(x, y, false, lie));
    }
    call('jug.full', () => S.jug(x, y, true, 'r'));
    call('jug.empty', () => S.jug(x, y, false, null));
    call('wheelie.full', () => S.wheelie(x, y, true));
    call('wheelie.empty', () => S.wheelie(x, y, false));
    call('pane', () => S.pane(x, y));
    for (const h of DIRS4) call(`raccoon.${h}`, () => S.raccoon(x, y, h));
    for (const soaked of [null, 'water', 'tar', 'grease']) {
      call(`sponge.${soaked}`, () => S.sponge(x, y, soaked));
      call(`cardboard.${soaked}`, () => S.cardboard(x, y, soaked));
    }
    for (const h of [true, false]) call(`tyre.${h}`, () => S.tyre(x, y, h));
    call('chair', () => S.chair(x, y));
    call('broom', () => S.broom(x, y));
    for (const f of DIRS4) call(`magnet.${f}`, () => S.magnet(x, y, f));
    for (const f of DIRS4) call(`barrow.${f}`, () => S.barrow(x, y, f));
    for (const f of CLOSED) {
      call(`cabinet.closed.${f}`, () => S.cabinet(x, y, f, false));
      call(`cabinet.open.${f}`, () => S.cabinet(x, y, f, true));
    }
    const pair = [[x, y], [x + 1, y]], upr = [[x, y], [x, y + 1]], one = [[x, y]];
    call('skate.across', () => S.skateboard(pair, 1, -2));
    call('skate.up', () => S.skateboard(upr));
    call('furn.across', () => S.furniture(pair));
    call('furn.up', () => S.furniture(upr));
    call('furn.one', () => S.furniture(one, 2, 0));
    call('bike.side', () => S.bicycle(pair));
    call('bike.up', () => S.bicycle(upr, 0, 1));
    call('rug.across', () => S.rug(pair, 1, 0));
    call('rug.up', () => S.rug(upr, 0, 3));
    call('rug.turn', () => S.rug([[x, y], [x + 2, y + 1]]));
    call('hold', () => S.hold(x, y, x + 2, y + 1));
    call('grip', () => S.grip(x, y));
    call('splash', () => S.splash());
    call('wade.jug', () => S.wade(JUG, f => ({ x, y: y + f / 40 }), 6, () => {}, 'r', 2));
    call('wade.can', () => S.wade(CAN_FULL, f => ({ x: x + f / 30, y }), 14, () => {}, null, 5));
    if (x === 1 && y === 1) for (const h of DIRS4) for (const act of ACTS_BY_DIR[h]) {
      PR.press(act, h).forEach((seg, i) => {
        call(`press.${h}.${act}.${i}`, () => S.pressing(seg, h, x, y));
        call(`press.over.${h}.${act}.${i}`, () => S.pressing(seg, h, x, y, { over: true, stay: true }));
      });
    }
  }
  // The dump, rip and shatter clips, every frame, toward each facing.
  for (const lie of DIRS4) for (const along of [0, 0.5, 1]) {
    const to = { u: [2, 1], d: [2, 3], l: [1, 2], r: [3, 2] }[lie];
    const specs = [[CAN_EMPTY, {}], [JUG_EMPTY, {}], [BIN_EMPTY, { shed: { seed: 9 } }]];
    for (const [o, extra] of specs) for (const down of [false, true]) {
      const name = `dump.${bname}.${o}.${lie}.${along}.${down}`;
      const container = { lie, along, seed: 3, x: 2, y: 2, heading: lie, tx: 2, ty: 2, kind: o };
      let clip = null;
      try { clip = S.dump(o, { container, ...extra, from: [2, 2], to, shedTo: [3, 3], moveFrames: 10, down }); } catch (e) { rec(`${name}.ERR`, e.message); }
      if (!clip) { rec(`${name}.null`, true); continue; }
      rec(`${name}.end`, clip.end);
      for (let f = 0; f <= clip.end + 1; f++) {
        drawLog(`${name}.draw.${f}`, () => clip.draw(f));
        if (clip.ground) drawLog(`${name}.ground.${f}`, () => clip.ground(f));
      }
    }
  }
  for (const lie of DIRS4) {
    const container = { lie, along: 0.5, seed: 4, x: 1, y: 3, heading: lie, tx: 1, ty: 3, kind: WHEELIE_EMPTY };
    const clip = S.dump(WHEELIE_EMPTY, { container, down: false });
    rec(`wheelieDump.${bname}.${lie}.end`, clip.end);
    for (let f = 0; f <= clip.end + 1; f++) drawLog(`wheelieDump.${bname}.${lie}.${f}`, () => clip.draw(f));
  }
  for (const dir of DIRS4) {
    const clip = S.rip({ dir, bag: [3, 3], seed: 11, cells: [[3, 3], [4, 3]] });
    for (let t = 0; t <= 90; t++) drawLog(`pixel.rip.${bname}.${dir}.${t}`, () => clip.layers(t).forEach(l => l.paint()));
    const sh = S.shatter({ dir, from: [1, 1], to: [2, 1], has: (x, y) => x === 2 && y >= 1 && y <= 3 });
    rec(`pixel.shatter.${bname}.${dir}.end`, sh.end);
    for (let f = 0; f <= sh.end + 1; f++) {
      drawLog(`pixel.shatter.${bname}.${dir}.layers.${f}`, () => sh.layers(f).forEach(l => l.paint()));
      drawLog(`pixel.shatter.${bname}.${dir}.ground.${f}`, () => sh.ground(f));
    }
  }
}

writeFileSync(OUT, JSON.stringify({ count: ENTRIES.length, entries: ENTRIES }));
if (ONLY !== null) writeFileSync(`${OUT}.full.json`, JSON.stringify(FULL, null, 1));
const errs = CONTENT_ERRS.length;
console.log(`wrote ${ENTRIES.length} entries to ${OUT} (${errs} entries carry an ERR)`);
const histo = {};
for (const n of CONTENT_ERRS) { const k = n.split('.').slice(0, 2).join('.'); histo[k] = (histo[k] ?? 0) + 1; }
console.log(JSON.stringify(histo));
console.log(CONTENT_ERRS.slice(0, 6).join('\n'));
