// Sound, at the boundary. Nothing in `src/` outside this file touches WebAudio, and the
// game talks to it through four verbs — so a silent build, a test, or a headless capture
// swaps in a stub with the same shape and nothing upstream changes.
//
// The one place the house "fail loudly" rule is deliberately suspended: audio is a nicety,
// and a browser that refuses to make a sound must never be a browser that refuses an input.
// Everything below is wrapped and swallowed on purpose.

const WIN_GAIN = 0.35;   // sits above the beeps without shouting

/**
 * @param {ArrayBuffer|null} chimeBytes the win chime, or null to run on tones alone.
 * @returns {{unlock:Function, confirm:Function, refuse:Function, win:Function}}
 */
export function createAudio(chimeBytes = null) {
  let ac = null, chime = null, pending = chimeBytes;

  /** Created on first input — browsers refuse to start a context before a gesture. */
  function context() {
    ac ??= new (globalThis.AudioContext || globalThis.webkitAudioContext)();
    if (ac.state === 'suspended') ac.resume();
    return ac;
  }

  function tone(ok) {
    const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
    o.type = ok ? 'triangle' : 'square';
    o.frequency.setValueAtTime(ok ? 520 : 190, t);
    if (!ok) o.frequency.setValueAtTime(140, t + .07);          // the downward "nope"
    g.gain.setValueAtTime(ok ? .045 : .09, t);
    g.gain.exponentialRampToValueAtTime(.0001, t + (ok ? .07 : .16));
    o.connect(g); g.connect(ac.destination);
    o.start(t); o.stop(t + (ok ? .08 : .17));
  }

  return {
    /** Call from the first user gesture: opens the context and decodes the chime early. */
    unlock() {
      try {
        context();
        if (!pending) return;
        const bytes = pending; pending = null;   // decodeAudioData detaches it — only one go
        ac.decodeAudioData(bytes).then(b => { chime = b; }, () => {});
      } catch { /* no audio in this browser; the game plays on */ }
    },
    /** A tear or shove is aimed and waiting for the second press. */
    confirm() { try { context(); tone(true); } catch { /* see above */ } },
    /** The rules said no. Fired on the flash, so the mark and the sound land together. */
    refuse() { try { context(); tone(false); } catch { /* see above */ } },
    /**
     * The room is won. FIRE AND FORGET on purpose: nothing holds a handle, so it is never
     * cancelled, never waited on, and rings straight over the hand-over into the next room.
     * Sound must never be a thing the player waits for — including a chime that has not
     * finished decoding, in which case the room hands over in silence.
     */
    win() {
      try {
        if (!chime) return;
        const src = context().createBufferSource(), g = ac.createGain();
        src.buffer = chime; g.gain.value = WIN_GAIN;
        src.connect(g); g.connect(ac.destination);
        src.start();
      } catch { /* see above */ }
    },
  };
}
