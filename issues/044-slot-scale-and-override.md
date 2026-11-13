---
id: 44
title: "Slot scale and override"
labels: [ready-for-agent]
status: closed
blocked_by: [43]
assignee: claude
---

## What to build

Implement the pure `harmony` module: chord family, implied chord tones (incl. slash bass), ranked scale lists per family, first-fit default scale, override validity (SPEC §5.1–5.2). Each slot shows its scale label under the chord. The chord-label menu lists the filtered scale candidates as the scale override; choosing one stores the scale id on the slot and shows a dot on the chord label. On a chord change the override is kept if still a candidate, otherwise silently dropped. Classification of a pitch class against a slot: chord tone > scale tone > chromatic.

Spec: [SPEC.md](../SPEC.md) §5.1–5.2, §14.2. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Test table 2 (SPEC §14.2) passes, incl. one row per family
- [x] Each slot shows its default scale name; empty / unparseable / `N.C.` slots show none
- [x] Override menu lists only candidates; picking one shows the dot and persists across reload
- [x] Changing the chord keeps a still-valid override and drops an invalid one
- [x] Classification helper unit-tested

## Blocked by

- [Chord grammar](043-chord-grammar.md)

## Resolution

Built 2026-11-13.

- `src/harmony.ts`: pure `harmony` module.
  - `SCALES`: the 18 scale types (stable ids from SPEC §12.2), each with display name and tonal intervals whose letters give the spelled degree (half-whole 1 2 3 3 4 5 6 7, whole-tone 1 2 3 4 5 7, altered 1 2 3 3 5 6 7). This is ready for the `spelling` and `hex` modules.
  - `familyOf`, `RANKED`, `candidateScales` (first-fit by pitch class, bass excluded), `slotHarmony(slot)` → `none` (empty / invalid / nc) or `{ root, bass, family, chordTones (incl. slash bass), candidates, scale, overridden }`.
  - `withValidOverride`, `classify(pitch, harmony)` → chord > scale > chromatic, `scaleLabel`.
- `src/progression.ts`: `setChord` and `commitChordText` keep an override only while it is still a candidate. New `setScaleOverride`.
- UI: a scale label (11px) under each chord opens the override menu: candidates only, default marked, ✓ on the current one, ↑/↓ to move, Esc closes. A blue dot on the chord label marks an override, and the tooltip now reads `Dm7 → D F A C · D Dorian`. No-fit chords show *no scale fits*; empty / unparseable / `N.C.` show nothing. The slot header is now 48px tall to fit both lines.
- Tests: `src/harmony.test.ts` holds test table 2 (the worked list plus 24 family rows) and override / classification tests; 228 tests pass in total.

Verified in Chrome: labels for every case; Dm7's menu lists only Dorian / Aeolian / Phrygian; picking Aeolian shows the dot and survives a reload; Dm7 → Em7 keeps it and → Em7b5 drops it; the right-edge menu stays on screen; no console errors.

Choices beyond the spec:
- **`7#9b13` → altered** (required by test table 2) can't happen as written: the chord grammar keeps the natural 5th next to a b13, and no dominant-list scale holds 1 3 5 ♭7 ♯9 ♭13. Rule added: if nothing fits *and* the chord has a natural 5th plus b13, retry the fit without the 5th. `7b13` / `7b9b13` are unaffected (their scales hold the 5th). The 5th is still a chord tone for classification and ▶ Chord.
- Picking the default scale in the menu clears the override (no dot), rather than storing it.
- Diminished family = ♭3 + ♭5 without ♭7 (so a `m(maj7)b5` lands there); ♭3 + ♯5 counts as minor.
- No-fit chords show an italic "no scale fits" label (the hex's chord-tone mode is [Hex for slots without a scale](054-hex-for-slots-without-a-scale.md)).

Deferred: undo for override changes ([Undo and redo](049-undo-and-redo.md)); dropping a non-candidate `scale` on import ([Export, import and migrations](059-export-import-and-migrations.md)). The effective scale already ignores one.
