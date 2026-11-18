// Synthesized sound: no audio files, everything is built with WebAudio. The
// context starts on the first user gesture (browsers block audio before that).

export function createAudio() {
  let ctx = null;
  let master = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let started = false;

  function ensure() {
    if (started) return true;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = 0.5;
      master.connect(ctx.destination);
      started = true;
      return true;
    } catch (e) { return false; }
  }

  function blip(freq, dur, type = 'sine', vol = 0.25) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(master);
    o.start(t); o.stop(t + dur);
  }

  function noise(dur, vol = 0.4, filterFreq = 1200) {
    if (!ensure()) return;
    const t = ctx.currentTime;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t);
  }

  return {
    ensure,
    get ready() { return started; },
    click() { blip(660, 0.06, 'square', 0.12); },
    pickup() { blip(880, 0.09, 'sine', 0.25); blip(1320, 0.12, 'sine', 0.2); },
    cash() { [523, 659, 784].forEach((f, i) => setTimeout(() => blip(f, 0.1, 'triangle', 0.2), i * 70)); },
    gunshot() { noise(0.14, 0.5, 900); },
    punch() { noise(0.08, 0.3, 500); },
    crash() { noise(0.3, 0.5, 400); },
    explosion() { noise(0.7, 0.7, 250); },
    mission() { [392, 523, 659].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'triangle', 0.22), i * 90)); },
    busted() { [330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.18), i * 160)); },
    // A looping engine hum whose pitch follows speed (0..1).
    engine(speed) {
      if (!ensure()) return;
      if (!engineOsc) {
        engineOsc = ctx.createOscillator();
        engineOsc.type = 'sawtooth';
        engineGain = ctx.createGain();
        engineGain.gain.value = 0.0;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = 420;
        engineOsc.connect(f); f.connect(engineGain); engineGain.connect(master);
        engineOsc.start();
      }
      engineOsc.frequency.value = 55 + speed * 130;
      engineGain.gain.value = speed > 0.02 ? 0.05 + speed * 0.06 : 0.0;
    },
    // A two-tone police siren while the wanted level is up.
    siren(on) {
      if (!ensure()) return;
      if (on && !sirenOsc) {
        sirenOsc = ctx.createOscillator();
        sirenOsc.type = 'triangle';
        sirenGain = ctx.createGain();
        sirenGain.gain.value = 0.045;
        sirenOsc.connect(sirenGain); sirenGain.connect(master);
        sirenOsc.start();
        let hi = false;
        sirenTimer = setInterval(() => { hi = !hi; sirenOsc.frequency.value = hi ? 960 : 720; }, 450);
      } else if (!on && sirenOsc) {
        clearInterval(sirenTimer);
        sirenOsc.stop();
        sirenOsc = null; sirenGain = null; sirenTimer = null;
      }
    },
  };
}
