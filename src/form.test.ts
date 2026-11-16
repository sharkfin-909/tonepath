import { describe, expect, it } from 'vitest';
import { barTicks, layoutMeter, parseTimeSignature, slotAt, slotsOf, TICKS_PER_WHOLE, stepSlot } from './form';

const W = TICKS_PER_WHOLE;

describe('parseTimeSignature', () => {
  it.each([
    ['4/4', { beats: 4, unit: 4 }],
    ['3/4', { beats: 3, unit: 4 }],
    ['6/8', { beats: 6, unit: 8 }],
    ['2/2', { beats: 2, unit: 2 }],
    [' 12 / 8 ', { beats: 12, unit: 8 }],
  ])('%s parses', (text, meter) => expect(parseTimeSignature(text)).toEqual(meter));

  it.each(['', 'C', '4', '4/3', '0/4', '4/0', 'x/4', '4/4/4'])('%j does not parse', (text) =>
    expect(parseTimeSignature(text)).toBeNull(),
  );

  it('falls back to 4/4 for layout', () => {
    expect(layoutMeter('C')).toEqual({ beats: 4, unit: 4 });
    expect(layoutMeter(undefined)).toEqual({ beats: 4, unit: 4 });
  });
});

describe('barTicks', () => {
  it.each([
    ['4/4', W],
    ['3/4', (3 * W) / 4],
    ['6/8', (6 * W) / 8],
    ['2/2', W],
    ['5/4', (5 * W) / 4],
  ])('%s', (ts, ticks) => expect(barTicks(layoutMeter(ts))).toBe(ticks));

  it('keeps half-bar slots on whole ticks for common meters', () => {
    for (const ts of ['4/4', '3/4', '5/4', '6/8', '7/8', '3/8', '5/16']) {
      expect(Number.isInteger(barTicks(layoutMeter(ts)) / 2)).toBe(true);
    }
  });
});

describe('slotsOf', () => {
  const bars = [[{ chord: 'Dm7' }], [{ chord: 'G7' }, { chord: 'G7alt' }], [{ chord: 'Cmaj7' }]];

  it('lays out one- and two-slot bars in 4/4', () => {
    expect(slotsOf(bars, layoutMeter('4/4'))).toEqual([
      { index: 0, bar: 0, part: 0, start: 0, end: W, barEnd: true },
      { index: 1, bar: 1, part: 0, start: W, end: 1.5 * W, barEnd: false },
      { index: 2, bar: 1, part: 1, start: 1.5 * W, end: 2 * W, barEnd: true },
      { index: 3, bar: 2, part: 0, start: 2 * W, end: 3 * W, barEnd: true },
    ]);
  });

  it('sizes bars from the time signature', () => {
    const s = slotsOf(bars, layoutMeter('3/4'));
    expect(s.map((x) => [x.start, x.end])).toEqual([
      [0, 288],
      [288, 432],
      [432, 576],
      [576, 864],
    ]);
  });

  it('finds the slot under a time, clamping to the last slot', () => {
    const s = slotsOf(bars, layoutMeter('4/4'));
    expect(slotAt(s, 0)?.index).toBe(0);
    expect(slotAt(s, W)?.index).toBe(1);
    expect(slotAt(s, 1.5 * W)?.index).toBe(2);
    expect(slotAt(s, 3 * W)?.index).toBe(3);
    expect(slotAt([], 0)).toBeUndefined();
  });
});

describe('stepSlot (Improvise, Read etude)', () => {
  it('steps slot by slot and wraps at both ends', () => {
    expect(stepSlot(0, 1, 5)).toBe(1);
    expect(stepSlot(4, 1, 5)).toBe(0);
    expect(stepSlot(0, -1, 5)).toBe(4);
    expect(stepSlot(0, 1, 1)).toBe(0);
  });

  it('a split bar is two stops', () => {
    const slots = slotsOf([[{ chord: 'Dm7' }, { chord: 'G7' }], [{ chord: 'C' }]], layoutMeter('4/4'));
    expect(slots.length).toBe(3);
    expect(slots[stepSlot(0, 1, slots.length)].part).toBe(1);
  });
});
