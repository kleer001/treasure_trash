// The filing cabinet, side elevation, cleaned by hand from the Blender model's views. l is r mirrored.
// `ax` is the column of the body's centre.
//   k ink, B top, b top's near edge, S carcase, F drawer front, f its lit top, g gap,
//   i inside of the drawer, E drawer rim, Q rail lit, q rail, P pull lit, p pull
const PALETTE = { k: '#19152b', B: '#473f53', b: '#5a5068', S: '#352e3e', F: '#50657c', f: '#6984a1', g: '#262440', i: '#211d33', E: '#80b3b7', Q: '#9da6ad', q: '#797f85', P: '#dbd8b4', p: '#a9a78b' };
export const CABINET_LOOK = { front: 24, side: 24, outD: 32, depthD: 10, outS: 21, depthS: 17 };

// `front` and `side` are the body's width in px facing down/up and facing left/right; `outD` is how far in px the top
// drawer comes out toward you, and `depthD` how long its box looks from the rim to the front;
// `outS` and `depthS` are the same two facing left or right.
const D = [
    '.kkkkkkkkkkkk.',
    'kBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBk',
    'kbbbbbbbbbbbbk',
    'kSSSSSSSSSSSSk',
    'kSffffffffffSk',
    'kSFFFFFFFFFFSk',
    'kSFFFFppFFFFSk',
    'kSFFFPPPPFFFSk',
    'kSFFFFFFFFFFSk',
    'kSFFFFFFFFFFSk',
    'kSFFFFFFFFFFSk',
    'kSggggggggggSk',
    'kSffffffffffSk',
    'kSFFFFFFFFFFSk',
    'kSFFFFppFFFFSk',
    'kSFFFPPPPFFFSk',
    'kSFFFFFFFFFFSk',
    'kSFFFFFFFFFFSk',
    'kSFFFFFFFFFFSk',
    'kSSSSSSSSSSSSk',
    '.kggggggggggk.',
    '..kkkkkkkkkk..',
];
const U = [
    '.kkkkkkkkkkkk.',
    'kBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBk',
    'kBBBBBBBBBBBBk',
    'kbbbbbbbbbbbbk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kBSSSSSSSSSSSk',
    'kSSSSSSSSSSSSk',
    '.kggggggggggk.',
    '..kkkkkkkkkk..',
];
const R = [
    '.kkkkkkkkkkkkkkkk...',
    'kBBBBBBBBBBBBBBBBk..',
    'kBBBBBBBBBBBBBBBBk..',
    'kBBBBBBBBBBBBBBBBk..',
    'kBBBBBBBBBBBBBBBBk..',
    'kBBBBBBBBBBBBBBBBk..',
    'kbbbbbbbbbbbbbbbbk..',
    'kSSSSSSSSSSSSSSSSfk.',
    'kSSSSSSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSFPk',
    'kSSSSSSSSSSSSSSSSFpk',
    'kSSSSSSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSgk.',
    'kSSSSSSSSSSSSSSSSfk.',
    'kSSSSSSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSFPk',
    'kSSSSSSSSSSSSSSSSFpk',
    'kSSSSSSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSFk.',
    '.kggggggggggggggkk..',
    '..kkkkkkkkkkkkkk....',
];
const RO = [
    '.kkkkkkkkkkkkkkkk.........................',
    'kBBBBBBBBBBBBBBBBk........................',
    'kBBBBBBBBBBBBBBBBk........................',
    'kBBBBBBBBBBBBBBBBk........................',
    'kBBBBBBBBBBBBBBBBk.......kkkkkkkkkkkkkkk..',
    'kBBBBBBBBBBBBBBBBk......kEEEEEEEEEEEEEEfk.',
    'kbbbbbbbbbbbbbbbbk.kkkkkkEiiiiiiiiiiiiEFk.',
    'kSSSSSSSSSSSSSSSSgkqqqqqqEiiiiiiiiiiiiEFk.',
    'kSSSSSSSSSSSSSSSSgkkkkkkkEiiiiiiiiiiiiEFPk',
    'kSSSSSSSSSSSSSSSSgk.....kEEEEEEEEEEEEEEFpk',
    'kSSSSSSSSSSSSSSSSgkkkkkkkSSSSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSgkQQQQQQQQQSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSgkkkkkkkSSSSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSgk.....kSSSSSSSSSSSSSSFk.',
    'kSSSSSSSSSSSSSSSSgk......kkkkkkkkkkkkkkk..',
    'kSSSSSSSSSSSSSSSSfk.......................',
    'kSSSSSSSSSSSSSSSSFk.......................',
    'kSSSSSSSSSSSSSSSSFPk......................',
    'kSSSSSSSSSSSSSSSSFpk......................',
    'kSSSSSSSSSSSSSSSSFk.......................',
    'kSSSSSSSSSSSSSSSSFk.......................',
    'kSSSSSSSSSSSSSSSSFk.......................',
    'kSSSSSSSSSSSSSSSSFk.......................',
    '.kggggggggggggggkk........................',
    '..kkkkkkkkkkkkkk..........................',
];
const UO = [
  '.kkkkkkkkkkkkkkkkkkkkkk.',
  'kffffffffffffffffffffffk',
  'kFFFFFFFFFFFFFFFFFFFFFFk',
  'kFFFFFFFFFFFFFFFFFFFFFFk',
  'kFEiiiiiiiiiiiiiiiiiiEFk',
  'kQEiiiiiiiiiiiiiiiiiiEqk',
  'kQEiiiiiiiiiiiiiiiiiiEqk',
  'kQEiiiiiiiiiiiiiiiiiiEqk',
  'kQEiiiiiiiiiiiiiiiiiiEqk',
  'kQEiiiiiiiiiiiiiiiiiiEqk',
  'kQEiiiiiiiiiiiiiiiiiiEqk',
  'kQEiiiiiiiiiiiiiiiiiiEqk',
  'kQEggggggggggggggggggEqk',
  'kQEEEEEEEEEEEEEEEEEEEEqk',
  'kQEEEEEEEEEEEEEEEEEEEEqk',
  'kQkkkkkkkkkkkkkkkkkkkkqk',
  'kQk..................kqk',
  'kQk..................kqk',
  'kQk..................kqk',
  'kQSSSSSSSSSSSSSSSSSSSkqk',
  'kBBBBBBBBBBBBBBBBBBBBBBk',
  'kBBBBBBBBBBBBBBBBBBBBBBk',
  'kBBBBBBBBBBBBBBBBBBBBBBk',
  'kBBBBBBBBBBBBBBBBBBBBBBk',
  'kBBBBBBBBBBBBBBBBBBBBBBk',
  'kBBBBBBBBBBBBBBBBBBBBBBk',
  'kbbbbbbbbbbbbbbbbbbbbbbk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kBSSSSSSSSSSSSSSSSSSSSSk',
  'kSSSSSSSSSSSSSSSSSSSSSSk',
  '.kggggggggggggggggggggk.',
  '..kkkkkkkkkkkkkkkkkkkk..',
];

const widen = (rows, at, n) => rows.map(r => (n < 0 ? r.slice(0, at) + r.slice(at - n) : r.slice(0, at) + r[at].repeat(n) + r.slice(at)));
// A front or back view grows on both sides of the pulls, so they stay in the middle.
const wider = (rows, n) => widen(widen(rows, 10, Math.floor(n / 2)), 3, Math.ceil(n / 2));
const mirror = v => ({ ...v, mid: v.rows[0].length - 1 - v.mid, rows: v.rows.map(r => [...r].reverse().join('')) });

const FRONT = ['kffffffffffffk', 'kFFFFFFFFFFFFk', 'kFFFFFppFFFFFk', 'kFFFFPPPPFFFFk', 'kFFFFFFFFFFFFk', 'kFFFFFFFFFFFFk', 'kFFFFFFFFFFFFk'];
const ARMS = 'kQk........kqk';
const lay = (rows, y, r) => { rows[y] = [...r].map((c, x) => (c === '.' ? (rows[y] ?? '.'.repeat(r.length))[x] : c)).join(''); };

function frontOpen(out, depth) {
  const rows = D.map((r, y) => (y >= 9 && y <= 15 ? 'kSggggggggggSk' : r));
  const box = ['kQEEEEEEEEEEQk', ...Array(depth - 2).fill('kQEiiiiiiiiEQk'), 'kqEiiiiiiiiEqk'];
  const back = 9 + out - depth;
  for (let y = 12; y < back; y++) lay(rows, y, ARMS);
  [...box, ...FRONT, '.kkkkkkkkkkkk.'].forEach((r, k) => lay(rows, back + k, r));
  return rows;
}
function sideOpen(out, depth, ns) {
  const box = widen(RO, 32, depth - 16);
  return widen(widen(box, 20, Math.max(-4, out - 22 - (depth - 16))), 8, ns);
}

/** Every view for a look: { closed, open }, each by the facing of the drawers. */
export function cabinetViews(look) {
  // `mid` is the body's centre column, a half when its width is even.
  const nf = look.front - 14, ns = look.side - 18, mid = (look.front - 1) / 2;
  const side = rows => ({ mid: 8.5 + ns / 2, foot: rows.length - 1, rows });
  const closed = { d: { mid, foot: D.length - 2, rows: wider(D, nf) }, u: { mid, foot: U.length - 1, rows: wider(U, nf) },
    r: side(widen(R, 8, ns)) };
  const open = { d: { mid, foot: D.length - 2, rows: wider(frontOpen(look.outD, look.depthD), nf) },
    u: { mid: (UO[0].length - 1) / 2, foot: UO.length - 1, rows: UO },
    r: side(sideOpen(look.outS, look.depthS, ns)) };
  closed.l = mirror(closed.r); open.l = mirror(open.r);
  return { closed, open };
}

const sprite = ({ mid, foot, rows }) => ({ ax: Math.ceil(mid), foot, w: rows[0].length, h: rows.length,
  px: rows.flatMap((r, y) => [...r].flatMap((c, x) => (c === '.' ? [] : [[x, y, PALETTE[c]]]))) });
/** The sprites for a look, closed and open, by the facing of the drawers: { ax, foot, w, h, px: [x, y, colour] }.
 *  `foot` is the row the carcase stands on. */
export function cabinetSprites(look) {
  const v = cabinetViews(look);
  return Object.fromEntries(['closed', 'open'].map(k => [k, Object.fromEntries([...'udlr'].map(f => [f, sprite(v[k][f])]))]));
}
const SPRITES = cabinetSprites(CABINET_LOOK);
export const CABINET = SPRITES.closed;
export const CABINET_OPEN = SPRITES.open;
