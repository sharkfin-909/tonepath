---
id: 6
title: "Note classification"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: [4,5]
assignee: claude
---

## Question

How is each lattice note classified as chord tone (green), scale tone (blue) or passing note (brown)? Where does *the scale* for a bar come from — derived automatically from the chord, picked by the user per bar, or a key for the whole tune? Is a passing note simply anything not in chord or scale? Are extensions/tensions chord tones or scale tones?

From [Chord grammar and coverage](005-chord-grammar-and-coverage.md): classification is by pitch class against root + interval list (no octave). Decide which tones extended chords imply (does `C13` contain 9 and 11? tonal's C11 omits the 3rd) and so which are green. `alt` is defined as `7#5#9`; its other altered tensions are expected to come through blue via the altered scale. `N.C.` notes are grey.

## Resolution

Grilled with the user, 2026-11-12.

1. **Scale source** — each slot's scale is **derived automatically from its chord**, with an optional **per-slot override** picked from that chord's candidate scales (chord tooltip/menu). No global key in v1.
2. **Chord tones (green)** — every tone named *or implied* by the symbol; extensions imply the stack below them, except where it clashes:
   - `9` → 1 3 5 ♭7 9 (`maj9`, `m9` likewise with 7 / ♭3 ♭7)
   - `11` → 1 5 ♭7 9 11 (**no 3rd**); `m11` → 1 ♭3 5 ♭7 9 11
   - `13`, `maj13` → 1 3 5 7/♭7 9 13 (**no 11**); `m13` → full stack 1 ♭3 5 ♭7 9 11 13
   - `6/9` → 1 3 5 6 9; `add9`/`add11` → triad + that tone only
   - alterations add their tone; an altered 5th replaces the natural 5th
   - a **slash bass** is a chord tone even if outside the chord and scale (`C/Bb` → `Bb` green)
3. **Scale tones (blue)** — tones of the slot's scale that aren't chord tones. **Passing notes (brown)** — everything else; no melodic judgement (no approach-tone / avoid-note categories). Precedence: chord > scale > passing. Empty, unparseable and `N.C.` slots → grey.
4. **Default scale rule** — the chord's **family** (from its 3rd / 5th / 7th) has a ranked scale list; the slot gets the **first scale containing every chord tone** (bass excluded). The same filtered list is the override menu.
   - Major (3, no ♭7; incl. triad, `6`, `6/9`, `maj7`, `add9`, `5`): Ionian → Lydian → Lydian augmented
   - Dominant (3 + ♭7): Mixolydian → Lydian dominant → whole-tone → Mixolydian ♭6 → half-whole diminished → Phrygian dominant → altered
   - Sus (no 3rd; `sus2`, `sus4`, `7sus4`, `11`): Mixolydian → Ionian → Dorian
   - Minor (♭3, ♮5): Dorian → Aeolian → Phrygian → melodic minor → harmonic minor
   - Half-diminished (♭3 ♭5 ♭7): Locrian → Locrian ♮2
   - Diminished (♭3 ♭5, 𝄫7 or none): whole-half diminished
   - Augmented (3 ♯5, no 7): whole-tone → Lydian augmented
   - Worked: `7b9`/`7#9` → half-whole; `7#11` → Lydian dominant; `7#5` → whole-tone; `7b13` → Mixolydian ♭6; `7b9b13` → Phrygian dominant; `7alt`/`7#9b13` → altered; `maj7#11` → Lydian; `m(maj7)` → melodic minor.
   - **Fallback:** no scale fits → no scale; chord tones green, everything else brown.
   The spec ships this worked list as a test table.
5. **Visibility** — scale name in the chord tooltip (`Dm7 → D F A C · D Dorian`); a small dot on the chord label marks an overridden slot.
6. **Override persistence** — stored as a scale *type* relative to the root. Kept on a root-only change (`Dm7`→`Em7`) and on any chord change whose candidate list still contains it; otherwise silently dropped to the default. Bar copy/paste/duplicate carries overrides.

Rejected: global key (duplicates defaults, breaks on modulation/secondary dominants); fully automatic with no override; per-symbol scale lookup table (replaced by the family + first-fit rule); `alt`-style "all tensions green"; melodic categories for brown.
