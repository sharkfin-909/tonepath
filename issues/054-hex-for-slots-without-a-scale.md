---
id: 54
title: "Hex for slots without a scale"
labels: [ready-for-agent]
status: closed
blocked_by: [46, 47]
assignee: claude
---

## What to build

Implement SPEC §8.4. For `N.C.`, empty and unparseable active slots the **rests-only hex**: the layout of the nearest earlier scaled slot (else the next one; else Concert C major), dimmed, every cell inactive; Rest + length keys still insert rests; dock labels "N.C. — rests only" / "No chord yet: type one to enter notes" / "Chord not recognised: fix the symbol to enter notes" (the last two focus the chord field when clicked); ▶ Chord / ▶ Scale silent; existing notes kept with out-of-scale marks. For a valid chord no scale fits (e.g. `C7sus4b9`) the **chord-tones hex**: cells step through the chord's own tones (same slant, rows, Fit range, anchor), all white centres, label "No scale fits: chord tones only", entry works, ▶ Scale plays the chord tones over one octave, override menu empty.

Spec: [SPEC.md](../SPEC.md) §5.2, §8.4, §9. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Test table 6 rows for the §8.4 cases pass (N.C. after / before a scaled slot and at the form start; chord-tones grid)
- [x] Hex clicks do nothing on a rests-only hex; rests can still be entered
- [x] Clicking the empty / unparseable label focuses the chord field
- [x] Notes can be entered on `C7sus4b9`; ▶ Scale plays its chord tones

## Blocked by

- [Enter notes from the hex](046-enter-notes-from-the-hex.md)
- [Audio](047-audio.md)

## Resolution

Built.

- `src/hex.ts`:
  - `slotHex` now also builds the **chord-tones hex** for a valid chord no scale fits (the grid over its chord tones, slash bass included; all chord-tone centres; spelled-degree rings).
  - New `dockHex(harmonies, active, range)` returns `{ hex, mode: 'scale' | 'chord-tones' | 'rests-only', label, labelEditsChord }`. For N.C. / empty / unparseable slots it borrows the layout of the nearest earlier slot with a scale (no-fit slots don't count), else the next one, else C major, and gives the §8.4 dock labels.
- `DockedHex` takes the dock: the rests-only hex is dimmed (opacity + desaturate) with no clickable cells, and the label shows at the top of the dock. For empty / unparseable slots it is a button; clicking it sends an `editRequest` to `Chart`, which opens and focuses that slot's chord field.
- Rests still enter with Rest + length keys (insert never depended on the hex). ▶ Chord / ▶ Scale were already silent for no-chord slots, and ▶ Scale on a no-fit chord plays its chord tones (`scaleRun`, already tested). Nudge on a no-fit chord steps through its chord tones (`stepPitchClasses`).
- Tests: the §8.4 rows of test table 6 in `src/hex.test.ts`: N.C. after a scaled slot, before any, skipping no-fit / unscaled slots, the C major fallback, the empty / unparseable labels, and the C7sus4b9 chord-tones grid (C D♭ F G B♭ = degrees 1 2 4 5 7, all white, anchor C3).
- Checked in the browser: N.C. shows the dimmed G-altered layout borrowed from G7alt, cell clicks do nothing and R + 2 inserts a half rest; empty shows the clickable label, which focuses the chord field; `C7sus4b9` shows the chord-tones hex and a pick enters C5.

**Play mode** should reuse `dockHex` unchanged (the rests-only mode is inactive there too).
