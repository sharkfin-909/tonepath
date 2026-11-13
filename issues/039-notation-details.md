---
id: 39
title: "Notation details"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: [40]
assignee: claude
---

## Question

Settle three small engraving and repair rules left open in SPEC.md §15: (1) **beaming**: VexFlow auto-beam by beat within a slot, or another rule (and for 6/8 or 3/4?); (2) **mark styling**: exact look of out-of-scale (red + ring?) and out-of-range (faded / hollow?) notes on VexFlow staves ([In-slot standard notation](029-in-slot-standard-notation.md)); (3) **import repair** for melody events that cross a slot boundary in hand-edited files: drop, truncate to the slot, or split into rests ([Melody data and schema](023-melody-data-and-schema.md)).

## Resolution

Grilled with the user on 2026-11-13, after [VexFlow notation spike](040-vexflow-notation-spike.md).

1. **Beaming by beat**, never across a slot line (each slot is its own stave); rests break beams. Simple time (`x/4`, `x/2`): one group per quarter-note beat (2 eighths / 4 sixteenths). Compound time (`6/8`, `9/8`, `12/8`): groups of 3 eighths (dotted-quarter beat), via `Beam.generateBeams(notes, { groups })`. Rejected: 4/4 beaming of four eighths across beats 1–2.
2. **Marks:**
   - **Out of scale**: notehead, stem and flag in red `#D62728` (`setStyle`), plus a thin red ring around the notehead so the mark doesn't rely on colour alone; accidentals stay black.
   - **Out of range**: the whole note, ledger lines included, in light grey `#B5B5B5`.
   - **Both**: grey with the red ring.
   - **Hover tooltip** on a marked note gives the reason ("not in G altered" / "above B♭ trumpet range").
3. **Import repair, event crossing a slot line:** shorten it to the longest duration that fits before the slot ends; the cut-off time becomes rests in the following slot (largest lengths that start on their own beat), so later events keep their timing. Counted in the import toast ("N notes shortened"). Rejected: dropping the event (shifts later music); keeping it (breaks the no-crossing invariant).
