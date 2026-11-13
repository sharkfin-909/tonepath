---
id: 58
title: "Library screen and demo"
labels: [ready-for-agent]
status: closed
blocked_by: [50, 51]
assignee: claude
---

## What to build

Library screen per SPEC §3.5, reached via ← Library: rows (title, instrument, bar count, last edited), newest edit first, click opens. Actions New (title in edit, 4 empty bars, `4/4`, 4 per row, last-picked instrument), Duplicate ("‹title› (copy)", opens), Rename, Delete (immediate, ~10 s Undo toast, restores exactly; deleting the open one returns to the library; empty state with New progression). Device key `improwiser:device` (SPEC §12.5). Launch reopens the last-open progression (dangling → newest). First launch seeds the bundled demo once (guarded by `seeded`).

Spec: [SPEC.md](../SPEC.md) §3.5, §12.5. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] First launch opens the demo ii–V–I; deleting it is permanent across reloads
- [x] New, Duplicate, Rename, Delete (+ Undo toast) work and persist
- [x] Launch reopens the last-open progression
- [x] Empty library shows the New progression empty state

## Blocked by

- [Rail settings](050-rail-settings.md)
- [Instruments](051-instruments.md)

## Resolution

Built.

- `src/library.ts`: `launch` (seeds the bundled demo once, guarded by `seeded`; then `lastOpenId`, else the newest; else the empty state), `createProgression` (device's last-picked instrument), `duplicateProgression` ("‹title› (copy)", newest), `renameProgression`, `deleteProgression` → raw string, and `restoreProgression` (exact, `updatedAt` included). Also `progressionFromEnvelope` (minimal, for the demo) and `rememberOpen`. Tests in `src/library.test.ts`; the in-memory Storage moved to `src/test-memory-storage.ts`.
- `src/Root.tsx` switches the library screen and the chart screen. `App` now takes `initial` / `onLibrary` / `renameOnOpen` and is keyed by progression id, so undo history is per progression (cleared on switching, §6.3). ← Library is live. New opens with the title in edit.
- `src/library/LibraryScreen.tsx`: rows newest first (title, instrument, bar count, relative last edited via `lastEdited`), click opens, Duplicate / Rename (inline) / Delete per row, a ~10 s "“‹title›” deleted · Undo" toast, and an empty state with a big "+ New progression".
- Fixes along the way:
  - The device key field is `playArrival` as SPEC §12.5 names it (Play mode had used `onArrival`).
  - The hide-time safety save no longer bumps `updatedAt` (new `writeProgression`), so opening a progression doesn't change its "last edited".
- Choice beyond the spec: if storage already holds progressions when `seeded` is unset (pre-library saves), the demo is not added, so existing work isn't buried under it. Only affects dev data.
- Checked in the browser, from cleared storage: first launch opens the demo; Delete + Undo restores it; deleting again is permanent across reload (empty state); New opens with its title in edit; Duplicate opens the copy at the top; Rename persists; a reload reopens the last-open progression. The user's data was restored afterwards.

For **Export, import and migrations**: route demo seeding through the schema import path, and add Export one / Export all / Import to the library header and rows.
