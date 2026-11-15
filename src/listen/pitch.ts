// Pure `listen/pitch` module (SPEC §9.2): what a monophonic instrument is playing, from raw samples.
// - detectPitch: YIN (de Cheveigné & Kawahara 2002) — difference function, cumulative-mean normalisation, absolute
//   threshold, parabolic interpolation. Returns the fundamental and how clear (periodic) the frame is.
// - OnsetDetector: a note start = the level jumping well above its recent average, past a noise gate, with a lockout
//   so one note isn't counted twice. Re-attacking the same pitch counts; a held note doesn't.
// - NoteTracker: played notes from those readings — an attack, or a slur to a new pitch (what Practice counts).
// - SteadyHold: two equal MIDI frames to lock, then hold through brief unlocks; clear after real silence.
// - AdaptiveEma: display-only cents needle smoother (fast on big Δ¢, slow on wobble).
// - analysisWindow: fftSize + minHz from the instrument's concert low (or Concert defaults).
// No Web Audio here: everything takes samples, so it is tested with synthetic tones.

export interface Pitch {
  /** Fundamental frequency, Hz. */
  hz: number;
  /** 0–1: 1 = perfectly periodic. Below ~0.8 the reading is unreliable. */
  clarity: number;
}

export interface PitchOptions {
  /** YIN absolute threshold (lower = stricter). */
  threshold?: number;
  minHz?: number;
  maxHz?: number;
  /** Frames quieter than this RMS are silence. */
  gate?: number;
}

/** The level a note must pass to count as started (RMS): marked on the Listen meter. */
export const ONSET_GATE = 0.015;

/**
 * Minimum YIN clarity to accept a pitch reading (0–1). Practice needs this low enough that real notes lock
 * readily; the tuner zones are separate. Was 0.85 — too strict for the Practice flow.
 */
export const CLARITY_MIN = 0.7;

/** A level (RMS) on the Listen meter's 0–1 scale: −60 dBFS … 0 dBFS, so quiet and loud both read usefully. */
export function meterPosition(level: number): number {
  if (level <= 0) return 0;
  return Math.max(0, Math.min(1, (20 * Math.log10(level) + 60) / 60));
}

/** Root-mean-square level of a frame. */
export function rms(buf: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
  return Math.sqrt(sum / buf.length);
}

/** The fundamental of a frame, or null for silence / no clear pitch. */
export function detectPitch(buf: Float32Array, sampleRate: number, opts: PitchOptions = {}): Pitch | null {
  const { threshold = 0.12, minHz = 55, maxHz = 1600, gate = 0.01 } = opts;
  if (rms(buf) < gate) return null;
  const w = Math.floor(buf.length / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.min(w - 1, Math.ceil(sampleRate / minHz));
  if (tauMax <= tauMin) return null;

  // Difference function d(τ) and its cumulative-mean-normalised form d'(τ).
  const d = new Float32Array(tauMax + 1);
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }
  const cmnd = new Float32Array(tauMax + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    cmnd[tau] = running === 0 ? 1 : (d[tau] * tau) / running;
  }

  // The first dip under the threshold, followed down to its local minimum; else the global minimum if it is clear.
  let tau = -1;
  for (let t = tauMin; t <= tauMax; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= tauMax && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) {
    let best = tauMin;
    for (let t = tauMin + 1; t <= tauMax; t++) if (cmnd[t] < cmnd[best]) best = t;
    if (cmnd[best] > 0.35) return null; // nothing periodic enough
    tau = best;
  }

  // Parabolic interpolation around the minimum for sub-sample accuracy.
  const a = tau > 1 ? cmnd[tau - 1] : cmnd[tau];
  const b = cmnd[tau];
  const c = tau < tauMax ? cmnd[tau + 1] : cmnd[tau];
  const denom = a + c - 2 * b;
  const shift = denom !== 0 ? (a - c) / (2 * denom) : 0;
  const period = tau + Math.max(-1, Math.min(1, shift));
  return { hz: sampleRate / period, clarity: Math.max(0, Math.min(1, 1 - b)) };
}

/** A frequency as the nearest MIDI note and the cents off it (−50 … +50). */
export function hzToNote(hz: number): { midi: number; cents: number } {
  const exact = 69 + 12 * Math.log2(hz / 440);
  const midi = Math.round(exact);
  return { midi, cents: Math.round((exact - midi) * 100) };
}

/** Concert frequency of a MIDI note (A4 = 440). */
export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Exact MIDI float from a note+cents reading. */
export function toExact(midi: number, cents: number): number {
  return midi + cents / 100;
}

/** Allowed AnalyserNode fftSizes for Listen (issues/064). */
const FFT_SIZES = [512, 1024, 2048, 4096] as const;

/**
 * Analysis window for an instrument: smallest fftSize whose half-window covers one period at `concertLowMidi`,
 * or Concert defaults (2048 / 55 Hz) when `concertLowMidi` is null.
 */
export function analysisWindow(
  sampleRate: number,
  concertLowMidi: number | null,
): { fftSize: (typeof FFT_SIZES)[number]; minHz: number } {
  const minHz = concertLowMidi === null ? 55 : midiToHz(concertLowMidi);
  const need = Math.ceil(sampleRate / minHz);
  let fftSize: (typeof FFT_SIZES)[number] = 4096;
  for (const n of FFT_SIZES) {
    if (n / 2 >= need) {
      fftSize = n;
      break;
    }
  }
  return { fftSize, minHz };
}

/** Clear the held note after this long with no clear pitch (issues/062). */
export const HOLD_RELEASE_MS = 150;

/**
 * A reading must be this close to a pitch centre (¢) before it can lock / retarget. Stops a sharp/flat attack
 * locking the neighbour; the player can correct into tune and still be recognised. Off-centre frames are not
 * silence — they keep the previous hold without starting the release timer.
 */
export const LOCK_CENTS = 35;

/**
 * Two-frame MIDI lock for the first note; one in-tune frame to retarget on a pitch change (legato). Hold through
 * brief unlocks / off-centre frames. Clears only after `releaseMs` of no clear pitch.
 */
export class SteadyHold {
  private lastRaw: number | null = null;
  private held: number | null = null;
  private silentSince = -Infinity;

  constructor(
    private readonly releaseMs = HOLD_RELEASE_MS,
    private readonly lockCents = LOCK_CENTS,
  ) {}

  /**
   * The MIDI to publish this frame (null = nothing held).
   * `level` — when the mic is still sounding but pitch is unclear (legato smear), pass the RMS so we don't
   * treat it as silence and drop the hold.
   */
  push(reading: { midi: number; cents: number } | null, timeMs: number, level = 0): number | null {
    if (!reading) {
      this.lastRaw = null;
      // Still playing through a slur: keep the hold (don't start the release timer).
      if (level >= ONSET_GATE * 0.5) return this.held;
      if (this.silentSince === -Infinity) this.silentSince = timeMs;
      if (timeMs - this.silentSince >= this.releaseMs) this.held = null;
      return this.held;
    }
    this.silentSince = -Infinity;
    // Legato: new MIDI while holding — confirm on two frames, *without* the cents gate (slides are off-centre).
    if (this.held !== null && reading.midi !== this.held) {
      if (reading.midi === this.lastRaw) this.held = reading.midi;
      this.lastRaw = reading.midi;
      return this.held;
    }
    // Same pitch (or nothing held yet): off-centre frames don't lock a sharp/flat attack onto a neighbour.
    if (Math.abs(reading.cents) > this.lockCents) {
      this.lastRaw = null;
      return this.held;
    }
    // First lock: two equal in-tune frames.
    const locked = reading.midi === this.lastRaw ? reading.midi : null;
    this.lastRaw = reading.midi;
    if (locked !== null) this.held = locked;
    return this.held;
  }
}

/** Adaptive-EMA time constants for the tuner needle (issues/062). */
export const EMA_TAU_SLOW_MS = 180;
export const EMA_TAU_FAST_MS = 35;

/**
 * Display-only smoother on the exact-MIDI continuum: τ slows when |Δ¢| is small, speeds up toward `tauFastMs`
 * when the change is large (≥ ~25 ¢). Freezes across gaps; reset when the held note clears.
 */
export class AdaptiveEma {
  private y: number | null = null;
  private lastT: number | null = null;

  constructor(
    private readonly tauSlowMs = EMA_TAU_SLOW_MS,
    private readonly tauFastMs = EMA_TAU_FAST_MS,
  ) {}

  reset(): void {
    this.y = null;
    this.lastT = null;
  }

  /** Smoothed exact MIDI, or null if never fed. `exact` null = freeze. */
  push(exact: number | null, timeMs: number): number | null {
    if (exact === null) return this.y;
    if (this.y === null) {
      this.y = exact;
      this.lastT = timeMs;
      return exact;
    }
    const dt = Math.max(1, timeMs - (this.lastT ?? timeMs));
    this.lastT = timeMs;
    const deltaCents = Math.abs((exact - this.y) * 100);
    const w = Math.min(1, deltaCents / 25);
    const tau = this.tauSlowMs + (this.tauFastMs - this.tauSlowMs) * w;
    const alpha = 1 - Math.exp(-dt / tau);
    this.y += alpha * (exact - this.y);
    return this.y;
  }
}

export interface OnsetOptions {
  /** A note starts when the level rises this many times above its recent average… */
  ratio?: number;
  /** …and above this RMS. */
  gate?: number;
  /** No second onset within this many ms. */
  lockoutMs?: number;
}

/** Note starts from a stream of frame levels (feed it every frame, with the frame's time). */
export class OnsetDetector {
  private avg = 0;
  private prev = 0;
  private last = -Infinity;
  private readonly ratio: number;
  private readonly gate: number;
  private readonly lockoutMs: number;

  constructor({ ratio = 1.8, gate = ONSET_GATE, lockoutMs = 90 }: OnsetOptions = {}) {
    this.ratio = ratio;
    this.gate = gate;
    this.lockoutMs = lockoutMs;
  }

  /** True when this frame starts a note. */
  push(level: number, timeMs: number): boolean {
    // Well above the recent average, *and still rising* (so a note whose attack spans a few frames, then holds,
    // counts once — the held part isn't rising any more by the time the lockout ends).
    const rising = level > this.prev * 1.15;
    const onset = level > this.gate && rising && level > this.avg * this.ratio && timeMs - this.last >= this.lockoutMs;
    // A slow-moving average: it follows decays quickly enough that a re-attack of the same note stands out.
    this.avg = this.avg * 0.85 + level * 0.15;
    this.prev = level;
    if (onset) this.last = timeMs;
    return onset;
  }
}

/** A played-note event: from an attack, or a slur to a new pitch (what Practice counts). */
export interface NoteStart {
  midi: number;
  /** True when this start is tied to an onset (re-attack); false for a slur. */
  fromOnset: boolean;
}

/** How long a pitch must hold steady after an attack before it counts (one count per tonguing). */
export const ATTACK_STABLE_MS = 48;

/**
 * Played notes from the per-frame readings. After an onset, pitch may wobble (sharp→in-tune); only **one** note is
 * counted once it has been steady for `ATTACK_STABLE_MS` (or when the attack window ends). Later pitch changes
 * without a new onset count as slurs. A held note through a brief dropout doesn't count again.
 */
export class NoteTracker {
  private pendingSince = -Infinity;
  private current: number | null = null;
  private silentSince = -Infinity;
  private pendingMidi: number | null = null;
  private stableSince = -Infinity;
  private attackEmitted = true;

  constructor(
    private readonly windowMs = 250,
    private readonly releaseMs = 150,
    private readonly stableMs = ATTACK_STABLE_MS,
  ) {}

  /** The note that starts on this frame, or null. `midi` = the steady reading (null when unclear / silent). */
  push(midi: number | null, onset: boolean, timeMs: number): NoteStart | null {
    if (onset) {
      this.pendingSince = timeMs;
      this.attackEmitted = false;
      this.pendingMidi = null;
      this.stableSince = -Infinity;
    }

    if (midi === null) {
      if (this.silentSince === -Infinity) this.silentSince = timeMs;
      if (timeMs - this.silentSince >= this.releaseMs) {
        // Flush an unemitted attack that never settled, then clear.
        const flush = this.flushAttack(timeMs);
        this.current = null;
        return flush;
      }
      return null;
    }
    this.silentSince = -Infinity;

    const inAttack = !this.attackEmitted && timeMs - this.pendingSince <= this.windowMs;
    if (inAttack) {
      if (midi !== this.pendingMidi) {
        this.pendingMidi = midi;
        this.stableSince = timeMs;
      }
      if (this.pendingMidi !== null && timeMs - this.stableSince >= this.stableMs) {
        return this.emitAttack(this.pendingMidi);
      }
      return null;
    }

    // Attack window ended without a stable emit — count the last pitch we saw.
    if (!this.attackEmitted && this.pendingMidi !== null) {
      return this.emitAttack(this.pendingMidi);
    }

    if (midi !== this.current) {
      this.current = midi;
      return { midi, fromOnset: false };
    }
    return null;
  }

  private emitAttack(midi: number): NoteStart {
    this.attackEmitted = true;
    this.current = midi;
    this.pendingMidi = null;
    return { midi, fromOnset: true };
  }

  private flushAttack(timeMs: number): NoteStart | null {
    if (this.attackEmitted || this.pendingMidi === null) return null;
    if (timeMs - this.pendingSince > this.windowMs || timeMs - this.stableSince >= this.stableMs) {
      return this.emitAttack(this.pendingMidi);
    }
    this.attackEmitted = true;
    this.pendingMidi = null;
    return null;
  }
}
