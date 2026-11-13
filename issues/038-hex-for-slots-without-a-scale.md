---
id: 38
title: "Hex for slots without a scale"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

What does the docked hex show, and can the user enter notes, when the active slot has **no scale**: `N.C.`, an empty slot, an unparseable chord, or a chord where no scale in its family fits ([Note classification](006-note-classification.md) fallback)? Options include a frozen previous slot, an empty or disabled dock, or (for the no-fit case) chord tones only. Also: how do Play-mode *On arrival* and ▶ Scale behave there? SPEC.md §5.2, §8.2, §15 item 4.

## Resolution

Grilled with the user on 2026-11-13. Builds on [Left-slanted hex grid](033-left-slanted-hex-grid.md), [Note classification](006-note-classification.md), [Enharmonic spelling](007-enharmonic-spelling.md) and [Play mode](035-play-mode.md). Glossary updated in [CONTEXT.md](../CONTEXT.md).

1. **`N.C.`:**
   - **Rests only.** The hex keeps the layout of the **nearest earlier slot that has a scale** (else the next scaled slot after it; else Concert C major), so nothing jumps.
   - It is **dimmed, with every cell inactive**, and a dock label reads "N.C. — rests only". Rest and length keys still insert rests.
   - ▶ Chord, ▶ Scale and Play-mode *On arrival* are silent.
2. **Empty and unparseable slots** are treated the same way (dimmed, inactive, rests only), with labels "No chord yet: type one to enter notes" / "Chord not recognised: fix the symbol to enter notes". Clicking the label focuses that slot's chord field. Notes already in such a slot are kept and shown with out-of-scale marks.
3. **Valid chord, no scale fits** (e.g. `C7sus4b9`):
   - The hex **steps through the chord's own tones**: each cell is the next chord tone up, with the same slant, 4 rows, Fit range and pitch-anchor rules. All cells are chord tones (white centre), with degree rings by spelled degree, and a dock label reads "No scale fits: chord tones only".
   - **Entry works.** ▶ Scale plays the chord tones ascending over one octave.
   - The scale override menu is empty. Spelling uses the chord tones' lean, as already decided.
4. **Play mode:** the same rules. Cells are inactive in cases 1–2 and playable in case 3; *On arrival* is silent where there is no chord.
