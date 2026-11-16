// Chart screen (SPEC §3.1): the two-row control header over the chart, above the docked hex (which takes the height
// the chart leaves). Modes (§3.0): Tune (§3.8) · Improvise (§3.3) · Write etude (§3.2) · Read etude (§3.4); the
// transport (§3.7) and Listen (§9.2). The rules live in pure modules: what each mode shows and lets through
// (`modeProfile.ts`), the editing session (`session.ts`, run by `useChartSession`), the keyboard table (`keymap.ts`),
// the chart layout (`zoom.ts`), what lights the hex (`hexLighting.ts`), the instrument view (`view.ts`), the transport
// (`transport.ts`, `metronomeRun.ts`, run by `useTransport`) and the mic intake (`micIntake.ts`). This file renders them.
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { LengthLatch } from './rail/LengthLatch';
import { Chart } from './chart/Chart';
import { BarsPerRow, ClearMenu, TimeSignatureField, TitleField } from './rail/RailSettings';
import { InstrumentPicker } from './rail/InstrumentPicker';
import { unlockAudio } from './audio';
import { ON_ARRIVAL_LABELS, type OnArrival } from './device';
import { AudioControls } from './rail/AudioControls';
import { DockedHex } from './hex/DockedHex';
import type { StoredProgression } from './storage';
import { HONEYCOMB, linearOctaves, type HexShape } from './hex';
import { keyIntent } from './keymap';
import { clickUnderPointer, trackPointer } from './pointerClick';
import { ChordBumpControls } from './listen/ChordBumpControls';
import { ListenPill } from './listen/ListenPill';
import { TransportBar } from './rail/TransportBar';
import { HEX_HIDDEN, HEX_LINEAR } from './deviceSettings';
import { useDeviceSetting } from './useDeviceSetting';
import { ModePanel } from './rail/ModePanel';
import { Dropdown } from './rail/Dropdown';
import { modeProfile } from './modeProfile';
import { hexLighting } from './hexLighting';
import { LEAD_SLOT_MAX_PHONE_PX, chartArea } from './zoom';
import { useChartSession } from './useChartSession';
import { useTransport } from './useTransport';
import { etudeOf } from './progression';
import type { Carried } from './session';
import { EtudePicker } from './rail/EtudePicker';
import type { LibraryCurrent } from './library/LibraryScreen';
import { HamburgerMenu } from './rail/HamburgerMenu';

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

const inTextField = (el: unknown) => el instanceof Element && !!el.closest('input, textarea, select, [contenteditable]');

export interface AppProps {
  /** The progression to edit. Key the component by its id so undo history is per progression (SPEC §6.3). */
  initial: StoredProgression;
  /** The ☰ menu's Library: the library modal (SPEC §3.5). */
  onLibrary: () => void;
  /** A New progression opens with its title in edit (SPEC §3.5). */
  renameOnOpen?: boolean;
  /** The mode and bar clipboard to open with (none on launch); switching progressions keeps them (SPEC §3.0, §4.1). */
  carried?: Carried;
  /** The mode or clipboard changed (the caller carries them to the next progression opened). */
  onCarry?: (carried: Carried) => void;
  /** The open progression and etude, for the library modal's top section. */
  onEtudeDock?: (dock: LibraryCurrent | null) => void;
}

/** The chart screen (layout C, SPEC §3.1) for one progression. */
export function App({ initial, onLibrary, renameOnOpen = false, carried, onCarry, onEtudeDock }: AppProps) {
  const chart = useChartSession({ initial, onDeleted: onLibrary, onTransportRestart: () => transport.restart(), carried });
  const { doc, progression, view, session, dispatch } = chart;
  const { mode, running } = session;
  const profile = modeProfile(mode, running);
  useEffect(() => onCarry?.({ mode, clip: session.clip }), [mode, session.clip, onCarry]);
  /** The open etude: its melody (Write etude, Read etude) and its instrument (every mode). */
  const etude = etudeOf(progression, session.etude);
  useEffect(() => {
    onEtudeDock?.({
      title: progression.title,
      etudes: progression.etudes,
      open: etude.id,
      onOpen: (id) => dispatch({ type: 'etude-open', id }),
      onNew: () => dispatch({ type: 'etude-new' }),
      onDuplicate: () => dispatch({ type: 'etude-duplicate' }),
      onRename: (text) => dispatch({ type: 'etude-rename', text }),
      onDelete: () => dispatch({ type: 'etude-delete' }),
    });
    return () => onEtudeDock?.(null);
  }, [onEtudeDock, progression, etude.id, dispatch]);

  /** The written pitch A would pick (the hovered hex cell or ♯ / ♭ button). */
  const hovered = useRef<number | null>(null);
  /** The hex dock: focus returns here after every header click, so keys go to the grid, not the last control. */
  const dockRef = useRef<HTMLElement>(null);
  const focusHex = () => dockRef.current?.focus({ preventScroll: true });
  /** The space under the header: the chart takes its share (`chartArea`), the hex the rest. */
  const mainRef = useRef<HTMLElement>(null);
  const [mainHeight, setMainHeight] = useState(0);
  useLayoutEffect(() => {
    const el = mainRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setMainHeight(Math.floor(e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [mode]);
  /** Improvise / Tune: bottom overlay (tuner bar + hex) — chart scrollport sits above it. */
  const dockWrapRef = useRef<HTMLDivElement>(null);
  const [dockWrapHeight, setDockWrapHeight] = useState(0);
  /** The bottom stack (sound pill, and from tablet down the mode's groups): its height, so a hex-hidden listen row
   *  can stack its pills above it (CSS `--sound-bar-h`). */
  const [soundBar, setSoundBar] = useState<HTMLDivElement | null>(null);
  const [soundBarHeight, setSoundBarHeight] = useState(0);
  useLayoutEffect(() => {
    if (!soundBar) return;
    const ro = new ResizeObserver(([e]) => setSoundBarHeight(Math.ceil(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height)));
    ro.observe(soundBar);
    return () => ro.disconnect();
  }, [soundBar]);
  // Linear (SPEC §8.5): the dock as one row, switched by octave. The layout is a device setting; the octave isn't
  // saved (it starts mid-range and is kept within the instrument's range).
  const [linearSetting, setLinear] = useDeviceSetting(HEX_LINEAR);
  const [hexHidden, setHexHidden] = useDeviceSetting(HEX_HIDDEN);
  // Phones (SPEC §3.6): the honeycomb is too small there, so the dock is always Linear; the saved setting is kept.
  const narrow = useMediaQuery('(max-width: 640px)');
  /** Phones (SPEC §3.6): the chart shows one bar per row (two cards don't fit); the saved setting is kept and returns
   *  on a wider screen, and the bars / row picker is hidden. */
  const chartProgression = useMemo(() => (narrow && progression.barsPerRow !== 1 ? { ...progression, barsPerRow: 1 } : progression), [narrow, progression]);
  /** Tablet and phone: the edit pill and the transport bar leave the header for the bottom stack. */
  const tablet = useMediaQuery('(max-width: 1024px)');
  /** The hex panel's share of the space under the header (SPEC §3.6): a little more from tablet down. */
  const hexShare = tablet ? 0.6 : 0.5;
  const linear = linearSetting || narrow;
  const [octaveWanted, setOctave] = useState<number | null>(null);
  const toggleLinear = () => setLinear(!linearSetting);
  /** Listen (SPEC §9.2): the concert note the mic hears, or null. */
  const [heardConcert, setHeardConcert] = useState<number | null>(null);
  const [tunerSlot, setTunerSlot] = useState<HTMLDivElement | null>(null);
  const [levelsSlot, setLevelsSlot] = useState<HTMLDivElement | null>(null);
  const [bumpSlot, setBumpSlot] = useState<HTMLDivElement | null>(null);
  /** Read etude: scale names in the chart header (off by default). */
  const [showReadScales, setShowReadScales] = useState(false);
  useEffect(() => {
    if (mode !== 'read') setShowReadScales(false);
  }, [mode]);
  const [editRequest, setEditRequest] = useState<{ bar: number; part: number; n: number } | null>(null);

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
  const writing = mode === 'write';
  const active = writing ? view.slotAt(caretAt) : view.slots[Math.min(session.slot, view.slots.length - 1)];

  // The transport (SPEC §3.7): over the looped bars (the selection) or the whole form, from the current slot.
  const transport = useTransport({
    view,
    profile,
    selection: session.selection,
    slot: session.slot,
    onSlot: (index) => dispatch({ type: 'transport-chord', index }),
    onEnd: () => dispatch({ type: 'transport-end' }),
  });

  // Pills flash when one of their controls is used: replay the CSS
  // animation on the group the click or change came from.
  useEffect(() => {
    const flash = (e: Event) => {
      const g = (e.target as Element | null)?.closest?.('.pill');
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

  // Keyboard (SPEC §11): the keymap turns a key into an intent; ignored while a text field has focus.
  const current = chart.current;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (inTextField(e.target)) return; // native undo and typing there
      const s = current();
      const r = keyIntent(e, {
        mode: s.mode,
        running: s.running,
        selection: s.selection,
        hovered: hovered.current,
      });
      if (r.handled) e.preventDefault(); // no page scroll, no button activation, no browser back
      if (r.click) clickUnderPointer();
      if (r.intent) dispatch(r.intent);
    };
    window.addEventListener('keydown', onKey);
    const untrack = trackPointer();
    return () => {
      window.removeEventListener('keydown', onKey);
      untrack();
    };
  }, [current, dispatch]);

  const onRefusalShown = useCallback(() => dispatch({ type: 'refusal-shown' }), [dispatch]);

  const { halo, muted } = session;
  const haloPitch = halo && halo.caret === caretAt && halo.melody === etude.melody ? halo.pitch : null;
  const lighting = hexLighting({
    profile,
    view,
    active: active.index,
    range: transport.range,
    heard: heardConcert,
    sounded: chart.sounded,
    halo: haloPitch,
  });
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
          <button type="button" className="rail-button chip chip--icon" title="Undo (⌘Z)" aria-label="Undo" disabled={!doc.canUndo} onClick={() => dispatch({ type: 'undo' })}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path fill="currentColor" d="M12.5 8c-2.65 0-5.05.99-6.9 2.6L2 7v9h9l-3.62-3.62c1.39-1.16 3.16-1.88 5.12-1.88 3.54 0 6.55 2.31 7.6 5.5l2.37-.78C21.08 11.03 17.15 8 12.5 8z" />
            </svg>
          </button>
          <button type="button" className="rail-button chip chip--icon" title="Redo (⇧⌘Z)" aria-label="Redo" disabled={!doc.canRedo} onClick={() => dispatch({ type: 'redo' })}>
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden>
              <path fill="currentColor" d="M18.4 10.6C16.55 8.99 14.15 8 11.5 8c-4.65 0-8.58 3.03-9.96 7.22L3.9 16c1.05-3.19 4.05-5.5 7.6-5.5 1.95 0 3.73.72 5.12 1.88L13 16h9V7l-3.6 3.6z" />
            </svg>
          </button>
        </div>
  );
  const tune = mode === 'tune';
  const read = mode === 'read';
  const improvise = mode === 'improvise';
  /** Hide hex: Improvise only (SPEC §3.1); Read etude has no hex at all. */
  const hideHex = profile.hexHideable && hexHidden;
  const dockedBottom = improvise || tune;
  /** Tablet and down, hex showing: the input level and chord bump pills move from the listen row into the hex panel. */
  const listenInDock = tablet && profile.hex && !hideHex;
  const area = chartArea(profile.chartBudget, profile.chart, mainHeight, dockedBottom ? dockWrapHeight : 0, hexShare);
  useLayoutEffect(() => {
    if (!dockedBottom) {
      setDockWrapHeight(0);
      return;
    }
    const el = dockWrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setDockWrapHeight(Math.floor(e.borderBoxSize?.[0]?.blockSize ?? e.contentRect.height)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [dockedBottom, hideHex, linear, mode]);

  const formControls = profile.formGroup && (
    <div className="edit-pill form-group pill">
      <TimeSignatureField value={progression.timeSignature} onChange={(text) => dispatch({ type: 'time-signature', text })} />
      {!narrow && <BarsPerRow value={progression.barsPerRow} onChange={(n) => dispatch({ type: 'bars-per-row', n })} />}
      {undoRedo}
    </div>
  );

  const transportControls = profile.transportBar && (
    <TransportBar
      bpm={transport.bpm}
      onBpm={transport.setBpm}
      sound={transport.sound}
      onSound={transport.setSound}
      running={running}
      onStartStop={() => dispatch({ type: 'transport', run: !running })}
      onRewind={() => dispatch({ type: 'rewind' })}
      loop={transport.loop}
      onLoop={transport.setLoop}
      bars={session.selection}
      onAllBars={() => dispatch({ type: 'clear-selection' })}
      barCount={progression.bars.length}
      onPickBars={(from, to) => {
        dispatch({ type: 'bar-select', bar: from, extend: false });
        if (to !== from) dispatch({ type: 'bar-select', bar: to, extend: true });
      }}
      showScales={read ? showReadScales : undefined}
      onShowScales={read ? setShowReadScales : undefined}
    />
  );

  const editControls = profile.editPill && (
    <div className="edit-pill pill">
      <LengthLatch
        value={session.length}
        onChange={(d) => dispatch({ type: 'length', d })}
        rest={session.rest}
        onToggleRest={() => dispatch({ type: 'toggle-rest' })}
        refusal={session.refusal}
        onRefusalShown={onRefusalShown}
      />
      <TimeSignatureField value={progression.timeSignature} onChange={(text) => dispatch({ type: 'time-signature', text })} />
      {!narrow && <BarsPerRow value={progression.barsPerRow} onChange={(n) => dispatch({ type: 'bars-per-row', n })} />}
      <div className="step-controls">
        <button
          type="button"
          className="rail-button chip chip--icon"
          title="Nudge the note at the caret down a scale step (⌥↓) · ⇧-click / ⇧↓ a semitone · ↓ an octave"
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
          className="rail-button chip chip--icon"
          title="Nudge the note at the caret up a scale step (⌥↑) · ⇧-click / ⇧↑ a semitone · ↑ an octave"
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
      <div className="step-controls">
        <button type="button" className="rail-button chip chip--icon" title="Step back: play the note before the caret, and move the caret to it" aria-label="Step back" onClick={() => dispatch({ type: 'step-play', dir: -1 })}>
          <svg viewBox="0 0 12 12" width="16" height="16" aria-hidden>
            <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <button type="button" className="rail-button chip chip--icon" title="Step forward: play the note at the caret, and move past it (` or ~)" aria-label="Step forward" onClick={() => dispatch({ type: 'step-play' })}>
          <svg viewBox="0 0 12 12" width="16" height="16" aria-hidden>
            <path d="M4.5 2.5 8 6 4.5 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>
      {undoRedo}
      <ClearMenu
        canClearNotes={etude.melody.length > 0}
        canClearAll={etude.melody.length > 0 || progression.bars.some((b) => b.some((s) => s.chord !== '' || s.scale !== undefined))}
        onClearNotes={() => dispatch({ type: 'clear-notes' })}
        onClearAll={() => dispatch({ type: 'clear-all' })}
      />
    </div>
  );

  const soundSection = (
    <div
      ref={setSoundBar}
      className="sound-bar"
      onClick={(e) => {
        const el = e.target as Element;
        if (el.closest('.dropdown-option') || (el.closest('button') && !el.closest('.inline-value') && !el.closest('.dropdown'))) focusHex();
      }}
    >
      {tablet && (editControls || transportControls) && (
        <div className="sound-bar-row">
          {editControls}
          {transportControls}
        </div>
      )}
      <div className="sound-section pill">
        <AudioControls
          muted={muted}
          onToggleMute={() => dispatch({ type: 'toggle-mute' })}
          onChord={() => dispatch({ type: 'sound', what: 'chord' })}
          onBass={() => dispatch({ type: 'sound', what: 'bass' })}
          onScale={() => dispatch({ type: 'sound', what: 'scale' })}
          noChord={profile.noChord}
        />
        <div className="rail-setting on-arrival">
          <span className="pill-label">Audio on chord</span>
          <Dropdown
            value={session.onArrival}
            label="Audio on chord"
            disabled={profile.noChord}
            options={(Object.keys(ON_ARRIVAL_LABELS) as OnArrival[]).map((v) => ({ value: v, label: ON_ARRIVAL_LABELS[v] }))}
            onChange={(how) => dispatch({ type: 'set-arrival', how })}
          />
        </div>
      </div>
    </div>
  );

  /** Hide / Show hex (Improvise): the hex panel's bottom right corner; tablet and down, the tuner bar's right end (SPEC §3.6). */
  const hexToggle = profile.hexHideable && (
    <button
      type="button"
      className={tablet ? 'hex-hide-toggle pill pill--sm in-row' : 'hex-hide-toggle pill pill--sm'}
      aria-pressed={hexHidden}
      title={hexHidden ? 'Show the hex panel' : 'Hide the hex panel'}
      onClick={() => {
        setHexHidden(!hexHidden);
        focusHex();
      }}
    >
      {hexHidden ? 'Show hex' : 'Hide hex'}
    </button>
  );

  const chartAreaStyle: CSSProperties = {
    paddingTop: area.padTop,
    paddingBottom: area.padBottom,
    ...(dockedBottom
      ? { position: 'absolute', top: 0, left: 0, right: 0, bottom: dockWrapHeight, overflowY: 'auto', minHeight: 0 }
      : area.maxHeight != null
        ? { height: area.maxHeight, maxHeight: area.maxHeight }
        : {}),
  };

  return (
    <div className="layout-c" style={{ '--sound-bar-h': `${soundBarHeight}px`, '--hex-share': `${hexShare * 100}%` } as CSSProperties}>
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
        {/* Row 1, centre: the wordmark (where the sound pill was). */}
        <div className="topbar-brand">
          <span className="brand">TONEPATH</span>
        </div>
        {/* Row 1, left: the mode panel and clef (Concert) + instrument, in one pill (SPEC §3.1). */}
        <div className="mode-ins-group pill">
          {modeSwitch}
          <span className="ins-group">
            <InstrumentPicker
              instrument={view.inst.id}
              concertClef={etude.concertClef === 'bass' ? 'bass' : 'treble'}
              onInstrument={(id) => dispatch({ type: 'instrument', id })}
              onConcertClef={(clef) => dispatch({ type: 'clef', clef })}
            />
          </span>
        </div>
        {/* Row 1, right: chord sequence and etude, in one pill, then ☰ (SPEC §3.1). */}
        <div className="topbar-end">
          <div className="topbar-file">
            <span className="file-group pill">
              <span className="seq-group">
                <span className="pill-label">chord sequence:</span>
                <h1 className="rail-heading">
                  <TitleField title={progression.title} editing={renameOnOpen} onRename={(text) => dispatch({ type: 'title', text })} />
                </h1>
              </span>
              <span className="etude-group">
                <span className="pill-label">etude:</span>
                <EtudePicker
                  etudes={progression.etudes}
                  open={etude.id}
                  onOpen={(id) => dispatch({ type: 'etude-open', id })}
                  onNew={() => dispatch({ type: 'etude-new' })}
                  onDuplicate={() => dispatch({ type: 'etude-duplicate' })}
                  onRename={(text) => dispatch({ type: 'etude-rename', text })}
                  onDelete={() => dispatch({ type: 'etude-delete' })}
                />
              </span>
            </span>
          </div>
          <HamburgerMenu items={[{ label: 'Library', onChoose: onLibrary }]} />
        </div>
        {/* Row 2: the mode's own groups (SPEC §3.0) — none in Tune. */}
        <div className="mode-groups">
            {/* Tablet and down: edit and transport sit in the bottom stack, above the sound pill; Improvise's form
                group stays here. */}
            {formControls}
            {!tablet && transportControls}
            {!tablet && editControls}
        </div>
      </header>
      <main
        ref={mainRef}
        className={[
          'main',
          read && 'read',
          writing && 'write',
          tune && 'tuner-mode',
          improvise && 'improvise',
          hideHex && 'hex-hidden',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <section className="chart-area" style={chartAreaStyle}>
          {profile.chartEmpty ? (
            // Tune (SPEC §3.8): the chart pane stays, empty, at the chart's height — nothing moves between modes.
            <div className="chart-pane-empty" aria-hidden>
              <Chart
                progression={chartProgression}
                melody={etude.melody}
                view={view}
                caret={caretAt}
                onSlotClick={() => {}}
                onEventClick={() => {}}
                onTimeClick={() => {}}
                onChordCommit={chart.enterChord}
                onScaleChange={() => {}}
                selection={null}
                onBarSelect={() => {}}
                onBarAction={() => {}}
                canPaste={false}
                profile={profile}
                current={null}
                fitHeight={area.fitHeight}
              />
            </div>
          ) : (
            <Chart
              progression={chartProgression}
              melody={etude.melody}
              view={view}
              caret={caretAt}
              onSlotClick={(slot) => dispatch({ type: 'slot-click', index: slot.index })}
              onEventClick={(event) => dispatch({ type: 'event-click', event })}
              onTimeClick={(t) => dispatch({ type: 'time-click', t })}
              onChordCommit={chart.enterChord}
              onScaleChange={(bar, part, scale) => dispatch({ type: 'scale-override', bar, part, scale })}
              onChordClear={(bar, part) => dispatch({ type: 'chord-clear', bar, part })}
              editRequest={editRequest}
              selection={session.selection}
              onBarSelect={(bar, extend) => dispatch({ type: 'bar-select', bar, extend })}
              onBarAction={(bar, action) => dispatch({ type: 'bar-action', bar, action })}
              onLoopClear={() => dispatch({ type: 'clear-selection' })}
              onDeleteSlot={(bar, part) => dispatch({ type: 'slot-delete', bar, part })}
              canPaste={!!session.clip}
              profile={profile}
              current={writing ? null : active.index}
              scales={read && showReadScales}
              leadMaxPx={narrow ? LEAD_SLOT_MAX_PHONE_PX : undefined}
              fitHeight={area.fitHeight}
            />
          )}
        </section>
        {session.notice && (
          <p key={session.notice.n} className="notice" role="status">
            {session.notice.text}
          </p>
        )}
        {dockedBottom ? (
          <div ref={dockWrapRef} className="hex-dock-wrap">
            {profile.listens && (
              <div className="listen-row">
                {!listenInDock && <div className="levels-slot" ref={setLevelsSlot} />}
                <div className="tuner-slot" ref={setTunerSlot} />
                {improvise && !hideHex && !listenInDock && <div className="bump-slot" ref={setBumpSlot} />}
                {tablet && hexToggle && <div className="hex-toggle-slot">{hexToggle}</div>}
              </div>
            )}
            {improvise && profile.listens && !hideHex && (
              <ChordBumpControls
                slot={bumpSlot}
                on={session.chordBump}
                notes={session.chordBumpNotes}
                onToggle={(on) => dispatch({ type: 'set-chord-bump', on })}
                onNotes={(notes) => dispatch({ type: 'set-chord-bump-notes', notes })}
              />
            )}
            {profile.hex && !hideHex && (
              <section ref={dockRef} className={linear ? 'dock linear' : 'dock'} aria-label="Docked hex" tabIndex={-1}>
                {/* Tablet and down: the input level and chord bump pills sit in the hex panel's top corners. */}
                {listenInDock && <div className="levels-slot" ref={setLevelsSlot} />}
                {listenInDock && improvise && <div className="bump-slot" ref={setBumpSlot} />}
                {!narrow && (
                  <button
                    type="button"
                    className={linear ? 'grid-toggle pill pill--sm' : 'grid-toggle pill pill--sm on'}
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
                {linear && (
                  <div className="octave-switch pill" role="group" aria-label="Octave">
                    <button type="button" className="octave-step chip chip--icon" aria-label="Octave down" title="Octave down" disabled={octave <= octaves.min} onClick={() => setOctave(octave - 12)}>
                      <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden>
                        <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                    <span className="octave-name">{`oct ${octave / 12 - 1}`}</span>
                    <button type="button" className="octave-step chip chip--icon" aria-label="Octave up" title="Octave up" disabled={octave >= octaves.max} onClick={() => setOctave(octave + 12)}>
                      <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden>
                        <path d="M4.5 2.5 8 6 4.5 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </button>
                  </div>
                )}
                <DockedHex
                  dock={profile.noChord ? view.tunerDock(shape) : view.dock(active.index, shape)}
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
                  {...lighting}
                />
              </section>
            )}
            {!tablet && hexToggle}
          </div>
        ) : (
          profile.hex && (
            <section ref={dockRef} className={linear ? 'dock linear' : 'dock'} aria-label="Docked hex" tabIndex={-1}>
              {!narrow && (
                <button
                  type="button"
                  className={linear ? 'grid-toggle pill pill--sm' : 'grid-toggle pill pill--sm on'}
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
              {linear && (
                <div className="octave-switch pill" role="group" aria-label="Octave">
                  <button type="button" className="octave-step chip chip--icon" aria-label="Octave down" title="Octave down" disabled={octave <= octaves.min} onClick={() => setOctave(octave - 12)}>
                    <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden>
                      <path d="M7.5 2.5 4 6l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                  <span className="octave-name">{`oct ${octave / 12 - 1}`}</span>
                  <button type="button" className="octave-step chip chip--icon" aria-label="Octave up" title="Octave up" disabled={octave >= octaves.max} onClick={() => setOctave(octave + 12)}>
                    <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden>
                      <path d="M4.5 2.5 8 6 4.5 9.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>
              )}
              <DockedHex
                dock={view.dock(active.index, shape)}
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
                {...lighting}
              />
            </section>
          )
        )}
        {/* Listen (SPEC §9.2): portals tuner UI into `.listen-row` when Improvise / Tune. */}
        <ListenPill
          onHeard={setHeardConcert}
          nameOf={(m) => (tune ? view.plainName(m) : view.name(m, active))}
          onNote={chart.heardNote}
          auto={profile.listens}
          tunerSlot={tunerSlot}
          levelsSlot={levelsSlot}
          concertLowMidi={view.inst.range ? view.toConcert(view.inst.range.lo) : null}
        />
      </main>
      {soundSection}
    </div>
  );
}
