---
id: 65
title: "Echo guard with speakers"
labels: [wayfinder:task]
status: closed
parent: 61
blocked_by: []
assignee: claude
---

## Question

Does Practice's **echo guard** (SPEC §3.7: deaf for 250 ms after an *On arrival* sound, then ignoring its own pitches
± an octave while it rings) hold up with a **real mic and speakers**, or does the app's own chord / bass still get
counted as played notes?

HITL task: practise the rhythm changes demo through laptop speakers with each *On arrival* option (Chord, Root note,
Bass note, Bass note + chord) and each advance rule, at a few input levels; note any count jumps or false advances
right after a slot change, and whether browser echo cancellation is doing the work. Record what was found (and the
browser / device) so the guard's timings can be set from evidence, or a "headphones recommended" note decided.

## Resolution

HITL on laptop speakers (2026-11-15): **false counts happen, but at the same rate with *On arrival* Silent as with
Chord** (and the other sounding options). So they are **baseline Listen / room / gain false note-starts**, not the
app's *On arrival* leaking past the guard.

1. **Keep the echo guard as specified** — deaf **250 ms**, then ignore guarded pitches **±1 octave** while the sound
   rings (chord ~3.2 s, root/bass ~1.1 s). No evidence to lengthen deaf-ms or widen the pitch match.
2. **No new “headphones required” product rule** from this ticket — headphones still avoid speaker coupling (SPEC
   already notes that), but they would not fix the Silent-mode false counts.
3. Baseline false counts → new ticket [Baseline false counts](067-baseline-false-counts.md).
