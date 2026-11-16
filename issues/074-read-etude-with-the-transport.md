---
id: 74
title: "Read etude with the transport"
labels: [ready-for-agent]
status: closed
blocked_by: [72]
assignee:
---

## Parent

[Mode menu](068-mode-menu.md) (SPEC §3)

## What to build

Read etude: the normal two-row header (full sound pill; the transport bar centred in row 2), the etude fitted to the
page with no hex and no mic, and a **playhead** (the current slot highlighted) moved by the transport with *Audio on
chord* as the accompaniment. Stopped: clicking a slot moves the playhead silently, clicking a note auditions it and
moves the playhead to its slot, ▶ Chord / Bass / Scale preview the current slot, bar numbers pick the looped bars;
nothing edits. Running: chart clicks do nothing.

## Acceptance criteria

- [x] Two-row header with the transport; every bar on one page
- [x] The playhead follows the transport; *Audio on chord* sounds at each chord
- [x] Stopped clicks move the playhead / audition; running clicks do nothing
- [x] No chord, scale or bar editing in Read etude

## Blocked by

- [072](072-improvise-runs-on-the-transport.md)

## Resolution

Built: `main.read` layout; session rules for `read`; Chart `mode="read"` (zoom floor 0).
