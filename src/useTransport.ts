// The transport in React (SPEC §3.7): the tempo and click sound (device settings), Loop (the session's),
// the looped bars as a slot range, and the metronome run on the audio clock while the session says it runs.
// The session's current slot is the one playhead: the run announces each slot (`onSlot` → the session), and any
// fresh run — started, rewound (`restart()`), or after a change of tempo, sound or form — begins on it.
// The timing logic — lookahead, loop, end — is `metronomeRun.ts`; this is its adapter.
import { useEffect, useMemo, useRef, useState } from 'react';
import { audioNow, playClick, unlockAudio, type ClickSound } from './audio';
import { METRONOME_BPM, METRONOME_SOUND } from './deviceSettings';
import { startMetronomeRun, type Clock } from './metronomeRun';
import type { ModeProfile } from './modeProfile';
import { loopRange, transportForm, type SlotRange } from './transport';
import { useDeviceSetting } from './useDeviceSetting';
import type { InstrumentView } from './view';

/** The audio clock (seconds) with window timers for the callbacks. */
const audioClock: Clock = {
  now: audioNow,
  at: (time, fn) => {
    const id = window.setTimeout(fn, Math.max(0, (time - audioNow()) * 1000));
    return () => window.clearTimeout(id);
  },
  every: (ms, fn) => {
    const id = window.setInterval(fn, ms);
    return () => window.clearInterval(id);
  },
};

export interface TransportOptions {
  view: InstrumentView;
  profile: ModeProfile;
  /** The looped bars (the bar selection), or null: the whole form. */
  selection: { from: number; to: number } | null;
  /** The session's current slot: where a run starts. */
  slot: number;
  /** Loop (the session's, SPEC §3.7): at the end, round again; else stop. */
  loop: boolean;
  /** A slot starts (the session's `transport-chord`). */
  onSlot: (index: number) => void;
  /** The form (or the looped bars) ended without Loop (the session's `transport-end`). */
  onEnd: () => void;
}

export interface Transport {
  bpm: number;
  setBpm: (bpm: number) => void;
  sound: ClickSound;
  setSound: (sound: ClickSound) => void;
  /** The looped bars as slots, in a mode with a transport; else null. */
  range: SlotRange | null;
  /** Start afresh from the current slot (the session's `transport-restart` effect: a rewind while running). */
  restart: () => void;
}

export function useTransport(o: TransportOptions): Transport {
  const [bpm, setBpm] = useDeviceSetting(METRONOME_BPM);
  const [sound, setSound] = useDeviceSetting(METRONOME_SOUND);
  const [restarts, setRestarts] = useState(0);

  const { view, profile, selection } = o;
  const range = useMemo(() => (profile.transport ? loopRange(view.slots, selection) : null), [profile.transport, view.slots, selection]);
  const form = useMemo(() => transportForm(view, range), [view, range]);

  const live = useRef(o);
  live.current = o;

  const running = profile.running;
  const { meter } = view;
  useEffect(() => {
    if (!running) return;
    unlockAudio();
    const run = startMetronomeRun({
      clock: audioClock,
      meter,
      slots: form.slots,
      end: form.end,
      bpm,
      startSlot: live.current.slot,
      loop: () => live.current.loop,
      onClick: (accent, at) => playClick(sound, accent, at),
      onSlot: (i) => live.current.onSlot(i),
      onEnd: () => live.current.onEnd(),
    });
    return run.stop;
  }, [running, bpm, sound, meter, form, restarts]);

  return { bpm, setBpm, sound, setSound, range, restart: () => setRestarts((n) => n + 1) };
}
