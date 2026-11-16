// Voicings for ▶ Chord, ▶ Scale and Root note (SPEC §9).
import { describe, expect, it } from 'vitest';
import { bassNote, chordVoicing, midiToHz, rootNote, scaleRun } from './audio';
import { onArrivalOf } from './device';
import { slotHarmony } from './harmony';

const h = (chord: string, scale?: string) => slotHarmony({ chord, ...(scale ? { scale } : {}) });

describe('▶ Chord voicing', () => {
  it.each<[string, number[]]>([
    ['C', [48, 52, 55]],
    ['Dm7', [50, 53, 57, 60]], // D3 F3 A3 C4: root in octave 3, close above
    ['G7', [55, 59, 62, 65]],
    ['C6', [48, 52, 55, 57]],
    ['Cmaj9', [48, 52, 55, 59, 62]], // 9 above the 7th
    ['G13', [55, 59, 62, 65, 69, 76]], // 1 3 5 b7 9 13
    ['G7b9#11', [55, 59, 62, 65, 68, 73]],
    ['C7alt', [48, 52, 56, 58, 63]], // #5 replaces the 5th; #9 above the 7th
    ['Csus4', [48, 53, 55]],
  ])('%s → %j', (chord, midis) => expect(chordVoicing(h(chord))).toEqual(midis));

  it('slash bass an octave below the root, not doubled', () => {
    expect(chordVoicing(h('C/Bb'))).toEqual([46, 48, 52, 55]); // Bb2 under C3 E3 G3
    expect(chordVoicing(h('C/E'))).toEqual([40, 48, 55]); // E2; the upper E dropped
    expect(chordVoicing(h('C/C'))).toEqual([36, 52, 55]);
  });

  it('is silent without a chord', () => {
    for (const c of ['', 'N.C.', 'C4']) expect(chordVoicing(h(c))).toEqual([]);
  });
});

describe('▶ Scale run', () => {
  it('one octave from the tonic in octave 4, top tonic included', () => {
    expect(scaleRun(h('Dm7'))).toEqual([62, 64, 65, 67, 69, 71, 72, 74]);
    expect(scaleRun(h('Bbm7'))).toEqual([70, 72, 73, 75, 77, 79, 80, 82]);
  });
  it('follows the override, and 6- / 8-note scales', () => {
    expect(scaleRun(h('Dm7', 'aeolian'))).toEqual([62, 64, 65, 67, 69, 70, 72, 74]);
    expect(scaleRun(h('C7#5'))).toHaveLength(7); // whole-tone: 6 + top
    expect(scaleRun(h('G7b9'))).toHaveLength(9); // half-whole: 8 + top
  });
  it('a no-fit chord plays its chord tones over one octave', () => {
    expect(scaleRun(h('C7sus4b9'))).toEqual([60, 61, 65, 67, 70, 72]);
  });
  it('is silent without a chord', () => expect(scaleRun(h('N.C.'))).toEqual([]));
});

describe('Root note', () => {
  it('chord bass in octave 3; the slash bass if any', () => {
    expect(rootNote(h('G7'))).toBe(55);
    expect(rootNote(h('C/Bb'))).toBe(58);
    expect(rootNote(h('N.C.'))).toBeNull();
  });
});

describe('Bass note', () => {
  it('an octave below the root note (octave 2); the slash bass if any', () => {
    expect(bassNote(h('G7'))).toBe(43);
    expect(bassNote(h('C/Bb'))).toBe(46);
    expect(bassNote(h('N.C.'))).toBeNull();
  });
  it('the on-arrival setting reads every option; anything else is Silent', () => {
    for (const v of ['silent', 'chord', 'root', 'bass', 'bass-chord'] as const) expect(onArrivalOf({ playArrival: v })).toBe(v);
    expect(onArrivalOf({ playArrival: 'loud' as never })).toBe('silent');
  });
});

it('A4 = 440 Hz', () => expect(midiToHz(69)).toBe(440));
