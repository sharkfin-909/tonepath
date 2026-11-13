---
id: 1
title: "Map: Improwiser v1 spec"
labels: [wayfinder:map]
status: closed
assignee:
---

## Destination

A build-ready v1 spec, written to this folder, for **Improwiser**: a desktop-first, static React (+ TypeScript + Vite) web app for writing **readable practice etudes** over a chord progression. The user enters a chord symbol per bar on a bar-line grid; each **slot** is a standard-notation bar (chord + scale + melody for that time). A single **docked hex** in the bottom half of the screen is the pick surface: diatonic step right, diatonic third up-left, remoulded by the active (caret) slot across as much of the instrument’s practical range as fits. Length and Rest latches drive entry; hex clicks audition and insert. Instrument view shows written pitch; storage and sound stay concert. Saved to browser storage with JSON export/import.

## Notes

- Domain: music theory / practice etude UI. Planning only — produce decisions, not code (prototypes are throwaway assets).
- Skills: `/grilling` + `/domain-modeling` for grilling tickets (keep a `CONTEXT.md` glossary as terms settle); `/prototype` for prototype tickets; `/research` for research tickets (findings in `research/`).
- Standing preferences: React (assume TypeScript + Vite). Pitches are real (`E4` ≠ `E5`, scientific pitch notation in typing and data). Desktop/laptop first, readable on a tablet on a music stand.
- Tracker conventions: see `issues/README.md`.
- Later (post-v1, not on this map): full-line / playhead playback with BPM; chromatic (out-of-scale) entry; dots and ties; share-by-URL (keep the data model compact); per-slot "prefer sharps / prefer flats" spelling switch; custom (user-adjustable) instrument ranges; library search / folders / tags / trash.

## Decisions so far

<!-- one line per closed ticket: - [title](file) — gist -->
- [Graph-editing library survey](009-graph-editing-library-survey.md) — Realistic options are hand-rolled SVG (lean: no deps) or React Flow; Konva/JointJS/Cytoscape fit poorly. *(less central after etude/docked-hex pivots.)*
- [Music-theory library survey](004-music-theory-library-survey.md) — Adopt tonal for spelling, octaves/MIDI and scales; own chord-symbol front end + curated chord→scale table.

- [Lattice model](002-lattice-model.md) — *(superseded along the lattice → note-set → etude path)*
- [Bar grid and progression](003-bar-grid-and-progression.md) — Bars hold 1–2 chord slots; display-only time signature; bars-per-row (default 4); no repeats; type chords in place; chord change keeps content (out-of-scale mark under etude). *(note-set / hex-in-slot display superseded.)*
- [Chord grammar and coverage](005-chord-grammar-and-coverage.md) — Jazz lead-sheet vocabulary; shown as typed; own normaliser → root+intervals for tonal; contradictions red.
- [Note classification](006-note-classification.md) — Chord vs scale vs chromatic; ranked per-family scales + per-slot override; no global key. *(Presentation: white/black + degree borders on docked hex.)*
- [Enharmonic spelling](007-enharmonic-spelling.md) — Store MIDI only; names derived per slot; v1 entry scale-only.
- [Lattice editing interaction](008-lattice-editing-interaction.md) — *(superseded by Etude pivot)*
- [Rendering approach](010-rendering-approach.md) — React SVG chart + HTML controls default; in-slot staves via VexFlow per [In-slot standard notation](029-in-slot-standard-notation.md).
- [Instrument view](011-instrument-view.md) — 14 instruments; out-of-range flagged not blocked; per-progression setting; written in / concert stored.
- [Instrument practical ranges](013-instrument-practical-ranges.md) — Practical written ranges; [research](../research/instrument-practical-ranges.md).
- [Audition and chord preview](012-audition-and-chord-preview.md) — Web Audio sine; ▶ Chord; mute; no line playback. *(Piano / ▶ Notes superseded — see Audition (etude).)*
- [Progression library](014-progression-library.md) — Library autosave, demo, export/import, undo/redo snapshots, backup reminder.
- [Saved data and JSON schema](015-saved-data-and-json-schema.md) — localStorage + envelope + migrations. *(note-set shape → Melody data and schema.)*
- [Whole-screen layout](016-whole-screen-layout.md) — *(out of scope; strip-era.)*
- [Colour accessibility](017-colour-accessibility.md) — *(out of scope; old role colours.)*
- [Etude pivot](018-etude-pivot.md) — Etudes: timed melody, scale-only hex entry, latches, caret owns scale, no strip/chromatics/line playback, out-of-scale marks on chord edit.
- [Hex palette layout](019-hex-palette-layout.md) — *(out of scope / superseded by Docked hex pivot; per-slot 14-cell experiment abandoned.)*
- [Melody entry and caret](020-melody-entry-and-caret.md) — *(superseded surface; rules carried to Melody entry and caret (docked).)*
- [Standard notation row](021-standard-notation-row.md) — *(out of scope / superseded; no under-chart staff.)*
- [Whole-screen layout (etude)](022-whole-screen-layout-etude.md) — *(out of scope / superseded; hex-in-slot + under-chart staff.)*
- [Colour accessibility (etude)](024-colour-accessibility-etude.md) — *(superseded surface; encoding re-checked under Colour accessibility (docked hex).)*
- [Docked hex pivot](026-docked-hex-pivot.md) — One bottom-docked range-spanning hex (step right, third up-left, remould by active slot); slots = in-bar notation (chord+scale+melody); grey out-of-range; white/black + thicker degree borders; entry latches unchanged. *(Fills and borders revised by Left-slanted hex grid.)*
- [In-slot standard notation](029-in-slot-standard-notation.md) — VexFlow 5 per-slot SVG staves (`vexflow/core` + Bravura); melody sliced in app; tonal written spelling; marks via `setStyle`; [research](../research/in-slot-standard-notation.md).
- [Melody data and schema](023-melody-data-and-schema.md) — `v: 2`: progression-level `melody` of `{pitch,d}` / `{d}` with `w|h|q|e|s`; slots lose `notes`; time signature sizes bars; short OK, overflow dropped; Clear all → `[]` (one undo); migrate by dropping old note-sets; [demo](../examples/demo.improwiser.json).
- [Audition (etude)](025-audition-etude.md) — Hex + notation click = `playNote`; ▶ Chord/Space + ▶ Scale/Shift+Space (scale = one octave from tonic); drop piano/▶ Notes; sine/Web Audio/mute/M unchanged; no line playback.
- [Docked hex grid](027-docked-hex-grid.md) — Fit range (largest cells covering the range); pitch anchor (lowest in-range scale tone bottom-left); borders = spelled degree 1–7 even for 6/8-note scales; Concert = C3–C6; labels = name + degree number, no octave; playing highlights the same pitch elsewhere. *(Geometry, rows and cell styling revised by Left-slanted hex grid.)*
- [Melody entry and caret (docked)](028-melody-entry-and-caret-docked.md) — Overwrite editing: caret = time; inserts write over (leftover → rests), nothing ever slides; Del/⌫ → rest; doesn't-fit-in-slot refused; Rest latch + length keys insert rests; ↑/↓ scale-step nudge of the previous note.
- [Whole-screen layout (docked hex)](030-whole-screen-layout-docked-hex.md) — Layout C: full-height left control rail; chart auto-fits every row above a fixed 50/50 hex, down to a ≈5px-gap floor, then scrolls following the caret; bars per row in the rail; Stand mode hides the rail and hex and fits every bar on one page.
- [Play mode](035-play-mode.md) — Third mode (Write | Play switch + `P`): hex auditions only, editing controls hidden; ←/→ step slot by slot and wrap; "On arrival" dropdown Silent (default) / Chord / Root note, a device setting; leaving Play puts the caret at the start of the slot being played; always opens in Write.
- [Left-slanted hex grid](033-left-slanted-hex-grid.md) — Rows slant half a cell left (each row a third up, left edge = thirds column), right ends trimmed, 4 rows covering the range; cells = 10px degree ring (user palette) + bg-coloured keyline + white (chord) / #938581 (scale) centre, degree number above the name.
- [Clef policy](032-clef-policy.md) — Fixed clef per instrument (bass: trombone, double bass/bass guitar; treble: rest); Concert gets a saved Treble/Bass choice; clef at every row start in a gutter outside the slots; no key signature; time signature once.
- [Spec assembly](036-spec-assembly.md) — [SPEC.md](../SPEC.md) written from every live decision; four open items sent back as tickets (bar editing, hex without a scale, VexFlow spike, notation details).
- [VexFlow notation spike](040-vexflow-notation-spike.md) — VexFlow 5 core adopted (fallback dropped): all must-prove items pass, 32-bar redraw ~24 ms; fixed 3-ledger-line headroom per row; labels ≥ 11px chord / 9px scale; fonts bundled.
- [Bar editing](037-bar-editing.md) — Insert/delete/duplicate move the melody with the bars; paste replaces target bar(s) incl. melody slice; split refused if a note crosses the middle; ⋯ bar handle on each bar number + ⌘C/V/D/⌫ on a bar selection; min 1 bar.
- [Hex for slots without a scale](038-hex-for-slots-without-a-scale.md) — N.C. / empty / unparseable: hex dimmed + inactive (previous scaled slot's layout), rests only, explanatory dock label; no-fit chord: hex steps through chord tones, entry allowed.
- [Notation details](039-notation-details.md) — Beam by beat (compound: groups of 3 eighths); out-of-scale = red + ring, out-of-range = grey, both = grey + ring, hover reason; import shortens slot-crossing notes and pads with rests.
- [Spec update](041-spec-update.md) — [SPEC.md](../SPEC.md) now holds every decision (new §8.4 for slots without a scale, test tables 8–9); §15 has no open items, only accepted risks. **Destination reached.**

## Not yet specified

_(none: destination reached — [SPEC.md](../SPEC.md) is build-ready)_

## Out of scope

- Sound beyond pick audition and chord/scale peek (no full-line / progression playback, no instrument sounds).
- Piano strip / keyboard note entry.
- Per-slot hex pick palettes.
- Separate standard-notation strip under the chord grid.
- Chromatic (out-of-scale) pitch entry in v1.
- Dotted notes and ties in v1.
- Path suggestion / auto-walking (paths no longer exist).
- Accounts, backend, cloud sync.
- Per-instrument defaults beyond transposition and range; user-adjustable ranges are post-v1 (see Notes).
- [Whole-screen layout](016-whole-screen-layout.md) — strip-era layout.
- [Colour accessibility](017-colour-accessibility.md) — old green/blue/brown model.
- [Hex palette layout](019-hex-palette-layout.md) — per-slot hex experiment.
- [Standard notation row](021-standard-notation-row.md) — under-chart staff.
- [Whole-screen layout (etude)](022-whole-screen-layout-etude.md) — hex-in-slot + under-chart staff layout.
- [Colour accessibility (docked hex)](031-colour-accessibility-docked-hex.md) — colour-blind check of the hex encoding; dropped by the user, so the encoding (now from Left-slanted hex grid) gets no colour-blind check.
- [Computer-keyboard grid play](034-computer-keyboard-grid-play.md) — letter keys playing a 3-row hex; dropped by the user as too much, so the grid keeps 4 rows.
