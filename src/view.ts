// Pure `view` module: the **Instrument view** (SPEC §5.3, §10) of a progression, computed once.
// Stored chords and melody are concert; everything shown (chord labels, hex, spelling, marks, readout) is written
// pitch for the instrument. Callers read slots from here and never transpose themselves.

import { layoutMeter, slotAt, slotsOf, type FormSlot, type Meter } from './form';
import { scaleLabel, slotHarmony, type SlotHarmony } from './harmony';
import { keyChords, type KeyChord } from './key';
import { dockHex, type DockHex, type PitchRange } from './hex';
import { clefOf, hexRange, instrumentOf, toConcert, toWritten, writtenChord, type Clef, type Instrument } from './instruments';
import { noteMark, type NoteMark } from './marks';
import { formEnd } from './melody';
import type { Progression, Slot } from './progression';
import { noteName, slotSpelling, type SlotSpelling } from './spelling';

export interface ViewSlot extends FormSlot {
  /** The slot as stored (concert chord, scale override). */
  data: Slot;
  /** The chord as shown: written for the instrument. */
  chord: string;
  /** Written harmony: drives the hex, labels, spelling and marks. */
  harmony: SlotHarmony;
  /** Concert harmony: drives sound (SPEC §9). */
  concert: SlotHarmony;
  spelling: SlotSpelling;
  /** Readout scale text: `D Dorian`, `no scale fits`, or `—` without a chord. */
  scaleText: string;
}

export interface InstrumentView {
  inst: Instrument;
  clef: Clef;
  /** The layout meter (a bad time signature lays out as 4/4). */
  meter: Meter;
  /** The hex range (SPEC §8.1), in written pitch. */
  range: PitchRange;
  slots: ViewSlot[];
  /** Form end, in ticks. */
  end: number;
  /** Chords in the form, written, distinct, in order (chord autosuggest). */
  usedChords: string[];
  /** The slot holding time `t`; the last slot at (or past) the end of the form. */
  slotAt: (t: number) => ViewSlot;
  toWritten: (concertMidi: number) => number;
  toConcert: (writtenMidi: number) => number;
  /** A concert pitch's written name in a slot, e.g. `Eb4`. */
  name: (concertMidi: number, slot: ViewSlot) => string;
  /** Out-of-scale / out-of-range marks for a concert pitch in its owning slot (SPEC §7.2). */
  mark: (concertMidi: number, slot: ViewSlot) => NoteMark;
  /** The key's simple chords offered in the slot at `index`'s empty chord field (written; SPEC §4.2). */
  keyChords: (index: number) => KeyChord[];
  /** The docked hex for the slot at `index` (SPEC §8.4). */
  dock: (index: number) => DockHex;
}

const scaleText = (h: SlotHarmony) => (h.kind !== 'chord' ? '—' : h.scale ? scaleLabel(h.root, h.scale) : 'no scale fits');

export function instrumentView(p: Progression): InstrumentView {
  const inst = instrumentOf(p.instrument);
  const meter = layoutMeter(p.timeSignature);
  const range = hexRange(inst);
  const slots: ViewSlot[] = slotsOf(p.bars, meter).map((s) => {
    const data = p.bars[s.bar][s.part];
    const chord = writtenChord(data.chord, inst);
    const harmony = slotHarmony({ ...data, chord });
    return { ...s, data, chord, harmony, concert: slotHarmony(data), spelling: slotSpelling(harmony), scaleText: scaleText(harmony) };
  });
  const end = formEnd(slots);
  return {
    inst,
    clef: clefOf(inst, p.concertClef),
    meter,
    range,
    slots,
    end,
    usedChords: [...new Set(slots.map((s) => s.chord).filter(Boolean))],
    slotAt: (t) => slotAt(slots, Math.min(t, end)) as ViewSlot,
    toWritten: (m) => toWritten(m, inst),
    toConcert: (m) => toConcert(m, inst),
    name: (m, slot) => noteName(toWritten(m, inst), slot.spelling),
    mark: (m, slot) => noteMark(toWritten(m, inst), slot.harmony, slot.chord, inst),
    dock: (index) => dockHex(slots.map((s) => s.harmony), index, range),
    keyChords: (index) => keyChords(slots.slice(0, index).reverse().map((s) => s.harmony)),
  };
}
