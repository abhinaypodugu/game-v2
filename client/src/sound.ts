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

  /** Grand opening fanfare when the game commences. */
  gameStart(): void {
    this.play(() => {
      const notes = [261.63, 329.63, 392.0, 523.25];
      for (const [i, freq] of notes.entries()) {
        const at = i * 0.12;
        this.tone({ type: 'triangle', at, freq, attack: 0.015, decay: 0.35, gain: 0.28 });
        this.tone({ type: 'sine', at, freq: freq * 2, attack: 0.01, decay: 0.25, gain: 0.1 });
        this.tone({ type: 'sawtooth', at, freq, attack: 0.02, decay: 0.2, gain: 0.06, lowpass: 1200 });
      }
      const chordAt = notes.length * 0.12 + 0.02;
      for (const freq of [261.63, 329.63, 392.0, 523.25]) {
        this.tone({ type: 'triangle', at: chordAt, freq, attack: 0.02, decay: 1.4, gain: 0.16 });
      }
      this.tone({ type: 'sine', at: chordAt, freq: 130.81, attack: 0.02, decay: 1.5, gain: 0.3 });
      this.noise({ at: chordAt, attack: 0.01, decay: 0.15, gain: 0.1, filter: 'lowpass', freq: 800 });
    });
  }

  /** Coin clink + cheerful major chime — successful trade. */
  tradeDone(): void {
    this.play(() => {
      for (const [i, at] of [0, 0.08].entries()) {
        this.tone({ type: 'sine', at, freq: 2400 + i * 400, attack: 0.001, decay: 0.08, gain: 0.2 });
        this.noise({ at, attack: 0.001, decay: 0.04, gain: 0.18, filter: 'bandpass', freq: 4800, q: 6 });
      }
      for (const [i, freq] of [523.25, 659.25, 783.99].entries()) {
        this.tone({ type: 'sine', at: 0.12 + i * 0.06, freq, attack: 0.005, decay: 0.45, gain: 0.18 });
      }
    });
  }

  /** Dramatic warning alert — forced discard on 7. */
  discardAlert(): void {
    this.play(() => {
      for (const [i, at] of [0, 0.14].entries()) {
        this.tone({ type: 'sawtooth', at, freq: 240 - i * 40, freqEnd: 150, attack: 0.02, decay: 0.22, gain: 0.2, lowpass: 500 });
        this.tone({ type: 'sine', at, freq: 120 - i * 20, decay: 0.25, gain: 0.25 });
        this.noise({ at, decay: 0.08, gain: 0.15, filter: 'lowpass', freq: 700 });
      }
    });
  }

  /** Spirited bugle fanfare — Longest Road claimed! */
  longestRoad(): void {
    this.play(() => {
      const notes = [392.0, 523.25, 659.25, 783.99];
      for (const [i, freq] of notes.entries()) {
        const at = i * 0.1;
        this.tone({ type: 'triangle', at, freq, attack: 0.01, decay: 0.28, gain: 0.24 });
        this.tone({ type: 'sawtooth', at, freq, attack: 0.02, decay: 0.2, gain: 0.06, lowpass: 1400 });
      }
    });
  }

  /** Martial brass cadence — Largest Army claimed! */
  largestArmy(): void {
    this.play(() => {
      const notes = [293.66, 369.99, 440.0, 587.33];
      for (const [i, freq] of notes.entries()) {
        const at = i * 0.11;
        this.tone({ type: 'triangle', at, freq, attack: 0.012, decay: 0.3, gain: 0.25 });
        this.tone({ type: 'square', at, freq, attack: 0.015, decay: 0.18, gain: 0.07, lowpass: 1100 });
      }
    });
  }

  /** Clock tick-tock pulse — turn timer running out. */
  timerTick(): void {
    this.play(() => {
      this.tone({ type: 'sine', freq: 880, freqEnd: 440, attack: 0.002, decay: 0.035, gain: 0.16 });
      this.noise({ attack: 0.001, decay: 0.02, gain: 0.1, filter: 'bandpass', freq: 3200, q: 4 });
    });
  }

  /** Soft friendly bubble pop — player joins room / clicks ready. */
  lobbyJoin(): void {
    this.play(() => {
      this.tone({ type: 'sine', freq: 440, freqEnd: 880, attack: 0.005, decay: 0.09, gain: 0.18 });
    });
  }

  /** Gold scales balancing & coins clinking — Merchant 2:1 trade activated. */
  merchant(): void {
    this.play(() => {
      const freqs = [1760, 2200, 2637, 3520];
      for (const [i, freq] of freqs.entries()) {
        const at = i * 0.06;
        this.tone({ type: 'sine', at, freq, attack: 0.002, decay: 0.18, gain: 0.18 });
        this.tone({ type: 'triangle', at, freq: freq * 1.5, attack: 0.002, decay: 0.08, gain: 0.08 });
      }
      const chordAt = freqs.length * 0.06 + 0.02;
      for (const freq of [523.25, 659.25, 783.99, 1046.5]) {
        this.tone({ type: 'triangle', at: chordAt, freq, attack: 0.01, decay: 0.5, gain: 0.12 });
      }
    });
  }

  /** Quick swooping pocket pick & coin purse jingle — Tax Collector. */
  taxCollector(): void {
    this.play(() => {
      this.noise({ attack: 0.01, decay: 0.12, gain: 0.28, filter: 'bandpass', freq: 3500, freqEnd: 1200, q: 2 });
      for (let i = 0; i < 3; i++) {
        const at = 0.07 + i * 0.05;
        const freq = 2000 + i * 400;
        this.tone({ type: 'sine', at, freq, attack: 0.002, decay: 0.14, gain: 0.16 });
        this.tone({ type: 'sine', at: at + 0.01, freq: freq * 1.25, attack: 0.002, decay: 0.1, gain: 0.1 });
      }
    });
  }

  /** Lush agrarian major chord with wind rustling — Bountiful Harvest. */
  bountifulHarvest(): void {
    this.play(() => {
      this.noise({ attack: 0.03, decay: 0.45, gain: 0.12, filter: 'bandpass', freq: 1200, freqEnd: 800, q: 1 });
      const notes = [329.63, 440, 554.37, 659.25, 880];
      for (const [i, freq] of notes.entries()) {
        const at = i * 0.08;
        this.tone({ type: 'triangle', at, freq, attack: 0.01, decay: 0.6, gain: 0.18 });
        this.tone({ type: 'sine', at, freq: freq * 2, attack: 0.005, decay: 0.3, gain: 0.07 });
      }
    });
  }

  /** Bubbling potion transmuting with magical shimmer — The Alchemist. */
  alchemist(): void {
    this.play(() => {
      const bubbleFreqs = [260, 340, 420, 520, 680];
      for (const [i, freq] of bubbleFreqs.entries()) {
        const at = i * 0.05;
        this.tone({ type: 'sine', at, freq, freqEnd: freq * 1.4, attack: 0.005, decay: 0.08, gain: 0.18 });
      }
      const shimmerAt = bubbleFreqs.length * 0.05 + 0.02;
      for (const [i, freq] of [1318.5, 1760, 2093, 2637, 3136].entries()) {
        this.tone({ type: 'sine', at: shimmerAt + i * 0.03, freq, attack: 0.005, decay: 0.4, gain: 0.08 });
      }
      this.noise({ at: shimmerAt, attack: 0.02, decay: 0.35, gain: 0.09, filter: 'highpass', freq: 4000 });
    });
  }

  /** Stone sliding friction and crisp placement clacks — The Surveyor. */
  surveyor(): void {
    this.play(() => {
      this.noise({ attack: 0.02, decay: 0.22, gain: 0.35, filter: 'bandpass', freq: 600, freqEnd: 300, q: 2 });
      this.tone({ type: 'sawtooth', freq: 140, freqEnd: 90, attack: 0.02, decay: 0.2, gain: 0.12, lowpass: 350 });
      for (const at of [0.18, 0.32]) {
        this.tone({ type: 'sine', at, freq: 880, freqEnd: 440, attack: 0.002, decay: 0.04, gain: 0.22 });
        this.noise({ at, attack: 0.002, decay: 0.03, gain: 0.2, filter: 'highpass', freq: 2500 });
      }
    });
  }

  /** Heavy castle portcullis slam & defensive barrier hum — Fortification. */
  fortification(): void {
    this.play(() => {
      this.tone({ type: 'sine', freq: 70, freqEnd: 35, attack: 0.01, decay: 0.45, gain: 0.4 });
      this.noise({ attack: 0.005, decay: 0.2, gain: 0.3, filter: 'lowpass', freq: 400 });
      this.tone({ type: 'triangle', freq: 440, freqEnd: 180, attack: 0.005, decay: 0.35, gain: 0.25 });
      this.tone({ type: 'square', freq: 220, freqEnd: 110, attack: 0.01, decay: 0.3, gain: 0.15, lowpass: 600 });
      const humAt = 0.18;
      this.tone({ type: 'sine', at: humAt, freq: 587.33, freqEnd: 880, attack: 0.03, decay: 0.8, gain: 0.16 });
      this.tone({ type: 'sine', at: humAt, freq: 880, attack: 0.03, decay: 0.8, gain: 0.1 });
    });
  }

  /** Stealth whisper sweep and secret magnifying glass ping — The Spy. */
  spy(): void {
    this.play(() => {
      this.noise({ attack: 0.02, decay: 0.3, gain: 0.22, filter: 'bandpass', freq: 2800, freqEnd: 1200, q: 3 });
      for (const [i, freq] of [1567.98, 2349.32].entries()) {
        const at = 0.12 + i * 0.08;
        this.tone({ type: 'sine', at, freq, attack: 0.003, decay: 0.2, gain: 0.16 });
        this.tone({ type: 'triangle', at, freq: freq * 0.5, attack: 0.003, decay: 0.12, gain: 0.06 });
      }
    });
  }

  /** Ethereal crystalline divination chimes — The Oracle. */
  oracle(): void {
    this.play(() => {
      const crystalNotes = [1046.5, 1318.51, 1567.98, 2093.0, 2637.02];
      for (const [i, freq] of crystalNotes.entries()) {
        const at = i * 0.07;
        this.tone({ type: 'sine', at, freq, attack: 0.008, decay: 0.7, gain: 0.14 });
        this.tone({ type: 'sine', at, freq: freq * 2, attack: 0.004, decay: 0.35, gain: 0.04 });
      }
      this.noise({ attack: 0.05, decay: 0.5, gain: 0.06, filter: 'highpass', freq: 6000 });
    });
  }

  /** Maritime ship's bell and sea wave wash — Port Renovation. */
  portRenovation(): void {
    this.play(() => {
      this.noise({ attack: 0.08, decay: 0.6, gain: 0.25, filter: 'lowpass', freq: 500, freqEnd: 200 });
      for (const strike of [0.08, 0.28]) {
        this.tone({ type: 'sine', at: strike, freq: 1174.66, attack: 0.003, decay: 0.6, gain: 0.2 });
        this.tone({ type: 'sine', at: strike, freq: 1180, attack: 0.003, decay: 0.6, gain: 0.15 });
        this.tone({ type: 'triangle', at: strike, freq: 2349.32, attack: 0.003, decay: 0.25, gain: 0.07 });
      }
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
  tradeDone: (): void => engine.tradeDone(),
  turn: (): void => engine.turn(),
  robber: (): void => engine.robber(),
  steal: (): void => engine.steal(),
  victory: (): void => engine.victory(),
  error: (): void => engine.error(),
  click: (): void => engine.click(),
  devCard: (): void => engine.devCard(),
  gameStart: (): void => engine.gameStart(),
  discardAlert: (): void => engine.discardAlert(),
  longestRoad: (): void => engine.longestRoad(),
  largestArmy: (): void => engine.largestArmy(),
  timerTick: (): void => engine.timerTick(),
  lobbyJoin: (): void => engine.lobbyJoin(),
  merchant: (): void => engine.merchant(),
  taxCollector: (): void => engine.taxCollector(),
  bountifulHarvest: (): void => engine.bountifulHarvest(),
  alchemist: (): void => engine.alchemist(),
  surveyor: (): void => engine.surveyor(),
  fortification: (): void => engine.fortification(),
  spy: (): void => engine.spy(),
  oracle: (): void => engine.oracle(),
  portRenovation: (): void => engine.portRenovation(),
  setMuted: (muted: boolean): void => engine.setMuted(muted),
  isMuted: (): boolean => engine.isMuted(),
};
