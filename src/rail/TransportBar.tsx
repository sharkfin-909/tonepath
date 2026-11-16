// The transport bar (SPEC §3.7): Improvise's and Read etude's — tempo, the click sound, rewind, start / stop, Loop, then
// the looped bars' chip (× for the whole form). It *is* the metronome: there is no switch, and nothing played moves
// the form on.
import { useEffect, useState } from 'react';
import { BPM, METRONOME_SOUNDS } from '../metronome';
import type { ClickSound } from '../audio';
import { Dropdown } from './Dropdown';

export interface TransportBarProps {
  bpm: number;
  onBpm: (bpm: number) => void;
  sound: ClickSound;
  onSound: (sound: ClickSound) => void;
  running: boolean;
  onStartStop: () => void;
  onRewind: () => void;
  loop: boolean;
  onLoop: (on: boolean) => void;
  /** The looped bars (0-based, inclusive), or null (the whole form); × goes back to the whole form. */
  bars: { from: number; to: number } | null;
  onAllBars: () => void;
  /** Read etude only: show scale names above each chord. */
  showScales?: boolean;
  onShowScales?: (on: boolean) => void;
}

/**
 * The tempo field: type freely (no clamping mid-number — "1" on the way to "120" stays "1"); Enter or leaving the
 * field applies it (30–300), Esc puts the current tempo back. ↑ / ↓ step by one and apply at once.
 */
function BpmField({ bpm, onBpm }: { bpm: number; onBpm: (n: number) => void }) {
  const [draft, setDraft] = useState(String(bpm));
  useEffect(() => setDraft(String(bpm)), [bpm]);
  const apply = () => {
    const n = Number(draft);
    if (draft.trim() !== '' && Number.isFinite(n)) onBpm(n);
    setDraft(String(bpm)); // shows the applied (clamped) tempo once the parent updates; unchanged if invalid
  };
  return (
    <input
      className="transport-bpm"
      type="text"
      inputMode="numeric"
      value={draft}
      aria-label="Tempo (bpm)"
      onChange={(e) => setDraft(e.target.value.replace(/[^0-9]/g, '').slice(0, 3))}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={apply}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur();
        else if (e.key === 'Escape') {
          setDraft(String(bpm));
          e.currentTarget.blur();
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          onBpm(bpm + (e.key === 'ArrowUp' ? 1 : -1));
        }
      }}
    />
  );
}

const icon = (d: string) => (
  <svg viewBox="0 0 12 12" width="14" height="14" aria-hidden>
    <path d={d} fill="currentColor" />
  </svg>
);

export function TransportBar({
  bpm,
  onBpm,
  sound,
  onSound,
  running,
  onStartStop,
  onRewind,
  loop,
  onLoop,
  bars,
  onAllBars,
  showScales,
  onShowScales,
}: TransportBarProps) {
  return (
    <div className="transport-bar group">
      <label className="transport-field" title={`Tempo, in beats per minute (${BPM.min}–${BPM.max})`}>
        <BpmField bpm={bpm} onBpm={onBpm} />
        <span className="transport-label">bpm</span>
      </label>
      <Dropdown value={sound} label="Click sound" options={METRONOME_SOUNDS.map((s) => ({ value: s.id, label: s.label }))} onChange={onSound} />
      <span className="step-controls">
        <button type="button" className="rail-button icon-button" aria-label="Rewind" title="Rewind to the first chord" onClick={onRewind}>
          {icon('M2 2h1.6v8H2zM10 2v8L4 6z')}
        </button>
        <button
          type="button"
          className="rail-button icon-button"
          aria-label={running ? 'Stop' : 'Start'}
          title={running ? 'Stop' : 'Start from this chord'}
          onClick={onStartStop}
        >
          {running ? icon('M3 3h6v6H3z') : icon('M3.5 2v8L10 6z')}
        </button>
      </span>
      {/* Loop: a switch with a loop icon — on, the form (or the looped bars) goes round again; off, it stops at the end. */}
      <button
        type="button"
        role="switch"
        aria-checked={loop}
        aria-label="Loop"
        className={loop ? 'switch transport-loop on' : 'switch transport-loop'}
        title={bars ? 'Loop: round the looped bars again at their end' : 'Loop: round the form again at its end (click bar numbers to loop just them)'}
        onClick={() => onLoop(!loop)}
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
      {onShowScales && (
        <button
          type="button"
          role="switch"
          aria-checked={!!showScales}
          aria-label="Show scales"
          className={showScales ? 'switch transport-scales on' : 'switch transport-scales'}
          title={showScales ? 'Hide scale names above each chord' : 'Show scale names above each chord'}
          onClick={() => onShowScales(!showScales)}
        >
          <span className="transport-scales-label">scales</span>
          <span className="switch-track" aria-hidden>
            <span className="switch-knob" />
          </span>
        </button>
      )}
      {/* The loop status: always there at a fixed width, so the bar never changes length — "whole form", or the looped
          bars with × (back to the whole form). */}
      <span className={bars ? 'transport-bars looping' : 'transport-bars'} role="status">
        <span className="transport-bars-text">{!bars ? 'whole form' : bars.from === bars.to ? `bar ${bars.from + 1}` : `bars ${bars.from + 1}–${bars.to + 1}`}</span>
        {bars && (
          <button type="button" className="transport-bars-clear" aria-label="Loop the whole form" title="Loop the whole form" onClick={onAllBars}>
            ×
          </button>
        )}
      </span>
    </div>
  );
}
