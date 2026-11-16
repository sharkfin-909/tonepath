// Pure `form` module: bars → slots with time ranges (SPEC §2, §4.1).
// Time is measured in integer ticks; a whole note is TICKS_PER_WHOLE ticks.

import type { Bar } from './progression';

export const TICKS_PER_WHOLE = 384;

export interface Meter {
  beats: number;
  unit: number;
}

const DEFAULT_METER: Meter = { beats: 4, unit: 4 };
const UNITS = new Set([1, 2, 4, 8, 16, 32]);

/** Parse a time signature as `N/D`. Returns null when it doesn't parse. */
export function parseTimeSignature(text: string): Meter | null {
  const m = /^\s*(\d{1,2})\s*\/\s*(\d{1,2})\s*$/.exec(text);
  if (!m) return null;
  const beats = Number(m[1]);
  const unit = Number(m[2]);
  if (beats < 1 || !UNITS.has(unit)) return null;
  return { beats, unit };
}

/** The meter used for layout: the parsed time signature, or 4/4 when bad / missing. */
export function layoutMeter(text: string | undefined): Meter {
  return (text !== undefined && parseTimeSignature(text)) || DEFAULT_METER;
}

export function barTicks(meter: Meter): number {
  return (meter.beats * TICKS_PER_WHOLE) / meter.unit;
}

export interface FormSlot {
  /** Position in the whole form, 0-based. */
  index: number;
  bar: number;
  /** 0 = first (or only) slot of the bar, 1 = second half. */
  part: number;
  start: number;
  end: number;
  /** True for the bar's last slot (its right edge is a bar line). */
  barEnd: boolean;
}

export function slotsOf(bars: Bar[], meter: Meter): FormSlot[] {
  const len = barTicks(meter);
  const out: FormSlot[] = [];
  bars.forEach((bar, b) => {
    const n = bar.length;
    for (let part = 0; part < n; part++) {
      const start = b * len + (part * len) / n;
      out.push({ index: out.length, bar: b, part, start, end: start + len / n, barEnd: part === n - 1 });
    }
  });
  return out;
}

/** The slot containing time t; at (or past) the end of the form, the last slot. */
export function slotAt(slots: FormSlot[], t: number): FormSlot | undefined {
  return slots.find((s) => t >= s.start && t < s.end) ?? slots[slots.length - 1];
}

/** Improvise / Read etude ← / → (SPEC §3.3): previous / next slot, wrapping at both ends (the form loops). */
export function stepSlot(index: number, dir: -1 | 1, count: number): number {
  if (count <= 0) return 0;
  return (((index + dir) % count) + count) % count;
}
