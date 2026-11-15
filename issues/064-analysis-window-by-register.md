---
id: 64
title: "Analysis window by register"
labels: [wayfinder:research]
status: closed
parent: 61
blocked_by: [63]
assignee: claude
---

## Question

Should the analysis window **adapt to the register** — shorter for high notes (they need less sound to measure, so
they could read faster), longer for low ones (below ~A1 the fixed 2048-sample / ~43 ms window holds too few cycles,
so bass and baritone notes are slow or missed)?

Find out: the cycles YIN needs for a stable reading; a scheme (e.g. two windows run together, or a window chosen from
the instrument's range, or from the last detected pitch) and its CPU cost; how it interacts with onset detection and
the two-equal-readings rule; whether the instrument view's range (SPEC §10) is enough to pick a window per
instrument. Assume the **current main-thread rAF + AnalyserNode path**
([Analysis in an AudioWorklet](063-analysis-in-an-audioworklet.md) decided stay).

## Assets

- [research/analysis-window-by-register.md](../research/analysis-window-by-register.md)

## Resolution

**Adapt `fftSize` + `minHz` from the instrument’s practical concert low** on the existing rAF + AnalyserNode path.
Do not keep fixed 2048 for every instrument; do not ship dual windows or last-pitch-driven `fftSize` yet.
Full findings: [research/analysis-window-by-register.md](../research/analysis-window-by-register.md).

- YIN needs ~two periods of the lowest expected F0; with Improwiser’s `w = N/2`, floor ≈ `sr/(N/2)`. Fixed 2048 /
  55 Hz **misses bass open E1** (~41 Hz) and overpays high instruments (~43 ms fill).
- **Scheme:** on Listen start (and instrument change while listening), set `analyser.fftSize` to the smallest
  power of two in **512…4096** with `fftSize/2 ≥ ⌈sr/f_low⌉`, pass `minHz ≈ f_low`. Concert (no range) stays
  **2048 / 55 Hz**. Examples @48 kHz: bass **4096 / ~85 ms**; bari/trombone **2048**; tenor/clarinet **1024**;
  flute **512 / ~11 ms**.
- Window is **static per instrument** — compatible with onset, two-equal lock, and
  [Steadier tuner needle](062-steadier-tuner-needle.md) hold-through-unlock. CPU at 60 Hz is fine even at 4096.
- SPEC §10 ranges are enough to pick the window. Thresholds / clarity / octave guards stay in map fog (need
  real-instrument HITL). Build may confirm 512 vs 1024 for violin/soprano timbre.
