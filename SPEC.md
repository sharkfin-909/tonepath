# Honeycomb v1 — build spec

Compiled 2026-11-13 (updated the same day by [Spec update](issues/041-spec-update.md)) from the decisions on [Map: Honeycomb v1 spec](issues/001-map-improwiser-v1-spec.md). Each section cites the ticket(s) that hold the full reasoning; where an earlier decision was superseded, only the latest is stated here. Terms are defined in [CONTEXT.md](CONTEXT.md) (the glossary is normative). Example data: [examples/demo.honeycomb.json](examples/demo.honeycomb.json).

---

## 1. Product

Honeycomb is a desktop-first, static web app for writing **readable practice etudes** over a chord progression. The user types a chord symbol per **slot** on a bar grid; each slot shows its chord, its **slot scale** and a standard-notation fragment of the one continuous **melody**. A single **docked hex** in the bottom half of the screen is the only pitch-entry surface: diatonic steps to the right, diatonic thirds up-left, remoulded by the **active slot** (the slot under the caret). Length and Rest latches drive entry. The **instrument view** shows written pitch; storage and sound are always concert. Everything is saved to browser storage, with JSON export and import.

Target devices: desktop / laptop first (1280×800 and up); readable on a tablet on a music stand (Stand mode, 1024×768).

## 2. Stack and module boundaries

- **React + TypeScript + Vite**, static build, no backend, no accounts.
- **tonal** (`@tonaljs/note`, `/chord`, `/scale`, `/interval`, `/midi`) for spelling, intervals, octaves and MIDI ([Music-theory library survey](issues/004-music-theory-library-survey.md)).
- **VexFlow 5** — `vexflow/core` for the in-slot staves, adopted after the [VexFlow notation spike](issues/040-vexflow-notation-spike.md) passed every must-prove item (full 32-bar redraw 20–35 ms, 24 ms average) ([In-slot standard notation](issues/029-in-slot-standard-notation.md), [research](research/in-slot-standard-notation.md)). No hand-rolled fallback. **Fonts bundled** with the app: Bravura + Academico woff2 from `@vexflow-fonts/*` (OFL-1.1), loaded from local files (`Font.HOST_URL` or `Font.load(name, url)`), never a CDN.
- **Web Audio**, no audio library.
- Chart chrome (chord labels, scale labels, slot rectangles, bar lines, caret, highlights) is React SVG/HTML; the hex is React SVG ([Rendering approach](issues/010-rendering-approach.md)).

Pure modules (no React / DOM), each unit-tested with the tables in §14:

| Module | Responsibility |
|---|---|
| `chords` | Our own chord-symbol normaliser: text → root + interval list + optional bass, or invalid. |
| `harmony` | Chord family, implied chord tones, ranked scale list, first-fit default scale, override validity. |
| `spelling` | Note names for MIDI pitches against a slot (interval spelling, lean, default set); written vs concert. |
| `form` | Bars → slots with time ranges (from the time signature); slot lookup by time. |
| `melody` | Timeline, overwrite insert, delete, rest filling, nudge, caret movement, slicing per slot (`eventsForSlot`). |
| `hex` | Hex grid layout for a slot + instrument + dock size (§8). |
| `schema` | Envelope, validation / repair, migrations `migrateNtoN+1`. |
| `audio` | `playNote(midi)`, `playChord(slot)`, `playScale(slot)`, `playRoot(slot)`; mute. The UI never touches Web Audio. |

## 3. Screens and modes

### 3.1 Chart screen (layout C) — [Whole-screen layout (docked hex)](issues/030-whole-screen-layout-docked-hex.md)

```
┌───────────────────────────────────────────────────────┐
│  control header (wraps to two lines as needed)        │
├───────────────────────────────────────────────────────┤
│  chart (auto-zoom; scrolls below the floor)           │
├───────────────────────────────────────────────────────┤
│  docked hex (all the remaining height, full width)    │
└───────────────────────────────────────────────────────┘
```

- **Control header** — a bar across the top, so the hex gets the full width. Left to right, in groups: ← Library · title (inline rename) | Stand · **Write | Play** switch | instrument picker (+ Concert clef choice, §7.3) · time signature · bars per row | mute · ▶ Chord · ▶ Bass · ▶ Scale · *On arrival* | (Write only) length latch `1 · whole` … `5 · 16th` · Rest · undo / redo · Clear all — and at the right end the **slot browser**: `‹ Bar n · chord · scale ›` (the caret's / current slot, with previous / next). Wraps to a second line on narrow windows. After any header button click or dropdown choice, **focus returns to the hex grid**, so Space and the other keys never act on the last-clicked control; the inline title / time-signature fields keep focus while editing. No toolbar strip between chart and hex.
- **Chart** — rows of `barsPerRow` bars; each row has a **clef gutter** at its left (§7.3), then the slots at equal, time-proportional width. Bar lines heavier than slot dividers. In Write, each bar number carries a **⋯ bar handle** and a **"+"** follows the last bar (§4.1).
- **Chart zoom** — automatic: scale so every row fits the chart area (cap ~1.4× on short forms), never below a readable floor (staff line gap ≈ 5px). Every row has the same height (fixed ledger-line headroom, §7.1); chord / scale labels keep their minimum sizes (§7.1) at any zoom. Below the floor the chart stops shrinking and **scrolls vertically**, keeping the caret's row (or, in Play, the current slot) in view. No manual zoom control.
- **Split** — the chart takes only the height its rows need (padding above; the stave's own ledger-line headroom is the gap below), up to half the space under the header; the **hex takes everything else**, with 12px padding around the grid. No divider, no setting.

### 3.2 Write mode (default)

Hex picks are recorded at the caret (§6). Opening a progression or reloading always starts in Write.

### 3.3 Play mode — [Play mode](issues/035-play-mode.md)

- Switch: **Write | Play** in the control header, or `P` (ignored while a text field has focus).
- Same layout, but the **stave is cleared**: the written melody is hidden (bars, clef and chords stay) so you play over empty staves; it shows again in Write. Hex clicks **audition only** (never recorded). The caret is hidden; the **current slot** gets a solid full-width highlight in a colour distinct from Write's active-slot tint. Length latch, Rest, undo / redo and Clear all are **hidden** (not disabled); ▶ Chord, ▶ Scale, mute stay. **Chord and scale entry stay**: clicking a chord name (or an empty slot's `+`) edits it exactly as in Write (autosuggest, Tab / Enter to move on), and makes that slot current; the scale name under a chord opens its scale menu as in Write.
- **← / →** move to the previous / next **slot** (a split bar = two stops), **wrapping** at both ends. Clicking a slot selects it. ↑ / ↓ do nothing. Chart scrolls to keep the current slot in view.
- **On arrival** dropdown: **Silent** (default) · **Chord** (= ▶ Chord) · **Root note** (chord's bass — the slash bass if any — in concert octave 3, plain sine; `N.C.` silent) · **Bass note** (the same note an octave lower, concert octave 2) · **Bass note + chord** (both together). *On arrival* applies in **Write** too: writing the **first entry of a slot** (a note or rest at its start, incl. the wrap back to bar 1) sounds that slot's chord or root together with it. Moving the caret, ‹ › and finishing a slot are silent. The dropdown shows in both modes. C / B always play ▶ Chord / ▶ Bass; S / ⇧Space ▶ Scale; Space clicks whatever is under the pointer (§11), and A over a hex cell auditions it. In **Play** the sound waits for the **first note played** in the slot after arriving (hex click / Space / A), sounding together with it; arriving itself (←/→, < >, ‹ ›, slot click, entering Play) is silent. A device setting.
- The hex remoulds on arrival exactly as in Write (pitch anchor kept), including the no-scale rules of §8.4: cells are inactive on `N.C.` / empty / unparseable slots and playable (chord tones) on no-fit chords; *On arrival* is silent where there is no chord.
- Bar handles and "+" are hidden.
- Entering Play starts on the caret's slot; leaving Play puts the caret at the **start of the current slot**.
- Not in v1: timed / BPM auto-advance.

### 3.4 Stand mode

- Stand button in the control header, or `\`. Hides the control header and the hex; shows a thin header (title, instrument, mute, ✎ Edit).
- Read-only chart: no caret, no chord editing, no bar handles or "+". **Fit page**: every bar on one screen, auto-zoomed (no floor; 32 bars at 4/row fit on 1024×768). `\` or ✎ Edit returns to the mode it came from (Write or Play).

### 3.5 Library screen — [Progression library](issues/014-progression-library.md)

- Reached via ← Library. Rows: title, instrument, bar count, last edited; newest edit first; click opens.
- Actions: New, Duplicate, Rename, Delete, Export one, Export all, Import.
- Delete: immediate, toast *"‹title› deleted · Undo"* for ~10 s, restores exactly; no trash. Deleting the open progression returns to the library; deleting the last shows an empty state with a big *New progression* button.
- Duplicate copies everything as *"‹title› (copy)"*, lands at the top and opens. New: title in edit, 4 empty bars, `4/4`, 4 per row, the device's last-picked instrument, empty melody.
- Backup reminder (library screen only): quiet, dismissible line *"Last backup: ‹age› · Export all"* when there are changes since the last Export all and it is > 14 days old or never happened; dismissed until the next change. On Safari it also suggests adding to the home screen.
- Launch reopens the last-open progression; first launch seeds the demo (§12.5).
- Not in v1: search, folders, tags, sort options, multi-select, trash.

## 4. Progression and chords

### 4.1 Bars and slots — [Bar grid and progression](issues/003-bar-grid-and-progression.md), [Melody data and schema](issues/023-melody-data-and-schema.md), [Bar editing](issues/037-bar-editing.md)

- A **progression** = title, time signature, bars per row (1–8, default 4), instrument, (Concert clef), bars, melody.
- A **bar** holds **one or two slots** (equal halves). No repeats or endings — everything written out; the form loops last → first.
- **Time signature**: stored as typed and shown as typed; parsed as `N/D` to size bars (one bar = `N` beats of `1/D`; a split slot is half of that). Unparseable / missing → layout as `4/4`.
- **Bar edits carry the melody with the bars** (a structural form edit; "later music never moves" in §6.2 governs note entry only). Clean by construction, since events never cross a slot — so never a bar — boundary; notes stay over the chord they were written against.
  - **Insert before / after**: a new empty bar (one empty slot); every later event moves one bar later.
  - **Delete**: removes the bar and the events inside it; every later event moves one bar earlier. **Minimum one bar** (Delete disabled on the last); no maximum in v1.
  - **Duplicate**: inserts a copy of the bar (chords, scale overrides, melody slice) straight after it; later music moves by one bar.
  - **Copy / Paste**: Copy puts the selected bar or run of bars on an in-app clipboard. **Paste replaces** the target bar(s)' chords, overrides and melody slice from the target onward, with no shifting; refused if it would run past the end of the form. Pasted notes are kept as-is (out-of-scale marks where they clash).
  - **Split** (one slot → two): the new second slot starts empty (no chord); melody untouched. **Refused** with "a note crosses the middle of the bar" if an event crosses the midpoint — also when two chords are typed into a one-slot bar (§4.2).
  - **Merge** (two → one): keeps the first slot's chord and override, drops the second's chord; melody untouched (marks as needed).
- **Controls (Write only)**: each bar number is a small **⋯ bar handle** (visible on the active bar and on hover) opening the **bar menu**: Insert before · Insert after · Duplicate · Copy · Paste · Split / Merge · Delete. Clicking a bar number **selects** that bar; Shift-click extends to a run. With a bar selection, ⌘C / ⌘V / ⌘D / ⌫ copy / paste / duplicate / delete (§11). A **"+"** after the last bar appends an empty bar. Hidden in Play and Stand.
- **Caret** moves with the music (stays on the same note). If its own bar is deleted, it goes to the start of the bar now in that position (or the end of the form).

### 4.2 Chord entry

- Click a slot's chord label and type. Enter / Tab → next slot, Shift+Tab → previous. While a text field has focus, global shortcuts are ignored.
- Whitespace outside parentheses separates symbols: one symbol edits the current slot; two split a one-slot bar (refused if a note crosses the middle, §4.1) or overwrite both slots of a split bar from the first; three or more are not committed (inline message "a bar holds at most two chords"). No spaces inside a symbol.
- Stored and shown **exactly as typed**; parsed on load. Unparseable → shown red. Empty slots allowed. `N.C.` / `NC` / `n.c.` = intentional silence (normal text; no scale on the hex).
- **Autosuggest**: while typing, a list under the field completes the last symbol: root (a lowercase root is capitalised) + known qualities starting with what follows it, chords already in the progression first, then common qualities (most common first); a bare `m` means minor (no `maj` until the `a`); case-insensitive fallback when nothing matches; `n` → `N.C.`; nothing after a `/`. Each row shows the symbol and its tones. ↑ / ↓ highlight; Enter / Tab / ⇧Tab commit the highlighted one (nothing highlighted → what was typed); a click takes it; the first Esc closes the list, the second cancels.
- A tooltip / menu on the chord label shows the interpretation (`Dm7 → D F A C · D Dorian`) and the scale override list.

### 4.3 Chord grammar — [Chord grammar and coverage](issues/005-chord-grammar-and-coverage.md)

- **Roots**: A–G (uppercase) with `#` `b` `♯` `♭`.
- **Qualities**: triads major, `m`, `dim`, `aug`/`+`, `sus2`, `sus4`, `5`; sixths `6`, `m6`, `6/9`, `m6/9`; sevenths `7`, `maj7`, `m7`, `m7b5`, `dim7`, `m(maj7)`, `7sus4`, `aug7`/`7#5`, `maj7#5`; extensions `9` `11` `13` (plain, `maj`, `m`), `add9`, `add11`; alterations `b5 #5 b9 #9 #11 b13` in any combination on 7th chords, bare or parenthesised (`7b9#11`, `7(b9,#11)`); `alt` = `7#5#9` (`7alt`, `alt7` synonyms); slash chords `X/bass` with any bass.
- **Synonyms**: minor `m - min mi`; maj7 `maj7 M7 ma7 Δ Δ7 △ △7`; half-dim `m7b5 -7b5 ø ø7 m7(b5)`; dim `dim ° o` (+7); aug `aug +` (`+7 7+ 7#5`); minor-major `m(maj7) mMaj7 -Δ7 mΔ`. `M` vs `m` case-sensitive, otherwise case-insensitive; root letter must be uppercase.
- **Rejected input**: polychords, `omit`, beyond 13; bare digits other than 5/6/7/9/11/13 (`C4` invalid); contradictions (same degree raised and natural, e.g. `C9#9`; conflicting 3rds). `b9`+`#9` valid; `#5`+`b13` valid (kept once); exact duplicates collapse.
- Output: root + interval list + optional bass, **no octave**.

## 5. Harmony and spelling

### 5.1 Chord tones — [Note classification](issues/006-note-classification.md)

Every tone named or implied: `9` → 1 3 5 ♭7 9 (`maj9`, `m9` likewise); `11` → 1 5 ♭7 9 11 (no 3rd); `m11` → 1 ♭3 5 ♭7 9 11; `13`, `maj13` → 1 3 5 7/♭7 9 13 (no 11); `m13` → full stack; `6/9` → 1 3 5 6 9; `add9`/`add11` → triad + that tone; alterations add their tone, an altered 5th replaces the natural 5th; a **slash bass is a chord tone**.

### 5.2 Slot scale

- No global key. Each slot's scale = the **first scale in its family's ranked list that contains every chord tone** (bass excluded); the same filtered list is the **scale override** menu. Override stored as a scale id relative to the root; kept across a chord change if still a candidate, otherwise silently dropped. A dot on the chord label marks an override.
- Ranked lists:
  - Major (3, no ♭7): Ionian → Lydian → Lydian augmented
  - Dominant (3 + ♭7): Mixolydian → Lydian dominant → whole-tone → Mixolydian ♭6 → half-whole diminished → Phrygian dominant → altered
  - Sus (no 3rd): Mixolydian → Ionian → Dorian
  - Minor (♭3, ♮5): Dorian → Aeolian → Phrygian → melodic minor → harmonic minor
  - Half-diminished: Locrian → Locrian ♮2
  - Diminished: whole-half diminished
  - Augmented (3 ♯5, no 7): whole-tone → Lydian augmented
- Fallback: valid chord but nothing fits (e.g. `C7sus4b9`) → **no scale**; the hex steps through the chord's own tones, entry allowed, the override menu is empty, and spelling uses the chord tones' lean ([Hex for slots without a scale](issues/038-hex-for-slots-without-a-scale.md); §8.4).
- **Classification** by pitch class, chord tone > scale tone > chromatic. Empty, unparseable and `N.C.` slots have no scale and no chord tones: notes are **not checked** there (any note may be written or played, none is marked out of scale; §8.4).

### 5.3 Note names — [Enharmonic spelling](issues/007-enharmonic-spelling.md)

- A note stores only its **MIDI pitch** (concert); names are derived per slot, in written pitch for the current instrument.
- Chord / scale tones: root + interval spelling with **at most one accidental** (double accidentals simplified; `Cb`, `Fb`, `E#`, `B#` kept). Octave follows the letter (`Cb4` = 59, `B#3` = 60). Chord-tone spelling wins over scale spelling (C7♯9's ♯9 = `D#`).
- Chromatics (only reachable as out-of-scale notes after a chord edit): the scale's **lean** (majority of accidentals in its names; no-scale slots count chord tones); tie / none → **default set** `C# Eb F# Ab Bb`. Grey slots → default set. No borrowing from neighbours.
- Typed spelling decides: `A#7` → `A# D E# G#`; a slash bass is named as typed.
- Written view: a written-view chord symbol is the concert symbol moved by the instrument interval, spelled by interval (at most one accidental; a double-accidental root is simplified — accepted edge, [Instrument view](issues/011-instrument-view.md)). Input in a non-Concert view is read as written.

## 6. The etude: melody, caret and entry

### 6.1 Data — [Melody data and schema](issues/023-melody-data-and-schema.md)

- One progression-level **melody**: ordered events `{ pitch, d }` (note, concert MIDI 0–127) or `{ d }` (rest). Durations `w h q e s`. No dots, no ties.
- Events never cross a slot boundary (guaranteed at entry; repaired on import). The melody may be shorter than the form; never longer.

### 6.2 Caret and overwrite editing — [Melody entry and caret (docked)](issues/028-melody-entry-and-caret-docked.md)

1. The **caret is a time position** in the form. The **active slot** is the slot containing it (at the very end of the form, the last slot); it remoulds the hex and drives spelling. An event's **owning slot** is the slot holding its start.
2. **Insert overwrites** the next *d* of time: covered events are removed; if the last one runs past, its leftover becomes rests. **Later music never moves.** No ripple anywhere.
3. **Doesn't fit → refuse**: if the latched length would pass the end of the caret's slot (or the form), the insert is refused; the length button flashes with a short message.
   - **Past the end, writing continues from the start**: writing the form's last note puts the caret back at time 0 (the first slot becomes active); the next note or rest overwrites from there as usual. A caret moved to the very end (→) also writes from time 0.
4. Inserting past the melody's end first **fills the gap with rests** (largest lengths that start on their own beat and stay inside a slot).
5. **Del** turns the note at the caret into a rest of the same length; **⌫** does that to the event before the caret and moves the caret to its start. On a trailing rest either key removes it (melody shortens); elsewhere a rest stays and ⌫ steps back over it.
6. **Length latch** `1`–`5` = w h q e s. **Rest latch** `R` / Rest toggles; while on, a length key (or button) sets the latch **and inserts a rest**; a hex pick turns Rest off and inserts the pitch.
7. **Caret placement**: clicking a note → caret at its start + plays it; clicking inside a note's span snaps to its start; clicking past the melody's end → the latch-length beat under the click. ← / → step event by event; past the melody's end they step by the latched length, up to the end of the form.
8. **Nudge**: ↑ / ↓ move the note just before the caret one step of its owning slot's scale; ⇧↑ / ⇧↓ an octave. The nudged note plays; the hex shows a dashed halo on that pitch's cell(s).
9. **Out-of-scale marks** only arise from chord / scale edits; notes are kept, never auto-deleted.
10. **Clear all** → melody `[]`, caret to start, one undo step, no confirm; chords, scales, title, instrument untouched.

### 6.3 Undo — [Progression library](issues/014-progression-library.md), [Melody entry and caret (docked)](issues/028-melody-entry-and-caret-docked.md), [Bar editing](issues/037-bar-editing.md)

⌘/Ctrl+Z, ⇧⌘/Ctrl+Z. Whole-progression snapshots (including the caret), ~100 steps, in memory, cleared on switching progression or reload. One step per: insert, delete, nudge, chord commit, every bar edit (append "+", insert before / after, duplicate, paste, split, merge, delete), title, time signature, bars per row, scale override, instrument switch, Concert clef, Clear all. Not undoable: caret moves, bar selection, Copy (clipboard only), mute, mode switches, *On arrival*.

## 7. Notation — [In-slot standard notation](issues/029-in-slot-standard-notation.md), [Clef policy](issues/032-clef-policy.md), [VexFlow notation spike](issues/040-vexflow-notation-spike.md), [Notation details](issues/039-notation-details.md)

Reference implementation: the throwaway [VexFlow spike prototype](prototypes/vexflow-spike/index.html).

### 7.1 Engraving

- One VexFlow `Stave` + `Voice` per slot (SVG backend, `Voice` in SOFT mode), fed by `eventsForSlot(melody, slotRange)`; durations map to `w h q 8 16` (`…r` for rests); keys from the **written** spelled names (`['bb/4']`), computed with tonal before engraving. Unfilled time in a slot is padded with `GhostNote`s. `Accidental.applyAccidentals` per slot (no key signature).
- **Beaming by beat** via `Beam.generateBeams(notes, { groups })`, never across a slot line (each slot is its own stave); rests break beams. Simple time (`x/4`, `x/2`): one group per quarter-note beat (2 eighths / 4 sixteenths). Compound time (`6/8`, `9/8`, `12/8`): groups of 3 eighths. No 4/4 beaming across beats 1–2.
- **Spacing is VexFlow's**, not strictly time-proportional. The caret sits at the actual note's x, time-interpolated only where no event starts.
- **Ledger-line headroom**: a fixed 3 ledger lines above and below the staff on every row, so every row has the same height (the chart-zoom fit uses it). Notes beyond that may overlap the chrome (they are out of range anyway).
- Chord symbol + scale label are React chrome above the stave, not VexFlow. **Label minimums** in every mode, Stand included: chord symbols ≥ **11px**, scale names ≥ **9px** (ellipsised in narrow slots).
- Redraw all visible slots on every edit. Draw only after `VexFlow.loadFonts` + `setFonts` and `document.fonts.ready` (fonts bundled, §2).
- Build gotcha: `Renderer.resize` writes inline width / height styles on the `<svg>`, so zoom must set `style.width/height` (or use a viewBox wrapper) after each resize.
- A slot with no events shows an empty stave. Click-to-select uses each note's `getSVGElement()`.

### 7.2 Marks

- **Out of scale** (pitch not in its owning slot's scale): notehead, stem and flag in red `#D62728` via `setStyle`, plus a thin red **ring** (SVG overlay) around the notehead so the mark doesn't rely on colour alone. Accidentals stay black.
- **Out of range** (written pitch outside the instrument's practical range): the whole note, ledger lines included, in light grey `#B5B5B5`. Never blocked.
- **Both**: grey with the red ring.
- **Hover tooltip** on a marked note gives the reason ("not in G altered" / "above B♭ trumpet range").
- Caret: a non-engraved vertical line + marker in the active slot; the event under the caret is tinted.

### 7.3 Clefs, key and time signatures

- **Clef fixed per instrument**: bass — trombone, double bass / bass guitar; treble — all others (guitar uses plain treble: its octave is in the written pitch). Never changes inside a progression; ledger lines beyond the staff.
- **Concert**: Treble / Bass choice (default Treble) shown next to the instrument picker only when Concert is selected; saved with the progression.
- Clef drawn at the **start of every row** in a narrow **clef gutter** outside the slots (slots keep equal width).
- **No key signature** (accidentals on notes). **Time signature** once, in the first slot.

## 8. Docked hex — [Docked hex pivot](issues/026-docked-hex-pivot.md), [Docked hex grid](issues/027-docked-hex-grid.md), [Left-slanted hex grid](issues/033-left-slanted-hex-grid.md)

### 8.1 Geometry

- Pointy-top hexes, **3 rows**. Each row sits **half a cell left** of the row below; the left edge is a diagonal climbing up-left.
- Cell (row r = 0…3 from the bottom, column c from the left) = scale step `t₀ + c + 2r` of the active slot's scale (ascending through octaves; scales with ≠ 7 notes step through all their notes). Right = next scale note; up-left = a third; up-right = a fourth. The left column is a chain of thirds.
- **Pitch anchor**: `t₀` = the lowest in-range tone of the active slot's scale at the bottom-left. When the active slot changes, notes stay in place; fills, rings and changed scale tones move.
- **Fit range**: let N = number of scale steps in the instrument's practical written range. Top row length `top = max(4, N − 4)`; row r has `floor(top − (2 − r)/2)` cells (bottom → top: top−1, top−1, top), so the right edge is roughly vertical. Cells are **regular hexagons**, the largest that fit the dock's width and height (never stretched). Grid centred. `Concert` = fixed C3–C6 view.
- Grey **out-of-range** cells appear only where the grid holds pitches outside the range (rare under Fit range); they are shown, not hidden, and inactive.

### 8.2 Cell styling (user theme)

- **Cells** tile edge to edge with no gaps (a honeycomb). Each cell is filled with its **degree colour**, the colour of its **spelled degree** (letter distance from the root, always 1–7; 8-note scales repeat a degree, 6-note scales skip one: G half-whole 1 2 3 3 4 5 6 7, C whole-tone 1 2 3 4 5 7, G altered 1 2 3 3 5 6 7):

  | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
  |---|---|---|---|---|---|---|
  | `#12EAEA` neon ice | `#FFD52E` school-bus yellow | `#EC7C25` harvest orange | `#390099` navy electric | `#9E0059` dark raspberry | `#5BB561` moss green | `#7B4A26` warm chestnut |

- **Colour shows on triad cells only.** Every other cell is a neutral grey (`#CDC9C0`, thin `#BDB8AD` outline, grey note name) and shows its degree colour only while lit (below).
- **Note name**: small, bold, above the ball (written pitch, no octave), in black or white, whichever reads better on the degree colour.
- **Ball**: a round, off-white sphere (a radial gradient lit from the top left) sitting at the cell centre with a soft drop shadow, carrying the **degree number** in black. All balls are one size (36% of the cell radius). **Sharps** sit to the right and **flats** to the left of the default spot (by 26% of the cell radius); a dark **socket** at the default spot shows behind them (naturals cover it). **Triad tones** (root, 3rd, 5th as spelled, altered 5ths included; a sus 2nd / 4th stands in for a missing 3rd) stand out by their always-on colour and a bolder degree number.
- **Out of range**: the whole cell faded to 35%, no shadow.
- **Transitions** when the hex changes (new active slot, Play arrival): cell colours fade, balls slide to their sharp / flat / natural spot with a slight settle, and sockets fade in / out — all ~180 ms, never blocking clicks; a new change takes over mid-way. Cells keep their place (keyed by row and column). Off under `prefers-reduced-motion`.
- **Duplicates**: hovering a cell, or clicking it (for ~600 ms), lights **every cell with the same pitch** (shows the octave): each shows its degree colour and gets a white glow round its ball. Nudge target: a dashed halo around the ball.
- No chromatic cells, but **chromatic entry**: small off-white buttons sit **on the border between two neighbouring cells of a row** (a step and the next step up), one for each pitch between them: one for a whole step, two for a wider gap (the semitone above the lower step and the one below the upper, higher on top), none for a half step; a row's outer edges count too. Each button shows its accidental (♯ / ♭ / ♮) **as the slot spells that pitch**, the way the note will be written — for suspensions, anticipations and other notes outside the slot scale. They show beside the hovered cell (both its borders) on desktop and always on touch screens (`hover: none`); a click (or Space / A over one) writes or auditions exactly like a cell click, and the cells holding that pitch light up while hovered. The note takes the slot's spelling and, if outside the scale, the usual out-of-scale mark (§7.2). Slots without a scale: §8.4.

### 8.3 Interaction

- Write: click = audition (concert) + insert at the caret with the length latch (turns Rest off). Play: click = audition only. Space (or A) does the same for the cell under the pointer.
- **Slot browser**: the `‹ Bar n · chord · scale ›` pill at the right end of the control header steps to the previous / next slot (wrapping; keys `<` / `>`): Write moves the caret to its start, Play arrives (with *On arrival*).
- Out-of-range (grey) cells do nothing; the unchecked hex (§8.4) is fully playable.

### 8.4 Slots without a scale — [Hex for slots without a scale](issues/038-hex-for-slots-without-a-scale.md)

| Active slot | Hex shows | Entry | Dock label | ▶ Chord / ▶ Scale / *On arrival* |
|---|---|---|---|---|
| `N.C.` | layout of the **nearest earlier slot with a scale** (else the next scaled slot after it; else Concert C major), **fully playable** (the border buttons reach the other pitches) | **any note**, not checked (no out-of-scale marks; ↑ / ↓ nudge by semitone) | "N.C.: notes not checked" | silent |
| Empty | as `N.C.` | as `N.C.` | "No chord yet: notes not checked" | silent |
| Unparseable | as `N.C.` | as `N.C.` | "Chord not recognised: notes not checked" | silent |
| Valid chord, **no scale fits** | steps through the **chord's own tones** (each cell = next chord tone up; same slant, 3 rows, Fit range, pitch anchor); triad cells coloured by spelled degree | normal | "No scale fits: chord tones only" | ▶ Chord normal; ▶ Scale plays the chord tones ascending over one octave; *On arrival* normal |

- Glossary names: the first three rows are the **unchecked hex**, the last the **chord-tones hex**.
- Clicking an empty / unparseable label focuses that slot's chord field. Notes in such a slot are kept and never marked out of scale; they are checked again once the slot has a chord.
- Play mode follows the same table (every row playable).

## 9. Audio — [Audition (etude)](issues/025-audition-etude.md), [Audition and chord preview](issues/012-audition-and-chord-preview.md), [Play mode](issues/035-play-mode.md)

- Triggers: hex cell click (or Space / A over it); notation note click; nudge; ▶ Chord / C; ▶ Bass / B (the chord's bass, slash bass if any, in concert octave 3); ▶ Scale / S / ⇧Space; Play-mode *On arrival* (Chord / Root note).
- Silent: caret moves, Rest insert, Clear all, chord / scale edits, instrument switch, delete, latch changes, mode switches.
- **Timbre**: plain sine. Single notes 10 ms attack, ~0.9 s exponential decay; chord preview lower gain per voice, ~1.6 s decay. Sounds overlap.
- **▶ Chord** voicing: root in concert octave 3; 3rd / 5th / 6th-or-7th close above; extensions (9, 11, 13, alterations) above the 7th; slash bass an octave below the root, not doubled; chord tones only.
- **▶ Scale**: the active slot's scale ascending one octave from the tonic (tonic in concert octave 3), ~150 ms apart. No-fit chord: its chord tones ascending over one octave.
- `N.C.` / empty / unparseable slots: ▶ Chord, ▶ Bass, ▶ Scale and *On arrival* silent (§8.4).
- Always **concert pitch**; instrument range not applied.
- **Mute**: speaker toggle in the control header, key `M`; a device setting. No volume slider.
- `AudioContext` created / resumed on the first user gesture.

## 10. Instruments — [Instrument view](issues/011-instrument-view.md), [Instrument practical ranges](issues/013-instrument-practical-ranges.md), [Clef policy](issues/032-clef-policy.md)

| id | Name | Written = concert + | Practical written range | Clef |
|---|---|---|---|---|
| `concert` | Concert | — | none (hex view C3–C6) | Treble / Bass (choice) |
| `flute` | Flute | unison | C4–C7 | treble |
| `violin` | Violin | unison | G3–E7 | treble |
| `trombone` | Trombone | unison | E2–B♭4 | bass |
| `vibraphone` | Vibraphone | unison | F3–F6 | treble |
| `bb-trumpet` | B♭ trumpet | M2 | F♯3–C6 | treble |
| `bb-clarinet` | B♭ clarinet | M2 | E3–A6 | treble |
| `bb-soprano-sax` | B♭ soprano sax | M2 | B♭3–F♯6 | treble |
| `bb-tenor-sax` | B♭ tenor sax | M9 | B♭3–F♯6 | treble |
| `eb-alto-sax` | E♭ alto sax | M6 | B♭3–F♯6 | treble |
| `eb-baritone-sax` | E♭ baritone sax | P8 + M6 | B♭3–F♯6 | treble |
| `f-horn` | F horn | P5 | C3–G5 | treble |
| `guitar` | Guitar | P8 | E3–E6 | treble |
| `bass` | Double bass / bass guitar | P8 | E2–G4 | bass |

- The instrument is a **progression setting** (saved, exported); the device remembers the last pick as the default for new progressions. Switching redraws the chart (written pitches, clef) and the hex.
- Chord labels, hex labels and notation show **written** pitch; storage and sound are concert.
- Out of range is **flagged, never blocked**. No user-adjustable ranges in v1.

## 11. Keyboard

| Key | Write | Play | Stand |
|---|---|---|---|
| `1`–`5` | length latch (w h q e s); with Rest on, also inserts a rest | — | — |
| `R` | Rest latch on / off | — | — |
| ← / → | caret by event (by latch past the melody end) | previous / next slot, wrapping | — |
| ↑ / ↓ (⇧) | nudge previous note by scale step (octave) | — | — |
| ⌫ / Del | as §6.2; with a bar selection, ⌫ deletes the bar(s) | — | — |
| click / ⇧click bar number | select bar / extend to a run | — | — |
| ⌘C / ⌘V / ⌘D | with a bar selection: copy / paste (replace) / duplicate | — | — |
| Space | **click whatever is under the pointer**, anywhere in the app (hex cell, border button, note, slot, header button, dropdown, field) — the full press, as with the mouse button; held repeats ignored | same | same (only what is clickable in Stand) |
| `A` (pointer over a hex cell or border button) | same as clicking it: write the note (plays) | audition the note | — |
| `S` / ⇧Space | ▶ Scale | ▶ Scale | — |
| `C` / `B` | ▶ Chord / ▶ Bass | ▶ Chord / ▶ Bass | — |
| `<` / `>` (or `,` / `.`) | previous / next slot, wrapping (caret to its start) | previous / next slot, wrapping | — |
| `M` | mute | mute | mute |
| `P` | → Play | → Write | — |
| `\` | → Stand | → Stand | back |
| ⌘Z / ⇧⌘Z | undo / redo | — | — |
| Enter / Tab / ⇧Tab | (in a chord field) commit and move to next / previous slot | | |

All shortcuts are ignored while a text field (title, chord symbol, time signature) has focus.

## 12. Storage, files and schema — [Saved data and JSON schema](issues/015-saved-data-and-json-schema.md), [Melody data and schema](issues/023-melody-data-and-schema.md), [Clef policy](issues/032-clef-policy.md)

### 12.1 Browser storage

- **localStorage**: one key per progression `honeycomb:progression:<id>` (whole progression JSON with `id` = `crypto.randomUUID()` and `updatedAt` ISO), plus `honeycomb:device`. No index key; the library parses every progression key.
- Write the open progression on every committed edit (same moment as an undo step) and on `visibilitychange` → hidden. No debounce.
- Other tabs (`storage` event): reload the open progression quietly if it changed elsewhere and nothing is pending (undo cleared); last write wins; the library list refreshes on any change.
- Quota error: keep the edit in memory; persistent banner "Can't save — storage full. Export and delete some progressions."; retry on the next edit.
- Corrupt key: skipped in the library, raw string kept, one line "1 progression couldn't be read".
- `navigator.storage.persist()` on the first edit each session.

### 12.2 Progression shape (v2)

```json
{ "title": "ii–V–I in C", "timeSignature": "4/4", "barsPerRow": 4, "instrument": "concert",
  "concertClef": "bass",
  "bars": [ [ { "chord": "Dm7" } ], [ { "chord": "G7" }, { "chord": "G7alt", "scale": "altered" } ] ],
  "melody": [ { "pitch": 62, "d": "q" }, { "d": "q" } ] }
```

- Slot: `chord` (concert symbol as typed; `""` empty; `"N.C."`), optional `scale` (override id).
- `concertClef`: optional, `"bass"` only; absent = treble; ignored unless `instrument` is `concert`. Added within v2 (older files lack it).
- Stable ids, never renamed or reused — instruments: §10; scales (18): `ionian dorian phrygian lydian mixolydian aeolian locrian locrian-nat2 melodic-minor harmonic-minor lydian-augmented lydian-dominant mixolydian-b6 altered phrygian-dominant whole-tone half-whole-diminished whole-half-diminished`.

### 12.3 Files

- Envelope `{ "app": "honeycomb", "v": 2, "kind": "progression", "progression": {…} }` (*Export one*, `‹title›.honeycomb.json`) or `{ "app": "honeycomb", "v": 2, "kind": "library", "exportedAt": "<ISO>", "progressions": [ … ] }` (*Export all*, `honeycomb-library-YYYY-MM-DD.json`, newest first). Files carry no ids, timestamps or device state. Pretty-printed, 2-space.
- **Import** accepts either kind, several files at once; **only adds** (fresh id, `updatedAt` = now, title clash → *"(2)"*); one toast with counts, new rows highlighted.
- Renamed from Improwiser: files with `"app": "improwiser"` import as if `"honeycomb"`, and `improwiser:*` storage keys move to `honeycomb:*` once on launch (an existing `honeycomb:*` key wins).
- Whole file rejected: invalid JSON, wrong / missing `app`, unknown `kind`, newer `v` ("Made by a newer Honeycomb — reload to update"). Bundle entry skipped: not an object or no `bars` list.
- **Repairs** (lenient): blank title → "Untitled"; bad `timeSignature` → `"4/4"`; `barsPerRow` outside 1–8 → 4; unknown instrument → `concert` (noted in the toast); bad `concertClef` → dropped; bar with 0 slots → one empty slot, > 2 → first 2; non-string `chord` → `""`; bad / non-candidate `scale` → dropped; 0 bars → 4 empty bars; melody: non-array → `[]`, events must have a valid `d` and an integer `pitch` 0–127 if present (else dropped), unknown keys ignored, then drop the suffix that runs past the form; an event **crossing a slot boundary** is shortened to the longest duration that fits before the slot ends, and the cut-off time becomes rests in the following slot (largest lengths that start on their own beat), so later events keep their timing — counted in the toast ("N notes shortened") ([Notation details](issues/039-notation-details.md)). Out-of-range pitches kept.

### 12.4 Versions and migration

- Integer `v` on the device key (speaks for all storage) and every file; current **2**. Pure `migrateNtoN+1` chain; storage migrated in memory on launch, written back, then device `v` bumped; imports run the same chain before validation. Newer storage → banner, read-only tab. No down-migration.
- `migrate1to2`: strip every slot's `notes`; `melody` = `[]` if missing.

### 12.5 Device key and demo

- `honeycomb:device` = `{ v, lastInstrument, muted, lastOpenId, lastBackupAt, reminderDismissedAt, seeded, playArrival }` (`playArrival`: `"silent" | "chord" | "root"`, default `"silent"`). Never exported.
- `lastOpenId` missing / dangling → newest; empty library → empty state.
- Demo: bundled [demo.honeycomb.json](examples/demo.honeycomb.json) (`Dm7 | G7 | Cmaj7 | Cmaj7`, Concert, short melody with a rest), imported once through the normal path, guarded by `seeded`. Deleting it is permanent.

## 13. Glossary

[CONTEXT.md](CONTEXT.md) is the source of truth for terms (Library, Envelope, Progression, Slot, Slot scale, Chord / scale tone, Etude, Melody event, Caret, Owning slot, Length / Rest latch, Nudge, Out-of-scale mark, Control header, Chart zoom, Write / Play, Stand mode, Docked hex, Fit range, Pitch anchor, Degree colour, Note sphere, Clef, Instrument view, …). Avoid "passing note".

## 14. Test tables the build must ship

1. **Chord grammar** — every quality, synonym, alteration and rejection row in §4.3 ([Chord grammar and coverage](issues/005-chord-grammar-and-coverage.md)).
2. **Default scale** — the worked list: `7b9`/`7#9` → half-whole; `7#11` → Lydian dominant; `7#5` → whole-tone; `7b13` → Mixolydian ♭6; `7b9b13` → Phrygian dominant; `7alt`/`7#9b13` → altered; `maj7#11` → Lydian; `m(maj7)` → melodic minor; plus one row per family ([Note classification](issues/006-note-classification.md)).
3. **Spelling** — Cdim7 `C Eb Gb A`; Gb7 `Gb Bb Db Fb`; Gb Locrian `Gb G A Cb C D Fb`; A7 / Bbm7 chromatics `D#` / `Gb`; C7#9 `D#`; `A#7`; `C/A#`; a grey slot ([Enharmonic spelling](issues/007-enharmonic-spelling.md)).
4. **Melody editing** — overwrite with leftover rests; refuse at slot end; gap-fill rests; Del / ⌫ on note, mid rest, trailing rest; nudge by scale step and octave; Clear all.
5. **Slicing** — `eventsForSlot` on split bars, non-4/4 time signatures, short melody.
6. **Hex layout** — row lengths, `t₀`, cell steps, spelled degree numbers (incl. 6- and 8-note scales) for Concert, trombone, violin and B♭ tenor sax over Dm7 / G7 / Cmaj7 / G7alt; anchor stability across a ii–V–I; the §8.4 cases (`N.C.` after / before a scaled slot and at the form start; a no-fit chord's chord-tone grid).
7. **Schema** — `migrate1to2`; every repair in §12.3 (incl. slot-crossing events shortened + rest-padded); newer-version refusal.
8. **Bar editing** — insert / delete / duplicate shift later events by whole bars; paste replaces incl. melody slice and refuses past the form end; split refused when a note crosses the middle; merge keeps the first chord; caret after deleting its own bar; minimum one bar.
9. **Beaming groups** — `4/4`, `3/4`, `2/2`, `6/8`, `12/8` with mixed eighths / sixteenths and rests.

## 15. Open items and build risks

**No open items** — every question raised at [Spec assembly](issues/036-spec-assembly.md) is settled (VexFlow adopted, beaming, bar editing, slots without a scale, import repair, mark styling).

Accepted risks:

1. **Hex-theme contrast**: a colour-blind check was ruled out of scope by the user ([Colour accessibility (docked hex)](issues/031-colour-accessibility-docked-hex.md)); light bands (yellow, orange, moss, ice) have low ring-to-centre contrast, mitigated only by the keyline.
2. **Notation spacing** is VexFlow's, not strictly time-proportional (§7.1); the caret follows actual note positions.
3. **Performance** was measured on laptop Chrome only (24 ms average full redraw at 32 bars); tablet Stand mode is unmeasured but read-only.

## 16. Out of scope for v1

From the map: full-line / progression playback, playhead, BPM, metronome, timed slot auto-advance; instrument sounds beyond a sine; piano strip and keyboard note entry; computer-keyboard grid play; per-slot hex palettes; a separate notation strip; dotted notes and ties; repeats and endings; path suggestion; accounts, backend, cloud sync; share-by-URL; per-slot sharps / flats switch; user-adjustable instrument ranges; library search / folders / tags / trash; a colour-blind pass on the hex theme.
