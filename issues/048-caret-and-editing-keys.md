---
id: 48
title: "Caret and editing keys"
labels: [ready-for-agent]
status: closed
blocked_by: [46]
assignee: claude
---

## What to build

Complete melody editing per SPEC §6.2 items 5–8: Rest latch (`R` / Rest button; with Rest on, a length key sets the latch **and** inserts a rest; a hex pick turns Rest off); **Del** turns the note at the caret into a rest, **⌫** does that to the previous event and moves the caret back; trailing rests are removed. Caret placement by click (on a note → its start + plays it; inside a span → snap; past the end → latch-length beat under the click); ←/→ step by event, past the end by latched length. ↑/↓ nudge the previous note one step of its owning slot's scale, ⇧ = octave; the nudged note plays and the hex shows a dashed halo on its cell(s). All shortcuts ignored while a text field has focus.

Spec: [SPEC.md](../SPEC.md) §6.2, §11. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Test table 4 rows for Del / ⌫ on note, mid rest, trailing rest and nudge pass
- [x] Rest latch behaves as specified with keys and buttons
- [x] Click placement and arrow stepping match §6.2.7
- [x] Shortcuts do nothing while typing a chord

## Blocked by

- [Enter notes from the hex](046-enter-notes-from-the-hex.md)

## Resolution

Built.

- `melody.ts` gains the pure functions `deleteAt` (Del), `backspaceAt` (⌫), `trimTrailingRests`, `stepCaret` (← / →), `caretFromClick` and `nudge`. `harmony.ts` gains `stepPitchClasses`: the slot scale, or a no-fit chord's own tones.
- Test table 4 now has rows for Del / ⌫ on a note, a mid rest and a trailing rest, and for nudge (scale step, owning slot, out-of-scale start note, octave, no-fit chord, refusals), plus caret stepping and click placement (`src/melody.test.ts`).
- UI: a Rest toggle in the length latch (`R`); length keys and buttons insert a rest while it is on; a hex pick turns it off. Del, ⌫, ← / →, ↑ / ↓ and ⇧↑ / ⇧↓ are wired up. A click on a stave maps x → time piecewise between VexFlow note positions (the caret uses the same mapping). The nudged pitch plays, and its hex cells get a dashed halo that lasts until the caret or melody changes.
- Checked in the browser: nudge + halo, octave nudge, → past the end, Rest + `4` gap-fill, ←, Del shortening the melody, hex pick turning Rest off, click past the end landing on the latch beat, and keys inside a chord field having no effect.

Choices beyond the spec:
- Del / ⌫ always trim trailing rests, so deleting the last note shortens the melody.
- Nudge needs the event right before the caret to be a note (it does not skip back over rests).
- Off-scale notes move to the nearest step tone in the nudge direction.
- Slots without a scale only nudge by octave.
- Past the melody's end, ← / → and clicks use the latch-length grid measured from each slot's start, and never go before the melody's end.
- Clear all is left to Rail settings.
