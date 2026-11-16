---
id: 82
title: "Library and files at v3"
labels: [ready-for-agent]
status: closed
blocked_by: [78]
assignee: claude
---

## Parent

[Etudes belong to a progression](077-etudes-belong-to-a-progression.md) (SPEC §3.5, §12.3)

## What to build

- **Library rows** (§3.5): the instrument column becomes the etudes — *1 etude · B♭ trumpet*, *3 etudes · alto sax,
  B♭ trumpet* (distinct instruments, in etude order). Duplicate copies every etude (fresh etude ids). New: one
  empty *Etude 1* on the device's last-picked instrument.
- **Files** (§12.3): *Export one* / *Export all* write `v: 3` with every etude (name, instrument, clef, melody;
  ids left out like the progression's — done in 078). **Import** runs v1 / v2 / v3 through the migration chain and repair
  ([078](078-schema-v3-etudes.md)), giving each etude a fresh id; the toast counts as today (notes shortened,
  unknown instruments → Concert, across all etudes).
- **Demos** (§12.5): the bundled demo files stay v2 (they migrate on import) or are re-exported as v3 — either way
  each seeds one etude.

## Acceptance criteria

- [x] Round trip: a two-etude progression exports and imports back equal (but for ids and timestamps)
- [x] A v2 export from the current app imports as one etude
- [x] Library rows show the etude count and instruments; Duplicate copies every etude
- [x] A newer `v` (4) is still rejected with the "newer Tonepath" message

## Blocked by

- [078](078-schema-v3-etudes.md)

## Resolution

Most of it landed with 078 (files at v3, etude ids left out and re-made on import, v1 / v2 through the chain) and
080 (`etudeSummary` on library rows). Added here: tests for the row summary and for Duplicate copying every etude.
Etude ids are only unique within a progression, so Duplicate keeps them (no fresh ids needed). The demos stay v2
files and migrate on import (checked on real storage).
