// Help (☰ → Help, SPEC §3.1): what Tonepath is for and how its parts work, in plain words; the current mode first
// among the modes. A Dialog; its last line opens Keyboard shortcuts.
import { MODES, MODE_LABELS, type Mode } from '../session';
import { Dialog } from './Dialog';
import { MODE_INFO } from './ModePanel';
import { ModeIcon } from './ModeIcon';

/** Help's own, longer word on a mode (a paragraph, or several), where it has one; else the mode menu's blurb (`MODE_INFO`). */
const HELP_MODE_TEXT: Partial<Record<Mode, string | string[]>> = {
  progression: [
    'Enter some chords. Click a chord\'s spot and type a symbol; click the scale name to pick another scale for it. Add, copy and delete bars here too.',
    'The chart takes the whole screen here (no hex grid). ▶ Scale, or S, plays the scale you picked; ▶ in the transport plays the progression back.',
  ],
  grid: [
    'Create a line against the chords using the hex grid. The transport moves the chords: press ▶ to play them at a tempo with a click, or step through them by hand while it is stopped. Or switch on chord bump, and the next chord comes after a certain number of notes you pick (a nice way to get the flow of the chords).',
    'You can get accompaniment as you do this (chord or bass note or both). Pick some bars to loop if you want.',
  ],
  tune:
    "Warm up and tune. Get your device's mic working and the tuner will help to get your ear in. Choose your instrument in the header to make the hex grid display your exact range and also to set the app to transpose for you if you have a transposing instrument. You can then explore the hex grid by playing into it with your instrument and making patterns that way. The grid without any chord tones or scales is just C major with accidentals between. This will give you a sense of how it works.",
  improvise: [
    'Play a line against the chords on your instrument. Create a practice backing track by choosing a tempo and time signature and playing the chords with a metronome. Pick some bars to loop if you want.',
    'You can get accompaniment as you do this (chord or bass note or both).',
  ],
  write: 'Write your line. Pick notes on the hex grid to enter notes into the chart. Set lengths and rests, edit bars, step through what you wrote to hear it.',
  read: 'Play the etude on your instrument, with a metronome and chords if you wish.',
};
const paragraphs = (t: string | string[]) => (Array.isArray(t) ? t : [t]);

export function HelpModal({ mode, onClose, onShortcuts }: { mode: Mode; onClose: () => void; onShortcuts: () => void }) {
  return (
    <Dialog title="Help" className="help" onClose={onClose}>
      <p className="help-lead">
        Tonepath is for practising lines over a chord sequence. The hexagon grid at the bottom lays out each chord's chord
        tones and scale tones in a way that encourages fresh patterns and helps to learn the changes. Up and left is three
        degrees of the scale away, for example, and each direction has its own degree. You will find patterns everywhere.
      </p>
      <p className="help-lead">
        You can use this to explore the tonality of a series of chords, either by using your mouse and triggering notes
        with the A key (no tiring clicking necessary) or by playing them on your instrument using the hex grid as a
        guide. You can also use the hex grid to write your own etude over the changes, and then play that using your
        instrument.
      </p>

      <section className="help-section help-box">
        <h2>The six modes</h2>
        <p>
          Three on the hex grid, then three with your instrument. Pick one in the mode pill at the top left, step through
          them with [ and ], or jump to the same work on the other side with \ (etude ↔ ins read, grid ↔ ins improv).
        </p>
        <dl className="help-modes">
          {MODES.map((m) => (
            <div key={m} className={m === mode ? 'help-mode current' : 'help-mode'}>
              <dt>
                <span className="help-mode-name">
                  <ModeIcon mode={m} />
                  {MODE_LABELS[m]}
                </span>
                {m === mode && <span className="shortcuts-now">you are here</span>}
              </dt>
              <dd>
                {paragraphs(HELP_MODE_TEXT[m] ?? MODE_INFO[m].blurb).map((t) => (
                  <p key={t}>{t}</p>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="help-section">
        <h2>Reading the hex</h2>
        <ul>
          <li>Each cell is a note of the current chord's scale. One cell to the right is the next note up the scale; up and to the left is a third higher.</li>
          <li>The coloured cells are the chord's root, 3rd and 5th; in a four-note chord the outlined cell is its 7th (or 6th), the guide tone. The taupe cells are the rest of the scale.</li>
          <li>The number on each ball is the note's degree in the scale (1 is the root); the colour follows the degree.</li>
          <li>Click a cell to hear it. In edit etude, clicking writes it at the caret.</li>
          <li>Grid (bottom left) switches between the honeycomb and a single row with an octave switch.</li>
        </ul>
      </section>

      <section className="help-section">
        <h2>Entering chords (edit progression)</h2>
        <ul>
          <li>Click a chord's spot (the + on an empty slot) and type a symbol: Dm7, G7, Bdim, C maj7, F#m7b5, C/E … Suggestions appear as you type.</li>
          <li>Two chords with a space between them split the bar in two. Enter or Tab moves on to the next slot.</li>
          <li>Click the scale name to pick another scale for that chord.</li>
          <li>The small key pill shows which key the scale belongs to; chords in the same key light up together.</li>
          <li>Bars: the ⋯ on a bar number inserts, duplicates, copies, splits or deletes; + adds a bar after it.</li>
        </ul>
      </section>

      <section className="help-section">
        <h2>Listening (ins tune and ins improv)</h2>
        <ul>
          <li>Allow the microphone when asked. The tuner shows the note you play and how far off it is — green when you're within 15 cents.</li>
          <li>Set the input level (in) so playing pushes the meter past the white mark and silence stays below it.</li>
          <li>The notes you play light up on the hex.</li>
        </ul>
      </section>

      <section className="help-section">
        <h2>Playing along</h2>
        <ul>
          <li>The transport (grid improv with chord bump off, ins improv, ins read) runs the chords in time: set the tempo and click sound, then ▶.</li>
          <li>On the grid, by notes: after the number of notes you set, picked on the hex, the form moves on to the next chord.</li>
          <li>To loop a few bars, click a bar number (⇧-click another to extend), or pick the first and last bar in the transport. × goes back to the whole sequence.</li>
          <li>Audio on chord plays the chord, its root or its bass as each chord arrives. ▶ chord, bass and scale play them on demand.</li>
        </ul>
      </section>

      <section className="help-section">
        <h2>Your instrument</h2>
        <p>
          Pick it under ins: at the top. Chords, the hex and the notation then show your instrument's written pitch (a B♭
          clarinet sees D where a piano sees C), and anything you type is read the same way.
        </p>
      </section>

      <section className="help-section">
        <h2>Saving</h2>
        <ul>
          <li>Everything saves as you go, in this browser.</li>
          <li>☰ → Library lists your chord sequences; each holds one or more etudes (pick one under etude:).</li>
          <li>Export all makes a backup file — do it now and then. Import adds sequences from a file, never overwriting.</li>
          <li>To share an etude, choose Share etude… in the etude picker: a link is copied that opens it, with its chords, in anyone's Tonepath. Over a standard progression it joins their etudes there.</li>
        </ul>
      </section>

      <p className="help-foot">
        <button type="button" className="library-tool" onClick={onShortcuts}>
          Keyboard shortcuts
        </button>
      </p>
    </Dialog>
  );
}
