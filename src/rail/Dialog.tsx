// A dialog over the chart, in the library's look (SPEC §3.1): a title and ×, content below. It takes focus, so keys go
// to it and never reach the chart behind; Esc, × or a click on the backdrop closes it. Used by Help and Keyboard
// shortcuts (the library has its own, with its header tools).
import { useEffect, useRef, type ReactNode } from 'react';

export interface DialogProps {
  title: string;
  onClose: () => void;
  /** Extra class on the panel (its width, its content's styles). */
  className?: string;
  children: ReactNode;
}

export function Dialog({ title, onClose, className, children }: DialogProps) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus({ preventScroll: true });
  }, []);
  return (
    <div
      className="library-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose(); // the backdrop
      }}
    >
      <div
        ref={panel}
        className={['library', className].filter(Boolean).join(' ')}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={(e) => {
          e.stopPropagation(); // the chart's keys stay out
          if (e.key === 'Escape') {
            e.preventDefault();
            onClose();
          }
        }}
      >
        <header className="library-header">
          <h1>{title}</h1>
          <button type="button" className="library-close" title="Close (Esc)" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
              <path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
