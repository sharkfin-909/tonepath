// In-place chord-symbol entry (SPEC §4.2). Enter / Tab → next slot, ⇧Tab → previous, Esc cancels.
import { useEffect, useRef } from 'react';

export interface ChordFieldProps {
  initial: string;
  /** Inline message after a refused commit (the field stays open). */
  error: string | null;
  /** move: +1 next slot, -1 previous, null stop editing. Returns false if refused. */
  onCommit: (text: string, move: -1 | 1 | null) => boolean;
}

export function ChordField({ initial, error, onCommit }: ChordFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const finish = (text: string, move: -1 | 1 | null) => {
    if (done.current) return;
    done.current = true;
    if (!onCommit(text, move)) done.current = false; // refused: stay open for another try
  };

  return (
    <span className="chord-field-wrap">
      <input
        ref={ref}
        className="chord-field"
        defaultValue={initial}
        spellCheck={false}
        autoComplete="off"
        aria-label="Chord symbol"
        onKeyDown={(e) => {
          if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault();
            finish(e.currentTarget.value, 1);
          } else if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            finish(e.currentTarget.value, -1);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            finish(initial, null);
          }
        }}
        onBlur={(e) => finish(e.currentTarget.value, null)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'chord-field-error' : undefined}
      />
      {error && (
        <span id="chord-field-error" className="chord-field-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
