// 🎤 Listen (SPEC §9.2): no button of its own — on while `auto` (the mode listens: Tune, Improvise; SPEC §3.0). On:
// the mic is read every frame; a pill portalled to the row's left end shows the input level control and meter, and —
// portalled into the row's middle — the tuner shows the note being played (written pitch, spelled by `nameOf`) and how
// far off it is. Each played note goes to `onNote`. Where the mic can't be used, or the browser holds the audio until a
// gesture, the tuner's place says so instead (and the first click or key resumes it).
// Only a change of note is reported up (to light the hex), so the chart doesn't re-render 60 times a second.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prettyName } from '../spelling';
import { readDevice, writeDevice } from '../device';
import { INPUT_GAIN_DB, micAllowedHere, micProblem, startListening, type Listening, type MicProblem } from './mic';
import { ONSET_GATE, meterPosition } from './pitch';

export interface ListenPillProps {
  /** The heard concert note changed (null = nothing clear). */
  onHeard: (concertMidi: number | null) => void;
  /** A concert note's written name in the active slot, e.g. `Eb4`. */
  nameOf: (concertMidi: number) => string;
  /** A note was played (an attack, or a slur to a new pitch): concert MIDI. */
  onNote?: (concertMidi: number, fromOnset: boolean) => void;
  /** Listen while true (Tune, Improvise); off again when it turns false. */
  auto?: boolean;
  /** Where the big tuner goes (above the hex): rendered there while listening, so only it redraws every frame. */
  tunerSlot?: HTMLElement | null;
  /** Where the input level control and meter go (the row's left end): rendered there while listening. */
  levelsSlot?: HTMLElement | null;
  /** Concert MIDI of the instrument's practical low, or null for Concert — sets the analysis window (issues/064). */
  concertLowMidi?: number | null;
}

/** What the tuner's place says when the mic can't be used (SPEC §3.0). */
export const MIC_PROBLEM_TEXT: Record<MicProblem, string> = {
  blocked: "Mic blocked: allow it in the browser's site settings",
  'no-device': 'No microphone found',
  insecure: 'The mic needs a secure page (HTTPS or localhost)',
};

export function ListenPill({ onHeard, nameOf, onNote, auto = false, tunerSlot = null, levelsSlot = null, concertLowMidi = null }: ListenPillProps) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState<MicProblem | null>(null);
  /** The browser holds the audio until a gesture: *tap to start listening*. */
  const [held, setHeld] = useState(false);
  /** Asking for the mic (the browser's prompt may be open): say so in the tuner's place. */
  const [asking, setAsking] = useState(false);
  const [frame, setFrame] = useState<{ midi: number | null; cents: number; level: number }>({ midi: null, cents: 0, level: 0 });
  const listening = useRef<Listening | null>(null);
  // The input level control (dB), remembered on the device: set it so playing passes the meter's mark and silence
  // stays below it.
  const [gainDb, setGainDb] = useState(() => {
    const g = readDevice(localStorage).micGainDb;
    return typeof g === 'number' ? Math.min(INPUT_GAIN_DB.max, Math.max(INPUT_GAIN_DB.min, g)) : 0;
  });
  const changeGain = (db: number) => {
    setGainDb(db);
    listening.current?.setGainDb(db);
    writeDevice(localStorage, { micGainDb: db });
  };
  const lastMidi = useRef<number | null>(null);
  const report = useRef(onHeard);
  report.current = onHeard;
  const noted = useRef(onNote);
  noted.current = onNote;
  const autoStarted = useRef(false);

  useEffect(() => () => listening.current?.stop(), []);

  const toggle = async (want = !on): Promise<boolean> => {
    if (want === on) return on;
    if (!want) {
      listening.current?.stop();
      listening.current = null;
      setOn(false);
      setHeld(false);
      lastMidi.current = null;
      report.current(null);
      setFrame({ midi: null, cents: 0, level: 0 });
      return false;
    }
    setError(null);
    setAsking(true);
    try {
      listening.current = await startListening(
        (h) => {
          setFrame({ midi: h.midi, cents: h.cents, level: h.level });
          if (h.noteStart !== null) noted.current?.(h.noteStart, h.noteFromOnset);
          if (h.midi !== lastMidi.current) {
            lastMidi.current = h.midi;
            report.current(h.midi);
          }
        },
        { gainDb, concertLowMidi, onAudioState: (running) => setHeld(!running) },
      );
      setOn(true);
      return true;
    } catch (err) {
      setError(micProblem(err));
    } finally {
      setAsking(false);
    }
    return false;
  };

  // The listening modes turn it on — at once on an open into Tune (the browser may ask for the mic straight away) —
  // and off again when they end.
  // In a frame that may not use the mic (the site tour's still picture), it isn't asked for: the tuner shows idle.
  const [micless] = useState(() => !micAllowedHere());
  useEffect(() => {
    if (micless) return;
    if (auto && !on && !autoStarted.current) {
      autoStarted.current = true;
      void toggle(true).then((started) => (autoStarted.current = started));
    } else if (!auto && autoStarted.current) {
      autoStarted.current = false;
      void toggle(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to `auto` turning on / off
  }, [auto]);

  // Held audio: the first click or key anywhere resumes it.
  useEffect(() => {
    if (!held) return;
    const go = () => listening.current?.resume();
    window.addEventListener('pointerdown', go, true);
    window.addEventListener('keydown', go, true);
    return () => {
      window.removeEventListener('pointerdown', go, true);
      window.removeEventListener('keydown', go, true);
    };
  }, [held]);

  // Retune YIN's window when the instrument changes while listening (issues/064).
  useEffect(() => {
    listening.current?.setConcertLowMidi(concertLowMidi);
  }, [concertLowMidi]);

  const meter = meterPosition(frame.level); // dB scale
  const mark = meterPosition(ONSET_GATE); // where a note starts to count
  return (
    <>
    {micless && auto && tunerSlot && createPortal(<Tuner name={null} cents={0} />, tunerSlot)}
    {on && !held && tunerSlot && createPortal(<Tuner name={frame.midi === null ? null : nameOf(frame.midi)} cents={frame.cents} />, tunerSlot)}
    {on && held && tunerSlot && createPortal(<div className="tuner pill tuner-message" role="status">tap to start listening</div>, tunerSlot)}
    {auto && !on && asking && tunerSlot && createPortal(<div className="tuner pill tuner-message" role="status">allow the microphone to start listening</div>, tunerSlot)}
    {auto && !on && error && tunerSlot && createPortal(<div className="tuner pill tuner-message" role="alert">{MIC_PROBLEM_TEXT[error]}</div>, tunerSlot)}
    {/* While listening: the input level control and meter, in a pill as tall as the tuner, at the row's left end. */}
    {on && levelsSlot && createPortal(
      <div className="listen-levels pill">
        <label className="listen-gain" title={`Input level ${gainDb > 0 ? '+' : ''}${gainDb} dB: playing should pass the mark, silence stay below it`}>
          <span className="listen-gain-label pill-label">In</span>
          <input
            type="range"
            min={INPUT_GAIN_DB.min}
            max={INPUT_GAIN_DB.max}
            step={1}
            value={gainDb}
            aria-label="Input level (dB)"
            onChange={(e) => changeGain(Number(e.target.value))}
            onDoubleClick={() => changeGain(0)}
          />
          <span className="listen-gain-db">{`${gainDb > 0 ? '+' : ''}${gainDb}`}</span>
        </label>
        <span className={frame.level >= ONSET_GATE ? 'listen-meter over' : 'listen-meter'} aria-hidden>
          <span className="listen-meter-fill" style={{ width: `${Math.round(meter * 100)}%` }} />
          <span className="listen-meter-mark" style={{ left: `${Math.round(mark * 100)}%` }} />
        </span>
      </div>,
      levelsSlot,
    )}
    </>
  );
}

/** Tooltip on the tuner well (SPEC §3.1 app tooltips, §9.2). */
const TUNER_TITLE =
  'This is a tuner. Play into your device to check your pitch. If it is less than 15 cents (15% of a semitone) sharp or flat, it will show green.';

/**
 * The big tuner above the hex (SPEC §9.2): the note name and octave, a ±50 ¢ scale, the cents off.
 * In tune (±15 ¢): the green band glows and the needle hides. Needle only in amber (±30 ¢) or red.
 */
function Tuner({ name, cents }: { name: string | null; cents: number }) {
  const zone = name === null ? 'idle' : Math.abs(cents) <= 15 ? 'in' : Math.abs(cents) <= 30 ? 'near' : 'off';
  const m = /^(.*?)(-?\d+)$/.exec(name ?? '');
  const showNeedle = zone === 'near' || zone === 'off';
  return (
    <div
      className="tuner pill"
      data-zone={zone}
      role="status"
      title={TUNER_TITLE}
      aria-label={name === null ? 'Tuner: no note' : `Tuner: ${name}, ${cents} cents`}
    >
      <div className="tuner-note">
        {name === null ? '\u00a0' : prettyName(m ? m[1] : name)}
        {m && <sub>{m[2]}</sub>}
      </div>
      <div className="tuner-scale" aria-hidden>
        {[-50, -25, 0, 25, 50].map((c) => (
          <span key={c} className={c === 0 ? 'tuner-tick zero' : 'tuner-tick'} style={{ left: `${50 + c}%` }} />
        ))}
        <span className="tuner-band" />
        {showNeedle && <span className="tuner-needle" style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%` }} />}
      </div>
      <div className="tuner-cents">{name === null || zone === 'in' ? '' : `${cents > 0 ? '+' : ''}${cents} ¢`}</div>
    </div>
  );
}
