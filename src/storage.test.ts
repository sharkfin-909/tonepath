import { describe, expect, it } from 'vitest';
import { newProgression, setChord } from './progression';
import { countUnreadable, listProgressions, onSaveStatus, openInitial, PROGRESSION_PREFIX, saveProgression } from './storage';
import { MemoryStorage } from './test-memory-storage';


describe('storage', () => {
  it('creates and saves a new progression on first launch', () => {
    const s = new MemoryStorage();
    const p = openInitial(s, () => 'abc');
    expect(p.id).toBe('abc');
    expect(p.bars).toHaveLength(4);
    expect(p.timeSignature).toBe('4/4');
    expect(p.barsPerRow).toBe(4);
    expect(p.melody).toEqual([]);
    expect(s.getItem(PROGRESSION_PREFIX + 'abc')).not.toBeNull();
  });

  it('reopens the saved progression with chords exactly as typed', () => {
    const s = new MemoryStorage();
    const p = openInitial(s, () => 'abc');
    saveProgression(s, { ...p, ...setChord(p, 1, 0, ' G7(b9, #11)') });
    const again = openInitial(s, () => 'other');
    expect(again.id).toBe('abc');
    expect(again.bars[1][0].chord).toBe(' G7(b9, #11)');
  });

  it('opens the newest progression and skips corrupt keys', () => {
    const s = new MemoryStorage();
    s.setItem(PROGRESSION_PREFIX + 'bad', '{not json');
    saveProgression(s, { ...newProgression(), id: 'old', updatedAt: '' }, new Date('2026-01-01'));
    saveProgression(s, { ...newProgression(), id: 'new', updatedAt: '' }, new Date('2026-02-01'));
    expect(listProgressions(s).map((p) => p.id)).toEqual(['new', 'old']);
    expect(openInitial(s).id).toBe('new');
    expect(s.getItem(PROGRESSION_PREFIX + 'bad')).toBe('{not json');
  });
});

describe('setChord', () => {
  it('returns the same object when nothing changes', () => {
    const p = newProgression();
    expect(setChord(p, 0, 0, '')).toBe(p);
    expect(setChord(p, 0, 0, 'Dm7').bars[0][0].chord).toBe('Dm7');
  });
});

describe('storage robustness', () => {
  it('a corrupt key is skipped and counted, and left untouched', () => {
    const s = new MemoryStorage();
    saveProgression(s, { ...newProgression(), id: 'ok', updatedAt: '' });
    s.setItem(PROGRESSION_PREFIX + 'bad', '{corrupt');
    s.setItem(PROGRESSION_PREFIX + 'odd', JSON.stringify({ hello: 1 }));
    expect(listProgressions(s).map((p) => p.id)).toEqual(['ok']);
    expect(countUnreadable(s)).toBe(2);
    expect(s.getItem(PROGRESSION_PREFIX + 'bad')).toBe('{corrupt');
  });

  it('a quota error keeps the edit in memory, reports failure, and the next save is the retry', () => {
    const s = new MemoryStorage();
    let full = true;
    const real = s.setItem.bind(s);
    s.setItem = (k: string, v: string) => {
      if (full) throw new DOMException('full', 'QuotaExceededError');
      real(k, v);
    };
    const seen: boolean[] = [];
    const off = onSaveStatus((ok) => seen.push(ok));
    const p = saveProgression(s, { ...newProgression(), title: 'Kept', id: 'a', updatedAt: '' });
    expect(p.title).toBe('Kept'); // the caller keeps the edit
    expect(listProgressions(s)).toHaveLength(0);
    full = false;
    saveProgression(s, p);
    expect(listProgressions(s)[0].title).toBe('Kept');
    expect(seen).toEqual([false, true]);
    off();
  });
});
