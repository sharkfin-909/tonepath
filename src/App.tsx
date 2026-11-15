// Chart screen (SPEC §3.1): the two-row control header over the chart, above the docked hex (which takes the height
// the chart leaves). Modes: Play | Practice | Write | Read (§3.3–3.4, §3.7); Listen and Practice (§9.2, §3.7).
// The rules live in pure modules: the editing session (`session.ts`), the keyboard table (`keymap.ts`), the
// progression document (`document.ts`: undo + saving), the instrument view (`view.ts`), chord entry
// (`chordEntry.ts`) and practice (`practice.ts`). This file renders them and performs their effects (Web Audio,
// device settings, browser events, the mic).
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { LengthLatch } from './rail/LengthLatch';
import { Chart } from './chart/Chart';
import { setBarsPerRow, setConcertClef, setEtudeName, setInstrument, setScaleOverride, setTitle, type Progression } from './progression';
import { BarsPerRow, ClearMenu, EtudeNameField, TimeSignatureField, TitleField } from './rail/RailSettings';
import { InstrumentPicker } from './rail/InstrumentPicker';
import { playBass, playChord, playNote, playRoot, playScale, setMuted, unlockAudio } from './audio';
import { onArrivalOf, ON_ARRIVAL_LABELS, readDevice, writeDevice, type OnArrival } from './device';
import { AudioControls } from './rail/AudioControls';
import { DockedHex } from './hex/DockedHex';
import type { StoredProgression } from './storage';
import { openDocument, type ProgressionDocument } from './document';
import { initialSession, reduce, type Effect, type Intent, type SessionState } from './session';
import { enterChord } from './chordEntry';
import { HONEYCOMB, linearOctaves, type HexShape } from './hex';
import { keyIntent } from './keymap';
import { clickUnderPointer, trackPointer } from './pointerClick';
import { instrumentView } from './view';
import { prettyName } from './spelling';
import { ListenPill } from './listen/ListenPill';
import { PracticePanel } from './listen/PracticePanel';
import { ADVANCE_RULES, echoGuard, isEcho, practiceCount, practiceNote, practiceTargets, startPractice, type AdvanceRule, type EchoGuard, type PracticeState } from './practice';

/** A CSS media query as React state (SPEC §3.6 responsive layout). */
function useMediaQuery(query: string): boolean {
  const [match, setMatch] = useState(() => typeof matchMedia !== 'undefined' && matchMedia(query).matches);
  useEffect(() => {
    const m = matchMedia(query);
    const on = () => setMatch(m.matches);
    on();
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, [query]);
  return match;
}

/** `navigator.storage.persist()` once per session, on the first edit (SPEC §12.1). */
let persistAsked = false;
function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

/** The chart area's vertical padding (top + bottom), matching `.chart-area` in styles.css. */
const CHART_PAD_Y = 16;

const inTextField = (el: unknown) => el instanceof Element && !!el.closest('input, textarea, select, [contenteditable]');

export interface AppProps {
  /** The progression to edit. Key the component by its id so undo history is per progression (SPEC §6.3). */
  initial: StoredProgression;
  /** ← Library. */
  onLibrary: () => void;
  /** A New progression opens with its title in edit (SPEC §3.5). */
  renameOnOpen?: boolean;
}

/** The chart screen (layout C, SPEC §3.1) for one progression. */
export function App({ initial, onLibrary, renameOnOpen = false }: AppProps) {
  const docRef = useRef<ProgressionDocument | null>(null);
  docRef.current ??= openDocument(localStorage, initial);
  const doc = docRef.current;
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const progression = doc.progression;

  const [session, setSession] = useState<SessionState>(() => {
    const device = readDevice(localStorage);
    return initialSession(doc.progression, { muted: device.muted, onArrival: onArrivalOf(device) });
  });
  const sessionRef = useRef(session);
  /** The written pitch A would pick (the hovered hex cell or ♯ / ♭ button). */
  const hovered = useRef<number | null>(null);
  /** The hex dock: focus returns here after every header click, so keys go to the grid, not the last control. */
  const dockRef = useRef<HTMLElement>(null);
  const focusHex = () => dockRef.current?.focus({ preventScroll: true });
  /**
   * The chart sizes to its rows (even padding above and below) within half the space under the header; the hex
   * takes everything else.
   */
  const mainRef = useRef<HTMLElement>(null);
  const [mainHeight, setMainHeight] = useState(0);
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setMainHeight(Math.floor(e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [session.stand]);
  /** Clicking an unparseable slot's dock label opens its chord field. */
  // Linear (SPEC §8.5): the dock as one row, switched by octave. The layout is a device setting; the octave isn't
  // saved (it starts mid-range and is kept within the instrument's range).
  const [linearSetting, setLinear] = useState(() => readDevice(localStorage).hexShape === 'linear');
  // Phones (SPEC §3.6): the honeycomb is too small there, so the dock is always Linear; the saved setting is kept.
  const narrow = useMediaQuery('(max-width: 640px)');
  const linear = linearSetting || narrow;
  const [octaveWanted, setOctave] = useState<number | null>(null);
  const toggleLinear = () =>
    setLinear((on) => {
      writeDevice(localStorage, { hexShape: on ? 'honeycomb' : 'linear' });
      return !on;
    });
  /** Listen (SPEC §9.2): the concert note the mic hears, or null. */
  const [heardConcert, setHeardConcert] = useState<number | null>(null);
  const [tunerSlot, setTunerSlot] = useState<HTMLDivElement | null>(null);
  const [levelsSlot, setLevelsSlot] = useState<HTMLDivElement | null>(null);
  // Practice (SPEC §3.7): which slot is being practised and how many notes were played in it; the rule and loop are
  // device settings.
  const [practice, setPractice] = useState<PracticeState | null>(null);
  const [practiceRule, setPracticeRule] = useState<AdvanceRule>(() => {
    const r = readDevice(localStorage).practiceRule;
    return ADVANCE_RULES.some((x) => x.id === r) ? (r as AdvanceRule) : 'guide';
  });
  const [practiceLoop, setPracticeLoop] = useState(() => readDevice(localStorage).practiceLoop !== false);
  const [practiceCountN, setPracticeCountN] = useState(() => practiceCount(readDevice(localStorage).practiceCount));
  const [practiceAdvances, setPracticeAdvances] = useState(0);
  /** The app's own sounds the mic may hear while practising (On arrival). */
  const echoRef = useRef<EchoGuard | null>(null);
  /** Write + Listen: skip note audition so the speaker does not re-trigger the mic. */
  const listeningRef = useRef(false);
  /** Last mic write (for dedupe while Listen is on in Write). */
  const lastMicWriteRef = useRef<{ written: number; at: number } | null>(null);
  /** Write: the last note sounded by ` (step-play) or a melody-note click, concert pitch; lights the hex (`n` replays). */
  const [sounded, setSounded] = useState<{ midi: number; n: number } | null>(null);
  const [editRequest, setEditRequest] = useState<{ bar: number; part: number; n: number } | null>(null);

  const view = useMemo(() => instrumentView(progression), [progression]);
  const octaves = linearOctaves(view.range);
  const octave = Math.min(octaves.max, Math.max(octaves.min, octaveWanted ?? octaves.start));
  // Linear: a new octave slides in from the side it lies on — up from the right, down from the left.
  const prevOctave = useRef(octave);
  useLayoutEffect(() => {
    const was = prevOctave.current;
    prevOctave.current = octave;
    if (!linear || was === octave || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const svg = dockRef.current?.querySelector('.docked-hex svg');
    const dx = (octave > was ? 1 : -1) * 48;
    svg?.animate([{ transform: `translateX(${dx}px)`, opacity: 0 }, { transform: 'translateX(0)', opacity: 1 }], { duration: 220, easing: 'ease-out' });
  }, [octave, linear]);
  const shape: HexShape = linear ? { kind: 'linear', octave } : HONEYCOMB;
  const caretAt = Math.min(session.caret, view.end); // the form can shrink under the caret
  const playing = session.playIndex !== null;
  const active = playing ? view.slots[Math.min(session.playIndex!, view.slots.length - 1)] : view.slotAt(caretAt);

  /** Commit an edit at the current caret: one undo step and one save (SPEC §6.3, §12.1). */
  const commit = (next: Progression) => {
    const s = sessionRef.current;
    if (!doc.commit(next, Math.min(s.caret, instrumentView(doc.progression).end))) return false;
    askPersist();
    rerender();
    return true;
  };

  const perform = (effects: Effect[]) => {
    // Practice: the mic will hear these sounds — guard against counting them as played notes (SPEC §3.7).
    // That includes a hex pick's audition: hex picks count in Practice even with Audio input enabled.
    if (sessionRef.current.practice) {
      const sounds = effects.filter((e): e is Extract<Effect, { type: 'chord' | 'root' | 'bass' | 'note' }> => e.type === 'chord' || e.type === 'root' || e.type === 'bass' || e.type === 'note');
      const now = performance.now();
      const g = echoGuard(sounds, now);
      const old = echoRef.current;
      // Still ringing: keep guarding the earlier sounds too (a pick mustn't drop a chord's guard).
      if (g) echoRef.current = old && now < old.until ? { start: g.start, until: Math.max(g.until, old.until), midis: new Set([...old.midis, ...g.midis]) } : g;
    }
    for (const e of effects) {
      switch (e.type) {
        case 'note': {
          const s = sessionRef.current;
          const writing = s.playIndex === null && !s.practice && !s.stand;
          const mutePick = writing && listeningRef.current && e.pick === true;
          if (!mutePick) playNote(e.midi);
          break;
        }
        case 'chord':
          playChord(e.harmony);
          break;
        case 'root':
          playRoot(e.harmony);
          break;
        case 'bass':
          playBass(e.harmony);
          break;
        case 'scale':
          playScale(e.harmony);
          break;
        case 'device':
          writeDevice(localStorage, e.patch);
          break;
        case 'history': {
          const s = sessionRef.current;
          const caret = doc[e.dir](Math.min(s.caret, instrumentView(doc.progression).end));
          if (caret !== null) {
            rerender();
            dispatch({ type: 'restored', caret });
          }
          break;
        }
      }
    }
  };

  /** Run an intent through the session: commit its edit, keep its state, perform its effects. */
  const dispatch = (intent: Intent) => {
    const before = sessionRef.current;
    const writing = before.playIndex === null;
    const out = reduce(sessionRef.current, doc.progression, intent);
    if (out.edit) commit(out.edit);
    sessionRef.current = out.state;
    setSession(out.state);
    perform(out.effects);
    // Write: a stepped (`) or selected melody note lights its hex cells as if played (a click lights its own).
    if (writing && (intent.type === 'step-play' || intent.type === 'event-click')) {
      const note = out.effects.find((e): e is Extract<Effect, { type: 'note' }> => e.type === 'note');
      if (note) setSounded((f) => ({ midi: note.midi, n: (f?.n ?? 0) + 1 }));
    }
    // Practice: a hex pick is always a played note (an attack), as the mic's would be — with Audio input on or off.
    if (intent.type === 'pick' && before.practice) {
      practicePlayedRef.current(instrumentView(doc.progression).toConcert(intent.written), true);
    }
  };
  const dispatchRef = useRef(dispatch);
  /** Practice's note handler (set below, once its state is in scope). */
  const practicePlayedRef = useRef<(heard: number, fromOnset: boolean) => void>(() => {});
  dispatchRef.current = dispatch;

  // Groups (the header's pills, the hex panel's wells) flash when one of their controls is used: replay the CSS
  // animation on the group the click or change came from.
  useEffect(() => {
    const flash = (e: Event) => {
      const g = (e.target as Element | null)?.closest?.('.group, .well');
      if (!(g instanceof HTMLElement)) return;
      g.style.animation = 'none';
      void g.offsetWidth; // restart
      g.style.animation = '';
    };
    document.addEventListener('click', flash);
    document.addEventListener('change', flash);
    return () => {
      document.removeEventListener('click', flash);
      document.removeEventListener('change', flash);
    };
  }, []);

  // Mute (SPEC §9): the audio module follows the session.
  useEffect(() => setMuted(session.muted), [session.muted]);

  // AudioContext created / resumed on the first user gesture (SPEC §9).
  useEffect(() => {
    const unlock = () => {
      unlockAudio();
      window.removeEventListener('pointerdown', unlock, true);
      window.removeEventListener('keydown', unlock, true);
    };
    window.addEventListener('pointerdown', unlock, true);
    window.addEventListener('keydown', unlock, true);
    return unlock;
  }, []);

  // Another tab changed this progression (SPEC §12.1): reload it quietly unless a text field is open here; deleted
  // elsewhere → library.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.newValue !== null && inTextField(document.activeElement)) return;
      const r = doc.external(e.key, e.newValue);
      if (r === 'deleted') onLibrary();
      else if (r === 'reloaded') {
        rerender();
        dispatchRef.current({ type: 'restored' });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [doc, onLibrary]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') doc.flush(); // keeps updatedAt
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [doc]);

  // Keyboard (SPEC §11): the keymap turns a key into an intent; ignored while a text field has focus.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inTextField(e.target)) return; // native undo and typing there
      const s = sessionRef.current;
      const r = keyIntent(e, {
        mode: s.stand ? 'stand' : s.playIndex !== null ? 'play' : 'write',
        selection: s.selection,
        hovered: hovered.current,
        practice: s.practice,
      });
      if (r.handled) e.preventDefault(); // no page scroll, no button activation, no browser back
      if (r.click) clickUnderPointer();
      if (r.intent) dispatchRef.current(r.intent);
    };
    window.addEventListener('keydown', onKey);
    const untrack = trackPointer();
    return () => {
      window.removeEventListener('keydown', onKey);
      untrack();
    };
  }, []);

  useEffect(() => {
    if (!session.notice) return;
    const id = setTimeout(() => dispatchRef.current({ type: 'notice-done' }), 2500);
    return () => clearTimeout(id);
  }, [session.notice]);

  // An undo can shrink the form under a selection.
  useEffect(() => {
    if (session.selection && session.selection.to >= progression.bars.length) dispatchRef.current({ type: 'clear-selection' });
  }, [session.selection, progression.bars.length]);

  const onRefusalShown = useCallback(() => dispatchRef.current({ type: 'refusal-shown' }), []);

  // Input in a non-Concert view is read as written (SPEC §5.3).
  /** Chord entry (SPEC §4.2): one step — transposition, splitting, the key's mode — committed as one undo step. */
  const onChordCommit = (bar: number, part: number, text: string) => {
    const r = enterChord(doc.progression, view, bar, part, text);
    if (r.ok) commit(r.progression);
    return r;
  };
  const onScaleChange = (bar: number, part: number, scale: Parameters<typeof setScaleOverride>[3]) =>
    commit(setScaleOverride(doc.progression, bar, part, scale));

  /** Instrument switch: one undo step; the device remembers it for new progressions (SPEC §10). */
  const onInstrument = (id: string) => {
    commit(setInstrument(doc.progression, id));
    writeDevice(localStorage, { lastInstrument: doc.progression.instrument });
  };

  const { halo } = session;
  const haloPitch = halo && halo.caret === caretAt && halo.melody === progression.melody ? halo.pitch : null;
  const { muted } = session;

  // Practice: start (or restart) on the current slot whenever Practice begins or the slot changes by hand.
  const practiceSlot = session.practice ? session.playIndex : null;
  // Follow (SPEC §3.7): the written notes played correctly this time through, marked on the staves.
  const [played, setPlayed] = useState<ReadonlySet<number>>(() => new Set());
  useEffect(() => {
    if (practiceSlot !== null && practice && practice.slot === practiceSlot) return; // the mic moved the form on: keep going
    setPractice(practiceSlot === null ? null : startPractice(practiceSlot)); // started, stopped or moved by hand
    setPlayed(new Set());
  }, [practiceSlot]);
  const practiceCtx = { view, melody: progression.melody, rule: practiceRule, count: practiceCountN };
  const practiceTarget = practice ? practiceTargets(practice, practiceCtx) : null;
  /** Mic note starts: Practice advances the form; Write inserts like a hex pick. */
  const micNoteRef = useRef({
    practice,
    practiceCtx,
    practiceLoop,
    practiceOn: session.practice,
    view,
    writeOn: !playing && !session.practice && !session.stand && !session.explore && session.input === 'instrument',
  });
  micNoteRef.current = {
    practice,
    practiceCtx,
    practiceLoop,
    practiceOn: session.practice,
    view,
    writeOn: !playing && !session.practice && !session.stand && !session.explore && session.input === 'instrument',
  };
  const onMicNote = useCallback((heard: number, fromOnset: boolean) => {
    const { practiceOn, view: v, writeOn } = micNoteRef.current;
    if (isEcho(echoRef.current, heard, performance.now())) return; // the app's own On arrival sound
    if (writeOn && !practiceOn) {
      const written = v.toWritten(heard);
      const now = performance.now();
      const last = lastMicWriteRef.current;
      if (last) {
        const dt = now - last.at;
        const diff = Math.abs(written - last.written);
        if (written === last.written && dt < 220) return;
        if (!fromOnset) {
          if (diff <= 2 && dt < 130) return;
          if (diff < 2 && dt < 150) return;
        }
      }
      lastMicWriteRef.current = { written, at: now };
      dispatchRef.current({ type: 'pick', written, silent: true });
      return;
    }
    practicePlayedRef.current(heard, fromOnset);
  }, []);
  /** Practice: a note played (concert) — from the mic, or a hex pick: count it; the right one
   * moves the form on (or ends it, without Loop). */
  const practicePlayed = (heard: number, fromOnset: boolean) => {
    const { practice: p, practiceCtx: c, practiceLoop: loop, practiceOn } = micNoteRef.current;
    if (!practiceOn || !p) return;
    // This note is played in the current slot: a waiting On arrival sound (the slot was reached by finishing the one
    // before) sounds with it.
    dispatchRef.current({ type: 'practice-note' });
    const step = practiceNote(p, heard, c, fromOnset);
    if (step.hit !== undefined) {
      const hit = step.hit;
      // A new time through the form (it wrapped to the start) clears the marks.
      setPlayed((prev) => (step.advanced && step.state.slot < p.slot ? new Set() : new Set(prev).add(hit)));
    }
    if (step.advanced && step.state.slot === 0 && !loop) {
      dispatchRef.current({ type: 'mode', mode: 'write' }); // the end of the form, no loop: practice stops (back to Write)
      return;
    }
    setPractice(step.state);
    if (step.advanced) {
      setPracticeAdvances((n) => n + 1);
      dispatchRef.current({ type: 'practice-advance', index: step.state.slot, landed: step.landed === true });
    }
  };
  practicePlayedRef.current = practicePlayed;
  // On the hex, in written pitch: the notes that move the form on now (a pitch class), or Follow's next note.
  const practiceHexTargets =
    practiceTarget === null
      ? null
      : { pcs: practiceTarget.pcs && new Set([...practiceTarget.pcs].map((pc) => (pc + view.inst.semitones) % 12)), midi: practiceTarget.midi === null ? null : view.toWritten(practiceTarget.midi) };
  const practiceTargetNames =
    practiceTarget === null
      ? ''
      : practiceTarget.midi !== null
        ? prettyName(view.name(practiceTarget.midi, active))
        : practiceTarget.pcs
          ? [...practiceTarget.pcs].map((pc) => prettyName(view.name(60 + pc, view.slots[(active.index + 1) % view.slots.length]).replace(/-?\d+$/, ''))).join(' · ')
          : '';

  // The Mode dropdown's value (SPEC §3.1): Explore · Practice · Write · Read (Read = the read-only page view).
  const mode: 'play' | 'practice' | 'explore' | 'write' | 'read' = session.stand ? 'read' : session.practice ? 'practice' : playing ? 'play' : session.explore ? 'explore' : 'write';
  // The mode panel (SPEC §3.1): two labelled dropdowns, always visible — Audio input (the mic on / off) and Mode.
  const modeSwitch = (
    <div className="mode-panel group">
      <label className="mode-field">
        <span className="ins-label">Audio input</span>
        <button
          type="button"
          role="switch"
          aria-checked={session.input === 'instrument'}
          aria-label="Audio input"
          className={session.input === 'instrument' ? 'switch on' : 'switch'}
          title="Audio input: hear your instrument through the mic (hex picks always work too)"
          onClick={() => {
            dispatch({ type: 'input', how: session.input === 'instrument' ? 'hex' : 'instrument' });
            focusHex();
          }}
        >
          <span className="switch-knob" />
        </button>
      </label>
      <label className="mode-field">
        <span className="ins-label">Mode:</span>
        <select
          className="mode-select"
          value={mode}
          title="Mode: Explore (nothing written) · Practice (the right notes move the form on; P back to Write) · Write (notes entered at the caret) · Read (read-only page; \ in and out)"
          onChange={(e) => {
            const m = e.target.value as 'explore' | 'practice' | 'write' | 'read';
            if (m === 'read') return dispatch({ type: 'stand', on: true });
            if (session.stand) dispatch({ type: 'stand', on: false });
            dispatch({ type: 'mode', mode: m });
            focusHex();
          }}
        >
          <option value="explore">Explore</option>
          <option value="practice">Practice</option>
          <option value="write">Write</option>
          <option value="read">Read</option>
        </select>
      </label>
    </div>
  );

  if (session.stand) {
    return (
      <div className="stand-layout">
        <header className="stand-header">
          <span className="stand-title">{progression.title}</span>
          <span className="stand-instrument">{view.inst.name}</span>
          <span className="stand-spacer" />
          {modeSwitch}
        </header>
        <section className="chart-area stand-chart">
          <Chart
            progression={progression}
            view={view}
            caret={caretAt}
            onSlotClick={() => {}}
            onEventClick={() => {}}
            onTimeClick={() => {}}
            onChordCommit={onChordCommit}
            onScaleChange={onScaleChange}
            selection={null}
            onBarSelect={() => {}}
            onBarAction={() => {}}
            onAppendBar={() => {}}
            canPaste={false}
            stand
          />
        </section>
      </div>
    );
  }

  return (
    <div className="layout-c">
      <header
        className="topbar"
        aria-label="Controls"
        // After a header button or a dropdown choice, focus goes back to the hex grid. Inline text fields (title,
        // time signature) keep it: clicking them starts editing.
        onClick={(e) => {
          const el = e.target as Element;
          if (el.closest('button') && !el.closest('.inline-value')) focusHex();
        }}
        onChange={(e) => {
          if (e.target instanceof HTMLSelectElement) focusHex();
        }}
      >
        {/* Row 1: title (left) · sound pill (centre) · mode panel (right); row 2: the editing controls (SPEC §3.1). */}
        {/* Row 1, left: the app's name. */}
        <div className="topbar-left">
          <span className="brand">WOODSHED</span>
        </div>
        {/* Row 1, centred: sound and *Audio on chord* (*On arrival*), in a pill. */}
        <div className="sound-section group topbar-center">
          <AudioControls
            muted={muted}
            onToggleMute={() => dispatch({ type: 'toggle-mute' })}
            onChord={() => dispatch({ type: 'sound', what: 'chord' })}
            onBass={() => dispatch({ type: 'sound', what: 'bass' })}
            onScale={() => dispatch({ type: 'sound', what: 'scale' })}
          />
          {/* The same dropdown whatever the Audio input: listening never swaps it for a readout. */}
          <p className="rail-setting on-arrival">
            <span className="rail-label">Audio on chord</span>
            <select
              className="rail-select"
              aria-label="Audio on chord"
              value={session.onArrival}
              onChange={(e) => dispatch({ type: 'set-arrival', how: e.target.value as OnArrival })}
            >
              {(Object.keys(ON_ARRIVAL_LABELS) as OnArrival[]).map((v) => (
                <option key={v} value={v}>
                  {ON_ARRIVAL_LABELS[v]}
                </option>
              ))}
            </select>
          </p>
        </div>
        {/* Row 1, right: the mode panel (Audio input: / Mode:), in a pill. */}
        <div className="mode-corner">{modeSwitch}</div>
        <div className="topbar-row">
          {/* Row 2, left (under WOODSHED): ← Library, then the etude name above the file name (the title), stacked. */}
          <div className="topbar-file">
            <button
              type="button"
              className="rail-link"
              onClick={onLibrary} // every edit is already saved
            >
              ← Library
            </button>
            <div className="title-stack">
              <EtudeNameField name={progression.etudeName ?? ''} onRename={(t) => commit(setEtudeName(doc.progression, t))} />
              <h1 className="rail-heading">
                <TitleField title={progression.title} editing={renameOnOpen} onRename={(t) => commit(setTitle(doc.progression, t))} />
              </h1>
            </div>
          </div>
          {/* Practice (SPEC §3.7): its panel, bottom left of the header (where Write's note lengths sit). */}
          {session.practice && practice && (
            <PracticePanel
              rule={practiceRule}
              onRule={(r) => {
                setPracticeRule(r);
                writeDevice(localStorage, { practiceRule: r });
                setPractice(startPractice(practice.slot));
              }}
              loop={practiceLoop}
              onLoop={(on) => {
                setPracticeLoop(on);
                writeDevice(localStorage, { practiceLoop: on });
              }}
              count={practice.count}
              need={practiceTarget!.need}
              targetNames={practiceTargetNames}
              advanced={practiceAdvances}
              notesPerChord={practiceCountN}
              onNotesPerChord={(n) => {
                const c = practiceCount(n);
                setPracticeCountN(c);
                writeDevice(localStorage, { practiceCount: c });
              }}
            />
          )}
          {/* The editing controls, in a pill: Write only (not Practice, whose note count is its own number, SPEC §3.7;
              not Explore, which writes nothing, §3.2). */}
          {!playing && !session.explore && (
            <div className="edit-pill group">
              <LengthLatch
                value={session.length}
                onChange={(d) => dispatch({ type: 'length', d })}
                rest={session.rest}
                onToggleRest={() => dispatch({ type: 'toggle-rest' })}
                refusal={session.refusal}
                onRefusalShown={onRefusalShown}
              />
              <TimeSignatureField value={progression.timeSignature} onChange={(text) => dispatch({ type: 'time-signature', text })} />
              <BarsPerRow value={progression.barsPerRow} onChange={(n) => commit(setBarsPerRow(doc.progression, n))} />
              {/* Nudge (SPEC §6.2): the note at the caret up / down a semitone (↑ / ↓; ⇧ an octave, ⌥ a scale step). */}
              <div className="step-controls">
                <button type="button" className="rail-button icon-button" title="Nudge the note at the caret down a semitone (↓ · ⇧↓ an octave · ⌥↓ a scale step)" aria-label="Nudge down" onClick={() => dispatch({ type: 'nudge', dir: -1, octave: false })}>
                  <svg viewBox="0 0 12 12" width="16" height="16" aria-hidden>
                    <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button type="button" className="rail-button icon-button" title="Nudge the note at the caret up a semitone (↑ · ⇧↑ an octave · ⌥↑ a scale step)" aria-label="Nudge up" onClick={() => dispatch({ type: 'nudge', dir: 1, octave: false })}>
                  <svg viewBox="0 0 12 12" width="16" height="16" aria-hidden>
                    <path d="M2.5 7.5 6 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {/* Stepwise playback (SPEC §6.2): ‹ back, › forward (`) — play the note and move the caret past it. */}
              <div className="step-controls">
                <button type="button" className="rail-button icon-button" title="Step back: play the note before the caret, and move the caret to it" aria-label="Step back" onClick={() => dispatch({ type: 'step-play', dir: -1 })}>
                  <svg viewBox="0 0 12 12" width="16" height="16" aria-hidden>
                    <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button type="button" className="rail-button icon-button" title="Step forward: play the note at the caret, and move past it (` or ~)" aria-label="Step forward" onClick={() => dispatch({ type: 'step-play' })}>
                  <svg viewBox="0 0 12 12" width="16" height="16" aria-hidden>
                    <path d="M4.5 2.5 8 6 4.5 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {/* Undo / redo: at the end, just before Clear. */}
              <div className="undo-controls">
                <button type="button" className="rail-button icon-button" title="Undo (⌘Z)" aria-label="Undo" disabled={!doc.canUndo} onClick={() => dispatch({ type: 'undo' })}>
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                    <path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
                  </svg>
                </button>
                <button type="button" className="rail-button icon-button" title="Redo (⇧⌘Z)" aria-label="Redo" disabled={!doc.canRedo} onClick={() => dispatch({ type: 'redo' })}>
                  <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
                    <path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
                  </svg>
                </button>
              </div>
              <ClearMenu
                canClearNotes={progression.melody.length > 0}
                canClearAll={progression.melody.length > 0 || progression.bars.some((b) => b.some((s) => s.chord !== '' || s.scale !== undefined))}
                onClearNotes={() => dispatch({ type: 'clear-notes' })}
                onClearAll={() => dispatch({ type: 'clear-all' })}
              />
            </div>
          )}
          {/* The instrument picker: after the Write-only editing group, and shown in Play too. */}
          {/* Clef (Concert only) and instrument, in a pill. */}
          <span className="ins-group group">
            <InstrumentPicker
              instrument={view.inst.id}
              concertClef={progression.concertClef === 'bass' ? 'bass' : 'treble'}
              onInstrument={onInstrument}
              onConcertClef={(clef) => commit(setConcertClef(doc.progression, clef))}
            />
          </span>
        </div>
      </header>
      <main ref={mainRef} className="main">
        <section className="chart-area" style={{ maxHeight: mainHeight / 2 || undefined }}>
          <Chart
            progression={progression}
            view={view}
            caret={caretAt}
            onSlotClick={(slot) => dispatch({ type: 'slot-click', index: slot.index })}
            onEventClick={(event) => dispatch({ type: 'event-click', event })}
            onTimeClick={(t) => dispatch({ type: 'time-click', t })}
            onChordCommit={onChordCommit}
            onScaleChange={onScaleChange}
            editRequest={editRequest}
            selection={session.selection}
            onBarSelect={(bar, extend) => dispatch({ type: 'bar-select', bar, extend })}
            onBarAction={(bar, action) => dispatch({ type: 'bar-action', bar, action })}
            onAppendBar={() => dispatch({ type: 'append-bar' })}
            canPaste={!!session.clip}
            playIndex={playing ? active.index : null}
            explore={session.explore && !playing}
            follow={session.practice && practiceRule === 'follow' ? { played } : null}
            maxHeight={mainHeight ? mainHeight / 2 - CHART_PAD_Y : undefined}
          />
        </section>
        {session.notice && (
          <p key={session.notice.n} className="notice" role="status">
            {session.notice.text}
          </p>
        )}
        <section ref={dockRef} className={linear ? 'dock linear' : 'dock'} aria-label="Docked hex" tabIndex={-1}>
          {/* Grid on = the 3-row honeycomb; off = Linear (one row, by octave). SPEC §8.5. Not on phones (always Linear).
              Absolutely positioned at the panel's bottom left. */}
          {!narrow && (
            <button
            type="button"
            className={linear ? 'grid-toggle' : 'grid-toggle on'}
            aria-pressed={!linear}
            title={linear ? 'Grid: show the honeycomb' : 'Grid off: one row (Linear), by octave'}
            onClick={() => {
              toggleLinear();
              focusHex();
            }}
          >
            Grid
          </button>
          )}
          {/* Listen (SPEC §9.2): on in Practice with audio instrument input and in Write with instrument audio; its tuner and levels portal into the
              row above the hex. */}
          <ListenPill
            onHeard={setHeardConcert}
            nameOf={(m) => view.name(m, active)}
            onNote={onMicNote}
            onListening={(on) => {
              listeningRef.current = on;
              if (!on) lastMicWriteRef.current = null;
            }}
            auto={session.input === 'instrument' && !session.stand}
            tunerSlot={tunerSlot}
            levelsSlot={levelsSlot}
            concertLowMidi={view.inst.range ? view.toConcert(view.inst.range.lo) : null}
          />
          {/* Linear (SPEC §8.5): the octave switch, under the row, centred at the panel's bottom. */}
          {linear && (
            <div className="octave-switch group" role="group" aria-label="Octave">
              <button type="button" className="octave-step" aria-label="Octave down" title="Octave down" disabled={octave <= octaves.min} onClick={() => setOctave(octave - 12)}>
                <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden>
                  <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <span className="octave-name">{`oct ${octave / 12 - 1}`}</span>
              <button type="button" className="octave-step" aria-label="Octave up" title="Octave up" disabled={octave >= octaves.max} onClick={() => setOctave(octave + 12)}>
                <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden>
                  <path d="M4.5 2.5 8 6 4.5 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          )}
          <DockedHex
            dock={view.dock(active.index, shape)}
            onLabelClick={() => setEditRequest((r) => ({ bar: active.bar, part: active.part, n: (r?.n ?? 0) + 1 }))}
            onPick={(written) => dispatch({ type: 'pick', written })}
            onHoverPitch={(p) => {
              hovered.current = p;
            }}
            halo={haloPitch === null ? null : view.toWritten(haloPitch)}
            heard={heardConcert === null ? null : view.toWritten(heardConcert)}
            targets={practiceHexTargets}
            sounded={sounded && { midi: view.toWritten(sounded.midi), n: sounded.n }}
          />
        </section>
        {/* While listening (Listen, §9.2): a row on top of the hex panel's top edge, overlaying the chart (it takes
            none of the hex's space) — the tuner centred, its input level and meter at the right. */}
        <div className="listen-row">
          <div className="tuner-slot" ref={setTunerSlot} />
          <div className="levels-slot" ref={setLevelsSlot} />
        </div>
      </main>
    </div>
  );
}
