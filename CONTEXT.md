# Honeycomb — domain glossary

Honeycomb is a practice-etude tool: a chord-bar form with in-slot standard notation, and one docked hex grid for scale-tone entry.

## Library and files

- **Library** — all the user's progressions, autosaved in browser storage; listed on the library screen, newest edit first. **Demo progression** — the deletable ii–V–I opened on first launch.
- **Backup** — an *Export all* bundle file; imports only ever add progressions, never overwrite.
- **Envelope** — the wrapper every Honeycomb file has: `{ app: "honeycomb", v, kind }`, where `kind` is `progression` (one progression, *Export one*) or `library` (a bundle, *Export all*). Files never carry ids, timestamps or device settings.
- **Device settings** — per-browser state, never exported: last-picked instrument, mute, Play-mode "On arrival", last-open progression, last backup date, reminder dismissal, whether the demo has been seeded.
- **Schema version** — integer `v` on the device settings and every file; older data is upgraded by a chain of pure migration steps; data newer than the app is refused.

## Form

- **Progression** — a titled sequence of bars the user writes an etude over, with a **time signature** (shown as typed; also parsed as `N/D` to size each bar for melody layout — bad/missing → `4/4`) and a bars-per-row setting; always loops from last slot back to first. No repeats — everything written out. Holds one progression-level **melody** array.
- **Bar** — one cell of the grid, split into one or two chord slots. Bar lines are drawn heavier than slot dividers.
- **Bar handle / bar menu** — the ⋯ on a bar's number (Write mode) opening Insert before / after, Duplicate, Copy, Paste, Split / Merge, Delete. Bar edits carry the melody with the bars; Paste replaces the target bar(s) including their melody slice.
- **Chord slot** (slot) — half or all of a bar: chord symbol, scale label, and the **standard-notation** fragment for melody events in that bar’s time. Slots do not host a pick palette.
- **Chord symbol** — the user-typed chord name for a slot (e.g. `G7`, `Cm7b5`), stored and shown exactly as typed; parsed into root + interval list + optional bass (no octave). Unparseable → shown red. `N.C.` is a valid symbol meaning intentional silence (no scale on the hex).

## Harmony

- **Slot scale** — the scale that remoulds the docked hex when the slot is active: the first fit from a ranked list for the chord's family, or the user's **scale override** (a scale type relative to the root, marked by a dot on the chord label). No global key.
- **Chord tone / scale tone / chromatic** — a pitch’s role against a slot. Chord tone: named or implied by the chord symbol, incl. a slash bass. Scale tone: in the slot's scale but not the chord. Chromatic: anything else (not enterable in v1; may appear as an **out-of-scale mark** after a chord change). Classified by pitch class, chord > scale > chromatic.
  _Avoid_: passing note (ambiguous — once meant chromatic, once meant scale non-chord).
- **Note name** — a pitch’s displayed spelling (`C#4` vs `Db4`), never stored: derived from its MIDI pitch and the relevant slot. Chord/scale tones are named by interval (at most one accidental); chromatics follow the slot's **lean** (flat or sharp, by majority of accidentals in the scale's names), falling back to the **default set** `C# Eb F# Ab Bb`.

## Etude

- **Etude** — the practice line the user writes over the progression: one continuous, bar-aligned **melody**, shown as standard notation **inside the slots**.
- **Melody** — the ordered sequence of **melody events** for the whole progression (not stored per slot; slots display their time slice).
- **Melody event** — stored as `{ pitch, d }` (concert MIDI + duration id) or `{ d }` (rest). Duration ids: `w` | `h` | `q` | `e` | `s`. No dots or ties in v1.
- **Clear all** — empties the melody to `[]` in one undoable step; does not change chords, scales, title, or instrument.
- **Caret** — a **time position** in the form (not a point between events). Entry **overwrites**: a new event replaces whatever occupies its time, leftovers become rests, and later music never moves (no ripple). The **slot under the caret** is the **active slot** (remoulds and colours the docked hex). Cannot move past the end of the form; placing it past the melody's end pads the gap with rests on the next insert.
- **Owning slot** — the slot holding an event's start; gives its spelling and out-of-scale mark. Events never cross a slot boundary: a length that doesn't fit before the slot ends is refused.
- **Length latch** — the selected duration applied to the next insert (`w` · `h` · `q` · `e` · `s`).
- **Rest latch** — toggled by R / Rest. While on, each length key (1–5 or a length button) inserts a rest of that length; picking a hex pitch turns Rest off and inserts that pitch.
- **Nudge** — ↑/↓ move the note just before the caret one step of its owning slot's scale (⇧ = octave).
- **Out-of-scale mark** — visual flag on a melody note whose pitch is no longer in the scale of the slot that owns its beat (e.g. after a chord edit). Notes are kept, never auto-deleted.

## Screen

- **Control rail** — the full-height left column holding every edit control (library, title, instrument, bars per row, mute, Stand, length latch, Rest, undo/redo, Clear all, ▶ Chord / ▶ Scale). Right of it: the chart on top, the docked hex in the bottom half (fixed 50/50).
- **Chart zoom** — automatic: the chart scales so every row fits its area, down to a readable floor (staff gap ≈ 5px); below that the chart scrolls, following the caret's row. No manual zoom.
- **Write / Play** — the two hex modes, switched at the top of the control rail (or `P`). **Write** (default on every open) records hex picks at the caret. **Play** only auditions: no caret, editing controls hidden, ← / → step slot by slot (wrapping), clicking a slot or note selects it. **On arrival** — a Play-mode device setting: what sounds when a slot is reached (Silent · Chord · Root note).
- **Stand mode** — read-only view for a tablet on a music stand: the rail and hex are hidden, and every bar is fitted onto one page. ✎ Edit / `\` returns to editing.

## Docked hex

- **Docked hex** — the single diatonic pick grid in the bottom half of the screen: **4 rows**, each sitting half a cell **left** of the row below. Right = next scale degree; up-left = a diatonic third (every row starts a third above the one below), up-right = a fourth. The left edge is a column of thirds from the bottom-left cell. Remoulds pitches and spellings from the active slot's scale. Covers the instrument's whole practical written range; cells outside it are grey (inactive).
  _Avoid_: hex palette (per-slot), piano strip.
- **Fit range** — how the docked hex is sized: the top row is just long enough that the 4 rows cover the whole range; each lower row is **trimmed** on the right so the right edge stays roughly vertical; cells are the largest that fit the dock (some pitches appear twice). `Concert` uses a fixed C3–C6 view with nothing grey.
- **Pitch anchor** — the bottom-left cell is the lowest in-range tone of the active slot's scale, so notes stay where they are when the slot changes; only fills, borders and changed scale tones move.
- **Hex cell label** — inside the cell's centre: a small degree number above the note name (no octave). Playing a cell briefly highlights every cell holding the same pitch, which shows the octave.
- **Degree ring** — the 10px coloured ring of an in-range hex cell, encoding its **spelled degree** 1–7 (letter distance from the root): 1 `#53131E` · 2 `#FFD52E` · 3 `#EC7C25` · 4 `#390099` · 5 `#9E0059` · 6 `#5BB561` · 7 `#12EAEA`. A 2px keyline in the dock background colour separates it from the centre. Scales without seven notes still use 1–7: an 8-note scale repeats a degree (G half-whole → 1 2 3 3 4 5 6 7), a 6-note scale skips one (C whole-tone → 1 2 3 4 5 7), as does G altered (1 2 3 3 5 6 7).
  _Avoid_: degree border (the old 3px stroke).
- **Hex fill** — the cell's centre: white = chord tone (dark lettering); warm grey `#938581` = scale tone (white lettering). Grey `#BDBAB3` with a faded ring = out of instrument range.
- **Rests-only hex** — the dimmed, inactive dock shown for an `N.C.`, empty or unparseable active slot (layout of the nearest earlier scaled slot; only rests can be entered). A valid chord that no scale fits gets a **chord-tones hex** instead (cells step through the chord tones; entry allowed).

## Sound and instrument

- **Audition** — hearing a pitch (plain sine) when a docked-hex cell or an in-slot notation note is clicked. **Chord preview** (▶ Chord / Space) — active slot’s chord tones (root in concert octave 3; extensions above the 7th; slash bass below). **Scale peek** (▶ Scale / Shift+Space) — active slot’s scale ascending one octave from the tonic (~150 ms apart). **Mute** — per-device toggle (M / speaker by title). Sound is always concert pitch. No full-line playback in v1.
- **Instrument** — an entry in the instrument list: name, **transposition** (written = concert + an interval, octave included) and a practical **written range**. `Concert` has no range.
- **Instrument view** — the progression's chosen instrument (shown beside the title; new progressions default to the device's last pick). Chords, hex labels and notation show **written pitch**; typed input is read as written; the stored chart and sound stay in **concert pitch**.
- **Clef** — fixed per instrument (bass: trombone, double bass / bass guitar; treble: all others); `Concert` has a saved Treble / Bass choice. Drawn at the start of every row in a **clef gutter** outside the slots; never changes inside a progression. No key signature.
- **Out of range** — on the hex: grey inactive cell. In notation: a melody pitch outside the instrument's written range is flagged (e.g. hollow/faded); never blocked from entry if somehow present.
