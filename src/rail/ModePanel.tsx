// The mode panel (SPEC §3.0, §3.1): top left of the header, sharing a pill with Ins: — the mode dropdown: the four modes (Tune ·
// Improvise · Write etude · Read etude), each with what it is for and what it uses or edits, and the keys to switch.
// The mode alone decides whether the mic listens (no Audio input switch).
import { MODES, MODE_LABELS, type Mode } from '../session';
import { Dropdown } from './Dropdown';

/** What each mode is for, and what it uses or lets you edit (SPEC §3.0): the tags beside its name. */
export const MODE_INFO: Record<Mode, { blurb: string; uses: string[] }> = {
  tune: {
    blurb: 'Warm up and tune. The hex lights every note you play; no chart, no chords. Every open starts here.',
    uses: ['mic'],
  },
  improvise: {
    blurb: 'Play over the changes. A lead sheet of each chord\'s scale; the transport keeps time and the hex rings the next chord. Stop it to step chords by hand or edit them.',
    uses: ['mic', 'transport', 'edit tonality'],
  },
  write: {
    blurb: 'Write your line. Pick notes on the hex at the caret; set lengths and rests, edit bars, step through what you wrote.',
    uses: ['edit'],
  },
  read: {
    blurb: 'Play the etude. Every bar on one page, a click and a moving playhead; nothing to edit — made for a music stand.',
    uses: ['transport'],
  },
};

export interface ModePanelProps {
  mode: Mode;
  onMode: (mode: Mode) => void;
}

export function ModePanel({ mode, onMode }: ModePanelProps) {
  return (
    <div className="mode-panel">
      <Dropdown
        value={mode}
        label="Mode"
        bare
        prefix="mode:"
        options={MODES.map((m) => ({ value: m, label: MODE_LABELS[m], description: MODE_INFO[m].blurb, tags: MODE_INFO[m].uses }))}
        onChange={onMode}
        footer={
          <>
            <kbd>[</kbd> <kbd>]</kbd> previous / next mode · <kbd>\</kbd> write ↔ read
          </>
        }
      />
    </div>
  );
}
