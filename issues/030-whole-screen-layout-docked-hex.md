---
id: 30
title: "Whole-screen layout (docked hex)"
labels: [wayfinder:prototype]
status: closed
parent: 1
blocked_by: [27, 28, 29]
assignee: claude
---

## Question

What does the whole screen look like with a real tune (e.g. 32 bars, split bars): top chart of **in-slot notation** + chord/scale, **bottom-docked hex** (~half the screen), title · instrument · mute · length/Rest latches, scroll/zoom, tablet stand/read mode (hex hidden?). Desktop/laptop first ([Docked hex pivot](026-docked-hex-pivot.md)). Prototype after docked hex, entry, and in-slot notation approach are known.

## Assets

Prototype (throwaway; `open prototypes/whole-screen-docked/index.html`, or serve `prototypes/` and use `?variant=A|B|C&frame=1280x800`):

- [prototypes/whole-screen-docked/index.html](../prototypes/whole-screen-docked/index.html) — round 1: a 32-bar AABA tune with split bars, the first 20 bars filled with a demo etude, overwrite entry working, Fit-range docked hex. Layouts: **A Scroll stack** (header at the top, chart scrolls at a zoom set by −/+, entry toolbar between the chart and the dock); **B Focus rows** (the caret's row ± 1 shown large, plus a minimap of the whole form; latches in columns on the dock's edges); **C Fit all + rail** (every row auto-zoomed into the top half, all controls in a left rail). **Stand** mode (`\`): hex and edit chrome hidden, either *Fit page* or *Large + page turns*. Floating bar: device frame (laptop / tablet sizes), dock 40/50/60 %, ⓘ measured sizes (staff gap px, hex cell px, bars visible). Bars-per-row selector in every layout.

## Resolution

Prototyped and reviewed with the user on 2026-11-13. Builds on [Docked hex pivot](026-docked-hex-pivot.md), [Docked hex grid](027-docked-hex-grid.md), [Melody entry and caret (docked)](028-melody-entry-and-caret-docked.md) and [In-slot standard notation](029-in-slot-standard-notation.md). Glossary updated in [CONTEXT.md](../CONTEXT.md).

1. **Layout C: Fit all + rail.** A **control rail** on the left runs the full height of the screen. Top to bottom: ← Library, title, instrument, bars per row, mute and Stand, then the length latch (stacked `1 · whole` … `5 · 16th`), Rest, undo/redo, Clear all, ▶ Chord / ▶ Scale, and a readout of the caret's bar, chord and scale. To the right of the rail, the **chart** sits above the **docked hex**. There is no header bar and no toolbar strip between the chart and the hex. Rejected: A (Scroll stack: header plus a toolbar strip; only 2–3 rows visible) and B (Focus rows: caret row ± 1 plus a minimap; latches on the dock's edges).
2. **Chart auto-zoom, with a floor.** The chart zooms so every row of the form fits its area, up to about 1.4× on short forms. It never shrinks below a **minimum readable size** (staff line gap ≈ 5px). When the form can't fit at that size, the chart stops shrinking and **scrolls vertically**, keeping the caret's row in view (A's behaviour). There is no manual zoom control. Rejected: always fitting with no floor (32 bars on a 1280×800 laptop came out at a ≈3px gap, unreadable) and fit plus manual −/+.
3. **Bars per row** stays the per-progression setting from [Bar grid and progression](003-bar-grid-and-progression.md) (default 4) and lives in the rail. Fewer bars per row means bigger staves and more scrolling; more means a smaller, wider view.
4. **Split: 50 / 50, fixed.** The hex always takes the bottom half, as in the pivot. No draggable divider, and no per-device setting. Rejected: 40% and a draggable divider.
5. **Stand mode** (Stand button in the rail, or `\`) hides the rail and the hex and shows a thin header (title, instrument, mute, ✎ Edit). The chart is read-only: no caret, no chord editing. It **fits the page**: every bar on one screen, auto-zoomed, nothing to turn (32 bars at 4 per row fit small but readable on a 1024×768 tablet). Clicking ✎ Edit or pressing `\` again returns to editing. Rejected: large notation with page turns, and a toggle between the two.
6. **Unchanged:** desktop/laptop first; editing, keyboard and audition as in the earlier tickets; out-of-scale and out-of-range marks as before.

Not decided here: which clef the staves use per instrument → [Clef policy](032-clef-policy.md).
