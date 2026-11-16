---
id: 70
title: "Tuner mode"
labels: [ready-for-agent]
status: closed
blocked_by: [69]
assignee:
---

## Parent

[Mode menu](068-mode-menu.md) (SPEC §3)

## What to build

Tuner shows the usual layout with the **chart pane empty** at the chart's height (nothing moves on a switch), the
tuner bar where it sits in Improvise, and the **unchecked hex** (no active slot) lighting every note played, chromatic
notes too. The sound pill stays; ▶ Chord / Bass / Scale and *Audio on chord* are greyed, and C / B / S do nothing.

## Acceptance criteria

- [x] Empty chart pane at the same height as Improvise's chart; no scrollbar
- [x] The hex is the unchecked hex and lights what the mic hears and what is clicked
- [x] Chord controls greyed; C / B / S / ⇧Space do nothing; mute works
- [x] Heard notes are named with the default sharps / flats set (no slot to spell for)

## Blocked by

- [069](069-mode-menu-one-mode-value-mode-driven-mic.md)

## Resolution

Built: `view.tunerDock` / `view.plainName`, `AudioControls noChord`, the `tuner-mode` layout.
