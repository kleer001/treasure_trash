// Tuning data for the presentation layer: palette, geometry, timings, copy.

import { BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY } from './rules.mjs';

export const BOARD = { cell: 76, pad: 9 };

export const PALETTE = {
  red: '#ff4b3e', yel: '#ffcf00', blu: '#2d7dd2', tea: '#17c3b2', pnk: '#ff5da2',
  ink: '#1a1a1a', grn: '#2e9e5b',
  water: '#2e6f8e', waterFilled: '#7fb7c4',
};
export const CONFETTI_COLOURS = [PALETTE.red, PALETTE.yel, PALETTE.blu, PALETTE.tea, PALETTE.pnk];

export const REFUSAL_MS = {
  tear: { lunge: 150, burst: 190, hold: 260, rewind: 240 },
  push: { lunge: 130, burst: 0, hold: 170, rewind: 140 },
  bump: { lunge: 70, burst: 0, hold: 110, rewind: 80 },
};
export const MOVE_MS = { move: 120, push: 175, tear: 230 };
export const WIN_MS = 1400;
export const CONFETTI = { count: 90, gravity: 1500, fade: 0.45, speed: [90, 420], lift: 260 };

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
