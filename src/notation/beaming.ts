// Beam groups by beat (SPEC §7.1): simple time (x/4, x/2) one group per quarter-note beat; compound time
// (6/8, 9/8, 12/8) groups of three eighths. Measured from the bar, so a slot starting mid-beat (the second half of
// a split 3/4 bar) begins with a partial group. Beams never cross a slot line: each slot gets its own list.

import { Beam, Fraction, type StemmableNote } from 'vexflow/core';
import { TICKS_PER_WHOLE, barTicks, type Meter } from '../form';

/** The beat group length in ticks for a meter. */
export function groupTicks(m: Meter): number {
  const compound = m.unit === 8 && m.beats % 3 === 0 && m.beats > 3;
  if (compound || (m.unit === 8 && m.beats === 3)) return (3 * TICKS_PER_WHOLE) / 8;
  return TICKS_PER_WHOLE / 4;
}

/**
 * Group lengths (ticks) covering a slot [start, end) exactly, cut at the bar's group boundaries. The list covers the
 * whole slot, so VexFlow's cycling through `groups` never comes into play.
 */
export function slotBeamGroups(m: Meter, start: number, end: number): number[] {
  const g = groupTicks(m);
  const bar = barTicks(m);
  const out: number[] = [];
  let t = start;
  while (t < end) {
    const inBar = t % bar;
    const next = Math.min(end, t - inBar + Math.min(bar, (Math.floor(inBar / g) + 1) * g));
    out.push(next - t);
    t = next;
  }
  return out;
}

/**
 * Beams for one slot's notes and rests, in time order (no trailing ghost padding). Rests are passed in so the
 * groups stay aligned to time, and they break beams (VexFlow's default `beamRests: false`).
 */
export function beamsFor(notes: StemmableNote[], m: Meter, start: number, end: number): Beam[] {
  if (notes.length < 2) return [];
  const groups = slotBeamGroups(m, start, end).map((t) => new Fraction(t, TICKS_PER_WHOLE));
  return Beam.generateBeams(notes, { groups });
}
