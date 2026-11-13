---
id: 34
title: "Computer-keyboard grid play"
labels: [wayfinder:grilling]
status: closed
parent: 1
blocked_by: [33]
assignee:
---

## Question

How does the computer keyboard play the 3-row docked hex from [Left-slanted hex grid](033-left-slanted-hex-grid.md)? User idea, 2026-11-13: **letter keys play the grid**, so **no shortcut may use a letter key**.

- **Mapping:** Z X C V B N M , . / → bottom row; A S D F G H J K L ; ' → middle; Q W E R T Y U I O P [ ] → top. Does a key always mean a cell position (so it plays a different pitch when the slot's scale changes), and are punctuation keys included? What about non-QWERTY layouts (AZERTY, QWERTZ, Dvorak): by physical key position (`KeyboardEvent.code`) or by the character printed on the key?
- **A key press** = the same as clicking that cell (audition + insert at the caret with the length latch; turns Rest off). Should the cells show their key letters?
- **Shortcuts to move off letters:** `R` (Rest) and `M` (mute) from [Melody entry and caret (docked)](028-melody-entry-and-caret-docked.md) and [Audition (etude)](025-audition-etude.md). Keep 1–5 (lengths), Space / ⇧Space (peeks), arrows (caret and nudge), ⌫/Del, ⌘Z. New homes for Rest and mute (e.g. `0`, `` ` ``, Tab, a ⌘ chord)?
- **Focus:** letters typed into the title or a chord-symbol field go into that field, not to the grid. How does the user get out of a field (Esc / Enter)?
- **Stand mode:** are keys inactive while the hex is hidden?

## Resolution

**Out of scope** (user, 2026-11-13): too much for v1. The grid keeps its 4 rows; letter-key shortcuts (R, M) stay as decided.
