// Grid improv's chord bump (SPEC §3.11): a switch in its own pill. Off (the default), the transport moves the chords —
// ▶, or slots by hand while stopped. On, they move on after a number of notes picked on the hex: its pill shows
// *notes per chord* and the notes picked so far. The two share one slot — both laid out, one shown — so they are the
// same length and nothing moves when the switch flips. Loop and the looped bars: the loop pill.
import type { ReactNode } from 'react';
import { CHORD_BUMP_NOTES_OPTIONS, type ChordBumpNotes } from '../deviceSettings';
import { Dropdown } from './Dropdown';

export interface MoveOnControlsProps {
  /** The chord bump switch. */
  on: boolean;
  onToggle: (on: boolean) => void;
  notes: ChordBumpNotes;
  onNotes: (notes: ChordBumpNotes) => void;
  /** Chord bump: the notes picked in this chord so far (the chord moves on at `notes`). */
  count: number;
  /** The transport bar: shown with chord bump off. */
  transport: ReactNode;
}

export function MoveOnControls({ on, onToggle, notes, onNotes, count, transport }: MoveOnControlsProps) {
  return (
    <>
      <div className="move-on pill">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Chord bump"
          className={on ? 'switch chip move-on-switch on' : 'switch chip move-on-switch'}
          title={on ? 'Chord bump: the next chord comes after the notes you pick on the hex' : 'Chord bump off: the transport moves the chords (▶, or by hand while stopped)'}
          onClick={() => onToggle(!on)}
        >
          <span className="pill-label">chord bump</span>
          <span className="switch-track" aria-hidden>
            <span className="switch-knob" />
          </span>
        </button>
      </div>
      <div className="pace-slot">
        <div className={on ? 'by-notes pill' : 'by-notes pill pace-hidden'} aria-hidden={!on || undefined}>
          <span className="move-on-notes">
            <span className="pill-label">notes per chord:</span>
            <Dropdown label="Notes per chord" value={notes} options={CHORD_BUMP_NOTES_OPTIONS.map((n) => ({ value: n, label: String(n) }))} onChange={onNotes} />
          </span>
          {/* The notes picked in this chord so far (1 … N−1; at N, the next chord). None yet — a chord just arrived — a
              small right arrow in place of 0. A fixed width, so the pill doesn't change length. */}
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
        </div>
        <div className={on ? 'pace-transport pace-hidden' : 'pace-transport'} aria-hidden={on || undefined}>
          {transport}
        </div>
      </div>
    </>
  );
}
