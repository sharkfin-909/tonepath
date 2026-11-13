---
id: 12
title: "Audition and chord preview"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

Pin down sound, which [Lattice editing interaction](008-lattice-editing-interaction.md) pulled into v1 (it was out of scope). What triggers sound (prototype: note click, piano key, ↑/↓, typed entry as arpeggio, ▶ Chord / Space)? Timbre — plain sine only, or a softer tone? How is the chord preview voiced (prototype: root in octave 3, close stack — extensions sit cramped next to the root; slash bass an octave below)? Is there a "play this slot's note set" action, a mute toggle, a volume? Plain Web Audio vs a library (Tone.js) — the prototype needs none. Is a playhead / whole-progression playback still post-v1?

## Resolution

Grilled with the user, 2026-11-12. Terms recorded in [CONTEXT.md](../CONTEXT.md).

1. **Triggers** — one sound per action on a pitch: clicking a chart note; clicking a **piano key body** (plays only — no add/remove); ↑/↓ on a selected note (the new pitch); typed entry (ascending arpeggio, 150 ms apart); **▶ Chord** / Space; **▶ Notes** / Shift+Space. Silent: chord-symbol changes, instrument switch, delete, slot selection, recolouring.
2. **Piano-strip key icon** (amends [Lattice editing interaction](008-lattice-editing-interaction.md)) — each key carries **one** circular icon: **⊕** when the pitch isn't in the target slot (click adds it, with sound), **⊖** when it is (click removes it, silently). Always visible (works on touch): ⊖ solid/bold — it is the "in this slot" marker, replacing the dot; ⊕ faint. ~18–20 px, where the dot was (above the name on white keys, inside the colour fill on black keys).
3. **Timbre** — plain **sine**. Single notes: 10 ms attack, ~0.9 s exponential decay. Chord preview: lower gain per voice, ~1.6 s decay. Sounds overlap; nothing cuts off a ringing note.
4. **▶ Chord voicing** — root in concert octave 3 (C3–B3); 3rd / 5th / 6th-or-7th close above; **extensions (9, 11, 13 and alterations) an octave up, above the 7th** (`C9` → C3 E3 G3 B♭3 D4); slash bass an octave below the root (octave 2), not doubled. Chord tones only (green). Always concert pitch; instrument range not applied. Grey slots silent.
5. **▶ Notes** — plays the target slot's note set ascending, 150 ms apart; out-of-range notes included; empty set silent; no pattern options in v1.
6. **Mute** — speaker toggle near the title / instrument label, key **M**; silences everything; **remembered per device**, not saved with the progression. No volume slider (system volume does that).
7. **Engine** — plain **Web Audio**, no library. The `AudioContext` is created / resumed on the first user gesture (always the sound-wanting action, so no "enable sound" step). Sound lives in its own module behind `playNote(midi)`, `playChord(slot)`, `playNotes(slot)`; UI never touches Web Audio.
8. **Whole-progression playback stays post-v1** (playhead, tempo, loop, metronome) — unchanged on the map.

Rejected: key-click toggling (accidental adds/removes; the icon makes intent explicit); hover-only ⊕ (invisible on touch); sounding removals; triangle / sampled tones; prototype close voicing with cramped extensions; volume slider; Tone.js (~80–100 KB for features not needed until a playhead).
