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
    this._hyper    = 0;
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

      // Impact bus — percussive one-shots (sonic-boom layers) route through a
      // compressor so stacked sub + body + rumble + crack sum into a single
      // cinematic thump instead of clipping or phase-cancelling each other.
      const impactComp = this.ctx.createDynamicsCompressor();
      impactComp.threshold.value = -16;
      impactComp.knee.value      = 22;
      impactComp.ratio.value     = 5.5;
      impactComp.attack.value    = 0.004;
      impactComp.release.value   = 0.22;
      const impactBus = this.ctx.createGain();
      impactBus.gain.value = 1.0;
      impactBus.connect(impactComp).connect(master);
      this.impactBus = impactBus;

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

      // ---- Warp layer: sustained afterburner howl + high whistle ---------
      // Only audible while hyper-active. Sub-rumble pad + a resonant
      // band-passed noise whistle that rises with the "speed tunnel" feel.
      const warpSub = this.ctx.createOscillator();
      warpSub.type = 'sawtooth';
      warpSub.frequency.value = 72;
      const warpSub2 = this.ctx.createOscillator();
      warpSub2.type = 'sawtooth';
      warpSub2.frequency.value = 72 * 1.008;
      const warpSubFilter = this.ctx.createBiquadFilter();
      warpSubFilter.type = 'lowpass';
      warpSubFilter.frequency.value = 340;
      warpSubFilter.Q.value = 3.5;
      const warpSubGain = this.ctx.createGain();
      warpSubGain.gain.value = 0;
      warpSub.connect(warpSubFilter);
      warpSub2.connect(warpSubFilter);
      warpSubFilter.connect(warpSubGain).connect(master);
      warpSub.start(); warpSub2.start();

      const warpNoiseSrc = this.ctx.createBufferSource();
      warpNoiseSrc.buffer = makeNoiseBuffer(this.ctx, 2.5, 'white');
      warpNoiseSrc.loop = true;
      const warpBand = this.ctx.createBiquadFilter();
      warpBand.type = 'bandpass';
      warpBand.frequency.value = 1800;
      warpBand.Q.value = 6;
      const warpNoiseGain = this.ctx.createGain();
      warpNoiseGain.gain.value = 0;
      warpNoiseSrc.connect(warpBand).connect(warpNoiseGain).connect(master);
      warpNoiseSrc.start();

      this.warpSubs      = [warpSub, warpSub2];
      this.warpSubFilter = warpSubFilter;
      this.warpSubGain   = warpSubGain;
      this.warpBand      = warpBand;
      this.warpNoiseGain = warpNoiseGain;

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

  // Cinematic sound-barrier break. A layered impact designed to read as
  // massive on any playback system — deep sub drop + triangle-wave body for
  // chest-punch + lowpassed pink-noise rumble for air-pressure + a short
  // bright crack on top + a delayed echo-thump for the "trailer reverb" tail.
  // All layers go through a shared compressor bus (see start()).
  hyperBreak() {
    if (!this.started || !this.ctx) return;
    const now = this.ctx.currentTime;
    const bus = this.impactBus;

    // ---- 1. Deep sub sine: the fundamental. Starts mid-low, plunges to
    // near-infrasonic so you feel it more than hear it.
    const sub = this.ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(120, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + 1.8);
    const subG = this.ctx.createGain();
    subG.gain.setValueAtTime(0.0001, now);
    subG.gain.exponentialRampToValueAtTime(1.5, now + 0.05);
    subG.gain.exponentialRampToValueAtTime(0.001, now + 2.6);
    sub.connect(subG).connect(bus);
    sub.start(now);
    sub.stop(now + 2.7);

    // ---- 2. Triangle "body" an octave above: harmonics that give the sub
    // a perceived loudness on smaller speakers that can't reproduce <40Hz.
    const body = this.ctx.createOscillator();
    body.type = 'triangle';
    body.frequency.setValueAtTime(82, now);
    body.frequency.exponentialRampToValueAtTime(34, now + 1.4);
    const bodyG = this.ctx.createGain();
    bodyG.gain.setValueAtTime(0.0001, now);
    bodyG.gain.exponentialRampToValueAtTime(0.95, now + 0.04);
    bodyG.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
    body.connect(bodyG).connect(bus);
    body.start(now);
    body.stop(now + 2.1);

    // ---- 3. Pink-noise rumble through a steep lowpass sweeping down. Reads
    // as the "pressure wave" / air displacement of the shockwave.
    const rumble = this.ctx.createBufferSource();
    rumble.buffer = makeNoiseBuffer(this.ctx, 3.0, 'pink');
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(260, now);
    lp.frequency.exponentialRampToValueAtTime(70, now + 1.8);
    lp.Q.value = 2.8;
    const rumbleG = this.ctx.createGain();
    rumbleG.gain.setValueAtTime(0.0001, now);
    rumbleG.gain.exponentialRampToValueAtTime(1.0, now + 0.08);
    rumbleG.gain.exponentialRampToValueAtTime(0.001, now + 3.0);
    rumble.connect(lp).connect(rumbleG).connect(bus);
    rumble.start(now);
    rumble.stop(now + 3.1);

    // ---- 4. The crack — short bright whip on top. Kept lower than before so
    // the bass is the hero; this is just the "edge" of the wavefront.
    const crack = this.ctx.createBufferSource();
    crack.buffer = makeNoiseBuffer(this.ctx, 0.6, 'white');
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(2400, now);
    bp.frequency.exponentialRampToValueAtTime(360, now + 0.6);
    bp.Q.value = 4.5;
    const crackG = this.ctx.createGain();
    crackG.gain.setValueAtTime(0.0001, now);
    crackG.gain.exponentialRampToValueAtTime(0.40, now + 0.015);
    crackG.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
    crack.connect(bp).connect(crackG).connect(bus);
    crack.start(now);
    crack.stop(now + 0.7);

    // ---- 5. Delayed echo thump — a second sub hit 220ms later. Gives the
    // impression of a huge room / canyon reverb without actually using one.
    const echoStart = now + 0.22;
    const echo = this.ctx.createOscillator();
    echo.type = 'sine';
    echo.frequency.setValueAtTime(58, echoStart);
    echo.frequency.exponentialRampToValueAtTime(20, echoStart + 1.4);
    const echoG = this.ctx.createGain();
    echoG.gain.setValueAtTime(0.0001, echoStart);
    echoG.gain.exponentialRampToValueAtTime(0.65, echoStart + 0.05);
    echoG.gain.exponentialRampToValueAtTime(0.001, echoStart + 1.6);
    echo.connect(echoG).connect(bus);
    echo.start(echoStart);
    echo.stop(echoStart + 1.7);
  }

  update(dt, throttle, boosting, hyper = false) {
    if (!this.started || !this.ctx) return;
    const k = Math.min(1, dt * 5);
    this._throttle += (throttle - this._throttle) * k;
    this._boost    += ((boosting ? 1 : 0) - this._boost) * Math.min(1, dt * 3);
    this._hyper    += ((hyper    ? 1 : 0) - this._hyper) * Math.min(1, dt * 2.2);

    const thr = this._throttle;
    const bst = this._boost;
    const hyp = this._hyper;
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

    // Warp layer — silent unless hyper-active.
    this.warpSubGain.gain.setTargetAtTime(hyp * 0.20, now, 0.18);
    this.warpSubFilter.frequency.setTargetAtTime(260 + hyp * 380, now, 0.2);
    const warpPitch = 64 + hyp * 22;
    this.warpSubs[0].frequency.setTargetAtTime(warpPitch, now, 0.2);
    this.warpSubs[1].frequency.setTargetAtTime(warpPitch * 1.008, now, 0.2);
    this.warpNoiseGain.gain.setTargetAtTime(hyp * 0.12, now, 0.2);
    this.warpBand.frequency.setTargetAtTime(1400 + hyp * 2200, now, 0.2);
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
