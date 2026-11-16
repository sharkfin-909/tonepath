// Pure `key` module (CONTEXT.md: Key). The key a slot is in — the notes of its slot scale — and what follows from it:
// whether two slots share a key, how many scale steps lie between two roots in it, and the key's simple chords for an
// empty chord field (SPEC §4.2). One definition, asked by chord suggestions, chord entry and the hex travel (§8.2).

import type { ScaleId, SlotHarmony } from './harmony';
import { pcOfName, scaleNoteNames } from './spelling';

export interface Key {
  /** The scale's pitch classes, ascending from 0: two slots share a key when these match. */
  pcs: number[];
  /** Spelled note names in `pcs` order. */
  names: string[];
  /** The tonic pitch class of the major key this is a mode of; null for other scales (altered, harmonic minor, …). */
  major: number | null;
}

const MAJOR_STEPS = [0, 2, 4, 5, 7, 9, 11];
const MODES: ScaleId[] = ['ionian', 'dorian', 'phrygian', 'lydian', 'mixolydian', 'aeolian', 'locrian'];
const mod12 = (n: number) => ((n % 12) + 12) % 12;

/** The key of a slot: the notes of its scale. Null without a scale (no chord, or the chord-tones hex). */
export function keyOf(h: SlotHarmony): Key | null {
  if (h.kind !== 'chord' || !h.scale) return null;
  const spelled = scaleNoteNames(h.root, h.scale).map((name) => ({ name, pc: mod12(pcOfName(name)) }));
  spelled.sort((a, b) => a.pc - b.pc);
  const pcs = spelled.map((s) => s.pc);
  const major = pcs.length === 7 ? (pcs.find((t) => MAJOR_STEPS.every((s) => pcs.includes(mod12(t + s)))) ?? null) : null;
  return { pcs, names: spelled.map((s) => s.name), major };
}

/** Melodic and harmonic minor, from the tonic. */
const MELODIC_STEPS = [0, 2, 3, 5, 7, 9, 11];
const HARMONIC_STEPS = [0, 2, 3, 5, 7, 8, 11];

/**
 * The key pill's name (SPEC §3.1): the parent scale the notes come from. A mode of a major key → its tonic (`C`,
 * `Bb`); a mode of melodic or harmonic minor → its tonic and a tag (`Ab mel`, `C harm`); whole-tone and diminished,
 * which have no tonic → `whole-tone`, `dim`. The tonic is spelled as the slot's scale spells it. Null for anything else.
 */
export function keyName(key: Key): string | null {
  const nameOf = (pc: number) => key.names[key.pcs.indexOf(pc)];
  if (key.major !== null) return nameOf(key.major);
  const parent = (steps: number[]) => (key.pcs.length === 7 ? key.pcs.find((t) => steps.every((s) => key.pcs.includes(mod12(t + s)))) : undefined);
  const mel = parent(MELODIC_STEPS);
  if (mel !== undefined) return `${nameOf(mel)} mel`;
  const harm = parent(HARMONIC_STEPS);
  if (harm !== undefined) return `${nameOf(harm)} harm`;
  if (key.pcs.length === 6) return 'whole-tone';
  if (key.pcs.length === 8) return 'dim';
  return null;
}

/** Both slots use the same notes. */
export function sameKey(a: Key | null, b: Key | null): boolean {
  return !!a && !!b && a.pcs.join() === b.pcs.join();
}

/** Scale steps from one root up to another within the key (0 … size − 1), or null if either isn't in it. */
export function stepsUp(key: Key, fromPc: number, toPc: number): number | null {
  const a = key.pcs.indexOf(mod12(fromPc));
  const b = key.pcs.indexOf(mod12(toPc));
  if (a < 0 || b < 0) return null;
  const n = key.pcs.length;
  return (((b - a) % n) + n) % n;
}

export interface KeyChord {
  symbol: string;
  /** The key's mode on this chord's root: committing the chord sets it as the slot scale, so the key holds. */
  scale: ScaleId;
}

const C_MAJOR: Key = { pcs: MAJOR_STEPS, names: ['C', 'D', 'E', 'F', 'G', 'A', 'B'], major: 0 };

/**
 * The key's simple chords to offer in an empty chord field (SPEC §4.2): the 7 diatonic triads of the major key of the
 * nearest earlier slot whose scale is a mode of one (G7 → G Mixolydian → C major), spelled as that scale spells them,
 * minus the triad on that slot's own root ("the other 6"). No such slot: all 7 of C major.
 * `earlier` = the harmonies before the slot being edited, nearest first.
 */
export function keyChords(earlier: SlotHarmony[]): KeyChord[] {
  for (const h of earlier) {
    const key = keyOf(h);
    if (!key || key.major === null || h.kind !== 'chord') continue;
    const own = mod12(pcOfName(h.root));
    return triads(key).filter((_, i) => mod12(key.major! + MAJOR_STEPS[i]) !== own);
  }
  return triads(C_MAJOR);
}

/** Triads on each degree of a major key, I ii iii IV V vi vii°, each with its mode. */
function triads(key: Key): KeyChord[] {
  return MAJOR_STEPS.map((s, i) => {
    const name = key.names[key.pcs.indexOf(mod12(key.major! + s))];
    return { symbol: name + ['', 'm', 'm', '', '', 'm', 'dim'][i], scale: MODES[i] };
  });
}
