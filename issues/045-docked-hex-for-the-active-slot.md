---
id: 45
title: "Docked hex for the active slot"
labels: [ready-for-agent]
status: closed
blocked_by: [44]
assignee: claude
---

## What to build

Clicking a slot makes it the **active slot** (tinted). The docked hex in the bottom 50% shows the active slot's scale: pointy-top cells, 4 left-slanted rows, cell = scale step `t₀ + c + 2r`, pitch anchor at the lowest in-range scale tone, Fit range row lengths, largest cell radius that fits, centred (SPEC §8.1). Concert C3–C6 only in this slice. Cell styling per §8.2: 10px degree ring by spelled degree (palette table), 2px keyline in the dock background, white centre for chord tones / warm grey for scale tones, degree number above the note name (no octave). Implement the pure `spelling` module (interval spelling, at most one accidental, lean, default set) and the pure `hex` layout module. The hex remoulds when the active slot changes, notes staying in place.

Spec: [SPEC.md](../SPEC.md) §5.3, §8.1–8.2, §14.3, §14.6. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Test table 3 (spelling) and test table 6 (hex layout, Concert rows) pass
- [x] Clicking slots of a ii–V–I remoulds the hex without moving the anchor pitch
- [x] 6- and 8-note scales show the spelled degree numbers from SPEC §8.2
- [x] Colours match the §8.2 palette, keyline and centre fills

## Blocked by

- [Slot scale and override](044-slot-scale-and-override.md)

## Resolution

Built 2026-11-13.

- `src/spelling.ts`: pure `spelling` module.
  - `slotSpelling(harmony)` names chord and scale tones by root + interval with at most one accidental. Chord spelling wins, and a slash bass is named as typed.
  - Lean = majority of accidentals in the scale's names; no-fit slots count the chord tones. A tie or none, and every grey slot, uses the default set `C# Eb F# Ab Bb`.
  - Also `pcName`, `noteName` / `withOctave` (the octave follows the letter: `Cb4` = 59, `B#3` = 60), `spelledDegree`, `scaleNoteNames`, `prettyName` (♯/♭). Concert only: written-pitch spelling comes with [Instruments](051-instruments.md).
- `src/hex.ts`: pure `hex` module.
  - `hexGrid(pcs, range)`: 4 left-slanted rows, cell = step `c + 2r` from the anchor (lowest in-range scale tone), top = max(4, N − 6), rows top−2 / top−1 / top−1 / top.
  - `hexRadius` / `cellCentre` give the largest fitting radius with the grid centred. `slotHex(harmony)` adds name, spelled degree and chord/scale role per cell. `CONCERT_VIEW` = C3–C6; `DEGREE_COLOURS` and `HEX_THEME` hold the §8.2 palette.
- UI: clicking (or focusing) a slot makes it the **active slot** (light blue tint; slot 0 on load, not saved). `src/hex/DockedHex.tsx` draws the active slot's hex in the bottom 50%: 10px degree ring, 2px keyline in `#D9D6CE`, white / `#938581` centre, degree number above the name, a 2px gap between cells as in the prototype.
- Tests: `src/spelling.test.ts` (test table 3) and `src/hex.test.ts` (test table 6, Concert rows); 261 tests pass in total.

Verified in Chrome (1440 wide): Dm7 gives 14·15·15·16 cells anchored at C3. Dm7 → G7 → Cmaj7 keeps every cell's pitch identical; only fills and rings change. G7b9 reads 1 2 3 3 4 5 6 7 and C7#5 reads 1 2 3 4 5 7. G7alt moves the anchor to Db3. No console errors.

Choices beyond the spec / things to know:
- **Chord spelling renames hex cells.** Per §5.3 (chord > scale), G7alt's #5 and #9 show as `D#` / `A#` (degrees 5 / 2), not the altered scale's `Eb` / `Bb` (6 / 3). So "G altered 1 2 3 3 5 6 7" (§8.2) appears only when the chord doesn't spell those tones itself (tested via `G7b5b9` + Altered override). The left-slanted prototype used scale spelling for every cell.
- Slots without a scale (`N.C.`, empty, unparseable, no-fit) show a plain "No scale for this slot" placeholder; the rests-only / chord-tones hex is [Hex for slots without a scale](054-hex-for-slots-without-a-scale.md).
- The ring shrinks to 30% of the cell radius on very small docks so the centre never vanishes.

Deferred: cell clicks (audition / insert → [Enter notes from the hex](046-enter-notes-from-the-hex.md), [Audio](047-audio.md)), the same-pitch flash on play, the nudge halo, instrument ranges and grey out-of-range cells in the UI ([Instruments](051-instruments.md); `hexGrid` already supports a limited range). The caret will drive the active slot in [Caret and editing keys](048-caret-and-editing-keys.md).
