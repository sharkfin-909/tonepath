---
id: 61
title: "Map: Listen and Practice — next steps"
labels: [wayfinder:map]
status: closed
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

- [Steadier tuner needle](062-steadier-tuner-needle.md) — adaptive EMA needle (τ ~180→35 ms, display-only); hold
  locked MIDI through unlocks for tuner *and* Practice; clear after ~150 ms silence; Practice never uses EMA
- [Analysis in an AudioWorklet](063-analysis-in-an-audioworklet.md) — stay on rAF + AnalyserNode; window length
  dominates latency; revisit only for timed Practice or after adaptive windows
- [Analysis window by register](064-analysis-window-by-register.md) — fftSize + minHz from instrument concert
  low (512…4096); Concert stays 2048/55 Hz; no dual/last-pitch windows yet
- [Echo guard with speakers](065-echo-guard-with-speakers.md) — keep 250 ms deaf + ±octave while ringing; Silent
  false-counts at the same rate → not echo leakage ([Baseline false counts](067-baseline-false-counts.md))

## Not yet specified

- **[Practice feedback](066-practice-feedback.md)** — **shelved** while Listen audio fixes ship; resume after
  [Baseline false counts](067-baseline-false-counts.md) (a scorecard would poison on false counts).
- **Practice beyond the five rules**: a timed / BPM mode (the form moves on the beat and Practice scores what you
  played against it) — hangs on detection responsiveness in general (adaptive windows first; worklet only if
  audio-clock lock under load becomes necessary).
- **Instrument-specific tuning of the detector** (thresholds, clarity cut-off, octave-error guards per instrument
  family) — after [Baseline false counts](067-baseline-false-counts.md); still needs real-instrument HITL per family.

## Out of scope

- Polyphonic detection (chords on piano / guitar): a different class of analysis; Listen stays one note at a time.
- Recording or transcribing what is played into the melody.
- Phone layout of the chart (cap bars per row on narrow screens) and the product name / SEO — separate efforts, not
  about listening.

## Resolution

**Dropped** (2026-11-16): superseded by [Mode menu](068-mode-menu.md). Practice and its note-driven advance rules are
gone; Listen now serves Tune and Improvise, where heard notes only light the hex and show on the tuner — they never
move the form on, and nothing is scored. The decided tickets above stay valid for Listen as it is ([Steadier tuner
needle](062-steadier-tuner-needle.md), [Analysis in an AudioWorklet](063-analysis-in-an-audioworklet.md),
[Analysis window by register](064-analysis-window-by-register.md), [Echo guard with speakers](065-echo-guard-with-speakers.md)).
The open ones are dropped: [Practice feedback](066-practice-feedback.md) (nothing left to score) and [Baseline false
counts](067-baseline-false-counts.md) (no counts). *Practice beyond the five rules* is answered by the transport.
If stray note-starts lighting the hex prove a problem in Tune / Improvise, that is a new ticket against SPEC §9.2.
