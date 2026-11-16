// Pure `practice` module (SPEC §3.7): improvisation practice over the form, driven by the notes the mic hears.
// Each played note is counted in the current slot; an **advance rule** decides when the form moves on to the next
// slot. All five rules are options; the note count target is the practice panel's number (notes per chord).

import { chordVoicing, rootNote, bassNote } from './audio';
import { pcOf, type SlotHarmony } from './harmony';
import { eventsForSlot } from './melody';
import type { MelodyEvent } from './progression';
import type { InstrumentView, ViewSlot } from './view';

export type AdvanceRule = 'guide' | 'chord-tone' | 'count' | 'count-then-guide' | 'follow';

export const ADVANCE_RULES: { id: AdvanceRule; label: string; hint: string }[] = [
  { id: 'guide', label: 'Guide tone', hint: 'Move on when you play a 3rd or 7th of the next chord' },
  { id: 'chord-tone', label: 'Chord tone', hint: 'Move on when you play any note of the next chord' },
  { id: 'count', label: 'Note count', hint: 'Move on after the count of notes (set in Notes:)' },
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
  /** Follow: pitch class of the last accepted note — a same-pitch repeat needs a re-attack. */
  lastFollowPc: number | null;
}

export interface PracticeContext {
  view: InstrumentView;
  melody: MelodyEvent[];
  rule: AdvanceRule;
  /** The note count target per slot (the practice panel's number; at least 1). */
  count: number;
  /** Looping selected bars: the first and last slot practised (null: the whole form). */
  range?: SlotRange | null;
}

/** A run of slots (form indices, inclusive). */
export interface SlotRange {
  first: number;
  last: number;
}

export const startPractice = (slot: number): PracticeState => ({ slot, count: 0, follow: 0, lastFollowPc: null });

const mod12 = (n: number) => ((n % 12) + 12) % 12;
/** The slot after `slot`: the next in the form, wrapping at its end — or, looping selected bars, at the range's end. */
export function nextSlot(c: Pick<PracticeContext, 'view' | 'range'>, slot: number): number {
  const r = c.range;
  if (r) return slot >= r.first && slot < r.last ? slot + 1 : r.first;
  return (slot + 1) % c.view.slots.length;
}
/** Where the form (or the looped bars) starts. */
export const firstSlot = (c: Pick<PracticeContext, 'range'>): number => c.range?.first ?? 0;

/** The note counts the practice panel offers. */
export const PRACTICE_COUNTS = [1, 2, 4, 8, 16, 32] as const;

/** Practice's note count: one of PRACTICE_COUNTS (the nearest; the default 4 for anything not a number). */
export function practiceCount(n: unknown): number {
  if (typeof n !== 'number' || !Number.isFinite(n)) return 4;
  return PRACTICE_COUNTS.reduce((best, c) => (Math.abs(c - n) < Math.abs(best - n) ? c : best), PRACTICE_COUNTS[0]);
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
  const nxt = c.view.slots[nextSlot(c, s.slot)];
  const need = practiceCount(c.count);
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
export function practiceNote(s: PracticeState, heard: number, c: PracticeContext, fromOnset = true): PracticeStep {
  const count = s.count + 1;
  const need = practiceCount(c.count);
  /** Landed on the next chord: this note is its first. */
  const advance = (): PracticeStep => ({
    state: { slot: nextSlot(c, s.slot), count: 1, follow: 0, lastFollowPc: mod12(heard) },
    advanced: true,
    landed: true,
  });
  /** Finished this slot: the next slot starts empty. */
  const finish = (patch: Partial<PracticeStep> = {}): PracticeStep => ({
    state: { slot: nextSlot(c, s.slot), count: 0, follow: 0, lastFollowPc: mod12(heard) },
    advanced: true,
    landed: false,
    ...patch,
  });
  const stay = (patch: Partial<PracticeState> = {}): PracticeStep => ({ state: { ...s, count, ...patch }, advanced: false });
  /** Ignore this noteStart (e.g. a slurred echo of a pitch we just accepted) — no count bump. */
  const ignore = (): PracticeStep => ({ state: s, advanced: false });
  const t = practiceTargets(s, c);

  if (c.rule === 'follow') {
    if (t.midi === null) return count >= need ? finish() : stay({ lastFollowPc: null }); // nothing written here: by count
    // Same pitch class in any octave (detector octave slips + players often shift register).
    if (mod12(heard) !== mod12(t.midi)) return stay(); // a wrong note: wait for the written one
    // A written repeat of the same pitch needs a re-attack — a held note must not mark the next one too.
    if (s.lastFollowPc === mod12(heard) && !fromOnset) return ignore();
    const hit = followEventIndex(s, c) ?? undefined;
    const follow = s.follow + 1;
    if (follow >= writtenNotes(c.view, c.melody, s.slot).length) return finish({ hit });
    return { ...stay({ follow, lastFollowPc: mod12(heard) }), hit };
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

/** A sound the app plays: *On arrival* (a slot's chord, root or bass) or a note (a hex pick's audition). */
export type AppSound = { type: 'chord' | 'root' | 'bass'; harmony: SlotHarmony } | { type: 'note'; midi: number };

/** The guard for sounds just played: chord (rings ~3 s), a note — root, bass or a hex pick (~1 s). Null when nothing sounded. */
export function echoGuard(sounds: AppSound[], now: number): EchoGuard | null {
  const midis = new Set<number>();
  let ring = 0;
  for (const e of sounds) {
    const ms =
      e.type === 'note' ? [e.midi] : e.type === 'chord' ? chordVoicing(e.harmony) : [e.type === 'root' ? rootNote(e.harmony) : bassNote(e.harmony)].filter((m): m is number => m !== null);
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
