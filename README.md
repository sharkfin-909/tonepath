# Tonepath

A static web app for writing **practice etudes over chord changes** and **practising improvisation** on them.
Type chord symbols into a bar grid; each slot gets a scale and a fragment of one continuous melody, entered on the
**docked hex** — a honeycomb of the slot's scale where right is the next step and up-left a third, coloured by
degree. In **Practice** mode the app listens to your instrument through the microphone and moves through the form
as you land on the right notes.

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

The microphone (Listen / Practice) works on `localhost` and over HTTPS.

## Where things are

| | |
|---|---|
| [SPEC.md](SPEC.md) | The build spec: every behaviour, with the module table (§2), screens and modes (§3), hex (§8), audio and Listen (§9), keys (§11), storage and schema (§12). Kept current with the code. |
| [CONTEXT.md](CONTEXT.md) | The glossary. Its terms are used in the spec, the code and the comments (e.g. *slot*, *caret*, *docked hex*, *key*, *travel*, *Practice mode*). |
| `src/` | Pure modules (no React / DOM, unit-tested): `chords`, `harmony`, `spelling`, `form`, `melody`, `bars`, `key`, `hex`, `hexLayout`, `view`, `session`, `keymap`, `document`, `chordSuggest`, `chordEntry`, `practice`, `schema`, `listen/pitch`. React: `App.tsx` (chart screen), `Root.tsx`, `chart/`, `hex/DockedHex.tsx`, `notation/` (VexFlow staves), `library/`, `listen/` (mic, Listen pill, practice panel), `rail/` (the header's controls — the folder name is from the old left-hand rail). |
| `examples/` | The bundled demos: a ii–V–I, and rhythm changes in B♭ with a guide-tone etude. |
| `issues/` | The design tickets the spec cites (decisions and their reasoning). |
| `research/`, `prototypes/` | Background research and throwaway prototypes from the design phase; history, not part of the app. |

## State of play

- **Built**: chord grid with autosuggest (incl. the key's simple chords), scales and overrides, in-slot notation,
  hex entry (honeycomb or Linear), Write / Play / Practice / Read modes, stepwise playback, nudges, bar editing,
  undo, instruments (written pitch), library with import / export, Listen and Practice (five advance rules),
  responsive header, generated reverb.
- **Not built / known limits**: Listen is one note at a time (no chords); very low notes (below ~E2) are slower to
  detect; Practice has no timed / BPM mode; nothing is recorded from the mic.
- **Next for Listen and Practice**: charted as a wayfinder map —
  [Map: Listen and Practice — next steps](issues/061-map-listen-and-practice-next.md) (steadier tuner needle,
  analysis in an AudioWorklet, analysis window by register, echo guard with speakers, Practice feedback).
- **Other candidate steps**: on phones, cap bars per row at 2 (the chart gets cramped); more demos.

Formerly *Honeycomb* (and before that *Improwiser*): saved data and exported files from either name still load. "Honeycomb"
remains the name of the 3-row hex layout (vs Linear).
