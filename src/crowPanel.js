// The crow on the page: his clock, his frame loop, and his panel. The panel is DOM, like the HUD;
// in the pixel art the screen draws him instead, from `screenView`.
import { FRAME_RATE, FRAME_MS } from './art/timing.js';
import { SCREEN, DROP } from './screen.js';

const SETTLE_MS = SCREEN.SETTLE * 1000 / FRAME_RATE;
// One easing per keyframe of the DOM drop, the last frame excepted.
const DROP_EASE = ['cubic-bezier(.5,0,.9,.5)', 'cubic-bezier(.2,.6,.4,1)', 'cubic-bezier(.6,0,.8,.4)'];

/**
 * `els` holds `box`, `veil`, `face` and `line`. `clock()` is the animation clock and `since(t0)`
 * its time on twos. `present()` repaints the pixel screen.
 */
export function createCrowPanel({ pixel, els, clock, since, present }){
  // His clock advances in capped steps. A hidden tab stops the frames but not `performance.now()`,
  // and a clock that jumped the whole absence would land every line due in it unseen.
  let crowT = 0, crowLast = performance.now();
  const now = () => { const p = performance.now(); crowT += Math.min(p - crowLast, 100); crowLast = p; return crowT; };
  let speaking = false, shownFace = '', shownText = '';
  let crowView = { talking: false, speech: false, face: 'closed', text: '' }, faceUp = { id: '', t0: 0 }, settleT0 = -Infinity;

  function paint(v){
    if(pixel){
      if(v.speech !== speaking){ speaking = v.speech; if(!speaking) settleT0 = clock(); }
      const id = `${v.key ?? ''} ${v.face}`;
      if(id !== faceUp.id) faceUp = { id, t0: clock() };
      crowView = v; present();
      return;
    }
    if(v.speech !== speaking){ if(v.speech) toSpeech(); else toDock(); }
    const face = v.talking || v.face !== 'closed' ? v.face : '';
    if(face !== shownFace) els.face.textContent = shownFace = face;
    if(v.text !== shownText) els.line.textContent = shownText = v.text;
  }
  function toSpeech(){ speaking = true; document.body.classList.add('speech'); }
  function toDock(){
    const a = els.box.getBoundingClientRect();
    speaking = false; document.body.classList.remove('speech');
    const b = els.box.getBoundingClientRect();
    const dx = a.left + a.width / 2 - (b.left + b.width / 2), dy = a.top + a.height / 2 - (b.top + b.height / 2);
    els.box.animate([
      { transform: `translate(${dx}px,${dy}px) scale(${a.width / b.width},${a.height / b.height})`, easing: DROP_EASE[0] },
      ...DROP.map(([offset, up, sx, sy], i) => ({
        transform: `translate(0,${up ? `${-up}px` : 0}) scale(${sx},${sy})`, offset, ...(DROP_EASE[i + 1] && { easing: DROP_EASE[i + 1] }) })),
      { transform: 'none' },
    ], { duration: SETTLE_MS });
    els.veil.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SETTLE_MS * SCREEN.VEIL, easing: 'ease-out' });
  }

  return {
    now,
    get speaking(){ return speaking; },
    /** What the pixel screen draws of him. */
    screenView: () => ({ crow: crowView, faceMs: since(faceUp.t0), settle: speaking ? null : since(settleT0) / FRAME_MS }),
    /** Runs his frame loop. `debug` is the crow's debug panel or null; `state()` is the board in hand. */
    start({ crow, watch, debug, state }){
      requestAnimationFrame(function crowFrame(){
        const t = now();
        // A speech is not the player idling.
        if(speaking) watch.key(t); else watch.tick(t, state());
        paint(crow.view(t));
        debug?.paint(crow.peek(), watch.peek(t));
        requestAnimationFrame(crowFrame);
      });
    },
  };
}
