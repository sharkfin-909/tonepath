---
id: 73
title: "Improvise edits the lead sheet"
labels: [ready-for-agent]
status: closed
blocked_by: [72]
assignee:
---

## Parent

[Mode menu](068-mode-menu.md) (SPEC §3)

## What to build

In Improvise, with the transport stopped: chord and scale entry as in Write etude (editing a chord makes its slot
current), the **form group** (time signature, bars per row, undo / redo), the "+" after the last bar and each bar's
trash can. Bar numbers pick the looped bars (no ⋯ menu). All of it hides or does nothing while the transport runs.
**Hide hex** is offered in Improvise only.

## Acceptance criteria

- [x] Stopped: chords, scales, time, bars per row, undo, "+" and trash work; the staves stay empty
- [x] Running: none of them show or act
- [x] Hide hex shows in Improvise only; Write etude always shows the hex

## Blocked by

- [072](072-improvise-runs-on-the-transport.md)

## Resolution

Built: Chart `mode` / `current` / `running`; session `FORM_EDITS`; the form group in the header.
