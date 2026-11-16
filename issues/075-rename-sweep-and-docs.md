---
id: 75
title: "Rename sweep and docs"
labels: [ready-for-agent]
status: closed
blocked_by: [70, 71, 73, 74]
assignee:
---

## Parent

[Mode menu](068-mode-menu.md) (SPEC §3)

## What to build

Remaining identifiers, CSS classes and comments move to the glossary's terms (Tuner, Improvise, Write etude, Read
etude, transport); stale `SPEC §` citations are fixed; SPEC's "not yet built" note comes out; README's state of play
and the module table match the code.

## Acceptance criteria

- [x] No Practice / Explore / Etude view / Audio input / Play-mode wording left in `src/` (except storage key names)
- [x] SPEC, CONTEXT and README describe the built app

## Blocked by

- [070](070-tuner-mode.md)
- [071](071-open-in-tuner-with-mic-states.md)
- [073](073-improvise-edits-the-lead-sheet.md)
- [074](074-read-etude-with-the-transport.md)

## Resolution

Done: `practice-*` classes → `transport-*`, unused switch CSS removed, comments reworded; SPEC §2, README, CONTEXT updated.
