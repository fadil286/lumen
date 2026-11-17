// All sound is synthesized with WebAudio: no audio files, no network, nothing to
// load. The context is created on the first user gesture (browsers demand that),
// and every call is a no-op until then, so the screenshot staging stays silent.
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;

  function unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.22;
      master.connect(ctx.destination);
    } catch {
      ctx = null;
    }
  }

  function tone(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    try {
      const t0 = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t0 + dur);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(gain);
      gain.connect(master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch {
      // Sound is garnish: a failure here must never break the game.
    }
  }

  function chord(freqs, dur, type, vol) {
    for (const f of freqs) tone(f, dur, type, vol);
  }

  return {
    unlock,
    setMuted(value) {
      muted = value;
    },
    get muted() {
      return muted;
    },
    // Pickup pitch climbs with the combo: the streak is audible.
    pickup(combo) {
      const step = Math.min(combo, 12);
      tone(523 * Math.pow(2, step / 12), 0.16, 'sine', 0.5);
      tone(1046 * Math.pow(2, step / 12), 0.1, 'sine', 0.18);
    },
    hit() {
      tone(160, 0.22, 'sawtooth', 0.5, 55);
      tone(90, 0.25, 'square', 0.3, 40);
    },
    dash() {
      tone(280, 0.16, 'sine', 0.35, 980);
    },
    wave() {
      chord([659, 988], 0.28, 'triangle', 0.3);
    },
    flare() {
      chord([523, 659, 784, 1046], 0.4, 'triangle', 0.3);
    },
    shield() {
      chord([392, 587], 0.3, 'sine', 0.35);
    },
    over() {
      tone(392, 0.3, 'triangle', 0.4, 370);
      setTimeout(() => tone(311, 0.35, 'triangle', 0.4, 294), 180);
      setTimeout(() => tone(233, 0.6, 'triangle', 0.4, 196), 380);
    },
    start() {
      chord([523, 784], 0.22, 'triangle', 0.3);
    },
  };
}
