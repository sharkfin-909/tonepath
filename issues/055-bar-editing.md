---
id: 55
title: "Bar editing"
labels: [ready-for-agent]
status: closed
blocked_by: [49]
assignee: claude
---

## What to build

Implement SPEC §4.1 bar editing in Write mode. Each bar number becomes a ⋯ bar handle (visible on the active bar and on hover) opening the bar menu: Insert before · Insert after · Duplicate · Copy · Paste · Split / Merge · Delete. Click a bar number to select it, ⇧click to extend to a run; with a bar selection ⌘C / ⌘V / ⌘D / ⌫ copy / paste / duplicate / delete. A "+" after the last bar appends an empty bar. The melody moves with the bars on insert / delete / duplicate; Paste replaces the target bars' chords, overrides and melody slice with no shifting and is refused past the form end; Split refused with "a note crosses the middle of the bar"; Merge keeps the first slot's chord. Caret moves with the music; deleting its bar sends it to the start of the bar now there. Minimum one bar. Every bar edit is one undo step.

Spec: [SPEC.md](../SPEC.md) §4.1, §6.3, §11, §14.8. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Test table 8 (SPEC §14.8) passes
- [x] Bar menu and keyboard shortcuts both work; ⌫ with no bar selection still edits notes
- [x] Delete is disabled on the last bar
- [x] Each bar edit undoes in one step

## Blocked by

- [Undo and redo](049-undo-and-redo.md)

## Resolution

Built.

- Pure `src/bars.ts`: `toSlices` / `fromSlices` cut the melody into per-bar slices and rebuild it. Any bar with music after it is padded with rests, so a partial bar can be duplicated or pasted mid-form. Operations: `insertBars`, `appendBar`, `deleteBars` (minimum one bar), `copyBars` → `BarClip`, `duplicateBars`, `pasteBars` (replaces, no shifting, refused past the form end), `splitBar` (refused if a **note** crosses the middle; a crossing rest is re-split into rests), `mergeBar` (keeps the first slot's chord and override). Each returns where the caret goes: it stays on the same music, and from a deleted bar it goes to the start of the bar now there (or the form end).
- Typing two chords into a one-slot bar now goes through `splitBar`, so it is refused the same way (§4.2).
- UI:
  - `src/chart/BarHandle.tsx`: a bar number on each bar's first slot (click selects, ⇧click extends to a run) plus a ⋯ handle shown on the active bar and on hover. The menu: Insert before · Insert after · Duplicate · Copy · Paste (disabled with an empty clipboard) · Split / Merge · Delete (disabled when it would remove every bar).
  - A "+" on the last slot appends a bar. Selected bars are outlined.
  - With a selection: ⌘C / ⌘V / ⌘D, ⌫ / Del delete the run, Esc clears. Without one, ⌫ edits notes as before.
  - Refusals show a short notice above the dock.
  - Caret clicks, undo and redo clear the selection.
  - Every bar edit goes through `update`, so it is one undo step and one save.
- Tests: test table 8 in `src/bars.test.ts` (14 rows), plus the two-chord split rule in `src/progression.test.ts`.
- Checked in the browser: insert before (gap rests, caret moves with the music) and undo; ⇧-select a run and ⌘D; ⌘C / ⌘V replaces a bar's chord and melody slice; split + merge; the "+" append; Delete disabled with every bar selected; ⌫ without a selection edits notes; the paste-past-the-end notice.


Note: two melody wipes seen during browser testing were the user pressing Clear all in the same session, not a bug.
