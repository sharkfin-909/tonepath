import { describe, expect, it } from 'vitest';
import { INSTRUMENTS, clefOf, concertChordText, hexRange, instrumentOf, moveSymbol, outOfRange, writtenChord } from './instruments';

const tenor = instrumentOf('bb-tenor-sax');
const alto = instrumentOf('eb-alto-sax');

describe('instruments', () => {
  it('has the 16 instruments with stable ids; unknown → Concert', () => {
    expect(INSTRUMENTS.map((i) => i.id)).toEqual([
      'concert', 'flute', 'violin', 'viola', 'cello', 'trombone', 'vibraphone', 'bb-trumpet', 'bb-clarinet', 'bb-soprano-sax',
      'bb-tenor-sax', 'eb-alto-sax', 'eb-baritone-sax', 'f-horn', 'guitar', 'bass',
    ]);
    expect(instrumentOf('kazoo').id).toBe('concert');
  });

  it('viola reads alto clef (C3–E6), cello bass clef (C2–A5), both at pitch', () => {
    expect(instrumentOf('viola')).toMatchObject({ clef: 'alto', semitones: 0, range: { lo: 48, hi: 88 } });
    expect(instrumentOf('cello')).toMatchObject({ clef: 'bass', semitones: 0, range: { lo: 36, hi: 81 } });
  });

  it('semitones match the interval names', () => {
    expect(INSTRUMENTS.map((i) => `${i.id}:${i.semitones}`)).toContain('eb-baritone-sax:21');
    expect(tenor.semitones).toBe(14);
  });

  it('clefs: bass for trombone and bass; Concert follows its choice', () => {
    expect(clefOf(instrumentOf('trombone'))).toBe('bass');
    expect(clefOf(instrumentOf('bass'))).toBe('bass');
    expect(clefOf(instrumentOf('guitar'))).toBe('treble');
    expect(clefOf(instrumentOf('concert'))).toBe('treble');
    expect(clefOf(instrumentOf('concert'), 'bass')).toBe('bass');
  });

  it('written chord symbols move root and bass by interval, quality as typed', () => {
    expect(writtenChord('Dm7', tenor)).toBe('Em7');
    expect(writtenChord('G7(b9)', tenor)).toBe('A7(b9)');
    expect(writtenChord('Bbmaj7', tenor)).toBe('Cmaj7');
    expect(writtenChord('C/E', alto)).toBe('A/C#');
    expect(writtenChord('F7', alto)).toBe('D7');
    expect(writtenChord('Dm7', instrumentOf('guitar'))).toBe('Dm7');
    expect(writtenChord('N.C.', tenor)).toBe('N.C.');
    expect(writtenChord('Xyz', tenor)).toBe('Xyz');
    expect(writtenChord('', tenor)).toBe('');
  });

  it('a double-accidental root is simplified (accepted edge)', () => {
    expect(moveSymbol('Fb7', '-6M')).toBe('G7'); // F♭ down a M6 = A𝄫 → G
  });

  it('typed written chords are stored as concert', () => {
    expect(concertChordText('Em7', tenor)).toBe('Dm7');
    expect(concertChordText('Em7  A7', tenor)).toBe('Dm7 G7');
    expect(concertChordText('A/C#', alto)).toBe('C/E');
    expect(concertChordText('N.C.', tenor)).toBe('N.C.');
  });

  it('round-trips concert → written → concert for common symbols', () => {
    for (const inst of INSTRUMENTS)
      for (const c of ['Dm7', 'G7alt', 'Cmaj7', 'Bbm7', 'F#m7b5', 'Eb7/G'])
        expect(concertChordText(writtenChord(c, inst), inst)).toBe(c);
  });

  it('out of range is in written pitch; Concert never', () => {
    // tenor practical written B♭3–F♯6 = 58–90; concert = written − 14
    expect(outOfRange(44, tenor)).toBe(false); // written 58
    expect(outOfRange(43, tenor)).toBe(true);
    expect(outOfRange(77, tenor)).toBe(true); // written 91
    expect(outOfRange(10, instrumentOf('concert'))).toBe(false);
    expect(hexRange(instrumentOf('concert')).limited).toBe(false);
  });
});
