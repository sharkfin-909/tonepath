---
id: 81
title: "The etude picker"
labels: [ready-for-agent]
status: open
blocked_by: [80]
assignee:
---

## Parent

[Etudes belong to a progression](077-etudes-belong-to-a-progression.md) (SPEC §3.1)

## What to build

An **etude picker** in the control header, in **every mode** (the open etude also sets the instrument):

- Row 2, left, after the title: a pill in the shared group look (`--group-*`, lowercase but names) showing the open
  etude's name; it opens the app's own dropdown card (`rail/Dropdown.tsx` behaviour: ↑ / ↓ / Enter / Esc, click
  outside closes, keys never reach the chart, focus back to the hex after a choice).
- The card lists the etudes (current marked with the accent bar and ✓; each with its instrument in muted text), then
  actions: **New etude**, **Duplicate**, **Rename** (inline field, as the title), **Delete** (no confirm — undoable;
  on the last etude it reads *Clear etude*, since a fresh one replaces it).
- Each action dispatches the session's etude intent ([080](080-session-open-etude.md)); the group flashes like the
  others.
- Narrow screens (§3.6): the pill shortens the name with an ellipsis; the card is unchanged.

## Acceptance criteria

- [ ] The picker shows in Tune, Improvise, Write etude and Read etude
- [ ] Choosing an etude switches the chart's notes (Write / Read etude), the transposition and `Ins:`
- [ ] New / Duplicate / Rename / Delete work and undo; Delete on the last etude reads *Clear etude*
- [ ] Keyboard: the card is fully usable without a pointer; Space and the other keys never act on it afterwards

## Blocked by

- [080](080-session-open-etude.md)
