// Control-rail settings (SPEC §3.1): inline title rename, time signature, bars per row, Clear all, caret readout.
import { useEffect, useRef, useState } from 'react';
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

/**
 * Clear ▾ (SPEC §6.2 item 10): a menu with **Clear notes** (the melody; undoable, no confirm) and **Clear all…**
 * (chords, scales and notes; asks for confirmation in the menu first). Both are one undo step.
 */
export function ClearMenu({ canClearNotes, canClearAll, onClearNotes, onClearAll }: { canClearNotes: boolean; canClearAll: boolean; onClearNotes: () => void; onClearAll: () => void }) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const close = () => {
    setOpen(false);
    setConfirming(false);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);
  return (
    <div className="clear-menu-wrap" ref={wrap}>
      <button
        type="button"
        className="rail-button clear-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={!canClearNotes && !canClearAll}
        onClick={() => (open ? close() : setOpen(true))}
      >
        Clear ▾
      </button>
      {open && (
        <div className="clear-menu" role="menu" aria-label="Clear">
          {confirming ? (
            <div className="clear-confirm" role="alertdialog" aria-label="Clear all">
              <p>Clear all chords, scales and notes?</p>
              <div className="clear-confirm-actions">
                <button type="button" className="clear-menu-item danger" onClick={() => (onClearAll(), close())}>
                  Clear all
                </button>
                <button type="button" className="clear-menu-item" onClick={close}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <button type="button" role="menuitem" className="clear-menu-item" disabled={!canClearNotes} onClick={() => (onClearNotes(), close())}>
                Clear notes
              </button>
              <button type="button" role="menuitem" className="clear-menu-item" disabled={!canClearAll} onClick={() => setConfirming(true)}>
                Clear all…
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
