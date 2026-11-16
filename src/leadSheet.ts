// Pure `leadSheet` module (SPEC §3.3): what Improvise's lead sheet shows in place of the stave — the slot's scale,
// spelled from its root, each note with its spelled degree (1–7, the hex's degree colour) and its role in the chord:
// a triad tone, the guide tone (the 7th or 6th of a quartad), another chord tone (an extension), or a scale tone.
// A chord no scale fits shows its chord tones only; a slot without a chord shows nothing.
// Pure: no React.

import { guidePitchClasses, pcOf, triadPitchClasses, type SlotHarmony } from './harmony';
import { pcOfName, scaleNoteNames, spellInterval, spelledDegree } from './spelling';

export type ToneRole = 'triad' | 'guide' | 'chord' | 'scale';

export interface LeadTone {
  /** Spelled name, no octave (`Bb`, `F#`). */
  name: string;
  /** Spelled degree from the root, 1–7. */
  degree: number;
  role: ToneRole;
}

/** The slot's tones for the lead sheet, low → high from the root; null without a chord. Written pitch in, written out. */
export function leadTones(h: SlotHarmony): LeadTone[] | null {
  if (h.kind !== 'chord') return null;
  const triad = triadPitchClasses(h);
  const guide = guidePitchClasses(h);
  const roleOf = (pc: number): ToneRole => (triad.has(pc) ? 'triad' : guide.has(pc) ? 'guide' : h.chordTones.has(pc) ? 'chord' : 'scale');
  const names = h.scale
    ? scaleNoteNames(h.root, h.scale)
    : // No scale fits: the chord's own tones, in interval order (no repeats).
      [...new Map(h.intervals.map((iv) => [pcOf(h.root, iv), spellInterval(h.root, iv)])).values()];
  return names.map((name) => ({ name, degree: spelledDegree(h.root, name), role: roleOf(((pcOfName(name) % 12) + 12) % 12) }));
}

/**
 * The lead sheet's little hex (SPEC §3.3): the tones in rows from the bottom — pairs, the top row taking the rest —
 * so a 7-note scale stacks as [1 2] [3 4] [5 6 7], each row half a cell left of the one below (up-left = a third, as on
 * the docked hex). Bottom row first.
 */
export function leadRows<T>(tones: T[]): T[][] {
  const rows: T[][] = [];
  let i = 0;
  while (tones.length - i > 3 && rows.length < 2) {
    rows.push(tones.slice(i, i + 2));
    i += 2;
  }
  if (i < tones.length) rows.push(tones.slice(i));
  return rows;
}
