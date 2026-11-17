// Pure bar editing (SPEC §4.1): structural form edits carry **every etude's** melody with the bars. Events never
// cross a slot (so never a bar) boundary, so each melody is cut into per-bar slices, the bars and slices are edited
// together, and the melodies are rebuilt — padding with rests any bar that has music after it, so timing stays
// continuous. Copy / Paste carry the chords and one etude's slices (the open one's): pasting writes them into that
// etude and leaves rests in the other etudes' pasted bars. Every operation returns the new progression and where the
// caret goes (it stays on the same music).

import { barTicks, layoutMeter, slotsOf, type Meter } from './form';
import { TICKS, restsBetween, timeline } from './melody';
import { withValidOverride } from './harmony';
import { etudeOf, type Bar, type MelodyEvent, type Progression } from './progression';

/** The bar menu's actions (SPEC §4.1). */
export type BarAction = 'insert-before' | 'insert-after' | 'duplicate' | 'copy' | 'paste' | 'split' | 'merge' | 'delete';

export type BarEdit = { ok: true; progression: Progression; caret: number } | { ok: false; message: string };

/** What Copy puts on the in-app clipboard: a run of bars and one etude's melody slices. */
export interface BarClip {
  bars: Bar[];
  slices: MelodyEvent[][];
  /** The bar length the slices were cut at (ticks). The clipboard outlives the progression (SPEC §4.1): pasted into
   *  one whose bars are another length, only the chords are pasted. */
  barTicks: number;
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
const copyBarsOnly = (bars: Bar[]): Bar[] => bars.map((b) => b.map((s) => ({ ...s })));

/** Each etude's melody as per-bar slices. */
const slicesOf = (p: Progression): MelodyEvent[][][] => {
  const len = barTicks(meterOf(p));
  return p.etudes.map((e) => toSlices(e.melody, p.bars.length, len));
};

/** The progression with new bars and each etude's melody rebuilt from its slices. */
function rebuild(p: Progression, bars: Bar[], slices: MelodyEvent[][][]): Progression {
  const m = meterOf(p);
  return { ...p, bars, etudes: p.etudes.map((e, k) => ({ ...e, melody: fromSlices(slices[k], bars, m) })) };
}

const isEtude = (p: Progression, k: number, etude: string | null | undefined) => p.etudes[k] === etudeOf(p, etude);

/**
 * Insert bars before bar `at`; later music moves that many bars later. `add(k, slices)` gives etude k's slices for
 * the inserted bars (`slices`: its current ones).
 */
function insertWith(p: Progression, at: number, caret: number, bars: Bar[], add: (k: number, slices: MelodyEvent[][]) => MelodyEvent[][]): BarEdit {
  const len = barTicks(meterOf(p));
  const n = bars.length;
  const next = [...p.bars.slice(0, at), ...copyBarsOnly(bars), ...p.bars.slice(at)];
  const sl = slicesOf(p).map((s, k) => [...s.slice(0, at), ...add(k, s).map((x) => [...x]), ...s.slice(at)]);
  return { ok: true, progression: rebuild(p, next, sl), caret: caret >= at * len ? caret + n * len : caret };
}

/**
 * Insert `count` bars before bar `at` — empty, or a clip: its chords, and its slices in `etude` (the other etudes get
 * rests there). Later music moves `count` bars later.
 */
export function insertBars(p: Progression, at: number, caret: number, clip?: BarClip, etude?: string | null): BarEdit {
  const add = clip ?? { bars: [emptyBar()], slices: [[]] };
  return insertWith(p, at, caret, add.bars, (k) => (isEtude(p, k, etude) ? add.slices : add.bars.map(() => [])));
}

/** Append one empty bar ("+"). */
export function appendBar(p: Progression, caret: number): BarEdit {
  return insertBars(p, p.bars.length, caret);
}

/** Delete bars [from, to] and every etude's events there; later music moves earlier. Minimum one bar. */
export function deleteBars(p: Progression, from: number, to: number, caret: number): BarEdit {
  const n = to - from + 1;
  if (n >= p.bars.length) return { ok: false, message: 'a progression needs at least one bar' };
  const len = barTicks(meterOf(p));
  const bars = [...p.bars.slice(0, from), ...p.bars.slice(to + 1)];
  const sl = slicesOf(p).map((s) => [...s.slice(0, from), ...s.slice(to + 1)]);
  const start = from * len;
  const end = (to + 1) * len;
  // In a deleted bar → the start of the bar now in that position (or the end of the form).
  const next = caret >= end ? caret - n * len : caret >= start ? Math.min(start, bars.length * len) : caret;
  return { ok: true, progression: rebuild(p, bars, sl), caret: next };
}

/** Copy bars [from, to]: chords, overrides, and the etude's melody slices. */
export function copyBars(p: Progression, from: number, to: number, etude?: string | null): BarClip {
  const slices = toSlices(etudeOf(p, etude).melody, p.bars.length, barTicks(meterOf(p)));
  return { bars: copyBarsOnly(p.bars.slice(from, to + 1)), slices: slices.slice(from, to + 1).map((s) => [...s]), barTicks: barTicks(meterOf(p)) };
}

/** Duplicate bars [from, to]: a copy straight after the run, every etude's music with it; later music moves on. */
export function duplicateBars(p: Progression, from: number, to: number, caret: number): BarEdit {
  return insertWith(p, to + 1, caret, p.bars.slice(from, to + 1), (_k, s) => s.slice(from, to + 1));
}

/**
 * Paste replaces bars from `at` onward with the clip: its chords and overrides, its slices in `etude`; the other
 * etudes get rests in those bars (their later music keeps its timing). No shifting.
 */
export function pasteBars(p: Progression, at: number, clip: BarClip, caret: number, etude?: string | null): BarEdit {
  const n = clip.bars.length;
  if (at + n > p.bars.length) return { ok: false, message: 'not enough bars to paste into' };
  const inPaste = (i: number) => i >= at && i < at + n;
  // Notes only between bars of the same length (a clip from a progression in another time signature: chords only).
  const fits = clip.barTicks === barTicks(meterOf(p));
  const bars = p.bars.map((b, i) => (inPaste(i) ? clip.bars[i - at].map((s) => ({ ...s })) : b));
  const sl = slicesOf(p).map((s, k) => s.map((x, i) => (!inPaste(i) ? x : fits && isEtude(p, k, etude) ? [...clip.slices[i - at]] : [])));
  return { ok: true, progression: rebuild(p, bars, sl), caret };
}

/**
 * Paste notes only (edit etude, SPEC §3.2): the clip's slices replace the open etude's notes in bars from `at`; the
 * chords, the other etudes and every later note stay. Refused when the bars are another length, or split differently
 * (a note could then cross a slot's end).
 */
export function pasteNotes(p: Progression, at: number, clip: BarClip, caret: number, etude?: string | null): BarEdit {
  const n = clip.bars.length;
  if (at + n > p.bars.length) return { ok: false, message: 'not enough bars to paste into' };
  if (clip.barTicks !== barTicks(meterOf(p))) return { ok: false, message: 'the copied bars are another length' };
  if (clip.bars.some((b, i) => b.length !== p.bars[at + i].length)) return { ok: false, message: 'the bars are split differently' };
  const sl = slicesOf(p).map((s, k) => (isEtude(p, k, etude) ? s.map((x, i) => (i >= at && i < at + n ? [...clip.slices[i - at]] : x)) : s));
  return { ok: true, progression: rebuild(p, p.bars, sl), caret };
}

/**
 * Split a one-slot bar into two halves (the second starts empty). Refused if a note — in any etude — crosses the
 * middle; a rest crossing it is re-split into rests on each side. Melody timing is untouched.
 */
export function splitBar(p: Progression, bar: number, caret: number, second: Bar[number] = { chord: '' }): BarEdit {
  if (p.bars[bar].length !== 1) return { ok: false, message: 'the bar is already split' };
  const m = meterOf(p);
  const len = barTicks(m);
  const mid = bar * len + len / 2;
  const lines = p.etudes.map((e) => timeline(e.melody));
  if (lines.some((tl) => tl.some((e) => 'pitch' in e.ev && e.start < mid && e.end > mid))) {
    return { ok: false, message: 'a note crosses the middle of the bar' };
  }
  const bars = p.bars.map((b, i) => (i === bar ? [b[0], second] : b));
  const slots = slotsOf(bars, m);
  const etudes = p.etudes.map((et, k) => {
    const melody: MelodyEvent[] = [];
    for (const e of lines[k]) {
      if (e.start < mid && e.end > mid) melody.push(...restsBetween(slots, e.start, e.end));
      else melody.push(e.ev);
    }
    return { ...et, melody };
  });
  return { ok: true, progression: { ...p, bars, etudes }, caret };
}

/**
 * Delete one slot of a split bar: the other slot (its chord and override) fills the bar; the melodies are untouched.
 * A one-slot bar has no slot to delete (the bar's own trash deletes it).
 */
export function deleteSlot(p: Progression, bar: number, part: number, caret: number): BarEdit {
  const b = p.bars[bar];
  if (!b || b.length !== 2 || (part !== 0 && part !== 1)) return { ok: false, message: 'the bar has only one chord' };
  const bars = p.bars.map((x, i) => (i === bar ? [withValidOverride(b[1 - part])] : x));
  return { ok: true, progression: { ...p, bars }, caret };
}

/** Merge a split bar: keeps the first slot's chord and override; the melodies are untouched. */
export function mergeBar(p: Progression, bar: number, caret: number): BarEdit {
  if (p.bars[bar].length !== 2) return { ok: false, message: 'the bar is not split' };
  const bars = p.bars.map((b, i) => (i === bar ? [withValidOverride(b[0])] : b));
  return { ok: true, progression: { ...p, bars }, caret };
}
