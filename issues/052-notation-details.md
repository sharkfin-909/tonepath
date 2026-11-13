---
id: 52
title: "Notation details"
labels: [ready-for-agent]
status: closed
blocked_by: [46, 51]
assignee: claude
---

## What to build

Finish engraving per SPEC §7.1–7.2: beaming by beat via `Beam.generateBeams(notes, { groups })` (simple time: quarter-note groups; `6/8`, `9/8`, `12/8`: groups of 3 eighths), never across a slot line, broken by rests. Out-of-scale marks (pitch not in its owning slot's scale, e.g. after a chord edit): notehead, stem and flag red `#D62728` via `setStyle` plus a thin red ring overlay, accidentals black. Out-of-range: whole note incl. ledger lines grey `#B5B5B5`. Both: grey + red ring. Hover tooltip with the reason. Fixed headroom of 3 ledger lines above and below on every row (equal row heights). Chord labels ≥ 11px, scale labels ≥ 9px (ellipsised). Reference: `prototypes/vexflow-spike/`.

Spec: [SPEC.md](../SPEC.md) §7.1–7.2, §14.9. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Test table 9 (beaming groups for 4/4, 3/4, 2/2, 6/8, 12/8 with rests) passes
- [x] Changing a chord under existing notes marks clashing notes red with a ring; notes are never deleted
- [x] Out-of-range and combined marks render as specified; tooltips give the reason
- [x] All rows have equal height; labels never go below the minimums

## Blocked by

- [Enter notes from the hex](046-enter-notes-from-the-hex.md)
- [Instruments](051-instruments.md)

## Resolution

Built.

- **Beaming** (`src/notation/beaming.ts`): `groupTicks` (simple time = quarter beat; `6/8`, `9/8`, `12/8` and `3/8` = three eighths) and `slotBeamGroups`. The latter gives an explicit list of groups covering the slot, measured from the bar, so the second half of a split `3/4` bar starts with a partial group. `beamsFor` passes the slot's notes **and rests** to `Beam.generateBeams` so groups stay aligned to time; rests break beams; trailing ghost padding is left out. Test table 9 runs against real VexFlow beams in `src/notation/beaming.test.ts`.
- **Marks** (`src/marks.ts`, tested in `src/marks.test.ts`): `noteMark(writtenMidi, writtenHarmony, chord, inst)`.
  - Out of scale = not in the owning slot's scale (override respected), or not one of a no-fit chord's tones. Every note in an N.C. / empty / unparseable slot is out of scale.
  - Out of range = above / below the practical written range.
  - Reasons are joined with " · ", e.g. "not in D Mixolydian · above Double bass / bass guitar range".
- **Stave**:
  - Out of scale: notehead (`setKeyStyle`), stem and flag in `#D62728`, accidentals black, and a 1.5px red ring at the notehead.
  - Out of range: `setStyle` + `setLedgerLineStyle` + accidental modifiers in `#B5B5B5`; "both" adds the ring.
  - Tooltip: an SVG `<title>` on the note group, plus a `data-mark` attribute.
  - The caret tint only applies to unmarked notes.
- **Rows**: equal height comes from the fixed 3-ledger-line headroom (every stave 110px). Notation SVG now overflows visibly, so far-out-of-range notes overlap the labels instead of being clipped, as §7.1 allows. Label sizes are already above the minimums (chord 17px, scale 11px); **Chart zoom** must keep them at or above 11px / 9px.
- Checked in the browser: Dm7 → D7 turns the F red with a ring and keeps all 12 notes; the bass view greys the melody (above range), and the F shows grey + ring with both reasons.

Beams stay black even when their notes are grey (not specified; cosmetic).
