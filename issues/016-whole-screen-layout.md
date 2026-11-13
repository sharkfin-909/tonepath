---
id: 16
title: "Whole-screen layout"
labels: [wayfinder:prototype]
status: closed
parent: 1
blocked_by: []
assignee:
---

## Question

What does the whole screen look like with a real tune (e.g. 32 bars, several split bars)? Where do the title + instrument dropdown + mute sit; where does the piano strip panel live (docked bottom? beside?) and how does it behave at 3–4+ octaves; vertical scroll vs fit-to-width zoom (the chart is one SVG `viewBox` per [Rendering approach](010-rendering-approach.md)); how readable are half-bar slots with 3–4 octave columns; and a **tablet-on-a-stand** reading mode (strip hidden? larger notes?). Desktop/laptop first. Prototype with the round-6 code as a base.

## Assets

Prototype (throwaway; run `open prototypes/whole-screen-layout/index.html`):

- [prototypes/whole-screen-layout/index.html](../prototypes/whole-screen-layout/index.html) — round 1: 32-bar AABA tune (10 split bars) inside a simulated device frame; yellow prototype bar switches device, strip placement (A dock / B inline / C side), zoom, row height, note density, stand-mode options.

## Resolution

**Out of scope / superseded by the etude pivot.** The piano strip and note-set chart this ticket assumed are gone; Improwiser now uses a hex palette in slots and a standard-notation melody row. Round 1 explored strip placements (user leaned **A · docked bottom** before the pivot) but that answer does not carry forward. Replaced by **Whole-screen layout (etude)**.
