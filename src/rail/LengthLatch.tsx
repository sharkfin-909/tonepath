// Length latch in the control header (SPEC §3.1, §6.2 item 6): note icons (whole … 16th) with their keys 1–5;
// and the Rest latch (`R`): while on, a length button sets the latch and inserts a rest (handled by onChange).
// A refused insert flashes the latched button with a short message (SPEC §6.2 item 3).
import { useEffect } from 'react';
import type { Duration } from '../progression';

const LENGTHS: { d: Duration; label: string }[] = [
  { d: 'w', label: 'Whole note' },
  { d: 'h', label: 'Half note' },
  { d: 'q', label: 'Quarter note' },
  { d: 'e', label: 'Eighth note' },
  { d: 's', label: 'Sixteenth note' },
];

/** A note value drawn in SVG (the Unicode music symbols are missing from many system fonts). */
function NoteIcon({ d }: { d: Duration }) {
  const hollow = d === 'w' || d === 'h';
  const stem = d !== 'w';
  const flags = d === 'e' ? 1 : d === 's' ? 2 : 0;
  return (
    <svg className="note-icon" viewBox="0 0 14 24" width="12" height="20" aria-hidden>
      <ellipse
        cx={d === 'w' ? 7 : 5.5}
        cy={18.5}
        rx={d === 'w' ? 5 : 4.2}
        ry={3}
        transform={d === 'w' ? undefined : 'rotate(-22 5.5 18.5)'}
        fill={hollow ? 'none' : 'currentColor'}
        stroke="currentColor"
        strokeWidth={hollow ? 1.6 : 1}
      />
      {stem && <line x1={9.3} y1={17.5} x2={9.3} y2={2.5} stroke="currentColor" strokeWidth={1.3} />}
      {Array.from({ length: flags }, (_, i) => (
        <path key={i} d={`M9.3 ${2.5 + i * 4.5} c0.5 3 4.5 3.6 3.4 8.2`} fill="none" stroke="currentColor" strokeWidth={1.4} strokeLinecap="round" />
      ))}
    </svg>
  );
}

/** A quarter rest, for the Rest latch. */
function RestIcon() {
  return (
    <svg className="note-icon" viewBox="0 0 14 24" width="12" height="20" aria-hidden>
      <path d="M5 2.5 L9.5 8 L6 12 L9.8 16.5 C6.5 15 5 17 7.6 21.5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

export interface LengthLatchProps {
  value: Duration;
  onChange: (d: Duration) => void;
  rest: boolean;
  onToggleRest: () => void;
  /** `n` changes on every refusal so a repeat flashes again. */
  refusal: { d: Duration; message: string; n: number } | null;
  onRefusalShown: () => void;
}

export function LengthLatch({ value, onChange, rest, onToggleRest, refusal, onRefusalShown }: LengthLatchProps) {
  useEffect(() => {
    if (!refusal) return;
    const id = setTimeout(onRefusalShown, 1800);
    return () => clearTimeout(id);
  }, [refusal, onRefusalShown]);

  return (
    <div className="length-latch" role="radiogroup" aria-label="Note length">
      {LENGTHS.map(({ d, label }, i) => (
        <button
          key={refusal?.d === d ? `${d}-${refusal.n}` : d} // remount restarts the flash animation
          type="button"
          role="radio"
          aria-checked={value === d}
          className={['latch-button', 'chip', value === d && 'on', refusal?.d === d && 'flash'].filter(Boolean).join(' ')}
          onClick={() => onChange(d)}
          aria-label={`${label} (${i + 1})`}
          title={`${label} (${i + 1})`}
        >
          <NoteIcon d={d} />
          <span className="latch-key">{i + 1}</span>
        </button>
      ))}
      <button
        type="button"
        aria-pressed={rest}
        className={['latch-button', 'chip', 'rest-latch', rest && 'on'].filter(Boolean).join(' ')}
        onClick={onToggleRest}
        title="Rest latch: length keys insert rests (R)"
        aria-label="Rest (R)"
      >
        <RestIcon />
        <span className="latch-key">R</span>
      </button>
      <p className="latch-message" role="status" aria-live="polite">
        {refusal?.message ?? ''}
      </p>
    </div>
  );
}
