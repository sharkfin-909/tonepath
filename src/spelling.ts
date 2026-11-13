// Pure `spelling` module (SPEC §5.3): note names for pitches against a slot.
// Chord / scale tones by root + interval with at most one accidental (chord spelling wins);
// chromatics by the slot's lean, else the default set. For an instrument view, callers pass the written chord's
// harmony and written MIDI (instruments.ts).

import { simplify, transpose } from '@tonaljs/note';
import { SCALES, type ScaleId, type SlotHarmony } from './harmony';

const LETTERS = 'CDEFGAB';
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

/** The default set for chromatics with no lean (and every pitch in a grey slot). */
export const DEFAULT_SET = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const SHARPS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLATS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** At most one accidental: double accidentals simplified; Cb / Fb / E# / B# kept. */
export function oneAccidental(name: string): string {
  return /(##|bb)/.test(name) ? simplify(name) : name;
}

/** The pitch-class name root + interval, with at most one accidental. */
export function spellInterval(root: string, interval: string): string {
  return oneAccidental(transpose(root, interval));
}

/** Pitch class (0–11) of a name like `Cb`, `F#`. */
export function pcOfName(name: string): number {
  const letter = LETTER_PC[LETTERS.indexOf(name[0])];
  const acc = [...name.slice(1)].reduce((a, ch) => a + (ch === '#' ? 1 : ch === 'b' ? -1 : 0), 0);
  return mod12(letter + acc);
}

/** Spelled degree: letter distance from the root, 1–7 (SPEC §8.2). */
export function spelledDegree(root: string, name: string): number {
  return ((LETTERS.indexOf(name[0]) - LETTERS.indexOf(root[0]) + 7) % 7) + 1;
}

/** A scale's note names from its root, low → high. */
export function scaleNoteNames(root: string, id: ScaleId): string[] {
  return SCALES[id].intervals.map((iv) => spellInterval(root, iv));
}

export type Lean = 'sharp' | 'flat' | null;

/** Majority of accidentals in the names; a tie or none → null (default set). */
export function leanOf(names: string[]): Lean {
  let sharps = 0;
  let flats = 0;
  for (const n of names) {
    if (n.includes('#')) sharps++;
    if (n.includes('b')) flats++;
  }
  return sharps > flats ? 'sharp' : flats > sharps ? 'flat' : null;
}

/** How a slot names its pitch classes. */
export interface SlotSpelling {
  /** Chord- and scale-tone names by pitch class (chord spelling wins; a slash bass as typed). */
  names: Map<number, string>;
  /** Root for spelled degrees; null in grey slots. */
  root: string | null;
  lean: Lean;
}

export function slotSpelling(h: SlotHarmony): SlotSpelling {
  const names = new Map<number, string>();
  if (h.kind === 'none') return { names, root: null, lean: null };
  const scaleNames = h.scale ? scaleNoteNames(h.root, h.scale) : [];
  for (const n of scaleNames) names.set(pcOfName(n), n);
  const chordNames = h.intervals.map((iv) => spellInterval(h.root, iv));
  for (const n of chordNames) names.set(pcOfName(n), n);
  if (h.bass) names.set(pcOfName(h.bass), h.bass); // named exactly as typed
  // Lean from the scale's names; no-fit slots count the chord tones.
  return { names, root: h.root, lean: leanOf(h.scale ? scaleNames : chordNames) };
}

/** A pitch class's name in a slot. */
export function pcName(pc: number, sp: SlotSpelling): string {
  const p = mod12(pc);
  const known = sp.names.get(p);
  if (known) return known;
  return (sp.lean === 'sharp' ? SHARPS : sp.lean === 'flat' ? FLATS : DEFAULT_SET)[p];
}

/** Scientific pitch name for a MIDI pitch; the octave follows the letter (`Cb4` = 59, `B#3` = 60). */
export function withOctave(name: string, midi: number): string {
  const letter = LETTER_PC[LETTERS.indexOf(name[0])];
  const acc = [...name.slice(1)].reduce((a, ch) => a + (ch === '#' ? 1 : ch === 'b' ? -1 : 0), 0);
  return `${name}${Math.round((midi - letter - acc) / 12) - 1}`;
}

/** A MIDI pitch's full name in a slot, e.g. `Eb4`. */
export function noteName(midi: number, sp: SlotSpelling): string {
  return withOctave(pcName(midi, sp), midi);
}

/** Display form with ♯ / ♭ glyphs. */
export function prettyName(name: string): string {
  return name.replace(/#/g, '♯').replace(/b/g, '♭');
}
