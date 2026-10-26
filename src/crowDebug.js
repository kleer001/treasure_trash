// The crow's inner workings, in a panel under his own, on `?debug`. It hears the director's log
// and reads the director and the watcher through their `peek`s; it decides nothing. Everything
// sits inside the factory because the artifact bundle runs every module in one scope.
import { TALK } from './crow.js';

/**
 * `el` is the empty panel. `events` is `dialogue/crow.json`; `tuning` is the crow's `TUNING`.
 * `snap()` gives the game's side of a note, and `send(note)` stores it, resolving once it is kept.
 */
export function createCrowDebug(el, { events, tuning, snap, send }) {
  const T = tuning, WINDOW_MS = 20000, LOG_ROWS = 9, KEEP_MS = 60000, FLASH_MS = 700;
  el.hidden = false;
  el.innerHTML = `
    <div class="k">line</div><div class="v" data-r="line"></div>
    <div class="k">scope</div><div><canvas class="scope"></canvas><div class="legend">
      <span><s style="background:#2d7dd2"></s>said</span><span><s style="background:#9cc3ec"></s>sped up</span>
      <span><s style="background:#9a9a9a"></s>by himself</span><span><s style="background:#ffcf00"></s>face only</span>
      <span><s style="background:#17c3b2"></s>wait to decide</span><span><s style="border:1px dashed #17c3b2"></s>queued</span>
      <span><s style="background:#bdbdb8"></s>event timer</span><span><s style="background:#ff5da2"></s>monologue timer</span>
      <span class="ink">│ fire</span><span class="bad">✕ drop</span><span class="pnk">▼ skip</span><span class="ink">◆ talk level</span>
    </div></div>
    <div class="k">wait</div><div class="v" data-r="wait"></div>
    <div class="k">timers</div><div class="v" data-r="timers"></div>
    <div class="k">talk</div><div class="v" data-r="talk"></div>
    <div class="k">room</div><div class="v" data-r="room"></div>
    <div class="k">board</div><div class="v" data-r="board"></div>
    <div class="k">log</div><div class="v"><div class="log" data-r="log"></div></div>`;
  // Under the panel: a note is the moment of the click, saved at once; words follow if typed.
  const noteBar = document.createElement('div');
  noteBar.className = 'cdbgnote';
  noteBar.innerHTML = `<button type="button">Make note now</button>
    <input type="text" placeholder="words for the last note, then Enter" disabled><span></span>`;
  el.after(noteBar);
  const [noteBtn, noteText, noteSay] = noteBar.children;
  const row = k => el.querySelector(`[data-r="${k}"]`);
  const cv = el.querySelector('canvas'), g = cv.getContext('2d');

  // The log as it came, and what it drew: lines said, faces, waits, queues and timers, each a span.
  const recs = [], spans = [];
  const open = (kind, key) => spans.findLast(s => s.kind === kind && s.key === key && s.to === null);

  function note(r) {
    recs.push(r);
    if (recs.length > 400) recs.splice(0, 100);
    if (r.type === 'say') {
      const q = open('queue', r.key);
      if (q) q.to = r.t;
      spans.push({ kind: 'say', key: r.key, from: r.t, to: null, beats: r.beats.length, fastAt: null, bySelf: false });
    } else if (r.type === 'fast') open('say', r.key).fastAt = r.t;
    else if (r.type === 'end' || r.type === 'skip') Object.assign(open('say', r.key), { to: r.t, skipped: r.type === 'skip' });
    else if (r.type === 'face') spans.push({ kind: 'face', key: r.key, from: r.t, to: r.t + T.faceMs });
    else if (r.type === 'queue') spans.push({ kind: 'queue', key: r.key, from: r.t, to: null });
    else if (r.type === 'drop') { const q = open('queue', r.key); if (q) q.to = r.t; }
  }

  // What the log does not say is read off `peek` each frame: the wait before he decides, the
  // queue a once-only line leaves without a word, and the timers.
  let pre = null;
  function sample(c) {
    const t = c.now;
    if (c.dueAt !== null) {
      if (pre) pre.to = c.dueAt;
      else spans.push(pre = { kind: 'pre', key: 'decide', from: t, to: c.dueAt });
    } else if (pre) { pre.to = Math.min(pre.to, t); pre = null; }
    for (const s of spans) if (s.kind === 'queue' && s.to === null && !c.wants.some(w => w.waiting && w.key === s.key)) s.to = t;
    const timers = [...c.gaps.map(([key, to]) => ({ kind: 'gap', key, to, len: T.eventGapMs })),
      ...(c.monoUntil > t ? [{ kind: 'mono', key: 'monologue', to: c.monoUntil, len: T.monoGapMs }] : [])];
    for (const x of timers)
      if (!spans.some(s => s.kind === x.kind && s.key === x.key && s.to === x.to)) spans.push({ ...x, from: x.to - x.len });
    if (c.line) { const s = open('say', c.line.key); if (s) s.bySelf = c.line.bySelf; }
    for (let i = spans.length - 1; i >= 0; i--) if (spans[i].to !== null && spans[i].to < t - KEEP_MS) spans.splice(i, 1);
  }

  const sec = ms => (ms / 1000).toFixed(1);
  const esc = s => String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[ch]);
  const bar = (frac, w, ticks = []) => `<span class="bar" style="width:${w}px"><span style="width:${Math.max(0, Math.min(1, frac)) * 100}%"></span>${ticks.map(x => `<i style="left:${x * 100}%"></i>`).join('')}</span>`;

  /** A drop's reason, said with the number behind it, worked out the first frame it is drawn. */
  function detail(r, c) {
    if (r.type === 'drop' && r.why === 'gap') {
      const g = c.gaps.find(([k]) => k === r.key);
      return g ? `gap ${sec(g[1] - r.t)} s left` : 'gap';
    }
    if (r.type === 'drop' && r.why === 'mono') return `monologue timer ${sec(c.monoUntil - r.t)} s left`;
    if (r.type === 'drop' && r.why === 'talk') return `talk: ${events[r.key].talk} line, level ${c.talk}`;
    if (r.type === 'drop' && r.why === 'chance') return `chance: lost the dice at ${Math.round(c.chance * 100)}%`;
    if (r.type === 'say') return r.beats.length > 1 ? `monologue, ${r.beats.length} beats` : '';
    if (r.type === 'fast') return `${T.fastX}×`;
    if (r.type === 'face') return r.face;
    if (r.type === 'talk') return `now ${r.talk}`;
    if (r.type === 'queue') return 'he is talking';
    return r.why ?? '';
  }

  function rowLine(c, w) {
    const l = c.line;
    if (l) {
      const s = l.beats[l.beat];
      const pips = l.beats.map((_, k) => k < l.beat ? '●' : k === l.beat ? '◉' : '○').join('');
      return `<span class="ty say">say</span><b>${esc(l.key)}</b><span class="mu">${l.tier}</span>`
        + (l.beats.length > 1 ? `<span class="pips">${pips}</span>` : '')
        + `<span>${bar(l.typed / s.length, 90)} ${l.typed}/${s.length}</span>`
        + (l.speed > 1 ? `<span class="x3">${l.speed}×</span>` : '')
        + `<span>beat ${sec(l.beatLeft)} s · line ${sec(l.lineLeft)} s</span>`
        + `<span class="mu">${esc(l.face)} · bag ${l.bagLeft} of ${l.bagSize} left · said ${l.said}×${l.bySelf ? ' · by himself' : ''}</span>`;
    }
    if (c.face) return `<span class="ty face">face</span><b>${esc(c.face.key)}</b><span>${esc(c.face.face)}</span>`
      + `<span>${bar(1 - (c.face.until - c.now) / T.faceMs, 60)} ${sec(c.face.until - c.now)} s</span>`
      + '<span class="mu">no words at this talk level</span>';
    return `<span class="mu">silent${w ? ` · ${sec(w.idle)} s since the last key` : ''}</span>`;
  }

  function rowWait(c) {
    const out = [];
    if (pre) {
      const left = pre.to - c.now;
      out.push(`<span class="tm pre">decides in ${bar((c.now - pre.from) / (pre.to - pre.from), 60)} ${sec(left)} s</span>`);
    }
    const fired = c.wants.filter(x => !x.waiting).map(x => esc(x.key));
    if (fired.length) out.push(`<span class="ty fire">fired</span><span>${fired.join(', ')}</span>`);
    for (const x of c.wants.filter(x => x.waiting))
      out.push(`<span class="ty queue">queue</span><b>${esc(x.key)}</b><span class="mu">once-only · waited ${sec(c.now - x.t)} s${x.timed ? ` of ${sec(T.momentMs)} s` : ''}</span>`);
    return out.join('') || '<span class="mu">nothing waits</span>';
  }

  function rowTimers(c) {
    const ts = [...(c.monoUntil > c.now ? [['monologue', c.monoUntil, T.monoGapMs, 'mono']] : []),
      ...c.gaps.map(([k, u]) => [k, u, T.eventGapMs, 'gap'])].sort((a, b) => a[1] - b[1]);
    if (!ts.length) return '<span class="mu">no timer runs</span>';
    return ts.map(([k, u, len, kind]) => `<span class="tm ${kind}"><span>${esc(k)}</span>${bar((u - c.now) / len, 60)}<span>${sec(u - c.now)}</span></span>`).join('');
  }

  function rowTalk(c) {
    const seg = `<span class="seg">${TALK.map(k => `<span class="${k === c.talk ? 'on' : ''}">${k}</span>`).join('')}</span>`;
    const r = c.recent, slots = Array.from({ length: T.talkUpWindow }, (_, k) => r[r.length - T.talkUpWindow + k]);
    const sq = h => `<i class="${h === undefined ? '' : h ? 's' : 'h'}"></i>`, cut = T.talkUpWindow - T.talkWindow;
    const squares = `<span class="sq">${slots.slice(0, cut).map(sq).join('')}<span class="win">${slots.slice(cut).map(sq).join('')}</span></span>`;
    const last = r.slice(-T.talkWindow), skipped = last.filter(Boolean).length;
    const base = Math.max(last.length, T.talkWindow / 2);
    const down = c.talk === TALK[0] ? 'quietest' : `quieter at ${Math.ceil(T.talkDown * base)} of ${base}`;
    const up = c.talk === TALK.at(-1) ? 'chattiest'
      : `chattier after ${T.talkUpWindow} lines with ≤ ${Math.floor(T.talkUp * T.talkUpWindow)} skipped (${r.length} lines, ${r.filter(Boolean).length} skipped)`;
    return `${seg}${squares}<span>skipped ${skipped} of ${last.length} · ${down}</span><span class="mu">${up}</span>`
      + `<span>dice ${Math.round(c.chance * 100)}%</span>`;
  }

  // A counter flashes as it reaches one of its marks, which is the moment the watcher fires.
  const hit = {};
  function meter(name, label, v, marks, t, unit = '') {
    const max = marks.at(-1), next = marks.find(m => v < m) ?? max;
    if (marks.includes(v) && hit[name]?.v !== v) hit[name] = { v, t };
    if (!marks.includes(v)) delete hit[name];
    const hot = hit[name] && t - hit[name].t < 900 ? ' hot' : '';
    return `<span class="m${hot}"><span>${label}</span>${bar(v / max, 60, marks.slice(0, -1).map(m => m / max))}<span>${v}/${next}${unit}</span></span>`;
  }

  function rowRoom(w, t) {
    if (!w) return '<span class="mu">no room yet</span>';
    const idle = Math.floor(w.idle / 1000), idles = [T.idleMs, T.rambleMs, T.dozeMs].map(x => x / 1000);
    return [meter('walks', 'walks', w.walks, [T.longWalk], t), meter('fast', 'fast run', w.fastRun, [T.fastRun], t),
      meter('refusals', 'refusals', w.refusals, [T.manyRefusals], t), meter('same', 'same refusal', w.same, T.sameRefusal, t),
      meter('undos', 'undos', w.undos, [T.manyUndos], t), meter('restarts', 'restarts', w.restarts, [T.manyRestarts], t),
      meter('idle', 'idle', idle, idles, t, ' s')].join('');
  }

  function rowBoard(w, t) {
    if (!w) return '<span class="mu">no room yet</span>';
    return `<span class="vd vd-${w.verdict}">${w.verdict === 'unknown' ? 'not known' : w.verdict}</span>`
      + `<span>attempt ${w.attempt} · losses ${w.losses}</span>`
      + meter('lostMoves', 'moves while lost', w.lostMoves, T.lostLadder, t);
  }

  function rowLog(c) {
    return recs.slice(-LOG_ROWS).reverse().map(r => {
      r.detail ??= detail(r, c);
      const age = c.now - r.t, f = age < FLASH_MS ? ` style="background:rgba(255,207,0,${((1 - age / FLASH_MS) * .55).toFixed(2)})"` : '';
      const key = r.type === 'talk' ? '' : r.key;
      return `<div class="${r.type}"><span${f}>${sec(r.t)}</span><span${f}><span class="ty ${r.type}">${r.type}</span></span>`
        + `<span${f}>${esc(key)}</span><span class="why"${f}>${esc(r.detail)}</span></div>`;
    }).join('');
  }

  // The scope: the last 20 s, now at the right edge.
  const LANES = { say: [4, 20], wait: [25, 33], timer: [38, 58], event: [63, 77] };
  function drawScope(t) {
    const dpr = devicePixelRatio || 1, W = cv.clientWidth, H = cv.clientHeight;
    if (cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) { cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const x0 = 42, x1 = W - 3, t0 = t - WINDOW_MS;
    const X = s => x0 + (s - t0) / WINDOW_MS * (x1 - x0);
    const clip = (a, b) => [Math.max(a, t0), Math.min(b ?? t, t)];
    g.font = '10.5px ui-monospace,Menlo,monospace'; g.textBaseline = 'middle';
    g.fillStyle = '#8a8a86';
    for (const [k, [a, b]] of Object.entries(LANES)) g.fillText(k, 1, (a + b) / 2);
    for (let s = Math.ceil(t0 / 5000) * 5000; s <= t; s += 5000) {
      if (s < 0) continue;
      g.fillStyle = '#ececea'; g.fillRect(Math.round(X(s)), 0, 1, 80);
      g.fillStyle = '#8a8a86'; g.fillText(`${s / 1000}s`, X(s) + 2, 87);
    }
    g.fillStyle = '#1a1a1a'; g.fillRect(Math.round(x1), 0, 1.5, 80);

    const [sa, sb] = LANES.say, [wa, wb] = LANES.wait, [ta] = LANES.timer, rows = [];
    for (const s of spans) {
      const [a, b] = clip(s.from, s.to);
      if (b <= a) continue;
      if (s.kind === 'say') {
        const fa = s.fastAt !== null ? Math.min(Math.max(s.fastAt, a), b) : b;
        g.fillStyle = s.bySelf ? '#9a9a9a' : '#2d7dd2'; g.fillRect(X(a), sa, X(fa) - X(a), sb - sa);
        g.fillStyle = '#9cc3ec'; g.fillRect(X(fa), sa, X(b) - X(fa), sb - sa);
        if (X(b) - X(a) > g.measureText(s.key).width + 6) { g.fillStyle = '#fff'; g.fillText(s.key, X(a) + 3, (sa + sb) / 2); }
      } else if (s.kind === 'face') { g.fillStyle = '#ffcf00'; g.fillRect(X(a), sa + 4, X(b) - X(a), sb - sa - 8); }
      else if (s.kind === 'pre') { g.fillStyle = '#17c3b2'; g.fillRect(X(a), wa, X(b) - X(a), wb - wa); }
      else if (s.kind === 'queue') {
        g.strokeStyle = '#17c3b2'; g.setLineDash([2, 2]); g.lineWidth = 1;
        g.strokeRect(X(a) + .5, wa + .5, X(b) - X(a) - 1, wb - wa - 1); g.setLineDash([]);
      } else {
        let r = rows.findIndex(end => end <= s.from);
        if (r < 0) { r = rows.length; rows.push(0); }
        rows[r] = s.to;
        if (r > 5) continue;
        g.fillStyle = s.kind === 'mono' ? '#ff5da2' : '#bdbdb8';
        g.fillRect(X(a), ta + r * 3.5, X(b) - X(a), 2.5);
      }
    }
    const [ea, eb] = LANES.event, em = (ea + eb) / 2;
    for (const r of recs) {
      if (r.t < t0 || r.t > t) continue;
      const x = X(r.t);
      if (r.type === 'fire') { g.fillStyle = '#1a1a1a'; g.fillRect(x, ea, 1, eb - ea); }
      else if (r.type === 'drop') {
        g.strokeStyle = '#e0342a'; g.lineWidth = 1.5; g.beginPath();
        g.moveTo(x - 3.5, em - 3.5); g.lineTo(x + 3.5, em + 3.5); g.moveTo(x + 3.5, em - 3.5); g.lineTo(x - 3.5, em + 3.5); g.stroke();
      } else if (r.type === 'queue') { g.fillStyle = '#17c3b2'; g.beginPath(); g.arc(x, em, 3, 0, 7); g.fill(); }
      else if (r.type === 'skip') { g.fillStyle = '#ff5da2'; g.beginPath(); g.moveTo(x - 4, ea); g.lineTo(x + 4, ea); g.lineTo(x, ea + 7); g.fill(); }
      else if (r.type === 'talk') { g.fillStyle = '#1a1a1a'; g.beginPath(); g.moveTo(x, em - 5); g.lineTo(x + 5, em); g.lineTo(x, em + 5); g.lineTo(x - 5, em); g.fill(); }
    }
  }

  let lastC = null, lastW = null, lastNote = null, notes = 0;
  const tell = (html, bad) => { noteSay.innerHTML = html; noteSay.className = bad ? 'bad' : ''; };
  const failed = (n, e) => tell(`note ${n} was NOT saved: ${esc(e.message)}. Restart ./run.sh, which takes notes.`, true);
  noteBtn.onclick = () => {
    const n = ++notes, id = `${Date.now()}-${n}`;
    lastNote = { id, n, t: lastC.now };
    noteText.disabled = false; noteText.value = ''; noteText.focus();
    tell(`note ${n} at ${sec(lastC.now)} s: saving…`);
    send({ type: 'note', id, wall: new Date().toISOString(), t: lastC.now, game: snap(), crow: lastC, watch: lastW,
      log: recs.filter(r => r.t >= lastC.now - KEEP_MS) })
      .then(() => tell(`note ${n} at ${sec(lastC.now)} s saved · type words, then Enter`), e => failed(n, e));
  };
  noteText.onkeydown = e => {
    if (e.key === 'Escape') { noteText.blur(); return; }
    if (e.key !== 'Enter' || !noteText.value.trim()) return;
    const { id, n } = lastNote, words = noteText.value.trim();
    noteText.value = ''; noteText.disabled = true; noteText.blur();
    send({ type: 'words', id, words }).then(() => tell(`note ${n}: words saved`), e => failed(n, e));
  };

  const shown = {};
  const put = (k, html) => { if (shown[k] !== html) row(k).innerHTML = shown[k] = html; };

  return {
    note,
    /** `c` is the director's `peek()` and `w` the watcher's `peek(t)`, both taken this frame. */
    paint(c, w) {
      lastC = c; lastW = w;
      sample(c);
      put('line', rowLine(c, w)); put('wait', rowWait(c)); put('timers', rowTimers(c)); put('talk', rowTalk(c));
      put('room', rowRoom(w, c.now)); put('board', rowBoard(w, c.now)); put('log', rowLog(c));
      drawScope(c.now);
    },
  };
}
