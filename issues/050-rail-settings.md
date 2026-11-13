---
id: 50
title: "Rail settings"
labels: [ready-for-agent]
status: closed
blocked_by: [46, 49]
assignee: claude
---

## What to build

Fill in the control rail (SPEC §3.1): inline title rename; time signature field (stored as typed, parsed `N/D` to size bars; bad → layout as `4/4`), with bars and the melody re-sliced accordingly; bars per row (1–8); **Clear all** (melody → `[]`, caret to start, one undo step, no confirm); a readout of the caret's bar, chord and scale. Each change is one undo step and autosaves.

Spec: [SPEC.md](../SPEC.md) §3.1, §4.1, §6.2.10. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Changing the time signature to `3/4` or `6/8` resizes bars and re-slices the melody
- [x] Unparseable time signature shows as typed but lays out as `4/4`
- [x] Bars per row reflows the chart
- [x] Clear all empties the melody in one undoable step and leaves chords / title untouched
- [x] Readout tracks the caret

## Blocked by

- [Enter notes from the hex](046-enter-notes-from-the-hex.md)
- [Undo and redo](049-undo-and-redo.md)

## Resolution

Built.

- Pure edits in `src/progression.ts`: `setTitle` (trimmed, blank → "Untitled"), `setTimeSignature` (stored as typed; re-fits the melody), `setBarsPerRow` (1–8) and `clearMelody`. Each returns the same object when nothing changes, so it costs no undo step or save.
- `fitToForm` in `src/melody.ts` is the §12.3 slot-crossing repair. Times are kept. An event crossing its slot end is shortened to the longest length that fits, and the cut-off time becomes rests split at slot boundaries. Events past the form end are dropped. The time-signature change uses it, and **Export, import and migrations** can reuse it (it returns `shortened` / `dropped` counts for the toast).
- UI in `src/rail/RailSettings.tsx`: inline title and time-signature fields (Enter / blur commits, Esc cancels; an unparseable time signature shows in red with "laid out as 4/4"), a bars-per-row select, a Clear all button (disabled when the melody is empty) and the caret readout (bar · chord · scale). The rail now runs: title · instrument stub · time · bars per row · audio · latch + Rest · undo / redo · Clear all · readout.
- Tests: rail settings plus the Clear all row of test table 4 (`src/progression.test.ts`), and `fitToForm` (`src/melody.test.ts`).
- Checked in the browser: 4/4 → 3/4 re-slices, bars per row 2 reflows, `waltz` lays out as 4/4, Clear all → ⌘Z restores the melody and caret, rename works, and typing in fields doesn't trigger shortcuts.

Behaviour to know about: a time-signature change that makes the form shorter than the melody drops the notes past the end. Notes cut at new bar lines stay cut if you change back. ⌘Z restores both.
