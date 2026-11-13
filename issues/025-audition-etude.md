---
id: 25
title: "Audition (etude)"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: [26]
assignee: cursor
---

## Question

Reconcile sound with [Docked hex pivot](026-docked-hex-pivot.md) and [Audition and chord preview](012-audition-and-chord-preview.md): drop piano-key and ▶ Notes (note-set) behaviour; keep **docked hex** pick audition and chord/scale peek; confirm mute, concert pitch, and that full-line playback stays post-v1. What exactly does “scale peek” play, and which keys/buttons trigger chord vs scale peek?

## Resolution

Grilled 2026-11-13. Glossary updated in [CONTEXT.md](../CONTEXT.md).

1. **Dropped** (vs [Audition and chord preview](012-audition-and-chord-preview.md)): piano-key body / ⊕⊖ sounds; **▶ Notes** / Shift+Space as note-set arpeggio; chart note-set clicks.
2. **Triggers now:**
   - **Hex cell click** — `playNote` (concert MIDI).
   - **In-slot notation note click** — `playNote` for that event’s pitch.
   - **▶ Chord / Space** — same voicing as before: root in concert octave 3; 3rd/5th/6th-or-7th close above; extensions above the 7th; slash bass an octave below; chord tones only; grey/`N.C.`/empty → silent.
   - **▶ Scale / Shift+Space** — active slot’s scale ascending **one octave from the tonic** (concert, tonic in octave 3), ~150 ms apart; scale tones only; grey/`N.C.`/empty → silent.
3. **Silent:** caret moves, Rest insert, Clear all, chord/scale edits, instrument switch, delete, length-latch changes.
4. **Unchanged from 012:** plain sine; Web Audio module (`playNote` / `playChord` / `playScale`); mute via speaker control + **M**, device-remembered; concert pitch always; no volume slider; full-line / playhead playback stays **post-v1**.
