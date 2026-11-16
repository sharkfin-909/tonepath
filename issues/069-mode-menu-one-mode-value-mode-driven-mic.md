---
id: 69
title: "Mode menu: one mode value, mode-driven mic"
labels: [ready-for-agent]
status: closed
blocked_by: []
assignee:
---

## Parent

[Mode menu](068-mode-menu.md) (SPEC §3)

## What to build

The session holds one **mode** — Tuner · Improvise · Write etude · Read etude — in place of the Write / Play /
Practice / Explore / Etude view flags. The Mode dropdown lists the four; the Audio input switch, Explore and writing
the etude by playing are gone; Listen is on exactly in Tuner and Improvise. `[` / `]` step through the modes (no wrap),
`\` toggles Write etude ↔ Read etude (from Tuner or Improvise: Read etude), `P` does nothing. Switching modes stops the
transport and carries the current slot (the caret's slot on the way out; the slot's start on the way back, unless the
caret is already in it) and the one bar selection (= the looped bars).

## Acceptance criteria

- [x] The dropdown shows Tuner · Improvise · Write etude · Read etude and switches between them
- [x] No Audio input switch; the mic is on in Tuner and Improvise only, and closes on leaving them
- [x] `[` / `]` / `\` switch modes in every mode; `P` does nothing
- [x] Switching stops the transport; the current slot and the selection carry across (session tests)
- [x] Mode identifiers in code use the new names

## Blocked by

None - can start immediately

## Resolution

Built on `mode-menu`: `session.ts` (mode, slot, running; `allowed`), `keymap.ts`, `rail/ModePanel.tsx`; session and keymap tests rewritten.
