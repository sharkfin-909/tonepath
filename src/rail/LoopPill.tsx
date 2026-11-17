// The loop pill (SPEC §3.7): grid improv (by notes or in time), ins improv, ins read — Loop (round again at the end, or
// stop), *whole form* (on: the whole form; off: the looped bars), and the bar pickers `bars [first ▾] – [last ▾]`,
// always there (so the pill never changes width) but greyed while *whole form* is on. The looped bars are the bar selection: picked here or by bar numbers on the chart.
import { useEffect, useState } from 'react';
import { Dropdown } from './Dropdown';

/** Loop: a switch with a loop icon — on, the form (or the looped bars) goes round again; off, it stops at the end. */
export function LoopSwitch({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label="Loop"
      className={on ? 'switch chip transport-loop on' : 'switch chip transport-loop'}
      title={on ? 'Loop: round again at the end' : 'Loop off: stop at the end'}
      onClick={() => onChange(!on)}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden className="transport-loop-icon">
        <path d="M3 7.5V6a2 2 0 0 1 2-2h7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M10 2l2.2 2L10 6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M13 8.5V10a2 2 0 0 1-2 2H4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M6 14l-2.2-2L6 10" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="switch-track" aria-hidden>
        <span className="switch-knob" />
      </span>
    </button>
  );
}

export interface LoopPillProps {
  loop: boolean;
  onLoop: (on: boolean) => void;
  /** The looped bars (0-based, inclusive), or null: the whole form. */
  bars: { from: number; to: number } | null;
  /** Back to the whole form (*whole form* on). */
  onWholeForm: () => void;
  /** How many bars the form has: the pickers' choices. */
  barCount: number;
  /** Loop bars `from`–`to` (0-based, inclusive). */
  onPickBars: (from: number, to: number) => void;
}

export function LoopPill({ loop, onLoop, bars, onWholeForm, barCount, onPickBars }: LoopPillProps) {
  /** *Whole form* switched off with no bars picked yet: the pickers wait, empty. */
  const [picking, setPicking] = useState(false);
  /** The first bar picked while waiting for the last. */
  const [draftFrom, setDraftFrom] = useState<number | null>(null);
  // Bars looped from anywhere (the pickers, or bar numbers on the chart) end the wait: clearing them later is the whole
  // form again.
  useEffect(() => {
    if (bars) setPicking(false);
  }, [bars]);
  const whole = !bars && !picking;
  const from = bars?.from ?? draftFrom;
  const to = bars?.to ?? null;
  const all = Array.from({ length: barCount }, (_, i) => ({ value: i, label: String(i + 1) }));
  return (
    <div className="loop-pill pill">
      <LoopSwitch on={loop} onChange={onLoop} />
      <button
        type="button"
        role="switch"
        aria-checked={whole}
        aria-label="Whole form"
        className={whole ? 'switch chip loop-whole on' : 'switch chip loop-whole'}
        title={whole ? 'The whole form (switch off to pick bars)' : 'Looped bars: back to the whole form'}
        onClick={() => {
          setDraftFrom(null);
          if (whole) setPicking(true);
          else {
            setPicking(false);
            if (bars) onWholeForm();
          }
        }}
      >
        <span className="pill-label">whole form</span>
        <span className="switch-track" aria-hidden>
          <span className="switch-knob" />
        </span>
      </button>
      <span className={whole ? 'transport-bars picking off' : 'transport-bars picking'}>
        <span className="pill-label">bars</span>
        <Dropdown
          label="First looped bar"
          value={whole ? -1 : (from ?? -1)}
          placeholder="–"
          disabled={whole}
          options={all}
          onChange={(f) => {
            if (to !== null) onPickBars(f, Math.max(f, to)); // looping: move the first bar (the last follows if need be)
            else setDraftFrom(f);
          }}
        />
        <span className="pill-label">–</span>
        <Dropdown
          label="Last looped bar"
          value={whole ? -1 : (to ?? -1)}
          placeholder="–"
          disabled={whole}
          options={from === null ? all : all.slice(from)}
          onChange={(t) => {
            setDraftFrom(null);
            setPicking(false);
            onPickBars(from ?? t, t);
          }}
        />
      </span>
    </div>
  );
}
