// Mic intake (SPEC §3.2, §3.7, §9.2): what becomes of each note start the mic hears — written at the caret (Write with
// Audio input), counted (Practice) or ignored. Ignored: the app's own sounds (an echo guard over *Audio on chord* and
// hex-pick auditions, merged while they ring) and, when writing, a repeat or a pitch wobble right after a written note.
// Pure: times come in (ms), state comes back.

import { echoGuard, isEcho, type AppSound, type EchoGuard } from './practice';

export interface MicIntake {
  echo: EchoGuard | null;
  /** The last note written from the mic (written pitch, time), for the repeat / wobble filter. */
  lastWrite: { written: number; at: number } | null;
}

export const NEW_INTAKE: MicIntake = { echo: null, lastWrite: null };

/** Writing: the same pitch again this soon is one note held, not a new one. */
export const REPEAT_MS = 220;
/** Writing: a slur (no new attack) within this of a written note, a step or less away, is the same note wobbling. */
export const WOBBLE_MS = { step: 130, semitone: 150 };

/**
 * The app played these sounds at `now` while practising: the mic mustn't count them. A guard still ringing is kept
 * (a hex pick mustn't drop a chord's guard).
 */
export function appSounded(m: MicIntake, sounds: AppSound[], now: number): MicIntake {
  const g = echoGuard(sounds, now);
  if (!g) return m;
  const old = m.echo;
  const echo = old && now < old.until ? { start: g.start, until: Math.max(g.until, old.until), midis: new Set([...old.midis, ...g.midis]) } : g;
  return { ...m, echo };
}

export type HeardAction = { kind: 'ignore' } | { kind: 'write'; written: number } | { kind: 'count' };

/**
 * A note start the mic heard. `writing`: Write (not Explore) with Audio input — it's written; otherwise it's counted
 * (Practice decides what counting means).
 */
export function heard(
  m: MicIntake,
  note: { concert: number; written: number; fromOnset: boolean },
  now: number,
  writing: boolean,
): { intake: MicIntake; action: HeardAction } {
  if (isEcho(m.echo, note.concert, now)) return { intake: m, action: { kind: 'ignore' } };
  if (!writing) return { intake: m, action: { kind: 'count' } };
  const last = m.lastWrite;
  if (last) {
    const dt = now - last.at;
    const diff = Math.abs(note.written - last.written);
    if (note.written === last.written && dt < REPEAT_MS) return { intake: m, action: { kind: 'ignore' } };
    if (!note.fromOnset && ((diff <= 2 && dt < WOBBLE_MS.step) || (diff < 2 && dt < WOBBLE_MS.semitone))) {
      return { intake: m, action: { kind: 'ignore' } };
    }
  }
  return { intake: { ...m, lastWrite: { written: note.written, at: now } }, action: { kind: 'write', written: note.written } };
}

/** Listening stopped: the next written note starts fresh. */
export const micStopped = (m: MicIntake): MicIntake => ({ ...m, lastWrite: null });
