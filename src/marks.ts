// Pure note marks (SPEC §7.2): out of scale (pitch not in its owning slot's scale, or for a no-fit chord not one of
// its tones) and out of range (written pitch outside the instrument's practical range), with the hover reason.
// Everything here is in written pitch, against the owning slot's written harmony.

import { scaleLabel, stepPitchClasses, type SlotHarmony } from './harmony';
import type { Instrument } from './instruments';
import { prettyName } from './spelling';

export interface NoteMark {
  outOfScale: boolean;
  range: 'above' | 'below' | null;
  /** Tooltip, e.g. "not in G altered · above B♭ trumpet range"; null when unmarked. */
  reason: string | null;
}

export function noteMark(writtenMidi: number, h: SlotHarmony, chord: string, inst: Instrument): NoteMark {
  const pcs = stepPitchClasses(h);
  const outOfScale = !pcs || !pcs.has(((writtenMidi % 12) + 12) % 12);
  const range = !inst.range ? null : writtenMidi > inst.range.hi ? 'above' : writtenMidi < inst.range.lo ? 'below' : null;
  const reasons: string[] = [];
  if (outOfScale) {
    if (h.kind === 'none') {
      reasons.push(h.reason === 'nc' ? 'N.C.: no scale here' : h.reason === 'empty' ? 'no chord in this slot' : 'chord not recognised');
    } else if (h.scale) reasons.push(`not in ${prettyName(scaleLabel(h.root, h.scale))}`);
    else reasons.push(`not a chord tone of ${prettyName(chord.trim())}`);
  }
  if (range) reasons.push(`${range} ${inst.name} range`);
  return { outOfScale, range, reason: reasons.length ? reasons.join(' · ') : null };
}

