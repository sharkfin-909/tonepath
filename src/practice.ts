// Pure `practice` module (SPEC §3.7): improvisation practice over the form, driven by the notes the mic hears.
// Each played note is counted in the current slot; an **advance rule** decides when the form moves on to the next
// slot. All five rules are options; the note count target comes from the selected note length and the slot's length.

import { chordVoicing, rootNote, bassNote } from './audio';
import { pcOf, type SlotHarmony } from './harmony';
import { TICKS, eventsForSlot } from './melody';
import type { Duration, MelodyEvent } from './progression';
import type { InstrumentView, ViewSlot } from './view';

export type AdvanceRule = 'guide' | 'chord-tone' | 'count' | 'count-then-guide' | 'follow';

export const ADVANCE_RULES: { id: AdvanceRule; label: string; hint: string }[] = [
  { id: 'guide', label: 'Guide tone', hint: 'Move on when you play a 3rd or 7th of the next chord' },
  { id: 'chord-tone', label: 'Chord tone', hint: 'Move on when you play any note of the next chord' },
  { id: 'count', label: 'Note count', hint: 'Move on after the slot’s count of notes (from the selected length)' },
  { id: 'count-then-guide', label: 'Count, then guide tone', hint: 'Play the slot’s count of notes, then land on a guide tone of the next chord' },
  { id: 'follow', label: 'Follow the etude', hint: 'Play the written notes in order; the form follows you' },
];

export interface PracticeState {
  /** The slot being practised (form index). */
  slot: number;
  /** Notes played in it so far. */
  count: number;
  /** Follow: how many of the slot's written notes have been played. */
  follow: number;
}

export interface PracticeContext {
  view: InstrumentView;
  melody: MelodyEvent[];
  rule: AdvanceRule;
  /** The selected note length: the count target is the slot's length in these. */
  length: Duration;
}

export const startPractice = (slot: number): PracticeState => ({ slot, count: 0, follow: 0 });

const mod12 = (n: number) => ((n % 12) + 12) % 12;
const next = (view: InstrumentView, slot: number) => (slot + 1) % view.slots.length;

/** How many notes fill a slot at the selected length (a 2-beat slot in quarters → 2). At least 1. */
export function noteCountFor(slot: Pick<ViewSlot, 'start' | 'end'>, length: Duration): number {
  return Math.max(1, Math.round((slot.end - slot.start) / TICKS[length]));
}

/** A slot's guide tones (concert pitch classes): its 3rd (a sus chord's 4th) and its 7th or 6th. Empty without a chord. */
export function guideTones(slot: ViewSlot): Set<number> {
  const h = slot.concert;
  if (h.kind !== 'chord') return new Set();
  const pick = (re: RegExp) => h.intervals.filter((iv) => re.test(iv)).map((iv) => pcOf(h.root, iv));
  const third = pick(/^3[mM]$/);
  return new Set([...(third.length ? third : pick(/^4P$/)), ...pick(/^[67][mMd]$/)]);
}

/** The written notes of a slot, in order (concert MIDI): what Follow expects. */
function writtenNotes(view: InstrumentView, melody: MelodyEvent[], slot: number): number[] {
  return eventsForSlot(melody, view.slots[slot]).flatMap((e) => ('pitch' in e.ev ? [e.ev.pitch] : []));
}

/** Follow: the melody index (into `melody`) of the note expected next, to mark it on the stave; null if none. */
export function followEventIndex(s: PracticeState, c: Pick<PracticeContext, 'view' | 'melody'>): number | null {
  const notes = eventsForSlot(c.melody, c.view.slots[s.slot]).filter((e) => 'pitch' in e.ev);
  return notes[s.follow]?.i ?? null;
}

export interface PracticeTargets {
  /** Pitch classes (concert) that move the form on now, or null when the rule isn't waiting on a pitch yet. */
  pcs: Set<number> | null;
  /** Follow: the exact next note (concert MIDI). */
  midi: number | null;
  /** The slot's note count target (count rules), else null. */
  need: number | null;
}

/** What the player is aiming for in the current state (shown on the hex and in the practice panel). */
export function practiceTargets(s: PracticeState, c: PracticeContext): PracticeTargets {
  const slot = c.view.slots[s.slot];
  const nxt = c.view.slots[next(c.view, s.slot)];
  const need = noteCountFor(slot, c.length);
  switch (c.rule) {
    case 'guide':
      return { pcs: orNull(guideTones(nxt)), midi: null, need: null };
    case 'chord-tone':
      return { pcs: orNull(nxt.concert.kind === 'chord' ? nxt.concert.chordTones : new Set()), midi: null, need: null };
    case 'count':
      return { pcs: null, midi: null, need };
    case 'count-then-guide':
      return { pcs: s.count >= need ? orNull(guideTones(nxt)) : null, midi: null, need };
    case 'follow': {
      const notes = writtenNotes(c.view, c.melody, s.slot);
      return { pcs: null, midi: notes[s.follow] ?? null, need: notes.length ? null : need };
    }
  }
}

const orNull = (s: Set<number>) => (s.size ? s : null);

export interface PracticeStep {
  state: PracticeState;
  /** The form moved on to `state.slot`. */
  advanced: boolean;
  /**
   * The note that moved it on is the new slot's first note (guide tone, chord tone: you land on the next chord) — its
   * *On arrival* sounds now. False when it was the old slot's last note (note count, Follow): the sound waits for the
   * next note played.
   */
  landed?: boolean;
  /** Follow: the melody index of the written note just played correctly (marked as played on the stave). */
  hit?: number;
}

/**
 * A note was played (concert MIDI). The note that moves the form on lands in the next slot, so it is that slot's
 * first note. A rule with nothing to aim for (the next slot has no chord; a slot with nothing written to follow)
 * falls back to the note count.
 */
export function practiceNote(s: PracticeState, heard: number, c: PracticeContext): PracticeStep {
  const count = s.count + 1;
  const need = noteCountFor(c.view.slots[s.slot], c.length);
  /** Landed on the next chord: this note is its first. */
  const advance = (): PracticeStep => ({ state: { slot: next(c.view, s.slot), count: 1, follow: 0 }, advanced: true, landed: true });
  /** Finished this slot: the next slot starts empty. */
  const finish = (patch: Partial<PracticeStep> = {}): PracticeStep => ({ state: { slot: next(c.view, s.slot), count: 0, follow: 0 }, advanced: true, landed: false, ...patch });
  const stay = (patch: Partial<PracticeState> = {}): PracticeStep => ({ state: { ...s, count, ...patch }, advanced: false });
  const t = practiceTargets(s, c);

  if (c.rule === 'follow') {
    if (t.midi === null) return count >= need ? finish() : stay(); // nothing written here: by count
    if (heard !== t.midi) return stay(); // a wrong note: wait for the written one
    const hit = followEventIndex(s, c) ?? undefined;
    const follow = s.follow + 1;
    if (follow >= writtenNotes(c.view, c.melody, s.slot).length) return finish({ hit });
    return { ...stay({ follow }), hit };
  }
  if (c.rule === 'count') return count >= need ? finish() : stay();
  if (c.rule === 'count-then-guide' && s.count < need) return stay(); // still filling the slot
  if (t.pcs === null) return count >= need ? finish() : stay(); // no target to land on: by count
  return t.pcs.has(mod12(heard)) ? advance() : stay();
}

/**
 * The mic hears the app's own *On arrival* sound (SPEC §3.7). For a moment after it starts, nothing heard counts;
 * while it rings, a heard note matching one of its pitches (or an octave off — a detector's usual slip) doesn't count.
 */
export interface EchoGuard {
  start: number;
  /** Until when its pitches ring (ms). */
  until: number;
  /** Its pitches (concert MIDI). */
  midis: Set<number>;
}

/** Ignore everything for this long after a sound starts (ms). */
export const ECHO_DEAF_MS = 250;

/** The guard for sounds just played: chord (rings ~3 s), root / bass note (~1 s). Null when nothing sounded. */
export function echoGuard(sounds: { type: 'chord' | 'root' | 'bass'; harmony: SlotHarmony }[], now: number): EchoGuard | null {
  const midis = new Set<number>();
  let ring = 0;
  for (const e of sounds) {
    const ms = e.type === 'chord' ? chordVoicing(e.harmony) : [e.type === 'root' ? rootNote(e.harmony) : bassNote(e.harmony)].filter((m): m is number => m !== null);
    ms.forEach((m) => midis.add(m));
    if (ms.length) ring = Math.max(ring, e.type === 'chord' ? 3200 : 1100);
  }
  return midis.size ? { start: now, until: now + ring, midis } : null;
}

/** Whether a heard note is the app's own sound, not the player. */
export function isEcho(g: EchoGuard | null, heard: number, now: number): boolean {
  if (!g || now >= g.until) return false;
  if (now - g.start < ECHO_DEAF_MS) return true;
  return g.midis.has(heard) || g.midis.has(heard - 12) || g.midis.has(heard + 12);
}
