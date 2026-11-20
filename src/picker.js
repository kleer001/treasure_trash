// The level picker: one fold per act, one cell per room.
import { pad } from './hud.js';

/**
 * `els` holds the picker's elements: `grid`, `sheet`, `button` (opens it) and `close`. `acts` is
 * one `{ label, from, to }` per act, as indices into `levels`. `current()` is the room in hand;
 * `choose(i)` loads room `i`.
 */
export function createPicker({ els, levels, acts, progress, current, choose }){
  const { grid, sheet, button, close: closer } = els;
  const cells = [];
  // The folds are `<details>` rather than a hand-rolled accordion, so the
  // keyboard and the screen reader get the behaviour for free.
  const folds = acts.map(a => {
    const fold=document.createElement('details'); fold.className='act-group';
    const head=document.createElement('summary');
    head.append(a.label);
    const range=document.createElement('span'); range.className='range';
    range.textContent=`${pad(levels[a.from].id)}–${pad(levels[a.to].id)}`;
    const tag=document.createElement('span'); tag.className='tally';
    head.append(range,tag);
    fold.append(head);
    const g=document.createElement('div'); g.className='grid';
    for(let i=a.from;i<=a.to;i++){
      const b=document.createElement('button');
      b.className='cell';
      const n=document.createElement('span'); n.className='no'; n.textContent=pad(levels[i].id);
      const s=document.createElement('span'); s.className='stars';
      b.append(n,s);
      b.onclick=()=>{ close(); choose(i); };
      g.append(b); cells[i]=b;
    }
    fold.append(g);
    grid.append(fold);
    return { act: a, fold, tag, done: false };
  });

  /** Called on open, so the picker is never stale. */
  function paintProgress(){
    const cur = current();
    levels.forEach((L,i)=>{
      const b=cells[i]; if(!b) return;
      const n=progress.stars(L.id, L.par), done=progress.done(L.id);
      b.className='cell'+(done?' done':'');
      b.setAttribute('aria-current',String(i===cur));
      // Only filled stars are written: at this size a hollow star reads as a filled one, so the count
      // is legible by LENGTH rather than by shape.
      b.querySelector('.stars').textContent = '★'.repeat(n);
      const bestMoves=progress.best(L.id);
      b.title = `${L.name ?? L.id} — par ${L.par}`
        + (done ? ` · best ${bestMoves} (${n}/3)` : ' · not finished');
    });
    for(const f of folds){
      const t=progress.tally(levels.slice(f.act.from,f.act.to+1));
      f.done=t.complete;
      f.tag.textContent = t.complete
        ? `✓ ${t.earned}/${t.possible}★`
        : `${t.done}/${t.total} · ${t.earned}★`;
      f.fold.classList.toggle('finished', t.complete);
    }
  }

  function open(){
    paintProgress();
    const cur = current();
    const here = folds.findIndex(f => cur>=f.act.from && cur<=f.act.to);
    const next = folds.findIndex(f => !f.done);
    const show = (folds[here]?.done && next !== -1) ? next : here;
    folds.forEach((f,k)=>{ f.fold.open = k===show; });
    sheet.hidden=false;
    button.setAttribute('aria-expanded','true');
    cells[cur]?.scrollIntoView({block:'nearest'});
    cells[cur]?.focus();
  }
  function close(){
    sheet.hidden=true;
    button.setAttribute('aria-expanded','false'); button.focus();
  }
  button.onclick=open;
  closer.onclick=close;
  sheet.addEventListener('click',e=>{ if(e.target===sheet) close(); });

  return { open, close, isOpen: () => !sheet.hidden };
}
