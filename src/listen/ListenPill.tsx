// 🎤 Listen (SPEC §9.2): no button of its own — on while `auto` (Practice, or Write's *Write with instrument audio*). On:
// the mic is read every frame; a pill
// portalled to the row's right end shows the input level control and meter, and — portalled into the row's middle — the tuner shows
// the note being played (spelled for the active slot, written pitch) and how far off it is. Practice turns it on and off (`auto`) and receives each played note (`onNote`).
// Only a change of note is reported up (to light the hex), so the chart doesn't re-render 60 times a second.
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { prettyName } from '../spelling';
import { readDevice, writeDevice } from '../device';
import { INPUT_GAIN_DB, startListening, type Listening } from './mic';
import { ONSET_GATE, meterPosition } from './pitch';

export interface ListenPillProps {
  /** The heard concert note changed (null = nothing clear). */
  onHeard: (concertMidi: number | null) => void;
  /** A concert note's written name in the active slot, e.g. `Eb4`. */
  nameOf: (concertMidi: number) => string;
  /** A note was played (an attack, or a slur to a new pitch): concert MIDI. Write inserts; Practice counts (SPEC §3.7). */
  onNote?: (concertMidi: number, fromOnset: boolean) => void;
  /** Listen while true (Practice, or Write with instrument audio); off again when it turns false. */
  auto?: boolean;
  /** Mic on/off — App uses this in Write to mute note audition while listening. */
  onListening?: (on: boolean) => void;
  /** Where the big tuner goes (above the hex): rendered there while listening, so only it redraws every frame. */
  tunerSlot?: HTMLElement | null;
  /** Where the input level control and meter go (the row's right end): rendered there while listening. */
  levelsSlot?: HTMLElement | null;
  /** Concert MIDI of the instrument's practical low, or null for Concert — sets the analysis window (issues/064). */
  concertLowMidi?: number | null;
}

export function ListenPill({ onHeard, nameOf, onNote, auto = false, onListening, tunerSlot = null, levelsSlot = null, concertLowMidi = null }: ListenPillProps) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
      onListening?.(false);
      lastMidi.current = null;
      report.current(null);
      setFrame({ midi: null, cents: 0, level: 0 });
      return false;
    }
    setError(null);
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
        { gainDb, concertLowMidi },
      );
      setOn(true);
      onListening?.(true);
      return true;
    } catch (err) {
      setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'Microphone blocked' : 'No microphone');
    }
    return false;
  };

  // Practice / Write with instrument audio turn listening on (the click or dropdown change is the user's gesture) and
  // off again when they end.
  useEffect(() => {
    if (auto && !on && !autoStarted.current) {
      autoStarted.current = true;
      void toggle(true).then((started) => (autoStarted.current = started));
    } else if (!auto && autoStarted.current) {
      autoStarted.current = false;
      void toggle(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reacts to `auto` turning on / off
  }, [auto]);

  // Retune YIN's window when the instrument changes while listening (issues/064).
  useEffect(() => {
    listening.current?.setConcertLowMidi(concertLowMidi);
  }, [concertLowMidi]);

  const meter = meterPosition(frame.level); // dB scale
  const mark = meterPosition(ONSET_GATE); // where a note starts to count
  return (
    <>
    {on && tunerSlot && createPortal(<Tuner name={frame.midi === null ? null : nameOf(frame.midi)} cents={frame.cents} />, tunerSlot)}
    {/* While listening: the input level control and meter, in a pill as tall as the tuner, at the row's right end. */}
    {on && levelsSlot && createPortal(
      <div className="listen-levels well">
        <label className="listen-gain" title={`Input level ${gainDb > 0 ? '+' : ''}${gainDb} dB: playing should pass the mark, silence stay below it`}>
          <span className="listen-gain-label">In</span>
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
    {error && <span className="listen-error">{error}</span>}
    </>
  );
}

/**
 * The big tuner above the hex (SPEC §9.2): the note name and octave, a ±50 ¢ scale, the cents off.
 * In tune (±10 ¢): the green band glows and the needle hides. Needle only in amber (±15 ¢) or red.
 */
function Tuner({ name, cents }: { name: string | null; cents: number }) {
  const zone = name === null ? 'idle' : Math.abs(cents) <= 10 ? 'in' : Math.abs(cents) <= 15 ? 'near' : 'off';
  const m = /^(.*?)(-?\d+)$/.exec(name ?? '');
  const showNeedle = zone === 'near' || zone === 'off';
  return (
    <div className="tuner well" data-zone={zone} role="status" aria-label={name === null ? 'Tuner: no note' : `Tuner: ${name}, ${cents} cents`}>
      <div className="tuner-note">
        {name === null ? '—' : prettyName(m ? m[1] : name)}
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
