---
id: 36
title: "Spec assembly"
labels: [wayfinder:task]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

Compile every decision on the map into the **build-ready v1 spec** named in the map's Destination, written to this folder (e.g. `SPEC.md`). Follow the latest decision wherever an earlier one was superseded (e.g. Left-slanted hex grid over Docked hex grid's geometry and colours; Whole-screen layout (docked hex) over the strip-era layouts). Use `CONTEXT.md` as the glossary and the `examples/` demo file as the data example. Include: screens (control rail, chart, docked hex, Write / Play, Stand), entry and caret rules, notation (VexFlow, clefs), hex geometry and theme, audio, instruments and ranges, storage, schema and migrations, and an explicit out-of-scope list. Flag anything still contradictory or undecided back onto the map instead of deciding it here.

## Resolution

Done 2026-11-13: [SPEC.md](../SPEC.md) compiles every live decision on the map (16 sections: product, stack and modules, screens and modes, chords, harmony and spelling, melody and caret, notation, hex, audio, instruments, keyboard, storage and schema, glossary, required test tables, open items, out of scope), following the latest decision wherever one was superseded.

Open items found while compiling (SPEC.md §15), sent back onto the map rather than decided here:
- [Bar editing](037-bar-editing.md): bar-menu placement in layout C, and how whole-bar edits interact with "later music never moves".
- [Hex for slots without a scale](038-hex-for-slots-without-a-scale.md): `N.C.`, empty, unparseable and no-fit slots.
- [VexFlow notation spike](040-vexflow-notation-spike.md): the research's must-prove list was never prototyped.
- [Notation details](039-notation-details.md): beaming, mark styling, and repair of events that cross a slot boundary (after the spike).
- Accepted, no ticket: low ring-to-centre contrast on the light hex bands (colour-blind pass is out of scope).

Once those close, fold their answers into SPEC.md §4.1, §5.2, §7, §8.2, §12.3 and remove §15's entries.
