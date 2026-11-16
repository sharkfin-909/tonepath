// Chart screen (SPEC §3.1): the two-row control header over the chart, above the docked hex (which takes the height
// the chart leaves). Modes (§3.0): Tuner (§3.8) · Improvise (§3.3) · Write etude (§3.2) · Read etude (§3.4); the
// transport (§3.7) and Listen (§9.2). The rules live in pure modules: the editing session (`session.ts`), the keyboard
// table (`keymap.ts`), the progression document (`document.ts`: undo + saving), the instrument view (`view.ts`), chord
// entry (`chordEntry.ts`), the transport (`transport.ts`, `metronomeRun.ts`) and the mic intake (`micIntake.ts`). This
// file renders them and performs their effects (Web Audio, device settings, browser events, the mic).
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
import { hasTransport, initialSession, listens, reduce, type Effect, type Intent, type SessionState } from './session';
import { enterChord } from './chordEntry';
import { HONEYCOMB, linearOctaves, type HexShape } from './hex';
import { keyIntent } from './keymap';
import { clickUnderPointer, trackPointer } from './pointerClick';
import { instrumentView } from './view';
import { ListenPill } from './listen/ListenPill';
import { TransportBar } from './rail/TransportBar';
import { HEX_HIDDEN, HEX_LINEAR, METRONOME_BPM, METRONOME_SOUND, TRANSPORT_LOOP } from './deviceSettings';
import { useDeviceSetting } from './useDeviceSetting';
import { ModePanel } from './rail/ModePanel';
import { Dropdown } from './rail/Dropdown';
import { NEW_INTAKE, appSounded, isPlayed, type MicIntake } from './micIntake';
import { useMetronome } from './useMetronome';
import { loopRange, transportForm, upcomingTargets } from './transport';

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
  }, [session.mode]);
  /** Clicking an unparseable slot's dock label opens its chord field. */
  // Linear (SPEC §8.5): the dock as one row, switched by octave. The layout is a device setting; the octave isn't
  // saved (it starts mid-range and is kept within the instrument's range).
  const [linearSetting, setLinear] = useDeviceSetting(HEX_LINEAR);
  const [hexHidden, setHexHidden] = useDeviceSetting(HEX_HIDDEN);
  // Phones (SPEC §3.6): the honeycomb is too small there, so the dock is always Linear; the saved setting is kept.
  const narrow = useMediaQuery('(max-width: 640px)');
  const linear = linearSetting || narrow;
  const [octaveWanted, setOctave] = useState<number | null>(null);
  const toggleLinear = () => setLinear(!linearSetting);
  /** Listen (SPEC §9.2): the concert note the mic hears, or null. */
  const [heardConcert, setHeardConcert] = useState<number | null>(null);
  const [tunerSlot, setTunerSlot] = useState<HTMLDivElement | null>(null);
  const [levelsSlot, setLevelsSlot] = useState<HTMLDivElement | null>(null);
  // The transport (SPEC §3.7): tempo, click sound and Loop are device settings shared by Improvise and Read etude;
  // whether it runs is the session's. `restart` is bumped to start it afresh from the current slot (start, rewind).
  const [loop, setLoop] = useDeviceSetting(TRANSPORT_LOOP);
  const [metroBpm, setMetroBpm] = useDeviceSetting(METRONOME_BPM);
  const [metroSound, setMetroSound] = useDeviceSetting(METRONOME_SOUND);
  const [metroRestart, setMetroRestart] = useState(0);
  /** Mic intake (SPEC §3.3): the echo guard over the app's own sounds. */
  const intakeRef = useRef<MicIntake>(NEW_INTAKE);
  /** Write etude: the last note sounded by ` (step-play) or a melody-note click, concert pitch; lights the hex (`n` replays). */
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
  const { mode, running } = session;
  const writing = mode === 'write';
  const active = writing ? view.slotAt(caretAt) : view.slots[Math.min(session.slot, view.slots.length - 1)];

  /** Commit an edit at the current caret: one undo step and one save (SPEC §6.3, §12.1). */
  const commit = (next: Progression) => {
    const s = sessionRef.current;
    if (!doc.commit(next, Math.min(s.caret, instrumentView(doc.progression).end))) return false;
    askPersist();
    rerender();
    return true;
  };

  const perform = (effects: Effect[]) => {
    // Listening (Tuner, Improvise): the mic will hear these sounds — guard against taking them for the player (SPEC §3.3).
    if (listens(sessionRef.current.mode)) {
      const sounds = effects.filter(
        (e): e is Extract<Effect, { type: 'chord' | 'root' | 'bass' | 'note' }> =>
          e.type === 'chord' || e.type === 'root' || e.type === 'bass' || e.type === 'note',
      );
      intakeRef.current = appSounded(intakeRef.current, sounds, performance.now());
    }
    for (const e of effects) {
      switch (e.type) {
        case 'note':
          playNote(e.midi);
          break;
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
    const out = reduce(sessionRef.current, doc.progression, intent);
    if (out.edit) commit(out.edit);
    sessionRef.current = out.state;
    setSession(out.state);
    perform(out.effects);
    // Write etude: a stepped (`) or selected melody note lights its hex cells as if played (a click lights its own).
    if (before.mode === 'write' && (intent.type === 'step-play' || intent.type === 'event-click')) {
      const note = out.effects.find((e): e is Extract<Effect, { type: 'note' }> => e.type === 'note');
      if (note) setSounded((f) => ({ midi: note.midi, n: (f?.n ?? 0) + 1 }));
    }
    // Starting the transport, or rewinding it while it runs: afresh from the (new) current slot.
    if ((intent.type === 'transport' && intent.run && !before.running && out.state.running) || (intent.type === 'rewind' && before.running)) {
      setMetroRestart((n) => n + 1);
    }
  };
  const dispatchRef = useRef(dispatch);
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
        mode: s.mode,
        running: s.running,
        selection: s.selection,
        hovered: hovered.current,
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

  // The transport (SPEC §3.7): over the looped bars (the selection) or the whole form, from the current slot.
  const range = useMemo(() => (hasTransport(mode) ? loopRange(view.slots, session.selection) : null), [mode, view.slots, session.selection]);
  const form = useMemo(() => transportForm(view, range), [view, range]);
  useMetronome({
    running: running && hasTransport(mode),
    bpm: metroBpm,
    sound: metroSound,
    meter: view.meter,
    slots: form.slots,
    end: form.end,
    startSlot: session.slot,
    loop,
    restart: metroRestart,
    onSlot: (index) => dispatchRef.current({ type: 'transport-chord', index }),
    onEnd: () => dispatchRef.current({ type: 'transport-end' }),
  });
  /** Improvise, running: the upcoming chord's tones, ringed on the hex. */
  const targets = mode === 'improvise' && running ? upcomingTargets(view, range, active.index) : null;

  /** A note start the mic heard (concert): in Improvise, the player's (not the app's own) brings a waiting sound. */
  const onMicNote = useCallback((concert: number) => {
    if (!isPlayed(intakeRef.current, concert, performance.now())) return;
    if (sessionRef.current.mode === 'improvise') dispatchRef.current({ type: 'heard' });
  }, []);

  // The mode panel (SPEC §3.1): Mode; after a choice, keys go back to the hex.
  const modeSwitch = (
    <ModePanel
      mode={mode}
      onMode={(m) => {
        dispatch({ type: 'mode', mode: m });
        focusHex();
      }}
    />
  );
  /** Undo / redo (SPEC §6.3): Write etude's editing pill, and Improvise's form group. */
  const undoRedo = (
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
  );
  const tuner = mode === 'tuner';
  const read = mode === 'read';
  const improvise = mode === 'improvise';
  /** Hide hex: Improvise only (SPEC §3.1); Read etude has no hex at all. */
  const hideHex = improvise && hexHidden;

  return (
    <div className="layout-c">
      <header
        className="topbar"
        aria-label="Controls"
        // After a header button or a dropdown choice, focus goes back to the hex grid. Inline text fields (title,
        // time signature) keep it: clicking them starts editing.
        onClick={(e) => {
          const el = e.target as Element;
          // A dropdown's button keeps focus while its menu is open; a choice in the menu hands keys back to the hex.
          if (el.closest('.dropdown-option') || (el.closest('button') && !el.closest('.inline-value') && !el.closest('.dropdown'))) focusHex();
        }}
      >
        {/* Row 1: title (left) · sound pill (centre) · mode panel (right); row 2: the editing controls (SPEC §3.1). */}
        {/* Row 1, left: the app's name. */}
        <div className="topbar-left">
          <span className="brand">TONEPATH</span>
        </div>
        {/* Row 1, centred: sound and *Audio on chord* (*On arrival*), in a pill. */}
        <div className="sound-section group topbar-center">
          <AudioControls
            muted={muted}
            onToggleMute={() => dispatch({ type: 'toggle-mute' })}
            onChord={() => dispatch({ type: 'sound', what: 'chord' })}
            onBass={() => dispatch({ type: 'sound', what: 'bass' })}
            onScale={() => dispatch({ type: 'sound', what: 'scale' })}
            noChord={tuner}
          />
          {/* In every mode (SPEC §3.0); Tuner has no chord, so it is greyed there. */}
          <div className="rail-setting on-arrival">
            <span className="rail-label">Audio on chord</span>
            <Dropdown
              value={session.onArrival}
              label="Audio on chord"
              disabled={tuner}
              options={(Object.keys(ON_ARRIVAL_LABELS) as OnArrival[]).map((v) => ({ value: v, label: ON_ARRIVAL_LABELS[v] }))}
              onChange={(how) => dispatch({ type: 'set-arrival', how })}
            />
          </div>
        </div>
        {/* Row 1, right: the mode panel (Mode:), in a pill. */}
        <div className="mode-corner">{modeSwitch}</div>
        <div className="topbar-row">
          {/* Row 2, left (under TONEPATH): ← Library, then the etude name above the file name (the title), stacked. */}
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
          {/* Row 2, centred: the mode's own groups, side by side (SPEC §3.0) — none in Tuner. */}
          <div className="mode-groups">
            {/* Improvise (SPEC §3.3): the lead sheet's form group — time, bars per row, undo / redo — while stopped. */}
            {improvise && !running && (
              <div className="edit-pill form-group group">
                <TimeSignatureField value={progression.timeSignature} onChange={(text) => dispatch({ type: 'time-signature', text })} />
                <BarsPerRow value={progression.barsPerRow} onChange={(n) => commit(setBarsPerRow(doc.progression, n))} />
                {undoRedo}
              </div>
            )}
            {/* The transport (SPEC §3.7): Improvise and Read etude. */}
            {(improvise || read) && (
              <TransportBar
                bpm={metroBpm}
                onBpm={setMetroBpm}
                sound={metroSound}
                onSound={setMetroSound}
                running={running}
                onStartStop={() => dispatch({ type: 'transport', run: !running })}
                onRewind={() => dispatch({ type: 'rewind' })}
                loop={loop}
                onLoop={setLoop}
                bars={session.selection}
                onAllBars={() => dispatch({ type: 'clear-selection' })}
              />
            )}
            {/* The editing controls, in a pill: Write etude only (SPEC §3.2). */}
            {writing && (
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
                {/* Nudge (SPEC §6.2): the note at the caret up / down a scale step (↑ / ↓); ⇧ a semitone, ⌥ an octave. */}
                <div className="step-controls">
                  <button
                    type="button"
                    className="rail-button icon-button"
                    title="Nudge the note at the caret down a scale step (↓) · ⇧-click / ⇧↓ a semitone · ⌥↓ an octave"
                    aria-label="Nudge down"
                    onClick={(e) =>
                      dispatch({
                        type: 'nudge',
                        dir: -1,
                        octave: false,
                        scale: !e.shiftKey,
                      })
                    }
                  >
                    <svg viewBox="0 0 12 12" width="16" height="16" aria-hidden>
                      <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="rail-button icon-button"
                    title="Nudge the note at the caret up a scale step (↑) · ⇧-click / ⇧↑ a semitone · ⌥↑ an octave"
                    aria-label="Nudge up"
                    onClick={(e) =>
                      dispatch({
                        type: 'nudge',
                        dir: 1,
                        octave: false,
                        scale: !e.shiftKey,
                      })
                    }
                  >
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
                {undoRedo}
                <ClearMenu
                  canClearNotes={progression.melody.length > 0}
                  canClearAll={progression.melody.length > 0 || progression.bars.some((b) => b.some((s) => s.chord !== '' || s.scale !== undefined))}
                  onClearNotes={() => dispatch({ type: 'clear-notes' })}
                  onClearAll={() => dispatch({ type: 'clear-all' })}
                />
              </div>
            )}
          </div>
          {/* The instrument picker: after the mode's group, in every mode. */}
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
      <main ref={mainRef} className={read ? 'main read' : tuner ? 'main tuner-mode' : hideHex ? 'main hex-hidden' : 'main'}>
        <section
          className="chart-area"
          style={{
            maxHeight: read || hideHex ? undefined : mainHeight / 2 || undefined,
          }}
        >
          {tuner ? (
            // Tuner (SPEC §3.8): the chart pane stays, empty, at the chart's height — nothing moves between modes.
            <div className="chart-pane-empty" aria-hidden>
              <Chart
                progression={progression}
                view={view}
                caret={caretAt}
                onSlotClick={() => {}}
                onEventClick={() => {}}
                onTimeClick={() => {}}
                onChordCommit={onChordCommit}
                onScaleChange={() => {}}
                selection={null}
                onBarSelect={() => {}}
                onBarAction={() => {}}
                onAppendBar={() => {}}
                canPaste={false}
                mode="improvise"
                current={null}
                maxHeight={mainHeight ? mainHeight / 2 - CHART_PAD_Y : undefined}
              />
            </div>
          ) : (
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
              mode={mode}
              current={writing ? null : active.index}
              running={running}
              maxHeight={mainHeight ? (read || hideHex ? mainHeight : mainHeight / 2) - CHART_PAD_Y : undefined}
            />
          )}
        </section>
        {session.notice && (
          <p key={session.notice.n} className="notice" role="status">
            {session.notice.text}
          </p>
        )}
        {/* Listen (SPEC §9.2): on in Tuner and Improvise (§3.0); its tuner and levels portal into the row above the hex. */}
        <ListenPill
          onHeard={setHeardConcert}
          nameOf={(m) => (tuner ? view.plainName(m) : view.name(m, active))}
          onNote={onMicNote}
          auto={listens(mode)}
          tunerSlot={tunerSlot}
          levelsSlot={levelsSlot}
          concertLowMidi={view.inst.range ? view.toConcert(view.inst.range.lo) : null}
        />
        {!read && (
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
              dock={tuner ? view.tunerDock(shape) : view.dock(active.index, shape)}
              onLabelClick={() =>
                setEditRequest((r) => ({
                  bar: active.bar,
                  part: active.part,
                  n: (r?.n ?? 0) + 1,
                }))
              }
              onPick={(written) => dispatch({ type: 'pick', written })}
              onHoverPitch={(p) => {
                hovered.current = p;
              }}
              halo={writing && haloPitch !== null ? view.toWritten(haloPitch) : null}
              // Heard notes light the hex in Tuner, and in Improvise while the transport is stopped (SPEC §3.3, §3.8).
              heard={heardConcert !== null && (tuner || (improvise && !running)) ? view.toWritten(heardConcert) : null}
              targets={targets && { pcs: targets, midi: null }}
              sounded={writing && sounded ? { midi: view.toWritten(sounded.midi), n: sounded.n } : null}
              still={improvise && running}
            />
          </section>
        )}
        {/* While listening (Listen, §9.2): a row on top of the hex panel's top edge, overlaying the chart (it takes
            none of the hex's space) — the tuner centred, its input level and meter at the left. */}
        {listens(mode) && (
          <div className="listen-row">
            <div className="tuner-slot" ref={setTunerSlot} />
            <div className="levels-slot" ref={setLevelsSlot} />
          </div>
        )}
        {/* Hide / show the hex panel (SPEC §3.1): Improvise only; the screen's bottom right corner, remembered on the device. */}
        {improvise && (
          <button
            type="button"
            className="hex-hide-toggle"
            aria-pressed={hexHidden}
            title={hexHidden ? 'Show the hex panel' : 'Hide the hex panel (the chart takes the screen)'}
            onClick={() => {
              setHexHidden(!hexHidden);
              focusHex();
            }}
          >
            {hexHidden ? 'Show hex' : 'Hide hex'}
          </button>
        )}
      </main>
    </div>
  );
}
