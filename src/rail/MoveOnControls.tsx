// Grid improv's chord bump pill (SPEC §3.11): a **chord bump** switch — on, the chords move on by notes (after N notes
// picked on the hex) or with the metronome (the transport bar beside it); off, by hand only (the choices greyed). By
// notes has its own pill after it: notes: N and the notes picked so far. Loop and the looped bars: the loop pill.
import type { ReactNode } from 'react';
import { CHORD_BUMP_NOTES_OPTIONS, type ChordBumpNotes } from '../deviceSettings';
import type { MoveBy } from '../modeProfile';
import { Dropdown } from './Dropdown';

export interface MoveOnControlsProps {
  /** The chord bump switch. */
  on: boolean;
  onToggle: (on: boolean) => void;
  moveBy: MoveBy;
  onMoveBy: (moveBy: MoveBy) => void;
  notes: ChordBumpNotes;
  onNotes: (notes: ChordBumpNotes) => void;
  /** By notes: the notes picked in this chord so far (the chord moves on at `notes`). */
  count: number;
  /** The transport bar (the metronome). It shares one slot with the by notes pill — both laid out, one shown — so
   *  the two are the same length and nothing moves on a switch. */
  transport: ReactNode;
}

const CHOICES: { value: MoveBy; label: string; title: string }[] = [
  { value: 'notes', label: 'by notes', title: 'The next chord comes after the number of notes you pick on the hex' },
  { value: 'time', label: 'metronome', title: 'The chords move on in time, with a click (the transport)' },
];

export function MoveOnControls({ on, onToggle, moveBy, onMoveBy, notes, onNotes, count, transport }: MoveOnControlsProps) {
  const metronome = on && moveBy === 'time';
  return (
    <>
      <div className={on ? 'move-on pill' : 'move-on pill off'}>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Chord bump"
          className={on ? 'switch chip move-on-switch on' : 'switch chip move-on-switch'}
          title={on ? 'Chord bump: the chords move on by themselves (off: by hand only)' : 'Chord bump off: move through the chords by hand'}
          onClick={() => onToggle(!on)}
        >
          <span className="pill-label">chord bump</span>
          <span className="switch-track" aria-hidden>
            <span className="switch-knob" />
          </span>
        </button>
        <span className="move-on-choice" role="radiogroup" aria-label="How the chords move on" aria-disabled={!on || undefined}>
          {CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              role="radio"
              aria-checked={moveBy === c.value}
              disabled={!on}
              className={moveBy === c.value ? 'chip on' : 'chip'}
              title={c.title}
              onClick={() => onMoveBy(c.value)}
            >
              {c.label}
            </button>
          ))}
        </span>
      </div>
      <div className="pace-slot">
        {/* By notes: its own pill — the notes before the next chord, and the notes picked so far (greyed with chord bump
            off; the metronome's slot keeps it, hidden, for the width). */}
        <div className={['by-notes pill', !on && 'off', moveBy === 'time' && 'pace-hidden'].filter(Boolean).join(' ')} aria-hidden={moveBy === 'time' || undefined}>
          <span className="move-on-notes">
            <span className="pill-label">notes:</span>
            <Dropdown label="Notes before the next chord" value={notes} disabled={!on} options={CHORD_BUMP_NOTES_OPTIONS.map((n) => ({ value: n, label: String(n) }))} onChange={onNotes} />
          </span>
          {on && (
            // The notes picked in this chord so far (1 … N−1; at N, the next chord). None yet — a chord just arrived — a
            // small right arrow in place of 0. A fixed width, so the pill doesn't change length.
            <span className="move-on-tally">
            <span className="pill-label">count:</span>
            <span className="move-on-count" role="status" aria-label={`${count} of ${notes} notes picked in this chord`} title={`${count} of ${notes} notes picked in this chord`}>
              {count === 0 ? (
                <svg className="move-on-arrow" viewBox="0 0 12 12" width="10" height="10" aria-hidden>
                  <path d="M2.5 6h6.5M6.5 3l3 3-3 3" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : (
                count
              )}
            </span>
            </span>
          )}
        </div>
        <div className={metronome ? 'pace-transport' : 'pace-transport pace-hidden'} aria-hidden={!metronome || undefined}>
          {transport}
        </div>
      </div>
    </>
  );
}
