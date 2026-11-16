// The mode panel (SPEC §3.0, §3.1): top right of the header, a group — the Mode dropdown: Tuner · Improvise ·
// Write etude · Read etude. The mode alone decides whether the mic listens (no Audio input switch).
import { MODES, MODE_LABELS, type Mode } from '../session';

export interface ModePanelProps {
  mode: Mode;
  onMode: (mode: Mode) => void;
}

export function ModePanel({ mode, onMode }: ModePanelProps) {
  return (
    <div className="mode-panel group">
      <label className="mode-field">
        <span className="ins-label">Mode:</span>
        <select
          className="mode-select"
          value={mode}
          title="Mode ([ / ] to step): Tuner (the hex lights what you play) · Improvise (a lead sheet with the transport) · Write etude (notes at the caret) · Read etude (the etude on one page, with the transport; \ in and out)"
          onChange={(e) => onMode(e.target.value as Mode)}
        >
          {MODES.map((m) => (
            <option key={m} value={m}>
              {MODE_LABELS[m]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
