// Test table 3 (SPEC §14.3): spelling.
import { describe, expect, it } from 'vitest';
import { slotHarmony } from './harmony';
import { leanOf, noteName, pcName, scaleNoteNames, slotSpelling, spelledDegree, withOctave } from './spelling';

const sp = (chord: string, scale?: string) => slotSpelling(slotHarmony({ chord, ...(scale ? { scale } : {}) }));
const chordTones = (chord: string) => {
  const h = slotHarmony({ chord });
  if (h.kind !== 'chord') throw new Error(chord);
  const s = slotSpelling(h);
  return h.intervals.map((iv) => {
    const pc = (pcOf(h.root) + semis(iv)) % 12;
    return pcName(pc, s);
  });
};
// tiny helpers for the test only
import { chroma } from '@tonaljs/note';
import { semitones } from '@tonaljs/interval';
const pcOf = (n: string) => chroma(n) ?? 0;
const semis = (iv: string) => semitones(iv) ?? 0;

describe('test table 3: spelling', () => {
  it('Cdim7 → C Eb Gb A (Bbb simplified)', () => expect(chordTones('Cdim7')).toEqual(['C', 'Eb', 'Gb', 'A']));
  it('Gb7 → Gb Bb Db Fb (Fb kept)', () => expect(chordTones('Gb7')).toEqual(['Gb', 'Bb', 'Db', 'Fb']));
  it('Gb Locrian → Gb G A Cb C D Fb', () => expect(scaleNoteNames('Gb', 'locrian')).toEqual(['Gb', 'G', 'A', 'Cb', 'C', 'D', 'Fb']));
  it('A7 chromatic pc 3 → D# (sharp lean)', () => expect(pcName(3, sp('A7'))).toBe('D#'));
  it('Bbm7 chromatic pc 6 → Gb (flat lean)', () => expect(pcName(6, sp('Bbm7'))).toBe('Gb'));
  it('C7#9: the #9 is D# (chord spelling wins over half-whole Eb)', () => expect(pcName(3, sp('C7#9'))).toBe('D#'));
  it('A#7 → A# D E# G# (typed spelling decides; C## → D)', () => expect(chordTones('A#7')).toEqual(['A#', 'D', 'E#', 'G#']));
  it('C/A#: the slash bass is named as typed', () => expect(pcName(10, sp('C/A#'))).toBe('A#'));
  it('a grey slot uses the default set C# Eb F# Ab Bb', () => {
    for (const chord of ['', 'N.C.', 'C4']) {
      expect([1, 3, 6, 8, 10].map((pc) => pcName(pc, sp(chord)))).toEqual(['C#', 'Eb', 'F#', 'Ab', 'Bb']);
    }
  });
  it('no lean (C Ionian) → default set for chromatics', () => {
    expect([1, 3, 6, 8, 10].map((pc) => pcName(pc, sp('Cmaj7')))).toEqual(['C#', 'Eb', 'F#', 'Ab', 'Bb']);
  });
  it('a no-fit chord leans by its chord tones', () => expect(sp('C7sus4b9').lean).toBe('flat'));
  it('an override changes the names', () => expect(pcName(10, sp('Dm7', 'aeolian'))).toBe('Bb'));
});

describe('octaves follow the letter', () => {
  it.each([
    ['Cb', 59, 'Cb4'],
    ['B#', 60, 'B#3'],
    ['C', 60, 'C4'],
    ['Eb', 63, 'Eb4'],
    ['E#', 65, 'E#4'],
  ])('%s at %i → %s', (name, midi, full) => expect(withOctave(name as string, midi as number)).toBe(full));

  it('noteName in a slot', () => expect(noteName(71, sp('Gb7'))).toBe('Cb5'));
});

describe('helpers', () => {
  it('leanOf counts accidentals; a tie is no lean', () => {
    expect(leanOf(['C', 'D', 'E'])).toBeNull();
    expect(leanOf(['F#', 'Bb'])).toBeNull();
    expect(leanOf(['F#', 'C#', 'Bb'])).toBe('sharp');
  });
  it('spelledDegree is the letter distance from the root', () => {
    expect(spelledDegree('G', 'B')).toBe(3);
    expect(spelledDegree('G', 'F')).toBe(7);
    expect(spelledDegree('C', 'D#')).toBe(2);
  });
});
