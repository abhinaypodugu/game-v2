// Procedural WebAudio sound effects — no audio files. Every effect is built
// from oscillators and a shared white-noise buffer, routed through one master
// gain and a light compressor so overlapping effects never clip.
//
// Browsers only allow audio after a user gesture, so the AudioContext is
// created (or resumed) on the first pointerdown/keydown. Before that, and in
// environments without WebAudio (SSR, happy-dom), every call is a no-op.

const MUTE_KEY = 'lc.muted';
const MASTER_VOLUME = 0.55;
/** Max simultaneously sounding source nodes; new effects are dropped past it. */
const MAX_VOICES = 32;
const SILENT = 0.0001;

interface WindowWithWebkitAudio extends Window {
  webkitAudioContext?: typeof AudioContext;
}

interface ToneOptions {
  type?: OscillatorType;
  /** Start offset in seconds from now. */
  at?: number;
  freq: number;
  /** Glide target frequency, reached at the end of the note. */
  freqEnd?: number;
  attack?: number;
  decay: number;
  gain: number;
  /** Optional lowpass cutoff for softening harsh waveforms. */
  lowpass?: number;
}

interface NoiseOptions {
  at?: number;
  attack?: number;
  decay: number;
  gain: number;
  filter: BiquadFilterType;
  freq: number;
  /** Filter sweep target, reached at the end of the burst. */
  freqEnd?: number;
  q?: number;
}

function readMuted(): boolean {
  try {
    return typeof localStorage !== 'undefined' && localStorage.getItem(MUTE_KEY) === '1';
  } catch {
    return false;
  }
}

function audioContextCtor(): typeof AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (typeof AudioContext !== 'undefined') return AudioContext;
  return (window as WindowWithWebkitAudio).webkitAudioContext ?? null;
}

class SoundEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted = readMuted();
  private unlocked = false;
  private voices = 0;

  constructor() {
    if (typeof window === 'undefined' || audioContextCtor() === null) return;
    const unlock = (): void => {
      this.unlocked = true;
      this.ensureContext();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    try {
      localStorage.setItem(MUTE_KEY, muted ? '1' : '0');
    } catch {
      // Storage unavailable (private mode) — mute still applies for this session.
    }
    if (this.master !== null && this.ctx !== null) {
      this.master.gain.setTargetAtTime(muted ? 0 : MASTER_VOLUME, this.ctx.currentTime, 0.02);
    }
  }

  isMuted(): boolean {
    return this.muted;
  }

  // --- Effects -------------------------------------------------------------

  /** Wooden dice rattling in a cup, then two clacks as they land. */
  dice(): void {
    this.play(() => {
      let t = 0;
      for (let i = 0; i < 7; i++) {
        t += 0.035 + Math.random() * 0.03;
        this.noise({ at: t, decay: 0.03, gain: 0.22, filter: 'bandpass', freq: 1800 + Math.random() * 1600, q: 3 });
        this.tone({ type: 'triangle', at: t, freq: 520 + Math.random() * 380, decay: 0.035, gain: 0.08 });
      }
      for (const [i, land] of [t + 0.1, t + 0.16].entries()) {
        this.noise({ at: land, decay: 0.05, gain: 0.35, filter: 'bandpass', freq: 1400 - i * 200, q: 2 });
        this.tone({ type: 'triangle', at: land, freq: 320 - i * 40, freqEnd: 140, decay: 0.09, gain: 0.3 });
      }
    });
  }

  /** Soft wooden thock — settlement placement. */
  place(): void {
    this.play(() => {
      this.tone({ type: 'sine', freq: 230, freqEnd: 105, decay: 0.16, gain: 0.5 });
      this.tone({ type: 'triangle', freq: 680, freqEnd: 420, decay: 0.04, gain: 0.14 });
      this.noise({ decay: 0.025, gain: 0.2, filter: 'lowpass', freq: 1400 });
    });
  }

  /** Lighter, snappier click — road placement. */
  road(): void {
    this.play(() => {
      this.tone({ type: 'triangle', freq: 950, freqEnd: 520, decay: 0.045, gain: 0.18 });
      this.tone({ type: 'sine', freq: 340, freqEnd: 220, decay: 0.07, gain: 0.25 });
      this.noise({ decay: 0.015, gain: 0.12, filter: 'highpass', freq: 2800 });
    });
  }

  /** Deeper double thunk — city upgrade. */
  city(): void {
    this.play(() => {
      for (const [i, at] of [0, 0.12].entries()) {
        this.tone({ type: 'sine', at, freq: 170 - i * 30, freqEnd: 62, decay: 0.2, gain: 0.55 });
        this.tone({ type: 'triangle', at, freq: 520 - i * 80, freqEnd: 300, decay: 0.05, gain: 0.12 });
        this.noise({ at, decay: 0.04, gain: 0.22, filter: 'lowpass', freq: 900 });
      }
    });
  }

  /** Paper swish — card gained or dealt. */
  card(): void {
    this.play(() => {
      this.noise({ attack: 0.025, decay: 0.11, gain: 0.3, filter: 'bandpass', freq: 1400, freqEnd: 5200, q: 1.2 });
      this.noise({ at: 0.05, decay: 0.05, gain: 0.08, filter: 'highpass', freq: 6000 });
    });
  }

  /** Bright two-note ping — trade offer. */
  trade(): void {
    this.play(() => {
      for (const [i, freq] of [880, 1318.5].entries()) {
        const at = i * 0.1;
        this.tone({ type: 'sine', at, freq, attack: 0.005, decay: 0.28, gain: 0.24 });
        this.tone({ type: 'triangle', at, freq: freq * 2, attack: 0.005, decay: 0.12, gain: 0.05 });
      }
    });
  }

  /** Pleasant rising chime — your turn. */
  turn(): void {
    this.play(() => {
      for (const [i, freq] of [523.25, 659.25, 783.99].entries()) {
        const at = i * 0.09;
        this.tone({ type: 'sine', at, freq, attack: 0.008, decay: 0.7, gain: 0.2 });
        this.tone({ type: 'sine', at, freq: freq * 3, attack: 0.004, decay: 0.25, gain: 0.03 });
      }
    });
  }

  /** Low ominous swell — robber moved. */
  robber(): void {
    this.play(() => {
      this.tone({ type: 'sawtooth', freq: 110, freqEnd: 78, attack: 0.08, decay: 0.75, gain: 0.22, lowpass: 420 });
      this.tone({ type: 'sawtooth', freq: 116.5, freqEnd: 82, attack: 0.08, decay: 0.75, gain: 0.14, lowpass: 380 });
      this.tone({ type: 'sine', freq: 55, attack: 0.05, decay: 0.8, gain: 0.35 });
      this.noise({ decay: 0.06, gain: 0.2, filter: 'lowpass', freq: 500 });
    });
  }

  /** Quick downward swipe — card stolen. */
  steal(): void {
    this.play(() => {
      this.noise({ attack: 0.01, decay: 0.16, gain: 0.32, filter: 'bandpass', freq: 4200, freqEnd: 700, q: 1.5 });
      this.tone({ type: 'sine', freq: 720, freqEnd: 260, attack: 0.005, decay: 0.16, gain: 0.14 });
    });
  }

  /** Short fanfare arpeggio resolving on a held chord — victory. */
  victory(): void {
    this.play(() => {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      for (const [i, freq] of notes.entries()) {
        const at = i * 0.11;
        this.tone({ type: 'triangle', at, freq, attack: 0.01, decay: 0.22, gain: 0.22 });
        this.tone({ type: 'sine', at, freq: freq * 2, attack: 0.01, decay: 0.12, gain: 0.05 });
      }
      const chordAt = notes.length * 0.11 + 0.04;
      for (const freq of notes) {
        this.tone({ type: 'triangle', at: chordAt, freq, attack: 0.02, decay: 1.1, gain: 0.13 });
      }
      this.tone({ type: 'sine', at: chordAt, freq: 261.63, attack: 0.02, decay: 1.1, gain: 0.2 });
    });
  }

  /** Soft low buzz — rejected action. */
  error(): void {
    this.play(() => {
      for (const at of [0, 0.11]) {
        this.tone({ type: 'square', at, freq: 150, attack: 0.005, decay: 0.08, gain: 0.1, lowpass: 700 });
      }
    });
  }

  /** Subtle UI tick. */
  click(): void {
    this.play(() => {
      this.tone({ type: 'sine', freq: 1250, freqEnd: 880, attack: 0.002, decay: 0.035, gain: 0.12 });
    });
  }

  /** Magical shimmer — development card bought or played. */
  devCard(): void {
    this.play(() => {
      for (const [i, freq] of [1567.98, 2093, 2637.02, 3135.96, 2349.32].entries()) {
        this.tone({ type: 'sine', at: i * 0.045, freq, attack: 0.01, decay: 0.45, gain: 0.07 });
      }
      this.noise({ attack: 0.05, decay: 0.3, gain: 0.07, filter: 'highpass', freq: 5000, freqEnd: 9000 });
      this.tone({ type: 'triangle', freq: 784, attack: 0.01, decay: 0.3, gain: 0.08 });
    });
  }

  // --- Plumbing ------------------------------------------------------------

  private ensureContext(): AudioContext | null {
    if (!this.unlocked) return null;
    if (this.ctx === null) {
      const Ctor = audioContextCtor();
      if (Ctor === null) return null;
      try {
        const ctx = new Ctor();
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.knee.value = 12;
        compressor.ratio.value = 4;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.2;
        compressor.connect(ctx.destination);
        const master = ctx.createGain();
        master.gain.value = this.muted ? 0 : MASTER_VOLUME;
        master.connect(compressor);
        this.ctx = ctx;
        this.master = master;
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => undefined);
    return this.ctx;
  }

  /** Runs an effect builder if audio is available, audible and under the voice cap. */
  private play(build: () => void): void {
    if (this.muted || this.voices >= MAX_VOICES) return;
    if (this.ensureContext() === null) return;
    try {
      build();
    } catch {
      // A failed node graph must never break gameplay.
    }
  }

  private track(source: AudioScheduledSourceNode, start: number, end: number): void {
    this.voices++;
    source.onended = () => {
      this.voices--;
      source.disconnect();
    };
    source.start(start);
    source.stop(end);
  }

  private envelope(ctx: AudioContext, t0: number, attack: number, decay: number, peak: number): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(SILENT, t0);
    g.gain.linearRampToValueAtTime(peak, t0 + attack);
    g.gain.exponentialRampToValueAtTime(SILENT, t0 + attack + decay);
    return g;
  }

  private tone(o: ToneOptions): void {
    const ctx = this.ctx;
    const master = this.master;
    if (ctx === null || master === null) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const attack = o.attack ?? 0.003;
    const end = t0 + attack + o.decay + 0.02;
    const osc = ctx.createOscillator();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.freqEnd !== undefined) osc.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + attack + o.decay);
    const env = this.envelope(ctx, t0, attack, o.decay, o.gain);
    if (o.lowpass !== undefined) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = o.lowpass;
      osc.connect(lp).connect(env);
    } else {
      osc.connect(env);
    }
    env.connect(master);
    this.track(osc, t0, end);
  }

  private noise(o: NoiseOptions): void {
    const ctx = this.ctx;
    const master = this.master;
    if (ctx === null || master === null) return;
    const t0 = ctx.currentTime + (o.at ?? 0);
    const attack = o.attack ?? 0.002;
    const end = t0 + attack + o.decay + 0.02;
    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    // Random read offset so repeated bursts don't sound identical.
    const offset = Math.random() * 0.5;
    const filter = ctx.createBiquadFilter();
    filter.type = o.filter;
    filter.Q.value = o.q ?? 0.8;
    filter.frequency.setValueAtTime(o.freq, t0);
    if (o.freqEnd !== undefined) filter.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + attack + o.decay);
    const env = this.envelope(ctx, t0, attack, o.decay, o.gain);
    src.connect(filter).connect(env).connect(master);
    this.voices++;
    src.onended = () => {
      this.voices--;
      src.disconnect();
    };
    src.start(t0, offset);
    src.stop(end);
  }

  private getNoise(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer === null) {
      const length = ctx.sampleRate; // 1 second
      const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }
}

const engine = new SoundEngine();

export const sounds = {
  dice: (): void => engine.dice(),
  place: (): void => engine.place(),
  road: (): void => engine.road(),
  city: (): void => engine.city(),
  card: (): void => engine.card(),
  trade: (): void => engine.trade(),
  turn: (): void => engine.turn(),
  robber: (): void => engine.robber(),
  steal: (): void => engine.steal(),
  victory: (): void => engine.victory(),
  error: (): void => engine.error(),
  click: (): void => engine.click(),
  devCard: (): void => engine.devCard(),
  setMuted: (muted: boolean): void => engine.setMuted(muted),
  isMuted: (): boolean => engine.isMuted(),
};
