---
id: 32
title: "Clef policy"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

Which clef do the in-slot staves use? Covers: one clef per instrument (treble for most, bass for trombone and double bass/bass guitar, and what about guitar's octave-treble or a cello-range instrument?) or a clef chosen from the melody's actual range; whether a clef can change mid-progression; and where clefs are drawn. Under [Whole-screen layout (docked hex)](030-whole-screen-layout-docked-hex.md) the chart auto-zooms and reflows by bars per row, so a clef at the start of each row is the expected default. VexFlow slicing per [In-slot standard notation](029-in-slot-standard-notation.md); written range per [Instrument practical ranges](013-instrument-practical-ranges.md).

## Resolution

Grilled with the user on 2026-11-13 (claim taken over from a stale `cursor` claim at the user's request). Glossary updated in [CONTEXT.md](../CONTEXT.md).

1. **Clef is fixed per instrument**, as a `clef` column in the instrument data: **bass** for Trombone and Double bass / bass guitar; **treble** for Flute, Violin, Vibraphone, B♭ trumpet, B♭ clarinet, B♭ soprano / tenor sax, E♭ alto / baritone sax, F horn and Guitar (its octave is already in the written pitch, so plain treble, not an octave-treble clef). The clef **never changes inside a progression**: notes past the staff get ledger lines, and out-of-range notes are flagged as in [Instrument view](011-instrument-view.md). Rejected: a clef chosen from the melody's range (it would flip as notes are added).
2. **Concert** gets a **Treble / Bass** choice (default Treble), shown next to the instrument picker only when Concert is selected, and **saved with the progression** (and in export). Schema note for the spec: an optional progression field, e.g. `concertClef: "bass"`, absent = treble; ignored for other instruments. It is added within the current schema version, since older files simply lack it. Rejected: treble-only Concert.
3. **Drawn at the start of every row** (rows reflow with bars per row and zoom). **No key signature** (no global key; accidentals go on the notes). The **time signature** appears once, in the first slot of the progression.
4. **Clef gutter:** a narrow column at the left of each row, **outside the slots**, holds the clef, so every slot keeps an equal, time-proportional width and click-to-place-the-caret maps to the same beat everywhere.
5. Same in **Stand mode** and **Play mode**. Switching instrument (or the Concert clef) redraws the chart in the new clef.
