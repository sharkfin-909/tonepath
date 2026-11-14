// Pure `instruments` module (SPEC §10, §5.3, §7.3): the instrument view. Written = concert + the instrument's
// interval; storage and sound stay concert. Chord symbols move by interval (at most one accidental); every other
// spelling rule then runs against the written symbol.

import { simplify, transpose } from '@tonaljs/note';
import { parseChord, splitSymbols } from './chords';
import { CONCERT_VIEW, type PitchRange } from './hex';

export type Clef = 'treble' | 'bass';

export interface Instrument {
  /** Stable id (saved, exported). */
  id: string;
  name: string;
  /** Written = concert + this interval (tonal name, octave included). */
  interval: string;
  semitones: number;
  /** Practical written range in MIDI; null = Concert (no limit). */
  range: { lo: number; hi: number } | null;
  /** Fixed clef; null = Concert (Treble / Bass choice). */
  clef: Clef | null;
}

const row = (id: string, name: string, interval: string, semitones: number, lo: number, hi: number, clef: Clef = 'treble'): Instrument => ({
  id,
  name,
  interval,
  semitones,
  range: { lo, hi },
  clef,
});

/** SPEC §10, in picker order. MIDI: C4 = 60. */
export const INSTRUMENTS: Instrument[] = [
  { id: 'concert', name: 'Concert', interval: '1P', semitones: 0, range: null, clef: null },
  row('flute', 'Flute', '1P', 0, 60, 96), // C4–C7
  row('violin', 'Violin', '1P', 0, 55, 100), // G3–E7
  row('trombone', 'Trombone', '1P', 0, 40, 70, 'bass'), // E2–B♭4
  row('vibraphone', 'Vibraphone', '1P', 0, 53, 89), // F3–F6
  row('bb-trumpet', 'B♭ trumpet', '2M', 2, 54, 84), // F♯3–C6
  row('bb-clarinet', 'B♭ clarinet', '2M', 2, 52, 93), // E3–A6
  row('bb-soprano-sax', 'B♭ soprano sax', '2M', 2, 58, 90), // B♭3–F♯6
  row('bb-tenor-sax', 'B♭ tenor sax', '9M', 14, 58, 90),
  row('eb-alto-sax', 'E♭ alto sax', '6M', 9, 58, 90),
  row('eb-baritone-sax', 'E♭ baritone sax', '13M', 21, 58, 90),
  row('f-horn', 'F horn', '5P', 7, 48, 79), // C3–G5
  row('guitar', 'Guitar', '8P', 12, 52, 88), // E3–E6
  row('bass', 'Bass', '8P', 12, 40, 67, 'bass'), // E2–G4
];

const BY_ID = new Map(INSTRUMENTS.map((i) => [i.id, i]));

/** The instrument for an id; unknown → Concert. */
export function instrumentOf(id: string | undefined): Instrument {
  return (id && BY_ID.get(id)) || INSTRUMENTS[0];
}

export function isInstrumentId(id: unknown): id is string {
  return typeof id === 'string' && BY_ID.has(id);
}

/** The clef for a progression's view (SPEC §7.3). */
export function clefOf(inst: Instrument, concertClef?: 'bass'): Clef {
  return inst.clef ?? (concertClef === 'bass' ? 'bass' : 'treble');
}

/** The hex range in written MIDI: the practical range, or Concert's fixed C3–C6 view. */
export function hexRange(inst: Instrument): PitchRange {
  return inst.range ? { ...inst.range, limited: true } : CONCERT_VIEW;
}

export const toWritten = (concertMidi: number, inst: Instrument) => concertMidi + inst.semitones;
export const toConcert = (writtenMidi: number, inst: Instrument) => writtenMidi - inst.semitones;

/** Out of the practical written range (flagged, never blocked). Concert: never. */
export function outOfRange(concertMidi: number, inst: Instrument): boolean {
  if (!inst.range) return false;
  const w = toWritten(concertMidi, inst);
  return w < inst.range.lo || w > inst.range.hi;
}

const ROOT = /^\s*([A-G])(#|b|♯|♭)?/;

function moveName(name: string, interval: string): string {
  const n = transpose(name, interval);
  return /(##|bb)/.test(n) ? simplify(n) : n;
}

/**
 * Move one chord symbol by an interval (SPEC §5.3): the root and any slash bass are respelled by interval with at
 * most one accidental; the quality text is kept as typed. Empty, `N.C.` and unparseable symbols are unchanged.
 */
export function moveSymbol(symbol: string, interval: string): string {
  if (interval === '1P' || interval === '8P' || interval === '-8P') return symbol;
  const c = parseChord(symbol);
  if (c.kind !== 'chord') return symbol;
  const m = ROOT.exec(symbol)!;
  let rest = symbol.slice(m[0].length);
  if (c.bass) {
    const slash = rest.lastIndexOf('/');
    rest = `${rest.slice(0, slash)}/${moveName(c.bass, interval)}`;
  }
  return `${symbol.slice(0, m.index)}${moveName(c.root, interval)}${rest}`;
}

/** A stored (concert) chord symbol as shown in an instrument's view. */
export function writtenChord(concert: string, inst: Instrument): string {
  return moveSymbol(concert, inst.interval);
}

/** Typed chord text in an instrument's view → concert text to store (each symbol moved; whitespace normalised). */
export function concertChordText(written: string, inst: Instrument): string {
  if (inst.semitones % 12 === 0) return written;
  return splitSymbols(written)
    .map((s) => moveSymbol(s, `-${inst.interval}`))
    .join(' ');
}
