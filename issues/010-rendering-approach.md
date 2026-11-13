---
id: 10
title: "Rendering approach"
labels: [wayfinder:prototype]
status: closed
parent: 1
blocked_by: [2,8,9]
assignee: claude
---

## Question

Which rendering approach does v1 use for the grid, note sets and piano strip? Since [Lattice editing interaction](008-lattice-editing-interaction.md) dropped links, dragging and free positions, a graph library ([Graph-editing library survey](009-graph-editing-library-survey.md)) likely no longer earns its place — confirm hand-rolled SVG (or plain DOM/CSS) for the slots and strip, and how layout (octave columns, centring, zigzag) is computed as a pure function of the note sets. The round-6 prototype is plain SVG + DOM and is a fair spike.

## Resolution

Grilled with the user, 2026-11-12. The round-6 prototype of [Lattice editing interaction](008-lattice-editing-interaction.md) ([prototypes/lattice-editing/index.html](../prototypes/lattice-editing/index.html), plain SVG + DOM, no libraries) served as the spike.

1. **SVG for the chart, HTML for controls.** React components emit SVG for the grid, bar lines, slots, chord labels and note circles — no graph library, no canvas. One `viewBox` scales the whole chart (sharp text on a tablet; fit-to-width is one factor). Notes are real elements, so click-to-audition, focus and screen-reader labels come free. HTML for the piano strip, the chord-label input overlaid on the slot while typing, the typed-note box and the instrument dropdown.
2. **One pure layout function for the whole chart** — `layoutChart(progression, view) → layout`, in its own module with no React or DOM; components only draw its output. Whole-chart because the octave-column set is shared by every slot.
   - **Inputs:** bars, slots, note sets, bars-per-row, and the **view**: instrument transposition (it moves notes between octave columns — concert C4 is written D4 for B♭) and the instrument's **range** (so whatever [Instrument view](011-instrument-view.md) decides for range limits — dimming, hidden columns, narrowed strip — is drawable without changing layout code).
   - **Output:** slot rectangles, octave columns, and an x/y per note, in fixed chart units (prototype: 300-unit bars, 200-unit rows), scaled by the `viewBox`.
   - Uses the spelling module for each note's written octave (column = spelled name's octave).
   - Recomputed in full on every change; no caching.
   - **The spec ships a layout test table:** single note centred; five notes in one octave; crowded column squeezing and zigzagging; half-bar slot; `B#3` in column 3; tenor-sax view shifting columns.

Rejected: React Flow / graph libraries (built for drag-and-connect, which is gone); canvas (loses per-note elements and accessibility); HTML/CSS boxes for the chart (octave columns and zigzag need computed positions anyway; whole-chart zoom is clumsier); per-slot layout (the column set is chart-wide).

Scope change during this ticket: **instrument range limits move into v1** (were out of scope); their behaviour is a question on [Instrument view](011-instrument-view.md).
