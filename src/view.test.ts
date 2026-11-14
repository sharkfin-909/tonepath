// The Instrument view (SPEC §5.3, §10): written chords, harmony, names and marks per slot, computed once.
import { describe, expect, it } from 'vitest';
import { newProgression, type Progression } from './progression';
import { instrumentView } from './view';

const prog = (instrument: string, ...chords: string[]): Progression => ({
  ...newProgression(),
  instrument,
  bars: chords.map((chord) => [{ chord }]),
  melody: [],
});

describe('instrument view', () => {
  it('Concert: chords as stored, written = concert', () => {
    const v = instrumentView(prog('concert', 'Dm7', 'G7'));
    expect(v.slots.map((s) => s.chord)).toEqual(['Dm7', 'G7']);
    expect(v.toWritten(60)).toBe(60);
    expect(v.name(65, v.slots[0])).toBe('F4');
  });

  it('B♭ tenor sax: chords, names and the hex are written (a major 9th up); sound stays concert', () => {
    const v = instrumentView(prog('bb-tenor-sax', 'Dm7', 'Bbmaj7'));
    expect(v.slots.map((s) => s.chord)).toEqual(['Em7', 'Cmaj7']);
    expect(v.slots[0].harmony.kind === 'chord' && v.slots[0].harmony.root).toBe('E');
    expect(v.slots[0].concert.kind === 'chord' && v.slots[0].concert.root).toBe('D');
    expect(v.toWritten(62)).toBe(76);
    expect(v.toConcert(v.toWritten(62))).toBe(62);
    expect(v.name(62, v.slots[0])).toBe('E5');
    expect(v.slots[0].scaleText).toBe('E Dorian');
    expect(v.dock(0).hex.cells.find((c) => c.degree === 1)!.name).toBe('E');
  });

  it('marks use the written harmony and the instrument range', () => {
    const v = instrumentView(prog('bb-tenor-sax', 'Dm7'));
    expect(v.mark(62, v.slots[0])).toMatchObject({ outOfScale: false });
    expect(v.mark(63, v.slots[0])).toMatchObject({ outOfScale: true });
    expect(v.mark(20, v.slots[0])).toMatchObject({ range: 'below' });
  });

  it('slotAt: the slot holding a time; the last slot at the end of the form', () => {
    const v = instrumentView(prog('concert', 'C', 'F'));
    expect(v.slotAt(0).index).toBe(0);
    expect(v.slotAt(v.end).index).toBe(1);
    expect(v.slotAt(v.end + 999).index).toBe(1);
  });

  it('used chords: written, distinct, in order, no empties', () => {
    expect(instrumentView(prog('concert', 'Dm7', '', 'G7', 'Dm7')).usedChords).toEqual(['Dm7', 'G7']);
  });

  it('readout scale text', () => {
    const v = instrumentView(prog('concert', 'Dm7', 'N.C.', 'C7sus4b9'));
    expect(v.slots.map((s) => s.scaleText)).toEqual(['D Dorian', '—', 'no scale fits']);
  });
});
