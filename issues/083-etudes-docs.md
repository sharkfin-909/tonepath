---
id: 83
title: "Docs: etudes in a progression"
labels: [ready-for-agent]
status: closed
blocked_by: [80, 81, 82]
assignee: claude
---

## Parent

[Etudes belong to a progression](077-etudes-belong-to-a-progression.md)

## What to build

Bring the docs in line with the built behaviour:

- **SPEC.md** — §3.1 (the etude picker in the header, every mode), §3.2 / §3.4 (Write etude and Read etude work on
  the open etude), §3.5 (library rows, Duplicate, New), §6 (the melody is the open etude's; Clear all), §10 (the
  instrument is the etude's), §12.2 (the v3 shape, replacing v2), §12.3 (export / import / repairs for etudes),
  §12.4 (`migrate2to3`), §14 (the new test tables).
- **CONTEXT.md** — **Etude** becomes a stored thing with a name, an instrument and a melody, one of a progression's
  (at least one); **Progression** loses the instrument and the single melody; add **Open etude** (the one the screen
  is set to, last-open remembered per progression); **Etude picker**; update *Melody*, *Clear all*, *Instrument*
  wording. Drop `etudeName`.
- **README.md** — the data model line, if it names the melody or instrument.

## Acceptance criteria

- [x] No doc says a progression has one melody or one instrument
- [x] §12.2's example is a v3 progression with two etudes
- [x] CONTEXT.md terms match the code's names (`etudes`, `Etude`, `openEtudeId`)

## Blocked by

- [080](080-session-open-etude.md)
- [081](081-etude-picker.md)
- [082](082-library-and-files-v3.md)

## Resolution

SPEC: new §3.9 *Etudes* (open etude, picker, switching, last open); §3.1, §3.4, §3.5, §4.1, §6.1, §6.2 item 10, §6.3,
§7.3, §10, §12.2–12.5 and §14 (table 10) updated; §12.2 now shows a two-etude v3 progression. CONTEXT.md: *Etude*
(stored, named, with its instrument), *Open etude*, *Etude picker*, *Progression* (no instrument, holds etudes),
*Melody*, *Clear notes / all*, *Editing session*, *Instrument view*. README: the summary and the built list.
