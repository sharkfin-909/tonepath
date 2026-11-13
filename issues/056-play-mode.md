---
id: 56
title: "Play mode"
labels: [ready-for-agent]
status: closed
blocked_by: [47, 54]
assignee: claude
---

## What to build

Third mode per SPEC §3.3: Write | Play switch at the top of the rail, or `P`. Hex clicks audition only; the caret is hidden; the current slot gets a solid highlight distinct from Write's tint; length, Rest, undo / redo, Clear all and bar handles are hidden. ←/→ step slot by slot (split bar = two stops), wrapping; clicking a slot selects it, clicking a note plays it. "On arrival" dropdown Silent (default) / Chord / Root note, a device setting; silent where there is no chord. Hex follows §8.4 rules. Entering Play starts on the caret's slot; leaving puts the caret at the start of the current slot. Always opens in Write.

Spec: [SPEC.md](../SPEC.md) §3.3. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] P toggles modes (ignored in text fields); editing controls are hidden, not disabled
- [x] ←/→ wrap at both ends; chart keeps the current slot in view
- [x] On arrival plays Chord / Root note as chosen and persists across reload
- [x] Leaving Play places the caret at the start of the played slot

## Blocked by

- [Audio](047-audio.md)
- [Hex for slots without a scale](054-hex-for-slots-without-a-scale.md)

## Resolution

Built.

- `App`: `playIndex` (null = Write) is the current slot in Play; it drives the active slot, docked hex (`dockHex`, so §8.4 applies unchanged), readout and highlight.
  - `setMode` / `P` / the Write | Play switch at the top of the rail: entering starts on the caret's slot (and clears any bar selection); leaving puts the caret at the current slot's start. The mode is not stored, so the app always opens in Write.
  - Play keys: ← / → step slots with wrap-around (`stepSlot` in `src/form.ts`; a split bar = two stops), Space / ⇧Space, M, P. Everything else (↑ / ↓, ⌫, latches, ⌘Z, bar shortcuts) does nothing.
  - Hex clicks audition only. Clicking a slot or stave selects that slot. Clicking a note plays it and selects its slot.
- *On arrival* (Silent / Chord / Root note) is a device setting (`onArrival` in `improwiser:device`, read via `onArrivalOf`). It sounds on ← / → and slot clicks via `playChord` / `playRoot`, which are already silent without a chord.
- Rail in Play: the latch, Rest, undo / redo and Clear all are **removed** from the rail (hidden, not disabled), and the *On arrival* dropdown appears. Chart in Play: no caret, no bar handles or "+", chord labels select the slot instead of editing, the scale menu is read-only, and the current slot gets a solid amber highlight (`.slot.active.playing`). The chart's scroll-follow also tracks `playIndex`.
- Tests: `stepSlot` wrap-around and split-bar stops in `src/form.test.ts`.
- Checked in the browser: P toggles and the editing controls disappear; → wraps from the last slot to the first, ← steps back through the split bar's two halves; the hex remoulds (G altered on G7alt); Chord on arrival creates 4 oscillators (Cmaj7), Root note 1; a hex click sounds but records nothing; leaving Play puts the caret at the B♭m7 slot start; after a reload it opens in Write with *On arrival* still Root note; P typed in the title field is just text.
