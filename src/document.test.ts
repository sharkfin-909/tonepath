// The progression document (SPEC §6.3, §12.1): commits, undo / redo with the caret, saving, other tabs.
import { describe, expect, it } from 'vitest';
import { melodyOf } from './test-progression';
import { openDocument } from './document';
import { newProgression, setTitle } from './progression';
import { PROGRESSION_PREFIX, type StoredProgression } from './storage';
import { MemoryStorage } from './test-memory-storage';

const T0 = '2026-01-01T00:00:00.000Z';
const start = (): StoredProgression => ({ ...newProgression(), id: 'p1', updatedAt: T0, title: 'One' });
const stored = (s: Storage) => JSON.parse(s.getItem(PROGRESSION_PREFIX + 'p1')!) as StoredProgression;
const clock = () => {
  let n = 0;
  return () => new Date(Date.UTC(2026, 0, 2, 0, 0, n++));
};

describe('progression document', () => {
  it('a commit is one undo step and one save (updatedAt bumped)', () => {
    const s = new MemoryStorage();
    const doc = openDocument(s, start(), clock());
    expect(doc.commit(setTitle(doc.progression, 'Two'), 5)).toBe(true);
    expect(doc.progression.title).toBe('Two');
    expect(stored(s).title).toBe('Two');
    expect(stored(s).updatedAt).not.toBe(T0);
    expect([doc.canUndo, doc.canRedo]).toEqual([true, false]);
  });

  it('a commit that changes nothing records nothing', () => {
    const doc = openDocument(new MemoryStorage(), start());
    expect(doc.commit(doc.progression, 0)).toBe(false);
    expect(doc.canUndo).toBe(false);
  });

  it('undo restores the progression and the caret before the edit; redo the caret it was undone from', () => {
    const s = new MemoryStorage();
    const doc = openDocument(s, start(), clock());
    doc.commit(setTitle(doc.progression, 'Two'), 5);
    expect(doc.undo(9)).toBe(5);
    expect(doc.progression.title).toBe('One');
    expect(stored(s).title).toBe('One');
    expect(doc.redo(5)).toBe(9);
    expect(doc.progression.title).toBe('Two');
    expect(doc.redo(0)).toBeNull();
  });

  it('another tab: a write reloads and clears undo; a delete is reported; other keys and junk are ignored', () => {
    const doc = openDocument(new MemoryStorage(), start());
    doc.commit(setTitle(doc.progression, 'Two'), 0);
    const key = PROGRESSION_PREFIX + 'p1';
    expect(doc.external('other', '{}')).toBe('ignored');
    expect(doc.external(key, '{not json')).toBe('ignored');
    expect(doc.external(key, JSON.stringify({ ...start(), title: 'Elsewhere' }))).toBe('reloaded');
    expect(doc.progression.title).toBe('Elsewhere');
    expect(doc.canUndo).toBe(false);
    expect(doc.external(key, null)).toBe('deleted');
  });

  it('flush writes as is (updatedAt kept); a save without etudes opens with one empty etude', () => {
    const s = new MemoryStorage();
    const { etudes: _e, ...old } = start();
    const doc = openDocument(s, old as StoredProgression);
    expect(melodyOf(doc.progression)).toEqual([]);
    doc.flush();
    expect(stored(s).updatedAt).toBe(T0);
  });
});
