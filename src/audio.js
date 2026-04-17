// Plays the Helios.mp3 background track with a slow fade-in and
// graceful handling if the file is missing.
export class CosmicAudio {
  constructor({ src = './Helios.mp3', volume = 0.7 } = {}) {
    this.src = src;
    this.targetVolume = volume;
    this.audio = null;
    this.started = false;
    this.muted = false;
    this.fadeRaf = 0;
  }

  async start() {
    if (this.started) return { ok: true };
    const audio = new Audio(this.src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0.0;
    this.audio = audio;
    try {
      await audio.play();
      this.started = true;
      this._fadeTo(this.targetVolume, 3200);
      return { ok: true };
    } catch (err) {
      console.warn(
        '[Helios] Could not play audio. Drop `Helios.mp3` into the project root ' +
        '(alongside index.html) and serve over http:// — not file://. Detail:',
        err,
      );
      return { ok: false, err };
    }
  }

  _fadeTo(target, durationMs) {
    cancelAnimationFrame(this.fadeRaf);
    const audio = this.audio;
    if (!audio) return;
    const start = performance.now();
    const from = audio.volume;
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / durationMs);
      audio.volume = this.muted ? 0 : from + (target - from) * t;
      if (t < 1) this.fadeRaf = requestAnimationFrame(step);
    };
    step();
  }

  setMuted(m) {
    this.muted = m;
    if (!this.audio) return;
    if (m) {
      this._fadeTo(0, 400);
    } else {
      this._fadeTo(this.targetVolume, 800);
    }
  }

  // A tiny duck on strong events (e.g. boosting) — optional flavor.
  duck() {
    if (!this.audio || this.muted) return;
    const orig = this.targetVolume;
    this._fadeTo(orig * 0.6, 200);
    setTimeout(() => { if (!this.muted) this._fadeTo(orig, 900); }, 260);
  }
}
