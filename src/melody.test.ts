// Test table 4 (SPEC §14.4, the insert rows: overwrite with leftover rests, refuse at slot end, gap-fill rests)
// and test table 5 (SPEC §14.5: eventsForSlot on split bars, non-4/4 time signatures, short melody).
// Plus the Del / ⌫ and nudge rows, caret stepping and click placement (SPEC §6.2 items 5, 7, 8). Clear all comes with Rail settings.
import { describe, expect, it } from 'vitest';
import { layoutMeter, slotsOf } from './form';
import {
  TICKS,
  backspaceAt,
  caretFromClick,
  deleteAt,
  eventsForSlot,
  fitToForm,
  insertAt,
  insertWrapping,
  melodyEnd,
  nudge,
  restsBetween,
  snapToEvent,
  stepCaret,
} from './melody';
import { slotHarmony, stepPitchClasses } from './harmony';
import type { Bar, MelodyEvent } from './progression';

const bars = (...parts: number[]): Bar[] => parts.map((n) => Array.from({ length: n }, () => ({ chord: '' })));
const form44 = slotsOf(bars(1, 1, 1, 1), layoutMeter('4/4'));
const q = TICKS.q;
/** Compact view: pitch + duration, `r` + duration for rests. */
const show = (m: MelodyEvent[]) => m.map((e) => ('pitch' in e ? `${e.pitch}${e.d}` : `r${e.d}`)).join(' ');
const ok = (r: ReturnType<typeof insertAt>) => {
  if (!r.ok) throw new Error(r.message);
  return r;
};

describe('test table 4: overwrite insert', () => {
  it('appends at the end and moves the caret', () => {
    const r = ok(insertAt([], form44, 0, 'q', 60));
    expect(show(r.melody)).toBe('60q');
    expect(r.caret).toBe(q);
  });

  it('overwrites a covered note exactly', () => {
    const m: MelodyEvent[] = [{ pitch: 60, d: 'q' }, { pitch: 62, d: 'q' }, { pitch: 64, d: 'q' }];
    expect(show(ok(insertAt(m, form44, q, 'q', 67)).melody)).toBe('60q 67q 64q');
  });

  it('leftover of a longer note becomes rests; later music never moves', () => {
    const m: MelodyEvent[] = [{ pitch: 60, d: 'h' }, { pitch: 64, d: 'h' }];
    const r = ok(insertAt(m, form44, 0, 'e', 67));
    expect(show(r.melody)).toBe('67e re rq 64h');
    expect(melodyEnd(r.melody)).toBe(melodyEnd(m));
  });

  it('a long insert removes every covered event and rests the overhang of the last', () => {
    const m: MelodyEvent[] = [{ pitch: 60, d: 'e' }, { pitch: 62, d: 'e' }, { pitch: 64, d: 'q' }, { pitch: 65, d: 'h' }];
    expect(show(ok(insertAt(m, form44, 0, 'h', 72)).melody)).toBe('72h 65h');
    expect(show(ok(insertAt(m, form44, TICKS.e, 'h', 72)).melody)).toBe('60e 72h re rq');
  });

  it('inserts a rest when pitch is null', () => {
    expect(show(ok(insertAt([{ pitch: 60, d: 'h' }], form44, 0, 'q', null)).melody)).toBe('rq rq');
  });

  it('refuses a length that would cross the end of the caret slot, changing nothing', () => {
    expect(insertAt([], form44, 3 * q, 'h', 60)).toEqual({ ok: false, message: "Doesn't fit in this slot" });
    const split = slotsOf(bars(2, 1), layoutMeter('4/4'));
    expect(insertAt([], split, 0, 'w', 60)).toMatchObject({ ok: false });
    expect(insertAt([], split, 0, 'h', 60)).toMatchObject({ ok: true });
  });

  it('refuses at and past the end of the form', () => {
    const one = slotsOf(bars(1), layoutMeter('4/4'));
    expect(insertAt([], one, 3 * q, 'h', 60)).toEqual({ ok: false, message: "Doesn't fit before the end of the form" });
    expect(insertAt([], one, 4 * q, 'q', 60)).toEqual({ ok: false, message: 'End of the form' });
  });

  it('gap-fills with rests: largest lengths on their own beat, inside each slot', () => {
    // caret on beat 4 of bar 2, empty melody: bar 1 = whole rest, bar 2 = half + quarter rests
    const r = ok(insertAt([], form44, 4 * q + 3 * q, 'q', 60));
    expect(show(r.melody)).toBe('rw rh rq 60q');
  });

  it('gap-fill after an off-beat end uses short rests until a beat', () => {
    const m: MelodyEvent[] = [{ pitch: 60, d: 'e' }];
    expect(show(ok(insertAt(m, form44, 2 * q, 'q', 62)).melody)).toBe('60e re rq 62q');
  });

  it('gap-fill does not cross a slot boundary (split bar)', () => {
    const split = slotsOf(bars(2), layoutMeter('4/4'));
    expect(show(restsBetween(split, 0, 3 * q))).toBe('rh rq');
    expect(show(ok(insertAt([], split, 3 * q, 'q', 60)).melody)).toBe('rh rq 60q');
  });

  it('in 3/4, rests start on their own beat relative to the slot', () => {
    const f = slotsOf(bars(1, 1), layoutMeter('3/4'));
    expect(show(restsBetween(f, 0, 6 * q))).toBe('rh rq rh rq');
  });
});

describe('test table 5: eventsForSlot', () => {
  const m: MelodyEvent[] = [
    { pitch: 60, d: 'h' },
    { pitch: 62, d: 'q' },
    { pitch: 64, d: 'q' },
    { d: 'h' },
    { pitch: 65, d: 'h' },
  ];

  it('split bars: each half gets the events that start in it', () => {
    const f = slotsOf(bars(2, 2), layoutMeter('4/4'));
    expect(f.map((s) => show(eventsForSlot(m, s).map((e) => e.ev)))).toEqual(['60h', '62q 64q', 'rh', '65h']);
  });

  it('3/4: bars of three beats', () => {
    const f = slotsOf(bars(1, 1, 1), layoutMeter('3/4'));
    expect(f.map((s) => show(eventsForSlot(m, s).map((e) => e.ev)))).toEqual(['60h 62q', '64q rh', '65h']);
  });

  it('6/8 split bar: halves of three eighths', () => {
    const e8: MelodyEvent[] = Array.from({ length: 6 }, (_, i) => ({ pitch: 60 + i, d: 'e' as const }));
    const f = slotsOf(bars(2), layoutMeter('6/8'));
    expect(f.map((s) => show(eventsForSlot(e8, s).map((e) => e.ev)))).toEqual(['60e 61e 62e', '63e 64e 65e']);
  });

  it('a short melody leaves later slots empty, with event start times', () => {
    const f = slotsOf(bars(1, 1, 1), layoutMeter('4/4'));
    const slices = f.map((s) => eventsForSlot([{ pitch: 60, d: 'q' }, { pitch: 62, d: 'q' }], s));
    expect(slices.map((s) => s.length)).toEqual([2, 0, 0]);
    expect(slices[0].map((e) => e.start)).toEqual([0, q]);
  });
});

describe('snapToEvent', () => {
  it('snaps inside a note to its start and keeps times past the end', () => {
    const m: MelodyEvent[] = [{ pitch: 60, d: 'h' }];
    expect(snapToEvent(m, q)).toBe(0);
    expect(snapToEvent(m, 3 * q)).toBe(3 * q);
  });
});

const n = (pitch: number, d: MelodyEvent['d'] = 'q'): MelodyEvent => ({ pitch, d });
const r = (d: MelodyEvent['d'] = 'q'): MelodyEvent => ({ d });

describe('test table 4: Del and ⌫', () => {
  const m = [n(60), r(), n(64), n(65)];

  it('Del on a note turns it into a rest of the same length; the caret stays', () => {
    expect(show(deleteAt(m, 2 * q).melody)).toBe('60q rq rq 65q');
    expect(deleteAt(m, 2 * q).caret).toBe(2 * q);
    expect(show(deleteAt([n(60, 'h'), n(62)], 0).melody)).toBe('rh 62q');
  });

  it('Del on a mid rest changes nothing', () => {
    expect(deleteAt(m, q)).toEqual({ melody: m, caret: q });
  });

  it('Del on the last note shortens the melody (no trailing rests)', () => {
    expect(show(deleteAt(m, 3 * q).melody)).toBe('60q rq 64q');
    expect(show(deleteAt([n(60), r(), n(62)], 2 * q).melody)).toBe('60q');
  });

  it('Del on a trailing rest removes it', () => {
    expect(show(deleteAt([n(60), r(), r()], 2 * q).melody)).toBe('60q');
  });

  it('Del past the melody end does nothing', () => {
    expect(deleteAt(m, 6 * q)).toEqual({ melody: m, caret: 6 * q });
  });

  it('⌫ on a note: the event before the caret becomes a rest, caret to its start', () => {
    expect(backspaceAt(m, 3 * q)).toEqual({ melody: [n(60), r(), r(), n(65)], caret: 2 * q });
  });

  it('⌫ over a mid rest keeps it and steps back', () => {
    expect(backspaceAt(m, 2 * q)).toEqual({ melody: m, caret: q });
  });

  it('⌫ at the melody end removes the last note and shortens', () => {
    expect(backspaceAt(m, 4 * q)).toEqual({ melody: [n(60), r(), n(64)], caret: 3 * q });
    expect(backspaceAt([n(60), r(), n(64)], 3 * q)).toEqual({ melody: [n(60)], caret: 2 * q });
  });

  it('⌫ on a trailing rest removes it', () => {
    expect(backspaceAt([n(60), r()], 2 * q)).toEqual({ melody: [n(60)], caret: q });
  });

  it('⌫ past the melody end reaches back to its last event', () => {
    expect(backspaceAt([n(60)], 6 * q)).toEqual({ melody: [], caret: 0 });
  });

  it('⌫ at the start does nothing', () => {
    expect(backspaceAt(m, 0)).toEqual({ melody: m, caret: 0 });
  });
});

describe('test table 4: nudge', () => {
  // Bar 1 Dm7 (D Dorian), bar 2 A7 (A Mixolydian: F#, C#), bar 3 N.C.
  const chords = ['Dm7', 'A7', 'N.C.'];
  const form = slotsOf(chords.map((chord) => [{ chord }]), layoutMeter('4/4'));
  const pcs = (s: { bar: number }) => stepPitchClasses(slotHarmony({ chord: chords[s.bar] }));
  const nudged = (mel: MelodyEvent[], caret: number, dir: -1 | 1, oct = false) => {
    const res = nudge(mel, form, caret, dir, oct, pcs);
    return res.ok ? `${show(res.melody)} → ${res.pitch}` : 'refused';
  };

  it('moves the note before the caret one step of its owning slot\'s scale', () => {
    expect(nudged([n(60), n(64)], 2 * q, 1)).toBe('60q 65q → 65'); // E → F in D Dorian
    expect(nudged([n(60), n(64)], 2 * q, -1)).toBe('60q 62q → 62'); // E → D
    expect(nudged([n(71)], q, 1)).toBe('72q → 72'); // B → C
  });

  it('uses the owning slot of the note, not the caret slot', () => {
    // F#4 owned by A7: down is E (in D Dorian it would be F)
    expect(nudged([r('w'), n(66)], 5 * q, -1)).toBe('rw 64q → 64');
    // caret past the end, in bar 2: the bar-1 note still steps by D Dorian (F → G)
    expect(nudged([n(65, 'h')], 6 * q, 1)).toBe('67h → 67');
    expect(nudged([n(65, 'h')], 6 * q, -1)).toBe('64h → 64');
  });

  it('an out-of-scale note moves to the nearest scale tone in that direction', () => {
    expect(nudged([n(61)], q, 1)).toBe('62q → 62'); // C# in D Dorian → D
    expect(nudged([n(61)], q, -1)).toBe('60q → 60');
  });

  it('⇧ moves by an octave', () => {
    expect(nudged([n(60), n(64)], 2 * q, 1, true)).toBe('60q 76q → 76');
    expect(nudged([n(60), n(64)], 2 * q, -1, true)).toBe('60q 52q → 52');
  });

  it('a no-fit chord steps through its own tones', () => {
    const f = slotsOf([[{ chord: 'C7sus4b9' }]], layoutMeter('4/4'));
    const p = (s: { bar: number }) => stepPitchClasses(slotHarmony({ chord: ['C7sus4b9'][s.bar] }));
    const res = nudge([n(60)], f, q, 1, false, p);
    expect(res).toEqual({ ok: true, melody: [n(61)], pitch: 61 }); // C → Db (b9)
  });

  it('refuses on a rest, with nothing before the caret, in a slot without a scale (except octaves), off MIDI', () => {
    expect(nudged([n(60), r()], 2 * q, 1)).toBe('refused');
    expect(nudged([n(60)], 0, 1)).toBe('refused');
    const nc = [r('w'), r('w'), n(60)];
    expect(nudged(nc, 9 * q, 1)).toBe('refused');
    expect(nudged(nc, 9 * q, 1, true)).toBe('rw rw 72q → 72');
    expect(nudged([n(120)], q, 1, true)).toBe('refused');
  });
});

describe('caret stepping (← / →)', () => {
  const m = [n(60, 'h'), n(62, 'e'), n(64, 'e')]; // ends at 3q

  it('steps event by event inside the melody', () => {
    expect(stepCaret(m, form44, 0, 1, 'q')).toBe(2 * q);
    expect(stepCaret(m, form44, 2 * q, 1, 'q')).toBe(2 * q + TICKS.e);
    expect(stepCaret(m, form44, 3 * q, -1, 'q')).toBe(2 * q + TICKS.e);
    expect(stepCaret(m, form44, 2 * q, -1, 'q')).toBe(0);
    expect(stepCaret(m, form44, 0, -1, 'q')).toBe(0);
  });

  it('past the melody end steps by the latched length, up to the end of the form', () => {
    expect(stepCaret(m, form44, 3 * q, 1, 'q')).toBe(4 * q);
    expect(stepCaret(m, form44, 4 * q, 1, 'h')).toBe(6 * q);
    expect(stepCaret(m, form44, 14 * q, 1, 'w')).toBe(16 * q);
    expect(stepCaret(m, form44, 16 * q, 1, 'q')).toBe(16 * q);
  });

  it('stays on the latch grid within a slot, from an off-grid melody end', () => {
    const off = [n(60, 'e')];
    expect(stepCaret(off, form44, TICKS.e, 1, 'q')).toBe(q);
    expect(stepCaret(off, form44, 2 * q, 1, 'w')).toBe(4 * q); // stops at the slot end
  });

  it('← past the end steps back by the latch, stopping at the melody end', () => {
    expect(stepCaret(m, form44, 6 * q, -1, 'q')).toBe(5 * q);
    expect(stepCaret(m, form44, 4 * q, -1, 'q')).toBe(3 * q);
    expect(stepCaret(m, form44, 8 * q, -1, 'w')).toBe(4 * q);
    expect(stepCaret(m, form44, 4 * q, -1, 'w')).toBe(3 * q); // melody end
  });
});

describe('caret from a click', () => {
  const m = [n(60, 'h'), n(62)];

  it('inside the melody snaps to the start of the event under the click', () => {
    expect(caretFromClick(m, form44, q, 'q')).toBe(0);
    expect(caretFromClick(m, form44, 2 * q + 5, 'q')).toBe(2 * q);
  });

  it('past the melody end → the latch-length beat under the click', () => {
    expect(caretFromClick(m, form44, 5 * q + 10, 'q')).toBe(5 * q);
    expect(caretFromClick(m, form44, 7 * q, 'h')).toBe(6 * q);
    expect(caretFromClick(m, form44, 3 * q + 10, 'h')).toBe(3 * q); // beat before the melody end → its end
    expect(caretFromClick(m, form44, 99 * q, 'q')).toBe(16 * q);
  });
});

describe('fitToForm (time signature change, import repair)', () => {
  it('leaves a melody that fits untouched (same object)', () => {
    const m = [n(60, 'h'), n(62, 'h')];
    expect(fitToForm(m, form44)).toEqual({ melody: m, shortened: 0, dropped: 0 });
    expect(fitToForm(m, form44).melody).toBe(m);
  });

  it('4/4 → 3/4: a note crossing the new bar line is shortened and the cut-off becomes rests; later music keeps its time', () => {
    const f34 = slotsOf(bars(1, 1, 1), layoutMeter('3/4'));
    // C h, D h (crosses beat 3 | 4), E q ...
    const r = fitToForm([n(60, 'h'), n(62, 'h'), n(64)], f34);
    expect(show(r.melody)).toBe('60h 62q rq 64q');
    expect(r.shortened).toBe(1);
    expect(melodyEnd(r.melody)).toBe(5 * q);
  });

  it('a whole note over a 6/8 bar keeps its time as rests across slots', () => {
    const f68 = slotsOf(bars(2, 1, 1), layoutMeter('6/8')); // bar 1 split: halves of 3 eighths
    const r = fitToForm([n(60, 'w'), n(62, 'e')], f68);
    // 8 eighths: half 1 = q + e rest, half 2 = q + e rests, bar 2 = q rest; then the eighth keeps its time
    expect(show(r.melody)).toBe('60q re rq re rq 62e');
    expect(melodyEnd(r.melody)).toBe(9 * TICKS.e);
  });

  it('drops events past a shorter form and shortens the one crossing its end', () => {
    const one = slotsOf(bars(1), layoutMeter('3/4'));
    const r = fitToForm([n(60, 'h'), n(62, 'h'), n(64)], one);
    expect(show(r.melody)).toBe('60h 62q');
    expect(r).toMatchObject({ shortened: 1, dropped: 1 });
  });

  it('rests are fitted too', () => {
    const f34 = slotsOf(bars(1, 1), layoutMeter('3/4'));
    expect(show(fitToForm([r('w'), n(60)], f34).melody)).toBe('rh rq rq 60q');
  });
});

describe('writing past the end continues from the start', () => {
  it('caret at the form end → the note goes in at time 0, overwriting', () => {
    const full: MelodyEvent[] = Array.from({ length: 16 }, () => ({ pitch: 60, d: 'q' as const }));
    const r = ok(insertWrapping(full, form44, 16 * q, 'q', 72));
    expect(show(r.melody.slice(0, 2))).toBe('72q 60q');
    expect(r.melody).toHaveLength(16);
    expect(r.caret).toBe(q);
  });
  it('writing the last note of the form puts the caret at the start (first slot active)', () => {
    const r = ok(insertWrapping([], form44, 15 * q, 'q', 60));
    expect(r.caret).toBe(0);
    expect(r.melody.at(-1)).toEqual({ pitch: 60, d: 'q' });
  });
  it('anywhere else it is a plain insert (a note that does not fit is still refused)', () => {
    expect(ok(insertWrapping([], form44, 0, 'q', 60)).caret).toBe(q);
    expect(insertWrapping([], form44, 15 * q, 'h', 60)).toMatchObject({ ok: false });
  });
});
