# In-slot standard notation

Ticket: [issues/029](../issues/029-in-slot-standard-notation.md) · Researched 2026-11-13

**Question.** How should v1 render **standard notation inside each chord slot** (chord + scale label, melody events for that bar’s time, rests, five durations: whole / half / quarter / eighth / sixteenth), with the progression still one continuous melody? Survey hand-rolled SVG vs engraving libraries (licence, size, React fit, written-pitch transposition, out-of-scale / out-of-range marks, half-bar slots). Recommend an approach and what a follow-up prototype must prove.

**Method.** I read the Improwiser destination docs ([CONTEXT.md](../CONTEXT.md), [Docked hex pivot](../issues/026-docked-hex-pivot.md), [Rendering approach](../issues/010-rendering-approach.md)) and the primary package/docs for each candidate: npm registry metadata, GitHub repos and licence files, official READMEs / wikis / API docs, and SMuFL. Bundle sizes: my own esbuild runs for VexFlow (`--bundle --minify --format=esm`, then gzip -9); for abcjs / OSMD / Verovio I measured the published min/WASM artefacts the same way (gzip -9). Weekly downloads from `api.npmjs.org`. Every figure below was observed directly unless marked otherwise. No secondary blog write-ups.

**v1 shape that constrains the choice** (from CONTEXT + docked-hex pivot):

- Storage is one progression-wide **melody** of pitched notes / rests + durations. Slots only **display** the time slice that falls in that slot.
- Each slot shows chord symbol + scale label + a **staff fragment**; there is no under-chart staff.
- Bars may split into **two half-bar slots**; heavier bar lines vs lighter slot dividers.
- Instrument view: concert MIDI in storage; **written** pitch and spelling on screen (tonal already chosen for theory).
- Marks: **out-of-scale** (chord edit left a pitch outside the new slot scale) and **out-of-range** (written pitch outside the instrument’s practical range). Notes are never auto-deleted.
- v1 durations only: w / h / q / e / s. No dots, no ties.

---

## TL;DR

**Adopt VexFlow 5 for the staff fragment inside each slot. Keep chord/scale labels and slot chrome in React SVG/HTML. Do written-pitch transposition and spelling in Improwiser (tonal) before notes reach VexFlow. Style out-of-scale / out-of-range notes with `StaveNote.setStyle`. Slice the continuous melody in app code; each slot gets its own short stave / voice whose tick total matches that slot’s time (half bar → half the displayed meter).**

- VexFlow is MIT, TypeScript, SVG (or canvas), and builds notes programmatically (`StaveNote` / `Factory` / `EasyScore`) without a MusicXML or ABC round-trip. `setStyle({ fillStyle, strokeStyle })` is first-class for per-note marks. A half-width stave is just a `Stave` with a smaller `width` and a `Voice` whose beat count matches the slot.
- Prefer `import … from 'vexflow/core'` (~92 KB gzip in our esbuild) plus Bravura loaded separately (`@vexflow-fonts/bravura`, OFL-1.1, ~241 KB woff2), not the default full bundle (~692 KB gzip with fonts inlined).
- React fit is **imperative into a ref** (`useEffect` / `useLayoutEffect` redraws the slot when the slice changes). There is no maintained React-native wrapper worth depending on; that is normal for engraving engines and matches how OSMD and abcjs are used too.
- **Hand-rolled SVG + Bravura/SMuFL** is a credible runner-up if the team wants zero engraving dependency and full DOM ownership (aligns with ticket 010’s SVG chart). Cost: you own stems, flags, beams, accidentals, ledger lines, rest placement and horizontal spacing for five durations — doable for this closed vocabulary, but the prototype burden is higher.
- **Reject OSMD** (MusicXML-first full-score renderer on VexFlow 1.2.93; not an editor; awkward for dozens of tiny independent slot containers). **Reject Verovio** (LGPL-3.0, ~7 MB WASM). **Reject abcjs** (ABC string as the API; half-bar / per-note marks are indirect).

---

## Snapshot (npm + measured sizes, 2026-11-13)

| Option | Version | Licence | Size (what we measured) | Weekly npm | Repo activity |
|---|---|---|---|---|---|
| Hand-rolled SVG + Bravura glyphs | n/a | OFL-1.1 (Bravura) | ~241 KB woff2 (or subset SVG glyphs); app code only | n/a | Bravura active (steinbergmedia/bravura) |
| **VexFlow 5** (`vexflow`) | 5.0.0 | MIT | **core** esbuild min+gz **~92 KB**; full default build ~692 KB gz; bravura build ~389 KB gz | 120k | github.com/vexflow/vexflow pushed 2026-10-29; npm last publish 2025-03-05 |
| OpenSheetMusicDisplay | 2.3.1 | BSD-3-Clause | `opensheetmusicdisplay.min.js` **~378 KB** gz (+ depends on **vexflow@1.2.93**) | 77k | pushed 2026-11-12 |
| abcjs | 6.7.2 | MIT (`LICENSE.md`) | `abcjs-basic-min.js` **~148 KB** gz | 124k | pushed 2026-10-16 |
| Verovio (JS/WASM toolkit) | 6.4.1 | LGPL-3.0-only | `verovio-module.mjs` **~7.1 MB** raw / **~2.4 MB** gz | 29k | pushed 2026-11-12 |

Sources: `npm view <pkg>`, `api.npmjs.org/downloads/point/last-week/<pkg>`, `api.github.com/repos/…`, local esbuild / gzip of published artefacts. VexFlow stars: `vexflow/vexflow` is the current org repo (258★); the historical `0xfe/vexflow` mirror still shows 4405★.

---

## 1. What “in-slot” actually requires

| Concern | Who owns it |
|---|---|
| Continuous melody sequence | App domain model (already decided) |
| Slice events → slot time window (incl. half bars) | App pure function |
| Chord symbol + scale label | Slot chrome (React text / SVG), not the engraver |
| Staff, noteheads, stems, flags, beams, rests, accidentals, ledgers | Engraver or hand-rolled layout |
| Written pitch (concert MIDI + instrument interval) + spelling | App (tonal); engraver only receives already-spelled keys like `bb/4` |
| Out-of-scale / out-of-range marks | Engraver styling or SVG overlay |
| Caret / active slot affordance | App UI over or beside the fragment |

The hard library question is therefore **many small staff fragments**, not one continuous score. Anything that wants a single MusicXML/MEI/ABC document of the whole progression fights the slot grid.

---

## 2. Hand-rolled SVG (+ SMuFL / Bravura)

**How it works.** Each slot owns an `<svg>` (or a group inside the chart SVG from ticket 010). Staff lines are five `<line>`s. Noteheads / rests / accidentals / flags / clefs are either (a) text glyphs from a SMuFL font (Bravura) at code points from the SMuFL tables, or (b) paths copied from Bravura’s redistributable SVG set. Stems and beams are primitives (SMuFL’s own implementation notes say scoring apps should draw stems as primitives, not stem glyphs — [noteheads table](https://w3c-cg.github.io/smufl/latest/tables/noteheads.html)).

**SMuFL coverage for v1.** Official tables include exactly what we need:

- Noteheads: whole / half / black — U+E0A2–U+E0A4 ([noteheads](https://w3c-cg.github.io/smufl/latest/tables/noteheads.html)).
- Rests: whole → 16th — U+E4E3–U+E4E7 ([rests](https://w3c-cg.github.io/smufl/latest/tables/rests.html)).

**Licence.** Bravura is SIL OFL 1.1 with Reserved Font Name “Bravura” ([steinbergmedia/bravura `LICENSE.txt`](https://github.com/steinbergmedia/bravura/blob/master/LICENSE.txt)). Bundling/embedding in the app is allowed; selling the font alone is not. SMuFL itself is a W3C Music Notation Community Group specification ([smufl latest](https://w3c-cg.github.io/smufl/latest/)).

**React fit.** Trivial — pure React SVG, same pattern as ticket 010’s chart.

**Written pitch / marks / half bars.** Full control: y-position from written MIDI + clef; colour/opacity for marks; slot width = half or full bar cell.

**Costs.** Horizontal spacing, beam grouping for runs of eighths/sixteenths, accidental stacking, stem direction, ledger lines, and clef policy (show once per row? every slot?) are all app code. For five durations and monophonic lines this is bounded, but it is still a real engraving micro-engine.

**When it wins.** If the prototype shows VexFlow’s imperative redraw / font load / per-slot instance cost is painful on a 32-bar chart, or if we insist every note is a React-owned DOM node for a11y without digging into VexFlow’s SVG.

---

## 3. VexFlow 5

**How it works.** TypeScript library; Canvas or SVG backends. High-level path: `Factory` + `EasyScore` + `System` / `Stave` / `Voice`. Low-level: `Renderer` → `SVGContext`, `new Stave(x, y, width)`, `StaveNote({ keys: ['c/4'], duration: 'q' })`, `Formatter`, `draw()` ([README](https://github.com/vexflow/vexflow/blob/master/README.md), [Factory API](https://vexflow.github.io/vexflow-docs/api/5.0.0/classes/Factory.html)).

**Licence.** MIT (package `LICENSE` and README).

**Size.** Observed with esbuild 0.25 + gzip -9:

| Entry | Minified | Min+gzip |
|---|---|---|
| `vexflow` (default) | 1.13 MB | **692 KB** |
| `vexflow/core` | 341 KB | **92 KB** |
| CJS `vexflow-bravura.js` (prebundled font) | 728 KB | 389 KB |

Official getting-started docs recommend loading Bravura (and Academico) via `@vexflow-fonts/*` or `VexFlow.loadFonts` / `setFonts` when using the core build ([getting started](https://vexflow.github.io/vexflow-examples/guides/getting-started/)). npm exports: `"."`, `"./core"`, `"./bravura"` (`package.json` `exports` field).

**React fit.** No first-party React components. Community `react-vexflow` targets VexFlow ^1.2 and React 15/16 — do not use. Pattern: empty `<div ref>` or `<svg>` host; redraw in an effect when the slot’s event slice / width / clef changes; clear previous SVG children before redraw. Same imperative pattern OSMD documents for React examples.

**Written-pitch transposition.** VexFlow does not know instruments. Pass already-transposed, already-spelled keys (`bb/4`, `f#/5`). That matches Improwiser’s model (concert storage, written display via tonal).

**Out-of-scale / out-of-range.** `StaveNote.setStyle({ fillStyle, strokeStyle })` and `setKeyStyle` are documented on the v5 API ([StaveNote](https://vexflow.github.io/vexflow-docs/api/5.0.0/classes/StaveNote.html); also confirmed in [discussion #1535](https://github.com/0xfe/vexflow/discussions/1535) and `tests/stavenote_tests.ts`). Opacity / hollow look for out-of-range is a style choice on top of that.

**Half-bar slots.** Supported as a short stave: set `Stave` width to the slot cell; build a `Voice` whose total ticks equal the slot’s share of the bar (e.g. two quarter-note beats for the first half of 4/4). No need for a full-score measure spanning two React cells. Soft barlines between slots can be omitted (slot divider is CSS/SVG outside VexFlow); full bar lines stay on the chart chrome.

**Beaming.** `EasyScore.beam(...)` / `Beam.generateBeams` cover eighth/sixteenth runs inside a slot. Cross-slot beams are out of scope if each slot is an independent voice (acceptable for lead-sheet-like etude cells).

**Fit to Improwiser.** Strong: programmatic notes, per-slot instances, SVG, MIT, TS types, style hooks, no MusicXML. Weaknesses: font bootstrap (`document.fonts.ready` / `loadFonts`); redraw discipline in React; npm release cadence slower than git (5.0.0 on npm since 2025-03, repo still moving in 2026).

---

## 4. OpenSheetMusicDisplay (OSMD)

**How it works.** TypeScript MusicXML → internal model → VexFlow render. Load XML string/URL, `render()` into a container ([Getting Started wiki](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/wiki/Getting-Started)).

**Licence.** BSD-3-Clause (npm / GitHub).

**Size / deps.** Published min build ~1.4 MB / **~378 KB** gz. `package.json` depends on **`vexflow@1.2.93`** (VexFlow 1.x), not 5.x — a second, older engraving stack if we also wanted VexFlow 5 elsewhere.

**React.** Example-only repo `opensheetmusicdisplay/react-opensheetmusicdisplay` (MIT); wiki calls it a WIP example, not a product component.

**Transposition.** First-class: `Sheet.Transpose` / per-instrument transpose, plus `IntervalTransposeCalculator` for spelling-preserving interval transpose ([Transposing wiki](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/wiki/Transposing)). Useful for full scores; **redundant** for Improwiser if tonal already produces written spellings.

**Marks.** README: data model supports changing a note’s colour; SVG classes for CSS. Viable, but only after MusicXML round-trip.

**Half-bar / in-slot.** Wrong grain. OSMD’s README states it is **“a renderer, not a full interactive sheet music editor”** and is aimed at displaying MusicXML scores. Driving it means: build MusicXML for each slot (or one score with forced system breaks), load, render, and fight layout meant for pages/systems. Dozens of independent OSMD instances on a chart is heavy and unnatural.

**Verdict.** Reject for v1 in-slot fragments.

---

## 5. abcjs

**How it works.** `abcjs.renderAbc(element, abcString, options)` → SVG ([docs.abcjs.net](https://docs.abcjs.net/), [React guidance in issue #741](https://github.com/paulrosen/abcjs/issues/741): ref + render after mount).

**Licence.** MIT (`LICENSE.md` in the package; npm `license: MIT`. GitHub’s licence API reports `Other` because of packaging, but the file is the MIT text).

**Size.** `abcjs-basic-min.js` ~512 KB / **~148 KB** gz.

**React / marks.** Imperative DOM write (not React-owned). Per-note colour via SVG `fill` / CSS classes when `add_classes: true` ([Classes](https://docs.abcjs.net/visual/classes), [release notes](https://docs.abcjs.net/upgrading/release-notes)).

**Fit.** Every caret edit becomes “rebuild ABC for this slot → re-render”. Half-bar slots need carefully scoped ABC (meter, missing barlines). Written transposition is again app-side (emit transposed ABC pitch names). No TypeScript in the library core (shipped `.d.ts` only). Fine for embedding folk tunes; awkward as the live editor surface for Improwiser.

**Verdict.** Reject for v1.

---

## 6. Verovio

**How it works.** C++ engraver compiled to WASM; primary encoding MEI, with MusicXML/Humdrum/ABC converters. JS toolkit: `loadData` → `renderToSVG` ([npm README](https://www.npmjs.com/package/verovio), [verovio.org](https://www.verovio.org/)).

**Licence.** **LGPL-3.0-only** (npm; GitHub LGPL-3.0). Fine for dynamic linking via the npm WASM build in a web app, but heavier compliance story than MIT/BSD for a small SPA.

**Size.** `verovio-module.mjs` **~7.1 MB** (~2.4 MB gz). Wrong weight class for slot fragments.

**Fit.** Excellent full-score engraving; poor match for many tiny live-edited cells and for concert→written policy that already lives in tonal.

**Verdict.** Reject for v1.

---

## 7. Trade-off summary

| | Many small slots | Prog. notes (no XML/ABC) | Written pitch | Marks | Half-bar width | React | Licence | Size (gz) |
|---|---|---|---|---|---|---|---|---|
| Hand-rolled SVG + Bravura | natural | DIY | DIY (tonal) | trivial | trivial | excellent | OFL font | ~0 + font |
| **VexFlow 5** | natural (1 stave/slot) | **native** | DIY keys in | **`setStyle`** | short `Stave` + `Voice` | ref + effect | MIT | **~92 KB core** + font |
| OSMD | awkward | via MusicXML | built-in transpose | colour API | fight layout | ref + effect | BSD-3 | ~378 KB + VF1 |
| abcjs | awkward | via ABC string | DIY ABC | CSS / fill | DIY meter | ref + effect | MIT | ~148 KB |
| Verovio | awkward | via MEI/XML | converters | possible | fight layout | WASM + ref | LGPL-3 | ~2.4 MB+ |

---

## 8. Recommendation

1. **Engrave slot fragments with VexFlow 5** (`vexflow/core` + Bravura from `@vexflow-fonts/bravura` or equivalent `setFonts` load). One renderer host per slot (or per visible slot), SVG backend.
2. **Keep chord symbol and scale label outside VexFlow** — React/SVG chrome in the slot, consistent with ticket 010.
3. **Slice the continuous melody in a pure function** `eventsForSlot(melody, slotTimeRange) → events`; map durations to VexFlow duration codes (`w|h|q|8|16` and `…r` for rests); map written spelled names to `keys: ['bb/4']`.
4. **Apply instrument transposition + spelling with tonal before engraving** (already the project theory choice). Do not use OSMD/Verovio transpose for display.
5. **Marks:** `setStyle` for out-of-scale (e.g. distinct stroke/fill) and out-of-range (e.g. reduced opacity / hollow). Exact visual language is a later a11y/UI ticket; the engine hook is enough here.
6. **Hold hand-rolled SVG + SMuFL as the escape hatch** if the VexFlow prototype fails on multi-slot performance, font FOUC, or caret hit-testing — the v1 glyph set is small enough that a follow-up could still rewrite the engraver without changing the melody model.

Reject OSMD, abcjs and Verovio for this ticket’s grain of UI.

---

## 9. What a follow-up prototype must prove

A throwaway (e.g. `prototypes/in-slot-notation/`) should demonstrate, on a real multi-row chart:

1. **Slice fidelity** — one continuous melody; two half-bar slots in one bar each show only their time window; durations sum correctly; rests render.
2. **Five durations + beams** — mixed quarters and beamed eighths/sixteenths readable at slot width (full and half).
3. **Written view** — same concert melody under Concert vs B♭ instrument: staff pitches and accidentals follow tonal spelling policy.
4. **Marks** — at least one out-of-scale and one out-of-range note visibly flagged via `setStyle` (or documented overlay).
5. **Chrome coexistence** — chord + scale label above the stave; bar line vs slot divider weight; no second staff under the chart.
6. **Scale** — ~32 bars × up to 2 slots redraws on edit without obvious jank on a laptop (and a quick tablet check).
7. **Font bootstrap** — Bravura ready before first paint (or a safe placeholder) with `vexflow/core`.
8. **Caret affordance** — a non-engraved caret/selection cue can sit on/near a note without breaking redraw (crude is fine).

Pass → adopt VexFlow in the spec. Fail on performance/integration → spike the hand-rolled SMuFL path with the same slice fixtures before reconsidering heavier score engines.

---

## Sources

- Improwiser: [CONTEXT.md](../CONTEXT.md), [issues/026-docked-hex-pivot.md](../issues/026-docked-hex-pivot.md), [issues/010-rendering-approach.md](../issues/010-rendering-approach.md), [issues/021-standard-notation-row.md](../issues/021-standard-notation-row.md) (superseded).
- VexFlow: https://www.npmjs.com/package/vexflow (5.0.0, MIT); https://github.com/vexflow/vexflow; https://vexflow.com/; [Getting started](https://vexflow.github.io/vexflow-examples/guides/getting-started/); [Factory](https://vexflow.github.io/vexflow-docs/api/5.0.0/classes/Factory.html) / [StaveNote](https://vexflow.github.io/vexflow-docs/api/5.0.0/classes/StaveNote.html) / [EasyScore](https://vexflow.github.io/vexflow-docs/api/5.0.0/classes/EasyScore.html); `@vexflow-fonts/bravura` OFL-1.1.
- OSMD: https://www.npmjs.com/package/opensheetmusicdisplay (2.3.1, BSD-3-Clause); README limitations (“renderer, not … editor”); [Transposing wiki](https://github.com/opensheetmusicdisplay/opensheetmusicdisplay/wiki/Transposing); dependency `vexflow@1.2.93`.
- abcjs: https://www.npmjs.com/package/abcjs (6.7.2); `LICENSE.md` (MIT); https://docs.abcjs.net/; https://github.com/paulrosen/abcjs/issues/741.
- Verovio: https://www.npmjs.com/package/verovio (6.4.1, LGPL-3.0-only); https://github.com/rism-digital/verovio; https://www.verovio.org/.
- SMuFL / Bravura: https://w3c-cg.github.io/smufl/latest/; [noteheads](https://w3c-cg.github.io/smufl/latest/tables/noteheads.html); [rests](https://w3c-cg.github.io/smufl/latest/tables/rests.html); https://github.com/steinbergmedia/bravura (`LICENSE.txt` OFL-1.1).
- Empirical: Node + esbuild 0.25 bundle of `vexflow` / `vexflow/core`; gzip -9 of those outputs and of published `abcjs-basic-min.js`, `opensheetmusicdisplay.min.js`, `verovio-module.mjs`; `bravura.woff2` from jsDelivr `@vexflow-fonts/bravura@1.0.2`.
