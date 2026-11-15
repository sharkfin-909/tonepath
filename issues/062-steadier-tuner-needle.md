---
id: 62
title: "Steadier tuner needle"
labels: [wayfinder:prototype]
status: closed
parent: 61
blocked_by: []
assignee: claude
---

## Question

How should the tuner's cents reading be **smoothed** so the needle is calm on a sustained note but still follows a
real pitch bend or a new note promptly? Today every per-frame reading moves it (eased only by a 70 ms CSS slide),
so it wobbles on vibrato and breath noise.

Options to compare on a prototype page (synthetic tones with vibrato, slow bends and noise, then a real instrument):
a moving average over the last N readings; a median of the last N (robust to single bad readings); an exponential
smoother whose speed rises with the size of the change; holding the note name while only the needle smooths.
Decide the method and N / time constant, and whether Practice's note detection should use the same smoothing or
stay raw.

## Assets

- [prototypes/steadier-tuner-needle/index.html](../prototypes/steadier-tuner-needle/index.html) — side-by-side
  needles (Today / mean / median / adaptive EMA / hold-name) on synthetic scenarios + mic. Run:
  `npm run proto:tuner` → http://localhost:8765/steadier-tuner-needle/

## Resolution

Prototyped and confirmed with the user on 2026-11-15; revised the same day after the tuner flash-through-**—** was
noticed before a reading settles.

1. **Needle = adaptive EMA** on the exact-MIDI continuum: τ ≈ **180 ms** when the change is small (calm on
   sustain / vibrato), τ ≈ **35 ms** when |Δ¢| is large (tracks bends and note changes). Rejected: moving average
   and median (lag on jumps; N-dependent plateau), and today's raw + 70 ms CSS (wobbles on breath/vibrato).
2. **Note name from the two-frame steady lock**, not from EMA MIDI. Rejected: letting the smoothed value rename the
   display (name would drift toward neighbours during a bend).
3. **Hold-through-unlock (display and Practice):** once a note is locked, keep publishing that MIDI through brief
   unlocks (attack gaps, neighbour flicker). Switch only when a *new* note locks; clear only after ~**150 ms** of
   real silence. Kills the flash through **—** / a wrong neighbour. This held MIDI is what Practice's note-starts
   see (still via two-frame lock + NoteTracker), so false silence→re-attack counts drop too.
4. **EMA stays display-only** (the cents needle). Practice must **not** take note-starts from the EMA — that would
   lag real changes and smear across boundaries on bends / wide vibrato. "Raw" here means *not EMA*, not "flash
   nulls at the tuner".
