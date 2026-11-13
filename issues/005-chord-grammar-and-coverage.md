---
id: 5
title: "Chord grammar and coverage"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: [4]
assignee: claude
---

## Question

Which chord symbols must v1 accept (triads, 7ths, m7b5, dim7, sus, 6/9, extensions and alterations, alt, slash chords)? What spelling variants (`-7` vs `m7`, `Δ` vs `maj7`)? What happens on an unparseable symbol? Which octave does a chord's MIDI-note array sit in, and does it matter given lattice notes are real pitches?

From [Bar grid and progression](003-bar-grid-and-progression.md): an unparseable symbol stays as typed, shown red, notes grey; empty slots are allowed (notes grey). Decide whether `N.C.` (no chord) is a recognised symbol and how its notes are treated. Typing two space-separated symbols into one slot splits the bar, so the grammar must not allow spaces inside a symbol (or must define how they're handled).

## Resolution

Grilled with the user, 2026-11-12.

1. **Coverage** — roots A–G with `#`/`b`/`♯`/`♭`. Triads: major, `m`, `dim`, `aug`/`+`, `sus2`, `sus4`, `5`. Sixths: `6`, `m6`, `6/9`, `m6/9`. Sevenths: `7`, `maj7`, `m7`, `m7b5`, `dim7`, `m(maj7)`, `7sus4`, `aug7`/`7#5`, `maj7#5`. Extensions `9`/`11`/`13` (plain, `maj`, `m`), `add9`, `add11`. Alterations `b5 #5 b9 #9 #11 b13` in any combination on 7th chords, bare or parenthesised (`7b9#11`, `7(b9,#11)`). `alt`. Slash chords `X/bass` with any bass, chord tone or not. **Excluded:** polychords, `omit`, anything past 13.
2. **Synonyms (all equivalent)** — minor `m - min mi`; maj7 `maj7 M7 ma7 Δ Δ7 △ △7`; half-dim `m7b5 -7b5 ø ø7 m7(b5)`; dim `dim ° o` (+7); aug `aug +` (`+7 7+ 7#5`); minor-major `m(maj7) mMaj7 -Δ7 mΔ`; Unicode accidentals everywhere. `M` vs `m` is case-sensitive; everything else case-insensitive; root letter must be uppercase (`c7` invalid).
3. **Display** — the symbol is shown and stored **exactly as typed**; the parse is recomputed on load. A tooltip on the chord label shows the interpretation (`CΔ → C E G B (major 7th)`).
4. **`alt`** = `7#5#9` (`C E G# Bb D#`); `7alt`, `alt7` are synonyms. Remaining altered tensions are expected to colour as scale tones via the altered scale (decided in [Note classification](006-note-classification.md)).
5. **`N.C.`** — `N.C.`, `NC`, `n.c.` are a valid symbol: normal (not red) text, notes grey like an empty slot; semantically "intentional silence", distinct from an unfinished empty slot.
6. **Spaces** — split only on whitespace outside parentheses; collapse extra whitespace. One symbol → edits the current slot only. Two symbols → splits a one-slot bar, or overwrites both slots of a split bar from the first. Three or more → not committed; field stays open with an inline "a bar holds at most two chords" message. No spaces inside a symbol (`C maj7` = `C` + red `maj7`).
7. **Octaves** — classification is by **pitch class**, so the parsed chord carries no octave: stored/derived as root + interval list + optional bass (spelling from intervals, Cdim7 → `C Eb Gb Bbb`). A **reference voicing** exists for display only: root position, closed, root in octave 4, slash bass in octave 3 below (`Bb3 / C4 E4 G4`). Palettes may derive other ranges from the intervals.
8. **Parser** — **our own normaliser** (root / quality / extensions / alterations / bass → intervals) feeding tonal for spelling and MIDI; not a chord-symbol wrapper. Bare digits other than 5/6/7/9/11/13 rejected (`C4` invalid). The spec ships a test table covering every row of points 1–2.
9. **Contradictions** — same degree raised and natural (`C9#9`, `C7b5(5)`) or conflicting 3rds → invalid (red). `b9`+`#9` valid; `#5`+`b13` valid (same pitch, kept once). Exact duplicates collapse (`C7b9b9` → `C7b9`).

Deferred to [Note classification](006-note-classification.md): which tones an extended chord implies (does `C13` contain the 9 and 11?) and so which count as chord tones.

Rejected: auto-normalising display to a house style (overrides user notation, irreversible on misparse); `alt` as all alterations (washes out green vs blue); `N.C.` notes brown (noise); wrapping chord-symbol (disagrees on `alt`, pitch-class spelling, 21 KB, unmaintained since 2023).
