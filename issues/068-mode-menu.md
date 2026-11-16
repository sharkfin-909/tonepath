---
id: 68
title: "Mode menu: Tuner, Improvise, Write etude, Read etude"
labels: [wayfinder:grilling]
status: closed
blocked_by: []
assignee:
---

## Question

Replace the Mode dropdown (Explore · Practice · Write · Etude view) and the Audio input switch with a mode menu where
each mode is defined by what it offers. The starting plan:

- **Tuner** — tuner bar; no transport bar; no chart; hex lights up showing notes played.
- **Improvise** — tuner bar; transport bar; chart as lead sheet; hex showing the active slot, lit only while the
  transport is stopped.
- **Write etude** — editing bar; hex note input; no transport bar.
- **Read etude** — transport bar; no tuner bar; no hex.

## Resolution

Settled in a grilling session (2026-11-16). SPEC §3 and CONTEXT.md carry the result.

1. **The mode decides the mic.** The Audio input switch is removed: Listen is on in Tuner and Improvise, off in
   Write etude and Read etude. Writing the etude by playing (Write with Audio input) is dropped.
2. **Improvise is driven by the transport only.** Every note-driven advance rule (guide tone, chord tone, note count,
   count then guide tone, Follow the etude) is dropped. Stopped, the player steps slots by hand.
3. **Read etude's transport** = click + playhead (current slot highlighted) + *Audio on chord* as accompaniment.
   Melody playback is a later, separate toggle.
4. **Tuner's hex** is the unchecked hex (no chart → no active slot); it lights whatever is played, chromatic notes too.
5. **Every open and reload starts in Tuner**, so the browser may ask for the mic straight away. This reverses the old
   "the mic never starts by itself" rule. Where the browser holds audio until a gesture, the tuner bar shows *tap to
   start listening*.
6. **Mic unavailable** (denied, no device, insecure origin): the mode stays; the tuner bar says why; hex clicks still
   work.
7. **Improvise edits the lead sheet**: chords and scales, plus a small form group (time signature, bars per row,
   undo / redo), the "+" and the bar trash cans. Bar numbers pick looped bars; the ⋯ bar menu stays in Write etude.
   Form editing hides while the transport runs.
8. **Improvise's hex**: transport running → the upcoming chord's tones with target rings, played notes not lit;
   stopped → the current slot's scale (with travel), played notes lit.
9. **The sound pill shows in every mode**; in Tuner, the controls that need a chord are greyed.
10. **Read etude, stopped**: clicking a slot moves the playhead there (silent); clicking a note auditions it (and moves
    the playhead to its slot); ▶ Chord / Bass / Scale work; bar numbers pick looped bars; nothing edits. Running:
    clicks on the chart do nothing.
11. **Keys**: Mode order Tuner · Improvise · Write etude · Read etude; `[` / `]` previous / next mode (no wrap); `\`
    toggles Write etude ↔ Read etude; `P` retired.
12. **Carried between modes**: the current slot (Write etude's caret ↔ the playhead: caret's slot on the way out,
    the slot's start on the way back), the looped bars / bar selection; tempo, click sound and Loop are device
    settings shared by both transports. Switching modes stops the transport. The metronome switch is gone (the
    transport *is* the metronome).
13. **Explore is dropped** — Improvise stopped and Tuner cover it.
14. **Hide hex** is offered in Improvise only; Write etude always shows the hex, Tuner always, Read etude never.
15. **Tuner layout**: the usual layout with an **empty chart pane** of the same height, so nothing moves between
    modes; the tuner bar sits where it does today.
16. **Read etude's header** is the normal two rows: row 1 as everywhere; row 2 Library / names on the left, the
    transport centred, Ins: right. The chart keeps Fit page.
17. **Names**: Tuner mode, Improvise mode, Write etude, Read etude, Transport; Practice, Explore, Etude view and
    Audio input go to *Avoid*. Code identifiers are renamed in the same change; `practice` / `practiceRun` are cut
    down to what the transport needs (looped bars, slot ranges, targets) or folded into `metronomeRun` during the
    build.
