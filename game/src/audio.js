// Sound, all synthesized with WebAudio: no audio files. Engine hum follows the car's speed,
// the siren wails in two tones, gunshots are noise bursts, and a small bass-and-hat loop plays
// as music. Everything starts on the first user gesture, and M mutes.

export function createAudio() {
  let ctx = null;
  let master = null;
  let musicGain = null;
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenTimer = null;
  let musicTimer = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (ctx) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch {
      return;
    }
    master = ctx.createGain();
    master.gain.value = 0.5;
    master.connect(ctx.destination);
    // Engine: a sawtooth whose pitch follows speed, through a low-pass filter.
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 60;
    const engineFilter = ctx.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 420;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    // Siren: a triangle that alternates between two notes.
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'triangle';
    sirenOsc.frequency.value = 700;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
    // Music: a bass note and a hat every eighth, at 112 bpm.
    musicGain = ctx.createGain();
    musicGain.gain.value = 0.16;
    musicGain.connect(master);
    const bassNotes = [55, 55, 65.4, 49];
    let beat = 0;
    musicTimer = setInterval(() => {
      if (!ctx || muted) return;
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = bassNotes[Math.floor(beat / 2) % bassNotes.length];
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
      osc.connect(g);
      g.connect(musicGain);
      osc.start(t);
      osc.stop(t + 0.25);
      if (beat % 2 === 1) {
        const noise = ctx.createBufferSource();
        noise.buffer = noiseBuffer();
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 6000;
        const ng = ctx.createGain();
        ng.gain.setValueAtTime(0.12, t);
        ng.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        noise.connect(hp);
        hp.connect(ng);
        ng.connect(musicGain);
        noise.start(t);
        noise.stop(t + 0.06);
      }
      beat += 1;
    }, 268);
    started = true;
  }

  let noiseBuf = null;
  function noiseBuffer() {
    if (noiseBuf) return noiseBuf;
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return noiseBuf;
  }

  function blip(freq, dur, type, vol, slideTo) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(master);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noiseHit(dur, vol, filterFreq) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = filterFreq || 3000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(filter);
    filter.connect(g);
    g.connect(master);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  return {
    /** Call from the first click or keypress: browsers need a gesture before sound. */
    unlock() {
      ensure();
      if (ctx && ctx.state === 'suspended') ctx.resume();
    },
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : 0.5;
      return muted;
    },
    shot() {
      noiseHit(0.12, 0.5, 4500);
      blip(180, 0.08, 'square', 0.2, 60);
    },
    enemyShot() {
      noiseHit(0.1, 0.25, 3500);
    },
    click() {
      blip(1200, 0.05, 'square', 0.15);
    },
    pickup() {
      blip(660, 0.09, 'sine', 0.3);
      setTimeout(() => blip(990, 0.12, 'sine', 0.3), 90);
    },
    objective() {
      blip(520, 0.12, 'sine', 0.3);
      setTimeout(() => blip(780, 0.16, 'sine', 0.3), 120);
    },
    mission() {
      [440, 554, 659, 880].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.3), i * 110));
    },
    win() {
      [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'triangle', 0.3), i * 100));
    },
    fail() {
      [400, 350, 300, 220].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'sawtooth', 0.2), i * 130));
    },
    crash() {
      noiseHit(0.25, 0.5, 1200);
    },
    explosion() {
      noiseHit(0.7, 0.8, 800);
      blip(90, 0.6, 'sine', 0.5, 30);
    },
    horn() {
      blip(370, 0.25, 'square', 0.2);
      blip(466, 0.25, 'square', 0.15);
    },
    siren() {
      if (!ctx) return;
      sirenGain.gain.value = 0.05;
      if (sirenTimer) return;
      let high = false;
      sirenTimer = setInterval(() => {
        if (!ctx) return;
        high = !high;
        sirenOsc.frequency.value = high ? 950 : 700;
      }, 380);
    },
    sirenOff() {
      if (sirenGain) sirenGain.gain.value = 0;
    },
    /** Called every frame: engine pitch from the player's car speed, siren off when clean. */
    update(dt, world) {
      if (!ctx || muted) return;
      const car = world.player.car;
      const speed = car ? Math.abs(car.speed) : 0;
      engineGain.gain.setTargetAtTime(car ? 0.05 + Math.min(0.1, speed * 0.003) : 0, ctx.currentTime, 0.1);
      engineOsc.frequency.setTargetAtTime(55 + speed * 3.2, ctx.currentTime, 0.08);
      if (world.police.stars === 0 && sirenGain.gain.value > 0) {
        sirenGain.gain.value = 0;
      }
    },
    get started() {
      return started;
    },
  };
}
