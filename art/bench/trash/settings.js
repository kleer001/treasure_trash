// Settings the trash pages save. The pages share one origin, so a page reads another's by its key.

/** `defaults` with the values saved under `key` laid over them field by field. A saved field that
 *  the defaults do not have is dropped. */
export function load(key, defaults) {
  const ui = structuredClone(defaults);
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    for (const k in ui) if (k in saved) {
      if (typeof ui[k] === 'object') { for (const f in ui[k]) if (f in saved[k]) ui[k][f] = saved[k][f]; }
      else ui[k] = saved[k];
    }
  } catch {}
  return ui;
}

export function save(key, ui) { try { localStorage.setItem(key, JSON.stringify(ui)); } catch {} }

export const SPREAD = 'trash-spread';

/** The Trash Spread page's settings before a control moves. Each method's fields are its sliders, in order. */
export function spreadDefaults(LOOK) {
  const min = LOOK.min, max = LOOK.max, spill = Math.round(LOOK.spill * 100);
  return { zoom: 2, seed: LOOK.spread.seed, wrap: LOOK.spread.wrap, hues: LOOK.spread.hues, seams: 'on', mark: 'off',
    mound: { min, max, spill },
    flat: { min, max, spill, jitter: 100 },
    edges: { ...LOOK.spread.edges },
    field: { n: Math.round((min + max) / 2), spill, falloff: 15, rough: 4, jitter: 100 } };
}

export const FLIGHT = 'trash-flight';

/** The Landing Bench's settings before a control moves. */
export const flightDefaults = LOOK => ({ dir: 'u', room: 'walled', playing: true, speed: 100, zoom: 4, fps: 30, ...LOOK.flight });

export const SHADE = 'trash-shadow';

/** The Shadow Bench's settings before a control moves. `cast` is the shadow itself; the rest is the bench. */
export const shadowDefaults = LOOK => ({ dir: 'u', room: 'walled', playing: true, speed: 100, zoom: 4, fps: 30, piece: 'banana_peel',
  cast: { ...LOOK.cast } });

/** The Trash Spread page's settings. Accent hues are per 'cell' or per 'piece'; any other saved value reads as 'piece'. */
export function loadSpread(LOOK) {
  const S = load(SPREAD, spreadDefaults(LOOK));
  if (S.hues !== 'cell') S.hues = 'piece';
  return S;
}
