// The game's sounds: a procedural two-tone beep for a press, and the win chime.

const WIN_GAIN = 0.35;                 // sits above the beeps without shouting

/** `AudioCtx` is the browser's AudioContext constructor. */
export function createSound(AudioCtx) {
  let ac = null;
  // A driver walks many beats and every refusal in them buzzes. Muting is the harness's
  // business rather than the audio's, so the flag lives here and the probe is what sets it.
  let muted = false;
  let winBytes = null, winBuf = null;

  /** The context, created on first input — browsers refuse to start one before a gesture. */
  function audio(){
    ac ??= new AudioCtx();
    if(ac.state === 'suspended') ac.resume();
    return ac;
  }

  /** Decode once, on first input, so the buffer is ready long before anyone wins. */
  function primeWinChime(){
    if(winBuf || !winBytes) return;
    const bytes = winBytes; winBytes = null;     // decodeAudioData detaches it — only one go
    audio().decodeAudioData(bytes).then(b => { winBuf = b; });
  }

  return {
    /** Called on every press: the first one is the gesture that unlocks audio. */
    unlock(){ audio(); primeWinChime(); },
    beep(ok){
      if(muted) return;
      try {
        audio();
        const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain();
        o.type = ok ? 'triangle' : 'square';
        o.frequency.setValueAtTime(ok ? 520 : 190, t);
        if(!ok) o.frequency.setValueAtTime(140, t + .07);
        g.gain.setValueAtTime(ok ? .045 : .09, t);
        g.gain.exponentialRampToValueAtTime(.0001, t + (ok ? .07 : .16));
        o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + (ok ? .08 : .17));
      } catch { /* audio is a nicety; never let it break input */ }
    },
    chime(){
      if(muted || !winBuf) return;
      const src = audio().createBufferSource(), g = audio().createGain();
      src.buffer = winBuf;
      g.gain.value = WIN_GAIN;
      src.connect(g); g.connect(ac.destination);
      src.start();                                 // no handle kept: it finishes on its own
    },
    mute(v){ muted = v; },
    /** The chime's undecoded bytes. */
    setChime(bytes){ winBytes = bytes; },
  };
}
