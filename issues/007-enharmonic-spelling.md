---
id: 7
title: "Enharmonic spelling"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: [4,6]
assignee: claude
---

## Question

How is a note's name spelled — C#4 vs Db4? Does it follow the bar's chord/scale, a global key, or the user's choice? What about passing notes outside the scale? Can a user override a spelling?

From [Note classification](006-note-classification.md): every parsed slot has a chord (root + intervals) and usually a scale (type + root, possibly an override), or no scale on fallback. Chord and scale tones can take their spelling from those; passing notes, notes in grey slots (empty / unparseable / `N.C.`) and no-scale fallback slots need a rule. Also decide whether a note's stored identity is a spelled pitch (`C#4`) or a MIDI number with spelling derived, since recolouring on chord change must keep pitches.

## Resolution

Grilled with the user, 2026-11-12.

1. **Identity** — a note stores only its **MIDI pitch**. Its name is always derived from its slot, so re-harmonising renames notes but never moves them. Typed entry in any spelling (`Db4`, `C#4`) converts to MIDI.
2. **Chord and scale tones** — spelled by root + interval (tonal), with **at most one accidental**: double accidentals become the simpler enharmonic (`Bbb`→`A`, `F##`→`G`); single-accidental names like `Cb`, `Fb`, `E#`, `B#` are kept. The octave number follows the letter (scientific pitch notation): `Cb4` = MIDI 59, `B#3` = MIDI 60. Precedence chord > scale also applies to naming: C7#9's ♯9 is `D#` even though C half-whole spells it `Eb`.
3. **Passing notes** — follow the **slot scale's lean**: count the accidentals in the scale's names (after rule 2). More flats → flats, more sharps → sharps, a tie or none → the **default set** `C# Eb F# Ab Bb`. In no-scale fallback slots, the same count runs on the chord tones.
4. **Grey slots** (empty, unparseable, `N.C.`) — always the default set. No borrowing from neighbouring slots, so each slot names its notes on its own.
5. **No user override in v1.** A per-slot "prefer sharps / prefer flats" switch (passing and grey-slot notes only) goes on the post-v1 list.
6. **Typed spelling decides the names** — no root normalising: `A#7` → `A# D E# G#` (`C##`→`D` by rule 2); the slash bass is named exactly as typed (`C/A#` → `A#`).
7. The spec ships a **test table** of worked names: Cdim7 (`C Eb Gb A`), Gb7 (`Gb Bb Db Fb`), Gb Locrian (`Gb G A Cb C D Fb`), A7 / Bbm7 passing notes (`D#` / `Gb`), C7#9 (`D#`), `A#7`, `C/A#`, and a grey slot.

Rejected: storing spelled names (stale after a chord change); strict theory spelling with double accidentals (hard to read on a stand); no odd names at all (`Fb`→`E` loses the role); lean taken from the chord root (gets G7/D7 wrong); always-flats; borrowing a neighbour's lean for grey slots (hidden dependency between slots); per-note override (stored state that goes stale); normalising awkward roots (contradicts the as-typed label).
