// Mic intake (SPEC §3.2, §3.7, §9.2): write, count or ignore each note start the mic hears.
import { describe, expect, it } from 'vitest';
import { NEW_INTAKE, appSounded, heard, micStopped, type MicIntake } from './micIntake';
import { slotHarmony } from './harmony';

const n = (concert: number, fromOnset = true) => ({ concert, written: concert, fromOnset });

describe('mic intake: writing', () => {
  it('writes a note; the same pitch again within 220 ms is one held note', () => {
    let m: MicIntake = NEW_INTAKE;
    let r = heard(m, n(62), 1000, true);
    expect(r.action).toEqual({ kind: 'write', written: 62 });
    m = r.intake;
    expect(heard(m, n(62), 1100, true).action.kind).toBe('ignore');
    expect(heard(m, n(62), 1300, true).action.kind).toBe('write');
    r = heard(m, n(64), 1050, true); // a new pitch, attacked: written at once
    expect(r.action.kind).toBe('write');
  });

  it('a slur (no new attack) a step or less away, right after a written note, is a wobble', () => {
    const m = heard(NEW_INTAKE, n(62), 1000, true).intake;
    expect(heard(m, n(64, false), 1100, true).action.kind).toBe('ignore'); // 2 semitones, 100 ms
    expect(heard(m, n(63, false), 1140, true).action.kind).toBe('ignore'); // 1 semitone, 140 ms
    expect(heard(m, n(64, false), 1140, true).action.kind).toBe('write'); // 2 semitones, past 130 ms
    expect(heard(m, n(67, false), 1050, true).action.kind).toBe('write'); // a leap: a real new note
  });

  it('after listening stops, the next note is fresh', () => {
    const m = micStopped(heard(NEW_INTAKE, n(62), 1000, true).intake);
    expect(heard(m, n(62), 1050, true).action.kind).toBe('write');
  });
});

describe('mic intake: practising', () => {
  it('not writing: every note is counted (nothing remembered)', () => {
    const r = heard(NEW_INTAKE, n(62), 1000, false);
    expect(r.action).toEqual({ kind: 'count' });
    expect(r.intake).toBe(NEW_INTAKE);
  });

  it('the app\'s own sounds are ignored while they ring: deaf at first, then their pitches (and octaves)', () => {
    const m = appSounded(NEW_INTAKE, [{ type: 'note', midi: 62 }], 0);
    expect(heard(m, n(67), 100, false).action.kind).toBe('ignore'); // the first 250 ms: anything
    expect(heard(m, n(74), 500, false).action.kind).toBe('ignore'); // its pitch an octave up
    expect(heard(m, n(67), 500, false).action.kind).toBe('count');
  });

  it('a new sound while one rings keeps guarding both', () => {
    const chord = slotHarmony({ chord: 'C' });
    let m = appSounded(NEW_INTAKE, [{ type: 'chord', harmony: chord }], 0); // rings ~3.2 s
    m = appSounded(m, [{ type: 'note', midi: 62 }], 1000); // a hex pick
    expect(heard(m, n(64), 2000, false).action.kind).toBe('ignore'); // E: still the chord's
    expect(heard(m, n(62), 1500, false).action.kind).toBe('ignore'); // D: the pick's
    expect(heard(m, n(65), 2000, false).action.kind).toBe('count');
    expect(appSounded(m, [], 3000)).toBe(m); // nothing sounded: unchanged
  });
});
