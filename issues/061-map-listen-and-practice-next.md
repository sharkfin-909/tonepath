---
id: 61
title: "Map: Listen and Practice — next steps"
labels: [wayfinder:map]
status: open
assignee:
---

## Destination

A decided plan for the next round of **Listen** and **Practice** (SPEC §3.7, §9.2): how the tuner and note detection
should sample, smooth and cope with register and room, and what feedback Practice gives — every open question below
resolved into a decision a build slice can be cut from.

## Notes

- Domain: real-time pitch detection in the browser (Web Audio, no library) feeding an improvisation practice mode.
  Terms per [CONTEXT.md](../CONTEXT.md): *Listen*, *Practice mode*, *advance rule*, *note count*, *targets*.
- Current behaviour (the baseline every ticket starts from): the mic → `AnalyserNode`, read **once per animation
  frame** (~60 Hz; 120 Hz on high-refresh displays) over a **2048-sample window** (~43 ms at 48 kHz, so consecutive
  readings overlap ~60 %); YIN pitch (`src/listen/pitch.ts`), a note accepted after **two equal readings**; the needle
  eases over 70 ms; first reading of a new note after ~50–80 ms; floor ~A1 (55 Hz); **paused in background tabs**
  (rAF). Code: `src/listen/mic.ts`, `ListenPill.tsx`, `src/practice.ts`.
- Skills: `/grilling` + `/domain-modeling` for grilling tickets; `/prototype` for prototype tickets (a throwaway page
  under `prototypes/`); `/research` for research tickets (findings in `research/`).
- Test without an instrument the way the build was checked: a synthetic oscillator in place of `getUserMedia`
  (a MediaStreamDestination), driven from the console. Real-instrument checks are HITL.
- Planning only: produce decisions; the build comes after, as slices against SPEC.

## Decisions so far

<!-- one line per closed ticket: - [title](file) — gist -->

## Not yet specified

- **Practice beyond the five rules**: a timed / BPM mode (the form moves on the beat and Practice scores what you
  played against it) — depends on how responsive detection becomes ([Analysis in an AudioWorklet](063-analysis-in-an-audioworklet.md)).
- **Instrument-specific tuning of the detector** (thresholds, clarity cut-off, octave-error guards per instrument
  family) — only worth specifying once real-instrument findings exist.

## Out of scope

- Polyphonic detection (chords on piano / guitar): a different class of analysis; Listen stays one note at a time.
- Recording or transcribing what is played into the melody.
- Phone layout of the chart (cap bars per row on narrow screens) and the product name / SEO — separate efforts, not
  about listening.
