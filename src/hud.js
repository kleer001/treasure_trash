// The text around the board: room name, move count, the room strip, and the two badges
// that say what the rules just refused and what you have aimed. DOM at the boundary — the
// elements are handed in, so nothing here goes looking for the document.

import { BAG, cell, inGrid } from './rules.mjs';
import { WHY, OBSTACLE, ARROW } from './theme.js';

/**
 * Why an action was refused, in words. Names the thing in the way rather than saying
 * "blocked" — the player can already see the red cell; the words add the noun.
 */
export function refusalText(state, blocked) {
  const base = WHY[blocked.reason];
  if (blocked.reason !== 'fan' && blocked.reason !== 'canRoom') return base;
  const [x, y] = blocked.cells[0] ?? [];
  if (x === undefined || !inGrid(state, x, y)) return `${base} — the wall's in the way`;
  const c = cell(state, x, y);
  return `${base} — ${c.wall ? 'the wall' : (OBSTACLE[c.o] ?? 'something')} is in the way`;
}

/**
 * @param {object} el the HUD elements: { tabs, name, moves, par, warn, arm }.
 * @param {(index:number)=>void} onSelect called when a room in the strip is clicked.
 */
export function createHud(el, onSelect) {
  for (const k of ['tabs', 'name', 'moves', 'par', 'warn', 'arm'])
    if (!el?.[k]) throw new Error(`createHud() is missing the "${k}" element`); // boundary

  return {
    /** Build the room strip once, from the pack. */
    setLevels(levels) {
      el.tabs.replaceChildren(...levels.map((L, i) => {
        const b = el.tabs.ownerDocument.createElement('button');   // the handed-in document
        b.className = 'tab'; b.textContent = L.id;
        b.addEventListener('click', () => onSelect(i));
        return b;
      }));
    },

    /** Reflect the session. Called on every frame the board is redrawn. */
    update(session) {
      const { level, state, blocked, armed } = session;
      el.name.textContent = `${level.id} — ${level.name}`;
      el.moves.textContent = session.moves;
      el.par.textContent = level.par;

      el.warn.textContent = blocked ? `✕ ${refusalText(state, blocked)}` : '';
      el.warn.classList.toggle('show', Boolean(blocked));

      el.arm.textContent = armed
        ? `${ARROW[armed]} again to ${session.armedTarget === BAG ? 'tear' : 'shove'}`
        : '';
      el.arm.classList.toggle('show', Boolean(armed));

      [...el.tabs.children].forEach((t, i) => t.classList.toggle('on', i === session.index));
    },
  };
}
