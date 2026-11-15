import { describe, expect, it } from 'vitest';
import {
  clearEverything,
  clearMelody,
  commitChordText,
  newProgression,
  setBarsPerRow,
  setConcertClef,
  setInstrument,
  setTimeSignature,
  setEtudeName,
  setTitle,
  type Progression,
} from './progression';

const chords = (p: Progression) => p.bars.map((b) => b.map((s) => s.chord).join(' | '));

describe('commitChordText', () => {
  it('one symbol edits the slot, stored as typed', () => {
    const r = commitChordText(newProgression(), 1, 0, '  G7(b9, #11) ');
    expect(r.ok && chords(r.progression)).toEqual(['', 'G7(b9, #11)', '', '']);
    expect(r.ok && r.lastPart).toBe(0);
  });

  it('empty text clears the slot', () => {
    const p = commitChordText(newProgression(), 0, 0, 'Dm7');
    const r = p.ok && commitChordText(p.progression, 0, 0, '   ');
    expect(r && r.ok && r.progression.bars[0][0].chord).toBe('');
  });

  it('two symbols split a one-slot bar', () => {
    const r = commitChordText(newProgression(), 2, 0, 'Em7  A7');
    expect(r.ok && chords(r.progression)).toEqual(['', '', 'Em7 | A7', '']);
    expect(r.ok && r.lastPart).toBe(1);
  });

  it('two symbols overwrite both slots of a split bar from the first, keeping still-valid overrides', () => {
    const p: Progression = {
      ...newProgression(),
      bars: [[{ chord: 'Dm7', scale: 'aeolian' }, { chord: 'G7', scale: 'mixolydian-b6' }]],
    };
    const r = commitChordText(p, 0, 1, 'Em7 E7b9');
    // Aeolian still fits Em7; Mixolydian ♭6 doesn't fit E7b9, so it is dropped.
    expect(r.ok && r.progression.bars[0]).toEqual([{ chord: 'Em7', scale: 'aeolian' }, { chord: 'E7b9' }]);
  });

  it('three or more symbols are refused', () => {
    expect(commitChordText(newProgression(), 0, 0, 'A B C')).toEqual({
      ok: false,
      message: 'a bar holds at most two chords',
    });
  });

  it('unchanged text returns the same progression', () => {
    const p = newProgression();
    const r = commitChordText(p, 0, 0, '');
    expect(r.ok && r.progression).toBe(p);
  });
});

describe('rail settings', () => {
  const withMelody = (): Progression => ({
    ...newProgression(),
    bars: [[{ chord: 'Dm7', scale: 'aeolian' }], [{ chord: 'G7' }], [{ chord: 'Cmaj7' }], [{ chord: '' }]],
    melody: [
      { pitch: 62, d: 'h' },
      { pitch: 65, d: 'h' },
      { pitch: 67, d: 'q' },
    ],
  });

  it('title: trimmed, blank → Untitled, unchanged → same object', () => {
    const p = newProgression();
    expect(setTitle(p, '  Blues in F ').title).toBe('Blues in F');
    expect(setTitle({ ...p, title: 'X' }, '   ').title).toBe('Untitled');
    expect(setTitle(p, 'Untitled')).toBe(p);
  });

  it('etude name: trimmed; blank removes it; unchanged → same object', () => {
    const p = newProgression();
    const named = setEtudeName(p, '  Guide-tone lines ');
    expect(named.etudeName).toBe('Guide-tone lines');
    expect('etudeName' in setEtudeName(named, '   ')).toBe(false);
    expect(setEtudeName(p, '  ')).toBe(p);
    expect(setEtudeName(named, 'Guide-tone lines')).toBe(named);
  });

  it('time signature 3/4 stores as typed and re-fits the melody to the shorter bars', () => {
    const p = setTimeSignature(withMelody(), ' 3/4');
    expect(p.timeSignature).toBe(' 3/4');
    // D h | F h crosses beat 3 → F q + rest q, G keeps its time (beat 5 = bar 2 beat 2)
    expect(p.melody).toEqual([{ pitch: 62, d: 'h' }, { pitch: 65, d: 'q' }, { d: 'q' }, { pitch: 67, d: 'q' }]);
    expect(chords(p)).toEqual(['Dm7', 'G7', 'Cmaj7', '']);
    expect(p.bars[0][0].scale).toBe('aeolian');
  });

  it('time signature 6/8 re-fits too', () => {
    const p = setTimeSignature(withMelody(), '6/8');
    // bars of 6 eighths: D h fits (4e), F h crosses at 6e → F q, rest q (into bar 2), G keeps its time
    expect(p.melody).toEqual([{ pitch: 62, d: 'h' }, { pitch: 65, d: 'q' }, { d: 'q' }, { pitch: 67, d: 'q' }]);
  });

  it('an unparseable time signature is stored as typed and lays out as 4/4 (melody untouched)', () => {
    const p0 = withMelody();
    const p = setTimeSignature(p0, 'waltz');
    expect(p.timeSignature).toBe('waltz');
    expect(p.melody).toBe(p0.melody);
    expect(setTimeSignature(p, 'waltz')).toBe(p);
  });

  it('bars per row: 1–8 only', () => {
    const p = newProgression();
    expect(setBarsPerRow(p, 2).barsPerRow).toBe(2);
    expect(setBarsPerRow(p, 9)).toBe(p);
    expect(setBarsPerRow(p, 0)).toBe(p);
    expect(setBarsPerRow(p, 4)).toBe(p);
  });

  it('test table 4: Clear notes empties the melody, leaves chords, scales and title', () => {
    const p0 = { ...withMelody(), title: 'ii–V–I' };
    const p = clearMelody(p0);
    expect(p.melody).toEqual([]);
    expect(p.bars).toBe(p0.bars);
    expect(p.title).toBe('ii–V–I');
    expect(clearMelody(p)).toBe(p);
  });

  it('Clear all: chords, scale overrides and notes go; bars, splits, title and time signature stay', () => {
    const p0 = { ...withMelody(), title: 'ii–V–I', bars: [[{ chord: 'Dm7', scale: 'aeolian' as const }], [{ chord: 'G7' }, { chord: 'C' }]] };
    const p = clearEverything(p0);
    expect(p.bars).toEqual([[{ chord: '' }], [{ chord: '' }, { chord: '' }]]);
    expect([p.melody, p.title, p.timeSignature]).toEqual([[], 'ii–V–I', p0.timeSignature]);
    expect(clearEverything(p)).toBe(p); // nothing left to clear
  });
});

describe('instrument settings', () => {
  it('switches to known instruments only', () => {
    const p = newProgression();
    expect(setInstrument(p, 'bb-tenor-sax').instrument).toBe('bb-tenor-sax');
    expect(setInstrument(p, 'kazoo')).toBe(p);
    expect(setInstrument(p, 'concert')).toBe(p);
  });

  it('new progressions take a (valid) default instrument', () => {
    expect(newProgression('trombone').instrument).toBe('trombone');
    expect(newProgression('kazoo').instrument).toBe('concert');
  });

  it('concert clef: bass is saved, treble removes the field', () => {
    const p = setConcertClef(newProgression(), 'bass');
    expect(p.concertClef).toBe('bass');
    const t = setConcertClef(p, 'treble');
    expect('concertClef' in t).toBe(false);
    expect(setConcertClef(t, 'treble')).toBe(t);
  });
});

describe('two chords into a one-slot bar (SPEC §4.2 → §4.1 split)', () => {
  it('refused when a note crosses the middle', () => {
    const p = { ...newProgression(), melody: [{ pitch: 60, d: 'w' as const }] };
    expect(commitChordText(p, 0, 0, 'Dm7 G7')).toEqual({ ok: false, message: 'a note crosses the middle of the bar' });
  });

  it('splits when nothing crosses; a crossing rest is re-split', () => {
    const p = { ...newProgression(), melody: [{ d: 'w' as const }, { pitch: 60, d: 'q' as const }] };
    const r = commitChordText(p, 0, 0, 'Dm7 G7');
    expect(r.ok && chords(r.progression)).toEqual(['Dm7 | G7', '', '', '']);
    expect(r.ok && r.progression.melody).toEqual([{ d: 'h' }, { d: 'h' }, { pitch: 60, d: 'q' }]);
  });
});
