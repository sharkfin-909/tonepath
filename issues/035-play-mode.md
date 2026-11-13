---
id: 35
title: "Play mode"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

User idea, 2026-11-13: a **Play mode** where clicking the hex **plays notes without recording them**, and **← / →** step **slot by slot** through the progression (instead of event by event as in editing). What exactly is it?

- **Purpose and name:** practising or improvising over each chord on the hex, with the active slot remoulding the grid as you step. Is "Play mode" the term (CONTEXT.md)? How does it relate to Stand mode (read-only, hex hidden)? Is it a third mode, or Stand-with-hex?
- **Switching:** a toggle in the control rail ([Whole-screen layout (docked hex)](030-whole-screen-layout-docked-hex.md)) plus a non-letter shortcut? How does the screen show that nothing is being recorded?
- **Stepping:** ←/→ move to the previous/next **slot**. Does it wrap from the last slot to the first (the form loops)? Clicking a slot selects it? What marks the current slot: the edit caret, or a separate slot highlight? Does the edit caret stay where it was when you go back to editing?
- **On arriving at a slot:** silent, or play ▶ Chord automatically? Does the hex keep its pitch anchor (only fills and borders change) as in editing?
- **Other controls in Play mode:** length latch, Rest, ↑/↓ nudge, ⌫/Del, undo are meaningless. Hide them or disable them? Do Space / ⇧Space peeks and mute still work?
- **Out of v1 (unless the user says otherwise):** a timed / BPM auto-advance through slots ("full-line playback" is post-v1 in Notes).

## Resolution

Grilled with the user on 2026-11-13. Glossary updated in [CONTEXT.md](../CONTEXT.md). Builds on [Whole-screen layout (docked hex)](030-whole-screen-layout-docked-hex.md), [Melody entry and caret (docked)](028-melody-entry-and-caret-docked.md) and [Audition (etude)](025-audition-etude.md).

1. **A third mode**, separate from Stand mode. The layout is the same as editing (control rail; chart above the docked hex, 50/50). Hex clicks **audition only and are never recorded**. Rejected: Stand mode with the hex showing (it would break fit-page).
2. **Switching:** a **Write | Play** switch at the top of the control rail, plus `P` (ignored while a title or chord-symbol field has focus). In Play: the caret is hidden; the current slot gets a solid full-width highlight in a different colour from the editing pale blue; the length latch, Rest, undo/redo and Clear all are **hidden** (not greyed out); ▶ Chord, ▶ Scale and mute stay. Stand mode is reached from its own button and returns to whichever mode you came from.
3. **Stepping:** ← / → move to the previous / next **slot** (a split bar = two stops) and **wrap** at both ends, since the form loops. Clicking a slot selects it. ↑ / ↓ do nothing. The chart scrolls to keep the current slot in view (same rule as the caret's row).
4. **On arrival:** an **"On arrival"** dropdown in the Play rail: **Silent** (default) · **Chord** · **Root note**. Space always plays ▶ Chord and ⇧Space ▶ Scale, whatever the dropdown says. On arrival the hex remoulds as in editing (pitch anchor kept; fills, borders and changed scale tones move). Rejected: an always-on chord; a plain on/off toggle.
5. **Caret:** entering Play starts on the caret's slot. Leaving Play puts the caret at the **start of the slot being played**.
6. **Remembered:** "On arrival" is a **device setting** (per browser, never exported). The mode isn't remembered: opening a progression or reloading always starts in **Write**.
7. **Clicking a written note** in the chart plays it and selects its slot. Nothing is edited.
8. **Root note** = the chord's bass (the slash bass if the chord has one, e.g. `C7/E` → E) in concert octave 3, the same register as ▶ Chord's root; plain sine; mute applies. **N.C.** slots are silent.
9. **Not in v1:** timed / BPM auto-advance through slots (line playback stays post-v1).
