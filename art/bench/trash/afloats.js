// Every thing a move can leave at rest in the water, in each of its drawings, in sets that fit one pond.
// Each is [the key of its solid in `SOLIDS` in src/art/solid.js, draw(S)].

const SLOTS = [2, 4, 6].flatMap(y => [2, 4, 6, 8].map(x => [x, y]));
const FACES = ['u', 'd', 'l', 'r'];
const spread = draws => draws.map(([solid, d], i) => [solid, S => d(S, ...SLOTS[i])]);

export const SETS = [
  spread([['bag', (S, x, y) => S.bag(x, y)], ['can', (S, x, y) => S.can(x, y, false)], ['bin', (S, x, y) => S.recycleBin(x, y, false)],
    ['jug', (S, x, y) => S.jug(x, y, false)], ['wheelie', (S, x, y) => S.wheelie(x, y, true)], ['wheelie', (S, x, y) => S.wheelie(x, y, false)]]),
  spread([['can', 'can'], ['bin', 'recycleBin'], ['jug', 'jug']].flatMap(([solid, k]) => FACES.map(lie => [solid, (S, x, y) => S[k](x, y, false, lie)]))),
  spread([['sponge', (S, x, y) => S.sponge(x, y)], ['cardboard', (S, x, y) => S.cardboard(x, y)], ['pane', (S, x, y) => S.pane(x, y)],
    ['chair', (S, x, y) => S.chair(x, y)], ['broom', (S, x, y) => S.broom(x, y)], ['tyreH', (S, x, y) => S.tyre(x, y, true)],
    ['tyreV', (S, x, y) => S.tyre(x, y, false)]]),
  spread(['magnet', 'cabinet', 'barrow'].flatMap(k => FACES.map(f => [k, (S, x, y) => S[k](x, y, f)]))),
  [['drawer', S => S.cabinet(2, 2, 'r', true)], ['drawer', S => S.cabinet(7, 2, 'l', true)], ['drawer', S => S.cabinet(7, 5, 'd', true)],
    ['drawer', S => S.cabinet(2, 6, 'u', true)]],
  [['couch', S => S.furniture([[2, 2], [3, 2]])], ['couchUp', S => S.furniture([[7, 2], [7, 3]])], ['bicycle', S => S.bicycle([[2, 5], [3, 5]])],
    ['bicycleUp', S => S.bicycle([[7, 5], [7, 6]])]],
  [['rug', S => S.rug([[2, 2], [3, 2]])], ['rugUp', S => S.rug([[7, 2], [7, 3]])], ['skateboard', S => S.skateboard([[2, 5], [3, 5]])],
    ['skateboardUp', S => S.skateboard([[7, 5], [7, 6]])]],
];
