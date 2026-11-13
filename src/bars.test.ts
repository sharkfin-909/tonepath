// Test table 8 (SPEC §14.8): bar editing.
import { describe, expect, it } from 'vitest';
import { appendBar, copyBars, deleteBars, duplicateBars, insertBars, mergeBar, pasteBars, splitBar, type BarEdit } from './bars';
import { TICKS } from './melody';
import { newProgression, type MelodyEvent, type Progression } from './progression';

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
const prog = (): Progression => ({
  ...newProgression(),
  bars: [[{ chord: 'Dm7', scale: 'aeolian' }], [{ chord: 'G7' }], [{ chord: 'Cmaj7' }], [{ chord: 'A7' }]],
  melody: [n(62, 'w'), n(67, 'w'), n(72, 'w')],
});

describe('test table 8: bar editing', () => {
  it('insert before bar 2: empty bar, later events move one bar later (gap = rests)', () => {
    const e = ok(insertBars(prog(), 1, 2 * W));
    expect(chords(e.progression)).toBe('Dm7 · G7 Cmaj7 A7');
    expect(show(e.progression.melody)).toBe('62w rw 67w 72w');
    expect(e.caret).toBe(3 * W); // caret on the C stays on the C
  });

  it('insert after the melody end changes no events', () => {
    const e = ok(insertBars(prog(), 4, 0));
    expect(show(e.progression.melody)).toBe('62w 67w 72w');
    expect(e.progression.bars).toHaveLength(5);
  });

  it('append "+" adds an empty bar at the end', () => {
    expect(chords(ok(appendBar(prog(), 0)).progression)).toBe('Dm7 G7 Cmaj7 A7 ·');
  });

  it('delete bar 2 removes its events; later events move one bar earlier', () => {
    const e = ok(deleteBars(prog(), 1, 1, 2 * W));
    expect(chords(e.progression)).toBe('Dm7 Cmaj7 A7');
    expect(show(e.progression.melody)).toBe('62w 72w');
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
    expect(show(e.progression.melody)).toBe('62w 62w 67w 72w');
  });

  it('duplicate a partial last bar mid-form pads it so later timing holds', () => {
    const p = { ...prog(), melody: [n(62, 'w'), n(67)] }; // bar 2 partial (one quarter)
    const e = ok(duplicateBars(p, 1, 1, 0));
    expect(show(e.progression.melody)).toBe('62w 67q rq rh 67q');
  });

  it('paste replaces the target bars incl. their melody slice, with no shifting', () => {
    const p = prog();
    const clip = copyBars(p, 0, 1); // Dm7 | G7 with D, G
    const e = ok(pasteBars(p, 2, clip, 0));
    expect(chords(e.progression)).toBe('Dm7 G7 Dm7 G7');
    expect(show(e.progression.melody)).toBe('62w 67w 62w 67w');
    expect(e.progression.bars).toHaveLength(4);
  });

  it('paste of an empty bar replaces the slice with rests (later music keeps its time)', () => {
    const p = prog();
    const e = ok(pasteBars(p, 1, copyBars(p, 3, 3), 0));
    expect(show(e.progression.melody)).toBe('62w rw 72w');
  });

  it('paste is refused past the end of the form', () => {
    const p = prog();
    expect(pasteBars(p, 3, copyBars(p, 0, 1), 0)).toEqual({ ok: false, message: 'not enough bars to paste into' });
  });

  it('split: refused when a note crosses the middle; a crossing rest is re-split', () => {
    const p = prog();
    expect(splitBar(p, 0, 0)).toEqual({ ok: false, message: 'a note crosses the middle of the bar' });
    const halves = { ...p, melody: [n(62, 'h'), n(64, 'h'), r('w'), n(72, 'w')] };
    const e = ok(splitBar(halves, 0, 0));
    expect(chords(e.progression)).toBe('Dm7|· G7 Cmaj7 A7');
    expect(show(e.progression.melody)).toBe('62h 64h rw 72w');
    const rest = ok(splitBar(halves, 1, 0));
    expect(show(rest.progression.melody)).toBe('62h 64h rh rh 72w');
  });

  it("merge keeps the first slot's chord and override; melody untouched", () => {
    const p = { ...prog(), bars: [[{ chord: 'Dm7', scale: 'aeolian' }, { chord: 'G7' }], [{ chord: 'C' }]], melody: [n(62, 'h'), n(67, 'h')] };
    const e = ok(mergeBar(p, 0, 0));
    expect(chords(e.progression)).toBe('Dm7 C');
    expect(e.progression.bars[0][0].scale).toBe('aeolian');
    expect(e.progression.melody).toBe(p.melody);
  });

  it('split bars carry their halves when bars move', () => {
    const p = { ...prog(), bars: [[{ chord: 'Dm7' }, { chord: 'G7' }], [{ chord: 'C' }]], melody: [n(62, 'h'), n(67, 'h'), n(72, 'w')] };
    const e = ok(insertBars(p, 0, 0));
    expect(chords(e.progression)).toBe('· Dm7|G7 C');
    expect(show(e.progression.melody)).toBe('rw 62h 67h 72w');
  });
});
