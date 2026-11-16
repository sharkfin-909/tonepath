// The four modes' icons (SPEC §3.0): small line drawings in the text colour, 16 × 16. Tune: a tuner's gauge and
// needle. Improvise: a free line with a spark. Write etude: a pencil. Read etude: a page with a note on it.
import type { Mode } from '../session';

export function ModeIcon({ mode, size = 14 }: { mode: Mode; size?: number }) {
  return (
    <svg
      className="mode-icon"
      viewBox="0 0 16 16"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {mode === 'tune' && (
        <>
          <path d="M2.5 12.5a5.5 5.5 0 0 1 11 0" />
          <path d="M8 12.5 10.6 6.8" />
          <path d="M8 5.2V4.2M4.1 8.6l-.7-.7M11.9 8.6l.7-.7" />
          <circle cx="8" cy="12.5" r="0.9" fill="currentColor" stroke="none" />
        </>
      )}
      {mode === 'improvise' && (
        <>
          <path d="M1.5 11.5c1.6-3.2 3-3.2 4.2-.6s2.7 2.6 4.1-.9" />
          <path d="M12.5 2.5v4M10.5 4.5h4" />
        </>
      )}
      {mode === 'write' && (
        <>
          <path d="M3 13l.9-3.1L10.7 3.1a1.4 1.4 0 0 1 2 0l.2.2a1.4 1.4 0 0 1 0 2L6.1 12.1z" />
          <path d="M9.6 4.2l2.2 2.2" />
        </>
      )}
      {mode === 'read' && (
        <>
          <path d="M4 1.8h5.5L12.5 4.8v9.4H4z" />
          <path d="M9.5 1.8v3h3" />
          <ellipse cx="7.1" cy="11.3" rx="1.3" ry="1" fill="currentColor" stroke="none" />
          <path d="M8.3 11.1V7l1.9.8" strokeWidth={1.2} />
        </>
      )}
    </svg>
  );
}
