// Practice panel (SPEC §3.7): in the header while practising — a **metronome** switch, then either the advance rule, this
// slot's note count against its target and the note(s) that will move the form on, or (metronome on) the tempo, the
// click sound, rewind and start / stop; Loop either way, then the looped bars' chip (× for the whole form). It flashes each time the form moves on by the notes played.
import { useEffect, useState } from 'react';
import { ADVANCE_RULES, PRACTICE_COUNTS, type AdvanceRule } from '../practice';
import { BPM, METRONOME_SOUNDS } from '../metronome';
import type { ClickSound } from '../audio';

export interface MetronomeControls {
  on: boolean;
  onToggle: () => void;
  bpm: number;
  onBpm: (bpm: number) => void;
  sound: ClickSound;
  onSound: (sound: ClickSound) => void;
  running: boolean;
  onStartStop: () => void;
  onRewind: () => void;
}

export interface PracticePanelProps {
  rule: AdvanceRule;
  onRule: (rule: AdvanceRule) => void;
  loop: boolean;
  onLoop: (on: boolean) => void;
  /** Looping selected bars (0-based, inclusive), or null (the whole form); ✕ goes back to the whole form. */
  bars: { from: number; to: number } | null;
  onAllBars: () => void;
  /** Notes played in this slot, and the slot's target count (count rules), or null. */
  count: number;
  need: number | null;
  /** What moves the form on, as note names (e.g. `B · F`), or ''. */
  targetNames: string;
  /** Counts advances: each new value re-mounts the panel, which replays the groups' flash. */
  advanced: number;
  /** The note count per chord (count rules: 1, 2, 4, 8, 16 or 32), and its dropdown. */
  notesPerChord: number;
  onNotesPerChord: (n: number) => void;
  metronome: MetronomeControls;
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
      className="practice-bpm"
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

export function PracticePanel({ rule, onRule, loop, onLoop, bars, onAllBars, count, need, targetNames, advanced, notesPerChord, onNotesPerChord, metronome: m }: PracticePanelProps) {
  const hint = ADVANCE_RULES.find((r) => r.id === rule)?.hint;
  return (
    <div className="practice-panel group" key={advanced}>
      <span className="practice-rule-field">
        <span className="practice-rule-label">metronome</span>
        <button
          type="button"
          role="switch"
          aria-checked={m.on}
          aria-label="Metronome"
          className={m.on ? 'switch on' : 'switch'}
          title="Metronome: the form moves on in time, chord by chord, instead of by the notes you play"
          onClick={m.onToggle}
        >
          <span className="switch-knob" />
        </button>
      </span>
      {m.on ? (
        <>
          <label className="practice-rule-field" title={`Tempo, in beats per minute (${BPM.min}–${BPM.max})`}>
            <BpmField bpm={m.bpm} onBpm={m.onBpm} />
            <span className="practice-rule-label">bpm</span>
          </label>
          <select className="practice-rule" value={m.sound} aria-label="Click sound" title="Click sound" onChange={(e) => m.onSound(e.target.value as ClickSound)}>
            {METRONOME_SOUNDS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
          <span className="step-controls">
            <button type="button" className="rail-button icon-button" aria-label="Rewind" title="Rewind to the first chord" onClick={m.onRewind}>
              {icon('M2 2h1.6v8H2zM10 2v8L4 6z')}
            </button>
            <button
              type="button"
              className="rail-button icon-button"
              aria-label={m.running ? 'Stop' : 'Start'}
              title={m.running ? 'Stop the metronome' : 'Start the metronome from this chord'}
              onClick={m.onStartStop}
            >
              {m.running ? icon('M3 3h6v6H3z') : icon('M3.5 2v8L10 6z')}
            </button>
          </span>
        </>
      ) : (
        <>
          <label className="practice-rule-field">
            <span className="practice-rule-label">Next chord on:</span>
            <select className="practice-rule" value={rule} title={hint} onChange={(e) => onRule(e.target.value as AdvanceRule)}>
              {ADVANCE_RULES.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          {(rule === 'count' || rule === 'count-then-guide') && (
            <label className="practice-rule-field" title="How many notes to play on each chord">
              <span className="practice-rule-label">Notes:</span>
              <select className="practice-rule" value={notesPerChord} onChange={(e) => onNotesPerChord(Number(e.target.value))}>
                {PRACTICE_COUNTS.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {/* Guide tone / Chord tone: no counter — only landing on the next chord matters. */}
          {rule !== 'guide' && rule !== 'chord-tone' && (
            <span className="practice-count" title="Notes played in this slot">
              {need === null ? `${count} ${count === 1 ? 'note' : 'notes'}` : `${Math.min(count, need)} / ${need}`}
            </span>
          )}
          {targetNames && (
            <span className="practice-target" title="Play one of these to move on">
              → {targetNames}
            </span>
          )}
        </>
      )}
      <label
        className="practice-loop"
        title={bars ? 'Loop: round the selected bars again at their end' : 'Loop: round the form again at its end (select bars in Write to practise just them)'}
      >
        <input type="checkbox" checked={loop} onChange={(e) => onLoop(e.target.checked)} /> Loop
      </label>
      {bars && (
        <span className="practice-bars">
          {bars.from === bars.to ? `bar ${bars.from + 1}` : `bars ${bars.from + 1}–${bars.to + 1}`}
          <button type="button" className="practice-bars-clear" aria-label="Practise the whole form" title="Practise the whole form" onClick={onAllBars}>
            ×
          </button>
        </span>
      )}
    </div>
  );
}
