// A metronome run (SPEC §3.7): from a slot, clicks every beat (scheduled ~120 ms ahead on the clock, so the beat stays
// steady whatever the main thread does) and announces each slot as it starts; at the form's end it wraps (Loop, asked
// each time round) or ends. Plain logic against a `Clock` seam: the app's adapter is the audio clock and timers
// (`useTransport`), the tests' a fake clock.

import type { Meter } from './form';
import { metronomeEvents, secondsPerTick } from './metronome';

/** Time in seconds; `at` runs a callback at a clock time, `every` repeats one; both return a cancel. */
export interface Clock {
  now(): number;
  at(time: number, fn: () => void): () => void;
  every(ms: number, fn: () => void): () => void;
}

export interface MetronomeRunOptions {
  clock: Clock;
  meter: Meter;
  slots: { index: number; start: number }[];
  /** The form's length (ticks). */
  end: number;
  bpm: number;
  startSlot: number;
  /** Read at the form's end: wrap (true) or end. */
  loop: () => boolean;
  /** A click to sound at clock time `at` (scheduled ahead). */
  onClick: (accent: boolean, at: number) => void;
  /** A slot starts (called at its time). */
  onSlot: (index: number) => void;
  /** The form ended without Loop (called at its end). */
  onEnd: () => void;
}

export interface MetronomeRun {
  stop(): void;
}

export const LOOKAHEAD_S = 0.12;
export const PUMP_MS = 25;
/** The first beat sounds this long after starting (time to schedule it). */
export const LEAD_S = 0.06;

export function startMetronomeRun(o: MetronomeRunOptions): MetronomeRun {
  const { clock, end } = o;
  const events = metronomeEvents(o.meter, o.slots, end);
  if (events.length === 0 || end <= 0) return { stop: () => {} };
  const spt = secondsPerTick(o.bpm, o.meter);
  const startTick = o.slots.find((s) => s.index === o.startSlot)?.start ?? 0;
  const t0 = clock.now() + LEAD_S; // the clock time of `startTick`
  let i = Math.max(0, events.findIndex((e) => e.tick >= startTick));
  let lap = 0; // completed passes through the form (Loop)
  let stopped = false; // stop() was called: nothing more happens
  let finished = false; // the form's end is scheduled: no more pumping (but its callbacks still run)
  const cancels: (() => void)[] = [];
  const at = (tick: number) => t0 + (lap * end + tick - startTick) * spt;

  const pump = () => {
    if (stopped || finished) return;
    while (clock.now() + LOOKAHEAD_S > at(i < events.length ? events[i].tick : end)) {
      if (i >= events.length) {
        if (!o.loop()) {
          cancels.push(clock.at(at(end), () => !stopped && o.onEnd()));
          finished = true;
          return;
        }
        lap++;
        i = 0;
        continue;
      }
      const e = events[i];
      const when = at(e.tick);
      if (e.beat) o.onClick(e.accent, when);
      if (e.slot !== null) {
        const slot = e.slot;
        cancels.push(
          clock.at(when, () => {
            if (!stopped) o.onSlot(slot);
          }),
        );
      }
      i++;
    }
  };
  pump();
  cancels.push(clock.every(PUMP_MS, pump));
  return {
    stop: () => {
      stopped = true;
      cancels.forEach((c) => c());
    },
  };
}
