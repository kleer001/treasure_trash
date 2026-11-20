// Controls the water benches build from data: titled slider groups, switches, colour picks, reset
// buttons, zoom buttons and a note that saves itself with the settings.

import { WATER } from '../../../src/art/water.js';

export const el = (tag, props = {}, kids = []) => {
  const e = document.createElement(tag);
  Object.assign(e, props);
  e.append(...kids);
  return e;
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** Binds controls to the settings `s`, whose values before any edit are `d`. `change()` runs after each
 *  edit. `resets` holds a function for each bound value that puts it back to its default. */
export function bind(s, d, change) {
  const resets = [], marks = [];
  return { s, d, resets, marks, change: () => { for (const mark of marks) mark(); change(); } };
}

/** Returns a small `r` button that runs `back()`. It is disabled while `now()` equals `then`, and its
 *  `mark()` checks that again. */
export function resetButton(back, now, then) {
  const r = el('button', { className: 'r', textContent: 'r', onclick: back });
  r.mark = () => { r.disabled = same(now(), then); };
  r.mark();
  return r;
}

/** Returns the `r` button of the control bound by `b` to `s[key]`. `show()` puts the value on the control. */
export function resetOf(b, key, show) {
  const back = () => { b.s[key] = structuredClone(b.d[key]); show(); };
  const r = resetButton(() => { back(); b.change(); }, () => b.s[key], b.d[key]);
  b.resets.push(back);
  b.marks.push(r.mark);
  return r;
}

/** Appends a button that puts each value bound by `b` back to its default. */
export function resetAll(root, b) {
  root.append(el('button', { textContent: 'reset', onclick: () => { for (const back of b.resets) back(); b.change(); } }));
}

/** Appends to `root` a line titled `title`, unless `title` is null, then a slider for each
 *  `[key, label, min, max, step]` of `rows`, bound by `b` to `s[key]`. */
export function sliders(root, title, rows, b) {
  if (title !== null) root.append(el('div', { className: 'group', textContent: title }));
  for (const [key, label, min, max, step] of rows) {
    const range = el('input', { type: 'range', min, max, step }), num = el('input', { type: 'number', min, max, step });
    const show = () => { range.value = num.value = b.s[key]; };
    range.oninput = () => { b.s[key] = Number(range.value); num.value = range.value; b.change(); };
    num.onchange = () => { b.s[key] = Math.round(Number(num.value) / step) * step; show(); b.change(); };
    show();
    root.append(el('label', { className: 'knob' }, [label, range, num, resetOf(b, key, show)]));
  }
}

/** Appends to `root` a line titled `title`, then a switch for each `[key, label]` of `rows`, bound by `b` to the boolean `s[key]`. */
export function switches(root, title, rows, b) {
  root.append(el('div', { className: 'group', textContent: title }));
  for (const [key, label] of rows) {
    const box = el('input', { type: 'checkbox' }), show = () => { box.checked = b.s[key]; };
    box.onchange = () => { b.s[key] = box.checked; b.change(); };
    show();
    root.append(el('label', { className: 'pick' }, [el('span', { textContent: label }), box, resetOf(b, key, show)]));
  }
}

/** Appends a pick of `options` bound by `b` to `s[key]`. */
export function choice(root, label, key, options, b) {
  const pick = el('select'), show = () => { pick.value = b.s[key]; };
  for (const o of options) pick.append(new Option(o, o));
  pick.onchange = () => { b.s[key] = pick.value; b.change(); };
  show();
  root.append(el('div', { className: 'pick' }, [el('span', { textContent: label }), pick, resetOf(b, key, show)]));
}

/** Appends a colour pick bound by `b` to `s[key]`, which holds a key of `WATER`, one of `extra`, or a `#rrggbb`. */
export function colour(root, label, key, b, extra = []) {
  const { s } = b, pick = el('select'), free = el('input', { type: 'color' });
  for (const name of [...extra, ...Object.keys(WATER)]) pick.append(new Option(name.toLowerCase(), name));
  pick.append(new Option('custom', '#'));
  const show = () => {
    const custom = s[key].startsWith('#');
    pick.value = custom ? '#' : s[key];
    free.hidden = !custom;
    if (custom) free.value = s[key];
  };
  pick.onchange = () => { s[key] = pick.value === '#' ? WATER[s[key]] ?? free.value : pick.value; show(); b.change(); };
  free.oninput = () => { s[key] = free.value; b.change(); };
  show();
  root.append(el('div', { className: 'pick' }, [el('span', { textContent: label }), pick, free, resetOf(b, key, show)]));
}

/** Appends − and + buttons around a readout of `s.zoom`, a whole multiple of the game's px. */
export function zoom(root, { s, change }) {
  const read = el('span', { className: 'read' });
  const set = z => { s.zoom = Math.max(1, Math.min(12, z)); read.textContent = `${s.zoom * 100}%`; };
  set(s.zoom);
  root.append(el('div', { className: 'pick' }, [el('span', { textContent: 'zoom' }),
    el('button', { textContent: '−', onclick: () => { set(s.zoom - 1); change(); } }), read,
    el('button', { textContent: '+', onclick: () => { set(s.zoom + 1); change(); } })]));
}

/** Appends a note and a save status to `root`, and returns `save()`, which posts `state()` and the
 *  note to `/notes` as page `page` a moment after its last call. */
export function autosaver(root, page, state) {
  const note = el('textarea', { placeholder: 'Note' }), status = el('div', { className: 'status' });
  root.append(note, status);
  let timer = 0;
  const save = () => {
    clearTimeout(timer);
    timer = setTimeout(() => fetch('/notes', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ page, settings: state(), note: note.value, at: new Date().toISOString() }) })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        status.className = 'status'; status.textContent = `saved ${new Date().toLocaleTimeString()}`;
      })
      .catch(e => { status.className = 'status bad'; status.textContent = `not saved: ${e.message}`; }), 600);
  };
  note.oninput = save;
  return save;
}
