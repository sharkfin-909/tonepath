---
id: 28
title: "Melody entry and caret (docked)"
labels: [wayfinder:prototype]
status: closed
parent: 1
blocked_by: [26]
assignee: claude
---

## Question

How does the user build and edit the continuous etude when pitches come from the **docked hex** and notation lives **in the slots** ([Docked hex pivot](026-docked-hex-pivot.md); event shape in [Melody data and schema](023-melody-data-and-schema.md))? Cover length + Rest latches, insert at caret, active slot = caret’s slot (remoulds the dock), delete/backspace, **Clear all** (→ `[]`, one undo, no confirm), and **out-of-scale marks** after chord changes. Notation can be a crude in-slot stand-in; engraving approach is VexFlow per [In-slot standard notation](029-in-slot-standard-notation.md).

## Assets

Prototype (throwaway; run `open prototypes/melody-entry-docked/index.html`):

- [prototypes/melody-entry-docked/index.html](../prototypes/melody-entry-docked/index.html) — round 1: 8-bar form (bar 4 split `Em7 | A7`; demo melody over bars 1–4, so `C5` over Em7 already shows an out-of-scale mark) above the Fit-range docked hex, with a real toolbar (length latch, Rest, undo/redo, Clear all, ▶ Chord / ▶ Scale). Variants: **A Ripple** (caret between events; insert/delete shift later music) vs **B Overwrite** (caret is a time; insert writes over, leftovers → rests, later music never moves; ⌫/Del turn notes into rests). Toggles: latched length that doesn't fit before the slot ends → refuse vs shrink; Rest as press-to-insert vs latch + Enter vs latch + length keys. ↑/↓ nudges the note before the caret a scale step (⇧ octave); chord dropdown per slot to test marks.

## Resolution

Prototyped and reviewed with the user on 2026-11-13. Glossary updated in [CONTEXT.md](../CONTEXT.md).

1. **Overwrite editing (variant B).** The **caret is a time position** in the form, not a point between events. Inserting writes the new event over the next *d* of time: events it covers are removed, and if the last one runs past, its leftover time becomes rests. **Later music never moves.** Rejected: ripple / text-cursor editing (A), because inserts and deletes slide notes into other chords' slots, creating out-of-scale marks and notes that cross slot lines.
2. **No ripple anywhere.** Not even an opt-in ripple-delete (Shift+⌫). Rejected as an escape hatch.
3. **Delete / Backspace.** **Del** turns the note at the caret into a rest of the same length. **⌫** does the same to the event before the caret and moves the caret to its start. On a rest that is the last event, either key removes it, so the melody gets shorter (the melody may be shorter than the form). Elsewhere a rest stays put: ⌫ just steps back over it.
4. **Doesn't fit → refuse.** If the latched length would run past the end of the caret's slot (no ties; each slot is its own stave), the insert is refused: the length button flashes and a short message explains why. Rejected: shrink-to-fit (silently changes the rhythm). The same applies at the end of the form.
5. **Rest latch.** **R** (or the Rest button) turns Rest on or off. While it's on, pressing a length key (`1`–`5` for w·h·q·e·s, or a length button) **sets the latch and inserts a rest of that length**. Clicking a hex cell turns Rest off and inserts the pitch at the current length. With Rest off, length keys only set the latch. Rejected: Rest inserting immediately on each press (no latch), and latch + Enter.
6. **Caret placement.** Clicking a note puts the caret at its start and plays it (per [Audition (etude)](025-audition-etude.md)). Clicking inside a note's span snaps to its start. Clicking past the end of the melody puts the caret on the latch-length beat under the click. Inserting there **fills the gap with rests**, split into the largest lengths that start on their own beat and stay inside a slot. ←/→ step event by event; past the melody's end they step by the latched length, up to the end of the form.
7. **Active slot** = the slot containing the caret's time (at the very end of the form, the last slot). It remoulds the docked hex. The **slot that owns a note** is the slot holding its start; that slot is used for its spelling and its **out-of-scale mark**.
8. **↑/↓ nudge** the note just before the caret (usually the one just entered) by one step of its owning slot's scale; **⇧↑/⇧↓** move it an octave. The nudged note plays. The hex shows a dashed halo on that note's cell(s).
9. **Out-of-scale marks** appear only through chord or scale edits, since overwrite never moves notes into another slot. Notes are kept, shown red and ringed in the stand-in.
10. **Clear all** → `[]`, caret to the start, one undo step, no confirm (unchanged). **Undo** snapshots include the caret. Each insert, delete, nudge, chord change and Clear all is one step.

Unchanged: entry from the hex only, scale tones only; five lengths; concert MIDI stored; events never cross slot boundaries (now guaranteed at entry; import repairs from [Melody data and schema](023-melody-data-and-schema.md) still drop overflow at the end).
