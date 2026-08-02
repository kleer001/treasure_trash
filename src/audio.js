// WebAudio boundary. Failures are swallowed: no sound must never mean no input.

const WIN_GAIN = 0.35;

/**
 * @param {ArrayBuffer|null} chimeBytes the win chime, or null to run on tones alone.
 * @returns {{unlock:Function, confirm:Function, refuse:Function, win:Function}}
 */
export function createAudio(chimeBytes = null) {
  let ac = null, chime = null, pending = chimeBytes;

  function context() {
    ac ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(ok) {
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = ok ? 'triangle' : 'square';
    o.frequency.setValueAtTime(ok ? 520 : 190, t);
    if (!ok) o.frequency.setValueAtTime(140, t + .07);
    g.gain.setValueAtTime(ok ? .045 : .09, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + (ok ? .07 : .16));
    o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + (ok ? .08 : .17));
  }

  return {
    /** Call from the first user gesture: opens the context and decodes the chime. */
    unlock() {
      try {
        context();
        if (!pending) return;
        const bytes = pending; pending = null;
        ac.decodeAudioData(bytes).then(b => { chime = b; }, () => {});
      } catch { /* no audio here; the game plays on */ }
    },
    confirm() { try { context(); tone(true); } catch { /* as above */ } },
    refuse() { try { context(); tone(false); } catch { /* as above */ } },
    /** Fire and forget, so it rings over the hand-over into the next room. */
    win() {
      try {
        if (!chime) return;
        const src = context().createBufferSource(), g = ac.createGain();
        src.buffer = chime; g.gain.value = WIN_GAIN;
        src.connect(g); g.connect(ac.destination);
        src.start();
      } catch { /* as above */ }
    },
  };
}
