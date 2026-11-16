// The Practice run (SPEC §3.7): notes, moves by hand and the metronome in; the run and the session's intents out.
import { describe, expect, it } from 'vitest';
import { newProgression, type Progression } from './progression';
import { followSlot, metronomeChord, metronomeEnd, restartSlot, runNote, runTargets, type PracticeRun, type RunContext } from './practiceRun';
import { nextSlot, type AdvanceRule } from './practice';
import { instrumentView } from './view';

/** Dm7 G7 | Cmaj7 (concert). */
const prog = (melody: Progression['melody'] = []): Progression => ({ ...newProgression(), bars: [[{ chord: 'Dm7' }, { chord: 'G7' }], [{ chord: 'Cmaj7' }]], melody });
const ctx = (rule: AdvanceRule, more: Partial<RunContext> = {}, p = prog()): RunContext => ({ view: instrumentView(p), melody: p.melody, rule, count: 2, loop: true, metronome: false, ...more });
const start = (slot = 0) => followSlot(null, slot)!;

describe('following the session\'s slot', () => {
  it('not practising: no run; starting or moving by hand: a fresh run (advances kept); the run\'s own slot: the same run', () => {
    expect(followSlot(start(), null)).toBeNull();
    const r: PracticeRun = { ...start(0), played: new Set([3]), advances: 5 };
    expect(followSlot(r, 0)).toBe(r);
    const moved = followSlot(r, 2)!;
    expect(moved.state.slot).toBe(2);
    expect(moved.played.size).toBe(0);
    expect(moved.advances).toBe(5);
  });
  it('a rule change restarts the count on the same slot', () => {
    const r = runNote(start(), 60, true, ctx('count')).run;
    expect(r.state.count).toBe(1);
    expect(restartSlot(r).state).toMatchObject({ slot: 0, count: 0 });
  });
});

describe('a note played', () => {
  it('counts: the session hears it first; a right note moves the form on (landed) and bumps the advances', () => {
    const r = runNote(start(), 71, true, ctx('guide')); // B: 3rd of G7, the next chord
    expect(r.intents).toEqual([{ type: 'practice-note' }, { type: 'practice-advance', index: 1, landed: true }]);
    expect(r.run.state.slot).toBe(1);
    expect(r.run.advances).toBe(1);
    const stay = runNote(start(), 62, true, ctx('guide')); // D: not a guide tone of G7
    expect(stay.intents).toEqual([{ type: 'practice-note' }]);
    expect(stay.run.advances).toBe(0);
  });
  it('finishing the form without Loop ends Practice (back to Write); with Loop it wraps', () => {
    const last = { ...start(2) };
    expect(runNote(last, 60, true, ctx('count', { count: 1, loop: false })).intents).toEqual([{ type: 'practice-note' }, { type: 'mode', mode: 'write' }]);
    expect(runNote(last, 60, true, ctx('count', { count: 1 })).intents.at(-1)).toEqual({ type: 'practice-advance', index: 0, landed: false });
  });
  it('with the metronome, notes never move the form (no intents)', () => {
    const r = runNote(start(), 71, true, ctx('guide', { metronome: true }));
    expect(r.intents).toEqual([]);
    expect(r.run).toEqual(start());
  });
  it('Follow marks the written notes played; a new time through clears them', () => {
    const p = prog([{ pitch: 62, d: 'h' }, { pitch: 67, d: 'h' }, { pitch: 64, d: 'w' }]);
    const c = ctx('follow', {}, p);
    let r = runNote(start(), 62, true, c).run;
    expect([...r.played]).toEqual([0]);
    r = runNote(r, 67, true, c).run; // slot 1
    r = runNote(r, 64, true, c).run; // slot 2 → wraps to 0
    expect(r.state.slot).toBe(0);
    expect([...r.played]).toEqual([]);
  });
});

describe('the metronome', () => {
  it('a chord on time moves the form on and sounds; the end without Loop goes back silently', () => {
    expect(metronomeChord(2)).toEqual([{ type: 'practice-advance', index: 2, landed: true }]);
    expect(metronomeEnd()).toEqual([{ type: 'practice-advance', index: 0, landed: false }]);
  });
});

describe('targets', () => {
  it('by rule: the next chord\'s guide tones, named; with the metronome: the upcoming chord\'s chord tones', () => {
    const c = ctx('guide');
    const t = runTargets(start(), c, c.view.slots[0]);
    expect([...t.hex!.pcs!].sort((a, b) => a - b)).toEqual([5, 11]); // F, B
    expect(t.names.split(' · ').sort()).toEqual(['B', 'F']);
    const m = runTargets(start(), ctx('guide', { metronome: true }), c.view.slots[0]);
    expect([...m.hex!.pcs!].sort((a, b) => a - b)).toEqual([2, 5, 7, 11]); // G7: G B D F
    expect(m.names).toBe('');
    const last = runTargets(start(), ctx('guide', { metronome: true }), c.view.slots[2]);
    expect([...last.hex!.pcs!].sort((a, b) => a - b)).toEqual([0, 2, 5, 9]); // the end wraps: Dm7
  });
  it('in a transposing view the rings are in written pitch', () => {
    const p = { ...prog(), instrument: 'bb-trumpet' };
    const c = ctx('guide', { metronome: true }, p);
    expect([...runTargets(start(), c, c.view.slots[0]).hex!.pcs!].sort((a, b) => a - b)).toEqual([4, 7, 9, 1].sort((a, b) => a - b)); // G7 → A C♯ E G
  });
});

describe('looping selected bars', () => {
  // Slots: 0 Dm7, 1 G7 (bar 1), 2 Cmaj7 (bar 2). Looping slots 1–2.
  const range = { first: 1, last: 2 };
  it('the slot after the last wraps to the first; one outside the range goes to the first', () => {
    const c = ctx('count', { range });
    expect(nextSlot(c, 1)).toBe(2);
    expect(nextSlot(c, 2)).toBe(1);
    expect(nextSlot(c, 0)).toBe(1);
    expect(nextSlot(ctx('count'), 2)).toBe(0);
  });
  it('without Loop, finishing the range ends Practice; with it, the run goes round to the first', () => {
    const c = ctx('count', { range, count: 1 });
    expect(runNote(start(2), 60, true, { ...c, loop: false }).intents).toContainEqual({ type: 'mode', mode: 'write' });
    const r = runNote(start(2), 60, true, c);
    expect(r.intents).toContainEqual({ type: 'practice-advance', index: 1, landed: false });
  });
  it('the targets are the range\'s next chord: at its end, its first', () => {
    const t = runTargets(start(2), ctx('guide', { range }), ctx('guide').view.slots[2]);
    expect([...t.hex!.pcs!].sort((a, b) => a - b)).toEqual([5, 11]); // G7: B, F
    expect(metronomeEnd(1)).toEqual([{ type: 'practice-advance', index: 1, landed: false }]);
  });
});
