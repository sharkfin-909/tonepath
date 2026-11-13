---
id: 47
title: "Audio"
labels: [ready-for-agent]
status: closed
blocked_by: [45]
assignee: claude
---

## What to build

Implement the pure-interface `audio` module over Web Audio (the UI never touches Web Audio): `playNote`, `playChord`, `playScale`, `playRoot`; plain sine with the envelopes in SPEC §9; ▶ Chord voicing (root in octave 3, close voicing, extensions above the 7th, slash bass an octave below); ▶ Scale one octave from the tonic ~150 ms apart. Hex click and notation note click play the note. ▶ Chord / Space and ▶ Scale / ⇧Space buttons in the rail. Mute toggle + `M`, stored as a device setting. `AudioContext` created / resumed on the first gesture. Silent for all the triggers SPEC §9 lists as silent.

Spec: [SPEC.md](../SPEC.md) §9. Terms per [CONTEXT.md](../CONTEXT.md).

## Acceptance criteria

- [x] Hex and note clicks sound the concert pitch
- [x] ▶ Chord and ▶ Scale (buttons and keys) play the voicings in §9
- [x] Mute persists across reload and silences everything
- [x] No audio before the first user gesture; no console errors

## Blocked by

- [Docked hex for the active slot](045-docked-hex-for-the-active-slot.md)

## Resolution

Built 2026-11-13.

- `src/audio.ts`: `audio` module.
  - Pure voicings (tested):
    - `chordVoicing`: root in concert octave 3 (C3 = 48), chord intervals close above, 9/11/13 and their alterations above the 7th. A slash bass sits in the octave below the root, and its pitch class is removed from the upper voicing (not doubled).
    - `scaleRun`: the slot scale from the tonic in octave 3, top tonic included; a no-fit chord gives its chord tones over one octave.
    - `rootNote`: bass or slash bass in octave 3, for Play mode.
  - Engine: `playNote` / `playChord` / `playScale` (150 ms apart) / `playRoot`. Plain sine, 10 ms attack. Notes are 0.9 s exponential decay at gain 0.22; chord voices are 1.6 s decay at 0.1. Sounds overlap. Plus `setMuted` and `unlockAudio`. All are silent on `N.C.` / empty / unparseable slots.
- `src/device.ts`: read / merge-write of `improwiser:device` (only `muted` for now; unknown fields kept).
- UI:
  - The rail has 🔊 Sound / 🔇 Muted, ▶ Chord and ▶ Scale. Keys: Space, ⇧Space (no page scroll), and `M` (ignored in text fields).
  - A hex click plays the note, even when the insert is refused. Clicking an engraved note plays it and puts the caret at its start; clicking a rest just moves the caret.
  - The AudioContext is created / resumed on the first pointerdown or keydown.
- Tests: `src/audio.test.ts`; 294 tests pass in total.

Verified in Chrome with a main-world probe logging every oscillator:
- No tone before a gesture.
- Space on Bbm7 played 58 61 65 68 together; ⇧Space played Bb Dorian 58 → 70 at 0.15 s steps. The user heard it.
- A hex click played and inserted E4, and a notehead click played F4 and moved the caret.
- `M` muted Space completely, and Muted survived a reload. No console errors.

Bug found and fixed while verifying: the slot's pointerdown moved the caret and redrew the stave, which removed the note's SVG before its click fired. The slot now ignores pointerdowns on `.melody-event`.

Choices beyond the spec:
- A note click also places the caret at the note (SPEC §6.2 item 7), since the click was being wired anyway. The rest of caret placement stays in [Caret and editing keys](048-caret-and-editing-keys.md).
- The device key is written once on load with the current `muted` value (StrictMode re-runs the effect). Harmless.

Deferred: *On arrival* (uses `playRoot` / `playChord`) → [Play mode](056-play-mode.md); nudge audition → [Caret and editing keys](048-caret-and-editing-keys.md).
