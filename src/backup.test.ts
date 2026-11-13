import { describe, expect, it } from 'vitest';
import { backupAge, isSafari, shouldRemind } from './backup';

const now = new Date('2026-11-30T12:00:00Z');
const day = (d: number) => new Date(now.getTime() - d * 86400000).toISOString();

describe('backup reminder', () => {
  it('never backed up + any progression → remind', () => {
    expect(shouldRemind({ edits: [day(1)], now })).toBe(true);
  });
  it('an empty library → no reminder', () => {
    expect(shouldRemind({ edits: [], now })).toBe(false);
  });
  it('a backup more than 14 days old with changes since → remind', () => {
    expect(shouldRemind({ edits: [day(2)], lastBackupAt: day(15), now })).toBe(true);
  });
  it('a recent backup → no reminder, even with changes', () => {
    expect(shouldRemind({ edits: [day(1)], lastBackupAt: day(10), now })).toBe(false);
  });
  it('an old backup but no changes since → no reminder', () => {
    expect(shouldRemind({ edits: [day(30)], lastBackupAt: day(20), now })).toBe(false);
  });
  it('dismissed until the next change', () => {
    expect(shouldRemind({ edits: [day(3)], reminderDismissedAt: day(2), now })).toBe(false);
    expect(shouldRemind({ edits: [day(1)], reminderDismissedAt: day(2), now })).toBe(true);
  });
  it('ages read naturally', () => {
    expect(backupAge(undefined, now)).toBe('never');
    expect(backupAge(day(15), now)).toBe('15 days ago');
    expect(backupAge(day(30), now)).toBe('4 weeks ago');
    expect(backupAge(day(90), now)).toBe('3 months ago');
  });
  it('detects Safari, not Chrome / Firefox iOS / Edge', () => {
    expect(isSafari('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')).toBe(true);
    expect(isSafari('Mozilla/5.0 (Macintosh) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36')).toBe(false);
    expect(isSafari('Mozilla/5.0 (iPhone) AppleWebKit/605.1.15 (KHTML, like Gecko) FxiOS/120 Mobile/15E148 Safari/605.1.15')).toBe(false);
  });
});
