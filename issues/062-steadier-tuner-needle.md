---
id: 62
title: "Steadier tuner needle"
labels: [wayfinder:prototype]
status: open
parent: 61
blocked_by: []
assignee:
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
