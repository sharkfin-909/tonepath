// The transport bar (SPEC §3.7): tempo, the click sound, rewind, start / stop (Space) — and, in edit progression
// only, Loop. The practice modes keep Loop and the looped bars in their own pill (`LoopPill.tsx`). It *is* the
// metronome: there is no switch, and nothing played moves the form on.
import { useEffect, useState } from 'react';
import { BPM, METRONOME_SOUNDS } from '../metronome';
import type { ClickSound } from '../audio';
import { Dropdown } from './Dropdown';
import { LoopSwitch } from './LoopPill';

export interface TransportBarProps {
  bpm: number;
  onBpm: (bpm: number) => void;
  sound: ClickSound;
  onSound: (sound: ClickSound) => void;
  running: boolean;
  onStartStop: () => void;
  onRewind: () => void;
  /** Edit progression only: a plain Loop switch here (the practice modes have the loop pill, `LoopPill.tsx`). */
  loop?: { on: boolean; onChange: (on: boolean) => void };
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
  showScales,
  onShowScales,
}: TransportBarProps) {
  return (
    <div className="transport-bar pill">
      <label className="transport-field" title={`Tempo, in beats per minute (${BPM.min}–${BPM.max})`}>
        <BpmField bpm={bpm} onBpm={onBpm} />
        <span className="transport-label pill-label">bpm</span>
      </label>
      <Dropdown value={sound} label="Click sound" options={METRONOME_SOUNDS.map((s) => ({ value: s.id, label: s.label }))} onChange={onSound} />
      <span className="step-controls">
        <button type="button" className="rail-button chip chip--icon" aria-label="Rewind" title="Rewind to the first chord" onClick={onRewind}>
          {icon('M2 2h1.6v8H2zM10 2v8L4 6z')}
        </button>
        <button
          type="button"
          className="rail-button chip chip--icon"
          aria-label={running ? 'Stop' : 'Start'}
          title={running ? 'Stop' : 'Start from this chord'}
          onClick={onStartStop}
        >
          {running ? icon('M3 3h6v6H3z') : icon('M3.5 2v8L10 6z')}
        </button>
      </span>
      {loop && <LoopSwitch on={loop.on} onChange={loop.onChange} />}
      {onShowScales && (
        <button
          type="button"
          role="switch"
          aria-checked={!!showScales}
          aria-label="Show scales"
          className={showScales ? 'switch chip transport-scales on' : 'switch chip transport-scales'}
          title={showScales ? 'Hide scale names above each chord' : 'Show scale names above each chord'}
          onClick={() => onShowScales(!showScales)}
        >
          <span className="transport-scales-label">scales</span>
          <span className="switch-track" aria-hidden>
            <span className="switch-knob" />
          </span>
        </button>
      )}
    </div>
  );
}
