---
id: 14
title: "Progression library"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

Does v1 hold one chart or a **library** of saved progressions? If a library: how does the user see the list, create (the [Bar grid and progression](003-bar-grid-and-progression.md) default: title, 4 empty bars, 4/4, 4 per row, instrument = device's last pick per [Instrument view](011-instrument-view.md)), open, rename, duplicate and delete progressions; what opens on launch; and does JSON export / import work per progression, for the whole library, or both (import conflicts: same title / id)? Is there undo (at least for delete)?

## Resolution

Grilled with the user, 2026-11-12. Terms recorded in [CONTEXT.md](../CONTEXT.md).

1. **A library** of any number of progressions, **autosaved** to browser storage on every change — no save step; survives closing the tab / restarting the browser. Lost only by clearing site data, private windows, Safari's ~7-day eviction of unvisited sites, or using another browser/device — so export is the backup, and the app calls `navigator.storage.persist()` on the first edit.
2. **Launch** reopens the last-open progression, straight to the chart. **First launch** opens a deletable **demo progression** (a short ii–V–I with some notes set).
3. **Library screen** — via a *Library* button beside the title. Rows: title, instrument, bar count, last edited; newest edit first; click opens. Actions: New, Duplicate, Rename, Delete, Export one, Export all, Import. The chart screen only offers inline title rename (click the title).
4. **Delete** — immediate, no confirm dialog; toast *"‹title› deleted · Undo"* for ~10 s, restoring exactly; no trash after that. Deleting the open progression returns to the library; deleting the last leaves an empty state with a big *New progression* button.
5. **Chart undo / redo** — Cmd/Ctrl+Z, Shift+Cmd/Ctrl+Z. One step per edit to the progression (note add/remove, ↑/↓, chord commit, split/merge, bar add/delete, paste, title, scale override, instrument switch); typed groups and a held ↑/↓ run coalesce to one step. Not undoable: mute, selection, target slot. Implemented as whole-progression snapshots, ~100 steps, in memory only; cleared on switching progression or reload.
6. **Export / import** — *Export one* → a single `‹title›.improwiser.json`; *Export all* → a dated library bundle (`improwiser-library-YYYY-MM-DD.json`). One *Import* accepts either kind, several files at once. **Imports only add**: each progression gets a fresh identity, never overwrites; title clashes get a suffix *"(2)"*; a toast reports the count and new rows are highlighted. File format → [Saved data and JSON schema](015-saved-data-and-json-schema.md).
7. **Backup reminder** — a quiet, dismissible line on the library screen only: *"Last backup: ‹age› · Export all"*, shown when there are changes since the last Export all and it's > 14 days old or never happened; dismissed until the next change. On Safari it also suggests adding to the home screen. No modals, nothing on the chart screen.
8. **Duplicate** copies everything (chords, note sets, scale overrides, instrument, settings) as *"‹title› (copy)"*, lands at the top and opens. **New** uses the [Bar grid and progression](003-bar-grid-and-progression.md) defaults with the device's last-picked instrument, opening with the title in edit.
9. **Not in v1**: search, folders, tags, sort options, multi-select, trash.

Rejected: single chart with file juggling; side-drawer library (costs chart width); confirm-dialog deletes; a trash; no chart undo (autosave makes mistakes permanent); per-action inverse undo (snapshots are simpler at this size); overwrite-on-import; no backup reminder; modal reminders.
