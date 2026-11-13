---
id: 51
title: "Instruments"
labels: [ready-for-agent]
status: closed
blocked_by: [46]
assignee: claude
---

## What to build

Instrument picker in the rail with the 14 instruments, transpositions, practical written ranges and clefs in SPEC §10 (stable ids). Chord labels, hex labels and notation show **written** pitch; storage and sound stay concert. Bass-clef instruments get a bass clef in every row gutter; Concert shows a Treble / Bass choice (saved as `concertClef`). The hex uses Fit range over the instrument's range; cells outside the range are grey and inactive (§8.2). Out-of-range notes are flagged (never blocked). The device remembers the last pick for new progressions. Switching is one undo step.

Spec: [SPEC.md](../SPEC.md) §10, §7.3, §8.1–8.3. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Test table 6 rows for trombone, violin and B♭ tenor sax pass
- [x] B♭ tenor sax shows chords and notes up a major 9th; sound unchanged
- [x] Trombone and bass draw bass clefs; Concert Treble / Bass choice persists
- [x] Grey out-of-range hex cells do nothing when clicked

## Blocked by

- [Enter notes from the hex](046-enter-notes-from-the-hex.md)

## Resolution

Built.

- Pure `src/instruments.ts`: the 14 rows of SPEC §10 (stable ids, tonal interval + semitones, practical written range in MIDI, fixed clef or Concert's choice). It also provides `instrumentOf` (unknown → Concert), `clefOf`, `hexRange` (Fit range over the written range; Concert = C3–C6), `toWritten` / `toConcert`, `outOfRange`, `writtenChord` (root and slash bass moved by interval, at most one accidental, quality kept as typed) and `concertChordText` (typed written input → stored concert).
- Display runs on the written chord. `Chart` builds each slot's harmony from `writtenChord`, so labels, tooltips, scale labels, spelling (lean, default set) and engraving are written; notes are drawn at concert + semitones. The hex gets the written harmony and range, and picks are converted back to concert for storage and sound. ▶ Chord / ▶ Scale use the concert harmony. The readout shows the written chord and scale.
- Rail: instrument select, plus a Treble / Bass select shown only for Concert (saved as `concertClef: "bass"`, removed for Treble). Switching is one undo step via `update` and writes `lastInstrument` to the device key. `openInitial` uses that for a new progression (`newProgression(instrument)`).
- Tests: `src/instruments.test.ts` (ids, clefs, written chords incl. the double-accidental edge, round trips for every instrument, range flagging) and the instrument rows of test table 6 in `src/hex.test.ts` (trombone, violin, B♭ tenor sax: steps, row lengths, anchor, top cell, written names, degrees equal across views, ii–V–I anchor stability, grey cells in a tiny range).
- Checked in the browser: tenor shows Em7 / A7 / A7alt for Dm7 / G7 / G7alt with notes up a M9; typing `Ebmaj7` in tenor view stores `Dbmaj7`; trombone draws bass clefs and a hex over E2–B♭4; Concert + Bass persists across reload.

Left for **Notation details**: grey styling of out-of-range notes. `outOfRange(concertMidi, inst)` is ready for it.
