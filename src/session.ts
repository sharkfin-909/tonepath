// Pure `session` module: the **editing session** of the chart screen (SPEC §3.3, §6.2, §9, §11).
// One function, `reduce(state, progression, intent)`, holds every Write / Play rule: the caret and latches, entry
// with wrap-around, Write / Play / Stand, browsing slots, *On arrival*, the bar selection and clipboard.
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
import { backspaceAt, caretFromClick, deleteAt, insertWrapping, melodyEnd, nudge, snapToEvent, stepCaret, type TimedEvent } from './melody';
import type { OnArrival } from './device';
import { clearMelody, setTimeSignature, type Duration, type MelodyEvent, type Progression } from './progression';
import { instrumentView, type ViewSlot } from './view';

export interface Selection {
  anchor: number;
  from: number;
  to: number;
}

export interface SessionState {
  /** A time position in the form (SPEC §6.2); clamped to the form end when read (`caretOf`). */
  caret: number;
  /** Length latch and Rest latch (SPEC §6.2 item 6). */
  length: Duration;
  rest: boolean;
  /** Play mode's current slot; null in Write (SPEC §3.3). */
  playIndex: number | null;
  /** Stand mode (SPEC §3.4): a read-only page view over Write or Play. */
  stand: boolean;
  /** Play: the slot whose *On arrival* sound waits for its first played note (null = nothing waiting). */
  arrival: number | null;
  /** Bar selection (SPEC §4.1) and the in-app bar clipboard. */
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
  /** Hex cell (or its ♯ / ♭) clicked or picked with Space / A — written pitch. Write: insert; Play: audition. */
  | { type: 'pick'; written: number }
  | { type: 'length'; d: Duration }
  | { type: 'toggle-rest' }
  | { type: 'delete'; back: boolean }
  | { type: 'nudge'; dir: -1 | 1; octave: boolean }
  /** ← / → : Write moves the caret by event; Play steps slots. */
  | { type: 'step'; dir: -1 | 1 }
  /** ‹ › and < > : previous / next slot, wrapping. */
  | { type: 'browse'; dir: -1 | 1 }
  | { type: 'event-click'; event: TimedEvent }
  | { type: 'time-click'; t: number }
  | { type: 'slot-click'; index: number }
  | { type: 'mode'; mode: 'write' | 'play' | 'toggle' }
  | { type: 'stand'; on: boolean | 'toggle' }
  | { type: 'sound'; what: 'chord' | 'bass' | 'scale' }
  | { type: 'toggle-mute' }
  | { type: 'set-arrival'; how: OnArrival }
  | { type: 'bar-select'; bar: number; extend: boolean }
  | { type: 'bar-action'; bar: number; action: BarAction }
  | { type: 'append-bar' }
  | { type: 'clear-selection' }
  | { type: 'clear-all' }
  | { type: 'time-signature'; text: string }
  | { type: 'undo' }
  | { type: 'redo' }
  /** After undo / redo (with the restored caret) or another tab's write (no caret). */
  | { type: 'restored'; caret?: number }
  | { type: 'refusal-shown' }
  | { type: 'notice-done' };

export type Effect =
  | { type: 'note'; midi: number }
  | { type: 'chord' | 'root' | 'bass' | 'scale'; harmony: SlotHarmony }
  | { type: 'device'; patch: { muted?: boolean; playArrival?: OnArrival } }
  | { type: 'history'; dir: 'undo' | 'redo' };

export interface Outcome {
  state: SessionState;
  /** An edit to commit as one undo step (with the caret before it), or undefined. */
  edit?: Progression;
  effects: Effect[];
}

export function initialSession(p: Progression, device: { muted?: boolean; onArrival: OnArrival }): SessionState {
  return {
    caret: melodyEnd(p.melody), // opens at the melody's end; not saved
    length: 'q',
    rest: false,
    playIndex: null,
    stand: false,
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
  return Math.min(s.caret, instrumentView(p).end);
}

/** The active slot: Play's current slot, else the caret's (the last slot at the end of the form). */
export function activeIndex(s: SessionState, p: Progression): number {
  const v = instrumentView(p);
  return s.playIndex !== null ? Math.min(s.playIndex, v.slots.length - 1) : v.slotAt(caretOf(s, p)).index;
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

export function reduce(state: SessionState, p: Progression, intent: Intent): Outcome {
  const view = instrumentView(p);
  const { slots } = view;
  const caret = Math.min(state.caret, view.end);
  const playing = state.playIndex !== null;
  const active: ViewSlot = playing ? slots[Math.min(state.playIndex!, slots.length - 1)] : view.slotAt(caret);

  let s: SessionState = state;
  let edit: Progression | undefined;
  const effects: Effect[] = [];
  const set = (patch: Partial<SessionState>) => (s = { ...s, ...patch });
  const done = (): Outcome => ({ state: s, edit, effects });

  /** Play: reach a slot. Its *On arrival* sound waits for the first note played there. */
  const arrive = (index: number) => set({ playIndex: index, arrival: index });
  /** Play: a note was played in slot `index`; the first one after arriving brings the arrival sound. */
  const playedIn = (index: number) => {
    if (s.arrival !== index) return;
    set({ arrival: null });
    effects.push(...arrivalSounds(s.onArrival, slots[index].concert));
  };
  const say = (text: string) => set({ notice: { text, n: (s.notice?.n ?? 0) + 1 } });

  /** Write: insert a note (or rest) at the caret; past the end, writing continues from the start (SPEC §6.2). */
  const insert = (d: Duration, pitch: number | null) => {
    const r = insertWrapping(p.melody, slots, caret, d, pitch);
    if (!r.ok) {
      set({ refusal: { d, message: r.message, n: (s.refusal?.n ?? 0) + 1 } });
      return;
    }
    // *On arrival* in Write: the first entry of a slot (written at its start) sounds with it.
    const at = caret >= view.end ? 0 : caret;
    const slot = view.slotAt(at);
    if (slot.start === at) effects.push(...arrivalSounds(s.onArrival, slot.concert));
    edit = { ...p, melody: r.melody };
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
    return true;
  };

  switch (intent.type) {
    case 'pick': {
      const midi = view.toConcert(intent.written);
      effects.push({ type: 'note', midi }); // audition, even when the insert is refused
      if (playing) playedIn(active.index); // Play: audition only, never recorded
      else {
        set({ rest: false });
        insert(s.length, midi);
      }
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
      const r = (intent.back ? backspaceAt : deleteAt)(p.melody, caret);
      if (r.melody !== p.melody) edit = { ...p, melody: r.melody };
      set({ caret: r.caret });
      return done();
    }
    case 'nudge': {
      const r = nudge(p.melody, slots, caret, intent.dir, intent.octave, (slot) => stepPitchClasses(slots[slot.index].concert) ?? CHROMATIC); // no chord: semitones
      if (!r.ok) return done();
      edit = { ...p, melody: r.melody };
      effects.push({ type: 'note', midi: r.pitch });
      set({ halo: { pitch: r.pitch, caret, melody: r.melody } });
      return done();
    }
    case 'step':
      if (playing) arrive(stepSlot(active.index, intent.dir, slots.length));
      else set({ caret: stepCaret(p.melody, slots, caret, intent.dir, s.length) });
      return done();
    case 'browse': {
      const next = stepSlot(active.index, intent.dir, slots.length);
      if (playing) arrive(next);
      else set({ selection: null, caret: slots[next].start });
      return done();
    }
    case 'event-click': {
      const e = intent.event;
      set({ selection: null });
      if ('pitch' in e.ev) effects.push({ type: 'note', midi: e.ev.pitch });
      if (playing) {
        // Play: select its slot (an arrival, sounding with this note); nothing is edited
        const index = view.slotAt(e.start).index;
        if (index !== active.index) arrive(index);
        if ('pitch' in e.ev) playedIn(index);
      } else set({ caret: e.start });
      return done();
    }
    case 'time-click':
      set({ selection: null });
      if (playing) arrive(view.slotAt(intent.t).index);
      else set({ caret: caretFromClick(p.melody, slots, intent.t, s.length) });
      return done();
    case 'slot-click': {
      const slot = slots[intent.index];
      set({ selection: null });
      if (playing) arrive(slot.index);
      else if (!(caret >= slot.start && caret < slot.end)) set({ caret: slot.start });
      return done();
    }
    case 'mode': {
      const toPlay = intent.mode === 'toggle' ? !playing : intent.mode === 'play';
      if (toPlay === playing) return done();
      if (toPlay) {
        set({ selection: null });
        arrive(view.slotAt(caret).index); // entering Play is an arrival too (silent until the first note)
      } else set({ caret: active.start, playIndex: null, arrival: null });
      return done();
    }
    case 'stand':
      set({ stand: intent.on === 'toggle' ? !s.stand : intent.on });
      return done();
    case 'sound':
      effects.push({ type: intent.what === 'bass' ? 'root' : intent.what, harmony: active.concert });
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
      const sel = s.selection;
      const bar = intent.bar;
      set({
        selection:
          intent.extend && sel
            ? { anchor: sel.anchor, from: Math.min(sel.anchor, bar), to: Math.max(sel.anchor, bar) }
            : sel && !intent.extend && sel.from === bar && sel.to === bar
              ? null // clicking the only selected bar again deselects it
              : { anchor: bar, from: bar, to: bar },
      });
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
          set({ clip: copyBars(p, from, to) });
          say(from === to ? `Copied bar ${from + 1}` : `Copied bars ${from + 1}–${to + 1}`);
          break;
        }
        case 'paste':
          if (s.clip) barEdit(pasteBars(p, from, s.clip, caret));
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
    case 'clear-all':
      edit = clearMelody(p); // one undo step, no confirm (SPEC §6.2 item 10)
      set({ caret: 0 });
      return done();
    case 'time-signature': {
      const next = setTimeSignature(p, intent.text);
      if (next === p) return done();
      edit = next; // bars resize, the melody is re-fitted; the caret keeps its time, snapped to an event start
      set({ caret: snapToEvent(next.melody, Math.min(caret, instrumentView(next).end)) });
      return done();
    }
    case 'undo':
    case 'redo':
      effects.push({ type: 'history', dir: intent.type });
      return done();
    case 'restored':
      set({ selection: null, refusal: null, ...(intent.caret !== undefined ? { caret: intent.caret } : {}) });
      return done();
    case 'refusal-shown':
      set({ refusal: null });
      return done();
    case 'notice-done':
      set({ notice: null });
      return done();
  }
}
