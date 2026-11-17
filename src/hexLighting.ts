// Pure `hexLighting` module (SPEC §3.3, §3.8, §6.2, §8): what lights the docked hex, by mode — the pitch the mic
// hears (Tune; Improvise while stopped), the upcoming chord's tones ringed (Improvise running, the hex held still),
// Write etude's nudge halo and its stepped / clicked note. Concert pitches in, written pitches out (the hex is drawn
// in the instrument's written pitch).

import type { ModeProfile } from './modeProfile';
import { upcomingTargets, type SlotRange } from './transport';
import type { InstrumentView } from './view';

export interface HexLightingInput {
  profile: ModeProfile;
  view: Pick<InstrumentView, 'slots' | 'toWritten'>;
  /** The active slot (its index in the form). */
  active: number;
  /** The looped bars as slots (the targets wrap within them), or null. */
  range: SlotRange | null;
  /** The note the mic hears (concert), or null. */
  heard: number | null;
  /** Write etude: the last stepped / clicked melody note (concert); `n` replays. */
  sounded: { midi: number; n: number } | null;
  /** Write etude: the last nudged pitch (concert), while caret and melody stay as the nudge left them. */
  halo: number | null;
}

/** The docked hex's lighting props (written pitch). */
export interface HexLighting {
  halo: number | null;
  heard: number | null;
  targets: { pcs: Set<number>; midi: null } | null;
  sounded: { midi: number; n: number } | null;
  /** The hex holds still (no slot-change motion) while the transport runs: each chord lands at once. */
  still: boolean;
}

export function hexLighting(i: HexLightingInput): HexLighting {
  const { profile: m, view } = i;
  const pcs = m.targets ? upcomingTargets(view, i.range, i.active) : null;
  return {
    halo: m.writeLights && i.halo !== null ? view.toWritten(i.halo) : null,
    heard: m.heardLights && i.heard !== null ? view.toWritten(i.heard) : null,
    targets: pcs && { pcs, midi: null },
    sounded: m.writeLights && i.sounded ? { midi: view.toWritten(i.sounded.midi), n: i.sounded.n } : null,
    still: m.running,
  };
}
