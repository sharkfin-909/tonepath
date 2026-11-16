---
id: 80
title: "The editing session's open etude"
labels: [ready-for-agent]
status: open
blocked_by: [78, 79]
assignee:
---

## Parent

[Etudes belong to a progression](077-etudes-belong-to-a-progression.md) (SPEC §3.0, §6, §10)

## What to build

The session (`session.ts`, run by `useChartSession`) works on one **open etude**:

- `SessionState.etude` — the open etude's id. On open: the progression's last-open etude (missing → the first).
  Remembered on the progression's storage record as `openEtudeId` — written without bumping `updatedAt`, never in
  files, not an undo step.
- Melody intents (pick, length / Rest, delete, nudge, step-play, Clear notes, event clicks…) read and write the open
  etude through `withEtude`. **Clear all** empties every chord and scale and the open etude's notes (the other
  etudes keep theirs; their marks follow the cleared chords).
- The **instrument view** (`instrumentView`) is built from the progression's form and the open etude's instrument
  and clef — every mode follows it. `instrument` / `clef` intents set the open etude's.
- New intents, all allowed in every mode (the mode profile's `ANY_MODE`), each one undo step except `etude-open`:
  - `etude-open { id }` — switch: caret to the melody's end, latches kept, halo / refusal cleared.
  - `etude-new` — an empty etude named *Etude N* (lowest free N) on the open etude's instrument, opened.
  - `etude-duplicate` — a copy of the open etude named *‹name› (copy)*, opened.
  - `etude-rename { text }` — blank → refused.
  - `etude-delete` — removes the open etude and opens its neighbour; the last one is replaced by a fresh empty
    *Etude 1* on the same instrument.
- Undo / redo restore the open etude with the snapshot (an undone `etude-new` reopens the etude open before it).
- Another tab's write that removes the open etude reopens the first.

## Acceptance criteria

- [ ] Session tests: each etude intent, in each mode; melody intents touch only the open etude
- [ ] Deleting the only etude leaves one empty *Etude 1* on the same instrument, open
- [ ] Switching etude switches the chart's transposition and the hex (a B♭ trumpet etude and a Concert etude)
- [ ] Reopening a progression opens the etude last open there
- [ ] Undo after new / duplicate / delete / rename restores the etudes and the open one

## Blocked by

- [078](078-schema-v3-etudes.md)
- [079](079-bar-edits-carry-every-etude.md)
