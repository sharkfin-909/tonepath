---
id: 33
title: "Left-slanted hex grid"
labels: [wayfinder:prototype]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

Should the docked hex change shape so that the **left edge is a diagonal column ascending up-left from the lowest note** (bottom-left), with cells **dropped on the right** to keep the grid inside the dock? User idea, 2026-11-13.

```
today (zigzag left edge)          proposed (left edge = up-left diagonal)
   G  A  B  C  D  E  F            B  C  D  E  F  G  A
  D  E  F  G  A  B  C              G  A  B  C  D  E
   A  B  C  D  E  F  G               E  F  G  A  B  C
  C  D  E  F  G  A  B                  C  D  E  F  G    ← lowest in-range scale tone
```

Each row sits half a cell left of the row below, so cell (row r, col c) = scale step `c + 2r`: right = step, up-left = third, up-right = fourth, unchanged. Every row now starts **exactly a third** above the one below (today rows alternate third/fourth because of the zigzag). The left column becomes a chain of thirds from the anchor note (an arpeggio of the active slot's scale).

To prototype against [Docked hex grid](027-docked-hex-grid.md) (reuse `prototypes/docked-hex-grid/` or `prototypes/whole-screen-docked/`, layout C at 50/50):
- How many cells are trimmed from the lower rows' right ends, and does **Fit range** still cover the whole practical range with the largest cells? Does the trimmed right edge (vertical, zigzag or stepped) look right?
- Does **Pitch anchor** (lowest in-range scale tone bottom-left) still hold, and what happens to the thirds column when the scale changes across a ii–V–I?
- How often does the same pitch appear twice, and where?
- Does it read better than today's grid (old vs new side by side)?

**Rows (user, 2026-11-13):** keep the 4 rows as in the current prototypes. The 3-row / computer-keyboard idea was dropped. Fit range still covers the whole practical range.

If adopted, this revises the geometry in [Docked hex grid](027-docked-hex-grid.md) (rows starting a third/fourth above, odd rows indented) and the "Docked hex" / "Fit range" glossary entries in CONTEXT.md.

## Assets

Prototype (throwaway; `open prototypes/left-slanted-hex/index.html`):

- [prototypes/left-slanted-hex/index.html](../prototypes/left-slanted-hex/index.html) — round 1: docked hex at layout C's 50/50 dock size (laptop / tablet presets), 4 rows (3 and 5 selectable), Fit range columns, a ii–V–I–alt loop to step (←/→). Variants: **A Today** (zigzag left edge, rows +3/+2), **B Slanted, trimmed** (each row half a cell left; every row +a third; right ends trimmed), **C Slanted, untrimmed** (parallelogram), **D A vs B** stacked. A side panel lists cells per row, cell width, duplicates, any range notes missing, and the left column's notes.

## Resolution

Prototyped and reviewed with the user on 2026-11-13. Revises the geometry and cell styling in [Docked hex grid](027-docked-hex-grid.md) and the fills in [Docked hex pivot](026-docked-hex-pivot.md). Glossary updated in [CONTEXT.md](../CONTEXT.md).

**Shape**

1. **Slanted, trimmed (variant B).** Each row sits **half a cell left** of the row below, so the left edge is a diagonal climbing up-left from the bottom-left cell. Cell (row r, column c) = scale step `c + 2r` from the anchor: right = next scale note, up-left = a third, up-right = a fourth (unchanged), and **every row starts a third above the row below** (no more third/fourth alternation). The left column is a chain of thirds, an arpeggio of the active slot's scale. The user prefers it for pattern recognition. Rejected: A, today's zigzag left edge; C, the untrimmed parallelogram (smaller cells).
2. **Trimmed right edge.** The **top row is full length** and each lower row drops the cells that would stick out past it, so the right edge stays roughly vertical (zigzagging by half a cell). With 4 rows: bottom → top = top−2, top−1, top−1, top cells.
3. **Four rows, fixed.** The top row is long enough that the grid covers the instrument's whole practical written range (top-row cells = range in scale steps − 6). Cells are the largest that fit the dock. This replaces Fit range's search over row counts. **Pitch anchor** is unchanged: the bottom-left cell is the lowest in-range tone of the active slot's scale. Concert is still C3–C6. At layout C's 50/50 dock on a 1280×800 laptop, Concert over Dm7 gives 14·15·15·16 cells at ~71px (today's grid: 78px), with nothing missing.
4. **No marking on the left column.** The slant shows it.

**Cell styling (user theme)**

5. **Degree ring:** each in-range cell is a **10px coloured ring** (was a 3px border) at the same overall cell size, with the fill inset inside it. Colours by spelled degree (still 1–7, rules from [Docked hex grid](027-docked-hex-grid.md)):
   1 night bordeaux `#53131E` · 2 school-bus yellow, brightened `#FFD52E` · 3 harvest orange `#EC7C25` · 4 navy electric `#390099` · 5 dark raspberry `#9E0059` · 6 moss green `#5BB561` · 7 neon ice `#12EAEA`.
6. **Centre fill:** **chord tone = white `#FFFFFF`** with dark lettering; **scale tone = warm grey `#938581`** with **white lettering** (3.55:1 against white). This replaces white/black. Rejected along the way: yellow-green `#BDD358` / `#DBFF81` chord tones, taupe `#D3C3BE` / `#E3D8D4` scale tones.
7. **Keyline:** a **2px line in the dock background colour** (`#D9D6CE`) between the ring and the centre, so the centre always has an edge, even where ring and centre are close (orange and moss against the grey, yellow and ice against the white). Rejected: a dark `#222` keyline, and no keyline.
8. **Label inside the centre:** a **small degree number above** the note name (no octave, as before). The degree number no longer sits on the ring.
9. **Out of range:** grey fill `#BDBAB3`, ring at 35% opacity, grey lettering, no keyline (unchanged in spirit: shown, inactive). The same-pitch flash highlight on play is unchanged.

Colour-blind checking stays out of scope ([Colour accessibility (docked hex)](031-colour-accessibility-docked-hex.md)).
