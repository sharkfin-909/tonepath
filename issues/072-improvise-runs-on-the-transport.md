---
id: 72
title: "Improvise runs on the transport"
labels: [ready-for-agent]
status: closed
blocked_by: [69]
assignee:
---

## Parent

[Mode menu](068-mode-menu.md) (SPEC §3)

## What to build

Improvise is driven by the transport only. The practice panel, its five advance rules, the note count and the
metronome switch are gone; the **transport bar** (tempo, click sound, rewind, start / stop, Loop, the looped-bars chip)
takes their place. Stopped: ← / → / < > and clicks move the current slot; the hex shows its scale and lights what is
played; the slot's *Audio on chord* waits for the first note played (hex or mic, echo-guarded). Running: chords sound
as they begin; the hex shows the upcoming chord's tones with target rings and no slot-change motion; played notes
sound but don't light it. Loop is a device setting shared with Read etude.

## Acceptance criteria

- [x] Transport bar in Improvise; no rule dropdown or metronome switch
- [x] Running: target rings on the upcoming chord's tones; heard notes not lit
- [x] Stopped: slots move by hand; heard and clicked notes lit; the arrival sound waits for the first note
- [x] Looped bars: start outside them starts on their first; rewind and the end go to their first
- [x] `practice` / `practiceRun` removed; `transport.ts` and an echo-guard-only `micIntake.ts` with tests

## Blocked by

- [069](069-mode-menu-one-mode-value-mode-driven-mic.md)

## Resolution

Built: `transport.ts`, `micIntake.ts`, `rail/TransportBar.tsx`, `TRANSPORT_LOOP`; the old rule settings are left in storage unread.
