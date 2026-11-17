// The chart screen's editing session in React (SPEC §3.0, §6.3, §12.1): the open progression document (undo,
// saving, other tabs) and the session state, changed only by intents. `dispatch` runs an intent through the pure
// session (`session.ts`) — which decides what the mode lets through — commits its edit as one undo step, and
// performs its effects: sounds (under the mic's echo guard while listening), device settings, undo / redo, Write
// etude's lit note, and restarting the transport. Nothing else in the screen edits the progression.
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { playBass, playChord, playNote, playRoot, playScale, setMuted } from './audio';
import { onArrivalOf, readDevice, readSetting, writeDevice } from './device';
import { CHORD_BUMP, CHORD_BUMP_NOTES, LAST_MODE, MOVE_BY, TRANSPORT_LOOP } from './deviceSettings';
import { isStandardId } from './standards';
import { openDocument, type ProgressionDocument } from './document';
import { NEW_INTAKE, appSounded, isPlayed, type MicIntake } from './micIntake';
import { modeProfile } from './modeProfile';
import type { ChordCommit, Progression } from './progression';
import { initialSession, reduce, type Carried, type Effect, type Intent, type SessionState } from './session';
import type { StoredProgression } from './storage';
import { instrumentView, type InstrumentView } from './view';

/** `navigator.storage.persist()` once per session, on the first edit (SPEC §12.1). */
let persistAsked = false;
function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

const inTextField = (el: unknown) => el instanceof Element && !!el.closest('input, textarea, select, [contenteditable]');

export interface ChartSessionOptions {
  initial: StoredProgression;
  /** The progression was deleted in another tab: back to the library. */
  onDeleted: () => void;
  /** The session's `transport-restart` effect. */
  onTransportRestart: () => void;
  /** The mode and clipboard to open with (none on launch; the previous progression's when switching). */
  carried?: Carried;
}

export interface ChartSession {
  doc: ProgressionDocument;
  progression: Progression;
  view: InstrumentView;
  session: SessionState;
  /** The session as of the last intent (for event handlers registered once). */
  current: () => SessionState;
  /** Stable across renders. */
  dispatch: (intent: Intent) => void;
  /** Chord entry: the result, refused where the mode doesn't edit chords. */
  enterChord: (bar: number, part: number, text: string) => ChordCommit;
  /** A note start the mic heard (concert): the player's, unless the echo guard takes it for the app's own sound. */
  heardNote: (concert: number) => void;
  /** Write etude: the last stepped / clicked melody note (concert); `n` replays. */
  sounded: { midi: number; n: number } | null;
}

const REFUSED: ChordCommit = { ok: false, message: 'Chords are not editable now' };

export function useChartSession(o: ChartSessionOptions): ChartSession {
  const live = useRef(o);
  live.current = o;

  const docRef = useRef<ProgressionDocument | null>(null);
  docRef.current ??= openDocument(localStorage, o.initial);
  const doc = docRef.current;
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const progression = doc.progression;
  const [session, setSession] = useState<SessionState>(() => {
    const device = readDevice(localStorage);
    // The etude last open in this progression (SPEC §3.0); missing → the first.
    return initialSession(
      doc.progression,
      {
        muted: device.muted,
        onArrival: onArrivalOf(device),
        moveBy: readSetting(localStorage, MOVE_BY),
        chordBump: readSetting(localStorage, CHORD_BUMP),
        lastMode: readSetting(localStorage, LAST_MODE),
        loop: readSetting(localStorage, TRANSPORT_LOOP),
        chordBumpNotes: readSetting(localStorage, CHORD_BUMP_NOTES),
      },
      doc.progression.openEtudeId,
      o.carried,
      { locked: isStandardId(o.initial.id) }, // a standard's chords are read-only (SPEC §3.12)
    );
  });
  const view = useMemo(() => instrumentView(progression, session.etude), [progression, session.etude]);
  const sessionRef = useRef(session);
  /** Mic intake (SPEC §3.3): the echo guard over the app's own sounds. */
  const intakeRef = useRef<MicIntake>(NEW_INTAKE);
  const [sounded, setSounded] = useState<{ midi: number; n: number } | null>(null);

  const caretNow = () => Math.min(sessionRef.current.caret, instrumentView(doc.progression, sessionRef.current.etude).end);

  /** Commit an edit at the current caret: one undo step and one save (SPEC §6.3, §12.1). */
  const commit = (next: Progression) => {
    if (!doc.commit(next, caretNow())) return;
    askPersist();
    rerender();
  };

  const perform = (effects: Effect[]) => {
    // Listening (Tune, Improvise): the mic will hear these sounds — guard against taking them for the player (SPEC §3.3).
    if (modeProfile(sessionRef.current.mode).listens) {
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
        case 'light':
          setSounded((f) => ({ midi: e.midi, n: (f?.n ?? 0) + 1 }));
          break;
        case 'transport-restart':
          live.current.onTransportRestart();
          break;
        case 'history': {
          const caret = doc[e.dir](caretNow());
          if (caret !== null) {
            rerender();
            // The snapshot remembers the etude open when it was taken: undo reopens it.
            dispatchRef.current({ type: 'restored', caret, etude: doc.progression.openEtudeId });
          }
          break;
        }
      }
    }
  };

  /** Run an intent through the session: commit its edit, keep its state, perform its effects. */
  const run = (intent: Intent) => {
    const out = reduce(sessionRef.current, doc.progression, intent);
    if (out.edit) commit(out.edit);
    sessionRef.current = out.state;
    setSession(out.state);
    // Remember the open etude (no undo step); the next commit's snapshot carries it.
    doc.setOpenEtude(out.state.etude);
    perform(out.effects);
    return out;
  };
  const runRef = useRef(run);
  runRef.current = run;
  const dispatchRef = useRef((intent: Intent) => void runRef.current(intent));
  const dispatch = dispatchRef.current;

  // Mute (SPEC §9): the audio module follows the session.
  useEffect(() => setMuted(session.muted), [session.muted]);

  // Another tab changed this progression (SPEC §12.1): reload it quietly unless a text field is open here; deleted
  // elsewhere → library.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage) return;
      if (e.newValue !== null && inTextField(document.activeElement)) return;
      const r = doc.external(e.key, e.newValue);
      if (r === 'deleted') live.current.onDeleted();
      else if (r === 'reloaded') {
        rerender();
        dispatch({ type: 'restored' });
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [doc, dispatch]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') doc.flush(); // keeps updatedAt
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, [doc]);

  useEffect(() => {
    if (!session.notice) return;
    const id = setTimeout(() => dispatch({ type: 'notice-done' }), 2500);
    return () => clearTimeout(id);
  }, [session.notice, dispatch]);

  // An undo can shrink the form under a selection.
  useEffect(() => {
    if (session.selection && session.selection.to >= progression.bars.length) dispatch({ type: 'clear-selection' });
  }, [session.selection, progression.bars.length, dispatch]);

  const heardRef = useRef((concert: number) => {
    if (isPlayed(intakeRef.current, concert, performance.now())) dispatch({ type: 'heard' });
  });

  return {
    doc,
    progression,
    view,
    session,
    current: () => sessionRef.current,
    dispatch,
    enterChord: (bar, part, text) => runRef.current({ type: 'chord-entry', bar, part, text }).entry ?? REFUSED,
    heardNote: heardRef.current,
    sounded,
  };
}
