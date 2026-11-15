// Pitch and onset detection on synthetic signals (SPEC §9.2, prototype).
import { describe, expect, it } from 'vitest';
import {
  AdaptiveEma,
  HOLD_RELEASE_MS,
  NoteTracker,
  ONSET_GATE,
  OnsetDetector,
  SteadyHold,
  analysisWindow,
  detectPitch,
  hzToNote,
  meterPosition,
  midiToHz,
  rms,
} from './pitch';

const SR = 48000;
const N = 2048;
/** A frame of a tone with harmonics (amplitudes `parts`), like an instrument rather than a pure sine. */
const tone = (hz: number, parts = [1, 0.5, 0.3, 0.15], amp = 0.3, phase = 0) => {
  const buf = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    let v = 0;
    parts.forEach((a, k) => (v += a * Math.sin(2 * Math.PI * hz * (k + 1) * (i / SR) + phase)));
    buf[i] = (v * amp) / parts.reduce((x, y) => x + y, 0);
  }
  return buf;
};
const noise = (amp: number) => Float32Array.from({ length: N }, () => (Math.random() * 2 - 1) * amp);

describe('detectPitch (YIN)', () => {
  it('finds the fundamental of harmonic tones across the range, within a few cents', () => {
    for (const midi of [43, 48, 55, 60, 64, 69, 72, 79, 84]) {
      const hz = 440 * 2 ** ((midi - 69) / 12);
      const p = detectPitch(tone(hz), SR)!;
      expect(p, `midi ${midi}`).not.toBeNull();
      const n = hzToNote(p.hz);
      expect(n.midi, `midi ${midi}`).toBe(midi);
      expect(Math.abs(n.cents)).toBeLessThanOrEqual(3);
      expect(p.clarity).toBeGreaterThan(0.9);
    }
  });

  it('a strong 2nd harmonic does not fool it into the octave above', () => {
    const p = detectPitch(tone(196, [0.6, 1, 0.4]), SR)!; // G3, 2nd harmonic louder than the fundamental
    expect(hzToNote(p.hz).midi).toBe(55);
  });

  it('a slightly flat note reads as that note, cents negative', () => {
    const n = hzToNote(detectPitch(tone(440 * 2 ** (-0.2 / 12)), SR)!.hz);
    expect(n.midi).toBe(69);
    expect(n.cents).toBeGreaterThanOrEqual(-24);
    expect(n.cents).toBeLessThanOrEqual(-16);
  });

  it('silence and noise give no pitch', () => {
    expect(detectPitch(new Float32Array(N), SR)).toBeNull();
    expect(detectPitch(noise(0.005), SR)).toBeNull(); // under the gate
    expect(detectPitch(noise(0.3), SR)).toBeNull(); // loud but aperiodic
  });

  it('rms', () => {
    expect(rms(new Float32Array([1, -1, 1, -1]))).toBe(1);
  });
});

describe('OnsetDetector', () => {
  it('a note start counts once; a held note does not; a re-attack after the lockout counts again', () => {
    const o = new OnsetDetector();
    const levels = [0, 0, 0, 0.2, 0.22, 0.2, 0.18, 0.16, 0.15, 0.05, 0.04, 0.2, 0.2];
    const hits = levels.map((l, i) => o.push(l, i * 16)).map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
    expect(hits).toEqual([3, 11]);
  });

  it('an attack spread over several frames, then held, counts once (not again after the lockout)', () => {
    const o = new OnsetDetector();
    const levels = [0, 0.05, 0.12, 0.2, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25, 0.25];
    expect(levels.map((l, i) => o.push(l, i * 16)).filter(Boolean)).toHaveLength(1);
  });

  it('quiet bumps under the gate are ignored; two attacks inside the lockout count once', () => {
    const o = new OnsetDetector();
    expect([0, 0.01, 0, 0.012].map((l, i) => o.push(l, i * 16)).some(Boolean)).toBe(false);
    const p = new OnsetDetector({ lockoutMs: 90 });
    const r = [0, 0.2, 0.01, 0.3].map((l, i) => p.push(l, i * 16));
    expect(r.filter(Boolean)).toHaveLength(1);
  });
});

describe('NoteTracker', () => {
  const run = (frames: [number | null, boolean][]) => {
    const t = new NoteTracker();
    return frames.map(([m, o], i) => t.push(m, o, i * 16)).filter((x) => x !== null);
  };
  it('an attack starts a note once its pitch is steady; a held note counts once', () => {
    expect(run([[null, true], [null, false], [67, false], [67, false], [67, false]])).toEqual([67]);
  });
  it('a slur (pitch change, no new attack) is a new note', () => {
    expect(run([[null, true], [67, false], [67, false], [69, false], [71, false]])).toEqual([67, 69, 71]);
  });
  it('the same note re-attacked counts again; a brief dropout does not', () => {
    expect(run([[67, true], [67, false], [67, true], [67, false]])).toEqual([67, 67]);
    expect(run([[67, true], [null, false], [67, false]])).toEqual([67]); // 16 ms gap: same note
  });
});

describe('level meter', () => {
  it('dB scale: −60 dBFS → 0, 0 dBFS → 1; the onset gate sits about 40% along', () => {
    expect([meterPosition(0), meterPosition(0.001), meterPosition(1), meterPosition(2)]).toEqual([0, 0, 1, 1]);
    expect(meterPosition(ONSET_GATE)).toBeCloseTo(0.39, 2);
  });
});

describe('SteadyHold', () => {
  it('needs two equal frames to lock; holds through a brief unlock; clears after silence', () => {
    const h = new SteadyHold();
    expect(h.push({ midi: 69 }, 0)).toBeNull();
    expect(h.push({ midi: 69 }, 16)).toBe(69);
    expect(h.push({ midi: 70 }, 32)).toBe(69); // unlock: still holding A4
    expect(h.push({ midi: 70 }, 48)).toBe(70); // new lock
    expect(h.push(null, 64)).toBe(70);
    expect(h.push(null, 64 + HOLD_RELEASE_MS - 1)).toBe(70);
    expect(h.push(null, 64 + HOLD_RELEASE_MS)).toBeNull();
  });
});

describe('AdaptiveEma', () => {
  it('tracks a jump faster than a small wobble', () => {
    const slow = new AdaptiveEma(180, 35);
    const fast = new AdaptiveEma(180, 35);
    slow.push(69, 0);
    fast.push(69, 0);
    // 16 ms later: ±2 ¢ wobble vs +50 ¢ jump
    const afterWobble = slow.push(69.02, 16)!;
    const afterJump = fast.push(69.5, 16)!;
    expect(Math.abs(afterWobble - 69)).toBeLessThan(Math.abs(afterJump - 69));
    expect(afterJump).toBeGreaterThan(69.1);
  });

  it('freezes across a gap and resets', () => {
    const e = new AdaptiveEma();
    expect(e.push(69, 0)).toBe(69);
    expect(e.push(null, 16)).toBe(69);
    e.reset();
    expect(e.push(null, 32)).toBeNull();
  });
});

describe('analysisWindow', () => {
  const SR = 48000;
  it('Concert defaults to 2048 / 55 Hz; bass needs 4096; flute can use 512', () => {
    expect(analysisWindow(SR, null)).toEqual({ fftSize: 2048, minHz: 55 });
    const bass = analysisWindow(SR, 28); // E1
    expect(bass.fftSize).toBe(4096);
    expect(bass.minHz).toBeCloseTo(midiToHz(28), 5);
    const flute = analysisWindow(SR, 60); // C4
    expect(flute.fftSize).toBe(512);
  });
});
