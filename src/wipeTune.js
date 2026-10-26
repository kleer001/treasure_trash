// The wipe's tuning panel, on `?wipe`: the settings the curtain between rooms runs on, kept in
// this browser, a replay on the room in front of you, and notes saved with the settings.
import { PATTERNS, KINDS, wallFrom, wallFrames } from './wipe.js';

const WIPE_KEY = 'tt-wipe';
const ARROW = { right: '→', left: '←', down: '↓', up: '↑', downRight: '↘', downLeft: '↙', upRight: '↗', upLeft: '↖',
  spiralCw: '⟳', spiralCcw: '⟲' };
const FRAMES = [['exit', 'he leaves'], ['empty', 'the room stands empty'], ['cover', 'the wall goes up'], ['hold', 'the wall stays up at least'],
  ['holdMax', 'the wall stays up at most, while he talks'], ['reveal', 'the wall comes down'], ['lay', 'one brick drops']];
const LEAVES = ['hop', 'dissolve', 'fade'];
const CHOICES = {
  pattern: ['room', ...PATTERNS], kind: ['room', ...Object.keys(KINDS)], leave: LEAVES,
  order: ['same', 'back'], wait: ['fixed', 'end', 'both'],
};
const LABEL = { room: 'by room', same: 'the same way', back: 'back the way it came', ...ARROW,
  fixed: 'fixed frames', end: 'wait for the win line', both: 'wait for the win line and the start line' };

/** The live settings: the game reads them at every win. */
/** `key`: where the settings are kept. `leaves`: the ways he can leave, where the screen has fewer. */
export function createWipeTune(el, defaults, { replay, snap, send, crowFrame, key = WIPE_KEY, leaves = LEAVES }) {
  const C = { ...CHOICES, leave: leaves };

  const set = { ...defaults };
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? '{}');
    for (const k of Object.keys(set)) {
      if (!(k in saved)) continue;
      if (C[k] ? C[k].includes(saved[k]) : Number.isInteger(saved[k]) && saved[k] > 0) set[k] = saved[k];
    }
  } catch { /* a private window: the defaults stand */ }
  set.holdMax = Math.max(set.holdMax, set.hold);
  const save = () => { try { localStorage.setItem(key, JSON.stringify(set)); } catch { /* as above */ } };

  el.hidden = false;
  el.innerHTML = `<div class="wrow"><b>Wipe</b> <button data-do="replay">▶ Play again</button>
    <span class="wsay" data-say="sum"></span></div>
    ${[['pattern', 'Pattern'], ['kind', 'Bricks'], ['leave', 'He leaves by'], ['order', 'The wall comes down'],
      ['wait', 'The wall waits']].map(([k, name]) =>
      `<div class="wrow">${name}: ${C[k].map(v =>
        `<button data-k="${k}" data-v="${v}">${LABEL[v] ?? v}</button>`).join('')}</div>`).join('')}
    <div class="wrow">Frames at 60 Hz: ${FRAMES.map(([k, name]) =>
      `<span class="wnum">${name} <button data-n="${k}" data-d="-1">−</button><input data-show="${k}" inputmode="numeric"><button data-n="${k}" data-d="1">+</button></span>`).join('')}</div>
    <div class="wrow"><textarea data-note rows="2" placeholder="A note on these settings"></textarea>
      <button data-do="note">Save note</button> <span class="wsay" data-say="note"></span></div>`;

  const q = s => el.querySelector(s);
  function paint() {
    for (const b of el.querySelectorAll('[data-k]')) b.setAttribute('aria-pressed', String(set[b.dataset.k] === b.dataset.v));
    for (const [k] of FRAMES) q(`[data-show="${k}"]`).value = set[k];
    const load = wallFrom(set) + set.cover + set.hold, crow = Math.round(crowFrame);
    const { min, max } = wallFrames(set, set.wait), secs = n => (n / 60).toFixed(2);
    const span = min === max ? `${min} frames, ${secs(min)} s` : `${min} to ${max} frames, ${secs(min)} to ${secs(max)} s`;
    const at = crow < set.exit ? 'while he leaves' : crow < wallFrom(set) ? 'while the room stands empty'
      : crow < wallFrom(set) + set.cover ? 'while the wall goes up'
      : crow < load ? 'with the wall up' : 'after the next room is in';
    q('[data-say="sum"]').innerHTML = `${span}. The crow starts at frame ${crow}, ${at}.`
      + (set.wait === 'fixed' && load < crow ? ' <span class="bad">The room changes before he starts, so his win line is dropped.</span>' : '');
  }
  const setFrames = (k, n) => { set[k] = Math.max(k === 'holdMax' ? set.hold : 1, n); set.holdMax = Math.max(set.holdMax, set.hold); };
  // A typed count lands on Enter or when the box loses focus; anything that is not a number puts the old one back.
  el.addEventListener('change', e => {
    const k = e.target.dataset.show, n = Math.round(Number(e.target.value));
    if (!k) return;
    if (e.target.value.trim() !== '' && Number.isFinite(n)) setFrames(k, n);
    save(); paint();
  });
  el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.show) e.target.blur(); });
  el.addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.k) set[b.dataset.k] = b.dataset.v;
    if (b.dataset.n) setFrames(b.dataset.n, set[b.dataset.n] + Number(b.dataset.d));
    set.holdMax = Math.max(set.holdMax, set.hold);
    if (b.dataset.do === 'replay') replay();
    if (b.dataset.do === 'note') {
      const words = q('[data-note]').value.trim(), say = q('[data-say="note"]');
      if (!words) return;
      say.textContent = 'saving…'; say.className = 'wsay';
      send({ type: 'wipe', wall: new Date().toISOString(), settings: { ...set }, game: snap(), words })
        .then(() => { q('[data-note]').value = ''; say.textContent = 'saved'; },
          err => { say.textContent = `NOT saved: ${err.message}. Restart ./run.sh, which takes notes.`; say.className = 'wsay bad'; });
    }
    save(); paint();
    b.blur();       // the arrow keys belong to the game, not to the button last clicked
  });
  paint();
  return set;
}
