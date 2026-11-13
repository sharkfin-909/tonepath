---
id: 60
title: "Storage robustness and backup reminder"
labels: [ready-for-agent]
status: closed
blocked_by: [59]
assignee: claude
---

## What to build

Finish SPEC §12.1 and the §3.5 reminder: `storage` events from other tabs reload the open progression quietly when nothing is pending, library refreshes on any change; quota errors keep the edit in memory and show the persistent "Can't save — storage full…" banner, retrying on the next edit; corrupt keys are skipped with "1 progression couldn't be read" and left untouched; `navigator.storage.persist()` on the first edit each session; save on `visibilitychange` → hidden. Backup reminder on the library screen: "Last backup: ‹age› · Export all" when there are changes since the last Export all and it is > 14 days old or never; dismissible until the next change; Safari also suggests adding to the home screen.

Spec: [SPEC.md](../SPEC.md) §3.5, §12.1. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Editing in one tab updates another open tab
- [x] Simulated quota error shows the banner and keeps the edit
- [x] A corrupt key is skipped and reported, not deleted
- [x] Reminder appears / hides according to the 14-day rule and dismissal

## Blocked by

- [Export, import and migrations](059-export-import-and-migrations.md)

## Resolution

Built.

- `src/storage.ts`: every write goes through `tryWrite`, which reports success or failure to `onSaveStatus` listeners. On a quota error the edit stays in memory, and the next save is the retry. `countUnreadable` counts unreadable progression keys; they are skipped and never touched.
- `src/App.tsx`:
  - A `storage` event for the open progression reloads it quietly (last write wins) and clears undo history and the bar selection, unless a text field is open here (a pending edit). If the progression was deleted elsewhere, the app returns to the library.
  - `navigator.storage.persist()` is called once per session, on the first committed edit.
  - The hide-time save was already in place; it doesn't bump `updatedAt`.
- `src/Root.tsx`: a persistent "Can't save — storage full. Export and delete some progressions." banner while saves fail; the library refreshes on `storage` events from other tabs; the "N progression(s) couldn't be read" line; and the backup reminder. Export all sets `lastBackupAt`, and dismissing sets `reminderDismissedAt` (both device fields).
- `src/backup.ts` (tested in `src/backup.test.ts`): `shouldRemind` shows the reminder when there are changes since the last Export all **and** that backup is more than 14 days old or never happened, and not dismissed since the latest change. Also `backupAge` and `isSafari`; on Safari the line adds the home-screen / Dock suggestion.
- Checked in the browser (two tabs):
  - Renaming in tab A updated tab B and cleared its undo.
  - A patched `setItem` that throws showed the banner; Clear all stayed on screen while storage kept the 12 notes; the next edit saved and the banner cleared.
  - A corrupt key gave "1 progression couldn't be read" and its raw string was kept.
  - The reminder showed "Last backup: never", hid on dismiss, came back after a rename, and hid after Export all.
  - The user's data was restored afterwards.
