---
id: 15
title: "Saved data and JSON schema"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: [14]
assignee: claude
---

## Question

Pin the persisted shape. Per progression: id, title, time signature (display only), bars-per-row, bars → 1–2 slots → chord symbol as typed (concert; [Instrument view](011-instrument-view.md)), scale override (type relative to root, [Note classification](006-note-classification.md)), note set (concert MIDI pitches, no spelling / position — [Lattice editing interaction](008-lattice-editing-interaction.md)), instrument id. Device-level: last-picked instrument, mute ([Audition and chord preview](012-audition-and-chord-preview.md)). Decide: storage (localStorage vs IndexedDB), a schema **version** field and migration rule, the export file format (one `.json` per progression vs a library bundle, per [Progression library](014-progression-library.md)), how instruments are referenced (stable ids, so the list can grow), import validation (bad / unknown chords kept as typed; out-of-range MIDI), and keeping it compact for post-v1 share-by-URL. From [Progression library](014-progression-library.md): the single-progression file and the library **bundle** format (both importable by one Import; imports always get fresh ids, so does a file carry an id at all?), device-level **last backup** date and "reminder dismissed" state, last-open progression id, `navigator.storage.persist()` result if worth keeping, and whether the demo progression ships as a bundled JSON file. Ship an example file in the spec.

## Resolution

Grilled with the user, 2026-11-12. Terms recorded in [CONTEXT.md](../CONTEXT.md). Example file: [demo.improwiser.json](../examples/demo.improwiser.json).

1. **Storage: localStorage.** One key per progression, `improwiser:progression:<id>` (the whole progression as JSON), plus one `improwiser:device` key. No index key: the library screen parses every progression key and derives title, instrument, bar count and last edited. Sizes are a few KB per progression, far below the ~5 MB cap.
2. **Identity.** `id` = `crypto.randomUUID()` (storage key and last-open only, never shown); `updatedAt` = ISO timestamp set on every change (drives newest-first and "last edited"). No `createdAt`. **Files carry neither**; an import gets a fresh `id` and `updatedAt` = import time, so it lands at the top.
3. **Version + migration.** Integer `v` (currently `1`) on the device key (speaks for all of storage) and on every file. Migrations are a chain of pure `migrateNtoN+1` steps. On launch, an older storage version is migrated entirely in memory, written back, then the device `v` is bumped. Imports with an older `v` run through the same chain before validation. Newer than the app: the file is refused ("Made by a newer Improwiser — reload to update"); newer storage → banner, tab treats storage as read-only (no down-migration).
4. **Progression shape** (stored and exported alike, readable keys):
   ```json
   { "title": "ii–V–I in C", "timeSignature": "4/4", "barsPerRow": 4, "instrument": "bb-trumpet",
     "bars": [
       [ { "chord": "Dm7", "notes": [62, 65, 69, 72] } ],
       [ { "chord": "G7", "notes": [59, 65, 67] }, { "chord": "G7alt", "scale": "altered", "notes": [] } ] ] }
   ```
   `bars` = list of bars; each bar = list of 1–2 slots (the split is structural). Slot: `chord` = concert symbol as typed (`""` empty, `"N.C."` no chord); `scale` = optional override id; `notes` = concert MIDI integers, ascending, unique. `timeSignature` is a display string. Share-by-URL (post-v1) gets its own packed encoding; the rule is "keep the model small and flat".
5. **Stable ids**, never renamed or reused; display names may change.
   - Instruments (14): `concert`, `flute`, `violin`, `trombone`, `vibraphone`, `bb-trumpet`, `bb-clarinet`, `bb-soprano-sax`, `bb-tenor-sax`, `eb-alto-sax`, `eb-baritone-sax`, `f-horn`, `guitar`, `bass` (double bass / bass guitar).
   - Scales (18): `ionian`, `dorian`, `phrygian`, `lydian`, `mixolydian`, `aeolian`, `locrian`, `locrian-nat2`, `melodic-minor`, `harmonic-minor`, `lydian-augmented`, `lydian-dominant`, `mixolydian-b6`, `altered`, `phrygian-dominant`, `whole-tone`, `half-whole-diminished`, `whole-half-diminished`.
   - Unknown instrument → `concert`, noted once in the import toast. Unknown scale, or one not in the slot chord's candidate list → override dropped silently (same rule as a chord edit).
6. **File envelope.** `{ "app": "improwiser", "v": 1, "kind": "progression", "progression": {…} }` for *Export one* (`‹title›.improwiser.json`); `{ "app": "improwiser", "v": 1, "kind": "library", "exportedAt": "<ISO>", "progressions": [ … ] }` for *Export all* (`improwiser-library-YYYY-MM-DD.json`), newest edit first; imported in that order to the top. No device state in files. Pretty-printed (2-space), each `notes` array on one line.
7. **Import validation: strict on structure, lenient on fields.**
   - Whole file rejected (toast "‹file›: not an Improwiser file" / newer-version message): invalid JSON, `app` missing or wrong, unknown `kind`, newer `v`.
   - A bundle entry is skipped (others still import): not an object, or no `bars` list.
   - Repairs: missing/blank title → "Untitled"; bad `timeSignature` → `"4/4"`; `barsPerRow` outside 1–8 → 4; unknown instrument → `concert`; a bar with 0 slots → one empty slot, more than 2 → first 2; non-string `chord` → `""`, any string kept as typed (unparseable shows red); bad `scale` dropped; `notes` keep integers 0–127, deduped and sorted, others dropped. Out-of-range-for-instrument MIDI is **kept** (flagged hollow). 0 bars → the Bar grid default (4 empty bars). Unknown extra keys ignored, not preserved.
   - One toast per import with counts, e.g. "Imported 3 progressions · 2 notes and 1 bar repaired". No dialogs.
8. **Device key** `improwiser:device`: `{ v, lastInstrument, muted, lastOpenId, lastBackupAt, reminderDismissedAt, seeded }`.
   - `lastBackupAt` set when *Export all* triggers the download (completion can't be detected); `null` = never. Reminder shows when `max(updatedAt) > lastBackupAt` and the backup is > 14 days old or never, unless `reminderDismissedAt` is later than `max(updatedAt)`.
   - `navigator.storage.persist()` called on the first edit each session; result not stored.
   - `lastOpenId` missing or dangling → open newest; empty library → empty state.
   - **Demo**: bundled `demo.improwiser.json` (`kind: "progression"`), loaded through the normal import path once, guarded by `seeded: true`. Deleted = gone for good (no restore). Content: `Dm7 | G7 | Cmaj7 | Cmaj7` in Concert with a few notes per slot; it is the spec's example file.
9. **Writes and tabs.**
   - Write the open progression on every committed edit (same moment as an undo step, so coalesced groups write once), plus on `visibilitychange` → hidden. No debounce.
   - Other tabs via the `storage` event: if the open progression changed elsewhere and this tab has nothing pending, reload it quietly (undo history cleared). Concurrent edits: last write wins per progression; no locking or merging. The library list refreshes on any progression key change.
   - Quota error: keep the edit in memory, persistent banner "Can't save — storage full. Export and delete some progressions.", retry on the next edit.
   - Corrupt stored key: skipped in the library, raw string kept (never deleted), one line "1 progression couldn't be read". No auto-repair in v1.

Rejected: IndexedDB (async, needs a wrapper, no benefit at this size); the whole library in one key; an index key; ids or timestamps in files; per-progression version fields; down-migration; short keys for compactness now; device state in backups; rejecting whole files over field errors; dropping unparseable chords or out-of-range notes on import; storing the `persist()` result; restorable demo; tab locking.
