// Pure `standards` module (SPEC §3.12): the standard progressions — built in, read-only, each with a frozen id
// (`std/…`) whose chords never change once released (a fix ships as a new id; the old one stays). Your etudes over a
// standard are stored under its id; every read puts the frozen title, time signature and bars back over the stored
// record, so the chords can't drift. Opening and copying them: `library.ts`.
import rhythmChanges from '../examples/rhythm-changes.tonepath.json';
import type { Bar, Progression } from './progression';

export interface Standard {
  id: string;
  title: string;
  timeSignature: string;
  barsPerRow: number;
  bars: Bar[];
}

/** `F7 | Bb7 | Cm7 F7` → one bar per `|`; two chords in a bar split it. */
export function barsOf(text: string): Bar[] {
  return text.split('|').map((b) => b.trim().split(/\s+/).map((chord) => ({ chord })));
}

const std = (id: string, title: string, bars: string | Bar[], timeSignature = '4/4'): Standard => ({
  id: `std/${id}`,
  title,
  timeSignature,
  barsPerRow: 4,
  bars: typeof bars === 'string' ? barsOf(bars) : bars,
});

/** The first set: the generic forms (SPEC §3.12). Public-domain tunes join later, each its own frozen entry. */
export const STANDARDS: readonly Standard[] = [
  std('12-bar-blues-f', '12-bar blues in F', 'F7 | Bb7 | F7 | F7 | Bb7 | Bb7 | F7 | F7 | C7 | Bb7 | F7 | C7'),
  std('jazz-blues-f', 'Jazz blues in F', 'F7 | Bb7 | F7 | Cm7 F7 | Bb7 | Bdim7 | F7 | Am7 D7 | Gm7 | C7 | F7 D7 | Gm7 C7'),
  std('minor-blues-c', 'Minor blues in C', 'Cm7 | Fm7 | Cm7 | Cm7 | Fm7 | Fm7 | Cm7 | Cm7 | Ab7 | G7 | Cm7 | G7'),
  // The demo's changes (32 bars AABA, in-key scale overrides on the A sections), without its etude.
  std('rhythm-changes-bb', 'Rhythm changes in B♭', rhythmChanges.progression.bars as Bar[]),
  std(
    'ii-v-i-major',
    'ii–V–I in four keys',
    'Dm7 | G7 | Cmaj7 | Cmaj7 | Gm7 | C7 | Fmaj7 | Fmaj7 | Cm7 | F7 | Bbmaj7 | Bbmaj7 | Fm7 | Bb7 | Ebmaj7 | Ebmaj7',
  ),
  std(
    'ii-v-i-minor',
    'Minor ii–V–i in four keys',
    'Dm7b5 | G7b9 | Cm7 | Cm7 | Gm7b5 | C7b9 | Fm7 | Fm7 | Cm7b5 | F7b9 | Bbm7 | Bbm7 | Fm7b5 | Bb7b9 | Ebm7 | Ebm7',
  ),
  std('turnaround-c', 'I–vi–ii–V turnaround in C', 'Cmaj7 Am7 | Dm7 G7 | Cmaj7 Am7 | Dm7 G7'),
  std('dorian-vamp-d', 'Dorian vamp in D', 'Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7 | Dm7'),
];

/** Where a first ever launch lands (SPEC §3.0): grid improv on the 12-bar blues. */
export const FIRST_STANDARD = 'std/12-bar-blues-f';

export const isStandardId = (id: string): boolean => id.startsWith('std/');

export const standardOf = (id: string): Standard | undefined => STANDARDS.find((s) => s.id === id);

/** A stored standard with its frozen title, time signature and bars put back (anything else passes through). */
export function withStandard<T extends Progression & { id: string }>(p: T): T {
  const s = standardOf(p.id);
  if (!s) return p;
  return { ...p, title: s.title, timeSignature: s.timeSignature, barsPerRow: s.barsPerRow, bars: s.bars.map((b) => b.map((x) => ({ ...x }))) };
}

/** My progressions: the library's rows less the standards (they have their own section). */
export const listMine = <T extends { id: string }>(all: T[]): T[] => all.filter((p) => !isStandardId(p.id));
