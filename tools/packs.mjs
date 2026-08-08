#!/usr/bin/env node
// Treasure Trash — where the shipped rooms are.
//
// Discovered rather than listed, because an act nobody enumerates is an act nobody checks: the
// pack that adds `act3.tt` should not also have to remember to add it to the verifier and to the
// conformance corpus. One reading, so those two cannot come to disagree about what ships.

import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseLevelPack } from '../src/format.js';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** Every `levels/actN.tt`, with the `.sol` beside it, in act order. */
export const actPacks = () =>
  readdirSync(resolve(root, 'levels')).filter(f => /^act\d+\.tt$/.test(f)).sort()
    .map(f => ({
      name: f,
      levelPath: resolve(root, 'levels', f),
      solPath: resolve(root, 'levels', f.replace(/\.tt$/, '.sol')),
    }));

/** Every shipped room, tagged with the pack it came from. */
export const actLevels = () => actPacks().flatMap(p =>
  parseLevelPack(readFileSync(p.levelPath, 'utf8')).levels
    .map(level => ({ name: `${p.name}:${level.id}`, level })));
