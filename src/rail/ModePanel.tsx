// The mode panel (SPEC §3.0, §3.1): top left of the header, sharing a pill with Ins: — the mode dropdown: the six modes,
// the hex grid's three under "hex grid modes", a line, then the instrument's three under "instrument modes"; each with what it is for and what it uses or edits, and the
// keys to switch. The button shows the mode's short name. The mode alone decides whether the mic listens.
import { MODES, MODE_LABELS, MODE_SHORT, type Mode } from '../session';
import { Dropdown } from './Dropdown';
import { ModeIcon } from './ModeIcon';
import { modeProfile } from '../modeProfile';

/** What each mode is for, and what it uses or lets you edit (SPEC §3.0): the tags beside its name. */
export const MODE_INFO: Record<Mode, { blurb: string; uses: string[] }> = {
  progression: {
    blurb: 'Enter the chords and pick their scales, with the whole screen for the chart; ▶ plays the progression back.',
    uses: ['edit chords'],
  },
  write: {
    blurb: 'Write your line. Pick notes on the hex grid to enter them at the caret; set lengths and rests, step through what you wrote to hear it.',
    uses: ['edit melody'],
  },
  grid: {
    blurb: 'Improvise on the hex grid. The transport moves the chords, or chord bump does after a number of notes you pick.',
    uses: ['hex'],
  },
  tune: {
    blurb: 'Warm up and tune. The hex lights every note you play; no chords.',
    uses: ['mic'],
  },
  improvise: {
    blurb: 'Play over the changes on your instrument, with a click and the chords. The hex follows each chord as it comes.',
    uses: ['mic', 'transport'],
  },
  read: {
    blurb: 'Play the etude on your instrument: every bar on one page, a click and a moving playhead.',
    uses: ['transport'],
  },
};

export interface ModePanelProps {
  mode: Mode;
  onMode: (mode: Mode) => void;
  /** The progression has chords: without them edit etude and ins read can't be picked (SPEC §3.0). */
  hasChords: boolean;
}

export function ModePanel({ mode, onMode, hasChords }: ModePanelProps) {
  return (
    <div className="mode-panel">
      <span className="pill-label">mode:</span>
      <Dropdown
        value={mode}
        label="Mode"
        options={MODES.map((m) => ({
          value: m,
          label: MODE_LABELS[m],
          short: MODE_SHORT[m],
          icon: <ModeIcon mode={m} />,
          description: MODE_INFO[m].blurb,
          tags: MODE_INFO[m].uses,
          divider: m === 'tune', // the instrument's modes start here
          group: m === MODES[0] ? 'hex grid modes' : m === 'tune' ? 'instrument modes' : undefined,
          ...(!hasChords && modeProfile(m).needsChords ? { disabled: true, hint: 'add chords first' } : {}),
        }))}
        onChange={onMode}
        footer={
          <>
            <kbd>[</kbd> <kbd>]</kbd> previous / next mode · <kbd>\</kbd> etude ↔ ins read, grid ↔ ins improv
          </>
        }
      />
    </div>
  );
}
