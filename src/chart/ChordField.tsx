// In-place chord-symbol entry (SPEC §4.2). Enter / Tab → next slot, ⇧Tab → previous, Esc cancels.
// Autosuggest: completions for the symbol being typed; ↑ / ↓ pick one, Enter / Tab take it, a click takes it.
import { useEffect, useRef, useState } from 'react';
import { acceptSuggestion, capitaliseRoots, suggestChords } from '../chordSuggest';

export interface ChordFieldProps {
  initial: string;
  /** Inline message after a refused commit (the field stays open). */
  error: string | null;
  /** move: +1 next slot, -1 previous, null stop editing. Returns false if refused. */
  onCommit: (text: string, move: -1 | 1 | null) => boolean;
  /** Chords already in the progression (written): suggested first. */
  used?: string[];
  /** The key's simple chords (written): listed while the field is empty, first for a typed root. */
  inKey?: string[];
}

export function ChordField({ initial, error, onCommit, used = [], inKey = [] }: ChordFieldProps) {
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  const [value, setValue] = useState(initial);
  // The list opens once the user types (or at once, empty, with the key's chords), and closes on Esc or after a commit.
  const [open, setOpen] = useState(initial === ''); // an empty field lists the key's chords straight away
  const [index, setIndex] = useState(-1);

  useEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);

  const { from, items } = open ? suggestChords(value, used, 8, inKey) : { from: 0, items: [] };
  const showList = items.length > 0;

  const finish = (text: string, move: -1 | 1 | null) => {
    if (done.current) return;
    done.current = true;
    setOpen(false);
    setIndex(-1);
    if (!onCommit(text, move)) done.current = false; // refused: stay open for another try
  };

  /** The text to commit: the highlighted suggestion in place of the token, else what was typed. */
  const chosen = (text: string) => (showList && index >= 0 ? acceptSuggestion(text, from, items[index].symbol) : text);

  return (
    <span className="chord-field-wrap">
      <input
        ref={ref}
        className="chord-field"
        value={value}
        spellCheck={false}
        autoComplete="off"
        aria-label="Chord symbol"
        role="combobox"
        aria-expanded={showList}
        aria-controls="chord-suggest"
        aria-autocomplete="list"
        aria-activedescendant={showList && index >= 0 ? `chord-suggest-${index}` : undefined}
        onChange={(e) => {
          // Root letters capitalised as typed; the caret stays put (same length).
          const input = e.currentTarget;
          const fixed = capitaliseRoots(input.value);
          if (fixed !== input.value) {
            const at = input.selectionStart;
            input.value = fixed;
            input.setSelectionRange(at, at);
          }
          setValue(fixed);
          setOpen(true);
          setIndex(-1);
        }}
        onKeyDown={(e) => {
          if (showList && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
            e.preventDefault();
            const n = items.length;
            setIndex((i) => (e.key === 'ArrowDown' ? (i + 1) % n : i <= 0 ? n - 1 : i - 1));
          } else if (e.key === 'Enter' || (e.key === 'Tab' && !e.shiftKey)) {
            e.preventDefault();
            finish(chosen(e.currentTarget.value), 1);
          } else if (e.key === 'Tab' && e.shiftKey) {
            e.preventDefault();
            finish(chosen(e.currentTarget.value), -1);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            if (showList) {
              setOpen(false); // first Esc closes the list
              setIndex(-1);
            } else finish(initial, null);
          }
        }}
        onBlur={(e) => finish(e.currentTarget.value, null)}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? 'chord-field-error' : undefined}
      />
      {showList && (
        <ul id="chord-suggest" className="chord-suggest" role="listbox" aria-label="Chord suggestions">
          {items.map((item, i) => (
            <li
              key={item.symbol}
              id={`chord-suggest-${i}`}
              role="option"
              aria-selected={i === index}
              className={i === index ? 'selected' : undefined}
              // mousedown, not click: keeps the input from blurring (and committing what was typed) first
              onMouseDown={(e) => {
                e.preventDefault();
                finish(acceptSuggestion(value, from, item.symbol), null);
              }}
              onMouseEnter={() => setIndex(i)}
            >
              <span className="chord-suggest-symbol">{item.symbol}</span>
              <span className="chord-suggest-tones">{item.tones}</span>
            </li>
          ))}
        </ul>
      )}
      {error && !showList && (
        <span id="chord-field-error" className="chord-field-error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}
