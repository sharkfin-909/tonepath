// Test table 8 (SPEC §14.8): bar editing.
import { describe, expect, it } from 'vitest';
import { melodyOf, withFlat } from './test-progression';
import { appendBar, copyBars, deleteBars, deleteSlot, duplicateBars, insertBars, mergeBar, pasteBars, splitBar, type BarEdit } from './bars';
import { TICKS } from './melody';
import { newProgression, setTimeSignature, type MelodyEvent, type Progression } from './progression';

const q = TICKS.q;
const W = 4 * q; // 4/4 bar
const n = (pitch: number, d: MelodyEvent['d'] = 'q'): MelodyEvent => ({ pitch, d });
const r = (d: MelodyEvent['d'] = 'q'): MelodyEvent => ({ d });
const show = (m: MelodyEvent[]) => m.map((e) => ('pitch' in e ? `${e.pitch}${e.d}` : `r${e.d}`)).join(' ');
const chords = (p: Progression) => p.bars.map((b) => b.map((s) => s.chord || '·').join('|')).join(' ');
const ok = (e: BarEdit) => {
  if (!e.ok) throw new Error(e.message);
  return e;
};

/** Dm7 | G7 | Cmaj7 | A7, one whole note per bar for bars 1–3. */
const prog = (): Progression => (withFlat(newProgression(), {
  bars: [[{ chord: 'Dm7', scale: 'aeolian' }], [{ chord: 'G7' }], [{ chord: 'Cmaj7' }], [{ chord: 'A7' }]],
  melody: [n(62, 'w'), n(67, 'w'), n(72, 'w')],
}));

describe('test table 8: bar editing', () => {
  it('insert before bar 2: empty bar, later events move one bar later (gap = rests)', () => {
    const e = ok(insertBars(prog(), 1, 2 * W));
    expect(chords(e.progression)).toBe('Dm7 · G7 Cmaj7 A7');
    expect(show(melodyOf(e.progression))).toBe('62w rw 67w 72w');
    expect(e.caret).toBe(3 * W); // caret on the C stays on the C
  });

  it('insert after the melody end changes no events', () => {
    const e = ok(insertBars(prog(), 4, 0));
    expect(show(melodyOf(e.progression))).toBe('62w 67w 72w');
    expect(e.progression.bars).toHaveLength(5);
  });

  it('append "+" adds an empty bar at the end', () => {
    expect(chords(ok(appendBar(prog(), 0)).progression)).toBe('Dm7 G7 Cmaj7 A7 ·');
  });

  it('delete bar 2 removes its events; later events move one bar earlier', () => {
    const e = ok(deleteBars(prog(), 1, 1, 2 * W));
    expect(chords(e.progression)).toBe('Dm7 Cmaj7 A7');
    expect(show(melodyOf(e.progression))).toBe('62w 72w');
    expect(e.caret).toBe(W);
  });

  it('caret in a deleted bar → the start of the bar now in that position, or the form end', () => {
    expect(ok(deleteBars(prog(), 1, 1, W + 2 * q)).caret).toBe(W);
    expect(ok(deleteBars(prog(), 3, 3, 3 * W + q)).caret).toBe(3 * W); // end of the shorter form
    expect(ok(deleteBars(prog(), 1, 2, W + q)).caret).toBe(W); // run
  });

  it('minimum one bar: deleting every bar is refused', () => {
    expect(deleteBars(prog(), 0, 3, 0)).toMatchObject({ ok: false });
    const one = { ...newProgression(), bars: [[{ chord: 'C' }]] };
    expect(deleteBars(one, 0, 0, 0)).toMatchObject({ ok: false });
  });

  it('duplicate bar 1: a copy (chord, override, melody slice) straight after it; later music moves', () => {
    const e = ok(duplicateBars(prog(), 0, 0, 0));
    expect(chords(e.progression)).toBe('Dm7 Dm7 G7 Cmaj7 A7');
    expect(e.progression.bars[1][0].scale).toBe('aeolian');
    expect(show(melodyOf(e.progression))).toBe('62w 62w 67w 72w');
  });

  it('duplicate a partial last bar mid-form pads it so later timing holds', () => {
    const p = withFlat(prog(), { melody: [n(62, 'w'), n(67)] }); // bar 2 partial (one quarter)
    const e = ok(duplicateBars(p, 1, 1, 0));
    expect(show(melodyOf(e.progression))).toBe('62w 67q rq rh 67q');
  });

  it('paste replaces the target bars incl. their melody slice, with no shifting', () => {
    const p = prog();
    const clip = copyBars(p, 0, 1); // Dm7 | G7 with D, G
    const e = ok(pasteBars(p, 2, clip, 0));
    expect(chords(e.progression)).toBe('Dm7 G7 Dm7 G7');
    expect(show(melodyOf(e.progression))).toBe('62w 67w 62w 67w');
    expect(e.progression.bars).toHaveLength(4);
  });

  it('paste of an empty bar replaces the slice with rests (later music keeps its time)', () => {
    const p = prog();
    const e = ok(pasteBars(p, 1, copyBars(p, 3, 3), 0));
    expect(show(melodyOf(e.progression))).toBe('62w rw 72w');
  });

  it('paste is refused past the end of the form', () => {
    const p = prog();
    expect(pasteBars(p, 3, copyBars(p, 0, 1), 0)).toEqual({ ok: false, message: 'not enough bars to paste into' });
  });

  it('split: refused when a note crosses the middle; a crossing rest is re-split', () => {
    const p = prog();
    expect(splitBar(p, 0, 0)).toEqual({ ok: false, message: 'a note crosses the middle of the bar' });
    const halves = withFlat(p, { melody: [n(62, 'h'), n(64, 'h'), r('w'), n(72, 'w')] });
    const e = ok(splitBar(halves, 0, 0));
    expect(chords(e.progression)).toBe('Dm7|· G7 Cmaj7 A7');
    expect(show(melodyOf(e.progression))).toBe('62h 64h rw 72w');
    const rest = ok(splitBar(halves, 1, 0));
    expect(show(melodyOf(rest.progression))).toBe('62h 64h rh rh 72w');
  });

  it("merge keeps the first slot's chord and override; melody untouched", () => {
    const p = withFlat(prog(), { bars: [[{ chord: 'Dm7', scale: 'aeolian' }, { chord: 'G7' }], [{ chord: 'C' }]], melody: [n(62, 'h'), n(67, 'h')] });
    const e = ok(mergeBar(p, 0, 0));
    expect(chords(e.progression)).toBe('Dm7 C');
    expect(e.progression.bars[0][0].scale).toBe('aeolian');
    expect(melodyOf(e.progression)).toBe(melodyOf(p));
  });

  it('split bars carry their halves when bars move', () => {
    const p = withFlat(prog(), { bars: [[{ chord: 'Dm7' }, { chord: 'G7' }], [{ chord: 'C' }]], melody: [n(62, 'h'), n(67, 'h'), n(72, 'w')] });
    const e = ok(insertBars(p, 0, 0));
    expect(chords(e.progression)).toBe('· Dm7|G7 C');
    expect(show(melodyOf(e.progression))).toBe('rw 62h 67h 72w');
  });
});

describe('bar edits carry every etude (issue 079)', () => {
  /** Dm7 | G7 | Cmaj7 | A7; etude A: a whole note in bars 1–3; etude B: a half note in bars 2 and 4. */
  const two = (): Progression => ({
    ...withFlat(prog(), {}),
    etudes: [
      { id: 'a', name: 'A', instrument: 'concert', melody: [n(62, 'w'), n(67, 'w'), n(72, 'w')] },
      { id: 'b', name: 'B', instrument: 'bb-trumpet', melody: [r('w'), n(55, 'h'), r('h'), r('w'), n(57, 'h')] },
    ],
  });
  const both = (p: Progression) => p.etudes.map((e) => show(e.melody));

  it('insert, append and delete move both melodies with their bars', () => {
    expect(both(ok(insertBars(two(), 1, 0)).progression)).toEqual(['62w rw 67w 72w', 'rw rw 55h rh rw 57h']);
    expect(both(ok(appendBar(two(), 0)).progression)).toEqual(both(two()));
    expect(both(ok(deleteBars(two(), 1, 1, 0)).progression)).toEqual(['62w 72w', 'rw rw 57h']);
  });

  it('duplicate copies every etude\'s music in the bars', () => {
    expect(both(ok(duplicateBars(two(), 1, 1, 0)).progression)).toEqual(['62w 67w 67w 72w', 'rw 55h rh 55h rh rw 57h']);
  });

  it('split refuses a note crossing the middle in any etude; merge leaves both melodies', () => {
    const p = two();
    expect(splitBar({ ...p, etudes: [{ ...p.etudes[0], melody: [] }, p.etudes[1]] }, 0, 0).ok).toBe(true); // bar 1: rests only
    expect(splitBar(p, 1, 0)).toEqual({ ok: false, message: 'a note crosses the middle of the bar' }); // A's whole note
    const halves = { ...p, etudes: [{ ...p.etudes[0], melody: [] }, p.etudes[1]] };
    const split = ok(splitBar(halves, 1, 0)).progression; // B: a half note then a rest — nothing crosses
    expect(both(ok(mergeBar(split, 1, 0)).progression)).toEqual(both(split));
  });

  it("copy takes the open etude's slices; paste writes them there and leaves rests in the other etude", () => {
    const p = two();
    const clip = copyBars(p, 1, 1, 'b'); // B's bar 2: 55h rh
    expect(clip.slices).toEqual([[n(55, 'h'), r('h')]]);
    const pasted = ok(pasteBars(p, 2, clip, 0, 'b')).progression; // into bar 3
    expect(pasted.bars[2]).toEqual(p.bars[1]);
    expect(both(pasted)).toEqual(['62w 67w', 'rw 55h rh 55h rh 57h']); // A: rests in bar 3 (trailing, so trimmed)
  });

  it('a time signature change refits both etudes', () => {
    const p = setTimeSignature(two(), '3/4');
    expect(p.etudes.every((e) => e.melody.every((ev) => ev.d !== 'w'))).toBe(true); // no whole notes fit a 3/4 bar
    expect(p.etudes).toHaveLength(2);
  });
});

describe("a slot's trash (Improvise)", () => {
  const split = (): Progression => ({ ...prog(), bars: [[{ chord: 'Dm7', scale: 'aeolian' }, { chord: 'G7', scale: 'lydian-dominant' }], [{ chord: 'C' }]] });
  it('deleting either slot of a split bar leaves the other (chord and override) filling the bar', () => {
    expect(ok(deleteSlot(split(), 0, 0, 0)).progression.bars[0]).toEqual([{ chord: 'G7', scale: 'lydian-dominant' }]);
    expect(ok(deleteSlot(split(), 0, 1, 0)).progression.bars[0]).toEqual([{ chord: 'Dm7', scale: 'aeolian' }]);
  });
  it('a one-chord bar has no slot to delete', () => {
    expect(deleteSlot(split(), 1, 0, 0)).toEqual({ ok: false, message: 'the bar has only one chord' });
  });
});

describe('the clipboard between progressions', () => {
  it('pastes chords and notes into bars of the same length; into another time signature, chords only', () => {
    const clip = copyBars(prog(), 0, 0); // Dm7 (aeolian) + its whole note, a 4/4 bar
    const same = ok(pasteBars({ ...prog(), etudes: [{ ...prog().etudes[0], melody: [] }] }, 1, clip, 0)).progression;
    expect(same.bars[1]).toEqual([{ chord: 'Dm7', scale: 'aeolian' }]);
    expect(show(same.etudes[0].melody)).toBe('rw 62w');
    const waltz = { ...prog(), timeSignature: '3/4', etudes: [{ ...prog().etudes[0], melody: [] }] };
    const other = ok(pasteBars(waltz, 1, clip, 0)).progression;
    expect(other.bars[1]).toEqual([{ chord: 'Dm7', scale: 'aeolian' }]);
    expect(other.etudes[0].melody).toEqual([]); // a 4/4 bar's notes don't fit a 3/4 bar
  });
});
