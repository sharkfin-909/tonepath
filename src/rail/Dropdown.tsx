// The app's dropdown (SPEC §3.1): every choice in the header — Mode, Audio on chord, bars per row, click sound, clef,
// instrument. A button showing the value opens a dark card under it. Options
// with descriptions or tags get the rich layout (the mode menu); plain ones a compact list. The current value is
// marked (accent bar, ✓).
// Keyboard: ↑ / ↓ / Home / End move, a letter jumps to the next option starting with it, Enter / Space choose,
// Esc / Tab close. Keys pressed in the menu never reach the chart's keymap. A press outside closes it.
import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

export interface DropdownOption<T extends string | number> {
  value: T;
  label: string;
  /** Rich layout: a line or two under the label. */
  description?: string;
  /** Rich layout: small tags after the label. */
  tags?: string[];
  /** Muted text after the label (compact layout too), e.g. an etude's instrument. */
  hint?: string;
  /** A line above this option: it starts a new section (e.g. the etude picker's actions). */
  divider?: boolean;
  /** Its label is shown as typed (not lowercased with the group). */
  asTyped?: boolean;
  /** A small icon before the label, in the menu and on the button (the modes). */
  icon?: ReactNode;
}

export interface DropdownProps<T extends string | number> {
  value: T;
  options: DropdownOption<T>[];
  onChange: (value: T) => void;
  /** The accessible name (e.g. "Instrument"). */
  label: string;
  disabled?: boolean;
  /** Shown on the button while `value` matches no option (e.g. "–": nothing picked yet). */
  placeholder?: string;
  /** Extra class on the wrapper. */
  className?: string;
  /** Under the options (e.g. the mode menu's keys). */
  footer?: ReactNode;
}

export function Dropdown<T extends string | number>({ value, options, onChange, label, disabled = false, placeholder = '', className, footer }: DropdownProps<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [alignRight, setAlignRight] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();
  const rich = options.some((o) => o.description || o.tags?.length);
  const found = options.findIndex((o) => o.value === value);
  const currentIndex = Math.max(0, found);
  const current = found >= 0 ? options[found] : undefined;

  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);

  // Opening highlights the current value and takes focus (arrow keys work at once); a press outside closes it.
  useEffect(() => {
    if (!open) return;
    setActive(currentIndex);
    list.current?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open only
  }, [open]);

  // The card opens under the button, left-aligned — or right-aligned when it would run off the screen.
  useLayoutEffect(() => {
    if (!open || !menu.current || !button.current) return;
    const b = button.current.getBoundingClientRect();
    setAlignRight(b.left + menu.current.offsetWidth > window.innerWidth - 16);
  }, [open]);

  // Keep the highlighted option in view (long lists scroll).
  useEffect(() => {
    if (open) list.current?.children[active]?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const choose = (i: number) => {
    setOpen(false);
    if (options[i].value !== value) onChange(options[i].value);
  };

  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation(); // the chart's keys (arrows, Space, [ ]) stay out of the menu
    const last = options.length - 1;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.min(last, Math.max(0, a + (e.key === 'ArrowDown' ? 1 : -1))));
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : last);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
      button.current?.focus();
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      setOpen(false);
      button.current?.focus();
    } else if (e.key.length === 1 && /\S/.test(e.key) && !e.metaKey && !e.ctrlKey) {
      // Type to jump: the next option whose label starts with the letter.
      const k = e.key.toLowerCase();
      for (let n = 1; n <= options.length; n++) {
        const i = (active + n) % options.length;
        if (options[i].label.toLowerCase().startsWith(k)) {
          setActive(i);
          break;
        }
      }
    }
  };

  return (
    <div className={['dropdown', className].filter(Boolean).join(' ')} ref={wrap}>
      <button
        ref={button}
        type="button"
        className="dropdown-trigger chip chip--filled"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`${label}: ${current?.label ?? 'none'}`}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {current?.icon}
        <span className={current?.asTyped ? 'dropdown-value as-typed' : 'dropdown-value'}>{current?.label ?? placeholder}</span>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden className={open ? 'dropdown-caret up' : 'dropdown-caret'}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div ref={menu} className={['dropdown-menu', rich ? 'rich' : 'compact', alignRight && 'right'].filter(Boolean).join(' ')}>
          <ul ref={list} id={id} role="listbox" aria-label={label} aria-activedescendant={`${id}-${active}`} tabIndex={-1} onKeyDown={onKey}>
            {options.map((o, i) => (
              <li
                key={String(o.value)}
                id={`${id}-${i}`}
                role="option"
                aria-selected={o.value === value}
                className={['dropdown-option', i === active && 'active', o.value === value && 'current', o.divider && 'divider', o.asTyped && 'as-typed'].filter(Boolean).join(' ')}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="dropdown-option-head">
                  {o.icon}
                  <span className="dropdown-option-name">{o.label}</span>
                  {o.hint && <span className="dropdown-option-hint">{o.hint}</span>}
                  {o.tags?.map((t) => (
                    <span key={t} className="dropdown-tag">
                      {t}
                    </span>
                  ))}
                  {o.value === value && (
                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="dropdown-check">
                      <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                {o.description && <span className="dropdown-option-blurb">{o.description}</span>}
              </li>
            ))}
          </ul>
          {footer && <p className="dropdown-footer">{footer}</p>}
        </div>
      )}
    </div>
  );
}
