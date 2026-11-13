---
id: 49
title: "Undo and redo"
labels: [ready-for-agent]
status: closed
blocked_by: [46]
assignee: claude
---

## What to build

Whole-progression snapshots (including the caret), ~100 steps, in memory, cleared on switching progression or reload. ⌘/Ctrl+Z and ⇧⌘/Ctrl+Z plus rail buttons. One step per committed edit in SPEC §6.3 (insert, delete, nudge, chord commit, scale override, …); caret moves, mute and mode switches are not undoable. Each undoable step is also the moment the progression is written to storage.

Spec: [SPEC.md](../SPEC.md) §6.3, §12.1. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Undo / redo restore melody, chords, overrides and caret exactly
- [x] Caret moves and mute don't create undo steps
- [x] History is capped at ~100 and cleared on reload
- [x] Every committed edit both creates one undo step and saves

## Blocked by

- [Enter notes from the hex](046-enter-notes-from-the-hex.md)

## Resolution

Built.

- Pure `src/history.ts` (`record` / `undo` / `redo`, capped at `HISTORY_LIMIT = 100`, oldest dropped) with tests in `src/history.test.ts`. A snapshot is `{ progression, caret }` held by reference; edits already build new objects.
- `App.update` is the single commit point. Each real change records the state before it, caret included, then saves. An edit that changes nothing (e.g. Del on a mid rest) records and saves nothing. Undo and redo restore a snapshot exactly and save it too. History lives in memory only, so a reload clears it.
- ⌘/Ctrl+Z and ⇧⌘/Ctrl+Z, plus ↶ Undo / ↷ Redo buttons in the rail (disabled when there is nothing to undo or redo). Inside a text field the browser's own undo applies.
- Checked in the browser: caret moves and mute leave Undo disabled. Nudge and insert are one step each. Undo ×2 then redo restores melody and caret exactly. A chord commit is undone back to the old chord. A reload clears history.

Notes for later slices:
- **Library screen and demo** must reset the history when switching progression (call `setHistory(emptyHistory())` when it opens another progression).
- **Rail settings**, **Instruments** and **Bar editing** get their undo step for free by going through `update`.
