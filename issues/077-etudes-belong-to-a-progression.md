---
id: 77
title: "Etudes belong to a progression"
labels: [wayfinder:grilling]
status: closed
blocked_by: []
assignee:
---

## Question

A progression holds one melody today (the etude). Store chord sequences with several etudes linked to them: the app
loads a progression, which contains an array of etudes.

## Resolution

Settled in a planning session (2026-11-16). Build slices: [078](078-schema-v3-etudes.md) ·
[079](079-bar-edits-carry-every-etude.md) · [080](080-session-open-etude.md) · [081](081-etude-picker.md) ·
[082](082-library-and-files-v3.md) · [083](083-etudes-docs.md).

1. **Shape (schema v3).** `Progression = { title, timeSignature, barsPerRow, bars, etudes }`;
   `Etude = { id, name, instrument, concertClef?, melody }`. The chords, the form and the time signature are the
   progression's, shared by its etudes; an etude is a melody over that form. `melody` and `etudeName` leave the
   progression. Still one storage key per progression, its etudes inside; the library lists progressions.
2. **The instrument lives on the etude** (with the Concert clef). The screen — every mode, Improvise and Tune too —
   follows the **open etude**'s instrument: the chart's transposition, Tune's range, chord entry in written pitch,
   the hex. `Ins:` sets the open etude's instrument. A new etude takes the open etude's instrument; a new
   progression's first etude takes the device's last-picked instrument.
3. **Improvise stays a bare lead sheet** — it shows no etude's melody; it uses the open etude only for its instrument.
4. **A progression always has at least one etude.** Deleting the last one replaces it with a fresh, empty
   "Etude 1" on the same instrument. Migration and repair guarantee one.
5. **Opening a progression reopens its last-open etude** (missing → the first).
6. **The etude picker shows in every mode**, since the open etude also sets the instrument.
7. **Form edits carry every etude**: insert, delete, duplicate, split, merge, paste and the time-signature refit
   apply to every etude's melody alike. Copy / Paste carries the chords and the **open** etude's slice; pasting writes
   it into the open etude, the others get rests in the pasted bars. Chord edits never move notes.
8. **Undo** stays whole-progression snapshots, so it covers etude edits (add, rename, delete, notes) and form edits
   alike.
9. **Built** (2026-11-16): 078–083 closed. Deviations from the plan: etude ids are short and deterministic (`e1`,
   `e2`, …), not UUIDs; 079 was built with 078; *Etude N* takes the lowest free N among the names.
