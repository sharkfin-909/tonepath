// Practice mode (SPEC §3.7): note counts from the selected length; the five advance rules.
import { describe, expect, it } from 'vitest';
import { newProgression, type Progression } from './progression';
import { ECHO_DEAF_MS, echoGuard, followEventIndex, guideTones, isEcho, noteCountFor, practiceNote, practiceTargets, startPractice, type AdvanceRule, type PracticeState } from './practice';
import { slotHarmony } from './harmony';
import { instrumentView } from './view';

/** Dm7 G7 | Cmaj7 | N.C. (concert). */
const prog = (melody: Progression['melody'] = []): Progression => ({
  ...newProgression(),
  bars: [[{ chord: 'Dm7' }, { chord: 'G7' }], [{ chord: 'Cmaj7' }], [{ chord: 'N.C.' }]],
  melody,
});
const ctx = (rule: AdvanceRule, p = prog(), length: 'q' | 'e' | 'h' = 'q') => ({ view: instrumentView(p), melody: p.melody, rule, length });
/** Play notes in order; the slots the form was on after each. */
const play = (rule: AdvanceRule, notes: number[], p = prog(), length: 'q' | 'e' | 'h' = 'q') => {
  let s: PracticeState = startPractice(0);
  return notes.map((m) => (s = practiceNote(s, m, ctx(rule, p, length)).state).slot);
};

describe('note count from the selected length', () => {
  it('a half-bar slot in quarters is 2, a whole bar 4; in eighths 4 and 8', () => {
    const v = instrumentView(prog());
    expect([noteCountFor(v.slots[0], 'q'), noteCountFor(v.slots[2], 'q'), noteCountFor(v.slots[0], 'e'), noteCountFor(v.slots[2], 'e')]).toEqual([2, 4, 4, 8]);
    expect(noteCountFor(v.slots[0], 'w')).toBe(1); // never 0
  });
});

describe('advance rules', () => {
  // D=62 F=65 A=69 C=60 | G7: G B D F → guide tones B(11), F(5) | Cmaj7 guide tones E(4), B(11)
  it('guide tone: moves on when a 3rd or 7th of the NEXT chord is played', () => {
    expect([...guideTones(instrumentView(prog()).slots[1])].sort((a, b) => a - b)).toEqual([5, 11]);
    expect(play('guide', [62, 69, 71])).toEqual([0, 0, 1]); // D, A stay on Dm7; B (3rd of G7) → G7
    expect(play('guide', [71, 64])).toEqual([1, 2]); // then E (3rd of Cmaj7) → Cmaj7
  });

  it('chord tone: any note of the next chord', () => {
    expect(play('chord-tone', [61, 67])).toEqual([0, 1]); // C♯ no; G (root of G7) yes
  });

  it('landed vs finished: guide / chord-tone notes land in the next slot; count / Follow finish the old one', () => {
    expect(practiceNote(startPractice(0), 71, ctx('guide'))).toMatchObject({ advanced: true, landed: true });
    expect(practiceNote({ slot: 0, count: 1, follow: 0, lastFollowPc: null }, 60, ctx('count'))).toMatchObject({ advanced: true, landed: false });
  });

  it('note count: after the slot’s count (quarters: 2 in a half bar)', () => {
    expect(play('count', [60, 61, 62, 63, 64, 65])).toEqual([0, 1, 1, 2, 2, 2]);
  });

  it('count, then guide tone: fill the slot first, then land on a guide tone', () => {
    expect(play('count-then-guide', [71, 62, 64, 71])).toEqual([0, 0, 0, 1]); // B too early; 2 notes; E no; B lands
    const s = { slot: 0, count: 2, follow: 0, lastFollowPc: null };
    expect(practiceTargets(s, ctx('count-then-guide')).pcs).toEqual(new Set([5, 11]));
    expect(practiceTargets({ ...s, count: 1 }, ctx('count-then-guide')).pcs).toBeNull(); // not yet
  });

  it('follow the etude: the written notes in order; wrong notes wait; any octave of the pitch counts', () => {
    const p = prog([{ pitch: 62, d: 'q' }, { pitch: 65, d: 'q' }, { pitch: 67, d: 'h' }]); // D F | G
    expect(play('follow', [62, 60, 65, 67], p)).toEqual([0, 0, 1, 2]);
    expect(play('follow', [74, 65], p)).toEqual([0, 1]); // D5 (= D4 pc) then F
    expect(practiceTargets(startPractice(0), ctx('follow', p)).midi).toBe(62);
    const c = ctx('follow', p);
    expect(followEventIndex(startPractice(0), c)).toBe(0); // the D
    expect(followEventIndex({ slot: 0, count: 1, follow: 1, lastFollowPc: null }, c)).toBe(1); // then the F
    expect(followEventIndex({ slot: 1, count: 0, follow: 0, lastFollowPc: null }, c)).toBe(2); // the G, in the next slot
    // Each correct note reports which written note it was (marked as played); a wrong note doesn't.
    expect(practiceNote(startPractice(0), 62, c).hit).toBe(0);
    expect(practiceNote(startPractice(0), 60, c).hit).toBeUndefined();
    expect(practiceNote({ slot: 0, count: 1, follow: 1, lastFollowPc: 2 }, 65, c)).toMatchObject({ hit: 1, advanced: true });
  });

  it('follow: a held note does not mark the next written repeat; a re-attack does', () => {
    const p = prog([{ pitch: 62, d: 'q' }, { pitch: 62, d: 'q' }, { pitch: 65, d: 'h' }]); // D D | F
    const c = ctx('follow', p);
    const first = practiceNote(startPractice(0), 62, c, true);
    expect(first).toMatchObject({ hit: 0, advanced: false });
    expect(first.state.follow).toBe(1);
    // Same pitch, slurred / no new onset: must not mark the second D.
    const held = practiceNote(first.state, 62, c, false);
    expect(held.hit).toBeUndefined();
    expect(held.advanced).toBe(false);
    expect(held.state).toEqual(first.state);
    // Re-attack: marks the repeat.
    expect(practiceNote(first.state, 62, c, true)).toMatchObject({ hit: 1, advanced: true });
  });

  it('wraps from the last slot to the first; a next slot without a chord falls back to the count', () => {
    let s: PracticeState = { slot: 2, count: 0, follow: 0, lastFollowPc: null }; // Cmaj7 → N.C. next
    for (const m of [60, 62, 64]) s = practiceNote(s, m, ctx('guide')).state;
    expect(s.slot).toBe(2);
    s = practiceNote(s, 65, ctx('guide')).state; // 4th note: the count of a whole bar in quarters
    expect(s.slot).toBe(3);
    const end = practiceNote({ slot: 3, count: 0, follow: 0, lastFollowPc: null }, 71, ctx('guide')); // N.C. → Dm7 (wraps)
    expect(end.state.slot).toBe(3); // B isn't a guide tone of Dm7 (F, C)
    expect(practiceNote({ slot: 3, count: 0, follow: 0, lastFollowPc: null }, 65, ctx('guide')).state.slot).toBe(0);
  });
});

describe('echo guard: the mic hearing the app\'s own On arrival sound', () => {
  const g7 = slotHarmony({ chord: 'G7' });
  it('deaf for a moment after it starts; then only its own pitches (± an octave) are ignored while it rings', () => {
    const g = echoGuard([{ type: 'bass', harmony: g7 }], 1000)!; // G2 = 43
    expect([...g.midis]).toEqual([43]);
    expect(isEcho(g, 71, 1000 + ECHO_DEAF_MS - 1)).toBe(true); // anything, too soon
    expect(isEcho(g, 55, 1400)).toBe(true); // G3: an octave off the bass note
    expect(isEcho(g, 71, 1400)).toBe(false); // B: the player
    expect(isEcho(g, 43, 1000 + 1200)).toBe(false); // the bass note has died away
  });
  it('a chord rings longer and guards all its voices; no sound, no guard', () => {
    const g = echoGuard([{ type: 'chord', harmony: g7 }], 0)!;
    expect(g.until).toBeGreaterThan(3000);
    expect(isEcho(g, [...g.midis][1], 2000)).toBe(true);
    expect(echoGuard([], 0)).toBeNull();
    expect(echoGuard([{ type: 'chord', harmony: slotHarmony({ chord: 'N.C.' }) }], 0)).toBeNull();
  });
});
