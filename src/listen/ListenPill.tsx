// 🎤 Listen (SPEC §9.2, prototype): a pill at the bottom right of the hex panel. On: the mic is read every frame; the
// pill shows the note being played (spelled for the active slot, written pitch), how far off it is, the input level
// and a running count of note starts. Only a change of note is reported up (to light the hex), so the chart doesn't
// re-render 60 times a second.
import { useEffect, useRef, useState } from 'react';
import { startListening, type StopListening } from './mic';

export interface ListenPillProps {
  /** The heard concert note changed (null = nothing clear). */
  onHeard: (concertMidi: number | null) => void;
  /** A concert note's written name in the active slot, e.g. `Eb4`. */
  nameOf: (concertMidi: number) => string;
}

export function ListenPill({ onHeard, nameOf }: ListenPillProps) {
  const [on, setOn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frame, setFrame] = useState<{ midi: number | null; cents: number; level: number }>({ midi: null, cents: 0, level: 0 });
  const [count, setCount] = useState(0);
  const stop = useRef<StopListening | null>(null);
  const lastMidi = useRef<number | null>(null);
  const report = useRef(onHeard);
  report.current = onHeard;

  useEffect(() => () => stop.current?.(), []);

  const toggle = async () => {
    if (on) {
      stop.current?.();
      stop.current = null;
      setOn(false);
      lastMidi.current = null;
      report.current(null);
      setFrame({ midi: null, cents: 0, level: 0 });
      return;
    }
    setError(null);
    try {
      stop.current = await startListening((h) => {
        setFrame({ midi: h.midi, cents: h.cents, level: h.level });
        if (h.onset) setCount((n) => n + 1);
        if (h.midi !== lastMidi.current) {
          lastMidi.current = h.midi;
          report.current(h.midi);
        }
      });
      setCount(0);
      setOn(true);
    } catch (err) {
      setError(err instanceof DOMException && err.name === 'NotAllowedError' ? 'Microphone blocked' : 'No microphone');
    }
  };

  const meter = Math.min(1, frame.level * 6); // a comfortable playing level fills about half
  return (
    <div className={on ? 'listen-pill on' : 'listen-pill'}>
      <button type="button" className="listen-toggle" aria-pressed={on} title={on ? 'Stop listening' : 'Listen: detect the notes you play (mic)'} onClick={toggle}>
        🎤 {on ? 'Listening' : 'Listen'}
      </button>
      {on && (
        <>
          <span className="listen-meter" aria-hidden>
            <span style={{ width: `${Math.round(meter * 100)}%` }} />
          </span>
          <span className="listen-note" aria-live="off">
            {frame.midi === null ? '—' : nameOf(frame.midi)}
            {frame.midi !== null && <small>{`${frame.cents > 0 ? '+' : ''}${frame.cents}¢`}</small>}
          </span>
          <span className="listen-count" title="Note starts heard">
            {count} {count === 1 ? 'note' : 'notes'}
          </span>
        </>
      )}
      {error && <span className="listen-error">{error}</span>}
    </div>
  );
}
