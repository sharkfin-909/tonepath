// The Practice run (SPEC §3.7): everything about one time through Practice that isn't the session's — the slot being
// practised and its count, the written notes played this time through (Follow), the advances (the panel's flash),
// and what the run asks of the session. Events come in (a note played, a move by hand, the metronome's chord change
// or end); the run and the session intents to dispatch come back. Looping selected bars, the form is their slot range
// (`RunContext.range`). Counting itself is `practice.ts`; the session (`session.ts`) owns the current slot, the looped
// bars, *Audio on chord* and the mode.
// Pure: no React, no audio.

import { prettyName } from './spelling';
import { firstSlot, nextSlot, practiceNote, practiceTargets, startPractice, type PracticeContext, type PracticeState } from './practice';
import type { Intent } from './session';
import type { ViewSlot } from './view';

export interface PracticeRun {
  state: PracticeState;
  /** Follow: the written notes (melody indices) played correctly this time through. */
  played: ReadonlySet<number>;
  /** How many times the notes played have moved the form on (each replays the panel's flash). */
  advances: number;
}

/** What a run needs besides the progression: the panel's settings. */
export interface RunContext extends PracticeContext {
  /** Without Loop, finishing the form ends Practice (back to Write). */
  loop: boolean;
  /** With the metronome, time moves the form on, not the notes. */
  metronome: boolean;
}

/**
 * The session's current Practice slot (null: not practising). A run follows it: a fresh run when Practice starts or the
 * slot changes by hand (or by the metronome); the same run when the run itself moved there.
 */
export function followSlot(run: PracticeRun | null, slot: number | null): PracticeRun | null {
  if (slot === null) return null;
  if (run && run.state.slot === slot) return run;
  return { state: startPractice(slot), played: new Set(), advances: run?.advances ?? 0 };
}

/** The rule changed: the count starts again on the current slot. */
export const restartSlot = (run: PracticeRun): PracticeRun => ({ ...run, state: startPractice(run.state.slot) });

/**
 * A note played (concert MIDI): from the mic, or a hex pick (an attack). With the metronome, nothing (time moves the
 * form). Otherwise it counts: the session hears it first (`practice-note`: a waiting *Audio on chord* sounds with it),
 * then the run moves on (`practice-advance`) — or, finishing the form without Loop, Practice ends (`mode` → Write).
 */
export function runNote(run: PracticeRun, heard: number, fromOnset: boolean, c: RunContext): { run: PracticeRun; intents: Intent[] } {
  if (c.metronome) return { run, intents: [] };
  const intents: Intent[] = [{ type: 'practice-note' }];
  const step = practiceNote(run.state, heard, c, fromOnset);
  let played = run.played;
  if (step.hit !== undefined) {
    // A new time through the form (it wrapped to the start) clears the marks.
    played = step.advanced && step.state.slot <= run.state.slot ? new Set() : new Set(run.played).add(step.hit);
  }
  if (step.advanced && step.state.slot === firstSlot(c) && !c.loop) {
    intents.push({ type: 'mode', mode: 'write' });
    return { run: { ...run, played }, intents };
  }
  if (!step.advanced) return { run: { ...run, state: step.state, played }, intents };
  intents.push({ type: 'practice-advance', index: step.state.slot, landed: step.landed === true });
  return { run: { state: step.state, played, advances: run.advances + 1 }, intents };
}

/** The metronome reached a chord: the form moves on, and *Audio on chord* sounds with it. */
export const metronomeChord = (index: number): Intent[] => [{ type: 'practice-advance', index, landed: true }];

/** The metronome finished the form (or the looped bars) without Loop: back at their first chord, silent until started again. */
export const metronomeEnd = (first = 0): Intent[] => [{ type: 'practice-advance', index: first, landed: false }];

/** What the run shows: the hex's ringed targets (written pitch), their names in the panel, and the count target. */
export interface RunTargets {
  hex: { pcs: Set<number> | null; midi: number | null } | null;
  names: string;
  need: number | null;
}

/**
 * The targets now. With the metronome: the upcoming chord's chord tones (what to aim for as it arrives; the first
 * chord's at the form's end). Otherwise the rule's — the next chord's tones, or Follow's next written note.
 */
export function runTargets(run: PracticeRun, c: RunContext, active: ViewSlot): RunTargets {
  const { view } = c;
  const written = (pcs: Set<number>) => new Set([...pcs].map((pc) => (pc + view.inst.semitones) % 12));
  const t = practiceTargets(run.state, c);
  const upcoming = view.slots[nextSlot(c, active.index)];
  if (c.metronome) {
    const hex = upcoming.concert.kind === 'chord' ? { pcs: written(upcoming.concert.chordTones), midi: null } : null;
    return { hex, names: '', need: t.need };
  }
  const names =
    t.midi !== null
      ? prettyName(view.name(t.midi, active))
      : t.pcs
        ? [...t.pcs].map((pc) => prettyName(view.name(60 + pc, upcoming).replace(/-?\d+$/, ''))).join(' · ')
        : '';
  return { hex: { pcs: t.pcs && written(t.pcs), midi: t.midi === null ? null : view.toWritten(t.midi) }, names, need: t.need };
}
