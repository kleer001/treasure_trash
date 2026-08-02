// Every number and every string the presentation layer tunes on. No logic lives here and
// nothing here reaches for a canvas — house rule, code and data are separate, so the game
// can be retuned or retranslated without opening a drawing function.
//
// The occupant-keyed tables below are keyed by the engine's own codes on purpose: the
// vocabulary belongs to `rules.mjs`, and copying the numbers into a second alphabet is how
// a legend drifts out of step with the board it labels.

import { BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY } from './rules.mjs';

/** Board geometry. `cell` is the canvas size of one grid square; `pad` insets a sprite. */
export const BOARD = { cell: 76, pad: 9 };

// The five house colours, plus the two the game needs that the house palette does not
// supply: exit-sign green (ISO 3864 "safe condition", not a Memphis accent) and the two
// waters. Water is darker than anything else on the board because the one thing a player
// must believe on sight is "not walkable".
export const PALETTE = {
  red: '#ff4b3e', yel: '#ffcf00', blu: '#2d7dd2', tea: '#17c3b2', pnk: '#ff5da2',
  ink: '#1a1a1a', grn: '#2e9e5b',
  water: '#2e6f8e', waterFilled: '#7fb7c4',
};
/** Confetti and trash specks cycle these — the strip look, in miniature. */
export const CONFETTI_COLOURS = [PALETTE.red, PALETTE.yel, PALETTE.blu, PALETTE.tea, PALETTE.pnk];

// ---------------------------------------------------------------- motion
// A refusal is played out in full and then rewound, so its phases are named rather than
// numbered: lunge into the cell, burst, hold on the flash, rewind. Scaled to what there is
// to show — a refused tear has the whole story, a refused step has a knock.
export const REFUSAL_MS = {
  tear: { lunge: 150, burst: 190, hold: 260, rewind: 240 },
  push: { lunge: 130, burst: 0, hold: 170, rewind: 140 },
  bump: { lunge: 70, burst: 0, hold: 110, rewind: 80 },
};
/** An accepted action, keyed by the engine's action kinds. */
export const MOVE_MS = { move: 120, push: 175, tear: 230 };
export const WIN_MS = 1400;
export const CONFETTI = { count: 90, gravity: 1500, fade: 0.45, speed: [90, 420], lift: 260 };

// ---------------------------------------------------------------- copy
// Name the thing in the way rather than saying "blocked". The player can already see the
// red cell; the words should add the noun, not repeat the colour.
export const WHY = {
  edge: "that's the edge of the alley",
  wall: 'wall',
  trash: 'your own trash — permanent',
  fan: 'no room to burst',
  canRoom: 'no room to shove it',
  exit: "that's your way out — you can't dump on it",
  water: "he's not wetting his paws — fill it in first",
};
export const OBSTACLE = {
  [BAG]: 'a bag', [CAN_FULL]: 'a full can', [CAN_EMPTY]: 'a can', [TRASH]: 'your own trash',
  [BIN]: 'the recycle bin', [STACK]: 'a bag on a can', [WHEELIE]: 'a wheelie bin',
  [WHEELIE_EMPTY]: 'an empty wheelie bin',
};
export const ARROW = { u: '↑', d: '↓', l: '←', r: '→' };
