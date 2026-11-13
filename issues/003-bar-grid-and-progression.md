---
id: 3
title: "Bar grid and progression"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

How is the progression laid out and entered? Time signature (fixed 4/4 or selectable), one chord per bar or several (e.g. two beats each), bars per row, progression length, repeats/endings, and how the user types and edits chord symbols in the grid.

Constraint from [Lattice model](002-lattice-model.md): lattices have entry/body/exit zones per bar, and bridges join adjacent bars (plus a wrap bridge last → first). If a bar may hold more than one chord, decide whether each chord slot gets its own entry/exit zones — i.e. becomes a "bar" for lattice purposes — or whether notes in a multi-chord bar are coloured against something else. Repeats/endings would redirect wrap bridges to the repeat target.

## Resolution

Grilled with the user, 2026-11-12.

1. **Chord slots** — a bar holds **one or two chord slots** (equal halves). The **slot** is the lattice unit: zones, links and bridges belong to slots (amends [Lattice model](002-lattice-model.md)); bridges run slot → next slot, including within a bar; the wrap bridge runs last slot → first. Bar lines drawn heavier than slot dividers.
2. **Time signature** — display-only label per progression (default 4/4); no behaviour.
3. **Bars per row** — per-progression setting (e.g. 2 / 4 / 8), default 4. Rows break on phrase boundaries; no responsive reflow.
4. **No repeats or endings** — everything written out; the progression always loops last → first. Bar **copy / paste / duplicate** copies chords, notes and in-slot links, not bridges.
5. **Chord entry** — click a slot's chord label and type; Tab/Enter → next slot, Shift+Tab → previous. Typing `Dm7 G7` into a one-slot bar splits it; Split / Merge also in a bar menu.
6. **Invalid / empty** — an unparseable symbol stays as typed, shown red; its notes go grey (uncoloured). Empty slots allowed, notes grey.
7. **Changing a chord keeps the lattice** — notes keep their pitches and recolour against the new chord.
8. **Merging slots** — the two lattices combine, in-slot links kept, the bridge between them dropped.
9. **Bars** can be added, inserted and deleted; deleting removes its notes and all bridges touching it.
10. **New progression** — title, 4 empty bars, 4/4, 4 per row.

Rejected: strictly one chord per bar (misrepresents harmonic rhythm); arbitrary beat-length slots (introduces beat timing against the static design); real time signature constraints; responsive reflow (breaks phrase alignment); repeats / endings (bars played twice would need branching exit bridges).

**Amended by [Lattice editing interaction](008-lattice-editing-interaction.md):** no links or bridges exist, so bar copy / paste / duplicate copies chords and notes; merging two slots unions their note sets (duplicate pitches collapse); deleting a bar removes its notes.
