// Pure `listen/pitch` module (SPEC §9.2, prototype): what a monophonic instrument is playing, from raw samples.
// - detectPitch: YIN (de Cheveigné & Kawahara 2002) — difference function, cumulative-mean normalisation, absolute
//   threshold, parabolic interpolation. Returns the fundamental and how clear (periodic) the frame is.
// - OnsetDetector: a note start = the level jumping well above its recent average, past a noise gate, with a lockout
//   so one note isn't counted twice. Re-attacking the same pitch counts; a held note doesn't.
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

  constructor({ ratio = 1.8, gate = 0.015, lockoutMs = 90 }: OnsetOptions = {}) {
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
