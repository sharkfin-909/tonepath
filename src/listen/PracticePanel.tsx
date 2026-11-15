// Practice panel (SPEC §3.7): above the hex, beside the tuner, while practising — the advance rule, Loop, this slot's note
// count against its target, and the note(s) that will move the form on. It flashes each time the form moves on.
import { ADVANCE_RULES, PRACTICE_COUNTS, type AdvanceRule } from '../practice';

export interface PracticePanelProps {
  rule: AdvanceRule;
  onRule: (rule: AdvanceRule) => void;
  loop: boolean;
  onLoop: (on: boolean) => void;
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
}

export function PracticePanel({ rule, onRule, loop, onLoop, count, need, targetNames, advanced, notesPerChord, onNotesPerChord }: PracticePanelProps) {
  const hint = ADVANCE_RULES.find((r) => r.id === rule)?.hint;
  return (
    <div className="practice-panel group" key={advanced}>
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
      <label className="practice-loop">
        <input type="checkbox" checked={loop} onChange={(e) => onLoop(e.target.checked)} /> Loop
      </label>
    </div>
  );
}
