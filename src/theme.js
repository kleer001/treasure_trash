// Tuning data for the presentation layer: palette, geometry, timings, copy.

import { BAG, CAN_FULL, CAN_EMPTY, TRASH, BIN, STACK, WHEELIE, WHEELIE_EMPTY } from './rules.mjs';

export const BOARD = { cell: 76, pad: 9 };

export const PALETTE = {
  red: '#ff4b3e', yel: '#ffcf00', blu: '#2d7dd2', tea: '#17c3b2', pnk: '#ff5da2',
  ink: '#1a1a1a', grn: '#2e9e5b',
};
export const CONFETTI_COLOURS = [PALETTE.red, PALETTE.yel, PALETTE.blu, PALETTE.tea, PALETTE.pnk];

/** What each thing on the board is made of. Retune a piece without opening a draw call. */
export const SKIN = {
  floor: { fill: '#fff', edge: '#e6e6e2' },
  water: { open: '#2e6f8e', filled: '#7fb7c4', ripple: 'rgba(255,255,255,.45)' },
  exit: { lit: PALETTE.grn, dim: 'rgba(46,158,91,.12)', dimEdge: 'rgba(46,158,91,.6)',
          litInk: '#fff', dimInk: 'rgba(46,158,91,.55)' },
  bag: { body: '#161616', glint: PALETTE.yel },
  can: { body: '#b9c0c7', edge: '#7d858c', ridge: '#9aa2a9', rim: '#cfd5da', mouth: '#3a4046' },
  bin: { body: PALETTE.blu, edge: '#1b4f86', lid: '#4a95e0', mark: '#fff' },
  wheelie: { body: '#3f7d4f', edge: '#255034', ridge: '#2f6a40', lid: '#4f9a63', wheel: '#22252a' },
  raccoon: { tail: '#8b8f95', tailTip: '#4a4e54', ear: '#6b7076', head: '#9aa0a6',
             mask: '#2b2f34', muzzle: '#eceef0', eye: '#fff', pupil: '#111' },
  guide: { fill: 'rgba(255,207,0,.45)', edge: 'rgba(224,170,0,.85)',
           landFill: 'rgba(255,207,0,.32)', landEdge: 'rgba(224,170,0,.9)', aim: '#e0aa00' },
  blocked: { fill: 'rgba(255,75,62,.42)', edge: PALETTE.red, cross: '#c8321f', bar: PALETTE.red },
};

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
