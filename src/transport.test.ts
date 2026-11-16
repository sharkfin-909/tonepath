// The transport (SPEC §3.7): looped bars as a slot range, the slot after a slot, the metronome's form, the targets.
import { describe, expect, it } from 'vitest';
import { newProgression, type Progression } from './progression';
import { loopRange, transportForm, upcomingSlot, upcomingTargets } from './transport';
import { instrumentView } from './view';

/** Dm7 G7 | Cmaj7 (concert): slots 0 Dm7, 1 G7 (bar 0), 2 Cmaj7 (bar 1). */
const prog = (more: Partial<Progression> = {}): Progression => ({ ...newProgression(), bars: [[{ chord: 'Dm7' }, { chord: 'G7' }], [{ chord: 'Cmaj7' }]], ...more });
const sorted = (s: Set<number> | null) => [...(s ?? [])].sort((a, b) => a - b);

describe('looped bars', () => {
  const view = instrumentView(prog());
  it('the selected bars are their slots; no selection is the whole form', () => {
    expect(loopRange(view.slots, { from: 1, to: 1 })).toEqual({ first: 2, last: 2 });
    expect(loopRange(view.slots, { from: 0, to: 1 })).toEqual({ first: 0, last: 2 });
    expect(loopRange(view.slots, null)).toBeNull();
  });
  it('the slot after the last wraps to the first; one outside the range goes to the first', () => {
    const range = { first: 1, last: 2 };
    expect([upcomingSlot(3, range, 1), upcomingSlot(3, range, 2), upcomingSlot(3, range, 0)]).toEqual([2, 1, 1]);
    expect(upcomingSlot(3, null, 2)).toBe(0);
  });
  it('the metronome runs the looped slots rebased to start at 0', () => {
    const f = transportForm(view, { first: 1, last: 2 });
    expect(f.slots.map((x) => x.index)).toEqual([1, 2]);
    expect(f.slots[0].start).toBe(0);
    expect(f.end).toBe(view.end - view.slots[1].start);
    expect(transportForm(view, null).slots).toHaveLength(3);
  });
});

describe('targets while running: the upcoming chord\'s tones', () => {
  it('the next chord; at the end, the first (of the form, or of the looped bars)', () => {
    const view = instrumentView(prog());
    expect(sorted(upcomingTargets(view, null, 0))).toEqual([2, 5, 7, 11]); // G7: G B D F
    expect(sorted(upcomingTargets(view, null, 2))).toEqual([0, 2, 5, 9]); // wraps to Dm7
    expect(sorted(upcomingTargets(view, { first: 1, last: 2 }, 2))).toEqual([2, 5, 7, 11]); // the range wraps to G7
  });
  it('in written pitch; nothing when the upcoming slot has no chord', () => {
    expect(sorted(upcomingTargets(instrumentView(prog({ instrument: 'bb-trumpet' })), null, 0))).toEqual([1, 4, 7, 9]); // G7 → A C♯ E G
    expect(upcomingTargets(instrumentView(prog({ bars: [[{ chord: 'C' }], [{ chord: 'N.C.' }]] })), null, 0)).toBeNull();
  });
});
