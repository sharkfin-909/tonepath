---
id: 79
title: "Bar edits carry every etude"
labels: [ready-for-agent]
status: closed
blocked_by: [78]
assignee: claude
---

## Parent

[Etudes belong to a progression](077-etudes-belong-to-a-progression.md) (SPEC §4.1, §6)

## What to build

Form edits move every etude's melody with the bars, not just one (`bars.ts`, `setTimeSignature` in
`progression.ts`):

- Insert before / after, duplicate, split, merge, delete and append apply the same per-melody transform to each
  etude (one core that edits bars + one melody's slices; the progression-level function maps it over `etudes`).
- The time-signature change refits every etude's melody to the new form.
- **Copy** carries the chords and the **open** etude's slice; **Paste** replaces the target bars' chords, writes the
  slice into the open etude, and leaves rests in the pasted bars of the other etudes (their later music keeps its
  timing). `copyBars` / `pasteBars` take the open etude's id.
- Chord and scale edits never touch any melody (as today).

## Acceptance criteria

- [x] Test table with a two-etude progression: each of insert / duplicate / split / merge / delete / append keeps
      both melodies aligned to their bars (a note in bar 3 stays in the same bar of music)
- [x] Time signature 4/4 → 3/4 refits both etudes as one does today
- [x] Paste: the open etude gets the clip's notes; the other etude gets rests there and keeps the rest of its music
- [x] Existing one-melody bar tests pass unchanged against a one-etude progression

## Blocked by

- [078](078-schema-v3-etudes.md)

## Resolution

Built in the same pass as 078 (`bars.ts` had to change shape anyway): every bar edit and the time-signature
refit map over `etudes`; Duplicate copies every etude's music in the bars; Copy / Paste take the open etude's id.
Split refuses when a note crosses the middle in any etude. Tests: "bar edits carry every etude" in `bars.test.ts`.
