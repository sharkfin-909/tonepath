import { describe, expect, it } from 'vitest';
import { HISTORY_LIMIT, emptyHistory, record, redo, undo } from './history';

describe('undo history', () => {
  it('undo restores the recorded state and keeps the present for redo', () => {
    let h = record(emptyHistory<string>(), 'a'); // edit a → b
    h = record(h, 'b'); // edit b → c
    const u1 = undo(h, 'c')!;
    expect(u1.state).toBe('b');
    const u2 = undo(u1.history, u1.state)!;
    expect(u2.state).toBe('a');
    expect(undo(u2.history, u2.state)).toBeNull();
    const r1 = redo(u2.history, u2.state)!;
    expect(r1.state).toBe('b');
    const r2 = redo(r1.history, r1.state)!;
    expect(r2.state).toBe('c');
    expect(redo(r2.history, r2.state)).toBeNull();
  });

  it('a new edit after undo drops the redo branch', () => {
    const h = record(record(emptyHistory<string>(), 'a'), 'b');
    const u = undo(h, 'c')!;
    const h2 = record(u.history, u.state); // edit b → d
    expect(h2.future).toEqual([]);
    expect(redo(h2, 'd')).toBeNull();
    expect(undo(h2, 'd')!.state).toBe('b');
  });

  it(`is capped at ${HISTORY_LIMIT} steps, dropping the oldest`, () => {
    let h = emptyHistory<number>();
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) h = record(h, i);
    expect(h.past.length).toBe(HISTORY_LIMIT);
    expect(h.past[0]).toBe(20);
  });

  it('nothing to undo or redo on an empty history', () => {
    expect(undo(emptyHistory(), 'x')).toBeNull();
    expect(redo(emptyHistory(), 'x')).toBeNull();
  });
});
