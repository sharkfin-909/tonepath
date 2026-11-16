---
id: 78
title: "Schema v3: a progression's etudes"
labels: [ready-for-agent]
status: closed
blocked_by: []
assignee: claude
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

- [x] Both bundled demos (`examples/*.tonepath.json`, v2) migrate to one etude each, notes and instrument intact
- [x] A v2 file with `etudeName` names its etude after it; without, *Etude 1*
- [x] Repair table: missing / empty `etudes`, a bad entry, duplicate ids, blank names, an unknown instrument, a
      melody crossing a slot — each repaired and counted as in §12.3
- [x] v1 files still import (v1 → v2 → v3)
- [x] The app opens and edits as before (one etude)

## Blocked by

None.

## Resolution

Built: `Etude` / `Progression` (v3) in `progression.ts` with `etudeOf`, `withEtude`, `setMelody`, `freshEtudeId`;
`migrate2to3` and etude repair in `schema.ts`; storage migrates on launch (checked on real v2 storage: both demos
became one etude, notes intact). Etude ids are short and deterministic (`e1`, `e2`, …: unique within their
progression), not UUIDs — migration stays pure and tests stable. Files leave etude ids out (as the progression's);
import gives fresh ones. The session already carries `etude` (the first) so 080 only has to choose and switch it.
