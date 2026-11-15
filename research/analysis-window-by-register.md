# Analysis window by register

Ticket: [issues/064](../issues/064-analysis-window-by-register.md) · Parent map: [issues/061](../issues/061-map-listen-and-practice-next.md) · Researched 2026-11-15

**Question.** Should the analysis window **adapt to the register** — shorter for high notes (faster first reading), longer for low ones (below ~A1 the fixed 2048-sample / ~43 ms window holds too few cycles, so bass/baritone are slow or missed)?

**Method.** Primary sources only: de Cheveigné & Kawahara, *YIN, a fundamental frequency estimator for speech and music* (JASA 111(4), 2002); MDN + W3C Web Audio API (`AnalyserNode.fftSize`); Improwiser locals `src/listen/pitch.ts`, `src/listen/mic.ts`, `src/instruments.ts`, SPEC §9.2 / §10, [research/analysis-in-an-audioworklet.md](analysis-in-an-audioworklet.md) (ticket 063 **stay** on rAF + AnalyserNode), [research/instrument-practical-ranges.md](instrument-practical-ranges.md), issues/061–064. YIN MAC counts computed from Improwiser’s `detectPitch` parameters at 48 kHz. No secondary blog roundups as authorities. Snapshot date: **2026-11-15**.

**Baseline today** (SPEC §9.2, `mic.ts`, issues/061 Notes): one `AnalyserNode` with `fftSize = 2048` → `getFloatTimeDomainData` once per rAF (~60 Hz) → `detectPitch` with defaults `minHz = 55`, `maxHz = 1600` → clarity &gt; 0.85 → two equal MIDI readings → `OnsetDetector` / `NoteTracker`. Window ≈ 43 ms at 48 kHz; floor A1. Ticket 063 decided **stay** on this path (no AudioWorklet). Ticket 062: adaptive EMA needle (display-only); **hold locked MIDI through brief unlocks**; Practice uses held raw lock, not EMA.

---

## TL;DR

**Adapt the window from the instrument’s practical concert low** (SPEC §10 / `instruments.ts`), on the existing main-thread rAF + single `AnalyserNode` path. Do **not** stay on fixed 2048 for every instrument; do **not** ship dual windows or last-pitch-driven `fftSize` for the next Listen / Practice slices.

- YIN needs roughly **two periods of the lowest expected F0** in the buffer (`W ≥ T_max` and lag search to `T_max`). Improwiser’s `w = ⌊N/2⌋` already encodes that: stable floor ≈ `sampleRate / (N/2)`.
- Fixed **2048 / 55 Hz** is fine for most of the v1 list, but **bass (concert E1 ≈ 41 Hz) is below the detector floor** — open E cannot be estimated with `W = 1024 &lt; T`. High instruments (flute, etc.) pay an unnecessary ~43 ms fill for pitches that only need ~11–21 ms.
- **Scheme:** when Listen starts (and when the instrument changes while listening), set `analyser.fftSize` to the smallest allowed power of two that covers `2⌈sr / f_low⌉`, clamp to **512…4096**, and pass `minHz ≈ f_low` into `detectPitch`. `f_low` = concert Hz of `instrument.range.lo`, or **55 Hz** for Concert (no range).
- **CPU at 60 Hz** stays cheap on the main thread even at 4096 (~2.4M difference-function MACs/frame vs ~894k today). Dual full YINs and pitch-adaptive `fftSize` add complexity that fights the two-equal lock and 062 hold-through-unlock.
- Instrument ranges **are enough** to pick the window; family-specific thresholds / octave guards remain the separate “Not yet specified” item on issues/061.

---

## 1. How many cycles YIN needs

### Paper (de Cheveigné & Kawahara 2002)

YIN decouples the **integration window** `W` from the **maximum lag** `T_max`, but they are linked for stability:

> For stability of estimates over time, the integration window must be no shorter than the largest expected period. … these considerations justify the well known rule of thumb: **F0 estimation requires enough signal to cover twice the largest expected period.**

Their reported stats used `W = 25 ms` and a 25 ms period-search range — “the shortest compatible with a **40 Hz** lower bound on F0.” Latency note: with the absolute-threshold step, search can stop early so latency can drop to **`T_max + T`** (actual period), but not below a full `T_max` of integration without risking fine-structure lock. Larger `W` → fewer errors, worse time resolution (their Fig. 4a discussion).

Source: [YIN PDF (IRCAM)](http://recherche.ircam.fr/equipes/pcm/cheveign/pss/2002_JASA_YIN.pdf) (JASA 111(4), 1917–1930, DOI 10.1121/1.1458024), §IV–V.

So in “cycles” language: plan on **≥ 1 period inside the integration window** at the **lowest expected** F0, and **≥ ~2 periods** in the total sample chunk (`W + T_max`). That is about the **register floor**, not the note you happen to be playing.

### Improwiser’s `detectPitch` (`src/listen/pitch.ts`)

```42:47:src/listen/pitch.ts
export function detectPitch(buf: Float32Array, sampleRate: number, opts: PitchOptions = {}): Pitch | null {
  const { threshold = 0.12, minHz = 55, maxHz = 1600, gate = 0.01 } = opts;
  if (rms(buf) < gate) return null;
  const w = Math.floor(buf.length / 2);
  const tauMin = Math.max(2, Math.floor(sampleRate / maxHz));
  const tauMax = Math.min(w - 1, Math.ceil(sampleRate / minHz));
```

- Difference function sums `w` terms comparing `buf[i]` and `buf[i + τ]` → needs length ≥ `w + τ`.
- With `w = N/2`, the usable `tauMax` is capped at ~`N/2`, so the **lowest estimable F0** is about `sampleRate / (N/2)`.
- At **N = 2048**, `sr = 48000`, `minHz = 55`: `w = 1024`, `tauMax = 873` → A1 period fits with `W/T ≈ 1.17`. Full buffer ≈ **2.35** A1 periods — on the paper’s rule of thumb.
- Below A1, e.g. bass open **E1 ≈ 41.2 Hz** (`T ≈ 1165`): `W = 1024 &lt; T`, and `tauMax` clamps to 1023 → floor ≈ **47 Hz**. Open E is **out of reach**, not merely “slow.”
- Improwiser does **not** implement YIN step 6 (best local estimate) or early exit at `T_max + T`; every call walks τ to `tauMax` and allocates two `Float32Array`s of length `tauMax + 1`.

**Stable reading for Listen** also needs the product rule in `mic.ts`: clarity &gt; 0.85 **and** the same MIDI on **two consecutive** rAF ticks. That is acceptance latency on top of window fill, not extra cycles inside YIN.

---

## 2. AnalyserNode constraints (main-thread path)

`AnalyserNode.fftSize` **must be a power of two in 32…32768** (default 2048). Time-domain reads (`getFloatTimeDomainData`) return the most recent `fftSize` frames. Changing `fftSize` retunes the internal buffer; callers must resize their `Float32Array`.

Sources: [MDN `AnalyserNode.fftSize`](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize); [Web Audio API bikeshed](https://raw.githubusercontent.com/WebAudio/web-audio-api/main/index.bs) (`dom-analysernode-fftsize`).

Ticket 063: stay on **one** Analyser + rAF. Multiple analysers (different `fftSize`) from the same `MediaStreamSource` are legal, but that is a product/CPU choice — see §3.

---

## 3. Schemes compared (rAF + AnalyserNode)

Assume 48 kHz. `minHz` should track the window’s floor (otherwise τ search wastes work or claims pitches the buffer cannot support).

| Scheme | Idea | Latency / coverage | Fit with 062 / two-equal | Verdict |
|---|---|---|---|---|
| **A. Fixed 2048** (today) | One size for all | ~43 ms; floor A1; **misses bass E1** | Simple; already understood | **Reject as universal** — keep only as Concert default |
| **B. Instrument practical range** | `fftSize` + `minHz` from concert low of SPEC §10 range | Right floor per instrument; high instruments get shorter fill | Static for a session of one instrument; no mid-note `fftSize` thrash | **Adopt** |
| **C. Last detected pitch** | Grow/shrink after each lock | Can track register leaps in theory | Cold start needs a default; changing `fftSize` mid-phrase unlocks / reallocates; fights hold-through-unlock | **Defer** |
| **D. Two windows together** | e.g. 4096 + 1024 analysers, or long buffer + short sub-slice, both YIN’d | Low notes from long, high from short | Must merge two MIDI streams into one two-equal lock; risk of disagreeing windows | **Defer** — complexity ≫ gain once B exists |
| **E. Larger window for bass only** | 4096 iff `bass`, else 2048 | Fixes the miss; no high-register win | Simple | Acceptable **minimal** fix; prefer B so flute/violin also shorten |

### Recommended mapping (B)

Let `f_low` = concert frequency of `instrument.range.lo` (via `toConcert`), or **55 Hz** when `range` is null (Concert).

Choose the smallest `fftSize ∈ {512, 1024, 2048, 4096}` such that `fftSize/2 ≥ ⌈sr / f_low⌉` (i.e. `W ≥ T_max` under Improwiser’s half-window). Pass `minHz = f_low` (optionally a few Hz / ~1 semitone lower for margin). Keep `maxHz = 1600` unless a later HITL pass finds a reason to raise it for piccolo-range instruments (violin E7 is ~2637 Hz — already above today’s cap; out of scope unless Listen’s upper bound is revisited).

Example at 48 kHz (computed from `instruments.ts` written lo − semitones):

| Instrument | Concert low | `f_low` Hz | Period samples | `fftSize` | Window ms | `minHz` |
|---|---|---|---|---|---|---|
| Bass | E1 | 41.2 | 1165 | **4096** | **85.3** | ~41 |
| E♭ baritone sax | D♭2 | 69.3 | 693 | 2048 | 42.7 | ~69 |
| Trombone / guitar | E2 | 82.4 | 582 | 2048 | 42.7 | ~82 |
| B♭ tenor sax | A♭2 | 103.8 | 462 | **1024** | **21.3** | ~104 |
| B♭ clarinet | D3 | 146.8 | 327 | 1024 | 21.3 | ~147 |
| Violin | G3 | 196.0 | 245 | **512**† | **10.7** | ~196 |
| Flute | C4 | 261.6 | 183 | **512** | **10.7** | ~262 |
| Concert | (none) | 55 | 873 | **2048** | **42.7** | 55 |

†Violin at 512 meets `W ≥ T` only barely (`w = 256` vs `T ≈ 245`). If HITL shows phase-dependent misses on G3, bump violin (and similarly marginal rows) to **1024** — still half of today’s latency.

Apply `fftSize` / buffer / `minHz` when Listen starts and when the progression’s instrument changes while listening; do **not** retune on every pitch lock.

---

## 4. CPU cost at ~60 Hz (current YIN)

Difference-function cost ≈ `tauMax × w` MAC-equivalents; plus O(`tauMax`) CMND; plus **two `Float32Array(tauMax+1)` allocations per call**. RMS / onset are O(N) / O(1) — negligible beside YIN.

| Config | ≈ MACs / call | Allocs / call | At 60 Hz |
|---|---|---|---|
| Today: N=2048, minHz=55 | **~894k** | 2 | ~54M MACs/s + 120 typed arrays/s |
| Bass: N=4096, minHz=41 | **~2.40M** (~2.7×) | 2 | Still tiny vs a 16 ms rAF budget on desktop/laptop |
| High: N=1024, minHz=130 | **~189k** (~0.21×) | 2 | Cheaper + lower latency |
| High: N=512, minHz=200 | **~61k** | 2 | Cheapest |
| Dual: 4096@41 + 1024@130 every frame | **~2.59M** | **4** | Mostly fine mathematically; **GC pressure** and merge logic are the real costs |
| Last-pitch: one YIN but `fftSize` churn | ~same as chosen N | 2 + buffer realloc on change | Spikes + unlock risk |

**Conclusion:** on the **main thread**, even bass-sized YIN at 60 Hz is not a reason to refuse adaptation. Prefer **one** analysis per frame. If profiling ever shows GC jank, reuse `d` / `cmnd` buffers inside `detectPitch` (orthogonal to window policy; also noted in the AudioWorklet research).

---

## 5. Interaction with onset, two-equal lock, and 062

| Mechanism | Effect of window change |
|---|---|
| **`OnsetDetector`** | Driven by RMS of the same Analyser buffer. Longer N (bass 4096) **smears** the attack over ~85 ms of samples → onset may fire a little later / softer, but lockout remains **90 ms** and Practice still waits for steady pitch. Shorter N (flute 512) makes level jumps snappier — good for attacks. |
| **Two equal MIDI readings** | Hop stays ~1 rAF. Shorter windows reduce *fill* latency but can increase frame-to-frame MIDI flicker on noisy attacks (fewer cycles averaged). Clarity gate 0.85 + two-equal still apply; 062 **hold-through-unlock** covers brief disagreements. |
| **062 hold-through-unlock** | Compatible with **instrument-static** windows. **Incompatible** with frequent `fftSize` changes (scheme C) or with dual analysers that disagree (scheme D) unless a careful merge publishes one MIDI stream. |
| **EMA needle** | Display-only; unaffected by which window produced the locked cents, as long as lock events stay coherent. |
| **Practice / `NoteTracker`** | Uses held steady MIDI + onset; **not** EMA (062). Attack association window **250 ms**. Bass first lock ≈ 85 ms fill + 1–2 frames (~100–120 ms) still inside 250 ms. Silence clear ~150 ms unchanged. |

Do not feed Practice from a short-window guess while a long window still disagrees — another reason to prefer a **single** instrument-chosen window over dual run-together.

---

## 6. Are instrument-view ranges enough?

**Yes, for choosing `fftSize` / `minHz`.**

- SPEC §10 / `instruments.ts` already store practical **written** `lo`/`hi`; concert low = written lo − `semitones` (`toConcert`). That is exactly YIN’s `T_max` / `minHz` input.
- Ranges are “practical, not extreme” ([instrument-practical-ranges.md](instrument-practical-ranges.md)): bass stops at concert E1 (no 5-string B0 / C extension); out-of-range notes are **flagged, never blocked** on the hex — Listen may still fail below `minHz`, which matches “outside the practical instrument.”
- **Concert** has `range: null` → keep **2048 / 55 Hz** (today’s universal default).
- Ranges are **not** enough for the separate issues/061 item **instrument-specific detector tuning** (threshold, clarity cut-off, octave-error guards). Those need real-instrument HITL; window sizing does not unblock them and does not depend on them.

Caveats:

- A player on Concert playing below A1 (or a bassist with the progression still on Concert) keeps the A1 floor until they pick Bass.
- Upper `maxHz = 1600` still clips the top of flute/violin practical ranges; that is independent of window-by-register.

---

## Recommendation

| Option | Choice |
|---|---|
| Stay fixed 2048 for all instruments | **Reject** as the sole policy (bass miss; high-register latency left on the table) |
| Dual windows every frame | **Defer** |
| Window from last pitch | **Defer** |
| Larger window for bass only | Acceptable stopgap |
| **Window (+ `minHz`) from instrument practical concert low** | **Adopt** |

**Adopt scheme B** on the current rAF + AnalyserNode path:

1. Derive `f_low` from the active instrument’s concert practical low (55 Hz for Concert).
2. Set `fftSize` to the smallest power of two in **512…4096** with `fftSize/2 ≥ ⌈sr / f_low⌉`.
3. Call `detectPitch(buf, sr, { minHz: f_low })` (keep threshold / gate / clarity as today until HITL says otherwise).
4. Retune only on Listen start / instrument change — not per note.

**Rationale for Listen / Practice:** Window fill dominates first-note latency (063). Bass is objectively under-windowed today. Instrument ranges already encode the register floor Practice cares about. One static window per instrument preserves the two-equal lock and 062 hold-through-unlock without merge logic. CPU at 60 Hz remains comfortable even at 4096.

**Prototype check (optional before SPEC bake):** synthetic E1 / A1 / C4 / G3 through the chosen `fftSize`s; then HITL on bass open E and flute low C — confirm violin/soprano at 512 vs 1024.

---

## Fog / follow-ups (map “Not yet specified”)

- **Instrument-specific detector tuning** (thresholds, clarity, octave guards) stays open on issues/061 — window-by-instrument does not close it.
- Confirm **512 vs 1024** for violin / soprano sax on real timbre (paper: larger `W` → fewer errors).
- Whether Listen’s **`maxHz = 1600`** should rise for flute/violin tops.
- Concert-view players on bass notes; optional “use Bass instrument for low practice” UX, not a detector change.
- Optional later: reuse YIN scratch buffers to cut allocs; early-exit τ search (`T_max + T`) per paper §V — micro-optimisations, not required to ship B.

---

## Sources (primary)

- Alain de Cheveigné & Hideki Kawahara, “YIN, a fundamental frequency estimator for speech and music,” *J. Acoust. Soc. Am.* **111**(4), 1917–1930 (2002). [PDF](http://recherche.ircam.fr/equipes/pcm/cheveign/pss/2002_JASA_YIN.pdf), DOI [10.1121/1.1458024](https://doi.org/10.1121/1.1458024)
- MDN: [`AnalyserNode.fftSize`](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/fftSize), [`getFloatTimeDomainData`](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatTimeDomainData)
- W3C Web Audio API: [bikeshed `fftSize`](https://raw.githubusercontent.com/WebAudio/web-audio-api/main/index.bs) (power of two, 32–32768)
- Local: `src/listen/pitch.ts`, `src/listen/mic.ts`, `src/instruments.ts`, SPEC §9.2 / §10, [research/analysis-in-an-audioworklet.md](analysis-in-an-audioworklet.md), [research/instrument-practical-ranges.md](instrument-practical-ranges.md), issues/061, 062, 063, 064
