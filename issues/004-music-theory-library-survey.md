---
id: 4
title: "Music-theory library survey"
labels: [wayfinder:research]
status: closed
parent: 1
blocked_by: []
assignee: research-agent
---

## Question

Can an existing JS/TS library (e.g. tonal.js, teoria, others) supply what we need — chord-symbol parsing across common jazz/pop qualities, chord → MIDI notes, chord → scale(s) mapping, and context-aware enharmonic spelling with octave numbers? What are its coverage gaps, licence, bundle size and maintenance status? Recommend adopt vs. build.

## Resolution

**Adopt tonal (`@tonaljs/note`, `/chord`, `/scale`, `/interval`) as the theory core. Build a thin chord-symbol front end, a curated chord → scale table and a chromatic-spelling policy.** Full findings: [research/music-theory-library-survey.md](../research/music-theory-library-survey.md).

Key facts for downstream decisions:

- **tonal**: MIT, TypeScript, actively maintained (6.5.1, released 2026-10-14), about 6.5 KB gzipped for the functions we need (10.6 KB for Chord+Note+Scale+Midi). It spells by root + interval, so Cdim7 = `C Eb Gb Bbb` and Bb7#9 → `C#5`. Octaves and MIDI are correct (`Chord.notes("m7b5","F#3")` → `F#3 A3 C4 E4`, `Note.midi("Cb4")` = 59).
- **Chord grammar**: tonal only matches quality strings exactly against about 107 fixed types. These all fail: `CΔ7`, `Cø7`, `Calt`, `Cm7(b5)`, `C7(b9)`, `Cm(maj7)`, `Cm6/9`, `Cmaj7b5`, `B♭`/`F♯` Unicode accidentals, `C△`. It can be extended with `ChordType.add`. `chord-symbol` (MIT, 21 KB gzipped, last release 2023-02) parses all of them compositionally but spells by pitch class (Cmaj7#11 → `Gb`) and has no octaves. Its degree output converts cleanly into tonal intervals, which gives correct spelling (verified). Pick our own normaliser vs. a chord-symbol wrapper in the grammar ticket. Also: `C4` parses as a quartal chord (tonal) or sus4 (chord-symbol), so reject bare-digit qualities other than 5/6/7/9/11/13. `alt` means `7#5#9` in tonal but all alterations in chord-symbol, so we need to define it ourselves.
- **Slash chords**: tonal returns `tonic` and `bass` separately, and accepts a bass that is not a chord tone (`C/Bb` → notes `Bb C E G`, bass as a pitch class only).
- **Note classification**: `Chord.chordScales` returns every superset scale, unranked (Cm7b5 → "minor blues" first). We need our own quality → default-scale table (m7b5 → locrian / locrian #2, 7alt → `altered`, dim7 → `diminished` (whole-half), 7b9 → `half-whole diminished`, …). tonal's chord types sometimes omit tones (C11 has no 3rd, C7b13 no 5th), so define what counts as a "chord tone". `Scale.rangeOf(pcs)(lo, hi)` fills a pitch range with octave-numbered notes.
- **Enharmonic spelling**: chord and scale tones come out correctly spelled from tonal. No library spells *chromatic/passing* notes from context: `Note.fromMidi` always uses flats and `fromMidiSharps` always sharps. We build that rule, plus a double-accidental policy (`Note.simplify`: `Cbb4` → `Bb3`, `B#3` → `C4`).
- **Rejected**: teoria (last release 2017, no types, throws on `C69`/`C7alt`/`CΔ`), sharp11 (last push 2017), music21j (about 11 MB unpacked, vexflow dependency, no chord-symbol parser).
