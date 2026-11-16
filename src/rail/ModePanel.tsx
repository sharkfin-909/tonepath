// The mode panel (SPEC §3.0, §3.1): top right of the header, a group — a button showing the mode, opening a menu of
// the four modes (Tuner · Improvise · Write etude · Read etude), each with what it is for, what it uses (mic,
// transport) and the keys to switch. The mode alone decides whether the mic listens (no Audio input switch).
// Keyboard: ↑ / ↓ move, Enter / Space choose, Esc / Tab close; keys pressed in the menu never reach the chart's keymap.
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { MODES, MODE_LABELS, type Mode } from '../session';

/** What each mode is for, and what it uses (SPEC §3.0). */
export const MODE_INFO: Record<Mode, { blurb: string; uses: string[] }> = {
  tuner: {
    blurb: 'Warm up and tune. The hex lights every note you play; no chart, no chords. Every open starts here.',
    uses: ['mic'],
  },
  improvise: {
    blurb: 'Play over the changes. A lead sheet with empty staves; the transport keeps time and the hex rings the next chord. Stop it to step chords by hand or edit them.',
    uses: ['mic', 'transport'],
  },
  write: {
    blurb: 'Write your line. Pick notes on the hex at the caret; set lengths and rests, edit bars, step through what you wrote.',
    uses: [],
  },
  read: {
    blurb: 'Play the etude. Every bar on one page, a click and a moving playhead; nothing to edit — made for a music stand.',
    uses: ['transport'],
  },
};

export interface ModePanelProps {
  mode: Mode;
  onMode: (mode: Mode) => void;
}

export function ModePanel({ mode, onMode }: ModePanelProps) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Mode>(mode);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const id = useId();

  // Opening highlights the current mode and takes focus, so the arrow keys work at once; a press outside closes it.
  useEffect(() => {
    if (!open) return;
    setActive(mode);
    list.current?.focus();
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset on open only
  }, [open]);

  const choose = (m: Mode) => {
    setOpen(false);
    onMode(m);
  };

  const onKey = (e: KeyboardEvent) => {
    e.stopPropagation(); // the chart's keys (arrows, Space, [ ]) stay out of the menu
    const i = MODES.indexOf(active);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setActive(MODES[Math.min(MODES.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))]);
    } else if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(MODES[e.key === 'Home' ? 0 : MODES.length - 1]);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(active);
    } else if (e.key === 'Escape' || e.key === 'Tab') {
      if (e.key === 'Escape') e.preventDefault();
      setOpen(false);
      button.current?.focus();
    }
  };

  return (
    <div className="mode-panel group mode-picker" ref={wrap}>
      <button
        ref={button}
        type="button"
        className="mode-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-label={`Mode: ${MODE_LABELS[mode]}`}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="ins-label">Mode:</span>
        <span className="mode-current">{MODE_LABELS[mode]}</span>
        <svg viewBox="0 0 12 12" width="10" height="10" aria-hidden className={open ? 'mode-caret up' : 'mode-caret'}>
          <path d="M2.5 4.5 6 8l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="mode-menu">
          <ul
            ref={list}
            id={id}
            role="listbox"
            aria-label="Mode"
            aria-activedescendant={`${id}-${active}`}
            tabIndex={-1}
            onKeyDown={onKey}
          >
            {MODES.map((m) => (
              <li
                key={m}
                id={`${id}-${m}`}
                role="option"
                aria-selected={m === mode}
                className={['mode-option', m === active && 'active', m === mode && 'current'].filter(Boolean).join(' ')}
                onPointerEnter={() => setActive(m)}
                onClick={() => choose(m)}
              >
                <span className="mode-option-head">
                  <span className="mode-option-name">{MODE_LABELS[m]}</span>
                  {MODE_INFO[m].uses.map((u) => (
                    <span key={u} className="mode-tag">
                      {u}
                    </span>
                  ))}
                  {m === mode && (
                    <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden className="mode-check">
                      <path d="M2.5 6.5 5 9l4.5-6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </span>
                <span className="mode-option-blurb">{MODE_INFO[m].blurb}</span>
              </li>
            ))}
          </ul>
          <p className="mode-menu-keys">
            <kbd>[</kbd> <kbd>]</kbd> previous / next mode · <kbd>\</kbd> write ↔ read
          </p>
        </div>
      )}
    </div>
  );
}
