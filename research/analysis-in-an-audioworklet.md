# Analysis in an AudioWorklet

Ticket: [issues/063](../issues/063-analysis-in-an-audioworklet.md) · Parent map: [issues/061](../issues/061-map-listen-and-practice-next.md) · Researched 2026-11-15

**Question.** Should pitch and onset detection move from the animation-frame loop into an **AudioWorklet** on the audio thread?

**Method.** Primary sources only: MDN, W3C Web Audio API (GitHub `WebAudio/web-audio-api` bikeshed), WHATWG HTML, Chromium/WebKit/Gecko bug and blog pages, Vite docs. Improwiser locals: `src/listen/mic.ts`, `src/listen/pitch.ts`, `src/listen/ListenPill.tsx`, `package.json` (Vite `^5.4.11`), SPEC §9.2, CONTEXT Listen terms, issues/061 Notes. YIN operation counts computed from Improwiser’s `detectPitch` parameters. No secondary blog roundups as authorities. Snapshot date: **2026-11-15**.

**Baseline today** (issues/061 Notes + code): mic → `AnalyserNode` (`fftSize` 2048) → `getFloatTimeDomainData` once per `requestAnimationFrame` (~60 Hz; higher on high-refresh displays) → YIN + onset + two-equal-MIDI lock in `mic.ts` / `pitch.ts`. Window ≈ 43 ms at 48 kHz; consecutive 60 Hz reads overlap ≈ 61 %. First steady reading of a new note ~50–80 ms; floor A1 (55 Hz). Analysis **pauses in background tabs** because it is driven by rAF. React: `ListenPill` `setFrame` every tick for tuner/meter; hex/`onHeard` only on MIDI change; Practice gets `noteStart` events.

---

## TL;DR

**Stay on the main-thread rAF + AnalyserNode path for Improwiser Listen / Practice.** Do not move pitch (or onset) into an AudioWorklet for the next build slices.

- **Window length dominates** first-note latency (~43 ms of samples before YIN can see ~A1). A worklet cannot shrink that without changing the analysis window (ticket [064](../issues/064-analysis-window-by-register.md)).
- Hopping every render quantum (~2.7 ms at 48 kHz) would mainly tighten the **two-equal-readings** lag (today ~1–2 display frames). That is a small slice of the ~50–80 ms total, while the tuner UI still needs a display-rate update.
- Full YIN every quantum is ~9×10⁵ difference-function MACs plus **per-call `Float32Array` allocations** in current `detectPitch` — hostile to the audio-thread timing budget unless rewritten to hop slower and reuse buffers.
- AudioWorklet is widely available, but Safari/iOS has real order-of-operations and gesture quirks with `getUserMedia` + `addModule`; SharedArrayBuffer needs COOP/COEP (Improwiser is a static Vite app with no such headers today).
- Listen already isolates chart re-renders; the expensive Worklet ↔ React bridge is optional complexity for little product gain while Practice is gesture-driven and foreground.

**Revisit** only if a timed / BPM Practice mode needs audio-clock-locked detection under main-thread load, or after 064 shortens high-register windows enough that hop rate (not window fill) becomes the latency bottleneck.

---

## 1. Browser support and quirks

### Availability

| Engine | AudioWorklet |
|---|---|
| Chrome / Chrome Android | 66+ (2018-04-17) |
| Edge | 79+ |
| Firefox / Firefox Android | 76+ / 79+ |
| Safari | 14.1+ (2021-04-26) |
| Safari on iOS | 14.5+ (2021-04-26) |

Sources: [Web features explorer — audio-worklet](https://web-platform-dx.github.io/web-features-explorer/features/audio-worklet/) (Baseline Widely Available since 2023-10-26); MDN [`AudioWorklet`](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet) (“Baseline Widely available… across browsers since April 2021”). Chrome shipped enabled-by-default in 66 ([Chrome Developers — Audio Worklet](https://developer.chrome.com/blog/audio-worklet)).

**Secure context.** `BaseAudioContext.audioWorklet` / `addModule` require a secure context (HTTPS; `http://localhost` counts for local testing). MDN [`AudioWorklet`](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet), [`Worklet.addModule`](https://developer.mozilla.org/en-US/docs/Web/API/Worklet/addModule); Chrome blog above.

### Audio-thread constraints

- `AudioWorkletProcessor.process()` runs on the **Web Audio rendering thread**, once per **render quantum**. Spec default size is **128 frames** (`AudioContextRenderSizeCategory` `"default"` → 128). Source: [Web Audio API bikeshed](https://raw.githubusercontent.com/WebAudio/web-audio-api/main/index.bs) (`[[render quantum size]]`, enum description “default value of 128 frames”).
- MDN: blocks are “always 128 frames long” today, but code **must check** channel length because the size may become variable. [`AudioWorkletProcessor.process()`](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process).
- Timing budget at 44.1 kHz ≈ 128/44100 ≈ **2.9 ms** per quantum (Chromium cites “only 3ms at … 44.1Khz”). [Chrome — Audio Worklet design pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern). At Improwiser’s typical 48 kHz: **≈ 2.67 ms**.
- Worklet code lives in `AudioWorkletGlobalScope` (no DOM). Communication with the main thread is via `MessagePort` on the node/processor (and optionally `AudioWorklet.port`). MDN [`AudioWorkletNode`](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode), Chrome Audio Worklet blog.
- Heavy work that misses the quantum budget causes **glitches** on any audio going through that context’s graph; Chromium’s design-pattern article stresses finishing within the budget and avoiding GC (WebAssembly / preallocated buffers).

### Module loading

`audioContext.audioWorklet.addModule(moduleURL)` fetches and evaluates a **module script** in the worklet scope; promise resolves when registration is ready. MDN [`Worklet.addModule`](https://developer.mozilla.org/en-US/docs/Web/API/Worklet/addModule); HTML Worklet section (cited from MDN). Processors then `registerProcessor(name, class)`.

### SharedArrayBuffer / COOP–COEP

Sharing a `SharedArrayBuffer` across agents requires a **cross-origin isolated** document: response headers `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp` (or `credentialless`), plus `Permissions-Policy` not blocking `cross-origin-isolated`. Check with `window.crossOriginIsolated`. MDN [`SharedArrayBuffer` — Security requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer), [`Window.crossOriginIsolated`](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated), [`Cross-Origin-Opener-Policy`](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy). Firefox applies the same COOP/COEP gate to AudioWorklet globals ([Bugzilla 1630877](https://bugzilla.mozilla.org/show_bug.cgi?id=1630877)). `file://` cannot set those headers ([Bugzilla 1871765](https://bugzilla.mozilla.org/show_bug.cgi?id=1871765)).

Improwiser today: Vite static SPA (`package.json` scripts `vite` / `vite build`); **no COOP/COEP** in-repo. SAB rings are optional infra, not free.

`Atomics` is always available for coordinating SAB views when isolation is on. MDN [`Atomics`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics). Chromium documents SAB + Atomics + Worker + AudioWorklet as an advanced pattern ([design pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern)).

### Background / tab throttling: AudioContext vs rAF

| Mechanism | Hidden / background behaviour |
|---|---|
| `requestAnimationFrame` | MDN: “paused in most browsers when running in background tabs”. [rAF](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame). Chrome: “does not call `requestAnimationFrame()` when a page is in the background” (since 2011). [Chrome — Background tabs](https://developer.chrome.com/blog/background_tabs). WHATWG: UAs may drop rendering opportunities when visibility is not `"visible"` (example: ~4/s or less). [HTML — rendering opportunity](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model). |
| Main-thread timers | Chrome throttles / budget-limits background timers; **audible** audio exempts (silent streams do **not**). Same Chrome background-tabs doc; MDN [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API) summarises similar policies. |
| `AudioContext` rendering | Continues while `"running"` and not interrupted/suspended; independent of rAF. Spec states: `"suspended"` → time not proceeding / hardware may power down; `"running"` → audio processed. [Web Audio API bikeshed — `AudioContextState`](https://raw.githubusercontent.com/WebAudio/web-audio-api/main/index.bs). |
| Safari / iOS | WebKit has suspended / backgrounded AudioContext behaviours (e.g. [bugs.webkit.org 237878](https://bugs.webkit.org/show_bug.cgi?id=237878)); playback/session rules are product-specific. Mic-capture pages may still be deprioritised when backgrounded — do not assume background Listen is useful for Practice. |

**Safari / iOS AudioWorklet quirks (primary bugs):**

1. **User gesture across `await addModule`.** Connecting the graph after an async `addModule` could lose the transient activation so `process()` never ran; WebKit relaxed this ([bugs.webkit.org 247614](https://bugs.webkit.org/show_bug.cgi?id=247614), fixed). Still: start Listen from the same user gesture path Improwiser already uses (`ctx.resume()` after the Listen/Practice click in `mic.ts`).
2. **`getUserMedia` then `AudioContext` then `addModule` order** caused **distorted Web Audio output on iOS** (worklet empty); creating the context **before** `getUserMedia` avoided it. Dup of sample-rate/worklet regression; fixed around iOS 18 beta 2. [bugs.webkit.org 275801](https://bugs.webkit.org/show_bug.cgi?id=275801) → [274507](https://bugs.webkit.org/show_bug.cgi?id=274507). Improwiser’s current order is **getUserMedia → new AudioContext** (`mic.ts`); a worklet path must re-order carefully for older iOS.

---

## 2. Loading a worklet module under Vite (and static production)

Vite **`^5.4.11`** (`package.json`). Official asset docs:

1. **`?url` import** — explicit URL for scripts not in the default asset list; documented for **Paint Worklets** with `addModule`:

   ```js
   import workletURL from './processor.js?url'
   await audioContext.audioWorklet.addModule(workletURL)
   ```

   Dev: served path under `/src/…`. Production: hashed file under `/assets/…`, included in the build graph. Source: [Vite — Static Asset Handling — Explicit URL Imports](https://vite.dev/guide/assets.html).

2. **`new URL('./processor.js', import.meta.url).href`** — native ESM resolution; Vite rewrites for hashed production assets when the URL string is **static**. Dynamic `new URL(variable, import.meta.url)` is **not** rewritten. Same Vite guide — “new URL(url, import.meta.url)”.

3. **`public/`** — fixed filename, copied as-is; reference with root path. Prefer imports so hashing and graph tracking work.

**Implications for Improwiser:**

- Worklet entry must be a **separate JS module** registered via `addModule`. It does **not** automatically share the app’s TS bundle: `pitch.ts` cannot be a normal import into the worklet without a dedicated entry / duplicated pure code / a build plugin. Vite’s documented path is URL → `addModule`, analogous to paint worklets — not `?worker` (that creates a Worker, not an AudioWorklet).
- TypeScript: ship `.js` worklet source or a second Vite input; `?url` on `.ts` is not the documented happy path.
- Static hosting must serve the hashed worklet URL over HTTPS (or localhost). No COOP/COEP required unless using SAB.

---

## 3. Cost of YIN per hop vs the audio-thread budget

### Improwiser’s YIN (`src/listen/pitch.ts`)

For `buf.length = 2048`, `sampleRate = 48000`, `minHz = 55`, `maxHz = 1600`:

| Quantity | Value |
|---|---|
| Half-window `w` | 1024 |
| `tauMin` | 30 |
| `tauMax` | 873 |
| Difference-function inner iterations (`tauMax × w`) | **≈ 894 000** MAC-equivalent ops |
| Extra | CMND loop O(`tauMax`); threshold search; parabolic refine |
| Allocations **every call** | `new Float32Array(tauMax+1)` × 2 (`d`, `cmnd`) |

Onset path (`OnsetDetector.push`) is O(1) given RMS; RMS itself is O(N) over the window.

### Budget

| Schedule | Period @ 48 kHz | YIN load if run that often |
|---|---|---|
| Every quantum (128) | ≈ 2.67 ms | ~894k ops + **2 allocations** every 2.67 ms |
| Every 4 quanta (512 hop) | ≈ 10.7 ms | Same work ~93 Hz |
| Every ~16 quanta (~2048/60) | ≈ 16.7 ms | ≈ today’s 60 Hz rate |

Chromium: missing the ~3 ms quantum budget glitches the stream ([design pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern)). Raw float math of one YIN often fits in well under 3 ms on desktop CPUs, but:

- **Allocating two ~3.5 KB typed arrays every quantum** invites GC pauses on the audio thread — the same article pushes WASM / preallocated heaps for that reason.
- Spec/MDN require `process()` to stay synchronous; no async YIN.

**Compare strategies:**

| Strategy | Verdict for Improwiser |
|---|---|
| YIN **every** quantum | Unnecessary for Listen (UI ≤ display rate); riskiest for glitches/GC; rewrite needed (reuse buffers, maybe smaller τ range). |
| Ring-buffer in worklet; YIN every **N** quanta (e.g. 4–16); `postMessage` or slot update less often | Matches Chromium’s “buffer size mismatch → ring buffer” pattern; analysis rate similar to today’s rAF; little latency win vs window. |
| Keep YIN on main thread; AnalyserNode @ rAF | Current design; analysis off the audio callback; mic graph stays light (`MediaStreamSource → Gain → Analyser`). |

Onsets alone every quantum are cheap, but Improwiser’s onset lockout is already **90 ms** (`OnsetDetector`), so sub-frame onset detection does not advance Practice until pitch steadies under the two-equal rule.

---

## 4. Getting results to React without per-message re-renders

Today (`ListenPill.tsx`): every rAF calls `setFrame` (tuner + meter + pill note) — intentional local state. Chart/hex only update when MIDI changes (`onHeard`); Practice only on `noteStart`. So the chart is **already** coalesced; the tuner **wants** ~display-rate updates.

If analysis moved to a worklet, primary options:

| Bridge | What primary sources say | Fit |
|---|---|---|
| **`port.postMessage` every hop** | Built-in; structured clone / transfer. Chrome Audio Worklet blogs. | Easy; can flood main thread if every quantum. Coalesce in the processor (send at ≤60 Hz) or ignore extras on main. |
| **postMessage + main rAF poll of “latest”** | Processor writes into a transferable buffer or main keeps `latest = event.data`; UI reads in rAF. | Matches tuner display rate; avoids React setState storms if you only `setState` when values change or once per frame. |
| **SharedArrayBuffer ring + Atomics** | Requires cross-origin isolation (COOP/COEP). MDN SAB / `crossOriginIsolated`; Chrome design-pattern “WebAudio Powerhouse”. | Lowest messaging overhead; **highest deploy cost** for a static app; overkill for a few floats (midi, cents, level, flags). |
| **Keep analysis main-thread** | Analyser read in rAF (current). | No bridge; React pattern already tuned. |

**Recommendation for any future worklet:** prefer **coalesced `postMessage` (or a single latest-result object) + rAF UI**, not SAB, unless profiling shows message cost matters. Do not `setState` on every quantum.

---

## 5. What latency is actually gained?

Decomposition of today’s ~**50–80 ms to first steady reading** (061 Notes):

| Component | Approx. | Worklet changes it? |
|---|---|---|
| Fill / hold **2048-sample window** for low pitch (~A1 needs period ≈ 873 samples; YIN difference uses half-window) | **~43 ms** at 48 kHz | **No** — same physics unless window shrinks (064) |
| Hop / schedule lag until first analysis after energy arrives | Up to ~1 rAF ≈ 8–16 ms (or ~8 ms @ 120 Hz) | Yes — hop can be 2.7–10 ms |
| **Two equal MIDI readings** | ≥ 1 extra hop/frame ≈ 8–16 ms today | Yes — two hops at 10 ms ≈ 20 ms worst, or ~5 ms at quantum rate |
| Onset lockout (re-attack) | 90 ms | Unrelated to thread |
| Display / React | Tuner paints next frame | Still display-bound for needle |

**Net:** moving to a worklet might shave on the order of **~10–30 ms** of *scheduling* lag in the best case (faster hops + faster two-equal confirm), while **~43 ms window fill remains**. Perceived tuner latency stays close to “window + paint”. Practice `noteStart` still waits for steady pitch after onset (`NoteTracker` 250 ms attack window).

Background-tab continuity is a real difference (audio thread vs paused rAF) but **Listen/Practice UX is foreground** (chart, hex, tuner). Silent mic analysis in a background tab is not a product goal and may conflict with platform power policies.

---

## Recommendation

| Option | Choice |
|---|---|
| **Move** (pitch + onset in AudioWorklet) | Reject for now |
| **Partly move** (e.g. onsets in worklet, pitch on main) | Reject — onset is cheap and already lockout-limited; split pipelines add sync bugs without meaningful Practice gain |
| **Stay** (rAF + AnalyserNode + pure `pitch.ts`) | **Adopt** |

**Rationale for Improwiser:** Listen is a **visible, interactive** tuner and Practice feeder. Latency is dominated by the **analysis window and acceptance rules**, not by running YIN on the wrong thread. The current architecture keeps heavy-ish JS off the audio callback, uses a widely supported Analyser path, and already limits React churn for the chart. An AudioWorklet would add Vite module packaging, Safari ordering/gesture care, and either COOP/COEP (for SAB) or careful message coalescing — for a small scheduling win that ticket **064 (window by register)** is better positioned to improve.

**When to reopen:** (1) measured main-thread jank during Listen with a busy chart; (2) SPEC grows a BPM/timed Practice path that must stamp notes on the audio clock while the UI thread is loaded; (3) after 064, if high notes use short windows and hop rate becomes the dominant lag.

---

## Open risks / follow-ups for ticket 064 (Analysis window by register)

- **064 is the higher-leverage latency lever:** shorter windows for high register cut the ~43 ms floor; longer or dual windows may be needed below ~A1. That work is **independent of AudioWorklet** and should assume the **current main-thread Analyser API** (`fftSize` or a ScriptProcessor-free ring filled from Analyser/worklet later).
- If 064 introduces **multiple window sizes or overlapping analyses**, CPU cost rises; measure on main thread first. Only if that work blows the rAF budget would a worklet hop-scheduler become attractive.
- Interaction with **two-equal-readings** and **onset lockout (90 ms)** must be specified in 064 — faster windows can increase flicker unless the lock rules adapt.
- Instrument practical ranges (SPEC §10 / research ranges) can pick a **default window per instrument** without moving threads.
- Avoid coupling 064’s prototype to SAB/COOP; keep detectors pure (`pitch.ts`) so they stay unit-tested with synthetic buffers regardless of call site.

---

## Sources (primary)

- MDN: [AudioWorklet](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorklet), [AudioWorkletNode](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletNode), [AudioWorkletGlobalScope](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletGlobalScope), [AudioWorkletProcessor.process](https://developer.mozilla.org/en-US/docs/Web/API/AudioWorkletProcessor/process), [Worklet.addModule](https://developer.mozilla.org/en-US/docs/Web/API/Worklet/addModule), [requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame), [Page Visibility API](https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API), [SharedArrayBuffer](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer), [Atomics](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Atomics), [crossOriginIsolated](https://developer.mozilla.org/en-US/docs/Web/API/Window/crossOriginIsolated), [COOP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Cross-Origin-Opener-Policy), [AnalyserNode.getFloatTimeDomainData](https://developer.mozilla.org/en-US/docs/Web/API/AnalyserNode/getFloatTimeDomainData)
- W3C Web Audio API: [bikeshed source](https://raw.githubusercontent.com/WebAudio/web-audio-api/main/index.bs) (render quantum default 128, `AudioContextState`)
- WHATWG HTML: [event loop / rendering opportunity](https://html.spec.whatwg.org/multipage/webappapis.html#event-loop-processing-model)
- Chromium: [Audio Worklet](https://developer.chrome.com/blog/audio-worklet), [Audio Worklet design pattern](https://developer.chrome.com/blog/audio-worklet-design-pattern), [Background tabs](https://developer.chrome.com/blog/background_tabs)
- WebKit: [247614](https://bugs.webkit.org/show_bug.cgi?id=247614), [275801](https://bugs.webkit.org/show_bug.cgi?id=275801), [274507](https://bugs.webkit.org/show_bug.cgi?id=274507), [237878](https://bugs.webkit.org/show_bug.cgi?id=237878)
- Gecko: [Bugzilla 1630877](https://bugzilla.mozilla.org/show_bug.cgi?id=1630877), [1871765](https://bugzilla.mozilla.org/show_bug.cgi?id=1871765), [1291741](https://bugzilla.mozilla.org/show_bug.cgi?id=1291741) (AudioContext vs timer throttling)
- Vite: [Static Asset Handling](https://vite.dev/guide/assets.html) (`?url`, `new URL(..., import.meta.url)`)
- Feature baseline: [web-features-explorer audio-worklet](https://web-platform-dx.github.io/web-features-explorer/features/audio-worklet/)
- Local: `src/listen/mic.ts`, `src/listen/pitch.ts`, `src/listen/ListenPill.tsx`, `package.json`, SPEC §9.2, issues/061 Notes
