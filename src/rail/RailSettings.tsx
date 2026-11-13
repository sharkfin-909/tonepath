// Control-rail settings (SPEC §3.1): inline title rename, time signature, bars per row, Clear all, caret readout.
import { useRef, useState } from 'react';
import { parseTimeSignature } from '../form';
import { BARS_PER_ROW } from '../progression';

/**
 * Text shown as a button; click to edit in place. Enter / blur commits, Esc cancels. While it is open, the app's
 * shortcuts are ignored (it is a text field, SPEC §11).
 */
function InlineField({
  value,
  label,
  className,
  onCommit,
  startEditing = false,
}: {
  value: string;
  label: string;
  className: string;
  onCommit: (text: string) => void;
  /** Open in edit mode (a New progression opens with its title in edit, SPEC §3.5). */
  startEditing?: boolean;
}) {
  const [editing, setEditing] = useState(startEditing);
  const done = useRef(false);
  if (!editing) {
    return (
      <button type="button" className={`inline-value ${className}`} title={`${label} (click to edit)`} onClick={() => {
        done.current = false;
        setEditing(true);
      }}>
        {value || ' '}
      </button>
    );
  }
  const finish = (text: string | null) => {
    if (done.current) return; // Enter then the blur from unmounting
    done.current = true;
    setEditing(false);
    if (text !== null) onCommit(text);
  };
  return (
    <input
      className={`inline-field ${className}`}
      aria-label={label}
      defaultValue={value}
      autoFocus
      spellCheck={false}
      autoComplete="off"
      onFocus={(e) => e.currentTarget.select()}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          finish(e.currentTarget.value);
        } else if (e.key === 'Escape') {
          e.preventDefault();
          finish(null);
        }
      }}
      onBlur={(e) => finish(e.currentTarget.value)}
    />
  );
}

export function TitleField({ title, onRename, editing = false }: { title: string; onRename: (text: string) => void; editing?: boolean }) {
  return <InlineField value={title} label="Title" className="rail-title" onCommit={onRename} startEditing={editing} />;
}

/** Stored and shown exactly as typed; an unparseable one lays out as 4/4 and says so. */
export function TimeSignatureField({ value, onChange }: { value: string; onChange: (text: string) => void }) {
  const bad = !parseTimeSignature(value);
  return (
    <div className="rail-setting">
      <span className="rail-label">Time</span>
      <InlineField value={value} label="Time signature" className={bad ? 'time-sig bad' : 'time-sig'} onCommit={onChange} />
      {bad && <span className="rail-note">laid out as 4/4</span>}
    </div>
  );
}

export function BarsPerRow({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <label className="rail-setting">
      <span className="rail-label">Bars / row</span>
      <select className="rail-select" value={value} onChange={(e) => onChange(Number(e.target.value))}>
        {BARS_PER_ROW.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
      </select>
    </label>
  );
}

export function ClearAll({ disabled, onClear }: { disabled: boolean; onClear: () => void }) {
  return (
    <button type="button" className="rail-button clear-all" disabled={disabled} title="Clear the melody (undoable)" onClick={onClear}>
      Clear all
    </button>
  );
}

/** Readout of the caret's bar, chord and scale. */
export function CaretReadout({ bar, chord, scale }: { bar: number; chord: string; scale: string }) {
  return (
    <dl className="caret-readout" aria-live="polite">
      <dt>Bar</dt>
      <dd>{bar}</dd>
      <dt>Chord</dt>
      <dd>{chord || '—'}</dd>
      <dt>Scale</dt>
      <dd>{scale}</dd>
    </dl>
  );
}
