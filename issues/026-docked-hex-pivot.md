---
id: 26
title: "Docked hex pivot"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: []
assignee: cursor
---

## Question

Per-slot hex palettes and a separate notation strip under the form are being reconsidered. What is the new v1 shape for where the hex lives, where the melody is shown, and how the grid is laid out across the instrument range?

## Resolution

Builds on [Etude pivot](018-etude-pivot.md); changes the pick surface and where notation lives.

1. **Docked hex** — one diatonic hex input grid in the **bottom half** of the screen. Replaces per-slot hex palettes. The **active slot** (slot under the caret) remoulds pitches/spellings and drives colouring.
2. **Slots = notation bars** — each slot is an (initially empty) standard-notation bar showing **chord + scale** and the melody events that fall in that bar’s time. No separate notation row under the form. Continuity is still one progression-wide melody sequence.
3. **Geometry** — ascends **diatonically to the right** (adjacent right = next scale degree). **Up-left = diatonic third**; the next row up is the same series offset by that third (skip one degree). Accidentals appear in note names as the scale remoulds.
4. **Range** — show **as much of the instrument’s practical written range as will fit**; cells outside that range are **grey (inactive)**. No octave-shift control.
5. **Colour** — in-range: **white fill = chord tone**, **black = in-scale non-chord**; **degree borders 1–7**, stroke **two nudges thicker** than a hairline. Out-of-scale pitches still not on the grid.
6. **Entry unchanged** — length latch (whole · half · quarter · eighth · sixteenth) + Rest latch; hex click auditions and inserts at caret; caret’s slot is active.
7. **Supersedes** — [Hex palette layout](019-hex-palette-layout.md) (per-slot 14-cell palette); in-slot hex / under-chart staff assumptions in [Melody entry and caret](020-melody-entry-and-caret.md), [Standard notation row](021-standard-notation-row.md), [Whole-screen layout (etude)](022-whole-screen-layout-etude.md), [Colour accessibility (etude)](024-colour-accessibility-etude.md).
