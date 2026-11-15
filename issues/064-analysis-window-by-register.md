---
id: 64
title: "Analysis window by register"
labels: [wayfinder:research]
status: open
parent: 61
blocked_by: [63]
assignee:
---

## Question

Should the analysis window **adapt to the register** — shorter for high notes (they need less sound to measure, so
they could read faster), longer for low ones (below ~A1 the fixed 2048-sample / ~43 ms window holds too few cycles,
so bass and baritone notes are slow or missed)?

Find out: the cycles YIN needs for a stable reading; a scheme (e.g. two windows run together, or a window chosen from
the instrument's range, or from the last detected pitch) and its CPU cost; how it interacts with onset detection and
the two-equal-readings rule; whether the instrument view's range (SPEC §10) is enough to pick a window per
instrument. Depends on where analysis runs ([Analysis in an AudioWorklet](063-analysis-in-an-audioworklet.md)).
