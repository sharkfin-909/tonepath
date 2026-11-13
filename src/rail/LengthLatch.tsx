// Length latch in the control rail (SPEC §3.1, §6.2 item 6): `1 · whole` … `5 · 16th`, stacked; keys 1–5;
// and the Rest latch (`R`): while on, a length button sets the latch and inserts a rest (handled by onChange).
// A refused insert flashes the latched button with a short message (SPEC §6.2 item 3).
import { useEffect } from 'react';
import type { Duration } from '../progression';

const LENGTHS: { d: Duration; label: string }[] = [
  { d: 'w', label: 'whole' },
  { d: 'h', label: 'half' },
  { d: 'q', label: 'quarter' },
  { d: 'e', label: '8th' },
  { d: 's', label: '16th' },
];

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
          className={['latch-button', value === d && 'on', refusal?.d === d && 'flash'].filter(Boolean).join(' ')}
          onClick={() => onChange(d)}
        >
          <span className="latch-key">{i + 1}</span> · {label}
        </button>
      ))}
      <button
        type="button"
        aria-pressed={rest}
        className={['latch-button', 'rest-latch', rest && 'on'].filter(Boolean).join(' ')}
        onClick={onToggleRest}
        title="Rest latch: length keys insert rests"
      >
        <span className="latch-key">R</span> · Rest
      </button>
      <p className="latch-message" role="status" aria-live="polite">
        {refusal?.message ?? ''}
      </p>
    </div>
  );
}
