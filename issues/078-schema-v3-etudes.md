---
id: 78
title: "Schema v3: a progression's etudes"
labels: [ready-for-agent]
status: open
blocked_by: []
assignee:
---

## Parent

[Etudes belong to a progression](077-etudes-belong-to-a-progression.md) (SPEC §12)

## What to build

The v3 data shape and the way there, in the pure modules (`progression.ts`, `schema.ts`, `storage.ts`):

- `Progression = { title, timeSignature, barsPerRow, bars, etudes }`; `Etude = { id, name, instrument, concertClef?,
  melody }`. `id` is unique within its progression (`crypto.randomUUID()`), stable across edits.
- `SCHEMA_VERSION = 3`. **`migrate2to3`**: `instrument`, `concertClef`, `melody` move into one etude named
  `etudeName` (trimmed) or *Etude 1*; `etudeName` is dropped. Always exactly one etude, even with an empty melody.
- **Repair** (§12.3): `etudes` not an array or empty → one default etude (*Etude 1*, Concert, empty melody); each
  etude gets today's melody repair against the form (shortening crossings, dropping bad events) and today's
  instrument / clef repair (unknown instrument → Concert, counted); a non-object entry is skipped; a missing or
  duplicate `id` gets a fresh one; a blank name → *Etude N*.
- `newProgression(instrument)`: one empty *Etude 1* on that instrument.
- Storage on launch migrates v2 keys to v3 through the same chain (written back, device `v` bumped), as today.
- Helpers the later slices use: `etudeOf(p, id)` (missing id → the first), `withEtude(p, id, fn)` (replace one
  etude by a function of it).

Callers that read `p.melody` / `p.instrument` are adapted to the first etude for now, so the app keeps working
unchanged on one etude until [080](080-session-open-etude.md).

## Acceptance criteria

- [ ] Both bundled demos (`examples/*.tonepath.json`, v2) migrate to one etude each, notes and instrument intact
- [ ] A v2 file with `etudeName` names its etude after it; without, *Etude 1*
- [ ] Repair table: missing / empty `etudes`, a bad entry, duplicate ids, blank names, an unknown instrument, a
      melody crossing a slot — each repaired and counted as in §12.3
- [ ] v1 files still import (v1 → v2 → v3)
- [ ] The app opens and edits as before (one etude)

## Blocked by

None.
