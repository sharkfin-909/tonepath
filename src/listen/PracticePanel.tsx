// Practice panel (SPEC §3.7): above the hex, beside the tuner, while practising — the advance rule, Loop, this slot's note
// count against its target, and the note(s) that will move the form on. It flashes each time the form moves on.
import { ADVANCE_RULES, type AdvanceRule } from '../practice';

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
  /** Counts advances: each new value replays the flash. */
  advanced: number;
}

export function PracticePanel({ rule, onRule, loop, onLoop, count, need, targetNames, advanced }: PracticePanelProps) {
  const hint = ADVANCE_RULES.find((r) => r.id === rule)?.hint;
  return (
    <div className="practice-panel" key={advanced} data-flash={advanced > 0 || undefined}>
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
      <span className="practice-count" title="Notes played in this slot">
        {need === null ? `${count} ${count === 1 ? 'note' : 'notes'}` : `${Math.min(count, need)} / ${need}`}
      </span>
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
