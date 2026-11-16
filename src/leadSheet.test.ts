// Improvise's lead sheet (SPEC §3.3): the slot's scale, spelled, with each note's degree and role in the chord.
import { describe, expect, it } from 'vitest';
import { slotHarmony } from './harmony';
import { leadTones } from './leadSheet';

const show = (chord: string, scale?: Parameters<typeof slotHarmony>[0]['scale']) =>
  leadTones(slotHarmony({ chord, scale }))?.map((t) => `${t.name}${t.degree}:${t.role[0]}`).join(' ');

describe('lead tones', () => {
  it('a quartad in its default scale: triad, guide tone, scale tones, spelled from the root', () => {
    expect(show('G7')).toBe('G1:t A2:s B3:t C4:s D5:t E6:s F7:g'); // G Mixolydian
    expect(show('Dm7')).toBe('D1:t E2:s F3:t G4:s A5:t B6:s C7:g'); // D Dorian
  });
  it('flats spell as flats; an override changes the notes', () => {
    expect(show('Bbmaj7')).toBe('Bb1:t C2:s D3:t Eb4:s F5:t G6:s A7:g');
    expect(show('G7alt')).toBe('G1:t Ab2:s Bb3:c B3:t Db5:s Eb6:t F7:g'); // G altered: the #9 (B♭) a chord tone, the #5 (E♭) the triad's 5th
    expect(show('Dm7', 'phrygian')).toBe('D1:t Eb2:s F3:t G4:s A5:t Bb6:s C7:g'); // an override changes the notes
  });
  it('extensions are chord tones; a triad has no guide tone', () => {
    expect(show('C9')).toBe('C1:t D2:c E3:t F4:s G5:t A6:s Bb7:g');
    expect(show('C')).toBe('C1:t D2:s E3:t F4:s G5:t A6:s B7:s');
  });
  it('no chord: nothing', () => {
    expect(leadTones(slotHarmony({ chord: 'N.C.' }))).toBeNull();
    expect(leadTones(slotHarmony({ chord: '' }))).toBeNull();
  });
});
