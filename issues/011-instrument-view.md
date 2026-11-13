---
id: 11
title: "Instrument view"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

Pin down instrument view, which [Lattice editing interaction](008-lattice-editing-interaction.md) pulled into v1 (written-pitch display; chart and sound stay concert). Which instruments ship in v1 (prototype: Concert, B♭ trumpet/clarinet, B♭ tenor sax, E♭ alto, E♭ bari, F horn — guitar/bass octave? soprano sax?)? Is the setting per progression (saved in JSON), per device, or both? Is it shown anywhere on the chart (e.g. title "for B♭")? Confirm that typed notes and chord symbols are read as written. **Range limits (pulled into v1 during [Rendering approach](010-rendering-approach.md)):** what range does each instrument get (source for the numbers; written or concert)? Are out-of-range notes blocked on entry, allowed but flagged (dimmed / outlined), or both depending on input path (piano strip narrowed vs typed note)? Do unreachable octave columns disappear? What happens when switching instrument leaves existing notes out of range? Can the user adjust the range (e.g. altissimo)? How does it interact with enharmonic spelling rules from [Enharmonic spelling](007-enharmonic-spelling.md) — spell from the transposed symbol (prototype) and keep "typed spelling decides" for the concert root?

## Resolution

Grilled with the user, 2026-11-12. Terms recorded in [CONTEXT.md](../CONTEXT.md).

1. **Instruments, not transpositions.** The view is chosen from a list of **instruments**, each with a name, a **transposition** (written = concert + interval, octave included, spelled as an interval e.g. major 9th) and a **written range**. `Concert` has no range limit.
2. **v1 list** (adding one is a data row):
   | Instrument | Written vs concert |
   |---|---|
   | Concert (no limit), Flute, Violin, Trombone, Vibraphone | unison |
   | B♭ trumpet, B♭ clarinet, B♭ soprano sax | up M2 |
   | B♭ tenor sax | up M9 |
   | E♭ alto sax | up M6 |
   | E♭ baritone sax | up P8 + M6 |
   | F horn | up P5 |
   | Guitar, Double bass / bass guitar | up P8 |
   Deliberately out: voice (too variable — use Concert), piano (= Concert), rarer instruments (later rows). Clefs are irrelevant (no notation).
3. **Ranges** are stored in **written pitch** and are **practical**, not extreme. Numbers come from [Instrument practical ranges](013-instrument-practical-ranges.md).
4. **Out of range is flagged, never blocked** — one rule for every input path, so a chart can be viewed as any instrument. On the chart: **hollow and faded** (role-coloured outline, faded letter). Piano strip: out-of-range keys **dimmed but clickable**; typed notes accepted. Out-of-range notes still audition.
5. **Octave columns** = the octaves the instrument's written range touches ∪ octaves holding any note (so a flagged note always has a column). Concert: 3–5 ∪ octaves in use. Columns stay chart-wide ([Rendering approach](010-rendering-approach.md)).
6. **No user-adjustable ranges in v1** (flags never block; Concert is the escape hatch). Custom ranges → post-v1.
7. **Setting lives on the progression** (saved, and in JSON export). The device remembers the **last-picked instrument** as the default for new progressions. Switching on an open chart updates both.
8. **Shown once, beside the title** — e.g. *Autumn Leaves · E♭ alto sax* (*Concert* when concert); that label is the dropdown. It moves out of the keyboard panel.
9. **Input is written pitch** in a non-Concert view: notes, piano keys and chord symbols. Stored as concert by the inverse interval; stored chord symbols are spelled by interval with at most one accidental (as [Enharmonic spelling](007-enharmonic-spelling.md)), so "typed spelling decides" holds in Concert and flows through the interval otherwise. Accepted edge: a root needing a double accidental is simplified and may redisplay respelled (E♭ view `Fb7` → concert `G7` → shown `E7`). All other spelling rules (note names, lean, default set) run against the **written** symbol.
10. **Piano strip** spans exactly the chart's octave columns (C of the lowest to B of the highest); dimmed keys for out-of-range; scrolls sideways beyond ~4 octaves.

Rejected: transposition-only list (ranges need instruments); concert-pitch ranges (players think written); extreme ranges; blocking out-of-range entry, or blocking on entry but flagging on switch (two rules); fixed per-instrument columns (flagged notes would have nowhere to go); custom ranges in v1; device-only or progression-only setting; dropdown in the keyboard panel.
