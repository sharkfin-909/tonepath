// Pitch and onset detection on synthetic signals (SPEC §9.2, prototype).
import { describe, expect, it } from 'vitest';
import { OnsetDetector, detectPitch, hzToNote, rms } from './pitch';

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
