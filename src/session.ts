// Pure `session` module: the **editing session** of the chart screen (SPEC §3.0–3.8, §6.2, §9, §11).
// One function, `reduce(state, progression, intent)`, holds every mode's rules — Tune, Improvise, Write etude,
// Read etude: the caret and latches, entry with wrap-around, switching modes, the current slot and the transport's
// start / stop, stepwise playback, browsing slots, *On arrival*, the bar selection (= the looped bars) and clipboard,
// Clear notes / Clear all. The transport's timing is `metronomeRun.ts`.
// It returns the next state, an edit to commit (the caller records undo and saves), and effects to perform
// (sounds, device settings, undo / redo). Nothing here touches React, storage or Web Audio.

import {
  appendBar,
  copyBars,
  deleteBars,
  duplicateBars,
  insertBars,
  mergeBar,
  pasteBars,
  splitBar,
  type BarAction,
  type BarClip,
  type BarEdit,
} from './bars';
import { stepSlot } from './form';
import { stepPitchClasses, type SlotHarmony } from './harmony';
import { backspaceAt, caretFromClick, deleteAt, insertWrapping, melodyEnd, nudge, snapToEvent, stepCaret, timeline, type TimedEvent } from './melody';
import type { OnArrival } from './device';
import { enterChord } from './chordEntry';
import type { ScaleId } from './harmony';
import { modeProfile } from './modeProfile';
import {
  clearEverything,
  clearMelody,
  etudeOf,
  freshEtudeId,
  newEtude,
  setBarsPerRow,
  setChord,
  setConcertClef,
  setInstrument,
  setMelody,
  setScaleOverride,
  withEtude,
  setTimeSignature,
  setTitle,
  type ChordCommit,
  type Duration,
  type Etude,
  type MelodyEvent,
  type Progression,
} from './progression';
import { instrumentView, type ViewSlot } from './view';

export interface Selection {
  anchor: number;
  from: number;
  to: number;
}

/** The four modes, in the Mode dropdown's order (SPEC §3.0). */
export type Mode = 'tune' | 'improvise' | 'write' | 'read';
export const MODES: readonly Mode[] = ['tune', 'improvise', 'write', 'read'];
export const MODE_LABELS: Record<Mode, string> = { tune: 'Tune', improvise: 'Improvise', write: 'Write etude', read: 'Read etude' };
// What each mode shows and lets through: `modeProfile.ts`.

export interface SessionState {
  /** The mode (SPEC §3.0). Every open starts in Tune. */
  mode: Mode;
  /** The open etude's id: the melody Write etude and Read etude work on, and the instrument every mode follows. */
  etude: string;
  /** A time position in the form (SPEC §6.2); clamped to the form end when read (`caretOf`). Write etude's. */
  caret: number;
  /** Length latch and Rest latch (SPEC §6.2 item 6). */
  length: Duration;
  rest: boolean;
  /**
   * The current slot outside Write etude (Improvise's and Read etude's playhead; kept unseen in Tune). Write etude
   * uses the caret's slot instead; switching modes carries one to the other (SPEC §3.0).
   */
  slot: number;
  /** The transport is running (Improvise, Read etude; SPEC §3.7). Switching modes stops it. */
  running: boolean;
  /** Improvise, stopped: the slot whose *On arrival* sound waits for its first played note (null = nothing waiting). */
  arrival: number | null;
  /**
   * The bar selection (SPEC §4.1) — in Improvise and Read etude the same selection is the **looped bars** (§3.7).
   */
  selection: Selection | null;
  clip: BarClip | null;
  /** Last nudge: its pitch gets a halo while caret and melody stay as the nudge left them. */
  halo: { pitch: number; caret: number; melody: MelodyEvent[] } | null;
  /** A refused insert: that length's button flashes with the message. `n` changes on every refusal. */
  refusal: { d: Duration; message: string; n: number } | null;
  /** A short notice (bar-edit refusals, "Copied bar 2"). */
  notice: { text: string; n: number } | null;
  /** Device settings (SPEC §9, §12.5). */
  muted: boolean;
  onArrival: OnArrival;
}

export type Intent =
  /** Hex cell (or its ♯ / ♭) clicked or picked with Space / A — written pitch. Write etude: insert; else audition. */
  | { type: 'pick'; written: number }
  /** Improvise: the mic heard a note start (it lights the hex; stopped, it brings a waiting *On arrival* sound). */
  | { type: 'heard' }
  | { type: 'length'; d: Duration }
  | { type: 'toggle-rest' }
  | { type: 'delete'; back: boolean }
  /** ↑ / ↓: by a semitone; ⇧: an octave; ⌥ (`scale`): one step of the owning slot's scale. */
  | { type: 'nudge'; dir: -1 | 1; octave: boolean; scale?: boolean }
  /** ← / → : Write etude moves the caret by event; Improvise / Read etude (stopped) step slots. */
  | { type: 'step'; dir: -1 | 1 }
  /** ` (or ~), Write etude: stepwise playback — play the event at the caret and move past it, wrapping at the end. */
  | {
      type: 'step-play';
      /** -1: step back — to the event before the caret, and play it. Default forward. */ dir?: -1 | 1;
    }
  /** < > (or , .): previous / next slot, wrapping. */
  | { type: 'browse'; dir: -1 | 1 }
  | { type: 'event-click'; event: TimedEvent }
  | { type: 'time-click'; t: number }
  | { type: 'slot-click'; index: number }
  /** The Mode dropdown, `[` / `]` (previous / next, no wrap) and `\` (Write etude ↔ Read etude). */
  | { type: 'mode'; mode: Mode | 'prev' | 'next' | 'toggle-read' }
  /** The transport's start / stop (SPEC §3.7). */
  | { type: 'transport'; run: boolean }
  /** The running transport reached a chord: *Audio on chord* sounds with it. */
  | { type: 'transport-chord'; index: number }
  /** The transport finished the form (or the looped bars) without Loop: stopped, back on their first chord. */
  | { type: 'transport-end' }
  /** Rewind: stopped, to the first chord (of the looped bars); running, the caller restarts the transport there. */
  | { type: 'rewind' }
  | { type: 'sound'; what: 'chord' | 'bass' | 'scale' }
  | { type: 'toggle-mute' }
  | { type: 'set-arrival'; how: OnArrival }
  | { type: 'bar-select'; bar: number; extend: boolean }
  | { type: 'bar-action'; bar: number; action: BarAction }
  | { type: 'append-bar' }
  /** Esc, or the looped bars' ×: no selection (the whole form). */
  | { type: 'clear-selection' }
  /** Clear ▾ (SPEC §6.2 item 10): the notes only; or everything — chords, scales and notes (confirmed in the menu). */
  | { type: 'clear-notes' }
  | { type: 'clear-all' }
  | { type: 'time-signature'; text: string }
  /** Bars per row (Write etude's editing pill, Improvise's form group). */
  | { type: 'bars-per-row'; n: number }
  /** Chord entry (SPEC §4.2): typed text for a slot; the outcome's `entry` says whether it was taken. */
  | { type: 'chord-entry'; bar: number; part: number; text: string }
  /** The × after a chord. */
  | { type: 'chord-clear'; bar: number; part: number }
  /** A slot's scale override, or null to clear it. */
  | { type: 'scale-override'; bar: number; part: number; scale: ScaleId | null }
  /** The header, in every mode: the title, the instrument (remembered on the device for new progressions), the clef. */
  | { type: 'title'; text: string }
  | { type: 'instrument'; id: string }
  | { type: 'clef'; clef: 'treble' | 'bass' }
  | { type: 'undo' }
  | { type: 'redo' }
  /** The etude picker (SPEC §3.1), in every mode: open one, add an empty one, duplicate, rename, delete the open one. */
  | { type: 'etude-open'; id: string }
  | { type: 'etude-new' }
  | { type: 'etude-duplicate' }
  | { type: 'etude-rename'; text: string }
  | { type: 'etude-delete' }
  /**
   * After undo / redo (with the restored caret, and the etude open when that snapshot was taken) or another tab's
   * write (neither: the open etude stays, unless it is gone).
   */
  | { type: 'restored'; caret?: number; etude?: string }
  | { type: 'refusal-shown' }
  | { type: 'notice-done' };

export type Effect =
  | { type: 'note'; midi: number }
  | { type: 'chord' | 'root' | 'bass' | 'scale'; harmony: SlotHarmony }
  | { type: 'device'; patch: { muted?: boolean; playArrival?: OnArrival; lastInstrument?: string } }
  | { type: 'history'; dir: 'undo' | 'redo' }
  /** Write etude: a stepped (`) or clicked melody note lights its hex cells as if played (concert pitch). */
  | { type: 'light'; midi: number }
  /** The transport starts afresh from the current slot (start, or a rewind while it runs). */
  | { type: 'transport-restart' };

export interface Outcome {
  state: SessionState;
  /** An edit to commit as one undo step (with the caret before it), or undefined. */
  edit?: Progression;
  effects: Effect[];
  /** `chord-entry` only: the entry's result (refused when the mode doesn't edit chords). */
  entry?: ChordCommit;
}

export function initialSession(p: Progression, device: { muted?: boolean; onArrival: OnArrival }, etude?: string | null): SessionState {
  const open = etudeOf(p, etude).id;
  const caret = melodyEnd(etudeOf(p, open).melody); // opens at the melody's end; not saved
  return {
    mode: 'tune', // every open and reload starts in Tune (SPEC §3.0)
    etude: open,
    caret,
    length: 'q',
    rest: false,
    slot: instrumentView(p, open).slotAt(caret).index,
    running: false,
    arrival: null,
    selection: null,
    clip: null,
    halo: null,
    refusal: null,
    notice: null,
    muted: device.muted === true,
    onArrival: device.onArrival,
  };
}

/** The caret clamped to the form (the form can shrink under it). */
export function caretOf(s: SessionState, p: Progression): number {
  return Math.min(s.caret, instrumentView(p, s.etude).end);
}

/** The active slot: Write etude's caret slot, else the current slot. */
export function activeIndex(s: SessionState, p: Progression): number {
  const v = instrumentView(p, s.etude);
  return s.mode === 'write' ? v.slotAt(caretOf(s, p)).index : Math.min(s.slot, v.slots.length - 1);
}

/** The first slot of the looped bars (the selection), or of the form. */
export function loopStart(s: Pick<SessionState, 'selection'>, slots: readonly { bar: number; index: number }[]): number {
  const sel = s.selection;
  return sel ? (slots.find((x) => x.bar === sel.from)?.index ?? 0) : 0;
}

/** *Etude N* for the lowest N no etude is named. */
export function nextEtudeName(etudes: readonly { name: string }[]): string {
  const taken = new Set(etudes.map((e) => e.name));
  for (let k = 1; ; k++) if (!taken.has(`Etude ${k}`)) return `Etude ${k}`;
}

/** *On arrival*: the sounds for a slot's concert harmony. */
export function arrivalSounds(how: OnArrival, h: SlotHarmony): Effect[] {
  const out: Effect[] = [];
  if (how === 'chord' || how === 'bass-chord') out.push({ type: 'chord', harmony: h });
  if (how === 'root') out.push({ type: 'root', harmony: h });
  if (how === 'bass' || how === 'bass-chord') out.push({ type: 'bass', harmony: h });
  return out;
}

/** Every pitch class: nudge steps by semitone in a slot without a chord. */
const CHROMATIC = new Set([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);

/** Intents every mode lets through: the modes themselves, mute, the header's title / instrument / clef, bookkeeping. */
const ANY_MODE: Intent['type'][] = [
  'mode',
  'toggle-mute',
  'title',
  'instrument',
  'clef',
  'etude-open',
  'etude-new',
  'etude-duplicate',
  'etude-rename',
  'etude-delete',
  'restored',
  'refusal-shown',
  'notice-done',
];
/** The melody (Write etude). */
const MELODY_EDITS: Intent['type'][] = ['length', 'toggle-rest', 'delete', 'nudge', 'step-play', 'clear-notes', 'clear-all'];
/** The form and its tonality (Write etude; Improvise while stopped). */
const FORM_EDITS: Intent['type'][] = ['time-signature', 'bars-per-row', 'undo', 'redo', 'append-bar', 'bar-action', 'chord-entry', 'chord-clear', 'scale-override'];
const TRANSPORT: Intent['type'][] = ['transport', 'transport-chord', 'transport-end', 'rewind'];
/** Moves of the caret (Write etude) or of the current slot by hand (Improvise, Read etude: only while stopped). */
const SLOT_MOVES: Intent['type'][] = ['step', 'browse', 'event-click', 'time-click', 'slot-click'];

/** What the mode lets through (SPEC §3.2–3.4, §3.8), by its profile. */
function allowed(s: SessionState, intent: Intent): boolean {
  const t = intent.type;
  const m = modeProfile(s.mode, s.running);
  if (ANY_MODE.includes(t)) return true;
  if (MELODY_EDITS.includes(t)) return m.editsMelody;
  if (FORM_EDITS.includes(t)) return m.editsForm;
  if (TRANSPORT.includes(t)) return m.transport;
  if (t === 'pick') return m.hex;
  if (t === 'heard') return m.listens;
  if (m.chartEmpty) return false; // Tune: no chord to sound, no chart to click
  if (SLOT_MOVES.includes(t)) return m.editsMelody || m.movesByHand;
  if (t === 'bar-select' || t === 'clear-selection') return !m.chartInert;
  return true;
}

export function reduce(state: SessionState, p: Progression, intent: Intent): Outcome {
  const view = instrumentView(p, state.etude);
  /** The open etude's melody; edits write it back with `melodyEdit`. */
  const melody = etudeOf(p, state.etude).melody;
  const { slots } = view;
  const caret = Math.min(state.caret, view.end);
  const writing = state.mode === 'write';
  const current = Math.min(state.slot, slots.length - 1);
  const active: ViewSlot = writing ? view.slotAt(caret) : slots[current];

  let s: SessionState = state;
  let edit: Progression | undefined;
  const effects: Effect[] = [];
  const set = (patch: Partial<SessionState>) => (s = { ...s, ...patch });
  const done = (): Outcome => ({ state: s, edit, effects });
  const melodyEdit = (next: MelodyEvent[]) => (edit = setMelody(p, s.etude, next));

  /**
   * Improvise / Read etude: reach a slot by hand. In Improvise its *On arrival* sound waits for the first note played
   * there; Read etude's arrival is silent (nothing is played there).
   */
  const arrive = (index: number) => set({ slot: index, arrival: s.mode === 'improvise' ? index : null });
  /** Improvise: a note was played in the current slot; the first one after arriving brings the arrival sound. */
  const playedIn = (index: number) => {
    if (s.arrival !== index) return;
    set({ arrival: null });
    effects.push(...arrivalSounds(s.onArrival, slots[index].concert));
  };
  const say = (text: string) => set({ notice: { text, n: (s.notice?.n ?? 0) + 1 } });
  /** Open an etude of `q`: the caret to its melody's end (within the form); the latches stay. */
  const openEtude = (q: Progression, id: string) =>
    set({ etude: id, caret: Math.min(melodyEnd(etudeOf(q, id).melody), view.end), halo: null, refusal: null });

  /** Write etude: insert a note (or rest) at the caret; past the end, writing continues from the start (SPEC §6.2). */
  const insert = (d: Duration, pitch: number | null) => {
    const r = insertWrapping(melody, slots, caret, d, pitch);
    if (!r.ok) {
      set({ refusal: { d, message: r.message, n: (s.refusal?.n ?? 0) + 1 } });
      return;
    }
    // *On arrival* in Write etude: the first entry of a slot (written at its start) sounds with it.
    const at = caret >= view.end ? 0 : caret;
    const slot = view.slotAt(at);
    if (slot.start === at) effects.push(...arrivalSounds(s.onArrival, slot.concert));
    melodyEdit(r.melody);
    set({ refusal: null, caret: r.caret });
  };

  /** A bar edit: one undo step; the caret moves with the music; a refusal shows a notice. */
  const barEdit = (e: BarEdit): boolean => {
    if (!e.ok) {
      say(e.message);
      return false;
    }
    edit = e.progression;
    set({ caret: e.caret });
    if (!writing) set({ slot: Math.min(s.slot, instrumentView(e.progression, s.etude).slots.length - 1), arrival: null });
    return true;
  };

  if (!allowed(s, intent)) return done();

  switch (intent.type) {
    case 'pick': {
      const midi = view.toConcert(intent.written);
      effects.push({ type: 'note', midi }); // audition, even when the insert is refused
      if (writing) {
        set({ rest: false });
        insert(s.length, midi);
      } else if (s.mode === 'improvise' && !s.running) playedIn(current); // audition only, never recorded
      return done();
    }
    case 'heard':
      if (s.mode === 'improvise' && !s.running) playedIn(current);
      return done();
    case 'step-play': {
      // Write etude (SPEC §6.2): note by note through the melody from the caret. A note sounds (with its slot's
      // *On arrival* when it starts the slot); a rest passes silently; after the last event the next press starts at bar 1.
      const events = timeline(melody).filter((e) => e.start < view.end);
      if (events.length === 0) return done();
      // Back: the event before the caret (before the first: the last), played, with the caret moved to its start.
      const back = intent.dir === -1;
      const e = back
        ? ([...events].reverse().find((x) => x.start < caret) ?? events[events.length - 1])
        : (events.find((x) => caret >= x.start && caret < x.end) ?? events[0]);
      if ('pitch' in e.ev) effects.push({ type: 'note', midi: e.ev.pitch }, { type: 'light', midi: e.ev.pitch });
      const slot = view.slotAt(e.start);
      if (slot.start === e.start) effects.push(...arrivalSounds(s.onArrival, slot.concert));
      set({ caret: back ? e.start : e.end, refusal: null });
      return done();
    }
    case 'length':
      set({ length: intent.d });
      if (s.rest) insert(intent.d, null); // Rest on: a length also inserts a rest (silent)
      return done();
    case 'toggle-rest':
      set({ rest: !s.rest });
      return done();
    case 'delete': {
      const r = (intent.back ? backspaceAt : deleteAt)(melody, caret);
      if (r.melody !== melody) melodyEdit(r.melody);
      set({ caret: r.caret });
      return done();
    }
    case 'nudge': {
      // `scale`: a step of the owning slot's scale (↑ / ↓; no chord there: semitones anyway); else a semitone (⇧).
      const r = nudge(melody, slots, caret, intent.dir, intent.octave, (slot) => (intent.scale ? (stepPitchClasses(slots[slot.index].concert) ?? CHROMATIC) : CHROMATIC));
      if (!r.ok) return done();
      melodyEdit(r.melody);
      effects.push({ type: 'note', midi: r.pitch });
      set({ halo: { pitch: r.pitch, caret, melody: r.melody } });
      return done();
    }
    case 'step':
      if (writing) set({ caret: stepCaret(melody, slots, caret, intent.dir, s.length) });
      else arrive(stepSlot(active.index, intent.dir, slots.length));
      return done();
    case 'browse': {
      const next = stepSlot(active.index, intent.dir, slots.length);
      if (writing) set({ selection: null, caret: slots[next].start });
      else arrive(next);
      return done();
    }
    case 'event-click': {
      const e = intent.event;
      if ('pitch' in e.ev) effects.push({ type: 'note', midi: e.ev.pitch });
      if (writing && 'pitch' in e.ev) effects.push({ type: 'light', midi: e.ev.pitch });
      if (writing) set({ selection: null, caret: e.start });
      else {
        // Read etude: the note auditions and its slot becomes current (silently); nothing is edited.
        const index = view.slotAt(e.start).index;
        if (index !== active.index) arrive(index);
        if ('pitch' in e.ev) playedIn(index);
      }
      return done();
    }
    case 'time-click':
      if (writing) set({ selection: null, caret: caretFromClick(melody, slots, intent.t, s.length) });
      else arrive(view.slotAt(intent.t).index);
      return done();
    case 'slot-click': {
      const slot = slots[intent.index];
      if (writing) {
        set({ selection: null });
        if (!(caret >= slot.start && caret < slot.end)) set({ caret: slot.start });
      } else if (slot.index !== active.index) arrive(slot.index);
      return done();
    }
    case 'mode': {
      const i = MODES.indexOf(s.mode);
      const to: Mode =
        intent.mode === 'prev'
          ? MODES[Math.max(0, i - 1)]
          : intent.mode === 'next'
            ? MODES[Math.min(MODES.length - 1, i + 1)]
            : intent.mode === 'toggle-read'
              ? s.mode === 'read'
                ? 'write'
                : 'read'
              : intent.mode;
      if (to === s.mode) return done();
      // Switching stops the transport and carries the current slot (SPEC §3.0).
      let slot = writing ? active.index : current;
      if (to === 'write') {
        if (view.slotAt(caret).index !== slot) set({ caret: slots[slot].start }); // the caret to the current slot's start
      } else if (modeProfile(to).transport && s.selection) {
        // Looped bars that don't hold the current slot: start on their first bar.
        const { from, to: last } = s.selection;
        if (slots[slot].bar < from || slots[slot].bar > last) slot = loopStart(s, slots);
      }
      set({ mode: to, slot, running: false, halo: null, refusal: null, arrival: to === 'improvise' ? slot : null });
      return done();
    }
    case 'transport':
      if (intent.run === s.running) return done();
      if (intent.run) {
        // Start from the current slot — or, outside the looped bars, from their first.
        const sel = s.selection;
        const slot = sel && (active.bar < sel.from || active.bar > sel.to) ? loopStart(s, slots) : current;
        set({ running: true, slot, arrival: null });
        effects.push({ type: 'transport-restart' });
      } else set({ running: false, arrival: s.mode === 'improvise' ? current : null });
      return done();
    case 'transport-chord':
      if (!s.running) return done();
      set({ slot: Math.min(intent.index, slots.length - 1), arrival: null });
      effects.push(...arrivalSounds(s.onArrival, slots[s.slot].concert));
      return done();
    case 'transport-end':
      set({ running: false });
      arrive(loopStart(s, slots));
      return done();
    case 'rewind':
      if (s.running) {
        set({ slot: loopStart(s, slots) });
        effects.push({ type: 'transport-restart' });
      } else arrive(loopStart(s, slots));
      return done();
    case 'sound':
      effects.push({
        type: intent.what === 'bass' ? 'root' : intent.what,
        harmony: active.concert,
      });
      return done();
    case 'toggle-mute':
      set({ muted: !s.muted });
      effects.push({ type: 'device', patch: { muted: s.muted } });
      return done();
    case 'set-arrival':
      set({ onArrival: intent.how });
      effects.push({ type: 'device', patch: { playArrival: intent.how } });
      return done();
    case 'bar-select': {
      const bar = intent.bar;
      const sel = s.selection;
      const next: Selection | null = intent.extend
        ? // ⇧: a run from the selection's anchor — or, with nothing selected, from the active slot's bar
          (({ anchor }) => ({
            anchor,
            from: Math.min(anchor, bar),
            to: Math.max(anchor, bar),
          }))(sel ?? { anchor: active.bar })
        : sel && bar >= sel.from && bar <= sel.to
          ? null // a selected (looped) bar again: deselect — the whole form
          : { anchor: bar, from: bar, to: bar };
      set({ selection: next });
      // Improvise / Read etude: picking looped bars away from the current slot moves to the first picked bar.
      if (!writing && next && (active.bar < next.from || active.bar > next.to)) {
        const first = loopStart(s, slots);
        if (s.running) set({ slot: first });
        else arrive(first);
      }
      return done();
    }
    case 'bar-action': {
      const { bar, action } = intent;
      const sel = s.selection;
      // The run an action applies to: the selection if it holds the bar, else that bar.
      const { from, to } = sel && bar >= sel.from && bar <= sel.to ? sel : { from: bar, to: bar };
      switch (action) {
        case 'insert-before':
          barEdit(insertBars(p, bar, caret));
          set({ selection: null });
          break;
        case 'insert-after':
          barEdit(insertBars(p, bar + 1, caret));
          set({ selection: null });
          break;
        case 'duplicate':
          if (barEdit(duplicateBars(p, from, to, caret))) {
            const n = to - from + 1;
            set({ selection: { anchor: to + 1, from: to + 1, to: to + n } }); // the copy
          }
          break;
        case 'copy': {
          set({ clip: copyBars(p, from, to, s.etude) });
          say(from === to ? `Copied bar ${from + 1}` : `Copied bars ${from + 1}–${to + 1}`);
          break;
        }
        case 'paste':
          if (s.clip) barEdit(pasteBars(p, from, s.clip, caret, s.etude));
          break;
        case 'split':
          barEdit(splitBar(p, bar, caret));
          break;
        case 'merge':
          barEdit(mergeBar(p, bar, caret));
          break;
        case 'delete':
          if (barEdit(deleteBars(p, from, to, caret))) set({ selection: null });
          break;
      }
      return done();
    }
    case 'append-bar':
      barEdit(appendBar(p, caret));
      return done();
    case 'clear-selection':
      set({ selection: null });
      return done();
    case 'clear-notes':
      edit = clearMelody(p, s.etude); // one undo step, no confirm (SPEC §6.2 item 10)
      set({ caret: 0 });
      return done();
    case 'clear-all':
      edit = clearEverything(p, s.etude); // one undo step; the menu asks first
      set({ caret: 0, selection: null });
      return done();
    case 'time-signature': {
      const next = setTimeSignature(p, intent.text);
      if (next === p) return done();
      edit = next; // bars resize, the melody is re-fitted; the caret keeps its time, snapped to an event start
      set({
        caret: snapToEvent(etudeOf(next, s.etude).melody, Math.min(caret, instrumentView(next, s.etude).end)),
      });
      return done();
    }
    case 'bars-per-row':
      edit = setBarsPerRow(p, intent.n);
      return done();
    case 'chord-entry': {
      const r = enterChord(p, view, intent.bar, intent.part, intent.text);
      if (r.ok) edit = r.progression;
      return { ...done(), entry: r };
    }
    case 'chord-clear':
      edit = setChord(p, intent.bar, intent.part, '');
      return done();
    case 'scale-override':
      edit = setScaleOverride(p, intent.bar, intent.part, intent.scale);
      return done();
    case 'title':
      edit = setTitle(p, intent.text);
      return done();
    case 'instrument':
      edit = setInstrument(p, s.etude, intent.id);
      effects.push({ type: 'device', patch: { lastInstrument: etudeOf(edit, s.etude).instrument } });
      return done();
    case 'clef':
      edit = setConcertClef(p, s.etude, intent.clef);
      return done();
    case 'undo':
    case 'redo':
      effects.push({ type: 'history', dir: intent.type });
      return done();
    case 'etude-open': {
      if (intent.id === s.etude || !p.etudes.some((e) => e.id === intent.id)) return done();
      openEtude(p, intent.id);
      return done();
    }
    case 'etude-new': {
      const open = etudeOf(p, s.etude);
      const e: Etude = { ...newEtude(open.instrument, nextEtudeName(p.etudes), freshEtudeId(p.etudes)), ...(open.concertClef ? { concertClef: open.concertClef } : {}) };
      edit = { ...p, etudes: [...p.etudes, e] };
      openEtude(edit, e.id);
      return done();
    }
    case 'etude-duplicate': {
      const open = etudeOf(p, s.etude);
      const copy: Etude = { ...open, id: freshEtudeId(p.etudes), name: `${open.name} (copy)` };
      const at = p.etudes.indexOf(open) + 1;
      edit = { ...p, etudes: [...p.etudes.slice(0, at), copy, ...p.etudes.slice(at)] };
      set({ etude: copy.id, halo: null, refusal: null }); // same notes: the caret stays
      return done();
    }
    case 'etude-rename': {
      const name = intent.text.trim();
      const open = etudeOf(p, s.etude);
      if (!name || name === open.name) return done();
      edit = withEtude(p, open.id, (e) => ({ ...e, name }));
      return done();
    }
    case 'etude-delete': {
      const open = etudeOf(p, s.etude);
      const i = p.etudes.indexOf(open);
      if (p.etudes.length === 1) {
        // The last one: a fresh, empty Etude 1 on the same instrument takes its place (a progression always has one).
        const fresh: Etude = { ...newEtude(open.instrument, 'Etude 1', freshEtudeId(p.etudes)), ...(open.concertClef ? { concertClef: open.concertClef } : {}) };
        edit = { ...p, etudes: [fresh] };
        openEtude(edit, fresh.id);
        return done();
      }
      edit = { ...p, etudes: p.etudes.filter((e) => e !== open) };
      openEtude(edit, edit.etudes[Math.min(i, edit.etudes.length - 1)].id); // its neighbour: the next, else the one before
      return done();
    }
    case 'restored': {
      // The restored etude (undo / redo), else the open one — unless it's gone (another tab deleted it): the first.
      const want = intent.etude ?? s.etude;
      const etude = p.etudes.some((e) => e.id === want) ? want : p.etudes[0].id;
      set({
        etude,
        selection: null,
        refusal: null,
        ...(intent.caret !== undefined ? { caret: intent.caret } : etude !== s.etude ? { caret: melodyEnd(etudeOf(p, etude).melody) } : {}),
      });
      if (!writing) set({ slot: Math.min(s.slot, view.slots.length - 1) });
      return done();
    }
    case 'refusal-shown':
      set({ refusal: null });
      return done();
    case 'notice-done':
      set({ notice: null });
      return done();
  }
}
