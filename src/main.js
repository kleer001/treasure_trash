// Boot and wiring. Everything this file does is hand one module to another: it owns no
// rules, draws nothing, and holds no state of its own.
//
// The split that matters is between `startGame`, which takes data it has already been
// given, and `boot`, which goes and gets it. That is what lets the same game run three
// ways from one source — served from disk, bundled into a single file for publishing, or
// driven from a test — without any of them re-implementing the wiring.

import { parseLevelPack } from './format.mjs';
import { createSession } from './session.js';
import { createAudio } from './audio.js';
import { createHud } from './hud.js';
import { createView } from './view.js';
import { bindInput } from './input.js';

const LEVELS_URL = './levels/act1.tt';
const CHIME_URL = './sfx/win-chime.mp3';

/** The ids `startGame` looks for. Renaming a hook is a change here, not a hunt. */
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
 * @returns {object} the live session, for a caller that wants to drive it.
 */
export function startGame({ levels, chimeBytes = null, root = document, keyTarget = window }) {
  const el = Object.fromEntries(Object.entries(ELEMENT_IDS).map(([k, id]) => {
    const node = root.getElementById?.(id) ?? root.querySelector(`#${id}`);
    if (!node) throw new Error(`startGame() cannot find #${id}`); // boundary
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

  // The reward IS the progression: the blast ends and the next room is already up. The
  // chime is not consulted — it is still ringing, and that is the point.
  function handOver() {
    if (session.index < levels.length - 1) load(session.index + 1);
    else view.render();
  }

  function act(dir) {
    audio.unlock();                        // the first input is the gesture that opens audio
    if (session.won) { handOver(); return; }   // done admiring it? straight to the next room
    if (view.busy) view.cancel();          // any input skips an animation already playing

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

/** Fetch what the game needs. Fails loudly — a missing pack is not a game with no rooms. */
export async function loadAssets({ levelsUrl = LEVELS_URL, chimeUrl = CHIME_URL } = {}) {
  const pack = await fetch(levelsUrl);
  if (!pack.ok) throw new Error(`cannot load ${levelsUrl} (${pack.status}) — serve it with ./run.sh`);
  const levels = parseLevelPack(await pack.text()).levels;

  // The chime is the one binary asset, and the only optional one: a room that hands over in
  // silence is still a room won.
  const sfx = await fetch(chimeUrl).catch(() => null);
  return { levels, chimeBytes: sfx?.ok ? await sfx.arrayBuffer() : null };
}

// Auto-start in the browser (skipped under `node --test`, where there is no document).
if (typeof document !== 'undefined' && document.getElementById(ELEMENT_IDS.canvas)) {
  startGame(await loadAssets());
}
