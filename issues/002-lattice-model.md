---
id: 2
title: "Lattice model"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: []
assignee: claude
---

## Question

What is a lattice, structurally? One lattice per bar, or one spanning the whole progression with notes belonging to bars? Can links cross bar lines (they must, for a melody to move from bar to bar — how)? Are links directed or undirected? Can the same pitch appear more than once in a bar? What exactly is a *path*, and is a note tied to a beat position or just to a bar?

## Resolution

Grilled with the user, 2026-11-12. Terms recorded in [CONTEXT.md](../CONTEXT.md).

1. **Ownership** — every note belongs to exactly one bar and is coloured against that bar's chord.
2. **Zones** — each note is in exactly one zone of its bar: **entry** (left edge), **body** (free layout, no time meaning), **exit** (right edge). Zones are an explicit note property, not just drag position. This is the lattice's *only* time-based element.
3. **Repeated pitches** — the same pitch may appear more than once in a bar, in any zones (e.g. `B3` in entry and exit to sustain). No special rule.
4. **In-bar links** — undirected; may join any two notes in the same bar regardless of zone. No self-links, no duplicate links.
5. **Bridges** — forward-only, from an exit note of bar *n* to an entry note of bar *n+1*; editor enforces this (only valid targets light up while dragging). Drawn short across the bar line, no arrowheads.
6. **Wrap bridges** — last bar's exits may bridge to bar 1's entries; drawn as matching stubs at each edge. (If repeats/endings arrive via Bar grid and progression, the target becomes the repeat target.)
7. **Path** — enter at an entry note, walk in-bar links freely (revisits OK), reach an exit, take a bridge. No rhythm; the player and their metronome supply it.
8. **Dead ends** — a bar with no entry or no exit notes is allowed; it gets a subtle background tint as a hint, never a block.

Rejected: per-bar islands (loses voice-leading across bar lines); free graph with long-range links (unreadable); position-only edges (breaks readability on first messy lattice); `through` zone / entry-exit flags (one zone per note is simpler).

**Amended by [Bar grid and progression](003-bar-grid-and-progression.md):** the lattice unit is the **chord slot** (a bar holds one or two). Read "bar" above as "slot": notes belong to a slot, bridges run slot → next slot (including within a bar), wrap bridge runs last slot → first.

**Superseded by [Lattice editing interaction](008-lattice-editing-interaction.md):** links, bridges, wrap bridges, paths, zones and dead-end tints are dropped. A slot holds a **note set** — pitches coloured against its chord, each pitch at most once. Only rule 1 (ownership) survives.
