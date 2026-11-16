// Keyboard shortcuts (SPEC §11), from the ☰ menu: every key the app answers, grouped, the current mode's group first.
// A Dialog (Esc, × or the backdrop closes it; keys never reach the chart behind).
import type { Mode } from '../session';
import { Dialog } from './Dialog';

type Row = { keys: string[]; what: string };
type Group = { id: string; title: string; modes?: Mode[]; rows: Row[] };

const GROUPS: Group[] = [
  {
    id: 'everywhere',
    title: 'Everywhere',
    rows: [
      { keys: ['Space'], what: 'Click whatever is under the pointer' },
      { keys: ['A'], what: 'Play the hex note under the pointer (Write etude: write it)' },
      { keys: ['['], what: 'Previous mode' },
      { keys: [']'], what: 'Next mode' },
      { keys: ['\\'], what: 'Write etude ↔ Read etude' },
      { keys: ['C'], what: '▶ Chord' },
      { keys: ['B'], what: '▶ Bass' },
      { keys: ['S', '⇧Space'], what: '▶ Scale' },
      { keys: ['⇧M'], what: 'Mute / unmute' },
    ],
  },
  {
    id: 'write',
    title: 'Write etude',
    modes: ['write'],
    rows: [
      { keys: ['1', '2', '3', '4', '5'], what: 'Note length: whole, half, quarter, eighth, sixteenth' },
      { keys: ['R'], what: 'Rest on / off' },
      { keys: ['←', '→'], what: 'Move the caret' },
      { keys: ['↑', '↓'], what: 'Move the note at the caret an octave' },
      { keys: ['⌥↑', '⌥↓'], what: '… a scale step' },
      { keys: ['⇧↑', '⇧↓'], what: '… a semitone' },
      { keys: ['⌫', 'Del'], what: 'Delete the note before / at the caret' },
      { keys: ['`', '~'], what: 'Step through what you wrote, note by note' },
      { keys: ['<', '>'], what: 'Previous / next slot' },
      { keys: ['⌘Z', '⇧⌘Z'], what: 'Undo / redo' },
    ],
  },
  {
    id: 'play',
    title: 'Improvise and Read etude',
    modes: ['improvise', 'read'],
    rows: [
      { keys: ['←', '→'], what: 'Previous / next slot (stopped)' },
      { keys: ['<', '>'], what: 'Previous / next slot (stopped)' },
      { keys: ['⌘Z', '⇧⌘Z'], what: 'Undo / redo (Improvise, stopped)' },
    ],
  },
  {
    id: 'bars',
    title: 'Bars and loops',
    modes: ['write', 'improvise', 'read'],
    rows: [
      { keys: ['click bar number'], what: 'Write etude: select the bar · Improvise, Read etude: loop it' },
      { keys: ['⇧click'], what: 'Extend to a run of bars' },
      { keys: ['Esc'], what: 'Deselect / stop looping' },
      { keys: ['⌘C', '⌘V', '⌘D'], what: 'Write etude, bars selected: copy / paste / duplicate' },
      { keys: ['⌫'], what: 'Write etude, bars selected: delete them' },
    ],
  },
  {
    id: 'chord',
    title: 'Typing a chord',
    modes: ['write', 'improvise'],
    rows: [
      { keys: ['↑', '↓'], what: 'Pick a suggestion' },
      { keys: ['Enter', 'Tab'], what: 'Commit, on to the next slot' },
      { keys: ['⇧Tab'], what: 'Commit, back to the previous slot' },
      { keys: ['Esc'], what: 'Close the suggestions, then cancel' },
    ],
  },
];

export function ShortcutsModal({ mode, onClose }: { mode: Mode; onClose: () => void }) {
  // The current mode's own group first, after Everywhere.
  const groups = [...GROUPS].sort((a, b) => rank(a, mode) - rank(b, mode));
  return (
    <Dialog title="Keyboard shortcuts" className="shortcuts" onClose={onClose}>
      {groups.map((g) => (
        <section key={g.id} className={g.modes?.includes(mode) ? 'shortcuts-group current' : 'shortcuts-group'}>
          <h2>
            {g.title}
            {g.modes?.includes(mode) && <span className="shortcuts-now">this mode</span>}
          </h2>
          <dl>
            {g.rows.map((r) => (
              <div key={r.keys.join() + r.what} className="shortcuts-row">
                <dt>
                  {r.keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </dt>
                <dd>{r.what}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
      <p className="shortcuts-note">Shortcuts wait while you type in a field (a chord, the title, the tempo). In Tune, only the hex, sound and mode keys apply.</p>
    </Dialog>
  );
}

/** Everywhere first, then the groups for this mode, then the rest. */
const rank = (g: Group, mode: Mode) => (g.id === 'everywhere' ? 0 : g.modes?.includes(mode) ? 1 : 2);
