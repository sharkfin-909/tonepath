// Chart screen, layout C (SPEC §3.1): control rail | chart above a fixed 50% docked hex.
import { useCallback, useEffect, useRef, useState } from 'react';
import { LengthLatch } from './rail/LengthLatch';
import { Chart } from './chart/Chart';
import {
  clearMelody,
  commitChordText,
  setBarsPerRow,
  setConcertClef,
  setInstrument,
  setScaleOverride,
  setTimeSignature,
  setTitle,
  type Duration,
  type MelodyEvent,
  type Progression,
} from './progression';
import { BarsPerRow, CaretReadout, ClearAll, TimeSignatureField, TitleField } from './rail/RailSettings';
import { InstrumentPicker } from './rail/InstrumentPicker';
import { concertChordText, hexRange, instrumentOf, toConcert, toWritten, writtenChord } from './instruments';
import { scaleLabel, slotHarmony, stepPitchClasses, type ScaleId } from './harmony';
import { layoutMeter, slotAt, slotsOf, stepSlot, type FormSlot } from './form';
import {
  backspaceAt,
  caretFromClick,
  deleteAt,
  formEnd,
  insertAt,
  melodyEnd,
  nudge,
  snapToEvent,
  stepCaret,
  type TimedEvent,
} from './melody';
import { playChord, playNote, playRoot, playScale, setMuted, unlockAudio } from './audio';
import { onArrivalOf, readDevice, writeDevice, type OnArrival } from './device';
import { AudioControls } from './rail/AudioControls';
import { DockedHex } from './hex/DockedHex';
import { dockHex } from './hex';
import { appendBar, copyBars, deleteBars, duplicateBars, insertBars, mergeBar, pasteBars, splitBar, type BarClip, type BarEdit } from './bars';
import type { BarAction } from './chart/BarHandle';
import { PROGRESSION_PREFIX, saveProgression, writeProgression, type StoredProgression } from './storage';
import { emptyHistory, record, redo, undo, type History } from './history';

/** `navigator.storage.persist()` once per session, on the first edit (SPEC §12.1). */
let persistAsked = false;
function askPersist() {
  if (persistAsked) return;
  persistAsked = true;
  navigator.storage?.persist?.().catch(() => {});
}

/** One undo step (SPEC §6.3): the whole progression and the caret. */
interface Snapshot {
  progression: StoredProgression;
  caret: number;
}

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
  const [progression, setProgression] = useState<StoredProgression>(() =>
    Array.isArray(initial.melody) ? initial : { ...initial, melody: [] }, // pre-melody saves; full repair is the schema slice
  );
  const current = useRef(progression);
  /** The caret: a time position in the form (SPEC §6.2). Opens at the melody's end; not saved. */
  const [caret, setCaret] = useState(() => melodyEnd(progression.melody));
  /** Length latch (SPEC §6.2 item 6). */
  const [length, setLength] = useState<Duration>('q');
  /** Rest latch (SPEC §6.2 item 6): while on, a length key or button also inserts a rest. */
  const [rest, setRest] = useState(false);
  /** Last nudge: its pitch gets a dashed halo on the hex while caret and melody stay as the nudge left them. */
  const [halo, setHalo] = useState<{ pitch: number; caret: number; melody: MelodyEvent[] } | null>(null);
  /** Mute (SPEC §9): a device setting. */
  const [muted, setMutedState] = useState(() => readDevice(localStorage).muted === true);
  /** Write | Play (SPEC §3.3). Not remembered: always opens in Write. In Play, `playIndex` is the current slot. */
  const [playIndex, setPlayIndex] = useState<number | null>(null);
  const playing = playIndex !== null;
  /** Stand mode (SPEC §3.4): a read-only page view over Write or Play; `\` or ✎ Edit returns to that mode. */
  const [stand, setStand] = useState(false);
  /** Play-mode *On arrival*: a device setting. */
  const [onArrival, setOnArrivalState] = useState<OnArrival>(() => onArrivalOf(readDevice(localStorage)));
  const setOnArrival = (v: OnArrival) => {
    setOnArrivalState(v);
    writeDevice(localStorage, { playArrival: v });
  };
  const firstMute = useRef(true);
  useEffect(() => {
    setMuted(muted);
    if (firstMute.current) firstMute.current = false;
    else writeDevice(localStorage, { muted });
  }, [muted]);
  const toggleMute = useCallback(() => setMutedState((m) => !m), []);

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

  /** A refused insert: the length button flashes with this message. */
  const [refusal, setRefusal] = useState<{ d: Duration; message: string; n: number } | null>(null);

  /** Undo history (SPEC §6.3): in memory, so a reload clears it. The ref is the truth; state drives the buttons. */
  const history = useRef<History<Snapshot>>(emptyHistory());
  const [historyView, setHistoryView] = useState(history.current);
  const setHistory = (h: History<Snapshot>) => {
    history.current = h;
    setHistoryView(h);
  };
  /** The caret as last rendered, for snapshots taken inside handlers. */
  const caretRef = useRef(caret);

  /** Show a progression and write it to storage (SPEC §12.1). */
  const show = (p: StoredProgression) => {
    const saved = saveProgression(localStorage, p);
    current.current = saved;
    setProgression(saved);
  };

  /**
   * Apply a committed edit: one undo step (the state before it, caret included) and one save (SPEC §6.3, §12.1).
   * An edit that changes nothing records nothing.
   */
  const update = useCallback((edit: (p: Progression) => Progression) => {
    const prev = current.current;
    const next = edit(prev);
    if (next === prev) return;
    setHistory(record(history.current, { progression: prev, caret: caretRef.current }));
    show({ ...prev, ...next });
    askPersist();
  }, []);

  /** ⌘Z / ⇧⌘Z: restore a snapshot exactly (melody, chords, overrides, settings, caret); also saved. */
  const step = (dir: 'undo' | 'redo') => {
    const r = (dir === 'undo' ? undo : redo)(history.current, { progression: current.current, caret: caretRef.current });
    if (!r) return;
    setHistory(r.history);
    setSelection(null); // the bars under a selection may change
    show(r.state.progression);
    setCaret(r.state.caret);
    setRefusal(null);
  };

  // Another tab changed this progression (SPEC §12.1): reload it quietly (last write wins) unless an edit is pending
  // here (a text field open); the undo history no longer applies, so it is cleared. Deleted elsewhere → library.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea !== localStorage || e.key !== PROGRESSION_PREFIX + current.current.id) return;
      if (e.newValue === null) {
        onLibrary();
        return;
      }
      const el = document.activeElement;
      if (el instanceof Element && el.closest('input, textarea, [contenteditable]')) return;
      try {
        const next = JSON.parse(e.newValue) as StoredProgression;
        if (!Array.isArray(next.bars) || !Array.isArray(next.melody)) return;
        current.current = next;
        setProgression(next);
        setHistory(emptyHistory());
        setSelection(null);
      } catch {
        // unreadable write from elsewhere: keep what we have
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [onLibrary]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === 'hidden') writeProgression(localStorage, current.current); // keeps updatedAt
    };
    document.addEventListener('visibilitychange', onHide);
    return () => document.removeEventListener('visibilitychange', onHide);
  }, []);

  const onChordCommit = useCallback(
    (bar: number, part: number, text: string) => {
      // Input in a non-Concert view is read as written (SPEC §5.3).
      const p = current.current;
      const r = commitChordText(p, bar, part, concertChordText(text, instrumentOf(p.instrument)));
      if (r.ok) update(() => r.progression);
      return r;
    },
    [update],
  );

  const onScaleChange = useCallback(
    (bar: number, part: number, scale: ScaleId | null) => update((p) => setScaleOverride(p, bar, part, scale)),
    [update],
  );

  const slots = slotsOf(progression.bars, layoutMeter(progression.timeSignature));
  const caretAt = Math.min(caret, formEnd(slots)); // the form can shrink under the caret
  caretRef.current = caretAt;
  const active = playing ? slots[Math.min(playIndex, slots.length - 1)] : slotAt(slots, caretAt)!;
  /** Concert harmony drives sound (SPEC §9); the written one drives the hex, labels and readout (§10). */
  const activeHarmony = slotHarmony(progression.bars[active.bar][active.part]);
  const inst = instrumentOf(progression.instrument);
  const activeWrittenChord = writtenChord(progression.bars[active.bar][active.part].chord, inst);
  const writtenHarmony = slotHarmony({ ...progression.bars[active.bar][active.part], chord: activeWrittenChord });
  /** The dock (SPEC §8.4): scale hex, chord-tones hex, or a rests-only hex borrowing a neighbour's layout. */
  const dock = dockHex(
    slots.map((sl) => (sl.index === active.index ? writtenHarmony : slotHarmony({ ...progression.bars[sl.bar][sl.part], chord: writtenChord(progression.bars[sl.bar][sl.part].chord, inst) }))),
    active.index,
    hexRange(inst),
  );
  /** Bar selection (SPEC §4.1): a run of bars; not undoable. Cleared by caret clicks and Esc. */
  const [selection, setSelection] = useState<{ anchor: number; from: number; to: number } | null>(null);
  /** In-app bar clipboard (Copy / Paste). */
  const [clip, setClip] = useState<BarClip | null>(null);
  /** A short refusal message (e.g. "a note crosses the middle of the bar"). */
  const [notice, setNotice] = useState<{ text: string; n: number } | null>(null);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(null), 2500);
    return () => clearTimeout(id);
  }, [notice]);
  const say = (text: string) => setNotice((old) => ({ text, n: (old?.n ?? 0) + 1 }));
  // An undo can shrink the form under a selection.
  useEffect(() => {
    if (selection && selection.to >= progression.bars.length) setSelection(null);
  }, [selection, progression.bars.length]);
  /** Clicking an empty / unparseable dock label opens that slot's chord field. */
  const [editRequest, setEditRequest] = useState<{ bar: number; part: number; n: number } | null>(null);

  const clearRefusal = useCallback(() => setRefusal(null), []);

  /** The form of the progression as it is now (handlers run between renders). */
  const formNow = () => {
    const p = current.current;
    return { p, slots: slotsOf(p.bars, layoutMeter(p.timeSignature)) };
  };

  /** Insert a pitch (or a rest, null) at the caret with length d; a refusal flashes that length's button. */
  const insert = (d: Duration, pitch: number | null) => {
    const { p, slots: s } = formNow();
    const r = insertAt(p.melody, s, caretAt, d, pitch);
    if (!r.ok) {
      setRefusal((old) => ({ d, message: r.message, n: (old?.n ?? 0) + 1 }));
      return;
    }
    setRefusal(null);
    update(() => ({ ...p, melody: r.melody }));
    setCaret(r.caret);
  };

  /** Hex pick (Write), written pitch → concert: audition, Rest off, insert with the latched length (SPEC §8.3). */
  const onPick = (written: number) => {
    const midi = toConcert(written, inst);
    playNote(midi); // audition (concert), even when the insert is refused
    if (playing) return; // Play: audition only, never recorded
    setRest(false);
    insert(length, midi);
  };

  /** Length key or button: sets the latch; with Rest on, also inserts a rest (silent, SPEC §9). */
  const onLength = (d: Duration) => {
    setLength(d);
    if (rest) insert(d, null);
  };

  /** Del / ⌫ (SPEC §6.2 item 5). */
  const onDelete = (back: boolean) => {
    const p = current.current;
    const r = (back ? backspaceAt : deleteAt)(p.melody, caretAt);
    if (r.melody !== p.melody) update(() => ({ ...p, melody: r.melody }));
    setCaret(r.caret);
  };

  /** ↑ / ↓ (⇧ = octave): nudge the note before the caret; it plays and its hex cell(s) get a halo (item 8). */
  const onNudge = (dir: -1 | 1, octave: boolean) => {
    const { p, slots: s } = formNow();
    const r = nudge(p.melody, s, caretAt, dir, octave, (slot) => stepPitchClasses(slotHarmony(p.bars[slot.bar][slot.part])));
    if (!r.ok) return;
    update(() => ({ ...p, melody: r.melody }));
    playNote(r.pitch);
    setHalo({ pitch: r.pitch, caret: caretAt, melody: r.melody });
  };

  /** Clicking a note plays it and puts the caret at its start (SPEC §6.2 item 7). Rests just take the caret. */
  const onEventClick = (e: TimedEvent) => {
    setSelection(null);
    if ('pitch' in e.ev) playNote(e.ev.pitch);
    if (playing) {
      setPlayIndex(slotAt(slots, e.start)!.index); // Play: plays it and selects its slot; nothing is edited
      return;
    }
    setCaret(e.start);
  };

  /** Clicking a stave: snap inside the melody, the latch-length beat past its end (item 7). */
  const onTimeClick = (t: number) => {
    setSelection(null);
    if (playing) {
      arrive(slotAt(slots, t)!.index);
      return;
    }
    const { p, slots: s } = formNow();
    setCaret(caretFromClick(p.melody, s, t, length));
  };

  /** Time signature: bars resize and the melody is re-fitted; the caret keeps its time, snapped to an event start. */
  const onTimeSignature = (text: string) => {
    const next = setTimeSignature(current.current, text);
    if (next === current.current) return;
    update(() => next);
    const s = slotsOf(next.bars, layoutMeter(next.timeSignature));
    setCaret(snapToEvent(next.melody, Math.min(caretAt, formEnd(s))));
  };

  /** Clear all (SPEC §6.2 item 10): one undo step, no confirm, caret to the start. */
  const onClearAll = () => {
    update(clearMelody);
    setCaret(0);
  };

  const readoutScale =
    writtenHarmony.kind !== 'chord' ? '—' : writtenHarmony.scale ? scaleLabel(writtenHarmony.root, writtenHarmony.scale) : 'no scale fits';

  /** Instrument switch: one undo step; the device remembers it for new progressions (SPEC §10). */
  const onInstrument = (id: string) => {
    update((p) => setInstrument(p, id));
    writeDevice(localStorage, { lastInstrument: current.current.instrument });
  };

  /** Apply a bar edit: one undo step; the caret moves with the music; refusals show a notice. */
  const applyBarEdit = (e: BarEdit) => {
    if (!e.ok) {
      say(e.message);
      return false;
    }
    update(() => e.progression);
    setCaret(e.caret);
    return true;
  };

  /** The run a bar action applies to: the selection if it holds the bar, else that bar. */
  const runFor = (bar: number) =>
    selection && bar >= selection.from && bar <= selection.to ? { from: selection.from, to: selection.to } : { from: bar, to: bar };

  const onBarAction = (bar: number, action: BarAction) => {
    const p = current.current;
    const { from, to } = runFor(bar);
    switch (action) {
      case 'insert-before':
        applyBarEdit(insertBars(p, bar, caretAt));
        setSelection(null);
        return;
      case 'insert-after':
        applyBarEdit(insertBars(p, bar + 1, caretAt));
        setSelection(null);
        return;
      case 'duplicate':
        if (applyBarEdit(duplicateBars(p, from, to, caretAt))) {
          const n = to - from + 1;
          setSelection({ anchor: to + 1, from: to + 1, to: to + n }); // the copy
        }
        return;
      case 'copy': {
        setClip(copyBars(p, from, to));
        const n = to - from + 1;
        say(n === 1 ? `Copied bar ${from + 1}` : `Copied bars ${from + 1}–${to + 1}`);
        return;
      }
      case 'paste':
        if (clip) applyBarEdit(pasteBars(p, from, clip, caretAt));
        return;
      case 'split':
        applyBarEdit(splitBar(p, bar, caretAt));
        return;
      case 'merge':
        applyBarEdit(mergeBar(p, bar, caretAt));
        return;
      case 'delete':
        if (applyBarEdit(deleteBars(p, from, to, caretAt))) setSelection(null);
        return;
    }
  };

  /** Click a bar number: select it; ⇧ extends the selection to a run. */
  const onBarSelect = (bar: number, extend: boolean) => {
    setSelection((sel) =>
      extend && sel
        ? { anchor: sel.anchor, from: Math.min(sel.anchor, bar), to: Math.max(sel.anchor, bar) }
        : sel && !extend && sel.from === bar && sel.to === bar
          ? null // clicking the only selected bar again deselects it
          : { anchor: bar, from: bar, to: bar },
    );
  };

  const harmonyRef = useRef(activeHarmony);
  harmonyRef.current = activeHarmony;

  /** Play: reach a slot; *On arrival* sounds its chord or root (silent where there is no chord). */
  const arrive = (index: number) => {
    setPlayIndex(index);
    const sl = slots[index];
    const h = slotHarmony(progression.bars[sl.bar][sl.part]);
    if (onArrival === 'chord') playChord(h);
    else if (onArrival === 'root') playRoot(h);
  };

  /** P / the switch: entering Play starts on the caret's slot; leaving puts the caret at the current slot's start. */
  const setMode = (next: 'write' | 'play') => {
    if ((next === 'play') === playing) return;
    if (next === 'play') {
      setSelection(null);
      setPlayIndex(slotAt(slots, caretAt)!.index);
    } else {
      setCaret(active.start);
      setPlayIndex(null);
    }
  };

  /** Clicking a slot's chrome (not its stave) moves the caret to its start, unless it is already there. */
  const onSlotClick = (slot: FormSlot) => {
    setSelection(null);
    if (playing) {
      arrive(slot.index);
      return;
    }
    if (caretAt >= slot.start && caretAt < slot.end) return;
    setCaret(slot.start);
  };

  /** Write-mode keys (SPEC §11); all ignored while a text field has focus. */
  const onKey = (e: KeyboardEvent) => {
    const el = e.target;
    if (el instanceof Element && el.closest('input, textarea, select, [contenteditable]')) return; // native undo there
    const handled = () => e.preventDefault(); // no page scroll, no button activation, no browser back
    const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
    if (plain && e.key === '\\') {
      handled();
      setStand((on) => !on);
      return;
    }
    if (stand) {
      // Stand keys (SPEC §11): only M (and \ above). Nothing is editable.
      if (plain && (e.key === 'm' || e.key === 'M')) {
        handled();
        toggleMute();
      } else if (plain && (e.key === ' ' || e.key.startsWith('Arrow') || e.key === 'Backspace')) handled();
      return;
    }
    if (plain && !e.shiftKey && (e.key === 'p' || e.key === 'P')) {
      handled();
      setMode(playing ? 'write' : 'play');
      return;
    }
    if (playing) {
      // Play keys (SPEC §11): ← / → step slots (wrapping), Space / ⇧Space, M. Everything else does nothing.
      if (!plain) return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        handled();
        arrive(stepSlot(active.index, e.key === 'ArrowLeft' ? -1 : 1, slots.length));
      } else if (e.key === ' ') {
        handled();
        if (e.repeat) return;
        if (e.shiftKey) playScale(harmonyRef.current);
        else playChord(harmonyRef.current);
      } else if (e.key === 'm' || e.key === 'M') {
        handled();
        toggleMute();
      } else if (e.key.startsWith('Arrow') || e.key === 'Backspace' || e.key === 'Delete') handled();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'z' || e.key === 'Z')) {
      handled();
      step(e.shiftKey ? 'redo' : 'undo');
      return;
    }
    // With a bar selection: ⌘C / ⌘V / ⌘D, ⌫ / Del deletes the bar(s), Esc clears it (SPEC §11).
    if (selection) {
      const cmd = (e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey;
      const k = e.key.toLowerCase();
      if (cmd && (k === 'c' || k === 'v' || k === 'd')) {
        handled();
        onBarAction(selection.from, k === 'c' ? 'copy' : k === 'v' ? 'paste' : 'duplicate');
        return;
      }
      if (!e.metaKey && !e.ctrlKey && (e.key === 'Backspace' || e.key === 'Delete')) {
        handled();
        onBarAction(selection.from, 'delete');
        return;
      }
      if (e.key === 'Escape') {
        handled();
        setSelection(null);
        return;
      }
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key) {
      case ' ':
        handled();
        if (e.repeat) return;
        if (e.shiftKey) playScale(harmonyRef.current);
        else playChord(harmonyRef.current);
        return;
      case 'ArrowLeft':
      case 'ArrowRight': {
        handled();
        const { p, slots: s } = formNow();
        setCaret(stepCaret(p.melody, s, caretAt, e.key === 'ArrowLeft' ? -1 : 1, length));
        return;
      }
      case 'ArrowUp':
      case 'ArrowDown':
        handled();
        onNudge(e.key === 'ArrowUp' ? 1 : -1, e.shiftKey);
        return;
      case 'Delete':
      case 'Backspace':
        handled();
        onDelete(e.key === 'Backspace');
        return;
    }
    if (e.shiftKey) return;
    if (e.key === 'm' || e.key === 'M') {
      handled();
      toggleMute();
      return;
    }
    if (e.key === 'r' || e.key === 'R') {
      handled();
      setRest((on) => !on);
      return;
    }
    const d = (['w', 'h', 'q', 'e', 's'] as const)[Number(e.key) - 1];
    if (d && e.key.length === 1) {
      handled();
      onLength(d);
    }
  };
  const keyRef = useRef(onKey);
  keyRef.current = onKey;
  useEffect(() => {
    const listener = (e: KeyboardEvent) => keyRef.current(e);
    window.addEventListener('keydown', listener);
    return () => window.removeEventListener('keydown', listener);
  }, []);

  const haloPitch = halo && halo.caret === caretAt && halo.melody === progression.melody ? halo.pitch : null;

  if (stand) {
    return (
      <div className="stand-layout">
        <header className="stand-header">
          <span className="stand-title">{progression.title}</span>
          <span className="stand-instrument">{inst.name}</span>
          <span className="stand-spacer" />
          <button
            type="button"
            className={muted ? 'rail-button mute on' : 'rail-button mute'}
            aria-pressed={muted}
            title="Mute (M)"
            onClick={toggleMute}
          >
            {muted ? '🔇 Muted' : '🔊 Sound'}
          </button>
          <button type="button" className="rail-button" title="Back to editing (\)" onClick={() => setStand(false)}>
            ✎ Edit
          </button>
        </header>
        <section className="chart-area stand-chart">
          <Chart
            progression={progression}
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
      <nav className="rail" aria-label="Controls">
        <button
          type="button"
          className="rail-link"
          onClick={onLibrary} // every edit is already saved
        >
          ← Library
        </button>
        <h1 className="rail-heading">
          <TitleField title={progression.title} editing={renameOnOpen} onRename={(t) => update((p) => setTitle(p, t))} />
        </h1>
        <button type="button" className="rail-button stand-button" title="Stand: read-only page view (\)" onClick={() => setStand(true)}>
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
              onClick={() => setMode(m)}
            >
              {m === 'write' ? 'Write' : 'Play'}
            </button>
          ))}
        </div>
        <InstrumentPicker
          instrument={inst.id}
          concertClef={progression.concertClef === 'bass' ? 'bass' : 'treble'}
          onInstrument={onInstrument}
          onConcertClef={(clef) => update((p) => setConcertClef(p, clef))}
        />
        <TimeSignatureField value={progression.timeSignature} onChange={onTimeSignature} />
        <BarsPerRow value={progression.barsPerRow} onChange={(n) => update((p) => setBarsPerRow(p, n))} />
        <AudioControls
          muted={muted}
          onToggleMute={toggleMute}
          onChord={() => playChord(activeHarmony)}
          onScale={() => playScale(activeHarmony)}
        />
        {playing ? (
          <label className="rail-setting on-arrival">
            <span className="rail-label">On arrival</span>
            <select className="rail-select" value={onArrival} onChange={(e) => setOnArrival(e.target.value as OnArrival)}>
              <option value="silent">Silent</option>
              <option value="chord">Chord</option>
              <option value="root">Root note</option>
            </select>
          </label>
        ) : (
          <>
        <LengthLatch
          value={length}
          onChange={onLength}
          rest={rest}
          onToggleRest={() => setRest((on) => !on)}
          refusal={refusal}
          onRefusalShown={clearRefusal}
        />
        <div className="undo-controls">
          <button
            type="button"
            className="rail-button"
            title="Undo (⌘Z)"
            disabled={!historyView.past.length}
            onClick={() => step('undo')}
          >
            ↶ Undo
          </button>
          <button
            type="button"
            className="rail-button"
            title="Redo (⇧⌘Z)"
            disabled={!historyView.future.length}
            onClick={() => step('redo')}
          >
            ↷ Redo
          </button>
        </div>
        <ClearAll disabled={!progression.melody.length} onClear={onClearAll} />
          </>
        )}
        <CaretReadout bar={active.bar + 1} chord={activeWrittenChord} scale={readoutScale} />
      </nav>
      <main className="main">
        <section className="chart-area">
          <Chart
            progression={progression}
            caret={caretAt}
            onSlotClick={onSlotClick}
            onEventClick={onEventClick}
            onTimeClick={onTimeClick}
            onChordCommit={onChordCommit}
            onScaleChange={onScaleChange}
            editRequest={editRequest}
            selection={selection}
            onBarSelect={onBarSelect}
            onBarAction={onBarAction}
            onAppendBar={() => applyBarEdit(appendBar(current.current, caretAt))}
            canPaste={!!clip}
            playIndex={playing ? active.index : null}
          />
        </section>
        {notice && (
          <p key={notice.n} className="notice" role="status">
            {notice.text}
          </p>
        )}
        <section className="dock" aria-label="Docked hex">
          <DockedHex
            dock={dock}
            onLabelClick={() => setEditRequest((r) => ({ bar: active.bar, part: active.part, n: (r?.n ?? 0) + 1 }))}
            onPick={onPick}
            halo={haloPitch === null ? null : toWritten(haloPitch, inst)}
          />
        </section>
      </main>
    </div>
  );
}
