// Boot and wiring. `startGame` takes data it is given; `loadAssets` goes and gets it.

import { parseLevelPack } from './format.mjs';
import { createSession } from './session.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createView } from './view.js';
import { bindInput } from './input.js';

const LEVELS_URL = './levels/act1.tt';
const CHIME_URL = './sfx/win-chime.mp3';

export const ELEMENT_IDS = {
  canvas: 'board', controls: 'controls', tabs: 'tabs',
  name: 'lvlname', moves: 'moves', par: 'par', warn: 'warn', arm: 'arm',
};

/**
 * Wire a playable game into a document that already holds the markup.
 * @param {object} opts
 * @param {Array<object>} opts.levels parsed level records, in play order.
 * @param {ArrayBuffer|null} [opts.chimeBytes] the win chime; null runs on tones alone.
 * @param {Document|Element} [opts.root] where to look the elements up.
 * @param {EventTarget} [opts.keyTarget] where to listen for keystrokes.
 * @returns {object} the live session.
 */
export function startGame({ levels, chimeBytes = null, root = document, keyTarget = window }) {
  const el = Object.fromEntries(Object.entries(ELEMENT_IDS).map(([k, id]) => {
    const node = root.getElementById?.(id) ?? root.querySelector(`#${id}`);
    if (!node) throw new Error(`startGame() cannot find #${id}`);
    return [k, node];
  }));

  const session = createSession(levels);
  const audio = createAudio(chimeBytes);
  const hud = createHud(el, i => load(i));
  const view = createView({
    canvas: el.canvas, session, audio,
    onWinDone: handOver,
    onFrame: () => hud.update(session),
  });

  function load(i) {
    session.load(i);
    view.reset().render();
  }

  function handOver() {
    if (session.index < levels.length - 1) load(session.index + 1);
    else view.render();
  }

  function act(dir) {
    audio.unlock();
    if (session.won) { handOver(); return; }
    if (view.busy) view.cancel();

    const event = session.act(dir);
    if (event.type === 'armed') audio.confirm();
    else if (event.type === 'refused') view.playRefusal(event);
    else {
      view.playMotion(event);
      if (event.won) { audio.win(); view.playWin(); }
    }
    view.render();
  }

  bindInput({
    keyTarget,
    controls: el.controls,
    on: {
      move: act,
      undo: () => { view.cancel(); if (session.undo()) view.render(); },
      restart: () => load(session.index),
      next: () => load(session.index + 1),
      prev: () => load(session.index - 1),
    },
  });

  hud.setLevels(levels);
  load(0);
  return session;
}

/** Fetch the level pack (required) and the win chime (optional). */
export async function loadAssets({ levelsUrl = LEVELS_URL, chimeUrl = CHIME_URL } = {}) {
  const pack = await fetch(levelsUrl);
  if (!pack.ok) throw new Error(`cannot load ${levelsUrl} (${pack.status}) — serve it with ./run.sh`);
  const levels = parseLevelPack(await pack.text()).levels;

  const sfx = await fetch(chimeUrl).catch(() => null);
  return { levels, chimeBytes: sfx?.ok ? await sfx.arrayBuffer() : null };
}

if (typeof document !== 'undefined' && document.getElementById(ELEMENT_IDS.canvas)) {
  startGame(await loadAssets());
}
