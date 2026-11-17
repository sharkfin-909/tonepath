// Progression shape (SPEC §12.2, schema v3). Terms per CONTEXT.md: a progression (the chords and the form) holds its
// etudes — each a melody over that form, with the instrument it is written for. Always at least one.

import { splitSymbols } from './chords';
import { slotHarmony, withValidOverride, type ScaleId } from './harmony';
import { layoutMeter, slotsOf } from './form';
import { fitToForm } from './melody';
import { isInstrumentId } from './instruments';
import { splitBar } from './bars';

export type Duration = 'w' | 'h' | 'q' | 'e' | 's';

export type MelodyEvent = { pitch: number; d: Duration } | { d: Duration };

/** A chord slot: the concert chord symbol exactly as typed ("" = empty), optional scale override id. */
export interface Slot {
  chord: string;
  scale?: string;
}

/** A bar holds one or two slots (equal halves). */
export type Bar = Slot[];

/** One etude: a melody over its progression's form, written for an instrument (SPEC §6, §10). */
export interface Etude {
  /** Unique within its progression (`e1`, `e2`, …); stable across edits. */
  id: string;
  name: string;
  instrument: string;
  /** Concert only (SPEC §7.3): `"bass"`, absent for Treble. */
  concertClef?: 'bass';
  melody: MelodyEvent[];
}

export interface Progression {
  title: string;
  timeSignature: string;
  barsPerRow: number;
  bars: Bar[];
  /** At least one. */
  etudes: Etude[];
}

export const SCHEMA_VERSION = 3;

/** An etude id not yet used in `etudes`: `e1`, `e2`, … */
export function freshEtudeId(etudes: readonly { id: string }[]): string {
  const used = new Set(etudes.map((e) => e.id));
  for (let k = 1; ; k++) if (!used.has(`e${k}`)) return `e${k}`;
}

export function newEtude(instrument = 'concert', name = 'Etude 1', id = 'e1'): Etude {
  return { id, name, instrument: isInstrumentId(instrument) ? instrument : 'concert', melody: [] };
}

export function newProgression(instrument = 'concert'): Progression {
  return {
    title: 'Untitled',
    timeSignature: '4/4',
    barsPerRow: 4,
    bars: Array.from({ length: 4 }, () => [{ chord: '' }]),
    etudes: [newEtude(instrument)],
  };
}

/** The etude with this id; missing (or no id) → the first. */
export function etudeOf(p: Pick<Progression, 'etudes'>, id?: string | null): Etude {
  return p.etudes.find((e) => e.id === id) ?? p.etudes[0];
}

/** Replace the etude with this id (missing → the first) by `fn` of it. The same object when `fn` changes nothing. */
export function withEtude(p: Progression, id: string | null | undefined, fn: (e: Etude) => Etude): Progression {
  const e = etudeOf(p, id);
  const next = fn(e);
  return next === e ? p : { ...p, etudes: p.etudes.map((x) => (x === e ? next : x)) };
}

/** Set the melody of the etude with this id. */
export const setMelody = (p: Progression, id: string | null | undefined, melody: MelodyEvent[]): Progression =>
  withEtude(p, id, (e) => (e.melody === melody ? e : { ...e, melody }));

export type ChordCommit =
  | { ok: true; progression: Progression; /** last slot (part) written in that bar */ lastPart: number }
  | { ok: false; message: string };

/**
 * Commit typed chord text into a slot (SPEC §4.2). Whitespace outside parentheses separates symbols:
 * one edits the slot; two split a one-slot bar (or fill both slots of a split bar from the first);
 * three or more are refused. Symbols are stored exactly as typed.
 */
export function commitChordText(p: Progression, bar: number, part: number, text: string): ChordCommit {
  const symbols = splitSymbols(text);
  if (symbols.length > 2) return { ok: false, message: 'a bar holds at most two chords' };
  if (symbols.length < 2) return { ok: true, progression: setChord(p, bar, part, symbols[0] ?? ''), lastPart: part };

  const old = p.bars[bar];
  const [first, second] = symbols;
  if (old.length === 1) {
    // Splitting a one-slot bar follows bar Split (SPEC §4.1): refused if a note crosses the middle.
    const split = splitBar(p, bar, 0, { chord: second });
    if (!split.ok) return { ok: false, message: split.message };
    return { ok: true, progression: setChord(split.progression, bar, 0, first), lastPart: 1 };
  }
  const next: Bar = [
    withValidOverride({ ...old[0], chord: first }),
    old.length > 1 ? withValidOverride({ ...old[1], chord: second }) : { chord: second },
  ];
  if (old.length === 2 && old[0].chord === first && old[1].chord === second) {
    return { ok: true, progression: p, lastPart: 1 };
  }
  return { ok: true, progression: { ...p, bars: p.bars.map((b, bi) => (bi === bar ? next : b)) }, lastPart: 1 };
}

/** Replace one slot's chord symbol. Returns the same object when nothing changes. */
export function setChord(p: Progression, bar: number, part: number, chord: string): Progression {
  if (p.bars[bar]?.[part]?.chord === chord) return p;
  const bars = p.bars.map((b, bi) =>
    bi !== bar ? b : b.map((s, si) => (si !== part ? s : withValidOverride({ ...s, chord }))),
  );
  return { ...p, bars };
}

/**
 * Set or clear a slot's scale override (SPEC §5.2). Picking the default scale (the first candidate) clears
 * the override; a non-candidate is ignored. Returns the same object when nothing changes.
 */
export function setScaleOverride(p: Progression, bar: number, part: number, scale: ScaleId | null): Progression {
  const slot = p.bars[bar]?.[part];
  if (!slot) return p;
  const h = slotHarmony(slot);
  if (h.kind !== 'chord') return p;
  if (scale !== null && !h.candidates.includes(scale)) return p;
  const next = scale === null || scale === h.candidates[0] ? undefined : scale;
  if (slot.scale === next) return p;
  const { scale: _old, ...rest } = slot;
  const updated: Slot = next ? { ...rest, scale: next } : rest;
  return { ...p, bars: p.bars.map((b, bi) => (bi !== bar ? b : b.map((s, si) => (si !== part ? s : updated)))) };
}

// ── Rail settings (SPEC §3.1, §4.1, §6.2 item 10). Each returns the same object when nothing changes. ────────

/** Inline rename: trimmed; blank → "Untitled". */
export function setTitle(p: Progression, text: string): Progression {
  const title = text.trim() || 'Untitled';
  return title === p.title ? p : { ...p, title };
}

/**
 * Time signature, stored exactly as typed (unparseable → laid out as 4/4, SPEC §4.1). Bars change length, so the
 * melody is re-fitted to the new slots: times are kept, and events crossing a new boundary are shortened with
 * rests (see `fitToForm`).
 */
export function setTimeSignature(p: Progression, text: string): Progression {
  if (text === p.timeSignature) return p;
  const slots = slotsOf(p.bars, layoutMeter(text));
  return { ...p, timeSignature: text, etudes: p.etudes.map((e) => ({ ...e, melody: fitToForm(e.melody, slots).melody })) };
}

export const BARS_PER_ROW = [1, 2, 3, 4, 5, 6, 7, 8] as const;

export function setBarsPerRow(p: Progression, n: number): Progression {
  if (!Number.isInteger(n) || n < 1 || n > 8 || n === p.barsPerRow) return p;
  return { ...p, barsPerRow: n };
}

/** Clear notes: the etude's melody → `[]`; chords, scales, title, instrument and the other etudes untouched. */
export function clearMelody(p: Progression, etude?: string | null): Progression {
  return withEtude(p, etude, (e) => (e.melody.length ? { ...e, melody: [] } : e));
}

/**
 * Clear all (SPEC §6.2 item 10): every chord and scale override, and the etude's notes, removed; the bars (and their
 * splits), title, time signature, instruments and the other etudes' notes stay. Unchanged when there is nothing to
 * clear.
 */
/** Any slot has a chord: what edit etude and ins read need (SPEC §3.0). */
export function hasChords(p: Progression): boolean {
  return p.bars.some((b) => b.some((s) => s.chord.trim() !== ''));
}

export function clearEverything(p: Progression, etude?: string | null): Progression {
  const noChords = p.bars.every((b) => b.every((s) => s.chord === '' && s.scale === undefined));
  const cleared = clearMelody(p, etude);
  return noChords ? cleared : { ...cleared, bars: p.bars.map((b) => b.map(() => ({ chord: '' }))) };
}

/** Instrument switch (SPEC §10): the etude's setting; unknown ids are ignored. */
export function setInstrument(p: Progression, etude: string | null | undefined, id: string): Progression {
  return withEtude(p, etude, (e) => (id === e.instrument || !isInstrumentId(id) ? e : { ...e, instrument: id }));
}

/** Concert clef choice (SPEC §7.3): the etude's, saved as `concertClef: "bass"`, absent for Treble. */
export function setConcertClef(p: Progression, etude: string | null | undefined, clef: 'treble' | 'bass'): Progression {
  return withEtude(p, etude, (e) => {
    if ((e.concertClef === 'bass') === (clef === 'bass')) return e;
    if (clef === 'bass') return { ...e, concertClef: 'bass' };
    const { concertClef: _old, ...rest } = e;
    return rest;
  });
}
