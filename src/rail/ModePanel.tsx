// The mode panel (SPEC §3.1): top right of the header, a group — the Audio input switch and the Mode dropdown.
import type { Input, Mode } from '../session';

export interface ModePanelProps {
  input: Input;
  mode: Mode;
  onInput: (input: Input) => void;
  onMode: (mode: Mode) => void;
}

export function ModePanel({ input, mode, onInput, onMode }: ModePanelProps) {
  const on = input === 'instrument';
  return (
    <div className="mode-panel group">
      <label className="mode-field">
        <span className="ins-label">Audio input</span>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="Audio input"
          className={on ? 'switch on' : 'switch'}
          title="Play your instrument into your device to enter notes or trigger the next chord as you practice"
          onClick={() => onInput(on ? 'hex' : 'instrument')}
        >
          <span className="switch-knob" />
        </button>
      </label>
      <label className="mode-field">
        <span className="ins-label">Mode:</span>
        <select
          className="mode-select"
          value={mode}
          title="Mode: Explore (nothing written) · Practice (the right notes move the form on; P back to Write) · Write (notes entered at the caret) · Etude view (read-only page; \ in and out)"
          onChange={(e) => onMode(e.target.value as Mode)}
        >
          <option value="explore">Explore</option>
          <option value="practice">Practice</option>
          <option value="write">Write</option>
          <option value="read">Etude view</option>
        </select>
      </label>
    </div>
  );
}
