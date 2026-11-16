// Microphone listening (SPEC §9.2): the mic → an AnalyserNode, read every animation frame, run through the pure
// detectors in `pitch.ts`. Reports a held note (two-frame lock, kept through brief unlocks), display cents from an
// adaptive EMA needle (display only), attacks, and played notes (`noteStart`, from NoteTracker).
// Analysis window (fftSize + minHz) follows the instrument's concert low. The browser asks for the mic once; the audio
// may be held until the first user gesture (an open straight into Tune), which the caller is told about.

import {
  AdaptiveEma,
  NoteTracker,
  OnsetDetector,
  SteadyHold,
  CLARITY_MIN,
  analysisWindow,
  detectPitch,
  hzToNote,
  rms,
  toExact,
} from './pitch';

export interface Heard {
  /** Concert MIDI note being held (locked), or null after real silence. */
  midi: number | null;
  /** Cents off that note for the tuner needle (EMA, display-only; may exceed ±50 on a bend). */
  cents: number;
  /** Input level, 0–1 (RMS). */
  level: number;
  /** True on the frame the level jumps (an attack). */
  onset: boolean;
  /** The concert note that starts on this frame — an attack or a slur to a new pitch — or null. */
  noteStart: number | null;
  /** True when `noteStart` came from an onset (re-attack), not a slur. */
  noteFromOnset: boolean;
}

export interface Listening {
  stop: () => void;
  /** Resume the audio after a user gesture, when the browser held it (`onAudioState(false)`). */
  resume: () => void;
  /** The input level control: gain before the detectors, in dB (SPEC §9.2). */
  setGainDb: (db: number) => void;
  /** Retune the analysis window when the instrument changes (issues/064). */
  setConcertLowMidi: (concertLowMidi: number | null) => void;
}

export interface ListenOptions {
  /** Gain before the detectors, in dB. */
  gainDb?: number;
  /** Concert MIDI of the instrument's practical low, or null for Concert (2048 / 55 Hz). */
  concertLowMidi?: number | null;
  /**
   * The audio is running (true) or held until a user gesture (false) — opening straight into Tune, the browser may
   * keep it suspended (SPEC §3.0). Called once at the start and on every change.
   */
  onAudioState?: (running: boolean) => void;
}

/** Why the mic can't be used: no secure page (HTTPS / localhost), permission refused, or no input device. */
export type MicProblem = 'insecure' | 'blocked' | 'no-device';

/** The mic problem behind a failed `startListening` (SPEC §3.0). */
export function micProblem(err: unknown): MicProblem {
  if (typeof window !== 'undefined' && (!window.isSecureContext || !navigator.mediaDevices)) return 'insecure';
  if (err instanceof DOMException && (err.name === 'NotAllowedError' || err.name === 'SecurityError')) return 'blocked';
  return 'no-device';
}

/** The input level control's range, in dB. */
export const INPUT_GAIN_DB = { min: -12, max: 24 } as const;

/**
 * Start listening; `onFrame` is called every animation frame. Resolves with the controls, or rejects when the mic is
 * unavailable or permission is refused.
 */
export async function startListening(onFrame: (h: Heard) => void, opts: ListenOptions | number = {}): Promise<Listening> {
  // Number form kept for older call sites / tests: `startListening(cb, gainDb)`.
  const options: ListenOptions = typeof opts === 'number' ? { gainDb: opts } : opts;
  const gainDb = options.gainDb ?? 0;
  let concertLow = options.concertLowMidi === undefined ? null : options.concertLowMidi;

  const stream = await navigator.mediaDevices.getUserMedia({
    // Echo cancellation keeps the app's own sounds out; the other two would colour or pump an instrument's tone.
    audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  // Not awaited: with no user gesture yet (an open straight into Tune) the browser may hold the audio, and resume()
  // would wait for one. The caller hears about it (`onAudioState`) and resumes on the first gesture.
  const report = () => options.onAudioState?.(ctx.state === 'running');
  ctx.onstatechange = report;
  if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  report();
  const source = ctx.createMediaStreamSource(stream);
  const gain = ctx.createGain(); // the input level control
  gain.gain.value = 10 ** (gainDb / 20);
  const analyser = ctx.createAnalyser();
  let { fftSize, minHz } = analysisWindow(ctx.sampleRate, concertLow);
  analyser.fftSize = fftSize;
  source.connect(gain).connect(analyser);
  let buf = new Float32Array(analyser.fftSize);
  const onsets = new OnsetDetector();
  const notes = new NoteTracker();
  const hold = new SteadyHold();
  const ema = new AdaptiveEma();
  let raf = 0;

  const applyWindow = (low: number | null) => {
    concertLow = low;
    const w = analysisWindow(ctx.sampleRate, low);
    minHz = w.minHz;
    if (analyser.fftSize !== w.fftSize) {
      analyser.fftSize = w.fftSize;
      buf = new Float32Array(w.fftSize);
    }
  };

  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    const level = rms(buf);
    const now = performance.now();
    const onset = onsets.push(level, now);
    const p = detectPitch(buf, ctx.sampleRate, { minHz });
    const reading = p && p.clarity >= CLARITY_MIN ? hzToNote(p.hz) : null;
    const midi = hold.push(reading, now, level);
    const smoothed = ema.push(reading ? toExact(reading.midi, reading.cents) : null, now);
    if (midi === null) ema.reset();
    const cents = midi !== null && smoothed !== null ? Math.round((smoothed - midi) * 100) : 0;
    const started = notes.push(midi, onset, now);
    onFrame({
      midi,
      cents,
      level,
      onset,
      noteStart: started?.midi ?? null,
      noteFromOnset: started?.fromOnset ?? false,
    });
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  const resume = () => {
    if (ctx.state === 'suspended') void ctx.resume().catch(() => {});
  };

  const stop = () => {
    cancelAnimationFrame(raf);
    ctx.onstatechange = null;
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
  return {
    stop,
    resume,
    setGainDb: (db) => gain.gain.setTargetAtTime(10 ** (db / 20), ctx.currentTime, 0.02),
    setConcertLowMidi: applyWindow,
  };
}
