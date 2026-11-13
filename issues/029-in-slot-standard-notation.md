---
id: 29
title: "In-slot standard notation"
labels: [wayfinder:research]
status: closed
parent: 1
blocked_by: [26]
assignee: research-agent
---

## Question

How should v1 render **standard notation inside each chord slot** (chord + scale label, melody events for that bar’s time, rests, five durations), with the progression still one continuous melody? Survey hand-rolled SVG vs engraving libraries (licence, size, React fit, written-pitch transposition, out-of-scale / out-of-range marks, half-bar slots). Recommend an approach and what a follow-up prototype must prove. Findings in `research/`. Replaces [Standard notation row](021-standard-notation-row.md).

## Resolution

**Adopt VexFlow 5 (`vexflow/core` + Bravura) for each slot’s staff fragment; chord/scale labels stay React chrome; slice the continuous melody in app code; written pitch/spelling via tonal before engraving; marks via `StaveNote.setStyle`.** Reject OSMD (MusicXML full-score grain, pinned to VexFlow 1.x), abcjs (ABC round-trip), and Verovio (LGPL + multi-MB WASM). Hand-rolled SVG + SMuFL/Bravura is the escape hatch if the prototype fails. Follow-up prototype must prove half-bar slices, five durations + beams, written transposition, marks, ~32-bar redraw, and font bootstrap — details in the research note.

## Assets

- [research/in-slot-standard-notation.md](../research/in-slot-standard-notation.md)
