import { describe, expect, it } from 'vitest';
import { lastEdited } from './LibraryScreen';

describe('lastEdited', () => {
  const now = new Date('2026-11-13T12:00:00Z');
  it('reads relative times', () => {
    expect(lastEdited('2026-11-13T11:59:40Z', now)).toBe('just now');
    expect(lastEdited('2026-11-13T11:55:00Z', now)).toBe('5 min ago');
    expect(lastEdited('2026-11-13T09:00:00Z', now)).toBe('3 h ago');
    expect(lastEdited('2026-11-12T10:00:00Z', now)).toBe('yesterday');
    expect(lastEdited('2026-11-09T12:00:00Z', now)).toBe('4 days ago');
    expect(lastEdited('', now)).toBe('—');
  });
});
