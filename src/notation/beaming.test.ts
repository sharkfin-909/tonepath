// Test table 9 (SPEC §14.9): beaming groups for 4/4, 3/4, 2/2, 6/8, 12/8 with mixed eighths / sixteenths and rests.
import { describe, expect, it } from 'vitest';
import { StaveNote } from 'vexflow/core';
import { layoutMeter, slotsOf } from '../form';
import { TICKS } from '../melody';
import type { Duration } from '../progression';
import { beamsFor, slotBeamGroups } from './beaming';

const VEX: Record<Duration, string> = { w: 'w', h: 'h', q: 'q', e: '8', s: '16' };
const e = TICKS.e;

/** `e e s s r8 q` → notes; `r` prefix = rest. Returns beamed index groups, e.g. `0-1 2-3`. */
function beamed(spec: string, ts: string, parts = 1, part = 0): string {
  const m = layoutMeter(ts);
  const slot = slotsOf([Array.from({ length: parts }, () => ({ chord: '' }))], m)[part];
  const notes = spec.split(' ').map((tok) => {
    const rest = tok.startsWith('r');
    const d = (rest ? tok.slice(1) : tok) as Duration;
    return new StaveNote({ keys: ['c/5'], duration: VEX[d] + (rest ? 'r' : '') });
  });
  return beamsFor(notes, m, slot.start, slot.end)
    .map((b) => b.getNotes().map((n) => notes.indexOf(n as StaveNote)))
    .map((g) => `${g[0]}-${g[g.length - 1]}`)
    .join(' ');
}

describe('test table 9: beam groups', () => {
  it('group lengths per meter (ticks): quarter beats in simple time, dotted quarters in compound', () => {
    const q = TICKS.q;
    expect(slotBeamGroups(layoutMeter('4/4'), 0, 4 * q)).toEqual([q, q, q, q]);
    expect(slotBeamGroups(layoutMeter('3/4'), 0, 3 * q)).toEqual([q, q, q]);
    expect(slotBeamGroups(layoutMeter('2/2'), 0, 4 * q)).toEqual([q, q, q, q]);
    expect(slotBeamGroups(layoutMeter('6/8'), 0, 6 * e)).toEqual([3 * e, 3 * e]);
    expect(slotBeamGroups(layoutMeter('12/8'), 0, 12 * e)).toEqual([3 * e, 3 * e, 3 * e, 3 * e]);
  });

  it('a slot starting mid-beat (second half of a split 3/4 bar) starts with a partial group', () => {
    const [, second] = slotsOf([[{ chord: '' }, { chord: '' }]], layoutMeter('3/4'));
    expect(slotBeamGroups(layoutMeter('3/4'), second.start, second.end)).toEqual([e, 2 * e]);
  });

  it('4/4: eighths pair by beat, never across beats 1–2', () => {
    expect(beamed('e e e e e e e e', '4/4')).toBe('0-1 2-3 4-5 6-7');
  });

  it('4/4: sixteenths in fours, mixed eighth + sixteenths within a beat', () => {
    expect(beamed('s s s s e s s q h', '4/4')).toBe('0-3 4-6');
  });

  it('rests break beams', () => {
    expect(beamed('e re e e q h', '4/4')).toBe('2-3');
    expect(beamed('s rs s s q h', '4/4')).toBe('2-3');
  });

  it('3/4: three beats of eighths', () => {
    expect(beamed('e e e e e e', '3/4')).toBe('0-1 2-3 4-5');
  });

  it('2/2: one group per quarter-note beat', () => {
    expect(beamed('e e e e e e e e', '2/2')).toBe('0-1 2-3 4-5 6-7');
  });

  it('6/8: groups of three eighths; sixteenths stay inside the group', () => {
    expect(beamed('e e e e e e', '6/8')).toBe('0-2 3-5');
    expect(beamed('s s e e e e e', '6/8')).toBe('0-3 4-6');
    expect(beamed('e re e e e e', '6/8')).toBe('3-5');
  });

  it('12/8: four groups of three', () => {
    expect(beamed('e e e e e e e e e e e e', '12/8')).toBe('0-2 3-5 6-8 9-11');
  });

  it('split 3/4 bar, second slot: the off-beat eighth stands alone, then a beat pair', () => {
    expect(beamed('e e e', '3/4', 2, 1)).toBe('1-2');
  });
});
