// The metronome in React (SPEC §3.7): runs a `metronomeRun` on the audio clock while `running`. It starts at
// `startSlot` (fresh, or after a rewind: `restart` bumped); a change of tempo, sound or form carries on from the slot it
// is on (a form here is the whole form, or the looped bars rebased to start at 0). The logic — lookahead, loop, end — is `metronomeRun.ts`; this is its adapter.
import { useEffect, useRef } from 'react';
import { audioNow, playClick, unlockAudio, type ClickSound } from './audio';
import type { Meter } from './form';
import { startMetronomeRun, type Clock } from './metronomeRun';

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

export interface MetronomeProps {
  running: boolean;
  bpm: number;
  sound: ClickSound;
  meter: Meter;
  slots: { index: number; start: number }[];
  end: number;
  startSlot: number;
  loop: boolean;
  /** Bumped to start again from `startSlot` (rewind). */
  restart: number;
  onSlot: (index: number) => void;
  onEnd: () => void;
}

export function useMetronome(props: MetronomeProps): void {
  const live = useRef(props);
  live.current = props;
  /** The slot the last run was on, and the restart it began with: a new run carries on from there unless restarted. */
  const last = useRef<{ restart: number; slot: () => number } | null>(null);

  const { running, bpm, sound, meter, slots, end, restart } = props;
  useEffect(() => {
    if (!running) {
      last.current = null;
      return;
    }
    unlockAudio();
    const fresh = !last.current || last.current.restart !== restart;
    const run = startMetronomeRun({
      clock: audioClock,
      meter,
      slots,
      end,
      bpm,
      startSlot: fresh ? live.current.startSlot : last.current!.slot(),
      loop: () => live.current.loop,
      onClick: (accent, at) => playClick(sound, accent, at),
      onSlot: (i) => live.current.onSlot(i),
      onEnd: () => live.current.onEnd(),
    });
    last.current = { restart, slot: run.slot };
    return run.stop;
  }, [running, bpm, sound, meter, slots, end, restart]);
}
