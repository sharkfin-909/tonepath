---
id: 59
title: "Export, import and migrations"
labels: [ready-for-agent]
status: closed
blocked_by: [58]
assignee: claude
---

## What to build

Implement the pure `schema` module and the file flows per SPEC §12.3–12.4: Export one (`‹title›.improwiser.json`) and Export all (`improwiser-library-YYYY-MM-DD.json`), envelope with `app`, `v: 2`, `kind`, pretty-printed, no ids / timestamps / device state. Import accepts either kind, several files at once, **only adds** (fresh id, title clash → "(2)"), one toast with counts, new rows highlighted. Whole-file rejections and per-entry skips as specified; every lenient repair, including slot-crossing events shortened to fit with the cut-off time padded as rests ("N notes shortened"). `migrate1to2` chain used for storage on launch and for imports; newer `v` refused (storage → read-only banner).

Spec: [SPEC.md](../SPEC.md) §12.3–12.4, §14.7. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Test table 7 (SPEC §14.7) passes: migrate1to2, every repair, newer-version refusal
- [x] Export one → import round-trips a progression exactly (new id)
- [x] Importing a library bundle adds all entries and reports counts
- [x] Hand-edited file with a slot-crossing note imports shortened and padded, counted in the toast

## Blocked by

- [Library screen and demo](058-library-screen-and-demo.md)

## Resolution

Built.

- Pure `src/schema.ts`:
  - **Migrations:** `migrate1to2` (strip slot `notes`, `melody` = `[]` if missing) and the `migrate(p, v)` chain.
  - **Repair:** `repairProgression` performs every §12.3 repair. For the melody it drops invalid events, then calls `fitToForm`, which drops the suffix past the form and shortens slot-crossing events, padding the cut-off time with rests.
  - **Files:** `exportOne` / `exportAll` build the envelopes (no ids, timestamps or device state; 2-space; filenames per spec). `parseFile` does the whole-file rejections ("not an Improwiser file", newer `v` → "Made by a newer Improwiser — reload to update") and the per-entry skips.
  - **Helpers:** `uniqueTitle` ("(2)", "(3)") and `importSummary` (the single toast line).
- `src/library.ts`:
  - `importTexts` only adds: fresh id, `updatedAt` = now, newest-first in file order so the batch lands at the top, title clashes numbered.
  - `migrateStorage` runs on launch. Device `v` older (missing = 1): every progression key is migrated and written back (corrupt keys untouched), then `v` = 2. Newer: read-only.
  - The demo is now seeded through `importTexts`.
- Read-only (`src/readOnly.ts`): `saveProgression`, `writeProgression`, `writeDevice`, delete and restore all skip writing; a red banner shows on both screens.
- Library UI: Import… (several files at once, via a hidden file input), Export all in the header, and Export on each row. A 6-second import toast; imported rows are highlighted.
- Choice beyond the spec: a **missing** `instrument` imports quietly as Concert. Only a present-but-unknown one is noted in the toast.
- Tests: test table 7 in `src/schema.test.ts`; import / migration / read-only in `src/library.test.ts`.
- Checked in the browser:
  - Export one has no ids and round-trips exactly (new id, "(2)" title).
  - A three-file import (round trip + hand-edited file with a slot-crossing note and an unknown instrument + a broken file) gives one toast: "Imported 2 progressions · 1 note shortened · 1 unknown instrument → Concert · broken.json: not an Improwiser file", with the new rows highlighted.
  - The Export all bundle re-imports every entry.
  - Device `v: 3` → banner, and Clear all + Delete leave storage byte-identical.
  - The user's data was restored afterwards.
