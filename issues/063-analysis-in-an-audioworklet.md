---
id: 63
title: "Analysis in an AudioWorklet"
labels: [wayfinder:research]
status: closed
parent: 61
blocked_by: []
assignee: claude
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

## Assets

- [research/analysis-in-an-audioworklet.md](../research/analysis-in-an-audioworklet.md)

## Resolution

**Stay** on the main-thread rAF + `AnalyserNode` path. Do not move pitch or onset into an AudioWorklet for the
next Listen / Practice slices. Full findings: [research/analysis-in-an-audioworklet.md](../research/analysis-in-an-audioworklet.md).

- **Window length dominates** first-note latency (~43 ms at 2048 / 48 kHz). A worklet cannot shrink that; adaptive
  windows are the lever ([Analysis window by register](064-analysis-window-by-register.md)).
- Hopping every 128-sample quantum mainly trims two-equal-readings lag (~1–2 display frames) — a small slice of the
  ~50–80 ms total — while the tuner still updates at display rate.
- Full YIN every quantum (~9×10⁵ MACs + per-call typed-array allocs in today's `detectPitch`) is hostile to the
  ~2.7 ms audio-thread budget unless hop-throttled back to ~60 Hz anyway.
- AudioWorklet is Baseline-available, but Vite needs a separate `?url` / `addModule` entry; Safari/iOS has
  gesture and `getUserMedia`/context/`addModule` order quirks; SAB needs COOP/COEP Improwiser does not ship.
- Listen already limits chart re-renders; Practice is foreground and gesture-driven — background-tab continuity
  is not a product need.

**Revisit** only if timed / BPM Practice needs audio-clock-locked detection under main-thread load, or after
register-adaptive windows make hop rate (not window fill) the bottleneck.
