---
id: 63
title: "Analysis in an AudioWorklet"
labels: [wayfinder:research]
status: open
parent: 61
blocked_by: []
assignee:
---

## Question

Should pitch and onset detection move from the animation-frame loop into an **AudioWorklet** on the audio thread?

Today analysis runs once per screen refresh (~60 Hz, 120 Hz on high-refresh screens), so its rate depends on the
display, it stalls when the page is busy, and it **stops in background tabs**. A worklet would run at a fixed rate
tied to the audio clock (e.g. every 128-sample render quantum, analysing a hop-sized step of a ring buffer), could
react faster to attacks, and keeps running while hidden.

Find out: browser support and quirks (Chrome, Safari incl. iOS, Firefox); how to load a worklet module under Vite
(and in the static build); the cost of YIN per hop on the audio thread (budget per quantum) vs. doing it in the
worklet but posting results at a lower rate; how results reach React without per-message re-renders; what latency is
actually gained over the current ~50–80 ms to first reading. Recommend: move, partly move (onsets in the worklet,
pitch on the main thread), or stay.
