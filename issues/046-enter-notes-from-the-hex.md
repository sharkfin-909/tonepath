---
id: 46
title: "Enter notes from the hex"
labels: [ready-for-agent]
status: closed
blocked_by: [45]
assignee: claude
---

## What to build

Add the progression-level melody (`{pitch, d}` / `{d}`, SPEC §6.1) and the caret as a time position. A length latch in the rail (`1 · whole` … `5 · 16th`, keys `1`–`5`). Clicking a hex cell inserts that concert pitch at the caret with the latched length using **overwrite** editing (§6.2 items 1–4): covered events removed, leftover becomes rests, later music never moves; inserting past the melody end gap-fills with rests; a length that would cross the end of the caret's slot (or form) is refused with a flash + message. Implement the pure `melody` module incl. `eventsForSlot`. Each slot engraves its slice on its VexFlow stave (durations `w h q 8 16`, keys from spelled names, `GhostNote` padding, SOFT voice, `Accidental.applyAccidentals`). The caret shows as a line + marker; the active slot follows it. Melody autosaves.

Spec: [SPEC.md](../SPEC.md) §6.1–6.2, §7.1, §14.4–14.5. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Test tables 4 (overwrite / refuse / gap-fill) and 5 (slicing on split bars, non-4/4, short melody) pass
- [x] Hex clicks produce correctly spelled notes on the stave of the caret's slot
- [x] A refused insert flashes the length button with a message and changes nothing
- [x] Melody survives reload

## Blocked by

- [Docked hex for the active slot](045-docked-hex-for-the-active-slot.md)

## Resolution

Built 2026-11-13.

- `src/melody.ts`: pure `melody` module.
  - `timeline`, `melodyEnd`, `formEnd`.
  - `insertAt(melody, slots, caret, d, pitch | null)`: overwrite insert. Covered events are removed, an overhang's leftover becomes rests, later music never moves, and a gap past the melody's end is filled with rests. It refuses "Doesn't fit in this slot" / "Doesn't fit before the end of the form" / "End of the form", and moves the caret to the new event's end.
  - `fillDurations` / `restsBetween`: the largest lengths that start on their own beat, measured from the slot's start, split at slot lines. Also used for ghost padding.
  - `eventsForSlot` (events whose start lies in the slot) and `snapToEvent`.
- Engraving (`src/notation/Stave.tsx`): one SOFT voice per slot (`w h q 8 16`, `…r` rests on `b/4` / `d/3`). Keys come from `spelling` names of the slot, padded with `GhostNote`s, with `Accidental.applyAccidentals` (key C) and VexFlow's default `Beam.generateBeams`. The caret is a non-engraved SVG line + triangle marker at the note's x (or time-interpolated), and the event under it is tinted blue.
- App:
  - The caret is a time position. The active slot = `slotAt(caret)`, which drives the hex and the tint. The caret opens at the melody's end and isn't saved.
  - The rail has the length latch `1 · whole` … `5 · 16th` (keys 1–5, ignored in text fields). A refused insert flashes the latched button twice and shows the message under the latch for ~1.8 s.
  - Hex cell click = insert at the caret. The melody autosaves with the progression; an old save without `melody` loads as `[]`.
- Tests: `src/melody.test.ts` holds test table 4 (insert rows) and test table 5; 277 tests pass in total.

Verified in Chrome over Dm7 | G7 G7alt | Cmaj7 | Bbm7:
- Hex picks engrave on the caret's slot with the right spelling (G7alt's chord-tone `A#` with ♯, its scale tone `Ab` with ♭; `Bb` in Bbm7).
- A whole note in the G7 half-bar is refused with the flash + message, and the melody is unchanged.
- An insert in Bbm7 past the melody's end gap-filled Cmaj7 with a whole rest.
- Everything survived a reload. No console errors.

Choices beyond the spec:
- **Clicking a slot moves the caret to that slot's start** (a no-op when the caret is already inside it). It stands in until precise caret placement (note click, click past the end, ←/→) in [Caret and editing keys](048-caret-and-editing-keys.md). Clicks on the chord / scale labels don't move the caret.
- The caret opens at the melody's end, so new picks append rather than overwrite bar 1.
- "On their own beat" for rests and ghosts is measured from the slot's start, so a 3/4 second bar gets `rh rq`, not offbeat-split rests.

Deferred:
- Del / ⌫ / nudge / Clear all rows of test table 4, the Rest latch, and caret moves → [Caret and editing keys](048-caret-and-editing-keys.md).
- Audition on pick → [Audio](047-audio.md).
- Meter-aware beam groups (compound time) → [Notation details](052-notation-details.md).
- Undo → [Undo and redo](049-undo-and-redo.md).
- Written-pitch keys → [Instruments](051-instruments.md).
