---
id: 23
title: "Melody data and schema"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: [26]
assignee: cursor
---

## Question

What is the stored shape of the etude melody under [Etude pivot](018-etude-pivot.md) + [Docked hex pivot](026-docked-hex-pivot.md)? Define the **melody event** model (pitch | rest + duration), where the sequence lives on a progression (not per slot — slots only *display* their time slice), how it interacts with time signature / bar alignment, and how [Saved data and JSON schema](015-saved-data-and-json-schema.md) migrates off the old per-slot note-set shape (envelope, `v` bump, demo file).

## Resolution

Grilled 2026-11-13. Glossary updated in [CONTEXT.md](../CONTEXT.md). Demo: [demo.improwiser.json](../examples/demo.improwiser.json) (`v: 2`).

1. **Progression shape (v2).** Same envelope and top-level fields as [Saved data and JSON schema](015-saved-data-and-json-schema.md), plus a progression-level **`melody`** array. Slots are `{ "chord", "scale"? }` only — **no `notes`**.
   ```json
   { "title": "ii–V–I in C", "timeSignature": "4/4", "barsPerRow": 4, "instrument": "concert",
     "bars": [ [ { "chord": "Dm7" } ], [ { "chord": "G7" } ], … ],
     "melody": [
       { "pitch": 62, "d": "q" },
       { "d": "q" }
     ] }
   ```
2. **Melody event.** Note: `{ "pitch": <0–127 concert MIDI>, "d": <dur> }`. Rest: `{ "d": <dur> }` (no `pitch`). Duration ids: `w` | `h` | `q` | `e` | `s` (whole → sixteenth). Spelling never stored.
3. **Time signature is structural for layout.** Parse `N/D` from `timeSignature` (display string still shown as typed). One bar = `N` beats of `1/D`; split slots bisect that duration. Unparseable / missing → layout as `4/4` (same repair spirit as v1).
4. **Length vs form.** Melody may be **shorter** than the form (trailing empty staves). It must not run past the last bar: caret cannot leave the progression; on import, **drop** trailing events that don’t fit. No auto-extending the bar grid from the melody.
5. **Clear all.** UI control sets `melody` to `[]` in one edit (**one undo step**, no confirm). Leaves chords, scales, title, instrument untouched.
6. **Migration `v` 1 → 2.** On storage and imports: strip every slot’s `notes`; set `melody` to `[]` if missing; bump `v` to 2. Old note-sets are not converted (they were unordered pitch sets, not a timed line).
7. **Import repairs (melody).** Missing `melody` → `[]`. Non-array → `[]`. Each event: must be an object with `d` in the five ids; `pitch` if present must be an integer 0–127 (else event dropped); rest = no `pitch` key. Unknown keys on events ignored. After repair, drop a suffix of events whose cumulative duration exceeds the form’s total duration. Other v1 repairs (title, bars, chords, scales, instrument) unchanged.
8. **Demo.** Same four bars `Dm7 | G7 | Cmaj7 | Cmaj7` in Concert, with a short sample melody (includes one rest) so first launch shows in-slot notation.

Unchanged from v1: localStorage layout, ids, envelope `kind`, device key, library bundle rules, instrument/scale stable ids.
