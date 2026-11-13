# Local-markdown issue tracker

One issue per file: `NNN-slug.md`. The number is the issue's id.

## Frontmatter

```yaml
id: 3
title: Bar grid and progression
labels: [wayfinder:grilling]
status: open            # open | closed
parent: 1               # map's id (child issues only)
blocked_by: [2, 4]      # ids; ticket is unblocked when all are closed
assignee:               # empty = unclaimed
```

## Wayfinding operations

- **Map:** the issue labelled `wayfinder:map`. Its tickets have `parent: <map id>`.
- **Claim:** set `assignee:` before any work.
- **Blocking:** no native relation here, so `blocked_by:` in frontmatter is the convention.
- **Frontier:** children of the map with `status: open`, every `blocked_by` id closed, and `assignee` empty. Lowest id first.
  Quick query: `grep -l "^parent: 1$" issues/*.md | xargs grep -l "^status: open"` then check `blocked_by`/`assignee`.
- **Resolve:** append a `## Resolution` section (the resolution comment), set `status: closed`, add a line to the map's *Decisions so far*.
- **Assets:** linked from the issue (e.g. `research/<name>.md`, prototype folders), not pasted in.

## Build issues

- Build slices (from [SPEC.md](../SPEC.md)) have no `parent:`. Triage labels: `ready-for-agent` (AFK, can be picked up and built without a human) and `needs-human` (HITL).
- Next to build: `status: open`, `ready-for-agent`, every `blocked_by` closed, `assignee` empty. Lowest id first.
