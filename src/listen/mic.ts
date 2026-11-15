// Microphone listening (SPEC §9.2): the mic → an AnalyserNode, read every animation frame, run through the pure
// detectors in `pitch.ts`. Reports a steady note (the same MIDI note on two frames in a row, so a note's attack
// doesn't flicker through neighbours), the input level, attacks, and played notes (`noteStart`, from NoteTracker).
// The browser asks for the mic once.

import { NoteTracker, OnsetDetector, detectPitch, hzToNote, rms } from './pitch';

export interface Heard {
  /** Concert MIDI note being played, or null (silence / unclear). */
  midi: number | null;
  /** Cents off that note, −50 … +50. */
  cents: number;
  /** Input level, 0–1 (RMS). */
  level: number;
  /** True on the frame the level jumps (an attack). */
  onset: boolean;
  /** The concert note that starts on this frame — an attack or a slur to a new pitch — or null. */
  noteStart: number | null;
}

export interface Listening {
  stop: () => void;
  /** The input level control: gain before the detectors, in dB (SPEC §9.2). */
  setGainDb: (db: number) => void;
}

/** The input level control's range, in dB. */
export const INPUT_GAIN_DB = { min: -12, max: 24 } as const;

/**
 * Start listening; `onFrame` is called every animation frame. Resolves with the controls, or rejects when the mic is
 * unavailable or permission is refused. `gainDb` boosts or cuts the mic before detection (and the level meter).
 */
export async function startListening(onFrame: (h: Heard) => void, gainDb = 0): Promise<Listening> {
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
  analyser.fftSize = 2048; // ~43 ms at 48 kHz: down to ~55 Hz (A1)
  source.connect(gain).connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const onsets = new OnsetDetector();
  const notes = new NoteTracker();
  let last: number | null = null;
  let raf = 0;

  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    const level = rms(buf);
    const now = performance.now();
    const onset = onsets.push(level, now);
    const p = detectPitch(buf, ctx.sampleRate);
    const note = p && p.clarity > 0.85 ? hzToNote(p.hz) : null;
    const steady = note && note.midi === last ? note : null;
    last = note ? note.midi : null;
    const midi = steady ? steady.midi : null;
    onFrame({ midi, cents: steady ? steady.cents : 0, level, onset, noteStart: notes.push(midi, onset, now) });
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
  };
}
