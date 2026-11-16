// Mic intake (SPEC §3.3, §9.2): what becomes of each note start the mic hears in Improvise — a note played (it
// brings a waiting *Audio on chord* sound, while the transport is stopped) or ignored: the app's own sounds, under an
// echo guard over *Audio on chord* and hex-pick auditions, merged while they ring. Lighting the hex needs no intake
// (the heard pitch does that). Pure: times come in (ms), state comes back.

import { chordVoicing, rootNote, bassNote } from './audio';
import type { SlotHarmony } from './harmony';

/**
 * The mic hears the app's own *On arrival* sound (SPEC §3.3). For a moment after it starts, nothing heard counts;
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

export interface MicIntake {
  echo: EchoGuard | null;
}

export const NEW_INTAKE: MicIntake = { echo: null };

/**
 * The app played these sounds at `now`: the mic mustn't take them for the player. A guard still ringing is kept (a
 * hex pick mustn't drop a chord's guard).
 */
export function appSounded(m: MicIntake, sounds: AppSound[], now: number): MicIntake {
  const g = echoGuard(sounds, now);
  if (!g) return m;
  const old = m.echo;
  const echo = old && now < old.until ? { start: g.start, until: Math.max(g.until, old.until), midis: new Set([...old.midis, ...g.midis]) } : g;
  return { ...m, echo };
}

/** A note start the mic heard (concert MIDI): the player's, or the app's own sound. */
export const isPlayed = (m: MicIntake, concert: number, now: number): boolean => !isEcho(m.echo, concert, now);
