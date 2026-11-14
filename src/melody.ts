// Pure `melody` module (SPEC §6.1–6.2): timeline, overwrite insert, rest filling, slicing per slot.
// Time is in form ticks (form.ts: a whole note = TICKS_PER_WHOLE). Also delete, caret moves and nudge (items 5, 7, 8).

import { TICKS_PER_WHOLE, slotAt, type FormSlot } from './form';
import type { Duration, MelodyEvent } from './progression';

export const DURATIONS: Duration[] = ['w', 'h', 'q', 'e', 's'];

export const TICKS: Record<Duration, number> = {
  w: TICKS_PER_WHOLE,
  h: TICKS_PER_WHOLE / 2,
  q: TICKS_PER_WHOLE / 4,
  e: TICKS_PER_WHOLE / 8,
  s: TICKS_PER_WHOLE / 16,
};

export interface TimedEvent {
  /** Index in the melody array. */
  i: number;
  start: number;
  end: number;
  ev: MelodyEvent;
}

export function timeline(melody: MelodyEvent[]): TimedEvent[] {
  let t = 0;
  return melody.map((ev, i) => {
    const start = t;
    t += TICKS[ev.d];
    return { i, start, end: t, ev };
  });
}

export function melodyEnd(melody: MelodyEvent[]): number {
  return melody.reduce((t, ev) => t + TICKS[ev.d], 0);
}

export function formEnd(slots: FormSlot[]): number {
  return slots.length ? slots[slots.length - 1].end : 0;
}

/**
 * Durations filling [from, to) inside one slot: the largest lengths that start on their own beat
 * (a multiple of their own length from the slot's start) and fit. Used for rests and ghost padding.
 */
export function fillDurations(slotStart: number, from: number, to: number): Duration[] {
  const out: Duration[] = [];
  let t = from;
  while (t < to) {
    const d = DURATIONS.find((k) => TICKS[k] <= to - t && (t - slotStart) % TICKS[k] === 0);
    if (!d) break; // not on the 16th grid: cannot happen with entry-made melodies
    out.push(d);
    t += TICKS[d];
  }
  return out;
}

/** Rests filling [from, to), split at slot boundaries (SPEC §6.2 item 4). */
export function restsBetween(slots: FormSlot[], from: number, to: number): MelodyEvent[] {
  const out: MelodyEvent[] = [];
  for (const s of slots) {
    const a = Math.max(from, s.start);
    const b = Math.min(to, s.end);
    if (a < b) for (const d of fillDurations(s.start, a, b)) out.push({ d });
  }
  return out;
}

export type InsertResult =
  | { ok: true; melody: MelodyEvent[]; caret: number }
  | { ok: false; message: string };

/**
 * Write-mode insert that keeps going past the end (SPEC §6.2): writing the form's last note puts the caret back at
 * the start (first slot active), and a caret at the end of the form writes from the start, overwriting as usual.
 */
export function insertWrapping(melody: MelodyEvent[], slots: FormSlot[], caret: number, d: Duration, pitch: number | null): InsertResult {
  const end = formEnd(slots);
  const r = insertAt(melody, slots, caret >= end ? 0 : caret, d, pitch);
  // Writing the last note of the form wraps the caret to the start: the first slot is active, ready to carry on.
  return r.ok && r.caret >= end ? { ...r, caret: 0 } : r;
}

/**
 * Overwrite insert (SPEC §6.2 items 2–4): write a note (or a rest, pitch null) of length d at the caret.
 * Covered events are removed, an overhanging event's leftover becomes rests, later music never moves;
 * inserting past the melody's end fills the gap with rests. Refused if it would cross the caret's slot end
 * or the form end. On success the caret moves to the end of the new event.
 */
export function insertAt(
  melody: MelodyEvent[],
  slots: FormSlot[],
  caret: number,
  d: Duration,
  pitch: number | null,
): InsertResult {
  const end = formEnd(slots);
  const len = TICKS[d];
  if (caret >= end) return { ok: false, message: 'End of the form' };
  const slot = slotAt(slots, caret)!;
  if (caret + len > slot.end) {
    return { ok: false, message: slot.end === end ? "Doesn't fit before the end of the form" : "Doesn't fit in this slot" };
  }
  const event: MelodyEvent = pitch === null ? { d } : { pitch, d };
  const stop = caret + len;
  const tl = timeline(melody);
  const out: MelodyEvent[] = [];
  for (const e of tl) {
    if (e.end <= caret) out.push(e.ev); // before
  }
  // An event straddling the caret keeps its time as rests up to the caret (defensive; the caret sits on event starts).
  const straddle = tl.find((e) => e.start < caret && e.end > caret);
  if (straddle) out.push(...restsBetween(slots, straddle.start, caret));
  const mEnd = melodyEnd(melody);
  if (caret > mEnd) out.push(...restsBetween(slots, mEnd, caret)); // gap-fill
  out.push(event);
  // Leftover of the last covered event.
  const overhang = tl.find((e) => e.start < stop && e.end > stop);
  if (overhang) out.push(...restsBetween(slots, stop, overhang.end));
  for (const e of tl) {
    if (e.start >= stop) out.push(e.ev); // after: unchanged
  }
  return { ok: true, melody: out, caret: stop };
}

/** The events whose start lies in a slot (the slot that owns them), in time order (SPEC §7.1). */
export function eventsForSlot(melody: MelodyEvent[], slot: Pick<FormSlot, 'start' | 'end'>): TimedEvent[] {
  return timeline(melody).filter((e) => e.start >= slot.start && e.start < slot.end);
}

/** Snap a time to the start of the event covering it (times past the melody's end are kept). */
export function snapToEvent(melody: MelodyEvent[], t: number): number {
  const hit = timeline(melody).find((e) => t >= e.start && t < e.end);
  return hit ? hit.start : t;
}

// ── Delete, caret moves and nudge (SPEC §6.2 items 5, 7, 8) ─────────────────────────────────────────────

const isNote = (ev: MelodyEvent): ev is { pitch: number; d: Duration } => 'pitch' in ev;

/** The melody without its trailing rests (deletes never leave rests at the end, SPEC §6.2 item 5). */
export function trimTrailingRests(melody: MelodyEvent[]): MelodyEvent[] {
  let n = melody.length;
  while (n > 0 && !isNote(melody[n - 1])) n--;
  return n === melody.length ? melody : melody.slice(0, n);
}

/** The event covering time t, if any. */
function eventAt(melody: MelodyEvent[], t: number): TimedEvent | undefined {
  return timeline(melody).find((e) => t >= e.start && t < e.end);
}

/** The event just before the caret: the last one starting before it. */
function eventBefore(melody: MelodyEvent[], caret: number): TimedEvent | undefined {
  const tl = timeline(melody);
  for (let k = tl.length - 1; k >= 0; k--) if (tl[k].start < caret) return tl[k];
  return undefined;
}

/** A note becomes a rest of the same length; then trailing rests go. */
function restAndTrim(melody: MelodyEvent[], i: number): MelodyEvent[] {
  const out = melody.slice();
  out[i] = { d: melody[i].d };
  return trimTrailingRests(out);
}

export interface EditResult {
  melody: MelodyEvent[];
  caret: number;
}

/**
 * Del (SPEC §6.2 item 5): the note at the caret becomes a rest of the same length; a trailing rest is removed
 * (the melody shortens); a rest elsewhere stays. The caret does not move. Nothing at the caret → unchanged.
 */
export function deleteAt(melody: MelodyEvent[], caret: number): EditResult {
  const e = eventAt(melody, caret);
  if (!e) return { melody, caret };
  return { melody: restAndTrim(melody, e.i), caret };
}

/**
 * ⌫ (SPEC §6.2 item 5): Del applied to the event before the caret, and the caret moves to its start
 * (over a rest that stays, it just steps back).
 */
export function backspaceAt(melody: MelodyEvent[], caret: number): EditResult {
  const e = eventBefore(melody, caret);
  if (!e) return { melody, caret };
  return { melody: restAndTrim(melody, e.i), caret: e.start };
}

/** Latch-length grid point at or before t (`floor`) or after t (`next`), relative to the slot holding it. */
function gridPoint(slots: FormSlot[], t: number, len: number, mode: 'floor' | 'next'): number {
  const s = slotAt(slots, t)!;
  const k = Math.floor((t - s.start) / len);
  return mode === 'floor' ? s.start + k * len : Math.min(s.start + (k + 1) * len, s.end);
}

/**
 * ← / → (SPEC §6.2 item 7): event by event inside the melody; past its end, by the latched length (on that
 * length's grid within each slot), up to the end of the form. ← from past the end stops at the melody's end.
 */
export function stepCaret(melody: MelodyEvent[], slots: FormSlot[], caret: number, dir: -1 | 1, d: Duration): number {
  const mEnd = melodyEnd(melody);
  const fEnd = formEnd(slots);
  const len = TICKS[d];
  if (dir === 1) {
    if (caret >= fEnd) return fEnd;
    if (caret < mEnd) return eventAt(melody, caret)!.end;
    return Math.min(gridPoint(slots, caret, len, 'next'), fEnd);
  }
  if (caret <= 0) return 0;
  if (caret <= mEnd) return eventBefore(melody, caret)?.start ?? 0;
  return Math.max(gridPoint(slots, caret - 1, len, 'floor'), mEnd);
}

/**
 * Caret from a click at time t (SPEC §6.2 item 7): inside the melody, snap to the start of the event under it;
 * past its end, the latch-length beat under the click (never before the melody's end).
 */
export function caretFromClick(melody: MelodyEvent[], slots: FormSlot[], t: number, d: Duration): number {
  const fEnd = formEnd(slots);
  const at = Math.max(0, Math.min(t, fEnd));
  const mEnd = melodyEnd(melody);
  if (at < mEnd) return snapToEvent(melody, at);
  if (at >= fEnd) return fEnd;
  return Math.max(gridPoint(slots, at, TICKS[d], 'floor'), mEnd);
}

export type NudgeResult = { ok: true; melody: MelodyEvent[]; pitch: number } | { ok: false };

/**
 * Nudge (SPEC §6.2 item 8): move the note just before the caret one step of its owning slot's scale
 * (`steps` = ±1), or with `octave` 12 semitones. `pitchClassesOf` gives a slot's step set (its scale, or a
 * no-fit chord's own tones); null = the slot has no scale, so only octave nudges work. A pitch off the set
 * moves to the nearest set tone in that direction. A rest before the caret, or leaving MIDI 0–127, → refused.
 */
export function nudge(
  melody: MelodyEvent[],
  slots: FormSlot[],
  caret: number,
  dir: -1 | 1,
  octave: boolean,
  pitchClassesOf: (slot: FormSlot) => Set<number> | null,
): NudgeResult {
  const e = eventBefore(melody, caret);
  if (!e || !isNote(e.ev)) return { ok: false };
  let pitch: number;
  if (octave) pitch = e.ev.pitch + 12 * dir;
  else {
    const pcs = pitchClassesOf(slotAt(slots, e.start)!);
    if (!pcs || pcs.size === 0) return { ok: false };
    pitch = e.ev.pitch + dir;
    while (pitch >= 0 && pitch <= 127 && !pcs.has(pitch % 12)) pitch += dir;
  }
  if (pitch < 0 || pitch > 127) return { ok: false };
  const out = melody.slice();
  out[e.i] = { pitch, d: e.ev.d };
  return { ok: true, melody: out, pitch };
}


export interface FitResult {
  melody: MelodyEvent[];
  /** Events shortened because they crossed a slot boundary or the end of the form. */
  shortened: number;
  /** Events dropped because they start at or past the end of the form. */
  dropped: number;
}

/**
 * Make a melody fit a form (SPEC §6.1 invariants; the §12.3 repair). Used when the time signature moves the slot
 * boundaries under a melody, and on import. Times are kept: an event crossing its slot's end (or the form's end) is
 * shortened to the longest length that fits, and the cut-off time becomes rests (largest lengths on their own beat,
 * split at slot boundaries), so later events keep their timing; events starting past the form are dropped.
 * Returns the same melody object when nothing changes.
 */
export function fitToForm(melody: MelodyEvent[], slots: FormSlot[]): FitResult {
  const fEnd = formEnd(slots);
  const out: MelodyEvent[] = [];
  let shortened = 0;
  let dropped = 0;
  for (const e of timeline(melody)) {
    if (e.start >= fEnd) {
      dropped++;
      continue;
    }
    const slot = slotAt(slots, e.start)!;
    if (e.end <= slot.end) {
      out.push(e.ev);
      continue;
    }
    shortened++;
    const d = DURATIONS.find((k) => TICKS[k] <= slot.end - e.start)!;
    out.push('pitch' in e.ev ? { pitch: e.ev.pitch, d } : { d });
    out.push(...restsBetween(slots, e.start + TICKS[d], Math.min(e.end, fEnd)));
  }
  return { melody: shortened || dropped ? out : melody, shortened, dropped };
}
