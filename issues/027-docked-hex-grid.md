---
id: 27
title: "Docked hex grid"
labels: [wayfinder:prototype]
status: closed
parent: 1
blocked_by: [26]
assignee: claude
---

## Question

Confirm the bottom-docked hex input grid under [Docked hex pivot](026-docked-hex-pivot.md): diatonic step to the right; up-left = diatonic third with the next row the same series offset by that third; remould across ii–V–I and alt; fit max practical written range with out-of-range cells grey; white/black fills; degree borders two nudges thicker; active slot drives colour/spelling. Prototype throwaway in the dock (chart can be a stub).

## Assets

Prototype (throwaway; run `open prototypes/docked-hex-grid/index.html`):

- [prototypes/docked-hex-grid/index.html](../prototypes/docked-hex-grid/index.html) — round 1: stub chart (ii–V–I–I, alt, plus stress slots m7♭5 / 8-note half-whole / 6-note whole-tone) above a bottom-half dock. Range-fit variants via `?variant=`: **A** fill dock (fixed cell size, pitches repeat), **B** two-row strip (sized to range), **C** fit range (rows × cols that cover the range with the biggest cells). Toggles: instrument (written ranges from [Instrument practical ranges](013-instrument-practical-ranges.md)), anchor pitch vs root, cell radius, degree numbers, hide grey. Hover shows repeats; click auditions (concert) + appends to the slot stub.

## Resolution

Prototyped and reviewed with the user on 2026-11-13. Builds on [Docked hex pivot](026-docked-hex-pivot.md). The geometry is confirmed as it stands: one step right = the next note of the scale, up-left = skip one note (a third), so up-right = a fourth. Each row starts a third or fourth above the row below, and odd rows are indented by half a cell.

1. **Fit range (variant C).** The dock picks the rows × columns that cover the instrument's whole practical written range with the **largest cells** that fit the dock. There is no fixed cell size and no fill-the-dock repetition. Most pitches appear once or twice, and grey cells are limited to the row ends.
2. **Pitch anchor.** The bottom-left cell is the **lowest in-range tone of the active slot's scale**. When the active slot changes, notes stay in place: across a ii–V–I only the fills and borders change, and a scale change (e.g. to altered) moves only the notes that changed. Rejected: root anchor (degree 1 always bottom-left), which moves every pitch, and with Fit range resizes the grid, on every slot change.
3. **Degree borders = spelled degree, always 1–7.** A border shows the letter distance from the root in the note's interval spelling (per [Enharmonic spelling](007-enharmonic-spelling.md)), so it never contradicts the cell's name. Scales that don't have seven notes still step through all their notes, but share degree numbers: G half-whole → 1 2 3 3 4 5 6 7, C whole-tone → 1 2 3 4 5 7, G altered → 1 2 3 3 5 6 7. Rejected: one colour per scale position (needs an 8th colour), interval-role numbering (♯9 = 2 contradicts the spelled ♭3), and dropping borders on such scales.
4. **Concert** (no range limit) uses a fixed **C3–C6** view with nothing grey. Rejected: C4–C6 (no low lines); growing the view to cover melody notes (layout depends on data).
5. **Cell label** = **note name without octave**, plus a **small degree number** (always on). **Playing a cell briefly highlights every cell with the same pitch**, which shows the octave without printing it. Rejected: name + octave; name only.
6. Unchanged from the pivot and checked in the prototype: white fill = chord tone, black = scale tone, grey = out of range (cells are shown, not hidden), 3px degree borders, the active slot drives colours and spelling, and audition plays concert pitch while labels show written pitch.

Accessibility (colour-blind contrast of the borders, fills and grey cells; whether the degree number is a strong enough backup cue) → [Colour accessibility (docked hex)](031-colour-accessibility-docked-hex.md).
