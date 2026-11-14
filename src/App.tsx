// Chart screen (SPEC §3.1): a header of controls over the chart, above a fixed 50% docked hex.
// The rules live in pure modules: the editing session (`session.ts`), the keyboard table (`keymap.ts`), the
// progression document (`document.ts`: undo + saving) and the instrument view (`view.ts`). This file renders them
// and performs their effects (Web Audio, device settings, browser events).
import { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { LengthLatch } from './rail/LengthLatch';
import { Chart } from './chart/Chart';
import { commitChordText, setBarsPerRow, setConcertClef, setInstrument, setScaleOverride, setTitle, type Progression } from './progression';
import { BarsPerRow, ClearAll, TimeSignatureField, TitleField } from './rail/RailSettings';
import { InstrumentPicker } from './rail/InstrumentPicker';
import { concertChordText } from './instruments';
import { playBass, playChord, playNote, playRoot, playScale, setMuted, unlockAudio } from './audio';
import { onArrivalOf, readDevice, writeDevice, type OnArrival } from './device';
import { AudioControls } from './rail/AudioControls';
import { DockedHex } from './hex/DockedHex';
import type { StoredProgression } from './storage';
import { openDocument, type ProgressionDocument } from './document';
import { initialSession, reduce, type Effect, type Intent, type SessionState } from './session';
import { keyIntent } from './keymap';
import { clickUnderPointer, trackPointer } from './pointerClick';
import { instrumentView } from './view';

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
  /** Clicking an empty / unparseable dock label opens that slot's chord field. */
  const [editRequest, setEditRequest] = useState<{ bar: number; part: number; n: number } | null>(null);

  const view = useMemo(() => instrumentView(progression), [progression]);
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
    const out = reduce(sessionRef.current, doc.progression, intent);
    if (out.edit) commit(out.edit);
    sessionRef.current = out.state;
    setSession(out.state);
    perform(out.effects);
  };
  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

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
  const onChordCommit = (bar: number, part: number, text: string) => {
    const r = commitChordText(doc.progression, bar, part, concertChordText(text, view.inst));
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

  if (session.stand) {
    return (
      <div className="stand-layout">
        <header className="stand-header">
          <span className="stand-title">{progression.title}</span>
          <span className="stand-instrument">{view.inst.name}</span>
          <span className="stand-spacer" />
          <button
            type="button"
            className={muted ? 'rail-button mute on' : 'rail-button mute'}
            aria-pressed={muted}
            title="Mute (M)"
            onClick={() => dispatch({ type: 'toggle-mute' })}
          >
            {muted ? '🔇 Muted' : '🔊 Sound'}
          </button>
          <button type="button" className="rail-button" title="Back to editing (\)" onClick={() => dispatch({ type: 'stand', on: false })}>
            ✎ Edit
          </button>
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
        <button
          type="button"
          className="rail-link"
          onClick={onLibrary} // every edit is already saved
        >
          ← Library
        </button>
        <h1 className="rail-heading">
          <TitleField title={progression.title} editing={renameOnOpen} onRename={(t) => commit(setTitle(doc.progression, t))} />
        </h1>
        <span className="bar-sep" aria-hidden />
        <button type="button" className="rail-button stand-button" title="Stand: read-only page view (\)" onClick={() => dispatch({ type: 'stand', on: true })}>
          ▭ Stand
        </button>
        <div className="mode-switch" role="radiogroup" aria-label="Mode">
          {(['write', 'play'] as const).map((m) => (
            <button
              key={m}
              type="button"
              role="radio"
              aria-checked={(m === 'play') === playing}
              className={(m === 'play') === playing ? 'mode-option on' : 'mode-option'}
              title={m === 'play' ? 'Play: audition only (P)' : 'Write: record hex picks (P)'}
              onClick={() => dispatch({ type: 'mode', mode: m })}
            >
              {m === 'write' ? 'Write' : 'Play'}
            </button>
          ))}
        </div>
        <span className="bar-sep" aria-hidden />
        <InstrumentPicker
          instrument={view.inst.id}
          concertClef={progression.concertClef === 'bass' ? 'bass' : 'treble'}
          onInstrument={onInstrument}
          onConcertClef={(clef) => commit(setConcertClef(doc.progression, clef))}
        />
        <TimeSignatureField value={progression.timeSignature} onChange={(text) => dispatch({ type: 'time-signature', text })} />
        <BarsPerRow value={progression.barsPerRow} onChange={(n) => commit(setBarsPerRow(doc.progression, n))} />
        <span className="bar-sep" aria-hidden />
        <AudioControls
          muted={muted}
          onToggleMute={() => dispatch({ type: 'toggle-mute' })}
          onChord={() => dispatch({ type: 'sound', what: 'chord' })}
          onBass={() => dispatch({ type: 'sound', what: 'bass' })}
          onScale={() => dispatch({ type: 'sound', what: 'scale' })}
        />
        <label className="rail-setting on-arrival">
          <span className="rail-label">On arrival</span>
          <select className="rail-select" value={session.onArrival} onChange={(e) => dispatch({ type: 'set-arrival', how: e.target.value as OnArrival })}>
            <option value="silent">Silent</option>
            <option value="chord">Chord</option>
            <option value="root">Root note</option>
            <option value="bass">Bass note</option>
            <option value="bass-chord">Bass note + chord</option>
          </select>
        </label>
        {!playing && (
          <>
            <span className="bar-sep" aria-hidden />
            <LengthLatch
              value={session.length}
              onChange={(d) => dispatch({ type: 'length', d })}
              rest={session.rest}
              onToggleRest={() => dispatch({ type: 'toggle-rest' })}
              refusal={session.refusal}
              onRefusalShown={onRefusalShown}
            />
            <div className="undo-controls">
              <button type="button" className="rail-button" title="Undo (⌘Z)" disabled={!doc.canUndo} onClick={() => dispatch({ type: 'undo' })}>
                ↶ Undo
              </button>
              <button type="button" className="rail-button" title="Redo (⇧⌘Z)" disabled={!doc.canRedo} onClick={() => dispatch({ type: 'redo' })}>
                ↷ Redo
              </button>
            </div>
            <ClearAll disabled={!progression.melody.length} onClear={() => dispatch({ type: 'clear-all' })} />
          </>
        )}
        {/* Slot browser + readout: ‹ Bar 4 · Bbm7 · B♭ Dorian › (keys < >). */}
        <div className="slot-nav" aria-live="polite">
          <button type="button" className="slot-nav-button" title="Previous slot (<)" aria-label="Previous slot" onClick={() => dispatch({ type: 'browse', dir: -1 })}>
            ‹
          </button>
          <span className="slot-nav-label">
            Bar {active.bar + 1} · <strong>{active.chord || '—'}</strong> · <span className="slot-nav-scale">{active.scaleText}</span>
          </span>
          <button type="button" className="slot-nav-button" title="Next slot (>)" aria-label="Next slot" onClick={() => dispatch({ type: 'browse', dir: 1 })}>
            ›
          </button>
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
            maxHeight={mainHeight ? mainHeight / 2 - CHART_PAD_Y : undefined}
          />
        </section>
        {session.notice && (
          <p key={session.notice.n} className="notice" role="status">
            {session.notice.text}
          </p>
        )}
        <section ref={dockRef} className="dock" aria-label="Docked hex" tabIndex={-1}>
          <DockedHex
            dock={view.dock(active.index)}
            onLabelClick={() => setEditRequest((r) => ({ bar: active.bar, part: active.part, n: (r?.n ?? 0) + 1 }))}
            onPick={(written) => dispatch({ type: 'pick', written })}
            onHoverPitch={(p) => {
              hovered.current = p;
            }}
            halo={haloPitch === null ? null : view.toWritten(haloPitch)}
          />
        </section>
      </main>
    </div>
  );
}
