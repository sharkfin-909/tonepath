---
id: 43
title: "Chord grammar"
labels: [ready-for-agent]
status: closed
blocked_by: [42]
assignee: claude
---

## What to build

Implement the pure `chords` normaliser: chord-symbol text → root + interval list + optional bass, or invalid (SPEC §4.3: roots, qualities, synonyms, alterations, `alt`, slash chords, rejections). Wire it into the chart: unparseable symbols show red; `N.C.` / `NC` / `n.c.` are valid silence; a tooltip / menu on the chord label shows the interpretation (`Dm7 → D F A C`). Whitespace-separated input: one symbol edits the slot, two split a one-slot bar (or fill both slots of a split bar), three or more are not committed (inline message "a bar holds at most two chords").

Spec: [SPEC.md](../SPEC.md) §4.2–4.3, §14.1. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Test table 1 (SPEC §14.1) passes: every quality, synonym, alteration and rejection row
- [x] Invalid symbols render red; valid ones render as typed
- [x] `N.C.` variants parse as intentional silence
- [x] Typing two symbols into a one-slot bar splits it; three shows the inline message and commits nothing
- [x] The chord label tooltip shows the parsed tones

## Blocked by

- [Walking skeleton: chart that remembers its chords](042-walking-skeleton-chart-that-remembers-its-chords.md)

## Resolution

Built 2026-11-13.

- `src/chords.ts`: pure `chords` module.
  - `parseChord(text)` → `empty` | `nc` | `invalid` | `chord { root, intervals, bass? }`. Intervals are tonal names, low → high.
  - Our own normaliser covers the SPEC §4.3 grammar: roots with `#`/`b`/`♯`/`♭`, all qualities and synonyms, `alt`, alterations bare or in parentheses, slash bass, and every listed rejection.
  - The interval list already holds every **implied** tone per §5.1: `11` has no 3rd, `13` has no 11, `m13` is the full stack. An alteration replaces the natural tone of its degree, and `#5`+`b13` is kept once as the `#5`. [Slot scale and override](044-slot-scale-and-override.md) can use the list directly as the chord tones.
  - Also exports `chordNoteNames` (tonal spelling; only double accidentals are simplified, so `Cb`/`E#` are kept), `interpretation` (tooltip text) and `splitSymbols` (whitespace outside parentheses).
- `src/progression.ts`: `commitChordText`.
  - One symbol edits the slot.
  - Two split a one-slot bar, or overwrite both slots of a split bar from the first, keeping overrides.
  - Three or more are refused with "a bar holds at most two chords".
- UI:
  - Unparseable symbols are red; `N.C.` is plain text.
  - Hovering or focusing a label shows the interpretation (`G7(b9,#11) → G B D F Ab C#`).
  - A refused commit keeps the field open with an inline message. Esc or blur discards it.
  - Tab / Enter after a split continues from the bar's second slot.
- Test table 1: `src/chords.test.ts` (149 cases) plus `src/progression.test.ts`; 169 tests pass in total.

Verified in Chrome: `A B C` refused with the message; `C4 N.C.` split bar 4 into red `C4` + plain `N.C.`, with the split persisting across reload; tooltips right-aligned at row ends; no horizontal overflow; no console errors.

Choices beyond the spec:
- `maj11` drops the 3rd like plain `11`.
- Bare `maj`/`ma` without a number is invalid; only `Δ`/`△` stand alone for maj7.
- `b5`+`#5` together is valid. A 5th alteration that contradicts a quality's fixed 5th is invalid (`Cdim#5`, `Caug7b5`).
- Alterations are allowed only on 7th chords, so `C(b9)` is invalid.
- Spelling (at most one accidental, Cb/E# kept) is a stand-in until the `spelling` module in [Docked hex for the active slot](045-docked-hex-for-the-active-slot.md).

Deferred: refusing a split when a note crosses the middle of the bar (no melody yet; lands with [Enter notes from the hex](046-enter-notes-from-the-hex.md) / [Bar editing](055-bar-editing.md)). The scale part of the tooltip and the override menu belong to [Slot scale and override](044-slot-scale-and-override.md).
