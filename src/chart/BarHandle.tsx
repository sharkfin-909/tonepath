// Bar number + ⋯ bar handle (SPEC §4.1, Write only): click the number to select the bar (⇧ extends to a run);
// ⋯ opens the bar menu. The handle shows on the active bar and on hover.
import { useEffect, useRef, useState } from 'react';

import type { BarAction } from '../bars';
export type { BarAction };

export interface BarHandleProps {
  bar: number;
  selected: boolean;
  split: boolean;
  canPaste: boolean;
  canDelete: boolean;
  onSelect: (bar: number, extend: boolean) => void;
  onAction: (bar: number, action: BarAction) => void;
}

export function BarHandle({ bar, selected, split, canPaste, canDelete, onSelect, onAction }: BarHandleProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: { action: BarAction; label: string; keys?: string; disabled?: boolean }[] = [
    { action: 'insert-before', label: 'Insert before' },
    { action: 'insert-after', label: 'Insert after' },
    { action: 'duplicate', label: 'Duplicate', keys: '⌘D' },
    { action: 'copy', label: 'Copy', keys: '⌘C' },
    { action: 'paste', label: 'Paste', keys: '⌘V', disabled: !canPaste },
    split ? { action: 'merge', label: 'Merge halves' } : { action: 'split', label: 'Split in two' },
    { action: 'delete', label: 'Delete', keys: '⌫', disabled: !canDelete },
  ];
  const run = (a: BarAction) => {
    setOpen(false);
    onAction(bar, a);
  };

  return (
    <span className={['bar-handle', selected && 'selected', open && 'open'].filter(Boolean).join(' ')} ref={wrap}>
      <button
        type="button"
        className="bar-number"
        aria-pressed={selected}
        aria-label={`Bar ${bar + 1}: select (shift-click to extend)`}
        onClick={(e) => onSelect(bar, e.shiftKey)}
      >
        {bar + 1}
      </button>
      <button
        type="button"
        className="bar-menu-button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Bar ${bar + 1} menu`}
        onClick={() => setOpen((o) => !o)}
      >
        ⋯
      </button>
      {open && (
        <span className="bar-menu" role="menu" aria-label={`Bar ${bar + 1}`}>
          {items.map((it, i) => (
            <button
              key={it.action}
              type="button"
              role="menuitem"
              className="bar-menu-item"
              disabled={it.disabled}
              autoFocus={i === 0}
              onClick={() => run(it.action)}
            >
              {it.label}
              {it.keys && <span className="bar-menu-keys">{it.keys}</span>}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
