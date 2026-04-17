// Procedural engine audio. No sound files needed — the engine tone is
// generated with WebAudio from filtered noise plus low oscillators.
// Layers:
//   • thrust      — rumbly pink-noise rocket engine, throttle-driven
//   • sub drone   — low sine that sits under everything
//   • boost body  — lowpass pink noise (afterburner body / roar)
//   • boost saws  — two detuned sawtooths → chorus-like power tone
//   • boost thump — a one-shot sine pulse on the rising edge of Shift
export class EngineAudio {
  constructor({ volume = 0.55 } = {}) {
    this.targetVolume = volume;
    this.muted = false;
    this.started = false;

    this.ctx = null;
    this.master = null;

    this._throttle = 0;
    this._boost    = 0;
  }

  async start() {
    if (this.started) return { ok: true };
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return { ok: false };
      this.ctx = new Ctx();
      if (this.ctx.state === 'suspended') await this.ctx.resume();

      const master = this.ctx.createGain();
      master.gain.value = 0;
      master.connect(this.ctx.destination);
      this.master = master;

      // ---- Thrust: pink noise → resonant lowpass ----------------------------
      const thrustSrc = this.ctx.createBufferSource();
      thrustSrc.buffer = makeNoiseBuffer(this.ctx, 2.0, 'pink');
      thrustSrc.loop = true;
      const thrustFilter = this.ctx.createBiquadFilter();
      thrustFilter.type = 'lowpass';
      thrustFilter.frequency.value = 180;
      thrustFilter.Q.value = 6;
      const thrustGain = this.ctx.createGain();
      thrustGain.gain.value = 0;
      thrustSrc.connect(thrustFilter).connect(thrustGain).connect(master);
      thrustSrc.start();
      this.thrustFilter = thrustFilter;
      this.thrustGain   = thrustGain;

      // ---- Sub-drone (low sine pad) ----------------------------------------
      const drone = this.ctx.createOscillator();
      drone.type = 'sine';
      drone.frequency.value = 52;
      const droneGain = this.ctx.createGain();
      droneGain.gain.value = 0;
      drone.connect(droneGain).connect(master);
      drone.start();
      this.drone = drone;
      this.droneGain = droneGain;

      // ---- Boost body: lowpass pink noise, deep rumble ---------------------
      const boostSrc = this.ctx.createBufferSource();
      boostSrc.buffer = makeNoiseBuffer(this.ctx, 2.0, 'pink');
      boostSrc.loop = true;
      const boostFilter = this.ctx.createBiquadFilter();
      boostFilter.type = 'lowpass';
      boostFilter.frequency.value = 200;
      boostFilter.Q.value = 2.4;
      const boostGain = this.ctx.createGain();
      boostGain.gain.value = 0;
      boostSrc.connect(boostFilter).connect(boostGain).connect(master);
      boostSrc.start();
      this.boostFilter = boostFilter;
      this.boostGain   = boostGain;

      // ---- Boost saws: two detuned sawtooths → lowpass (afterburner tone) --
      const sawA = this.ctx.createOscillator();
      sawA.type = 'sawtooth';
      sawA.frequency.value = 58;
      const sawB = this.ctx.createOscillator();
      sawB.type = 'sawtooth';
      sawB.frequency.value = 58 * 1.012;
      const sawFilter = this.ctx.createBiquadFilter();
      sawFilter.type = 'lowpass';
      sawFilter.frequency.value = 520;
      sawFilter.Q.value = 1.3;
      const sawGain = this.ctx.createGain();
      sawGain.gain.value = 0;
      sawA.connect(sawFilter);
      sawB.connect(sawFilter);
      sawFilter.connect(sawGain).connect(master);
      sawA.start(); sawB.start();
      this.boostSaws      = [sawA, sawB];
      this.boostSawFilter = sawFilter;
      this.boostSawGain   = sawGain;

      // Fade master in.
      const now = this.ctx.currentTime;
      master.gain.setValueAtTime(0, now);
      master.gain.linearRampToValueAtTime(this.muted ? 0 : this.targetVolume, now + 1.2);

      this.started = true;
      return { ok: true };
    } catch (err) {
      console.warn('[EngineAudio] failed to initialize:', err);
      return { ok: false, err };
    }
  }

  // Called on the rising edge of the boost input: fires a low "thump".
  boostAttack() {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.35);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.85, now + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc.connect(g).connect(this.master);
    osc.start(now);
    osc.stop(now + 0.6);
  }

  update(dt, throttle, boosting) {
    if (!this.started || !this.ctx) return;
    const k = Math.min(1, dt * 5);
    this._throttle += (throttle - this._throttle) * k;
    this._boost    += ((boosting ? 1 : 0) - this._boost) * Math.min(1, dt * 3);

    const thr = this._throttle;
    const bst = this._boost;
    const now = this.ctx.currentTime;

    // Thrust
    this.thrustGain.gain.setTargetAtTime(0.05 + thr * 0.5, now, 0.04);
    this.thrustFilter.frequency.setTargetAtTime(170 + thr * 700 + bst * 500, now, 0.06);

    // Sub drone
    this.droneGain.gain.setTargetAtTime(thr * 0.2 + bst * 0.12, now, 0.08);
    this.drone.frequency.setTargetAtTime(46 + thr * 28 + bst * 20, now, 0.08);

    // Boost body
    this.boostGain.gain.setTargetAtTime(bst * (0.28 + thr * 0.35), now, 0.05);
    this.boostFilter.frequency.setTargetAtTime(180 + bst * 480 + thr * 140, now, 0.1);

    // Boost saws (afterburner)
    this.boostSawGain.gain.setTargetAtTime(bst * (0.08 + thr * 0.08), now, 0.08);
    this.boostSawFilter.frequency.setTargetAtTime(380 + bst * 520, now, 0.1);
    const pitch = 52 + thr * 16 + bst * 20;
    this.boostSaws[0].frequency.setTargetAtTime(pitch, now, 0.15);
    this.boostSaws[1].frequency.setTargetAtTime(pitch * 1.012, now, 0.15);
  }

  setMuted(m) {
    this.muted = m;
    if (!this.master || !this.ctx) return;
    const now = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(this.master.gain.value, now);
    this.master.gain.linearRampToValueAtTime(m ? 0 : this.targetVolume, now + 0.4);
  }
}

// --------------------------------------------------------------------------
function makeNoiseBuffer(ctx, seconds, kind = 'white') {
  const len = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  if (kind === 'pink') {
    // Paul Kellet's pink noise approximation.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.96900 * b2 + w * 0.1538520;
      b3 = 0.86650 * b3 + w * 0.3104856;
      b4 = 0.55000 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
  } else {
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return buf;
}
