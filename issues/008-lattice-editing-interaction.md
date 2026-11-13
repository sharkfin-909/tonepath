---
id: 8
title: "Lattice editing interaction"
labels: [wayfinder:prototype]
status: closed
parent: 1
blocked_by: [2]
assignee: claude
---

## Question

How does the user build a lattice? How is a note added (palette of the bar's chord/scale tones, a pitch picker, keyboard entry), placed (free position vs pitch-ordered axis), linked (drag from note to note?), moved and deleted? Make a rough clickable prototype to react to.

Must express the [Lattice model](002-lattice-model.md): explicit **entry / body / exit** zones per bar (moving a note between zones is a deliberate act), undirected in-bar links between any two notes, forward **bridges** exit → next bar's entry with valid targets lighting up during the drag, **wrap bridge** stubs from last bar to bar 1, and a subtle background tint on bars with no entry or no exit notes.

Also from [Bar grid and progression](003-bar-grid-and-progression.md): bars may be split into **two chord slots**, each with its own entry/body/exit zones, with bridges between slots inside a bar; slot dividers are lighter than bar lines. Chord labels sit at the top of each slot and are typed in place.

## Assets

Prototype (throwaway, primary source — not a git repo, so every round is kept as a file in [prototypes/lattice-editing/](../prototypes/lattice-editing/); run `open prototypes/lattice-editing/index.html`):

- [index-v1-abc.html](../prototypes/lattice-editing/index-v1-abc.html) — round 1: A palette + free layout, B pitch axis, C keyboard + auto-stack (`?variant=`). **C won.**
- [index-v2-spread.html](../prototypes/lattice-editing/index-v2-spread.html) — round 2: links and zones dropped, crowded slots spread sideways, click to audition, taller keyboard.
- [index-v3-octcols.html](../prototypes/lattice-editing/index-v3-octcols.html) — round 3: one column per octave, octave numbers dropped from notes.
- [index-v4-centred.html](../prototypes/lattice-editing/index-v4-centred.html) — round 4: notes centred vertically, ▶ Chord preview.
- [index-v5-transpose.html](../prototypes/lattice-editing/index-v5-transpose.html) — round 5: instrument-view dropdown.
- [index.html](../prototypes/lattice-editing/index.html) — round 6 (final): coloured fill on black keys.

## Resolution

Prototyped with the user over six rounds, 2026-11-12. Assets above; the final round is the reference.

1. **No links, no zones — the lattice becomes a note set.** Joining notes into paths was "silly to think that way": each slot holds just a **note set** — a set of pitches coloured against its chord. No links, bridges, wrap bridges, paths, entry/body/exit zones or dead-end tints. A slot holds each pitch at most once. **Supersedes most of [Lattice model](002-lattice-model.md)** (only "a note belongs to one slot, coloured against its chord" survives).
2. **A note stores only slot + concert MIDI pitch** — no position. Layout is derived.
3. **Layout inside a slot** — one **column per octave**, the same columns in every slot (octaves 3–5 always, plus any octave in use anywhere), low → high left → right; a note's column is its *spelled* name's octave (`B#3` → 3, `Cb4` → 4). Inside a column notes stack by pitch, low at the bottom, **centred vertically**; when they'd overlap they squeeze and zigzag sideways. Notes show the **letter only** (`E`, `Bb`) — no octave number; a faint octave number sits at the foot of each column.
4. **Keyboard-first entry** — click a slot (or `[` / `]`) to target it; type note names (`e4`, `d5 f5 a5`, any letter key focuses the box) + Enter; or click the **piano strip** under the grid, whose keys **toggle** that pitch in the target slot (a dot marks pitches already present). Keys are tinted by role for the target slot: white keys light green / blue, black keys get a large solid green / blue fill above the name with a black border; labels on chord / scale tones and on C keys.
5. **Editing** — click a note to select it; ↑ / ↓ moves its pitch (Shift = octave, skipping pitches already in the slot); Backspace deletes; Esc deselects. Chord labels typed in place as decided in [Bar grid and progression](003-bar-grid-and-progression.md).
6. **Audition (sound is now in v1)** — clicking a note, a piano key, ↑/↓ or typed entry plays a plain **sine** (typed groups as a quick arpeggio). **▶ Chord** button (and Space) plays the target slot's chord: root in octave 3, chord tones close above, slash bass an octave below; grey slots play nothing. Sound is concert pitch.
7. **Instrument view (now in v1)** — a dropdown: Concert, B♭ trumpet/clarinet, B♭ tenor sax, E♭ alto sax, E♭ baritone sax, F horn. Display only: chord symbols, note names, octave columns and the piano strip show **written pitch**, spelled by interval (B♭ `A7alt` shows `B#`); typed notes and chord symbols are read as written and stored as concert. Includes the octave (tenor = up a 9th, bari = up an octave + 6th), and the strip follows the written range.

Rejected: palette + free x/y layout (A — stored positions, mouse-heavy); fixed pitch axis (B — tall, adjacent semitones collide); links / bridges / zones (melodic paths aren't how the user thinks about it); octave numbers on every note (column says it); one stacked column with sideways spill only (octave hard to read).

**Amended by [Audition and chord preview](012-audition-and-chord-preview.md):** piano keys no longer toggle on click — the key body only plays the pitch; a per-key ⊕ / ⊖ icon adds (with sound) or removes (silently), and ⊖ replaces the "already in this slot" dot.
