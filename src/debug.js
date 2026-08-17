// The play-by-play, for development. Presentation only, and strictly downstream: it reads the
// account `explain` already returns for a traced action and writes it out. Nothing in here
// decides anything about a move, and nothing else reads what it produces.
//
// It takes its element at the boundary the way `progress` takes its store, so what it writes
// can be read by a plain object in a test.
import { OCCUPANTS } from './rules.js';

// An occupant reads back under the name rules.js gives it, so a line here and a branch there
// call the same thing the same thing. Derived rather than listed: a code added to the engine
// is named here without anyone remembering to come back for it.
const NAME = Object.fromEntries(Object.entries(OCCUPANTS)
  .filter(([, v]) => typeof v === 'number').map(([k, v]) => [v, k]));
const named = o => NAME[o] ?? `?${o}`;
const at = ([x, y]) => `${x},${y}`;
const cart = n => `cart#${n}`;

// Where a thing came to rest when a cell does not say it: which cart holds it, and how deep in
// what that cart is carrying.
const stow = m =>
  (m.fromCart !== undefined ? ` out of ${cart(m.fromCart)}` : '')
  + (m.toCart !== undefined ? ` into ${cart(m.toCart)}` : '')
  + (m.parent != null && m.toCart === undefined ? ` in ${cart(m.parent)}` : '')
  + (m.wasDepth !== undefined && m.wasDepth !== m.depth ? ` @${m.wasDepth}->${m.depth}`
    : m.depth ? ` @${m.depth}` : '');

/** One traced step, as lines: the piece that travelled, then every mutation it billed. */
const linesOf = step => {
  const out = [];
  // One piece or several — a tow moves a barrow and what it is towing in the same beat. Same
  // shape `applyStep` reads, so a step that carries a list is not read as one piece with no name.
  for (const p of [step.piece ?? []].flat())
    out.push(`${p.kind}#${p.ref} rolls ${at([p.dx, p.dy])}` + (p.effect ? ` ${p.effect}` : ''));
  if (step.impact) out.push('impact');
  for (const m of step.moved)
    out.push(`${named(m.o)} ${at(m.from)}->${at(m.to)}`
      + (m.becomes !== undefined ? ` becomes ${named(m.becomes)}` : '')
      + stow(m) + (m.effect ? ` ${m.effect}` : ''));
  for (const s of step.spawned)
    out.push(`+${named(s.o)} ${at(s.at)}`
      + (s.from ? ` from ${at(s.from)}` : '') + (s.parent != null ? ` in ${cart(s.parent)}` : '')
      + (s.effect ? ` ${s.effect}` : ''));
  for (const g of step.gone)
    out.push(`-${named(g.o)} ${at(g.at)}` + (g.depth ? ` @${g.depth}` : ''));
  for (const b of step.born)
    out.push(`*${b.kind}#${b.ref} ${named(b.o)} ${b.cells.map(at).join(' ')}`);
  return out;
};

/**
 * `el` is the scrolling log. `cap` bounds the DOM: a session is thousands of moves and the
 * interesting one is the last one.
 */
export function createDebugLog(el, cap = 240) {
  const add = (head, lines, cls) => {
    const e = document.createElement('div');
    e.className = cls ? `e ${cls}` : 'e';
    const h = document.createElement('b');
    h.textContent = head;
    e.append(h);
    if (lines.length) e.append(lines.join('\n'));
    el.append(e);
    while (el.childElementCount > cap) el.firstElementChild.remove();
    el.scrollTop = el.scrollHeight;
  };
  return {
    /** A move that landed: where he ended up, then what it did to the board. */
    action(n, dir, from, r) {
      add(`${n} ${dir} ${r.kind}`,
        [`rac ${at([from.x, from.y])}->${at([r.next.rac.x, r.next.rac.y])}`,
          ...r.steps.flatMap(linesOf)]);
    },
    /** A move that did not: the engine's own reason, and the cells it blamed. */
    refused(dir, r) {
      add(`- ${dir} refused: ${r.reason}`, r.blame.map(b => `blame ${at(b)}`), 'no');
    },
    note(text) { add(text, [], 'mark'); },
  };
}
