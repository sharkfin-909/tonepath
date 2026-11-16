// Pure `transport` module (SPEC §3.7): what the transport of Improvise and Read etude needs besides its timing
// (`metronomeRun.ts`) — the looped bars as a slot range, the slot after a slot within them, the form the metronome
// runs (rebased to start at 0), and the targets Improvise rings on the hex while it runs: the upcoming chord's tones.
// Pure: no React, no audio.

import type { InstrumentView } from './view';

/** A run of slots (form indices, inclusive). */
export interface SlotRange {
  first: number;
  last: number;
}

/** The looped bars (the bar selection, inclusive) as their slots; null: the whole form. */
export function loopRange(slots: readonly { bar: number; index: number }[], bars: { from: number; to: number } | null): SlotRange | null {
  if (!bars) return null;
  const inRange = slots.filter((x) => x.bar >= bars.from && x.bar <= bars.to);
  return inRange.length ? { first: inRange[0].index, last: inRange[inRange.length - 1].index } : null;
}

/** The slot after `slot`: the next in the form, wrapping at its end — or, looping bars, at the range's end. */
export function upcomingSlot(count: number, range: SlotRange | null, slot: number): number {
  if (range) return slot >= range.first && slot < range.last ? slot + 1 : range.first;
  return (slot + 1) % count;
}

/** The form the metronome runs: every slot, or the looped ones rebased to start at time 0. */
export function transportForm(view: Pick<InstrumentView, 'slots' | 'end'>, range: SlotRange | null): { slots: { index: number; start: number }[]; end: number } {
  if (!range) return { slots: view.slots.map((x) => ({ index: x.index, start: x.start })), end: view.end };
  const base = view.slots[range.first].start;
  return {
    slots: view.slots.slice(range.first, range.last + 1).map((x) => ({ index: x.index, start: x.start - base })),
    end: view.slots[range.last].end - base,
  };
}

/**
 * Improvise, transport running: the hex rings the upcoming chord's chord tones (written pitch classes) — at the last
 * chord (of the looped bars), the first chord's. Null when the upcoming slot has no chord.
 */
export function upcomingTargets(view: Pick<InstrumentView, 'slots' | 'inst'>, range: SlotRange | null, slot: number): Set<number> | null {
  const next = view.slots[upcomingSlot(view.slots.length, range, slot)];
  if (next.concert.kind !== 'chord') return null;
  return new Set([...next.concert.chordTones].map((pc) => (pc + view.inst.semitones + 120) % 12));
}
