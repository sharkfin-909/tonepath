// Microphone listening (SPEC §9.2, prototype): the mic → an AnalyserNode, read every animation frame, run through
// the pure detectors in `pitch.ts`. Reports a steady note (the same MIDI note on two frames in a row, so a note's
// attack doesn't flicker through neighbours), the input level and note starts. The browser asks for the mic once.

import { OnsetDetector, detectPitch, hzToNote, rms } from './pitch';

export interface Heard {
  /** Concert MIDI note being played, or null (silence / unclear). */
  midi: number | null;
  /** Cents off that note, −50 … +50. */
  cents: number;
  /** Input level, 0–1 (RMS). */
  level: number;
  /** True on the frame a new note starts. */
  onset: boolean;
}

export type StopListening = () => void;

/**
 * Start listening; `onFrame` is called every animation frame. Resolves with a stop function, or rejects when the mic
 * is unavailable or permission is refused.
 */
export async function startListening(onFrame: (h: Heard) => void): Promise<StopListening> {
  const stream = await navigator.mediaDevices.getUserMedia({
    // Echo cancellation keeps the app's own sounds out; the other two would colour or pump an instrument's tone.
    audio: { echoCancellation: true, noiseSuppression: false, autoGainControl: false },
  });
  const ctx = new AudioContext();
  if (ctx.state === 'suspended') await ctx.resume(); // started from the Listen click, so this is allowed
  const source = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048; // ~43 ms at 48 kHz: down to ~55 Hz (A1)
  source.connect(analyser);
  const buf = new Float32Array(analyser.fftSize);
  const onsets = new OnsetDetector();
  let last: number | null = null;
  let raf = 0;

  const tick = () => {
    analyser.getFloatTimeDomainData(buf);
    const level = rms(buf);
    const onset = onsets.push(level, performance.now());
    const p = detectPitch(buf, ctx.sampleRate);
    const note = p && p.clarity > 0.85 ? hzToNote(p.hz) : null;
    const steady = note && note.midi === last ? note : null;
    last = note ? note.midi : null;
    onFrame({ midi: steady ? steady.midi : null, cents: steady ? steady.cents : 0, level, onset });
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return () => {
    cancelAnimationFrame(raf);
    stream.getTracks().forEach((t) => t.stop());
    void ctx.close();
  };
}
