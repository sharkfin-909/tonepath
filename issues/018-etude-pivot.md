---
id: 18
title: "Etude pivot"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: []
assignee: cursor
---

## Question

The product aim is shifting away from per-slot note sets and a piano strip. What is the new v1 shape: how is the etude represented, how are pitches picked, what is in or out of scope for entry and sound, and which prior decisions does this supersede?

## Resolution

Improwiser v1 is for **writing readable practice etudes** over a chord form — not building per-slot note sets.

1. **Melody** — one continuous, bar-aligned sequence under the chart (pitched notes and rests with durations). Not a note set. Shown in a **standard notation** row (now in v1 scope).
2. **Slot** — a **hex pick palette** only (degree-stable, diatonic). Above-left neighbour = diatonic third; layout remoulds by degree when the slot scale changes. **White fill = chord tone**, **black fill = in-scale non-chord**; **borders = scale degrees 1–7**. Two octaves of degrees (14 cells), centred on the instrument’s written mid-range, with octave shift. No out-of-scale pitches on the grid.
3. **Entry** — latched length **whole · half · quarter · eighth · sixteenth** plus **Rest** latch (Rest on → insert rest of that length; picking a pitch turns Rest off and inserts the note). **Caret’s slot** owns the active scale. Hex is the only pitch entry in v1 (no chromatics, no piano strip, no typed chromatic entry).
4. **Sound** — hex pick auditions; chord/scale peek kept; **no full-line playback** (post-v1).
5. **Chord edit** — existing melody notes are **kept**; pitches that no longer fit the new slot scale get an **out-of-scale mark** (never auto-deleted).
6. **Supersedes** — note-set / octave-column / piano-strip interaction ([Lattice editing interaction](008-lattice-editing-interaction.md)); strip-era [Whole-screen layout](016-whole-screen-layout.md); old role colours in [Colour accessibility](017-colour-accessibility.md) and the green/blue/brown presentation in [Note classification](006-note-classification.md); note-set preview / piano key sound details in [Audition and chord preview](012-audition-and-chord-preview.md); per-slot note-set shape in [Saved data and JSON schema](015-saved-data-and-json-schema.md). Remaining hex axes (default working assumption for prototypes: diatonic step + diatonic fifth on the other neighbours), engraving approach, caret editing details, and JSON event shape are left to follow-up tickets.
