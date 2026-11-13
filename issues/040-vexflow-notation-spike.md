---
id: 40
title: "VexFlow notation spike"
labels: [wayfinder:prototype]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

Does VexFlow 5 (`vexflow/core` + Bravura) work for the in-slot staves at Improwiser's scale? Build the throwaway prototype that [In-slot standard notation](029-in-slot-standard-notation.md)'s research (§9 of [research/in-slot-standard-notation.md](../research/in-slot-standard-notation.md)) says must prove: half-bar slices of one continuous melody; five durations + beams at full and half slot width; written transposition (Concert vs B♭); out-of-scale and out-of-range marks via `setStyle`; chord / scale chrome above the stave; ~32 bars × 2 slots redrawing on edit without jank; Bravura ready before first paint; a caret cue beside notes. Include the clef gutter from [Clef policy](032-clef-policy.md) and the auto-zoom from [Whole-screen layout (docked hex)](030-whole-screen-layout-docked-hex.md). If it fails, decide on the hand-rolled SVG + SMuFL fallback.

## Assets

Prototype (throwaway; serve `prototypes/` and open `/vexflow-spike/index.html`; loads `vexflow@5.0.0` core + Bravura from jsDelivr, so it needs network):

- [prototypes/vexflow-spike/index.html](../prototypes/vexflow-spike/index.html) — round 1: 32-bar AABA form (20 half-bar slots), a 138-event melody over all 32 bars, one VexFlow `Stave`/`Voice` per slot (`GhostNote` padding, `Accidental.applyAccidentals`, `Beam.generateBeams`, `setStyle` marks + an SVG ring overlay), clef gutter per row, auto-zoom with a 5px staff-gap floor, a caret, click-to-select, instrument switch (Concert / B♭ / E♭ / bass clef), Random edit and a 20-edit benchmark. A side panel shows the must-prove checklist with measured timings.

## Resolution

Prototyped and reviewed with the user on 2026-11-13.

1. **Adopt VexFlow 5 (`vexflow/core`)** for the in-slot staves; the hand-rolled SVG + SMuFL fallback is dropped. Every must-prove item passed on a 32-bar AABA form (50 staves incl. 8 gutters, 138 events, 20 half-bar slots):
   - slicing of one continuous melody into whole- and half-bar slots (`GhostNote` padding for unfilled time; `Voice` in SOFT mode);
   - five durations with `Beam.generateBeams` auto beams;
   - written view: Concert, B♭ tenor sax (up a M9) and trombone (bass clef);
   - `Accidental.applyAccidentals` per slot, no key signature;
   - out-of-scale marks (red `setStyle` + SVG ring overlay) and out-of-range marks (grey `setStyle`);
   - clef gutter per row, time signature in the first slot;
   - Bravura ready before the first draw (`VexFlow.loadFonts` + `setFonts`);
   - caret beside notes, click-to-select via `getSVGElement()`.

   **Full redraw of all 32 bars: 20–35 ms, 24 ms average over 20 edits** (laptop Chrome). No engraving errors.
2. **Ledger-line room: fixed headroom** of 3 ledger lines above and below the staff on every row, so all rows are the same height (the chart-zoom fit uses that height). Notes beyond that may overlap the chrome and are out of range anyway. Rejected: rows that grow to fit their notes (rows jump); an opaque label band that hides notes.
3. **Label minimums:** chord symbols never below **11px**, scale names never below **9px** (ellipsised in narrow slots), in every mode including Stand. At the 5px staff-gap floor the prototype's labels had shrunk to ~7.5px.
4. **Spacing is VexFlow's**, not strictly time-proportional. Unfilled time is padded with `GhostNote`s; the caret sits at the actual note's x (time-interpolated only where no event starts). Accepted.
5. **Fonts are bundled** with the app (Bravura + Academico woff2 from `@vexflow-fonts/*`, OFL-1.1; point `Font.HOST_URL` or `Font.load(name, url)` at local files). The cold jsDelivr load took several seconds. Draw after `document.fonts.ready`.
6. Gotcha for the build: `Renderer.resize` writes inline width/height styles on the `<svg>`, so zoom has to set `style.width/height` (or use a viewBox wrapper) after each resize.

Unblocks [Notation details](039-notation-details.md) (beaming defaults look right as-is; mark styling as prototyped).
