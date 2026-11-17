---
id: 84
title: "Mode families: six modes, progression mode, standard progressions, share links"
labels: [wayfinder:map]
status: open
assignee:
---

## Why

A first-time user should be able to answer "what does this do?" quickly. Today's four modes mix jobs: Improvise
edits chords, listens to the mic, picks on the hex, bumps chords and runs a backing track, all at once. Write etude edits
both the chords and the line. The redesign gives each mode one job and groups the modes by **what you play with**:
the hex grid, or your instrument.

## Decisions (from the grilling session, 2026-11-17)

### The six modes

| Short (header) | Full (list, Help) | Input | Chords move on by | Edits |
|---|---|---|---|---|
| progression | edit progression | hex (hear scales) | ▶ to listen back | chords, scales, bars, time signature |
| etude | edit etude | hex writes at the caret | step-play | the melody only |
| grid improv | improvise on the grid | hex | `by notes \| in time` | nothing |
| ins tune | tune instrument | mic | — | nothing |
| ins improv | improvise on instrument | mic (+ hex clicks) | transport | nothing |
| ins read | read etude on instrument | mic | transport | nothing |

- **Real modes.** Each has its own `modeProfile`, its own name, and a place in the `[` / `]` order.
- **Picker.** The open list shows the full names in the order above. A thin line, with no headings, separates the
  three grid modes from the three instrument modes. The closed header button shows `mode: <short name> ▾`.
- **Icons.**
  - progression: chord blocks (new).
  - etude: the pencil.
  - grid improv: the squiggle over a small hexagon.
  - ins tune: the gauge.
  - ins improv: the squiggle with a small sound-wave mark.
  - ins read: the page with a note.
- **Keys.**
  - `[` / `]` step through all six in list order, with no wrap.
  - `\` jumps to the partner mode: etude ↔ ins read, grid improv ↔ ins improv.
  - In progression and ins tune, `\` does nothing.
- **First run.** A new user lands in **grid improv**, on the **12-bar blues** standard, set to **by notes**.
  Returning users land in their last mode. That last mode is **saved per device**, which is new: today every load starts in Tune.

### What each mode shows

- **progression**
  - Lead-sheet cards with mini hexes; no stave.
  - Header: time signature, bars per row, undo/redo, and the bar tools (⋯, +, the trash).
  - The docked hex follows the selected chord, so a click lets you hear the scale. It never writes.
  - The transport (▶, tempo, click, audio on chord) plays the progression back. There are **no loop pickers**.
  - No mic.
- **etude** (today's Write etude without anything that edits the progression)
  - **Kept:** note entry at the caret, lengths, rest, delete, nudge, step-play, melody undo/redo, and copy/paste of a bar's **notes**.
  - **Removed:** chord typing, the scale menu, time signature, bars per row, and the bar menu (insert, duplicate, delete, +, the trash).
  - Clicking a chord offers "edit in progression →".
  - **Disabled in the picker** while the progression is empty, with the hint "add chords first". The same goes for ins read.
- **grid improv**
  - Lead-sheet cards, read-only, with the current chord highlighted.
  - The hex is always shown (no Hide hex). Click, Space or A plays a note.
  - **One "move on" control:** `by notes | in time`. Only the chosen option's controls show.
    - **by notes:** chord bump (notes: N) plus the loop pickers. Chord bump keeps to the looped bars.
    - **in time:** the transport (tempo, click, ▶, loop). While it runs, the next chord's tones are ringed on the hex.
  - The sound pill: audio on chord, and ▶ chord / bass / scale.
  - No mic and no tuner bar.
- **ins tune:** today's Tune.
- **ins improv**
  - Today's Improvise, minus chord editing and chord bump.
  - Mic, tuner bar and input level; heard notes light the hex.
  - The transport is how the chords move on.
  - Clicking notes on the hex still works, for checking a note, and Hide hex stays.
- **ins read:** today's Read etude.

### Editing rules

- Chords and bars are edited **only in progression**.
- Every other mode shows the progression read-only. Clicking a chord there offers a one-click jump to progression.
- Bar edits that carry the etude's notes along (insert, duplicate, delete) happen only in progression.

### Standard progressions

- **Read-only.** They're built into the app and have a **frozen ID** (e.g. `std/12-bar-blues`). Their chords never
  change once released. A fix ships as a new entry (`…-v2`), and the old one stays.
- **First set: generic forms.**
  - Major and minor 12-bar blues.
  - Rhythm changes.
  - ii–V–I drills, major and minor, in a few keys.
  - A turnaround.
  - A modal vamp.

  **Later:** public-domain tunes (pre-1929), each as its own frozen entry.
- **In progression mode** a standard opens locked. A banner reads "Standard progression: read-only", with a
  **Make my own copy** button. The copy goes into My progressions, and its etudes stay with the standard.
- **Etudes over a standard** belong to you and are stored under the standard's ID.

### Library

- It keeps the name **Library** (folder icon) in the ☰ menu. It isn't renamed Settings.
- **Sections, top to bottom:**
  - **Now open:** the current progression and etude by name, each with its picker and rename, plus the lock on a standard.
  - **Standards:** locked rows, with your etudes under each.
  - **My progressions:** today's list.
- **Standards:** no Delete. Make my own copy is available.
- **Tablet and phone:** the header's progression/etude pill is hidden, so the ☰ Library item shows the current names
  (`📁 12-bar blues · etude 2`).

### Sharing

- **Share etude** copies a link with the etude in its **URL fragment** (`#…`), so it never reaches a server and no backend is needed.
- **The payload:** the etude (name, instrument, clef, melody), the standard's ID if it has one, and a **copy of the chords**.
- **Opening a link** imports the etude. It goes under its standard, or, if this app doesn't have that standard, under a new item in My progressions built from the carried chords.

### Migration (saved data)

- Write etude → etude.
- Read etude → ins read.
- Tune → ins tune.
- Improvise → ins improv, because it had the mic.
- Saved chord bump settings carry over to grid improv's **by notes**.

## Slices, in build order

1. **Six modes, picker, keys.**
   - Code changes:
     - `Mode` gets six values.
     - `MODES` and `MODE_LABELS` hold the full names, with short names alongside.
     - `modeProfile` gets six profiles.
     - The `Dropdown` gets a separator.
     - Two new icons.
     - `[` / `]` / `\` follow the new order and pairs.
     - The last mode is saved per device.
     - Old saved modes are migrated.
   - grid improv gets `by notes | in time` (a device setting), and chord bump is removed from ins improv.
   - At this stage, progression is etude's chord editing with the melody hidden. Slice 2 completes the split.
   - Docs: Help text, the Keyboard shortcuts list, SPEC §3.0–3.8 and §11, CONTEXT.md.
2. **Chord editing only in progression.**
   - Gate the form intents (`editsForm`) to progression alone.
   - Remove the bar menu, + and the trash from etude.
   - Add the "edit in progression →" jump.
   - Disable etude and ins read while the progression is empty.
   - Add progression's ▶ playback, without loop pickers.
3. **Library "Now open".**
   - Add the Now open block and the section layout.
   - Show the ☰ item with the current names from tablet down.
4. **Standard progressions.**
   - A built-in, read-only store with frozen IDs and the first set of generic forms.
   - Etudes are stored under a standard's ID.
   - The locked progression mode, with its banner and Make my own copy.
   - The Standards section in the Library.
   - First run lands in grid improv on the 12-bar blues.
   - Docs: SPEC §3.5, §12.
5. **Share links.**
   - Encode and decode the payload, as a pure module with tests, including size checks.
   - Add a Share etude action.
   - Import on load from the URL fragment, then clear it.
   - Handle a missing standard by using the carried chords.

Each slice ships with its tests (test-first, as for the rest of the build) and its SPEC/CONTEXT updates.

## Open (decide when the slice starts)

- Where **Share etude** sits: the etude picker, the Library's Now open block, or both.
- The size limit for a share link, and what happens past it (a very long etude).
- Whether **ins read** also lights heard notes on the hex. It has no hex today.
