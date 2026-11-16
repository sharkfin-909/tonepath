// Test helper: a progression from the fields a test cares about, with its one etude's melody, instrument and clef
// given flat (as a v2 progression had them).
import { newProgression, type MelodyEvent, type Progression } from './progression';

export interface FlatProgression extends Partial<Omit<Progression, 'etudes'>> {
  melody?: MelodyEvent[];
  instrument?: string;
  concertClef?: 'bass';
}

export function progressionOf({ melody = [], instrument = 'concert', concertClef, ...rest }: FlatProgression = {}): Progression {
  const base = newProgression();
  return {
    ...base,
    ...rest,
    etudes: [{ ...base.etudes[0], instrument, ...(concertClef ? { concertClef } : {}), melody }],
  };
}

/** The first etude's melody. */
export const melodyOf = (p: Progression): MelodyEvent[] => p.etudes[0].melody;

/** `p` with flat v2-style fields applied: `melody`, `instrument`, `concertClef` go to its first etude, the rest to it. */
export function withFlat<T extends FlatProgression & Record<string, unknown>>(
  p: Progression,
  { melody, instrument, concertClef, ...rest }: T,
): Progression & Omit<T, 'melody' | 'instrument' | 'concertClef'> {
  const [first, ...others] = p.etudes;
  const etude = {
    ...first,
    ...(melody !== undefined ? { melody } : {}),
    ...(instrument !== undefined ? { instrument } : {}),
    ...(concertClef !== undefined ? { concertClef } : {}),
  };
  return { ...p, ...rest, etudes: [etude, ...others] } as Progression & Omit<T, 'melody' | 'instrument' | 'concertClef'>;
}
