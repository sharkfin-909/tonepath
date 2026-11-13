---
id: 37
title: "Bar editing"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

How are bars added, inserted, deleted, split, merged, copied and pasted in layout C ([Whole-screen layout (docked hex)](030-whole-screen-layout-docked-hex.md)), and what happens to the melody? [Bar grid and progression](003-bar-grid-and-progression.md) put these in a "bar menu", but the control rail has no place for them yet. Overwrite editing ([Melody entry and caret (docked)](028-melody-entry-and-caret-docked.md)) says later music never moves, yet inserting or deleting a whole bar must either shift the melody by whole bars or leave it in place against new chords. Also: does split / merge refuse when events would cross the new slot line? SPEC.md §4.1 and §15 item 3 state a provisional default (bar edits move the melody with the bars).

## Resolution

Grilled with the user on 2026-11-13. Amends [Bar grid and progression](003-bar-grid-and-progression.md) (bar operations) for the etude model; complements [Melody entry and caret (docked)](028-melody-entry-and-caret-docked.md), whose "later music never moves" rule governs note entry, not form edits. Glossary updated in [CONTEXT.md](../CONTEXT.md).

1. **Insert / delete carry the melody with the bars.** Inserting a bar moves every later event one bar later; the new bar is empty. Deleting a bar removes the events inside it and moves every later event one bar earlier. This is always clean, because events never cross a slot (so never a bar) boundary. Notes stay over the chord they were written against. Rejected: keeping the melody fixed in time while chords shift under it.
2. **Duplicate** inserts a copy of the bar (chords, scale overrides, its melody slice) straight after it; later music moves by one bar.
3. **Copy / Paste.** Copy puts the selected bar or **run of bars** (Shift-click bar numbers) on an in-app clipboard. **Paste replaces** the target bar(s)' chords, overrides and melody slice, from the target onward, with no shifting. It is refused if it would run past the end of the form. Pasted notes are kept as-is; clashes get out-of-scale marks. Rejected: paste-as-insert.
4. **Split** (one slot → two): the new second half starts empty (no chord); the melody is untouched. **Refused** with a short message ("a note crosses the middle of the bar") if an event crosses the midpoint. Typing two chords into a one-slot bar follows the same rule. **Merge** (two → one): keeps the first slot's chord and override, drops the second's chord; the melody is untouched (marks as needed).
5. **Controls (layout C, Write mode only).** Each bar's number becomes a small **⋯ bar handle** (visible on the active bar and on hover) opening the **bar menu**: Insert before · Insert after · Duplicate · Copy · Paste · Split / Merge · Delete. Clicking a bar number selects that bar; Shift-click extends to a run. With a bar selection, **⌘C / ⌘V / ⌘D / ⌫** copy / paste / duplicate / delete; with no bar selection, ⌫ edits notes as before. A **"+"** after the last bar appends an empty bar. Every bar edit is one undo step. Handles and "+" are hidden in Play and Stand.
6. **Caret** moves with the music (stays on the same note). If its own bar is deleted, it goes to the start of the bar now in that position (or the end of the form). **Minimum one bar** (Delete disabled on the last); **no maximum** in v1.
