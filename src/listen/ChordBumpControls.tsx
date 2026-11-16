// Chord bump (Improvise): on the listen row's right — after this many hex picks in a slot, advance to the next chord.
import { createPortal } from 'react-dom';
import { CHORD_BUMP_NOTES_OPTIONS, type ChordBumpNotes } from '../deviceSettings';
import { Dropdown } from '../rail/Dropdown';

export function ChordBumpControls({
  slot,
  on,
  notes,
  onToggle,
  onNotes,
}: {
  slot: HTMLElement | null;
  on: boolean;
  notes: ChordBumpNotes;
  onToggle: (on: boolean) => void;
  onNotes: (notes: ChordBumpNotes) => void;
}) {
  if (!slot) return null;
  return createPortal(
    <div className={on ? 'chord-bump well group on' : 'chord-bump well group'}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Chord bump"
        className={on ? 'switch chord-bump-toggle on' : 'switch chord-bump-toggle'}
        title={on ? 'Chord bump: advance the form after hex note picks' : 'Chord bump off'}
        onClick={() => onToggle(!on)}
      >
        <span className="chord-bump-label">chord bump</span>
        <span className="switch-track" aria-hidden>
          <span className="switch-knob" />
        </span>
      </button>
      <Dropdown
        className="chord-bump-notes"
        label="Chord bump notes"
        prefix="notes:"
        value={notes}
        disabled={!on}
        options={CHORD_BUMP_NOTES_OPTIONS.map((n) => ({ value: n, label: String(n) }))}
        onChange={onNotes}
      />
    </div>,
    slot,
  );
}