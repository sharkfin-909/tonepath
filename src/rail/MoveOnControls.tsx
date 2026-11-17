// Grid improv's move-on pill (SPEC §3.11): how the chords move on — by notes (chord bump: after N notes picked on the
// hex; the looped bars' status here, since there is no transport) or in time (the transport bar beside it).
import { CHORD_BUMP_NOTES_OPTIONS, type ChordBumpNotes } from '../deviceSettings';
import type { MoveBy } from '../modeProfile';
import { Dropdown } from './Dropdown';
import { LoopStatus, type TransportBarProps } from './TransportBar';

export interface MoveOnControlsProps extends Pick<TransportBarProps, 'bars' | 'onAllBars' | 'barCount' | 'onPickBars'> {
  moveBy: MoveBy;
  onMoveBy: (moveBy: MoveBy) => void;
  notes: ChordBumpNotes;
  onNotes: (notes: ChordBumpNotes) => void;
}

const CHOICES: { value: MoveBy; label: string; title: string }[] = [
  { value: 'notes', label: 'by notes', title: 'The next chord comes after the number of notes you pick on the hex' },
  { value: 'time', label: 'in time', title: 'The chords move on in time, with a click (the transport)' },
];

export function MoveOnControls({ moveBy, onMoveBy, notes, onNotes, ...loop }: MoveOnControlsProps) {
  return (
    <div className="move-on pill">
      <span className="pill-label">move on</span>
      <span className="move-on-choice" role="radiogroup" aria-label="How the chords move on">
        {CHOICES.map((c) => (
          <button
            key={c.value}
            type="button"
            role="radio"
            aria-checked={moveBy === c.value}
            className={moveBy === c.value ? 'chip on' : 'chip'}
            title={c.title}
            onClick={() => onMoveBy(c.value)}
          >
            {c.label}
          </button>
        ))}
      </span>
      {moveBy === 'notes' && (
        <>
          <span className="move-on-notes">
            <span className="pill-label">notes:</span>
            <Dropdown label="Notes before the next chord" value={notes} options={CHORD_BUMP_NOTES_OPTIONS.map((n) => ({ value: n, label: String(n) }))} onChange={onNotes} />
          </span>
          <LoopStatus {...loop} />
        </>
      )}
    </div>
  );
}
