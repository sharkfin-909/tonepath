# Tonepath

A static web app for writing **practice etudes over chord changes** and **practising improvisation** on them.
Type chord symbols into a bar grid; each slot gets a scale and a fragment of one continuous melody, entered on the
**docked hex** — a honeycomb of the slot's scale where right is the next step and up-left a third, coloured by
degree. Four modes: **Tuner** (the hex lights whatever you play into the microphone), **Improvise** (play over a lead
sheet with a click and the hex showing the chords), **Write etude** (note entry) and **Read etude** (the etude on one
page, with a click and playhead).

Everything runs in the browser: no backend, no accounts. Progressions are saved in localStorage, with JSON export
and import.

## Run

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # vitest: the pure modules, ~550 tests
npm run typecheck
npm run build      # typecheck + static build into dist/
```

The microphone (Listen: Tuner and Improvise) works on `localhost` and over HTTPS.

## Where things are

| | |
|---|---|
| [SPEC.md](SPEC.md) | The build spec: every behaviour, with the module table (§2), screens and modes (§3), hex (§8), audio and Listen (§9), keys (§11), storage and schema (§12). Kept current with the code, except §3's mode menu, which is decided and not yet built. |
| [CONTEXT.md](CONTEXT.md) | The glossary. Its terms are used in the spec, the code and the comments (e.g. *slot*, *caret*, *docked hex*, *key*, *travel*, *Improvise mode*, *transport*). |
| `src/` | Pure modules (no React / DOM, unit-tested): `chords`, `harmony`, `spelling`, `form`, `melody`, `bars`, `key`, `hex`, `hexLayout`, `view`, `session`, `keymap`, `document`, `chordSuggest`, `chordEntry`, `practice`, `practiceRun`, `micIntake`, `metronome`, `metronomeRun`, `deviceSettings`, `schema`, `listen/pitch`. React: `App.tsx` (chart screen), `Root.tsx`, `chart/`, `hex/DockedHex.tsx`, `notation/` (VexFlow staves), `library/`, `listen/` (mic, Listen pill, practice panel), `rail/` (the header's controls — the folder name is from the old left-hand rail). |
| `examples/` | The bundled demos: a ii–V–I, and rhythm changes in B♭ with a guide-tone etude. |
| `issues/` | The design tickets the spec cites (decisions and their reasoning). |
| `research/`, `prototypes/` | Background research and throwaway prototypes from the design phase; history, not part of the app. |

## State of play

- **Built**: chord grid with autosuggest (incl. the key's simple chords), scales and overrides, in-slot notation,
  hex entry (honeycomb or Linear), Explore / Practice / Write / Etude view modes (being replaced: below), stepwise playback, nudges, bar editing,
  undo, instruments (written pitch), library with import / export, Listen and Practice (five advance rules, or the
  metronome; looping selected bars), a hideable hex panel, responsive header, generated reverb.
- **Not built / known limits**: Listen is one note at a time (no chords); very low notes (below ~E2) are slower to
  detect; nothing is recorded from the mic.
- **Next: the mode menu** — [Mode menu](issues/068-mode-menu.md) (SPEC §3): Tuner · Improvise · Write etude ·
  Read etude replace the modes above and the Audio input switch; Practice's note-driven rules and Explore are dropped,
  and the metronome becomes the transport of Improvise and Read etude. Code identifiers are renamed in the same change.
  The old *Listen and Practice* map (061) is closed as superseded.
- **Other candidate steps**: on phones, cap bars per row at 2 (the chart gets cramped); more demos.

Formerly *Honeycomb* (and before that *Improwiser*): saved data and exported files from either name still load. "Honeycomb"
remains the name of the 3-row hex layout (vs Linear).
