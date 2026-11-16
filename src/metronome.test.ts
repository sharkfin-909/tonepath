// The metronome (SPEC §3.7): tempo and sound settings, and the beats and slot starts of a form, in order.
import { describe, expect, it } from 'vitest';
import { BPM, beatTicks, clampBpm, clickSoundOf, metronomeEvents, secondsPerTick } from './metronome';
import { TICKS_PER_WHOLE } from './form';

const q = TICKS_PER_WHOLE / 4;

describe('metronome settings', () => {
  it('tempo: a whole number in 30–300; anything else 100', () => {
    expect([clampBpm(120), clampBpm(99.6), clampBpm(5), clampBpm(999)]).toEqual([120, 100, BPM.min, BPM.max]);
    expect([clampBpm(undefined), clampBpm('90'), clampBpm(NaN)]).toEqual([100, 100, 100]);
  });
  it('sound: a known id, else the click', () => {
    expect([clickSoundOf('cowbell'), clickSoundOf('kazoo'), clickSoundOf(undefined)]).toEqual(['cowbell', 'click', 'click']);
  });
  it('the beat is the time signature\'s unit; the tempo counts it', () => {
    expect(beatTicks({ beats: 4, unit: 4 })).toBe(q);
    expect(beatTicks({ beats: 6, unit: 8 })).toBe(q / 2);
    expect(secondsPerTick(120, { beats: 4, unit: 4 }) * q).toBeCloseTo(0.5); // a quarter at 120 = half a second
    expect(secondsPerTick(120, { beats: 6, unit: 8 }) * (q / 2)).toBeCloseTo(0.5); // an eighth at 120 in 6/8
  });
});

describe('metronome events', () => {
  it('every beat, accented on the bar; slot starts on their ticks (half-bar slots too)', () => {
    const meter = { beats: 4, unit: 4 };
    const slots = [
      { index: 0, start: 0 },
      { index: 1, start: 2 * q }, // a split bar
      { index: 2, start: 4 * q },
    ];
    const ev = metronomeEvents(meter, slots, 8 * q);
    expect(ev.map((e) => e.tick / q)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(ev.filter((e) => e.accent).map((e) => e.tick / q)).toEqual([0, 4]);
    expect(ev.filter((e) => e.slot !== null).map((e) => [e.tick / q, e.slot])).toEqual([[0, 0], [2, 1], [4, 2]]);
  });
  it('a slot starting off the beat still gets its own event (no click there)', () => {
    const ev = metronomeEvents({ beats: 3, unit: 4 }, [{ index: 0, start: 0 }, { index: 1, start: 1.5 * q }], 3 * q);
    expect(ev.map((e) => [e.tick / q, e.beat, e.slot])).toEqual([[0, true, 0], [1, true, null], [1.5, false, 1], [2, true, null]]);
  });
});
