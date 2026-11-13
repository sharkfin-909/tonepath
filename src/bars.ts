// Pure bar editing (SPEC §4.1): structural form edits carry the melody with the bars. Events never cross a slot
// (so never a bar) boundary, so the melody is cut into per-bar slices, the bars and slices are edited together,
// and the melody is rebuilt — padding with rests any bar that has music after it, so timing stays continuous.
// Every operation returns the new progression and where the caret goes (it stays on the same music).

import { barTicks, layoutMeter, slotsOf, type Meter } from './form';
import { TICKS, restsBetween, timeline } from './melody';
import { withValidOverride } from './harmony';
import type { Bar, MelodyEvent, Progression } from './progression';

export type BarEdit = { ok: true; progression: Progression; caret: number } | { ok: false; message: string };

/** What Copy puts on the in-app clipboard: a run of bars and their melody slices. */
export interface BarClip {
  bars: Bar[];
  slices: MelodyEvent[][];
}

const meterOf = (p: Progression): Meter => layoutMeter(p.timeSignature);

/** The melody cut into one slice per bar (by event start); bars past the melody's end get empty slices. */
export function toSlices(melody: MelodyEvent[], barCount: number, barLen: number): MelodyEvent[][] {
  const out: MelodyEvent[][] = Array.from({ length: barCount }, () => []);
  for (const e of timeline(melody)) {
    const b = Math.floor(e.start / barLen);
    if (b < barCount) out[b].push(e.ev);
  }
  return out;
}

const sliceLen = (s: MelodyEvent[]) => s.reduce((t, e) => t + TICKS[e.d], 0);

/** Rebuild a melody from per-bar slices for a form: every bar before the last non-empty one is padded with rests. */
export function fromSlices(slices: MelodyEvent[][], bars: Bar[], m: Meter): MelodyEvent[] {
  const len = barTicks(m);
  const slots = slotsOf(bars, m);
  let last = -1;
  slices.forEach((s, i) => {
    if (s.length) last = i;
  });
  const out: MelodyEvent[] = [];
  for (let i = 0; i <= last; i++) {
    out.push(...slices[i]);
    const used = sliceLen(slices[i]);
    if (i < last && used < len) out.push(...restsBetween(slots, i * len + used, (i + 1) * len));
  }
  return out;
}

const emptyBar = (): Bar => [{ chord: '' }];

function rebuild(p: Progression, bars: Bar[], slices: MelodyEvent[][]): Progression {
  return { ...p, bars, melody: fromSlices(slices, bars, meterOf(p)) };
}

/** Insert `count` bars (empty unless given) before bar `at`; later music moves `count` bars later. */
export function insertBars(p: Progression, at: number, caret: number, clip?: BarClip): BarEdit {
  const len = barTicks(meterOf(p));
  const add = clip ?? { bars: [emptyBar()], slices: [[]] };
  const n = add.bars.length;
  const slices = toSlices(p.melody, p.bars.length, len);
  const bars = [...p.bars.slice(0, at), ...add.bars.map((b) => b.map((s) => ({ ...s }))), ...p.bars.slice(at)];
  const sl = [...slices.slice(0, at), ...add.slices.map((s) => [...s]), ...slices.slice(at)];
  return { ok: true, progression: rebuild(p, bars, sl), caret: caret >= at * len ? caret + n * len : caret };
}

/** Append one empty bar ("+"). */
export function appendBar(p: Progression, caret: number): BarEdit {
  return insertBars(p, p.bars.length, caret);
}

/** Delete bars [from, to] and their events; later music moves earlier. Minimum one bar. */
export function deleteBars(p: Progression, from: number, to: number, caret: number): BarEdit {
  const n = to - from + 1;
  if (n >= p.bars.length) return { ok: false, message: 'a progression needs at least one bar' };
  const len = barTicks(meterOf(p));
  const slices = toSlices(p.melody, p.bars.length, len);
  const bars = [...p.bars.slice(0, from), ...p.bars.slice(to + 1)];
  const sl = [...slices.slice(0, from), ...slices.slice(to + 1)];
  const start = from * len;
  const end = (to + 1) * len;
  // In a deleted bar → the start of the bar now in that position (or the end of the form).
  const next = caret >= end ? caret - n * len : caret >= start ? Math.min(start, bars.length * len) : caret;
  return { ok: true, progression: rebuild(p, bars, sl), caret: next };
}

/** Copy bars [from, to] (chords, overrides, melody slices). */
export function copyBars(p: Progression, from: number, to: number): BarClip {
  const slices = toSlices(p.melody, p.bars.length, barTicks(meterOf(p)));
  return { bars: p.bars.slice(from, to + 1).map((b) => b.map((s) => ({ ...s }))), slices: slices.slice(from, to + 1).map((s) => [...s]) };
}

/** Duplicate bars [from, to]: a copy straight after the run; later music moves by the run's length. */
export function duplicateBars(p: Progression, from: number, to: number, caret: number): BarEdit {
  return insertBars(p, to + 1, caret, copyBars(p, from, to));
}

/** Paste replaces bars from `at` onward with the clip (chords, overrides, melody slice); no shifting. */
export function pasteBars(p: Progression, at: number, clip: BarClip, caret: number): BarEdit {
  const n = clip.bars.length;
  if (at + n > p.bars.length) return { ok: false, message: 'not enough bars to paste into' };
  const slices = toSlices(p.melody, p.bars.length, barTicks(meterOf(p)));
  const bars = p.bars.map((b, i) => (i >= at && i < at + n ? clip.bars[i - at].map((s) => ({ ...s })) : b));
  const sl = slices.map((s, i) => (i >= at && i < at + n ? [...clip.slices[i - at]] : s));
  return { ok: true, progression: rebuild(p, bars, sl), caret };
}

/**
 * Split a one-slot bar into two halves (the second starts empty). Refused if a note crosses the middle; a rest
 * crossing it is re-split into rests on each side. Melody timing is untouched.
 */
export function splitBar(p: Progression, bar: number, caret: number, second: Bar[number] = { chord: '' }): BarEdit {
  if (p.bars[bar].length !== 1) return { ok: false, message: 'the bar is already split' };
  const m = meterOf(p);
  const len = barTicks(m);
  const mid = bar * len + len / 2;
  const tl = timeline(p.melody);
  if (tl.some((e) => 'pitch' in e.ev && e.start < mid && e.end > mid)) {
    return { ok: false, message: 'a note crosses the middle of the bar' };
  }
  const bars = p.bars.map((b, i) => (i === bar ? [b[0], second] : b));
  const slots = slotsOf(bars, m);
  const melody: MelodyEvent[] = [];
  for (const e of tl) {
    if (e.start < mid && e.end > mid) melody.push(...restsBetween(slots, e.start, e.end));
    else melody.push(e.ev);
  }
  return { ok: true, progression: { ...p, bars, melody }, caret };
}

/** Merge a split bar: keeps the first slot's chord and override; the melody is untouched. */
export function mergeBar(p: Progression, bar: number, caret: number): BarEdit {
  if (p.bars[bar].length !== 2) return { ok: false, message: 'the bar is not split' };
  const bars = p.bars.map((b, i) => (i === bar ? [withValidOverride(b[0])] : b));
  return { ok: true, progression: { ...p, bars }, caret };
}
