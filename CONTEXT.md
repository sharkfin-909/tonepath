# Tonepath — domain glossary

Tonepath is a practice-etude tool: a chord-bar form with in-slot standard notation, and one docked hex grid for scale-tone entry.

## Library and files

- **Library** — all the user's progressions, autosaved in browser storage; listed on the library screen, newest edit first. **Demo progression** — the deletable ii–V–I opened on first launch.
- **Backup** — an *Export all* bundle file; imports only ever add progressions, never overwrite.
- **Envelope** — the wrapper every Tonepath file has: `{ app: "tonepath", v, kind }`, where `kind` is `progression` (one progression, *Export one*) or `library` (a bundle, *Export all*). Files never carry ids, timestamps or device settings.
- **Device settings** — per-browser state, never exported: last-picked instrument, mute, *Audio on chord* ("On arrival"), the transport's tempo / click sound / Loop, last-open progression, last backup date, reminder dismissal, whether the demo has been seeded.
- **Schema version** — integer `v` on the device settings and every file; older data is upgraded by a chain of pure migration steps; data newer than the app is refused.

## Form

- **Progression** — a titled sequence of bars the user writes an etude over, with a **time signature** (shown as typed; also parsed as `N/D` to size each bar for melody layout — bad/missing → `4/4`) and a bars-per-row setting; always loops from last slot back to first. No repeats — everything written out. Holds one progression-level **melody** array.
- **Bar** — one cell of the grid, split into one or two chord slots. Bar lines are drawn heavier than slot dividers.
- **Bar handle / bar menu** — the ⋯ on a bar's number (Write etude; Improvise while stopped) opening Insert before / after, Duplicate, Copy, Paste, Split / Merge, Delete. Bar edits carry the melody with the bars; Paste replaces the target bar(s) including their melody slice. Each bar also has a **trash can** at its bottom right (Delete, in one click).
- **Bar selection** — a run of bars picked by their numbers (click selects, ⇧-click — on the number or anywhere in a bar — extends from the selection or the caret's bar; clicking a selected bar or Esc deselects). Bar actions apply to it in Write etude; in Improvise and Read etude the same selection is the **looped bars**.
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
- **Clear notes** — empties the melody to `[]` in one undoable step; chords, scales, title and instrument stay.
- **Clear all** — empties every chord, scale override and note (confirmed first), keeping the bars, title, time signature and instrument; one undoable step. Both live in the **Clear ▾** menu.
- **Caret** — a **time position** in the form (not a point between events). Entry **overwrites**: a new event replaces whatever occupies its time, leftovers become rests, and later music never moves (no ripple). The **slot under the caret** is the **active slot** (remoulds and colours the docked hex). Cannot move past the end of the form; placing it past the melody's end pads the gap with rests on the next insert.
- **Owning slot** — the slot holding an event's start; gives its spelling and out-of-scale mark. Events never cross a slot boundary: a length that doesn't fit before the slot ends is refused.
- **Length latch** — the selected duration applied to the next insert (`w` · `h` · `q` · `e` · `s`).
- **Rest latch** — toggled by R / Rest. While on, each length key (1–5 or a length button) inserts a rest of that length; picking a hex pitch turns Rest off and inserts that pitch.
- **Nudge** — ↑/↓ move the note at the caret (the one it sits on; at the melody's end, the last note) one step of its owning slot's scale (⇧ = a semitone, ⌥ = an octave).
- **Out-of-scale mark** — visual flag on a melody note whose pitch is no longer in the scale of the slot that owns its beat (e.g. after a chord edit). Notes are kept, never auto-deleted.

## Screen

- **Control header** — the two-row bar across the top of the chart screen holding every edit control: Library, title, the **sound pill** (mute, ▶ Chord / ▶ Bass / ▶ Scale, *On arrival*), the **mode panel** (**Mode:** Tune · Improvise · Write etude · Read etude); the mode's own group — the **editing pill** (Write etude: note lengths, Rest, time, bars per row, nudge, step, undo / redo, **Clear ▾**), the **form group** (Improvise: time, bars per row, undo / redo) or the **transport bar** (Improvise, Read etude); and **Ins:** (instrument, clef). Below it: the chart over the full-width docked hex, which **Hide hex** (bottom right, Improvise only) can hide so the chart takes the screen.
  _Avoid_: control rail (the old left column).
- **Chart zoom** — automatic: the chart scales so every row fits its area, down to a readable floor (staff gap ≈ 5px); below that the chart scrolls, following the caret's row. No manual zoom.
- **Mode** — one of four, picked in the mode panel (or `[` / `]`; `\` toggles Write etude ↔ Read etude); each is a fixed set of panels, and the mode alone decides whether **Listen** is on. Every open or reload starts in **Tune**. Switching modes stops the transport and keeps the **current slot** and the bar selection.
  _Avoid_: Audio input (the removed mic switch), Play (the old audition-only mode, never offered).
- **Tune mode** — the opening mode: the tuner bar over an **empty chart pane** (same height as the chart, so nothing moves), the **unchecked hex** lighting whatever is played (chromatic notes too); the sound pill's chord controls greyed. Listen on. _Avoid_: Tuner (the old mode name).
- **Improvise mode** — playing over the form from a **lead sheet**: chords and scales, empty staves, the current slot highlighted; the tuner bar and the **transport**. The form moves on only with the transport. Stopped: step slots by hand, the hex shows the current slot's scale and lights what is played; chords, scales and the form (time, bars per row, ⋯ bar menu, "+", trash, undo) can be edited. Running: the hex shows the upcoming chord's tones with **target rings**, played notes unlit; nothing edits. Listen on.
  _Avoid_: Practice mode (the old name, with note-driven advance rules, all dropped), Explore (dropped: Write that wrote nothing).
- **Write etude** — writing the etude: hex picks recorded at the caret (§6 of the spec), the editing pill, the bar menu; the hex always shown; no transport, no mic. **On arrival** sounds with a slot's first entry. _Avoid_: Write (the old name), writing by playing (dropped).
- **Editing session** — everything about the open chart that isn't saved: caret, length / Rest latches, the mode (Tune / Improvise / Write etude / Read etude), the current slot (Improvise, Read etude), a pending *On arrival* sound, bar selection (= the looped bars) and clipboard, mute and *On arrival* setting. Changed only by **intents** (a pick, a length, browse, a bar action…), each giving the next session, an edit to commit and sounds to play (`session.ts`; keys map to intents in `keymap.ts`).
- **Progression document** — the open progression with its undo history and saving: each committed edit is one undo step and one save; another tab's write reloads it (`document.ts`).
- **Read etude** — reading and playing the written etude, e.g. on a tablet on a music stand: every bar on one page (Fit page), the transport (click, **playhead** = the current slot highlighted, *Audio on chord* as accompaniment), the sound pill; no hex, no mic, nothing edits. Stopped: clicking a slot moves the playhead there, clicking a note auditions it. Running: chart clicks do nothing. The written melody is not played back (yet).
  _Avoid_: Etude view, Stand, Read mode (old names).

## Docked hex

- **Docked hex** — the single diatonic pick grid below the chart (it takes all the height the chart leaves): **3 rows**, each sitting half a cell **left** of the row below. Right = next scale degree; up-left = a diatonic third (every row starts a third above the one below), up-right = a fourth. The left edge is a column of thirds from the bottom-left cell. Remoulds pitches and spellings from the active slot's scale. Covers the instrument's whole practical written range; cells outside it are grey (inactive).
  _Avoid_: hex palette (per-slot), piano strip.
- **Fit range** — how the docked hex is sized: the top row is just long enough that the 3 rows of a 7-note scale cover the whole range (the same size for every key and scale); each lower row is **trimmed** on the right so the right edge stays roughly vertical; cells are the largest that fit the dock (some pitches appear twice). `Concert` uses a fixed C3–C6 view with nothing grey.
- **Pitch anchor** — the bottom-left cell is the lowest in-range tone of the active slot's scale, so notes stay where they are when the slot changes; only fills, borders and changed scale tones move.
- **Hex cell label** — the note name at the top of the cell; the **degree number** is on the note sphere.
- **Degree colour** — the fill of a hex cell (cells tile with no gaps), encoding its **spelled degree** 1–7 (letter distance from the root): 1 `#12EAEA` · 2 `#FFD52E` · 3 `#EC7C25` · 4 `#390099` · 5 `#9E0059` · 6 `#5BB561` · 7 `#7B4A26`, with the note name at the top of the cell. Only triad cells (and a quartad's guide tone) show it all the time; other cells are neutral taupe and show their colour when lit (hovering or clicking a cell lights every cell with the same pitch). Scales without seven notes still use 1–7: an 8-note scale repeats a degree (G half-whole → 1 2 3 3 4 5 6 7), a 6-note scale skips one (C whole-tone → 1 2 3 4 5 7), as does G altered (1 2 3 3 5 6 7).
  _Avoid_: degree ring, degree border (older looks).
- **Note sphere** (ball) — the shaded sphere on a cell (cream highlight → dark brown rim, theme tokens), carrying the degree number in white; sharps sit right of the cell centre, flats left, over a dark socket. Drawn in a layer above the cells so it can travel.
  _Avoid_: hex fill (the old white / grey centres).
- **Key** — the notes of a slot's scale; two slots are in the same key when their scales have the same notes (Dm7 D Dorian and G7 G Mixolydian: key of C). A key that is a mode of a major key has **simple chords**: its seven diatonic triads, each with its mode (offered in an empty chord field; committing one sets that mode, so the key holds). _Avoid_: tonality, key signature (not shown), key center (it implies a chosen tonic; a key here is just its notes). **Key pill** — the key's name at the top right of a slot whose scale is a mode: the parent scale its notes come from — a major key's tonic (`C`, `B♭`) or a minor parent with a tag (`A♭ mel`, `C harm`). Whole-tone and diminished scales are not modes of a key: no pill. **Key mates** — the slots sharing the current slot's key; their key pills light in the current slot's colour.
- **Travel** — the slide of the degree pattern (balls and cell colours) along the rows on a slot change in the same key: right when the new root is up to a 4th above, else left (a move and its return mirror); nothing on a key change.
- **Linear** — the docked hex as one row: one octave of the slot scale (8 cells for 7 notes), with an octave switch; shown when the **Grid** toggle (bottom left of the hex panel) is off. _Avoid_: keyboard view, single row.
- **Unchecked hex** — the dock shown for an `N.C.`, empty or unparseable active slot: C major with names only (no degrees), fully playable; notes there are not checked against any scale. _Avoid_: rests-only hex (the old rule). A valid chord that no scale fits gets a **chord-tones hex** instead (cells step through the chord tones; entry allowed).

## Sound and instrument

- **Transport** — the bar that runs the form in time in Improvise and Read etude: tempo, click sound, rewind, start / stop, Loop (tempo, sound and Loop shared device settings). It *is* the metronome: each chord lasts its length at the tempo, clicks on the beat, *Audio on chord* at each change. No note-driven advance. **Targets** — the upcoming chord's chord tones, ringed on the hex while it runs (Improvise).
  _Avoid_: metronome switch (gone), advance rule / note count (dropped with Practice).
- **Looped bars** — the transport over just some bars: the bar selection, picked by bar numbers in Improvise or Read etude (⇧ extends; a looped bar again, Esc or the chip's × goes back to the whole form) or carried from Write etude. Loop, the targets and rewind stay within them (a **slot range**, `transport.ts`).
- **Mic intake** — what becomes of each note start the mic hears: **played** (it lights the hex in Tune and in Improvise while stopped, and brings a waiting *Audio on chord* sound) or **ignored** (the app's own sounds, under the echo guard) (`micIntake.ts`).
- **Metronome run** — the transport's engine, from a slot: clicks on the beat, slots announced on time, wrap (Loop) or end; it runs against a **clock** (the audio clock in the app, a fake one in tests) (`metronomeRun.ts`).
- **Listen** — reading the microphone to detect the notes a player plays (pitch and note starts, one note at a time); on in **Tune** and **Improvise** only; shown in the **tuner bar** (note, cents, input level). If the mic is blocked the tuner bar says so and the mode stays. _Avoid_: record (nothing is written down).
- **Audition** — hearing a pitch (plain sine) when a docked-hex cell or an in-slot notation note is clicked. **Chord preview** (▶ Chord / C) — active slot’s chord tones (root in concert octave 3; extensions above the 7th; slash bass below). **Scale peek** (▶ Scale / Shift+Space) — active slot’s scale ascending one octave from the tonic (~150 ms apart). **Mute** — per-device toggle (M / speaker by title). Sound is always concert pitch. No full-line playback in v1.
- **Instrument** — an entry in the instrument list: name, **transposition** (written = concert + an interval, octave included) and a practical **written range**. `Concert` has no range.
- **Instrument view** — the progression's chosen instrument (shown beside the title; new progressions default to the device's last pick). Chords, hex labels and notation show **written pitch**; typed input is read as written; the stored chart and sound stay in **concert pitch**. Computed once per change as slots with written chord, harmony and spelling (`view.ts`); nothing else transposes.
- **Clef** — fixed per instrument (bass: trombone, Bass; treble: all others); `Concert` has a saved Treble / Bass choice. Drawn at the start of every row in a **clef gutter** outside the slots; never changes inside a progression. No key signature.
- **Out of range** — on the hex: a faded, inactive cell. In notation: a melody pitch outside the instrument's written range is flagged (e.g. hollow/faded); never blocked from entry if somehow present.
