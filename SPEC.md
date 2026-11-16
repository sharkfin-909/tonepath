# Tonepath v1 — build spec

Compiled 2026-11-13 (updated the same day by [Spec update](issues/041-spec-update.md); kept current with the build through 2026-11-16, incl. the mode menu of [Mode menu](issues/068-mode-menu.md)) from the decisions on [Map: Tonepath v1 spec (as Honeycomb)](issues/001-map-improwiser-v1-spec.md). Each section cites the ticket(s) that hold the full reasoning; where an earlier decision was superseded, only the latest is stated here. Terms are defined in [CONTEXT.md](CONTEXT.md) (the glossary is normative). Example data: [examples/demo.tonepath.json](examples/demo.tonepath.json), [examples/rhythm-changes.tonepath.json](examples/rhythm-changes.tonepath.json).

---

## 1. Product

Tonepath is a desktop-first, static web app for writing **readable practice etudes** over a chord progression. The user types a chord symbol per **slot** on a bar grid; each slot shows its chord, its **slot scale** and a standard-notation fragment of the one continuous **melody**. A single **docked hex** below the chart is the only pitch-entry surface: diatonic steps to the right, diatonic thirds up-left, remoulded by the **active slot** (the slot under the caret). Length and Rest latches drive entry. The **instrument view** shows written pitch; storage and sound are always concert. Everything is saved to browser storage, with JSON export and import. Four modes (§3.0): **Tuner** (opens first) and **Improvise** listen to the player's instrument through the microphone; Improvise runs the form as a lead sheet with a **transport** (§3.7, §9.2); **Write etude** is note entry; **Read etude** plays the etude's form with a click and playhead.

Target devices: desktop / laptop first (1280×800 and up); readable on a tablet on a music stand (Read etude, 1024×768); usable on phones (§3.6).

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
| `hex` | The hex for a slot: grid (Fit range), cells (degrees, colours, spelling), border buttons, the dock for the active slot (§8). |
| `hexLayout` | Where everything on the docked hex sits for a dock size, and the **travel plan** for a slot change (§8.2). |
| `key` | The **Key** of a slot (its scale's notes), same key, steps between roots, the key's simple chords (§4.2, §8.2). |
| `chordSuggest` | Completions for the chord symbol being typed; root capitalisation (§4.2). |
| `chordEntry` | Chord entry as one step: written text → concert progression, splitting, the key's mode (§4.2). |
| `view` / `session` / `keymap` / `document` | The instrument view; the editing session reducer; the keyboard table; the progression document (undo, saving). |
| `schema` | Envelope, validation / repair, migrations `migrateNtoN+1`. |
| `audio` | `playNote`, `playChord`, `playScale`, `playRoot`, `playBass`; mute; the generated-impulse reverb (§9). The UI never touches Web Audio. |
| `listen/pitch` | YIN pitch detection, onset detection and the note tracker over raw samples (§9.2). |
| `leadSheet` | Improvise's lead sheet: a slot's scale spelled from its root, each note's degree and role (triad, guide, chord, scale) (§3.3). |
| `transport` | The transport besides its timing: the looped bars as a slot range, the slot after a slot within them, the form the metronome runs, the upcoming chord's targets (§3.7). |
| `metronome` / `metronomeRun` | Tempo and click sounds; the run on a clock — clicks ahead on the beat, chords announced on time, wrap or end (§3.7). |
| `micIntake` | The echo guard: a heard note start is the player's, or the app's own sound (§3.3, §9.2). |
| `pointerClick` | Space = a click under the pointer (§11). Not pure: dispatches DOM events. |

## 3. Screens and modes — [Mode menu](issues/068-mode-menu.md)

The mode menu of [Mode menu](issues/068-mode-menu.md) (2026-11-16) replaced the Explore · Practice · Write · Etude view dropdown and the Audio input switch.

### 3.0 The modes

The **Mode:** dropdown offers four modes, in this order. Each is a fixed set of panels; nothing is toggled per mode except **Hide hex** in Improvise.

| | **Tuner** (§3.8) | **Improvise** (§3.3) | **Write etude** (§3.2) | **Read etude** (§3.4) |
|---|---|---|---|---|
| Listen (mic) | on | on | off | off |
| Tuner bar | yes | yes | — | — |
| Header row 2, centre | — | form group, or the transport bar (§3.7) | editing pill | transport bar |
| Chart | the pane, empty | lead sheet: chords and scales, empty staves | chart with the etude, caret | the etude, Fit page, playhead |
| Docked hex | unchecked hex; lights what is played | stopped: current slot, lights what is played; running: the upcoming chord's tones and target rings | note input at the caret | none |
| Sound pill | yes (chord controls greyed) | yes | yes | yes |
| Hide hex | — | yes | — | — |

- **Opening**: every open or reload of a progression starts in **Tuner**, so the browser may ask for the microphone at once; while it asks, the tuner bar shows **allow the microphone to start listening**. Where the browser keeps audio suspended until a user gesture, the tuner bar shows **tap to start listening** until the first click or key.
- **The mode decides the mic**: Listen (§9.2) is on in Tuner and Improvise and off in Write etude and Read etude; there is no Audio input switch. Leaving Tuner or Improvise closes the mic.
- **Mic unavailable** (permission denied, no input device, insecure origin): the mode stays; the tuner bar says why (e.g. *Mic blocked: allow it in the browser's site settings*); hex clicks keep working.
- **Switching**: the dropdown, `[` / `]` (previous / next mode, no wrap) and `\` (Write etude ↔ Read etude; from Tuner or Improvise → Read etude) (§11). Switching modes is silent and always **stops the transport**.
- **Carried between modes**: the **current slot** — entering Improvise or Read etude starts on the caret's slot; entering Write etude puts the caret at the start of the current slot (Tuner keeps the current slot unseen). The **bar selection** and the **looped bars** are one selection, shared by Improvise, Write etude and Read etude. Tempo, click sound and Loop are device settings (§12.5), the same for both transports.

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

- **Control header** — a bar across the top, so the hex gets the full width, in the hex panel's dark background (`--dock-bg`) with light text and an inner glow. **Two rows** (a grid): row 1 = the app's name, **TONEPATH** (the wordmark: Firjar, bold, letter-spaced, 21px), on the left, the **sound pill** (mute · ▶ Chord / Bass / Scale · *On arrival*, labelled **Audio on chord**; Thin, 12px) **centred**, in every mode (§3.0); row 2 = on the left, under TONEPATH, the ← Library pill and, stacked, the **etude name** (inline edit; blank shows a muted *Etude name*) above the title (small, Thin; inline rename); **centred**, under the sound pill, the mode's own group (§3.0): in Write etude the **editing controls in a pill** (like the sound pill): the note lengths and Rest (note / rest icons with their keys 1–5 / R; names in tooltips), time signature, bars per row, **nudge ↓ ↑** (the note at the caret, a scale step; ⇧-click a semitone), **step ‹ ›** (stepwise playback, §11), undo / redo (icons), **Clear ▾** (§6.2 item 10); in Improvise the **form group** (§3.3) and the **transport bar** (§3.7); in Read etude the transport bar; in Tuner nothing. Every control with a keyboard shortcut names it in its tooltip. **Dropdowns** are the app's own (`rail/Dropdown.tsx`), never the browser's: a pill button showing the value opens a dark card under it, the current value marked (accent bar, ✓); ↑ / ↓ / Home / End move, a letter jumps, Enter / Space choose, Esc closes, a click outside closes; keys in a menu never reach the chart. *Audio on chord*, bars per row, the click sound, clef, instrument and Mode all use it (Mode with a description per option). **Tooltips** are the app's own: a small dark label under the control (above it near the window's bottom), ~300 ms after the pointer rests on it; then, **aligned right**, a pill with the **clef** (Concert only, §7.3) first, then **Ins:** the instrument picker (§10). The **mode panel** sits **top right** (row 1, right), in a pill like the sound pill: always visible — **Mode:** and the current mode, a button opening the **mode menu** (no tooltip): a dark card under the pill listing *Tuner* (on open) · *Improvise* · *Write etude* · *Read etude*, each with its name, tags for what it uses or edits (Tuner: *mic*; Improvise: *mic*, *transport*, *edit tonality* — its chords and scales; Write etude: *edit*; Read etude: *transport*) and a one- or two-line description of what it is for; the current mode is marked (accent bar, ✓); a footer names the keys (`[` / `]`, `\`). ↑ / ↓ move, Enter / Space choose, Esc closes; a click outside closes it; keys in the menu never reach the chart. Narrow screens: §3.6. **Groups** — every outlined pill (sound, editing, form, transport, mode, Ins:) shares one look (28px, fully rounded, light outline; CSS tokens `--group-*`; all text **lowercase**, except note names), as do the hex panel's dark **wells** (tuner, input level; `--well-*`). Each group **flashes** in the grid-glow colour when it appears and whenever one of its controls is used (off under `prefers-reduced-motion`). After any header button click or dropdown choice, **focus returns to the hex grid**, so Space and the other keys never act on the last-clicked control; the inline title / time-signature / tempo fields keep focus while editing. No toolbar strip between chart and hex. **Hide hex** (Improvise only) — a small button absolutely positioned at the bottom right of the screen (over the hex panel) hides the hex panel so the chart takes the whole screen; it then reads **Show hex** (dark on the chart). Remembered on the device (`hexHidden`); the other modes ignore it (Tuner and Write etude always show the hex, Read etude never).
- **Chart** — rows of `barsPerRow` bars; each row has a **clef gutter** at its left (§7.3), then the slots at equal, time-proportional width. Each **slot is a card**: a light rounded border, a gap between slots (`SLOT_GAP_PX`) and between rows (`ROW_GAP_PX`, also under the last row); the **bar line** sits in the middle of the gap after a bar's last card, and the bar's **trash can** sits outside the cards, in the row gap under the bar's end (sized with the chord label). Bar lines at the end of each bar only, the **full height of the slot** (2.5px); **no line between two chords in a bar** (the chord names mark the change). Bar numbers sit **just above the stave's top line**, at the start of each bar. In Write etude, each bar number carries a **⋯ bar handle**; in Write etude and Improvise (transport stopped), each bar has a **trash can** at its bottom right and a **"+"** follows the last bar (§4.1).
- **Key pill** — at the **top right of each slot** (left of the "+" on the last), the slot's **key** (CONTEXT.md) by its parent scale: a mode of a major key → its tonic (`C`, `B♭`), of melodic / harmonic minor → its tonic and `mel` / `harm`, whole-tone and diminished → `whole-tone`, `dim`; no scale → none (`keyName` in `key.ts`). Sized with the scale label. **Key mates**: every slot with the same notes as the current slot (Write etude: the caret's; Improvise and Read etude: the playhead's) lights its **key pill** solid **warm yellow** (`#FFDD57`, softer than degree 2's `#FFD52E`) with dark text, in every mode (unlit pills: a faint yellow outline and tint); the slot itself is not tinted. Pill text is 1.3× the scale label, bold; every pill is at least as wide as an `A mel` pill (3.6em), the name centred.
- **Chart zoom** — automatic: scale so every row fits the chart area (cap ~1.4× on short forms), never below a readable floor (staff line gap ≈ 5px). Every row has the same height (fixed ledger-line headroom, §7.1); chord / scale labels keep their minimum sizes (§7.1) at any zoom. Below the floor the chart stops shrinking and **scrolls vertically**, keeping the caret's row (or, in Improvise, the current slot) in view. No manual zoom control.
- **Split** — the chart takes only the height its rows need (padding above; the stave's own ledger-line headroom is the gap below), up to half the space under the header; the **hex takes everything else**, with 24px padding around the grid. No divider, no setting. In Tuner the chart pane keeps that height, **empty** (§3.8).

### 3.2 Write etude

Hex picks are recorded at the caret (§6). The mic is off (no writing by playing). The hex is always shown (no Hide hex). No transport and no tuner bar; **stepwise playback** (§6.2) is the way to hear the etude.

- Editing as §4 and §6: the editing pill (§3.1), the ⋯ bar handles, the trash cans and "+".
- *Formerly* **Write**; **Explore** (Write that writes nothing) is dropped — Improvise with the transport stopped, and Tuner, cover it.

### 3.3 Improvise — [Play mode](issues/035-play-mode.md), [Mode menu](issues/068-mode-menu.md)

Playing over the form, from a **lead sheet**: Listen on, the tuner bar, the transport (§3.7). The form moves on **only with the transport** (time); there are no note-driven advance rules. *Formerly* Practice, built on the old Play mode's behaviour (Play is not offered).

- **Lead sheet**: no stave — in its place each slot shows a **little hex of its scale**, spelled from the root: rows `[1 2]` `[3 4]` `[5 6 7]` from the bottom, each half a cell left of the one below (the docked hex's geometry: right = the next step, up-left = a third); other sizes pair up from the bottom with the top row taking the rest (whole-tone `[2][2][2]`, diminished `[2][2][4]`; a chord no scale fits: its chord tones; no chord: nothing). Coloured as the docked hex: triad tones and the guide tone (outlined) in their **degree colour**, the rest neutral taupe; the note name in each cell. Each Improvise slot is **three columns**: the chord, scale and bar number on the left; the hex in the **middle**, centred (equal side columns) at the stave's height, vertically centred; the key pill in the right column. Slots keep their usual height (labels + stave), so rows and the zoom don't change; in narrow (split) slots long chord and scale names ellipsise. The written melody and the clef are hidden; bar lines and chords stay; rows keep the stave's height (`leadSheet.ts`). The caret is hidden; the **current slot** gets a solid full-width highlight in a colour distinct from Write etude's active-slot tint.
- **Editing the lead sheet** (transport stopped): **chord and scale entry** exactly as in Write etude (clicking a chord name or an empty slot's `+` edits it — autosuggest, Tab / Enter to move on — and makes that slot current; the scale name opens its scale menu); the **form group** in the header — time signature, bars per row, undo / redo; the **"+"** after the last bar and each bar's **trash can**. No ⋯ bar menu, no note lengths, Rest, nudge, step or Clear (those are Write etude's). While the transport **runs**, the form group, "+" and trash cans are hidden and chord / scale entry is off, so the form never changes under the playhead.
- **Bar numbers** pick the **looped bars** (§3.7).
- **Transport stopped**: **← / →** (and `<` / `>`) move to the previous / next **slot** (a split bar = two stops), **wrapping**; clicking a slot makes it current. ↑ / ↓ do nothing. The hex shows the **current slot's scale**, remoulding on arrival exactly as in Write etude (pitch anchor kept, travel, the no-scale rules of §8.4), and **lights the notes played** (mic or hex) like a hovered cell. Hex picks (click, Space, `A`) audition only.
- **Transport running** (§3.7): time moves the form on; the hex shows the **upcoming chord's chord tones** with the dashed **target rings** (at the last chord, the first chord's), with **no slot-change motion** (no travel, no fades) — each chord lands at once. Notes played (mic or hex) **sound but do not light** the hex.
- **On arrival** (*Audio on chord*): Silent (default) · Chord · Root note · Bass note · Bass note + chord, a device setting. Running, it sounds as each chord begins (the starting chord too). Stopped, arriving by hand is silent and the sound waits for the **first note played** in the slot (hex or mic), sounding with it. The mic hears it, so an **echo guard** ignores everything for 250 ms after it starts and, while it rings (chord ~3.2 s, root / bass note ~1.1 s), heard notes matching its pitches (or an octave off). Headphones avoid the question.
- **Hide hex** is offered here (only): the lead sheet takes the screen.
- Chart scrolls to keep the current slot in view.

### 3.4 Read etude (formerly Etude view, Stand)

Reading and playing the written etude, e.g. on a tablet on a music stand: the chart **Fit page** (every bar on one screen, auto-zoomed, no floor; 32 bars at 4/row fit on 1024×768), the transport, the sound pill. No hex, no tuner bar, no mic.

- **Header**: the normal two rows (§3.1) — row 1 the wordmark, the full sound pill and the mode panel; row 2 ← Library and the names on the left, the **transport bar** centred, Ins: on the right.
- **Transport** (§3.7): click and **playhead** — the current slot highlighted as time passes; **Audio on chord** is the accompaniment (Silent · Chord · Root note · Bass note · Bass note + chord), sounding as each chord begins. The written melody is not played (a later, separate toggle).
- **Stopped**: clicking a slot makes it current (moves the playhead there; silent); clicking a notation note **auditions** it and moves the playhead to its slot; ▶ Chord / Bass / Scale (and C, B, S) preview the current slot; bar numbers pick the looped bars. Nothing edits: no caret, no chord or scale entry, no bar handles, "+" or trash.
- **Running**: clicks on the chart do nothing (safe from stray taps on a stand).
- `\` returns to Write etude; the Mode dropdown goes to any mode.

### 3.7 Transport — [Mode menu](issues/068-mode-menu.md)

The **transport bar** (Improvise, Read etude) runs the form in time — it *is* the metronome; there is no metronome switch and no note-driven advance. Built on the metronome run (`metronomeRun.ts`) of the old Practice mode.

- **Controls**: **tempo** (bpm, 30–300, default 100; type freely, Enter or leaving the field applies it, Esc cancels, ↑ / ↓ step by one) · the **click sound** (Click · Hi-hat · Cowbell, synthesised) · **rewind** (to the first chord) · **start / stop** · **Loop** (default on). Tempo, sound and Loop are device settings shared by both modes.
- **Running**: each chord lasts its length at the tempo; *Audio on chord* sounds as each one begins (the starting chord too). It clicks on every beat of the time signature (its unit: a quarter in 4/4, an eighth in 6/8), the bar's first beat accented; clicks are scheduled ahead on the audio clock. It starts from the current slot; rewind while running carries on from the first chord; at the form's end it wraps (Loop) or stops back at the first chord.
- **Stopped**: the current slot is moved by hand (§3.3, §3.4). Switching modes, or leaving the chart screen, stops it.
- **Looped bars** — in Improvise and Read etude the **bar numbers** stay visible (no ⋯ menu): click one to loop just that bar, **Shift-click** another bar (its number or anywhere in it) to loop a run, and click any looped bar again (or press **Esc**) to go back to the whole form. Picking bars that don't include the current slot moves to the first picked bar. The looped bars are the **bar selection** (§3.0): bars selected in Write etude are looped, and looped bars are the selection back in Write etude. Loop goes round the picked bars, the upcoming-chord targets wrap to their first chord, and without Loop the transport stops on their first chord. Rewind goes to their first chord. The looped bars are drawn as **one band** (top and bottom edges throughout; closed and rounded only at the loop's start and end, open where it wraps to the next row) with **repeat signs** — `[:` on its first bar line, `:]` on its last — and a small **× beside the end repeat** that stops looping (back to the whole form). Ways out of a loop: that ×, Esc, clicking a looped bar number again, or the transport bar's **bars 2–3 ×** chip after Loop. Write etude shows the same bars as a plain selection outline.

### 3.8 Tuner — [Mode menu](issues/068-mode-menu.md)

The mode every progression opens in: the tuner and the hex, for warming up, long tones and scales.

- **Layout** as every mode, so nothing moves on a switch: the header (row 2: ← Library and the names, Ins:; nothing centred), the **chart pane empty** at the height the progression's chart would take, the **tuner bar** where it sits in Improvise (§9.2), and the docked hex below.
- **Hex**: the **unchecked hex** (§8.4) — there is no active slot — lighting every note played (mic or hex click), chromatic notes included (via the border buttons). Hex picks audition.
- **Sound pill**: mute stays live; ▶ Chord / Bass / Scale and *Audio on chord* are shown **greyed** (no chord).
- The tuner shows the heard note whether or not it sits in the hex's cells.

### 3.6 Responsive layout

- **Wide (> 900px)**: the header is two rows (§3.1), the sound pill centred on row 1.
- **≤ 900px**: three rows — title (left) and mode panel (right) spread apart as on wide screens; then the sound pill, **centred**; then the mode's group (editing pill, form group, transport bar), **centred**. Groups wrap within their row (centred); "Ins:" stays with its picker.
- **Phones (≤ 640px)**: the title shrinks with an ellipsis; the sound pill may wrap inside itself; the hex is **always Linear** (8 large cells, octave switch) and the Grid toggle is hidden — the saved Grid setting is untouched and returns on a wider screen.
- **Touch screens**: header buttons are at least 34px tall; the octave switch has wider targets; border buttons always show (§8.3).

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
- **Controls (Write etude; Improvise in part, §3.3)**: each bar number is a small **⋯ bar handle** (visible on the active bar and on hover) opening the **bar menu**: Insert before · Insert after · Duplicate · Copy · Paste · Split / Merge · Delete. Clicking a bar number **selects** that bar (clicking a selected bar again, or Esc, deselects); **Shift-click anywhere in a bar** (its number, stave or chord) extends to a run from the selected bar — or, with nothing selected, from the caret's bar — without moving the caret or selecting text. With a bar selection, ⌘C / ⌘V / ⌘D / ⌫ copy / paste / duplicate / delete (§11). A **"+"** after the last bar appends an empty bar. A **trash can** under each bar's end (outside its cards, in the row gap) deletes it (the whole selection when the bar is in one; not shown when only one bar is left); faint until the bar is hovered or current. In Improvise only the "+" and trash cans show (transport stopped) and bar numbers pick the looped bars; none of these show in Read etude or Tuner.
- **Caret** moves with the music (stays on the same note). If its own bar is deleted, it goes to the start of the bar now in that position (or the end of the form).

### 4.2 Chord entry

- Click a slot's chord label and type. Enter / Tab → next slot, Shift+Tab → previous. While a text field has focus, global shortcuts are ignored.
- **Clear a chord**: a small **×** after the chord label (faint until the slot is hovered or current, like the bar's trash can; sized with the label so it stays clickable at any zoom) empties the slot — its chord and any scale override — in one undoable step; notes stay (they are then unchecked). Wherever chords are editable: Write etude, and Improvise while the transport is stopped.
- Whitespace outside parentheses separates symbols: one symbol edits the current slot; two split a one-slot bar (refused if a note crosses the middle, §4.1) or overwrite both slots of a split bar from the first; three or more are not committed (inline message "a bar holds at most two chords"). No spaces inside a symbol.
- Stored and shown **exactly as typed**; parsed on load. Unparseable → shown red. Empty slots allowed. `N.C.` / `NC` / `n.c.` = intentional silence (normal text; no scale on the hex).
- **Root letters are capitalised as typed**: the first letter of each symbol and the letter after a `/` become A–G (`d` → `D`, `g7/b` → `G7/B`); a `b` straight after a root stays a flat (`bbm7` → `Bbm7`); qualities stay as typed. The caret doesn't move.
- **Autosuggest**: while typing, a list under the field completes the last symbol: root (a lowercase root is capitalised) + known qualities starting with what follows it, chords already in the progression first, then common qualities (most common first); a bare `m` means minor (no `maj` until the `a`); case-insensitive fallback when nothing matches; `n` → `N.C.`; nothing after a `/`. **The key's simple chords**: an empty field lists, at once, the diatonic triads of the key of the nearest earlier slot whose scale is a mode of a major key (G7 → G Mixolydian → key of C), spelled as that scale spells them, **minus the triad on that slot's root** (the other 6: after G7 → C Dm Em F Am B°); no such slot (e.g. bar 1) → all 7 of **C major**; a typed root lists the key's chord on it first (`D` → `Dm`). **The key holds**: committing one of the key's chords (picked from the list, or typed exactly as listed) also sets the **key's mode on it** as the slot scale (C → Ionian, Dm → Dorian, Em → Phrygian, F → Lydian, G → Mixolydian, Am → Aeolian, B° → Locrian) — one undo step with the chord. Each row shows the symbol and its tones. ↑ / ↓ highlight; Enter / Tab / ⇧Tab commit the highlighted one (nothing highlighted → what was typed); a click takes it; the first Esc closes the list, the second cancels.
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
  - Major (3, no ♭7): Ionian → Lydian → Lydian augmented (a plain triad, no 7th, also → **Mixolydian**, last)
  - Dominant (3 + ♭7): Mixolydian → Lydian dominant → whole-tone → Mixolydian ♭6 → half-whole diminished → Phrygian dominant → altered
  - Sus (no 3rd): Mixolydian → Ionian → Dorian
  - Minor (♭3, ♮5): Dorian → Aeolian → Phrygian → melodic minor → harmonic minor
  - Half-diminished: Locrian → Locrian ♮2
  - Diminished: whole-half diminished (a plain diminished triad, no 7th, also → **Locrian**, last)
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
8. **Nudge**: ↑ / ↓ move the note **at the caret** (the one it sits on; at the end of the melody, the last note) **one step of its owning slot's scale** (diatonic; a slot without a chord: a semitone); ⇧↑ / ⇧↓ **a semitone** (chromatic); ⌥↑ / ⌥↓ an octave. The editing pill's ↓ ↑ buttons do the same (⇧-click: a semitone). The nudged note plays; the hex shows a dashed halo on that pitch's cell(s).
9. **Out-of-scale marks** only arise from chord / scale edits; notes are kept, never auto-deleted.
10. **Clear ▾** (header, Write etude): a menu with **Clear notes** → melody `[]`, caret to start, one undo step, no confirm (chords, scales, title, instrument untouched); and **Clear all…** → asks in the menu ("Clear all chords, scales and notes?" Clear all / Cancel), then empties every chord, scale override and note — bars and splits, title, time signature and instrument stay — caret to start, one undo step.

- **Stepwise playback** (Write etude): `` ` `` (or `~`) plays the melody **note by note** from the caret — each press sounds the event at the caret (rests silent; *On arrival* when the event starts its slot) and moves the caret to its end; after the last event the next press starts again at bar 1. Nothing is recorded.

### 6.3 Undo — [Progression library](issues/014-progression-library.md), [Melody entry and caret (docked)](issues/028-melody-entry-and-caret-docked.md), [Bar editing](issues/037-bar-editing.md)

⌘/Ctrl+Z, ⇧⌘/Ctrl+Z. Whole-progression snapshots (including the caret), ~100 steps, in memory, cleared on switching progression or reload. One step per: insert, delete, nudge, chord commit, every bar edit (append "+", insert before / after, duplicate, paste, split, merge, delete), title, time signature, bars per row, scale override, instrument switch, Concert clef, Clear all. Not undoable: caret moves, bar selection, Copy (clipboard only), mute, mode switches, *On arrival*.

## 7. Notation — [In-slot standard notation](issues/029-in-slot-standard-notation.md), [Clef policy](issues/032-clef-policy.md), [VexFlow notation spike](issues/040-vexflow-notation-spike.md), [Notation details](issues/039-notation-details.md)

Reference implementation: the throwaway [VexFlow spike prototype](prototypes/vexflow-spike/index.html).

### 7.1 Engraving

- One VexFlow `Stave` + `Voice` per slot (SVG backend, `Voice` in SOFT mode), fed by `eventsForSlot(melody, slotRange)`; durations map to `w h q 8 16` (`…r` for rests); keys from the **written** spelled names (`['bb/4']`), computed with tonal before engraving. Unfilled time in a slot is padded with `GhostNote`s. `Accidental.applyAccidentals` per slot (no key signature).
- **Beaming by beat** via `Beam.generateBeams(notes, { groups })`, never across a slot line (each slot is its own stave); rests break beams. Simple time (`x/4`, `x/2`): one group per quarter-note beat (2 eighths / 4 sixteenths). Compound time (`6/8`, `9/8`, `12/8`): groups of 3 eighths. No 4/4 beaming across beats 1–2.
- **Spacing is VexFlow's**, not strictly time-proportional. The caret sits at the actual note's x, time-interpolated only where no event starts.
- **Ledger-line headroom**: a fixed 3 ledger lines above and below the staff on every row, so every row has the same height (the chart-zoom fit uses it). Notes beyond that may overlap the chrome (they are out of range anyway).
- Chord symbol + scale label are React chrome above the stave, not VexFlow. **Label minimums** in every mode, Read etude included: chord symbols ≥ **11px**, scale names ≥ **9px** (ellipsised in narrow slots).
- Redraw all visible slots on every edit. Draw only after `VexFlow.loadFonts` + `setFonts` and `document.fonts.ready` (fonts bundled, §2).
- Build gotcha: `Renderer.resize` writes inline width / height styles on the `<svg>`, so zoom must set `style.width/height` (or use a viewBox wrapper) after each resize.
- A slot with no events shows an empty stave. Click-to-select uses each note's `getSVGElement()`.

### 7.2 Marks

- **Out of scale** (pitch not in its owning slot's scale): notehead, stem and flag in **orange** `#C8650A` via `setStyle` (colour only; the hover tooltip gives the reason). Accidentals stay black.
- **Out of range** (written pitch outside the instrument's practical range): the whole note, ledger lines included, in light grey `#B5B5B5`. Never blocked.
- **Both**: shown as out of range (light grey); the tooltip names both.
- **Hover tooltip** on a marked note gives the reason ("not in G altered" / "above B♭ trumpet range").
- Caret: a non-engraved vertical line + marker in the active slot; the event under the caret is tinted.

### 7.3 Clefs, key and time signatures

- **Clef fixed per instrument**: bass — trombone, cello, double bass / bass guitar; alto — viola; treble — all others (guitar uses plain treble: its octave is in the written pitch). Never changes inside a progression; ledger lines beyond the staff.
- **Concert**: Treble / Bass choice (default Treble) shown next to the instrument picker only when Concert is selected; saved with the progression.
- Clef drawn at the **start of every row** in a narrow **clef gutter** outside the slots (slots keep equal width).
- **No key signature** (accidentals on notes). **Time signature** once, in the first slot.

## 8. Docked hex — [Docked hex pivot](issues/026-docked-hex-pivot.md), [Docked hex grid](issues/027-docked-hex-grid.md), [Left-slanted hex grid](issues/033-left-slanted-hex-grid.md)

### 8.1 Geometry

- Pointy-top hexes, **3 rows**. Each row sits **half a cell left** of the row below; the left edge is a diagonal climbing up-left.
- Cell (row r = 0…2 from the bottom, column c from the left) = scale step `t₀ + c + 2r` of the active slot's scale (ascending through octaves; scales with ≠ 7 notes step through all their notes). Right = next scale note; up-left = a third; up-right = a fourth. The left column is a chain of thirds.
- **Pitch anchor**: `t₀` = the lowest in-range tone of the active slot's scale at the bottom-left. When the active slot changes, notes stay in place; fills, rings and changed scale tones move.
- **Fit range**: let N = the number of steps a **7-note scale** has in the instrument's practical written range (`floor(span × 7 / 12) + 1`, span in semitones: 22 for Concert C3–C6) — the same for **every key and scale**, so the grid's shape and cell size never change from slot to slot; only the pitches at its ends do (6- and 8-note scales reach a little past / short of the range's top). The chord-tones hex (§8.4) uses its own step count instead. Top row length `top = max(4, N − 4)`; row r has `floor(top − (2 − r)/2)` cells (bottom → top: top−1, top−1, top), so the right edge is roughly vertical. Cells are **regular hexagons**, the largest that fit the dock's width and height (never stretched). Grid centred. `Concert` = fixed C3–C6 view.
- Grey **out-of-range** cells appear only where the grid holds pitches outside the range (rare under Fit range); they are shown, not hidden, and inactive.

### 8.2 Cell styling (user theme)

- **Cells** tile edge to edge with no gaps (a honeycomb). Each cell is filled with its **degree colour**, the colour of its **spelled degree** (letter distance from the root, always 1–7; 8-note scales repeat a degree, 6-note scales skip one: G half-whole 1 2 3 3 4 5 6 7, C whole-tone 1 2 3 4 5 7, G altered 1 2 3 3 5 6 7):

  | 1 | 2 | 3 | 4 | 5 | 6 | 7 |
  |---|---|---|---|---|---|---|
  | `#12EAEA` neon ice | `#FFD52E` school-bus yellow | `#EC7C25` harvest orange | `#390099` navy electric | `#9E0059` dark raspberry | `#5BB561` moss green | `#7B4A26` warm chestnut |

- **Colour shows on triad cells (and a quartad's guide tone) only.** Every other cell is a neutral warm taupe (`#BFAFA2`, thin `#A39385` outline) and shows its degree colour only while lit, as a glow inside its edge (below).
- **Octave number**: every **C** cell shows its octave under the ball in white as `oct 4` (middle C; written pitch), so the Cs can be told apart — e.g. the first and last cell of a Linear row. It belongs to the cell, so it stays put while the balls travel.
- **Note name**: small, bold, above the ball (written pitch, no octave), always **black with a little white glow**, on every cell colour.
- **Ball**: a round sphere, a radial gradient from a highlight in the cell's **degree colour** (top left; the unchecked hex, with no degrees, a warm cream `#FFE6D0`) to a dark brown rim (`#44372F`); degrees 2, 4, 6 and 7 are inverted (a white highlight to the degree colour as the sphere), sitting at the cell centre with a soft drop shadow, carrying the **degree number** in white (with a soft dark edge). All balls are one size (36% of the cell radius). **Sharps** sit to the right and **flats** to the left of the default spot (by 26% of the cell radius); a dark **socket** at the default spot shows behind them (naturals cover it). **Triad tones** (root, 3rd, 5th as spelled, altered 5ths included; a sus 2nd / 4th stands in for a missing 3rd) stand out by their always-on colour and a bolder degree number.
- **Out of range**: the whole cell faded to 35%, no shadow.
- **Transitions** when the hex changes (new active slot, an arrival in Improvise with the transport stopped; none while it runs): **balls travel with their degree numbers** — **only when the key stays the same** (the same notes: C → G7, Dm7 → G7): the degree pattern slides **horizontally** along the rows **right** when the new root is **up to a 4th above** the old one (F Lydian → G7: 1 cell; Dm7 → G7 and G7 → C: 3), **left** for anything further up — a 5th or more — i.e. down to it, so a move and its return mirror each other (G7 → Dm7: 3 left; C → G7: 3 left; G7 → F: 1 left; C → Am: 2 left), 450 ms, ease-in; balls with no source on the old row are drawn and **slide in with the rest** from just off the grid. **The cell colours travel with them**, identically: a temporary copy of the coloured (triad) cells slides with the balls, clipped to the grid, between the cells' fill and their names / sockets; the real cells show plain while it moves and take the colour back as it lands. Nothing travels on a key change, when the root stays, or when either slot has no chord. Balls sit in a layer above the cells (clicks pass through to the cells). Cell colours fade, balls slide to their sharp / flat / natural spot with a slight settle, and sockets fade in / out — all ~180 ms, never blocking clicks; a new change takes over mid-way. Cells keep their place (keyed by row and column). Off under `prefers-reduced-motion`.
- **Guide tones**: in a **quartad** (a chord with a 7th or 6th), the cells holding that **7th or 6th** show their **degree colour** like triad cells — its pull in the chord. Extensions (9, 11, 13) and altered tones never glow; triads have none.
- **Duplicates**: hovering a cell, or clicking it (for ~600 ms), lights **every cell with the same pitch** (shows the octave): each gets a bright green outline and glow spilling past the cell edge (a lit ♯ / ♭ / ♮ border button's highlight turns the same green); a cell that is neutral at rest (not a chord tone or guide tone) keeps its neutral fill, its degree colour glowing **inside the cell edge**. Nudge target: a dashed halo around the ball.
- No chromatic cells, but **chromatic entry**: small spheres like the balls sit **on the border between two neighbouring cells of a row** (a step and the next step up), one for each pitch between them: one for a whole step, two for a wider gap (the semitone above the lower step and the one below the upper, higher on top), none for a half step; a row's outer edges count too. Each button shows its accidental (♯ / ♭ / ♮) **as the slot spells that pitch**, the way the note will be written — for suspensions, anticipations and other notes outside the slot scale. They show beside the hovered cell (both its borders) on desktop and always on touch screens (`hover: none`); a click (or Space / A over one) writes or auditions exactly like a cell click, and the cells holding that pitch light up while hovered. The note takes the slot's spelling and, if outside the scale, the usual out-of-scale mark (§7.2). Slots without a scale: §8.4.

### 8.3 Interaction

- Write etude: click = audition (concert) + insert at the caret with the length latch (turns Rest off). Tuner and Improvise: click = audition only (and lights the cell, §3.3, §3.8). Space (or A) does the same for the cell under the pointer.
- **Browsing slots**: keys `<` / `>` (or `,` / `.`) step to the previous / next slot, wrapping: Write etude moves the caret to its start; Improvise (stopped) and Read etude (stopped) make it current (with *On arrival* as §3.3). There is no on-screen slot browser; the active slot is highlighted in the chart.
- Out-of-range (grey) cells do nothing; the unchecked hex (§8.4) is fully playable.

### 8.4 Slots without a scale — [Hex for slots without a scale](issues/038-hex-for-slots-without-a-scale.md)

| Active slot | Hex shows | Entry | Dock label | ▶ Chord / ▶ Scale / *On arrival* |
|---|---|---|---|---|
| `N.C.` | **C major** (in the instrument's written pitch: white-key names, whatever the neighbouring slots), with **no degree data**: every cell neutral taupe, no degree numbers, no triad tones; **fully playable** (the border buttons reach the other pitches) | **any note**, not checked (no out-of-scale marks; ↑ / ↓ nudge by semitone) | "N.C.: notes not checked" | silent |
| Empty | as `N.C.` | as `N.C.` | none | silent |
| Unparseable | as `N.C.` | as `N.C.` | "Chord not recognised: notes not checked" | silent |
| Valid chord, **no scale fits** | steps through the **chord's own tones** (each cell = next chord tone up; same slant, 3 rows, Fit range, pitch anchor); triad cells coloured by spelled degree | normal | "No scale fits: chord tones only" | ▶ Chord normal; ▶ Scale plays the chord tones ascending over one octave; *On arrival* normal |

- Glossary names: the first three rows are the **unchecked hex**, the last the **chord-tones hex**.
- Clicking an unparseable slot's label focuses its chord field. Notes in such a slot are kept and never marked out of scale; they are checked again once the slot has a chord.
- Improvise follows the same table (every row playable); Tuner always shows the unchecked hex (§3.8).

### 8.5 Linear

- **Grid** — a toggle in the **bottom left corner of the hex panel**. **On** (default) shows the 3-row honeycomb; **off** switches to Linear, **one row**. A device setting (`hexShape`). On phones the hex is always Linear and the toggle is hidden (§3.6).
- The row is **one octave of the slot scale**: its steps from the first at or above a C, plus the octave above — 8 cells for a 7-note scale (C D E F G A B C in C; C D♭ E♭ F G A♭ B♭ C in B♭ Dorian), the same count in every key. Cells are regular hexagons, as large as fit.
- **Octave switch**: a `‹ oct 4 ›` pill (the octave its row starts in, labelled like the C cells) (a group, with chevron buttons) under the row, centred at the bottom of the hex panel, steps the octave down / up (the row slides in from the side the new octave lies on: up from the right, down from the left; off under `prefers-reduced-motion`), within the instrument's range (the Cs whose octave overlaps it; Concert C3–C6 → C3 … C5). Starts at the octave in the middle of the range; not saved.
- Everything else is as on the honeycomb: degree colours and triad / guide-tone cells, border buttons, click pop, lit cells, travel (the row slides by the same steps), Write etude / Improvise / Tuner, the unchecked and chord-tones hexes (§8.4, one row of their notes).

## 9. Audio — [Audition (etude)](issues/025-audition-etude.md), [Audition and chord preview](issues/012-audition-and-chord-preview.md), [Play mode](issues/035-play-mode.md)

- Triggers: hex cell click (or Space / A over it); notation note click; nudge; ▶ Chord / C; ▶ Bass / B (the chord's bass, slash bass if any, in concert octave 3); ▶ Scale / S / ⇧Space; *On arrival* (Chord / Root note / Bass note / Bass note + chord).
- Silent: caret moves, Rest insert, Clear notes / Clear all, chord / scale edits, instrument switch, delete, latch changes, mode switches.
- **Timbre**: plain sine. Single notes 10 ms attack, ~0.9 s exponential decay; chord preview lower gain per voice, ~3.2 s decay. Sounds overlap.
- **Reverb** (no library): every sound also goes through a `ConvolverNode` whose impulse response is generated in code — stereo noise fading as (1 − t)³ over 2.2 s — mixed in at 28% under the dry signal. Always on.
- **▶ Chord** voicing: root in concert octave 3; 3rd / 5th / 6th-or-7th close above; extensions (9, 11, 13, alterations) above the 7th; slash bass an octave below the root, not doubled; chord tones only.
- **▶ Scale**: the active slot's scale ascending one octave from the tonic (tonic in concert octave 3), ~150 ms apart. No-fit chord: its chord tones ascending over one octave.
- `N.C.` / empty / unparseable slots: ▶ Chord, ▶ Bass, ▶ Scale and *On arrival* silent (§8.4).
- Always **concert pitch**; instrument range not applied.
- **Mute**: the speaker button in the sound pill, key `⇧M` (plain `M` does nothing); a device setting. No volume slider.
- `AudioContext` created / resumed on the first user gesture.


### 9.2 Listen (prototype) — toward an improvisation practice mode

- **Listen** has no button of its own: it is on in **Tuner** and **Improvise** and off in the other modes (§3.0). On: the browser asks for the microphone once; the mic is read every animation frame (no library): an AnalyserNode frame (2048 samples, ~43 ms) → **YIN pitch detection** (monophonic: voice, horns, strings, single-line guitar / bass; ~55 Hz – 1.6 kHz) and **onset detection** (level well above its recent average, still rising, past a noise gate; 90 ms lockout — a re-attack of the same note counts, a held note doesn't). A note is reported once it reads the same on two frames running (no flicker through the attack).
- While listening, a pill **as tall as the tuner**, at the left end of the **listen row**, holds the input level control (a small slider) and the level meter; the tuner shows the **heard note** (written pitch, spelled for the active slot) and its cents off; the heard note's cells **light on the hex** like a hovered cell.
- **Tuner** (while listening): a tuner in the middle of the **listen row** — a dark row sitting on the hex panel's top edge, **overlaying the bottom of the chart** (the hex keeps all its space; the row shows only while listening — in Tuner it overlays the empty chart pane, §3.8) — the note name and octave, a needle on a **±50 ¢** scale with a ±5 ¢ band, and the cents off; green within ±5 ¢, amber within ±15 ¢, red beyond, a dash when nothing clear is heard. Blocked or missing mic, or audio waiting for a gesture: the row shows the message instead (§3.0).
- The mic is opened with echo cancellation on (keeps the app's own sounds out) and noise suppression / auto gain off (they colour an instrument).
- **Input level control** ("In", in the Listen pill): gain from **−12 to +24 dB** before the detectors, a device setting (`micGainDb`, default 0; double-click resets). The **level meter** is on a dB scale (−60 … 0 dBFS) with a white **mark** where a note starts to count (the onset gate): set the input so playing passes the mark — the meter brightens past it — and silence stays below.
- Heard notes light the hex in Tuner and in Improvise with the transport stopped (§3.3); they are never written into the etude and never move the form on.

## 10. Instruments — [Instrument view](issues/011-instrument-view.md), [Instrument practical ranges](issues/013-instrument-practical-ranges.md), [Clef policy](issues/032-clef-policy.md)

| id | Name | Written = concert + | Practical written range | Clef |
|---|---|---|---|---|
| `concert` | Concert | — | none (hex view C3–C6) | Treble / Bass (choice) |
| `flute` | Flute | unison | C4–C7 | treble |
| `violin` | Violin | unison | G3–E7 | treble |
| `viola` | Viola | unison | C3–E6 | alto |
| `cello` | Cello | unison | C2–A5 | bass |
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
| `bass` | Bass (double bass / bass guitar) | P8 | E2–G4 | bass |

- The instrument is a **progression setting** (saved, exported); the device remembers the last pick as the default for new progressions. Switching redraws the chart (written pitches, clef) and the hex.
- Chord labels, hex labels and notation show **written** pitch; storage and sound are concert.
- Out of range is **flagged, never blocked**. No user-adjustable ranges in v1.

## 11. Keyboard

| Key | Write etude | Improvise (Tuner: the hex, sound and mode keys only) | Read etude |
|---|---|---|---|
| `1`–`5` | length latch (w h q e s); with Rest on, also inserts a rest | — | — |
| `R` | Rest latch on / off | — | — |
| ← / → | caret by event (by latch past the melody end) | stopped: previous / next slot, wrapping | stopped: previous / next slot, wrapping |
| ↑ / ↓ (⇧, ⌥) | nudge the note at the caret a scale step (⇧: a semitone; ⌥: an octave) | — | — |
| ⌫ / Del | as §6.2; with a bar selection, ⌫ deletes the bar(s) | — | — |
| click / ⇧click bar number (⇧click: anywhere in a bar) | select bar / extend to a run; a selected bar again deselects | loop that bar / extend the loop; a looped bar again: the whole form (the same selection, §3.0) | as Improvise |
| Esc | with a bar selection: deselect | stop looping bars (the whole form) | as Improvise |
| ⌘C / ⌘V / ⌘D | with a bar selection: copy / paste (replace) / duplicate | — | — |
| Space | **click whatever is under the pointer**, anywhere in the app (hex cell, border button, note, slot, header button, dropdown, field) — the full press, as with the mouse button; held repeats ignored | same | same (only what is clickable in Read etude) |
| `A` (pointer over a hex cell or border button) | same as clicking it: write the note (plays) | audition the note | — |
| `S` / ⇧Space | ▶ Scale | ▶ Scale | ▶ Scale |
| `` ` `` / `~` | **stepwise playback**: play the event at the caret and move the caret past it (a rest passes silently; a slot's first event brings its *On arrival*); after the last event, the next press starts at bar 1. The editing pill has a **‹ ›** pair for it: › is the same step forward; ‹ steps back — to the event before the caret (before the first, the last), played, with the caret moved to its start | — | — |
| `C` / `B` | ▶ Chord / ▶ Bass | ▶ Chord / ▶ Bass | ▶ Chord / ▶ Bass |
| `<` / `>` (or `,` / `.`) | previous / next slot, wrapping (caret to its start) | stopped: previous / next slot, wrapping | stopped: previous / next slot, wrapping |
| `⇧M` | mute | mute | mute |
| `[` / `]` | previous / next mode (Tuner · Improvise · Write etude · Read etude; no wrap) | same | same |
| `\` | → Read etude | → Read etude | → Write etude |
| ⌘Z / ⇧⌘Z | undo / redo | undo / redo (transport stopped) | — |
| Enter / Tab / ⇧Tab | (in a chord field) commit and move to next / previous slot | same (transport stopped) | |

All shortcuts are ignored while a text field (title, chord symbol, time signature, tempo) has focus. In Tuner, ▶ Chord / Bass / Scale (`C`, `B`, `S`) do nothing (greyed, §3.8).

## 12. Storage, files and schema — [Saved data and JSON schema](issues/015-saved-data-and-json-schema.md), [Melody data and schema](issues/023-melody-data-and-schema.md), [Clef policy](issues/032-clef-policy.md)

### 12.1 Browser storage

- **localStorage**: one key per progression `tonepath:progression:<id>` (whole progression JSON with `id` = `crypto.randomUUID()` and `updatedAt` ISO), plus `tonepath:device`. No index key; the library parses every progression key.
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
- `etudeName`: optional string, the etude's own name (shown above the title); blank → left out. Added within v2 (older files lack it).
- `concertClef`: optional, `"bass"` only; absent = treble; ignored unless `instrument` is `concert`. Added within v2 (older files lack it).
- Stable ids, never renamed or reused — instruments: §10; scales (18): `ionian dorian phrygian lydian mixolydian aeolian locrian locrian-nat2 melodic-minor harmonic-minor lydian-augmented lydian-dominant mixolydian-b6 altered phrygian-dominant whole-tone half-whole-diminished whole-half-diminished`.

### 12.3 Files

- Envelope `{ "app": "tonepath", "v": 2, "kind": "progression", "progression": {…} }` (*Export one*, `‹title›.tonepath.json`) or `{ "app": "tonepath", "v": 2, "kind": "library", "exportedAt": "<ISO>", "progressions": [ … ] }` (*Export all*, `tonepath-library-YYYY-MM-DD.json`, newest first). Files carry no ids, timestamps or device state. Pretty-printed, 2-space.
- **Import** accepts either kind, several files at once; **only adds** (fresh id, `updatedAt` = now, title clash → *"(2)"*); one toast with counts, new rows highlighted.
- Renamed Improwiser → Honeycomb → **Tonepath**: files with `"app": "honeycomb"` or `"improwiser"` import as if `"tonepath"`, and `honeycomb:*` / `improwiser:*` storage keys move to `tonepath:*` once on launch (an existing newer key wins: `tonepath:*` over `honeycomb:*` over `improwiser:*`).
- Whole file rejected: invalid JSON, wrong / missing `app`, unknown `kind`, newer `v` ("Made by a newer Tonepath — reload to update"). Bundle entry skipped: not an object or no `bars` list.
- **Repairs** (lenient): blank title → "Untitled"; bad `timeSignature` → `"4/4"`; `barsPerRow` outside 1–8 → 4; unknown instrument → `concert` (noted in the toast); bad `concertClef` → dropped; bar with 0 slots → one empty slot, > 2 → first 2; non-string `chord` → `""`; bad / non-candidate `scale` → dropped; 0 bars → 4 empty bars; melody: non-array → `[]`, events must have a valid `d` and an integer `pitch` 0–127 if present (else dropped), unknown keys ignored, then drop the suffix that runs past the form; an event **crossing a slot boundary** is shortened to the longest duration that fits before the slot ends, and the cut-off time becomes rests in the following slot (largest lengths that start on their own beat), so later events keep their timing — counted in the toast ("N notes shortened") ([Notation details](issues/039-notation-details.md)). Out-of-range pitches kept.

### 12.4 Versions and migration

- Integer `v` on the device key (speaks for all storage) and every file; current **2**. Pure `migrateNtoN+1` chain; storage migrated in memory on launch, written back, then device `v` bumped; imports run the same chain before validation. Newer storage → banner, read-only tab. No down-migration.
- `migrate1to2`: strip every slot's `notes`; `melody` = `[]` if missing.

### 12.5 Device key and demo

- `tonepath:device` = `{ v, lastInstrument, muted, lastOpenId, lastBackupAt, reminderDismissedAt, seeded, seededDemos, playArrival, hexShape, hexHidden, practiceLoop, metronomeBpm, metronomeSound, micGainDb }` — `playArrival`: `"silent" | "chord" | "root" | "bass" | "bass-chord"` (default `"silent"`); `hexShape`: `"honeycomb" | "linear"`; `practiceLoop`: the transport's Loop (default true; name kept); `practiceRule` and `practiceCount` (the dropped advance rules) are no longer read and stay as unknown fields; `micGainDb`: −12 … 24 (default 0); `seededDemos`: keys of extra demos already added. Unknown fields are kept. Never exported.
- `lastOpenId` missing / dangling → newest; empty library → empty state.
- Demo: bundled [demo.tonepath.json](examples/demo.tonepath.json) (`Dm7 | G7 | Cmaj7 | Cmaj7`, Concert, short melody with a rest), imported once through the normal path, guarded by `seeded`. Deleting it is permanent. **Further demos** are added to every library once (even a non-empty one, without opening them), each guarded by its key in `seededDemos`; deleting one is permanent: [rhythm-changes.tonepath.json](examples/rhythm-changes.tonepath.json) — rhythm changes in B♭ (32 bars AABA, the *I Got Rhythm* changes) with an original etude: a guide-tone line (one half note per chord, the 3rd or 7th nearest the last) in the A sections, chord arpeggios in eighths on the bridge. The A sections set in-key scales where the defaults would leave B♭ (Gm7 Aeolian, Dm7 Phrygian, E♭maj7 Lydian; G7 Phrygian dominant, as V7/ii to Cm7); the bridge dominants stay Mixolydian.

## 13. Glossary

[CONTEXT.md](CONTEXT.md) is the source of truth for terms (Library, Envelope, Progression, Slot, Slot scale, Chord / scale tone, Etude, Melody event, Caret, Owning slot, Length / Rest latch, Nudge, Out-of-scale mark, Control header, Chart zoom, Tuner / Improvise / Write etude / Read etude, Transport, Docked hex, Fit range, Pitch anchor, Degree colour, Note sphere, Clef, Instrument view, …). Avoid "passing note".

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
3. **Performance** was measured on laptop Chrome only (24 ms average full redraw at 32 bars); tablet Read etude is unmeasured (Fit page, playhead redraws only the highlight).

## 16. Out of scope for v1

From the map: full-line melody playback (a later toggle on Read etude's transport, [Mode menu](issues/068-mode-menu.md)); instrument sounds beyond a sine; piano strip and keyboard note entry; computer-keyboard grid play; per-slot hex palettes; a separate notation strip; dotted notes and ties; repeats and endings; path suggestion; accounts, backend, cloud sync; share-by-URL; per-slot sharps / flats switch; user-adjustable instrument ranges; library search / folders / tags / trash; a colour-blind pass on the hex theme.
