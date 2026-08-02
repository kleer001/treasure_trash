// Input boundary: keystrokes and taps become named intents.

const KEYS = {
  ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r',
  w: 'u', s: 'd', a: 'l', d: 'r', W: 'u', S: 'd', A: 'l', D: 'r',
};
const PAD_DIRS = { up: 'u', down: 'd', left: 'l', right: 'r' };

/**
 * Wire keyboard and the on-screen controls to handlers.
 * @param {object} opts
 * @param {EventTarget} opts.keyTarget where to listen for keystrokes.
 * @param {Element} opts.controls the container holding every `[data-act]` button.
 * @param {object} opts.on handlers: { move(dir), undo(), restart(), next(), prev() }.
 */
export function bindInput({ keyTarget, controls, on }) {
  if (!keyTarget || !controls) throw new Error('bindInput() needs a key target and a controls element');
  for (const verb of ['move', 'undo', 'restart', 'next', 'prev'])
    if (typeof on?.[verb] !== 'function') throw new Error(`bindInput() needs an on.${verb} handler`);

  keyTarget.addEventListener('keydown', (e) => {
    if (e.key in KEYS) { e.preventDefault(); on.move(KEYS[e.key]); }
    else if (e.key === 'u' || e.key === 'U') on.undo();
    else if (e.key === 'r' || e.key === 'R') on.restart();
  });

  controls.addEventListener('click', (e) => {
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (!act) return;
    if (act in PAD_DIRS) on.move(PAD_DIRS[act]);
    else if (act === 'undo') on.undo();
    else if (act === 'restart') on.restart();
    else if (act === 'next') on.next();
    else if (act === 'prev') on.prev();
  });
}
