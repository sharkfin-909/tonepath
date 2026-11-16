---
id: 67
title: "Baseline false counts"
labels: [wayfinder:grilling]
status: closed
parent: 61
blocked_by: []
assignee:
---

## Question

Practice sometimes **counts notes when the player is not playing** — same rate with *On arrival* Silent as with
Chord (so not echo leakage; see [Echo guard with speakers](065-echo-guard-with-speakers.md)). What should suppress
these baseline false note-starts?

Decide among (or combine): raise the onset gate / clarity cut-off; require a stronger attack (ratio / rising);
lengthen the two-equal lock; a noise-floor–relative gate; hold-through-unlock alone (already decided on
[Steadier tuner needle](062-steadier-tuner-needle.md)) once built; product copy (quiet room / gain); or defer into
instrument-specific detector tuning. What is in scope for the next build vs left to later HITL per instrument.

## Resolution

**Dropped** (2026-11-16) with its map ([061](061-map-listen-and-practice-next.md)): [Mode menu](068-mode-menu.md)
removes note counting. Heard notes now only light the hex (Tuner, Improvise stopped); if baseline false note-starts
make that flicker, open a new ticket against SPEC §9.2.
