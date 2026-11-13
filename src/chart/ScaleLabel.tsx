// The slot's scale label under the chord, which opens the scale override menu (SPEC §4.2, §5.2).
import { useEffect, useRef, useState } from 'react';
import { SCALES, scaleLabel, type ScaleId, type SlotHarmony } from '../harmony';

export interface ScaleLabelProps {
  harmony: SlotHarmony;
  bar: number;
  /** Write-mode editing; when absent the label is read-only. */
  onPick?: (scale: ScaleId | null) => void;
}

export function ScaleLabel({ harmony: h, bar, onPick }: ScaleLabelProps) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        wrap.current?.querySelector<HTMLButtonElement>('.scale-label')?.focus();
      }
    };
    document.addEventListener('pointerdown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (h.kind === 'none') return <span className="scale-label-wrap" />;
  if (!h.scale) {
    return (
      <span className="scale-label-wrap">
        <span className="scale-label none" title="No scale contains every chord tone">
          no scale fits
        </span>
      </span>
    );
  }

  const label = scaleLabel(h.root, h.scale);
  const pick = (id: ScaleId) => {
    setOpen(false);
    onPick?.(id === h.candidates[0] ? null : id);
  };

  return (
    <span className="scale-label-wrap" ref={wrap}>
      <button
        type="button"
        className="scale-label"
        title={label}
        disabled={!onPick}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Scale ${label}${h.overridden ? ' (override)' : ''}, bar ${bar + 1}. Change scale`}
        onClick={() => setOpen((o) => !o)}
      >
        {label}
      </button>
      {open && (
        <span className="scale-menu" role="menu" aria-label={`Scale for bar ${bar + 1}`}>
          {h.candidates.map((id, i) => (
            <button
              key={id}
              type="button"
              role="menuitemradio"
              aria-checked={id === h.scale}
              className="scale-option"
              autoFocus={id === h.scale}
              onClick={() => pick(id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
                e.preventDefault();
                const items = [...(e.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>('.scale-option') ?? [])];
                const next = items[(items.indexOf(e.currentTarget) + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length];
                next?.focus();
              }}
            >
              <span className="scale-check" aria-hidden>
                {id === h.scale ? '✓' : ''}
              </span>
              {h.root} {SCALES[id].name}
              {i === 0 && <span className="scale-default"> · default</span>}
            </button>
          ))}
        </span>
      )}
    </span>
  );
}
