// Mic intake (SPEC §3.3, §9.2): the echo guard — a note start is the player's, or the app's own sound.
import { describe, expect, it } from 'vitest';
import { ECHO_DEAF_MS, NEW_INTAKE, appSounded, echoGuard, isEcho, isPlayed } from './micIntake';
import { slotHarmony } from './harmony';

describe('echo guard: the mic hearing the app\'s own On arrival sound', () => {
  const g7 = slotHarmony({ chord: 'G7' });
  it('deaf for a moment after it starts; then only its own pitches (± an octave) are ignored while it rings', () => {
    const g = echoGuard([{ type: 'bass', harmony: g7 }], 1000)!; // G2 = 43
    expect([...g.midis]).toEqual([43]);
    expect(isEcho(g, 71, 1000 + ECHO_DEAF_MS - 1)).toBe(true); // anything, too soon
    expect(isEcho(g, 55, 1400)).toBe(true); // G3: an octave off the bass note
    expect(isEcho(g, 71, 1400)).toBe(false); // B: the player
    expect(isEcho(g, 43, 1000 + 3000)).toBe(true); // the bass note sustains (~3.6 s)
    expect(isEcho(g, 43, 1000 + 3700)).toBe(false); // …then it has died away
  });
  it('the root note is a short note (~1 s)', () => {
    const g = echoGuard([{ type: 'root', harmony: g7 }], 0)!;
    expect([isEcho(g, 55, 900), isEcho(g, 55, 1200)]).toEqual([true, false]);
  });
  it('a chord rings longer and guards all its voices; no sound, no guard', () => {
    const g = echoGuard([{ type: 'chord', harmony: g7 }], 0)!;
    expect(g.until).toBeGreaterThan(3000);
    expect(isEcho(g, [...g.midis][1], 2000)).toBe(true);
    expect(echoGuard([], 0)).toBeNull();
    expect(echoGuard([{ type: 'chord', harmony: slotHarmony({ chord: 'N.C.' }) }], 0)).toBeNull();
  });
  it('a hex pick\'s audition is guarded like a single note (~1 s), so the mic doesn\'t take it for the player', () => {
    const g = echoGuard([{ type: 'note', midi: 62 }], 0)!;
    expect([isEcho(g, 62, 500), isEcho(g, 74, 500), isEcho(g, 64, 500), isEcho(g, 62, 1200)]).toEqual([true, true, false, false]);
  });
});

describe('the intake', () => {
  it('the app\'s own sounds are ignored while they ring: deaf at first, then their pitches (and octaves)', () => {
    const m = appSounded(NEW_INTAKE, [{ type: 'note', midi: 62 }], 0);
    expect(isPlayed(m, 67, 100)).toBe(false); // the first 250 ms: anything
    expect(isPlayed(m, 74, 500)).toBe(false); // its pitch an octave up
    expect(isPlayed(m, 67, 500)).toBe(true);
    expect(isPlayed(NEW_INTAKE, 62, 0)).toBe(true);
  });

  it('a new sound while one rings keeps guarding both', () => {
    const chord = slotHarmony({ chord: 'C' });
    let m = appSounded(NEW_INTAKE, [{ type: 'chord', harmony: chord }], 0); // rings ~3.2 s
    m = appSounded(m, [{ type: 'note', midi: 62 }], 1000); // a hex pick
    expect(isPlayed(m, 64, 2000)).toBe(false); // E: still the chord's
    expect(isPlayed(m, 62, 1500)).toBe(false); // D: the pick's
    expect(isPlayed(m, 65, 2000)).toBe(true);
    expect(appSounded(m, [], 3000)).toBe(m); // nothing sounded: unchanged
  });
});
