---
id: 57
title: "Stand mode"
labels: [ready-for-agent]
status: closed
blocked_by: [53, 56]
assignee: claude
---

## What to build

Stand mode per SPEC §3.4: Stand button in the rail or `\`. Hides the rail and hex; thin header with title, instrument, mute, ✎ Edit. Read-only chart (no caret, no chord editing, no bar handles). Fit page: every bar on one screen, auto-zoomed with no floor (32 bars at 4 per row fit on 1024×768), label minimums still applied. `\` or ✎ Edit returns to the mode it came from.

Spec: [SPEC.md](../SPEC.md) §3.4. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] 32 bars at 4 per row fit a 1024×768 viewport without scrolling
- [x] Nothing is editable in Stand; `\` returns to Write or Play as entered
- [x] Labels respect 11px / 9px minimums

## Blocked by

- [Chart zoom](053-chart-zoom.md)
- [Play mode](056-play-mode.md)

## Resolution

Built.

- `App`: a `stand` flag sits over Write or Play (the play slot, caret, undo history and so on are kept), so `\` / ✎ Edit return to whichever mode it was entered from. Enter via the ▭ Stand button in the rail or `\`. The Stand layout is a thin header (title, instrument name, mute, ✎ Edit) plus a full-height chart area; the rail and hex are not rendered. Keys in Stand: `\` and M only.
- `Chart` `stand` prop: `fitZoom(..., min = 0)` (fit page, no floor); no active highlight, caret, bar handles or "+"; chord labels and scale labels disabled; slot, stave and note clicks inert.
- Checked in the browser, with a 32-bar test form at 4 per row and the layout pinned to 1024×768: zoom 0.478 (4.8px staff gap), chart 696px in a 728px area with no scroll, chord / scale labels rendered at exactly 11px / 9px, nothing editable or clickable. `\` returned to Play on the same slot; Stand → ✎ Edit returned to Write with the caret in place.
