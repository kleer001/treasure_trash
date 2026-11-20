// The status line under the board: the room, the moves, par, the notices and the stars. It is DOM,
// not canvas, so it is not a compositor layer.
import {
  BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, BIN_EMPTY, WHEELIE, WHEELIE_EMPTY, JUG, JUG_EMPTY,
  SPONGE, CARDBOARD, PANE, TIRE_H, TIRE_V, BICYCLE, RUG, CHAIR, BROOM,
  CABC_U, CABC_D, CABC_L, CABC_R, CABO_U, CABO_D, CABO_L, CABO_R, MAG_U, MAG_D, MAG_L, MAG_R,
  FURNITURE, DIRS, inGrid, cell,
} from './rules.js';
import { refusal } from './crowWatch.js';

// A room is shown by its own id, zero-padded, so the picker, the pack and levels.md all call
// it the same thing. Three digits because the pack is meant to grow: L0 -> 000, L18 -> 018.
export const pad = id => String(id).replace(/\D+/g,'').padStart(3,'0');

const WHY = {
  edge:    "that's the edge of the alley",
  wall:    "wall",
  trash:   "your own trash — permanent",
  fan:     "no room to burst",
  canRoom: "no room to shove it",
  exit:    "that's your way out — you can't dump on it",
  water:   "he's not wetting his paws — fill it in first",
  afloat:  "that's out in the canal — he's not wading in after it",
  pour:    "it only pours on dry ground",
  glass:   "broken glass — he's not standing in that",
  tar:     "stuck in the tar for good",
  oneway:  "that only goes one way, and it isn't this one",
};
// Name the thing in the way rather than saying "blocked": the red cell already carries that.
const OBSTACLE = { [BAG]:"a bag", [CAN_FULL]:"a full can", [CAN_EMPTY]:"a can", [TRASH]:"your own trash",
  [BIN]:"a full recycle bin", [BIN_EMPTY]:"an empty recycle bin",
  [WHEELIE]:"a wheelie bin",
  [WHEELIE_EMPTY]:"an empty wheelie bin", [JUG]:"the water jug", [JUG_EMPTY]:"the empty jug",
  [SPONGE]:"the sponge", [CARDBOARD]:"the cardboard", [PANE]:"the pane of glass",
  [TIRE_H]:"the tyre", [TIRE_V]:"the tyre", [BICYCLE]:"the bicycle", [RUG]:"the rolled rug", [CHAIR]:"the office chair", [BROOM]:"the broom",
  [CABC_U]:"the filing cabinet", [CABC_D]:"the filing cabinet",
  [CABC_L]:"the filing cabinet", [CABC_R]:"the filing cabinet",
  [CABO_U]:"the open cabinet", [CABO_D]:"the open cabinet",
  [CABO_L]:"the open cabinet", [CABO_R]:"the open cabinet",
  [MAG_U]:"the magnet", [MAG_D]:"the magnet", [MAG_L]:"the magnet", [MAG_R]:"the magnet",
  [FURNITURE]:"the couch" };

/** The notice for refusal `b` ({ cells, reason, dir }) on board `state`. */
export function whyText(state, b){
  const base = WHY[refusal(state, b)];
  if(b.reason !== 'fan' && b.reason !== 'canRoom') return base;
  const [x,y] = b.cells[0] ?? [];
  if(x === undefined || !inGrid(state,x,y)) return `${base} — the wall's in the way`;
  const c = cell(state,x,y);
  const what = c.wall ? "the wall" : (OBSTACLE[c.o] ?? "something");
  return `${base} — ${what} is in the way`;
}

function armedVerb(state, armed){
  const [dx,dy]=DIRS[armed];
  const c = cell(state, state.rac.x+dx, state.rac.y+dy);
  return c.o===BAG ? 'tear' : 'shove';
}

/** `byId` finds a status element by its id. */
export function createHud(byId, progress){
  const el = Object.fromEntries(['moves','par','lvlname','picknum','warn','arm','score','lost'].map(id => [id, byId(id)]));
  return {
    /** `level` is the room's pack entry; `beat`: this run set a new record for the room. */
    paint({ level: L, state, moves, won, armed, busy, blocked, beat, lost }){
      el.moves.textContent=moves;
      el.par.textContent=L.par;
      el.lvlname.textContent=L.name;
      el.picknum.textContent=pad(L.id);
      // The busy notice outranks a stale refusal: it is about right now, and it is about to go.
      el.warn.textContent = busy ? '⏳ one thing at a time — he only has the two paws'
        : blocked ? `✕ ${whyText(state, blocked)}` : '';
      el.warn.className = 'warn'+(busy?' show busy':blocked?' show':'');
      el.arm.textContent = armed ? `${({u:'↑',d:'↓',l:'←',r:'→'})[armed]} again to ${armedVerb(state, armed)}` : '';
      el.arm.className = 'arm'+(armed?' show':'');
      const st=progress.stars(L.id, L.par), bestMoves=progress.best(L.id);
      // Par is the proven minimum, so "over par" is an exact number rather than a designer's guess.
      el.score.textContent = won ? `${'★'.repeat(st)}${'☆'.repeat(3-st)}${beat?' new best!':''}`
        : bestMoves !== null ? `${'★'.repeat(st)}${'☆'.repeat(3-st)} best ${bestMoves}` : '';
      el.score.className = 'score'+(bestMoves!==null||won?' show':'')+(beat?' beat':'');
      // The notice is short enough to sit on the moves row. A standing notice that pushes the board
      // down the page is a bigger interruption than the thing it reports. It still names the way back,
      // because saying it helps only if you can act on it.
      el.lost.innerHTML = lost ? '<b>✕</b> unwinnable — undo or restart' : '';
      el.lost.className = 'lost'+(lost?' show':'');
    },
  };
}
