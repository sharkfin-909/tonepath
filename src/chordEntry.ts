// Pure `chordEntry` module (SPEC §4.2): what pressing Enter / Tab in a chord field does, as one step.
// The typed (written) text → the next progression: root letters capitalised, transposed to concert for the
// instrument, split / validated by the bar rules, and — for one of the key's simple chords — the key's mode set as the
// slot scale, so the key holds. One undo step; the caller commits the result.

import { capitaliseRoots } from './chordSuggest';
import { concertChordText } from './instruments';
import { commitChordText, setScaleOverride, type ChordCommit, type Progression } from './progression';
import type { InstrumentView } from './view';

export function enterChord(p: Progression, view: InstrumentView, bar: number, part: number, text: string): ChordCommit {
  const written = capitaliseRoots(text.trim());
  const slot = view.slots.find((s) => s.bar === bar && s.part === part);
  const inKey = slot && view.keyChords(slot.index).find((k) => k.symbol === written);
  const r = commitChordText(p, bar, part, concertChordText(written, view.inst));
  if (!r.ok || !inKey) return r;
  return { ...r, progression: setScaleOverride(r.progression, bar, part, inKey.scale) };
}
