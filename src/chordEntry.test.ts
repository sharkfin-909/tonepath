// Chord entry (SPEC §4.2) as one step: written text → concert progression, the key's mode for a key chord.
import { describe, expect, it } from 'vitest';
import { enterChord } from './chordEntry';
import { newProgression, type Progression } from './progression';
import { instrumentView } from './view';

const prog = (instrument: string, ...chords: string[]): Progression => ({
  ...newProgression(instrument),
  bars: chords.map((chord) => [{ chord }]),
  melody: [],
});
const enter = (p: Progression, bar: number, text: string) => {
  const r = enterChord(p, instrumentView(p), bar, 0, text);
  if (!r.ok) throw new Error(r.message);
  return r.progression.bars[bar][0];
};

describe('chord entry', () => {
  it('lower-case roots are capitalised; a plain chord keeps its default scale', () => {
    expect(enter(prog('concert', 'C', ''), 1, 'dm7')).toEqual({ chord: 'Dm7' });
  });

  it("one of the key's simple chords takes the key's mode (after G7: F → Lydian, Em → Phrygian)", () => {
    expect(enter(prog('concert', 'G7', ''), 1, 'F')).toEqual({ chord: 'F', scale: 'lydian' });
    expect(enter(prog('concert', 'G7', ''), 1, 'em')).toEqual({ chord: 'Em', scale: 'phrygian' });
    expect(enter(prog('concert', 'G7', ''), 1, 'Dm')).toEqual({ chord: 'Dm' }); // Dorian is already Dm's default
  });

  it('a B♭ trumpet: typed written, stored concert, with the written key\'s mode', () => {
    // Concert G7 reads as written A7 (key of D). Written F#m is iii in D → Phrygian; stored concert Em.
    expect(enter(prog('bb-trumpet', 'G7', ''), 1, 'f#m')).toEqual({ chord: 'Em', scale: 'phrygian' });
  });

  it('a refusal (three symbols in a bar) comes back as a message', () => {
    const p = prog('concert', 'C');
    const r = enterChord(p, instrumentView(p), 0, 0, 'C F G');
    expect(r.ok).toBe(false);
  });
});
