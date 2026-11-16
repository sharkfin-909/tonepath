// A metronome run against a fake clock (SPEC §3.7): clicks ahead on the beat, slots at their times, wrap or end.
import { describe, expect, it } from 'vitest';
import { LEAD_S, startMetronomeRun, type Clock } from './metronomeRun';
import { TICKS_PER_WHOLE } from './form';

const q = TICKS_PER_WHOLE / 4;

/** A clock that only moves when told; `advance` runs every due callback in time order. */
function fakeClock() {
  let t = 0;
  let id = 0;
  const timers = new Map<number, { time: number; fn: () => void }>();
  const intervals = new Map<number, { ms: number; next: number; fn: () => void }>();
  const clock: Clock = {
    now: () => t,
    at: (time, fn) => {
      const k = ++id;
      timers.set(k, { time, fn });
      return () => timers.delete(k);
    },
    every: (ms, fn) => {
      const k = ++id;
      intervals.set(k, { ms, next: t + ms / 1000, fn });
      return () => intervals.delete(k);
    },
  };
  const advance = (seconds: number) => {
    const until = t + seconds;
    for (;;) {
      const due = [
        ...[...timers].map(([k, v]) => ({ time: v.time, run: () => (timers.delete(k), v.fn()) })),
        ...[...intervals].map(([, v]) => ({ time: v.next, run: () => ((v.next += v.ms / 1000), v.fn()) })),
      ]
        .filter((d) => d.time <= until)
        .sort((a, b) => a.time - b.time)[0];
      if (!due) break;
      t = Math.max(t, due.time);
      due.run();
    }
    t = until;
  };
  return { clock, advance };
}

/** 4/4, two one-bar slots (8 beats), at 120 bpm: a beat is 0.5 s, a bar 2 s. */
const setup = (more: { loop?: boolean; startSlot?: number } = {}) => {
  const { clock, advance } = fakeClock();
  const clicks: { accent: boolean; at: number }[] = [];
  const slots: { index: number; t: number }[] = [];
  let ended = 0;
  const run = startMetronomeRun({
    clock,
    meter: { beats: 4, unit: 4 },
    slots: [{ index: 0, start: 0 }, { index: 1, start: 4 * q }],
    end: 8 * q,
    bpm: 120,
    startSlot: more.startSlot ?? 0,
    loop: () => more.loop ?? true,
    onClick: (accent, at) => clicks.push({ accent, at }),
    onSlot: (index) => slots.push({ index, t: clock.now() }),
    onEnd: () => ended++,
  });
  return { run, advance, clicks, slots, ended: () => ended, now: clock.now };
};

describe('metronome run', () => {
  it('clicks every beat on time, accented on the bar, scheduled ahead', () => {
    const m = setup();
    m.advance(3.9);
    expect(m.clicks.map((c) => +(c.at - LEAD_S).toFixed(3))).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5]);
    m.advance(0.06); // within the 120 ms lookahead of the next bar: scheduled before it sounds
    expect(m.now()).toBeLessThan(4 + LEAD_S);
    expect(m.clicks.filter((c) => c.accent).map((c) => +(c.at - LEAD_S).toFixed(3))).toEqual([0, 2, 4]); // each bar (2 s)
  });

  it('announces each slot at its time, the starting one too', () => {
    const m = setup();
    m.advance(2.5);
    expect(m.slots.map((s) => [s.index, +(s.t - LEAD_S).toFixed(3)])).toEqual([[0, 0], [1, 2]]);
  });

  it('Loop: wraps to the first slot and keeps the beat', () => {
    const m = setup({ loop: true });
    m.advance(4.5);
    expect(m.slots.map((s) => s.index)).toEqual([0, 1, 0]);
    expect(m.ended()).toBe(0);
  });

  it('no Loop: the end is called once, at the form\'s end; nothing after', () => {
    const m = setup({ loop: false });
    m.advance(3.9);
    expect(m.ended()).toBe(0);
    m.advance(0.3); // past 4 s (+ lead)
    expect(m.ended()).toBe(1);
    const clicks = m.clicks.length;
    m.advance(5);
    expect(m.ended()).toBe(1);
    expect(m.clicks.length).toBe(clicks);
    expect(m.slots.map((s) => s.index)).toEqual([0, 1]);
  });

  it('starts from a later slot', () => {
    const m = setup({ startSlot: 1 });
    m.advance(0.2);
    expect(m.slots.map((s) => s.index)).toEqual([1]);
    expect(m.clicks[0].accent).toBe(true);
  });

  it('stop: nothing more happens (no slots, no end)', () => {
    const m = setup({ loop: false });
    m.advance(1);
    m.run.stop();
    const n = m.clicks.length;
    m.advance(10);
    expect([m.clicks.length, m.slots.length, m.ended()]).toEqual([n, 1, 0]);
  });
});
