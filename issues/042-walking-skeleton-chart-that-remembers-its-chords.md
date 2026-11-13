---
id: 42
title: "Walking skeleton: chart that remembers its chords"
labels: [ready-for-agent]
status: closed
blocked_by: []
assignee: claude
---

## What to build

Stand up the React + TypeScript + Vite static app and the layout C chart screen (SPEC §3.1) with a stub control rail and the docked-hex area reserved (bottom 50%). A progression of 4 empty bars in `4/4` is shown as rows of slots: each row has a clef gutter (treble) and each slot an empty VexFlow 5 (`vexflow/core`) stave, time signature in the first slot. Bravura + Academico are bundled locally (no CDN); draw only after fonts are ready. The user clicks a slot's chord label and types a chord symbol (stored exactly as typed, no parsing yet); Enter / Tab → next slot, ⇧Tab → previous. Every commit writes the progression (v2 shape, SPEC §12.2) to `improwiser:progression:<id>` in localStorage; reload restores it. Set up the pure `form` module (bars → slots with time ranges) and a unit-test runner.

Spec: [SPEC.md](../SPEC.md) §2, §3.1, §4.2, §7.1, §7.3, §12.1–12.2. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] `npm run dev` / `npm run build` produce a working static app
- [x] Chart shows 4 bars × 1 slot with empty VexFlow staves, a clef in each row's gutter and `4/4` once
- [x] Typing a chord symbol and pressing Enter / Tab commits it and moves to the next slot; ⇧Tab goes back
- [x] Reloading the page restores the chords exactly as typed
- [x] Fonts are served from the app bundle (no network requests to jsDelivr)
- [x] `form` has unit tests for slot time ranges

## Blocked by

None - can start immediately

## Resolution

Built 2026-11-13. React 18 + TypeScript + Vite 5 app at the repo root (`npm run dev`, `npm test`, `npm run build`).

- `src/progression.ts`: v2 progression types, `newProgression()` (Untitled, 4 empty bars, `4/4`, 4 per row, Concert, empty melody), `setChord`.
- `src/form.ts`: pure `form` module. Integer ticks (whole note = 384), `parseTimeSignature` / `layoutMeter` (bad → `4/4`), `slotsOf`, `slotAt`. Unit-tested.
- `src/storage.ts`: one localStorage key per progression; opens the newest, or creates and saves a new one; skips corrupt keys. Unit-tested. Saves on every committed chord edit and on `visibilitychange` → hidden.
- `src/notation/`: bundled Bravura + Academico via `Font.load(name, localUrl)` (no CDN). Staves get fixed 3-ledger-line headroom. A clef gutter per row and `4/4` once in the first slot. Inline SVG size is set after `Renderer.resize`.
- `src/chart/`: layout C shell (128px stub rail, chart, 50% dock placeholder). Click a chord label to type: Enter / Tab → next slot, ⇧Tab → previous, Esc cancels, blur commits; trimmed, otherwise stored exactly as typed. Bar lines (2px) are heavier than slot dividers (1px); both span the staff only.

Verified in Chrome: typed `Dm7`, `G7(b9,#11)`, `Cmaj7` with Tab / Enter / ⇧Tab; all three restored after reload. Both fonts loaded with 0 CDN requests and no console errors. 27 unit tests pass; the production build succeeds.

Deferred to their slices: device key + `v` (Library screen and demo), quota banner (Storage robustness), chord parsing (Chord grammar), zoom (Chart zoom).
