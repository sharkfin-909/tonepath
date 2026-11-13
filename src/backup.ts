// Backup reminder (SPEC §3.5): on the library screen only. Shown when there are changes since the last Export all
// and that backup is more than 14 days old (or never happened); dismissed until the next change.

export const REMIND_AFTER_DAYS = 14;
const DAY = 24 * 60 * 60 * 1000;

export interface ReminderInput {
  /** `updatedAt` of every progression. */
  edits: string[];
  lastBackupAt?: string;
  reminderDismissedAt?: string;
  now?: Date;
}

export function shouldRemind({ edits, lastBackupAt, reminderDismissedAt, now = new Date() }: ReminderInput): boolean {
  if (!edits.length) return false;
  const latest = Math.max(...edits.map((e) => Date.parse(e) || 0));
  const backup = lastBackupAt ? Date.parse(lastBackupAt) : NaN;
  const changed = Number.isNaN(backup) || latest > backup;
  const old = Number.isNaN(backup) || now.getTime() - backup > REMIND_AFTER_DAYS * DAY;
  const dismissed = !!reminderDismissedAt && Date.parse(reminderDismissedAt) >= latest;
  return changed && old && !dismissed;
}

/** "never", "15 days ago", "3 weeks ago", "2 months ago". */
export function backupAge(lastBackupAt: string | undefined, now = new Date()): string {
  const t = lastBackupAt ? Date.parse(lastBackupAt) : NaN;
  if (Number.isNaN(t)) return 'never';
  const days = Math.floor((now.getTime() - t) / DAY);
  if (days < 1) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 21) return `${days} days ago`;
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

/** Safari (desktop or iOS) can evict site storage; installing to the home screen keeps it (SPEC §3.5). */
export function isSafari(ua: string): boolean {
  return /safari/i.test(ua) && !/chrome|chromium|crios|fxios|edg|android/i.test(ua);
}
