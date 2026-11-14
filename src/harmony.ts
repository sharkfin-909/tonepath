// Pure `harmony` module (SPEC §5.1–5.2): chord family, chord tones, ranked scale list,
// first-fit default scale, override validity, and pitch-class classification against a slot.
// Terms per CONTEXT.md. Everything is by pitch class (0–11); spelling lives in `spelling`.

import { chroma } from '@tonaljs/note';
import { semitones } from '@tonaljs/interval';
import { parseChord, type ChordParse } from './chords';
import type { Slot } from './progression';

export type ScaleId =
  | 'ionian'
  | 'dorian'
  | 'phrygian'
  | 'lydian'
  | 'mixolydian'
  | 'aeolian'
  | 'locrian'
  | 'locrian-nat2'
  | 'melodic-minor'
  | 'harmonic-minor'
  | 'lydian-augmented'
  | 'lydian-dominant'
  | 'mixolydian-b6'
  | 'altered'
  | 'phrygian-dominant'
  | 'whole-tone'
  | 'half-whole-diminished'
  | 'whole-half-diminished';

export interface ScaleType {
  id: ScaleId;
  name: string;
  /** Tonal interval names from the root, ascending. The letter of each interval is its spelled degree. */
  intervals: string[];
}

/** The 18 scale types (SPEC §12.2: stable ids, never renamed or reused). */
export const SCALES: Record<ScaleId, ScaleType> = Object.fromEntries(
  (
    [
      ['ionian', 'Ionian', '1P 2M 3M 4P 5P 6M 7M'],
      ['dorian', 'Dorian', '1P 2M 3m 4P 5P 6M 7m'],
      ['phrygian', 'Phrygian', '1P 2m 3m 4P 5P 6m 7m'],
      ['lydian', 'Lydian', '1P 2M 3M 4A 5P 6M 7M'],
      ['mixolydian', 'Mixolydian', '1P 2M 3M 4P 5P 6M 7m'],
      ['aeolian', 'Aeolian', '1P 2M 3m 4P 5P 6m 7m'],
      ['locrian', 'Locrian', '1P 2m 3m 4P 5d 6m 7m'],
      ['locrian-nat2', 'Locrian ♮2', '1P 2M 3m 4P 5d 6m 7m'],
      ['melodic-minor', 'Melodic minor', '1P 2M 3m 4P 5P 6M 7M'],
      ['harmonic-minor', 'Harmonic minor', '1P 2M 3m 4P 5P 6m 7M'],
      ['lydian-augmented', 'Lydian augmented', '1P 2M 3M 4A 5A 6M 7M'],
      ['lydian-dominant', 'Lydian dominant', '1P 2M 3M 4A 5P 6M 7m'],
      ['mixolydian-b6', 'Mixolydian ♭6', '1P 2M 3M 4P 5P 6m 7m'],
      ['altered', 'Altered', '1P 2m 3m 3M 5d 6m 7m'],
      ['phrygian-dominant', 'Phrygian dominant', '1P 2m 3M 4P 5P 6m 7m'],
      ['whole-tone', 'Whole-tone', '1P 2M 3M 4A 5A 7m'],
      ['half-whole-diminished', 'Half-whole diminished', '1P 2m 3m 3M 4A 5P 6M 7m'],
      ['whole-half-diminished', 'Whole-half diminished', '1P 2M 3m 4P 5d 6m 6M 7M'],
    ] as const
  ).map(([id, name, ivs]) => [id, { id, name, intervals: ivs.split(' ') }]),
) as Record<ScaleId, ScaleType>;

export function isScaleId(x: unknown): x is ScaleId {
  return typeof x === 'string' && Object.prototype.hasOwnProperty.call(SCALES, x);
}

export type Family = 'major' | 'dominant' | 'sus' | 'minor' | 'half-diminished' | 'diminished' | 'augmented';

/** Ranked scale list per family (SPEC §5.2). */
export const RANKED: Record<Family, ScaleId[]> = {
  major: ['ionian', 'lydian', 'lydian-augmented'],
  dominant: [
    'mixolydian',
    'lydian-dominant',
    'whole-tone',
    'mixolydian-b6',
    'half-whole-diminished',
    'phrygian-dominant',
    'altered',
  ],
  sus: ['mixolydian', 'ionian', 'dorian'],
  minor: ['dorian', 'aeolian', 'phrygian', 'melodic-minor', 'harmonic-minor'],
  'half-diminished': ['locrian', 'locrian-nat2'],
  diminished: ['whole-half-diminished'],
  augmented: ['whole-tone', 'lydian-augmented'],
};

type ParsedChord = Extract<ChordParse, { kind: 'chord' }>;

/** The chord's family, from its 3rd / 5th / 7th (SPEC §5.2; power chords count as major, per Note classification). */
export function familyOf(intervals: string[]): Family {
  const has = (iv: string) => intervals.includes(iv);
  const seventh = has('7m') ? 'm' : has('7M') ? 'M' : has('7d') ? 'd' : null;
  if (has('3M')) {
    if (seventh === 'm') return 'dominant';
    if (has('5A') && !seventh) return 'augmented';
    return 'major';
  }
  if (has('3m')) {
    if (has('5d')) return seventh === 'm' ? 'half-diminished' : 'diminished';
    return 'minor';
  }
  // No 3rd: a bare power chord (1 5) is major; sus2 / sus4 / 7sus4 / 11 are sus.
  return intervals.every((iv) => iv === '1P' || iv === '5P') ? 'major' : 'sus';
}

const pcOf = (root: string, interval: string) => (((chroma(root) ?? 0) + (semitones(interval) ?? 0)) % 12 + 12) % 12;

/** Pitch classes of a scale type built on a root. */
export function scalePitchClasses(root: string, id: ScaleId): Set<number> {
  return new Set(SCALES[id].intervals.map((iv) => pcOf(root, iv)));
}

/** The harmony of one slot. `none` = empty, unparseable or `N.C.`: no chord tones, no scale. */
export type SlotHarmony =
  | { kind: 'none'; reason: 'empty' | 'invalid' | 'nc' }
  | {
      kind: 'chord';
      root: string;
      /** Chord intervals from the root (tonal names), as parsed; the bass is separate. */
      intervals: string[];
      bass?: string;
      family: Family;
      /** Chord-tone pitch classes, incl. a slash bass (SPEC §5.1). */
      chordTones: Set<number>;
      /** Scale override menu = filtered ranked list; the first is the default. Empty = no scale fits. */
      candidates: ScaleId[];
      /** The slot scale: the override if it is a candidate, else the default; null when no scale fits. */
      scale: ScaleId | null;
      /** True when `scale` comes from a valid override. */
      overridden: boolean;
    };

/**
 * The family's ranked scales that contain every chord tone (bass excluded). If none does and the chord has a
 * natural 5th next to a b13 (`7#9b13`), the fit is retried without that 5th — jazz drops it there, and the
 * spec's worked list puts `7#9b13` on the altered scale. Choice beyond the spec.
 */
export function candidateScales(c: ParsedChord): ScaleId[] {
  const family = familyOf(c.intervals);
  const fits = (ivs: string[]) => {
    const pcs = ivs.map((iv) => pcOf(c.root, iv));
    return RANKED[family].filter((id) => {
      const scale = scalePitchClasses(c.root, id);
      return pcs.every((pc) => scale.has(pc));
    });
  };
  const all = fits(c.intervals);
  if (all.length > 0 || !(c.intervals.includes('5P') && c.intervals.includes('13m'))) return all;
  return fits(c.intervals.filter((iv) => iv !== '5P'));
}

/** Analyse a slot's chord symbol and override. */
export function slotHarmony(slot: Pick<Slot, 'chord' | 'scale'>): SlotHarmony {
  const c = parseChord(slot.chord);
  if (c.kind !== 'chord') return { kind: 'none', reason: c.kind };
  const candidates = candidateScales(c);
  const overridden = isScaleId(slot.scale) && candidates.includes(slot.scale);
  const chordTones = new Set(c.intervals.map((iv) => pcOf(c.root, iv)));
  if (c.bass) chordTones.add(chroma(c.bass) ?? 0);
  return {
    kind: 'chord',
    root: c.root,
    intervals: c.intervals,
    ...(c.bass ? { bass: c.bass } : {}),
    family: familyOf(c.intervals),
    chordTones,
    candidates,
    scale: overridden ? (slot.scale as ScaleId) : (candidates[0] ?? null),
    overridden,
  };
}

/** The slot with its override kept only if it is still a candidate for its chord (SPEC §5.2: else silently dropped). */
export function withValidOverride<S extends Slot>(slot: S): S {
  if (slot.scale === undefined) return slot;
  const h = slotHarmony(slot);
  if (h.kind === 'chord' && h.overridden) return slot;
  const { scale: _dropped, ...rest } = slot;
  return rest as S;
}

/**
 * The chord's triad pitch classes: root, 3rd and 5th as spelled (altered 5ths included); a chord with no 3rd
 * takes its sus 2nd / 4th in its place. Everything else (6ths, 7ths, extensions, a slash bass) is not triad.
 */
export function triadPitchClasses(h: Extract<SlotHarmony, { kind: 'chord' }>): Set<number> {
  const num = (iv: string) => Number(/^\d+/.exec(iv)?.[0]);
  const hasThird = h.intervals.some((iv) => num(iv) === 3);
  const core = h.intervals.filter((iv) => [1, 3, 5].includes(num(iv)) || (!hasThird && [2, 4].includes(num(iv))));
  return new Set(core.map((iv) => pcOf(h.root, iv)));
}

export type PitchRole = 'chord' | 'scale' | 'chromatic';

/** Classify a pitch (MIDI or pitch class) against a slot: chord tone > scale tone > chromatic. */
export function classify(pitch: number, h: SlotHarmony): PitchRole {
  if (h.kind === 'none') return 'chromatic';
  const pc = ((pitch % 12) + 12) % 12;
  if (h.chordTones.has(pc)) return 'chord';
  if (h.scale && scalePitchClasses(h.root, h.scale).has(pc)) return 'scale';
  return 'chromatic';
}

/** Display name of a scale on a root: "D Dorian". */
export function scaleLabel(root: string, id: ScaleId): string {
  return `${root} ${SCALES[id].name}`;
}

/** The pitch classes a nudge steps through (SPEC §6.2 item 8): the slot scale, or a no-fit chord's own tones (§8.4). */
export function stepPitchClasses(h: SlotHarmony): Set<number> | null {
  if (h.kind !== 'chord') return null;
  return h.scale ? scalePitchClasses(h.root, h.scale) : h.chordTones;
}
