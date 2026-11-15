// Microphone listening (SPEC §9.2): the mic → an AnalyserNode, read every animation frame, run through the pure
// detectors in `pitch.ts`. Reports a held note (two-frame lock, kept through brief unlocks), display cents from an
// adaptive EMA needle (not used for Practice counts), attacks, and played notes (`noteStart`, from NoteTracker).
// Analysis window (fftSize + minHz) follows the instrument's concert low. The browser asks for the mic once.

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
  if (ctx.state === 'suspended') await ctx.resume(); // started from the Listen click, so this is allowed
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

  const stop = () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
  return {
    stop,
    setGainDb: (db) => gain.gain.setTargetAtTime(10 ** (db / 20), ctx.currentTime, 0.02),
    setConcertLowMidi: applyWindow,
  };
}
