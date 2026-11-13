# Music-theory library survey

Ticket: [issues/004](../issues/004-music-theory-library-survey.md) · Researched 2026-11-12

**Question.** Can an existing JS/TS library give Improwiser four things: (1) chord-symbol parsing across common jazz/pop qualities, (2) chord → MIDI notes, (3) chord → scale(s), and (4) context-aware enharmonic spelling with octave numbers? Also: coverage gaps, licence, bundle size, maintenance. Adopt or build?

**Method.** I read the npm registry metadata and GitHub repos, and read the source of `@tonaljs/chord` (`packages/chord/index.ts`). I also installed `tonal@6.5.1`, `teoria@2.5.0` and `chord-symbol@4.0.0` and ran about 80 chord symbols through each one. Bundle sizes come from my own esbuild runs (`--bundle --minify --format=esm`, then gzip -9). Every result below was observed directly unless marked otherwise. I used no secondary write-ups.

---

## TL;DR

**Adopt tonal as the pitch/interval engine. Build a thin chord-symbol front end on top of it, plus a curated chord → scale table and a small spelling policy for chromatic notes.**

- **tonal** spells correctly, because every note is built from root + interval: Cdim7 → `C Eb Gb Bbb`, Bb7#9 → `… C#5`, Gb locrian → `Abb…`. It handles octaves (`Chord.notes("m7b5","F#3")` → `F#3 A3 C4 E4`) and MIDI (`Note.midi("Cb4")` = 59, `Note.midi("B#3")` = 60). It also has a scale dictionary (92 types). It is MIT licensed, written in TypeScript, actively maintained (last release 2026-10-14), and costs about 6.5–10.6 KB gzipped for the parts we need.
- **tonal's chord parser is the weak spot.** It matches the quality string exactly against a fixed list of about 107 chord types, and the list's aliases are not composable. So `CΔ7`, `Cø7`, `Calt`, `Cm7(b5)`, `C7(b9)`, `Cm(maj7)`, `Cm6/9`, `Cmaj7b5`, `B♭m7`, `F♯7` and `C△` all return **empty**. `C4` parses as a quartal chord.
- **chord-symbol** (no-chris) has a real compositional grammar. Every one of those failing symbols parses, Unicode accidentals and parentheses included. But it **spells by pitch class**: Cdim7 → `A` instead of `Bbb`, Cmaj7#11 → `Gb` instead of `F#`, C7#9 → `Eb` instead of `D#`. It has no octaves, and it was last released 2023-02.
- **They combine well.** chord-symbol outputs degree strings (`1,b3,b5,bb7,#11`). These map mechanically onto tonal interval names (`1P,3m,5d,7d,11A`). `Note.transpose(root+octave, interval)` then gives correctly spelled, octave-numbered notes. I verified this end to end (see §5). That makes chord-symbol a possible parser for the build-vs-adopt decision on the front end. The grammar decision is the place to weigh that against writing our own small normaliser.
- **No library does "context-aware" spelling for notes outside the chord/scale**, such as chromatic passing notes. `Note.fromMidi` uses flats and `Note.fromMidiSharps` uses sharps, and that is all. We have to build this policy ourselves.
- **teoria** is unmaintained (last publish 2017, last push 2019), ships no TS types, and throws on `C69`, `C7alt` and `CΔ`. **sharp11** is unmaintained (last push 2017). **music21j** is about 11 MB unpacked, depends on vexflow, and has no chord-symbol parser module. Reject all three.

---

## 1. Candidates at a glance

| | tonal (`tonal` / `@tonaljs/*`) | chord-symbol | teoria | sharp11 | music21j |
|---|---|---|---|---|---|
| Version | 6.5.1 | 4.0.0 | 2.5.0 | 2.0.2 | 0.24.0 |
| Last release | 2026-10-14 | 2023-02-14 | 2017-07-02 | — | 2026-09 |
| Repo last push | 2026-10-14 | 2023-12-22 | 2019-12-01 | 2017-11-24 | active |
| Stars / open issues | 4273 / 35 | 196 / 8 | 1378 / 25 | 349 / 1 | — |
| Licence | MIT (per-package `LICENSE`; repo root has none, so GitHub reports `null`) | MIT | MIT | BSD-2-Clause | BSD-3-Clause |
| TS types | bundled (`dist/index.d.ts`) | bundled (`types/index.d.ts`) | none (no `@types/teoria`) | none | — |
| ESM | `module: dist/index.mjs` | `lib/chord-symbol-esm.js` (but `main` → raw `src/`, see §6) | CJS only | CJS | — |
| Min+gz (our esbuild) | Chord+Note+Scale+Midi: **10.6 KB**; cherry-picked fns from `@tonaljs/chord`, `/note`, `/scale`: **6.5 KB**; whole `tonal`: 15.0 KB | parser+renderer: **21.3 KB** (lodash bundled in) | 6.7 KB | n/a | ~11 MB unpacked |

Sources: `npm view <pkg>`, `gh api repos/<owner>/<repo>`, installed `package.json` files.

## 2. Chord-symbol parsing coverage

Results of running each symbol through `Chord.get()` (tonal) and `chordParserFactory()()` (chord-symbol). ✓ = parsed with the right notes. ✗ = empty or error.

| Symbol(s) | tonal | chord-symbol | teoria |
|---|---|---|---|
| `C Cm C- Cmin CM` | ✓ | ✓ | — |
| `C7 Cmaj7 CM7 CΔ C^7` | ✓ | ✓ | `CΔ` ✗ |
| `CΔ7` | ✗ | ✓ | ✗ |
| `C△ / C△7` (U+25B3) | ✗ | ✗ | — |
| `Cm7 C-7 Cmi7` | ✓ | ✓ | ✓ |
| `Cm7b5 Cø C-7b5` | ✓ | ✓ | ✓ |
| `Cø7` | ✗ | ✓ | — |
| `Cm7(b5)` | ✗ | ✓ | — |
| `Cdim Co Cdim7 Co7 C°7` | ✓ | ✓ | ✓ |
| `Caug C+ C+7 C7#5` | ✓ | ✓ | — |
| `Csus Csus4 Csus2 C7sus C7sus4 C9sus4` | ✓ | ✓ | ✓ |
| `C6 Cm6 C-6 C6/9 C69 C6add9 Cadd9` | ✓ | ✓ | `C69` ✗ |
| `Cm69` | ✓ | — | — |
| `Cm6/9` | ✗ | ✓ | — |
| `C9 Cm9 Cmaj9 C11 Cm11 C13 Cmaj13` | ✓ | ✓ | — |
| `C7b9 C7#9 C7#11 C7b13 C7b9b13 C7#9#5 C7#5b9 C7b9#11 C7#9b13 C13b9 C13#11 Cmaj7#11` | ✓ | ✓ | ✓ (sampled) |
| `C7alt` | ✓ (= 7#5#9 only: `C E G# Bb D#`) | ✓ (configurable, see below) | ✗ |
| `Calt` | ✗ | ✓ | — |
| `C7(b9) C9(#11) C(b9)` | ✗ | ✓ | `C7(b9)` ✓ |
| `CmM7 C-Δ7` | ✓ | ✓ | ✓ |
| `Cm(maj7)` | ✗ | ✓ | — |
| `Cmaj7b5 Cdim(maj7) Cm(add9)` | ✗ | ✓ | — |
| `C7b5 C5` | ✓ | — | — |
| `C/E C7/E Am7/G C/Bb` (slash) | ✓ | ✓ (`bassNote`) | ✓ |
| `B♭m7 F♯7` (Unicode accidentals) | ✗ | ✓ | — |
| `cm7` (lower-case root) | ✓ (normalises to `Cm7`) | — | — |
| `C4` | parses as **quartal chord** `C F Bb Eb` | parses as **sus4** | — |

**Why tonal has gaps.** In `packages/chord/index.ts`, `tokenize()` splits a symbol into tonic + type + `/bass`. Then `getChordType(type)` does an exact lookup in a fixed dictionary (`packages/chord-type/data.ts`): 107 types, 69 of them without a long name. Nothing composes alterations, parentheses or "add"/"omit" modifiers. The dictionary can be extended at runtime, though. `ChordType.add(["1P","3M","5P","7M"], ["Δ7","△7","△"])` immediately made `CΔ7` and `C△` resolve, and `Cmaj7` kept working.

**How chord-symbol differs.** Its README describes a pipeline: it "recognize[s] extensions, alterations, added and omitted notes". It separates "vertical quality" from "changes", returns `normalized.intervals` as degree strings plus `semitones`, `rootNote` and `bassNote`, and has an `altIntervals` parser option. By default, `C7alt` expands to every alteration (`b5,#5,b9,#9,#11,b13`). With `altIntervals: ["b9","#9"]` it gives `1,3,5,b7,b9,#9`.

**Slash-chord semantics in tonal.** `Chord.get("C7/E")` → `tonic: "C"`, `bass: "E"`, `root: "E"`, `rootDegree: 2`, notes rotated to `E G Bb C`. For a bass that is not a chord tone, `C/Bb` gives `root: ""`, `bass: "Bb"`, and notes `Bb C E G` (the bass is prepended). The bass is accepted only as a pitch class (source: `tokenizeBass`).

## 3. Chord → notes with octaves / MIDI

**tonal.**
- `Chord.notes(type, "F#3")` → `F#3 A3 C4 E4`. Octaves carry correctly across C.
- `Chord.notes("dim7","C4")` → `C4 Eb4 Gb4 Bbb4` = MIDI 60,63,66,69.
- `Chord.notes("7#9","Bb3")` → `Bb3 D4 F4 Ab4 C#5`. Extensions stack above the octave.
- `Note.midi`: `Cb4` = 59, `B#3` = 60, `Bbb3` = 57, `E#4` = 65. Octave numbers follow scientific pitch notation; letter + accidental do not change the octave number, so `Cb4` sits below `C4`.
- `Note.get("Bb3")` → `{ letter, acc, alt, oct: 3, midi: 58, chroma: 10, pc: "Bb", … }`.
- `Scale.rangeOf("Db major")("Bb3","F4")` → `Bb3 C4 Db4 Eb4 F4`. `Scale.rangeOf(["C","Eb","Gb","Bbb"])("C4","C5")` works for any pitch-class set, which is useful for filling a lattice range with chord tones.
- `Midi.pcsetNearest([0,4,7,10])(61)` → 60. It accepts chroma numbers, not note names; with names it returned `undefined`.

**chord-symbol.** Pitch-class names and semitone offsets only, with no octaves.

**teoria.** Gives octaves (`teoria.chord("Bbm7")` → `bb4 db5 f5 ab5`) but defaults to octave 4 and puts the slash bass an octave down (`C7/E` → `e3 c4 g4 bb4`).

## 4. Chord → scale(s)

tonal has `Chord.chordScales(name)` (source lines ~219–225). It returns **every** scale in the 92-type dictionary whose pitch set is a superset of the chord. The list is unranked and has no jazz-pedagogy ordering. Observed:

- `C7` → `bebop, mixolydian, mixolydian pentatonic, …, flamenco, …, half-whole diminished, …, chromatic` (17 entries)
- `Cm7b5` → `minor blues, locrian, …, altered, locrian #2, …` (15 entries, starting with "minor blues")
- `Cdim7` → `diminished, ultralocrian, …` (tonal's `diminished` is whole-half: `C D Eb F Gb Ab A B`)
- `C7alt` → `altered, spanish heptatonic, messiaen's mode #3, chromatic`
- `C7b9` → `phrygian dominant, flamenco, spanish heptatonic, half-whole diminished, chromatic`

The reverse lookup also exists: `Scale.scaleChords("altered")`. `Scale.get("Bb4 mixolydian").notes` gives octave-numbered scale notes. Scale names worth knowing: `altered` = super locrian (`C Db D# E F# Ab Bb`), and `half-whole diminished` = `C Db Eb E F# G A Bb`.

**Implication.** Use tonal's *scale dictionary* for the notes, but keep our **own curated quality → default-scale table**: maj7→ionian/lydian, m7→dorian, 7→mixolydian, m7b5→locrian (or locrian #2), dim7→whole-half, 7alt→altered, 7b9→half-whole, 7#11→lydian dominant, and so on. chordScales can at most offer alternatives. chord-symbol and teoria have no chord → scale mapping (teoria has scales but no mapping).

## 5. Enharmonic spelling

**What tonal gets right.** Notes are built as root + interval with letter arithmetic, so chord and scale members always spell correctly relative to the root, double accidentals included. Examples: Cdim7 → `Bbb`, Gb locrian → `Gb Abb Bbb Cb Dbb Ebb Fb`, Gb7 → `Fb`, Cb7 → `Bbb`. Theoretically right, but sometimes awkward to read. Useful helpers:

- `Note.simplify` → `Cbb4`→`Bb3`, `B#3`→`C4`, `Fb4`→`E4`. Octave crossing is handled.
- `Note.enharmonic("C#4","Db")` → `Db4`, and `Note.enharmonic("Cb4")` → `B3`.
- `Note.transpose("C4","2m")` → `Db4`, and `Note.transpose("C4","1A")` → `C#4`.
- `Key.majorKey("Bb").scale` / `Key.minorKey("g").natural.scale` give key-signature context.

**What no library does.** None picks a spelling for a raw MIDI number from harmonic context. `Note.fromMidi(61)` → `Db4` (always flats), and `Note.fromMidiSharps(61)` → `C#4`. teoria's `note.fromMIDI(61)` → `db4`. chord-symbol mis-spells even chord tones (Cmaj7#11 #11 = `Gb`).

**So we build:**
1. A rule for chromatic/passing notes. For example, prefer the spelling that is a chromatic neighbour of the next chord/scale tone, or prefer flats in flat keys/chords. That rule belongs in the enharmonic-spelling decision.
2. A rule for whether to show double accidentals or simplify them, for example via `Note.simplify` or a "max one accidental" rule.

**Hybrid parser check.** I mapped chord-symbol degrees to tonal intervals: perfect degrees (1/4/5/8/11/12) take `P/d/A/dd`, the rest take `M/m/A/d`. Then `Note.transpose(root+oct, ivl)`:

```
Cdim7    1,b3,b5,bb7          -> C4 Eb4 Gb4 Bbb4
Cmaj7#11 1,3,5,7,#11          -> C4 E4 G4 B4 F#5
Bb7#9    1,3,5,b7,#9          -> Bb3 D4 F4 Ab4 C#5
C9(#11)  1,3,5,b7,9,#11       -> C4 E4 G4 Bb4 D5 F#5
Ebm6/9   1,b3,5,6,9           -> Eb3 Gb3 Bb3 C4 F4
Am7/G    1,b3,5,b7 (bass G)   -> A3 C4 E4 G4
```

Every result came out correct.

## 6. Gaps and gotchas (for the chord-grammar decision)

1. **Our grammar must normalise input before tonal sees it.** Normalise `♭/♯` → `b/#`, `△/Δ7/ø7` → canonical forms, strip or interpret parentheses, `alt` without `7`, and `m(maj7)`. Use `ChordType.add` for any qualities we keep, or bypass tonal's parser and feed intervals directly.
2. **Octave-looking symbols are ambiguous.** tonal reads `C4` as the quartal chord "4" (open issue #503 complains about quartal "4" chords surfacing in `Chord.detect`). chord-symbol reads it as sus4. Since our note labels look like `C4`, the grammar should reject or warn on bare-digit qualities other than 5/6/7/9/11/13. Labels belong to notes and chords never carry octaves, so this ambiguity should never reach the user.
3. **The meaning of `alt` differs**: tonal `7alt` = `7#5#9`, chord-symbol = all alterations (configurable). We need to pick a definition. Classification needs "chord tones", so `alt` probably = `1 3 b7` + chosen alterations, with the altered scale supplying the scale tones.
4. **tonal drops some chord tones.** `C7b13` → `C E Bb Ab` (no 5th) and `C11` → `C G Bb D F` (no 3rd). Fine for voicing, but the classification decision should state whether "chord tone" means the dictionary's interval list or a theory-complete set.
5. **chord-symbol packaging.** `package.json` `main` points to raw `src/index.js` with extensionless ESM imports, which fail in plain Node. `lib/chord-symbol(-esm).js` is the built bundle. Vite would likely resolve `src/`, but it is a maintenance smell. It also bundles lodash, which explains its 21 KB gzipped. No release since 2023, 8 open issues.
6. **tonal tree-shaking.** No `sideEffects` field and no `exports` map. Importing individual `@tonaljs/*` packages and functions gave 6.5 KB gzipped, against 15 KB for all of `tonal`.

## 7. Recommendation

**Adopt `@tonaljs/note`, `@tonaljs/chord`, `@tonaljs/scale` (and `@tonaljs/interval`) as the theory core.** Use them for interval-based spelling, octave arithmetic, MIDI conversion and the scale dictionary. It is MIT, TS-native, actively maintained, and about 6–11 KB gzipped.

**Build** (small, app-specific):
- **Chord-symbol front end.** Either our own normaliser over a closed set of qualities, which fails loudly on unknown input, or a wrapper around chord-symbol that converts its degrees into tonal intervals (§5). Which one is a grammar-ticket decision. Our own normaliser keeps the accepted grammar explicit and small. chord-symbol buys broad coverage at +21 KB and dependency risk.
- **A curated quality → default-scale table** that uses tonal scale names.
- **A spelling policy** for chromatic/passing notes and double accidentals.

Reject teoria, sharp11 and music21j (unmaintained or oversized; see §1).

## Sources

- npm registry: `npm view tonal|@tonaljs/chord|@tonaljs/note|@tonaljs/scale|teoria|chord-symbol|sharp11|music21j` (version, licence, dependencies, publish times), retrieved 2026-11-12.
- GitHub API: `repos/tonaljs/tonal`, `repos/saebekassebil/teoria`, `repos/no-chris/chord-symbol`, `repos/jsrmath/sharp11`; tonal commits and open issues (#503, #168 "Add a new ChordSymbol module", #419 "Chord to leadsheet notation").
- Source: https://github.com/tonaljs/tonal/blob/main/packages/chord/index.ts (`tokenize`, `tokenizeBass`, `get`, `getChord`, `chordScales`); `packages/chord-type/data.ts`.
- chord-symbol README (npm `readme` field) and https://github.com/no-chris/chord-symbol.
- Empirical runs: tonal 6.5.1, teoria 2.5.0, chord-symbol 4.0.0 on Node 22.15.0; esbuild bundle measurements.
