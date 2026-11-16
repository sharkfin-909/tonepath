// Pure `metronome` module (SPEC §3.7): the transport — the form moves on in time instead of by the notes
// played. The beat is the time signature's (a quarter in 4/4, an eighth in 6/8); the tempo counts those beats.
// The scheduling itself (audio clock, timers) is `useMetronome`.

import { TICKS_PER_WHOLE, barTicks, type Meter } from './form';
import type { ClickSound } from './audio';

export const METRONOME_SOUNDS: { id: ClickSound; label: string }[] = [
  { id: 'click', label: 'Click' },
  { id: 'hihat', label: 'Hi-hat' },
  { id: 'cowbell', label: 'Cowbell' },
];

export const BPM = { min: 30, max: 300, start: 100 } as const;

/** A tempo: a whole number within 30–300; anything else is the default 100. */
export function clampBpm(n: unknown): number {
  return typeof n === 'number' && Number.isFinite(n) ? Math.min(BPM.max, Math.max(BPM.min, Math.round(n))) : BPM.start;
}

/** A saved sound id, or the default click. */
export function clickSoundOf(id: unknown): ClickSound {
  return METRONOME_SOUNDS.some((s) => s.id === id) ? (id as ClickSound) : 'click';
}

/** Ticks per beat (the time signature's unit). */
export const beatTicks = (meter: Meter) => TICKS_PER_WHOLE / meter.unit;

/** Seconds per tick at a tempo (beats per minute, in the time signature's beat). */
export const secondsPerTick = (bpm: number, meter: Meter) => 60 / bpm / beatTicks(meter);

/**
 * What happens at a tick of the form: a beat (accented on a bar's first) and / or a new slot. In time order, from 0
 * to the form's end (exclusive).
 */
export interface MetronomeEvent {
  tick: number;
  beat: boolean;
  accent: boolean;
  /** A slot starts here: its index. */
  slot: number | null;
}

export function metronomeEvents(meter: Meter, slots: { index: number; start: number }[], end: number): MetronomeEvent[] {
  const byTick = new Map<number, MetronomeEvent>();
  const at = (tick: number) => {
    let e = byTick.get(tick);
    if (!e) byTick.set(tick, (e = { tick, beat: false, accent: false, slot: null }));
    return e;
  };
  const beat = beatTicks(meter);
  const bar = barTicks(meter);
  for (let t = 0; t < end; t += beat) Object.assign(at(t), { beat: true, accent: t % bar === 0 });
  for (const s of slots) if (s.start < end) at(s.start).slot = s.index;
  return [...byTick.values()].sort((a, b) => a.tick - b.tick);
}
