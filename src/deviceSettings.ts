// The remembered UI settings (SPEC §12.5), each with its validation and default — one place, read and written through
// `readSetting` / `writeSetting` (and `useDeviceSetting` in components).
import type { DeviceSetting } from './device';
import { clampBpm, clickSoundOf } from './metronome';
import type { ClickSound } from './audio';
import { isMode, type Mode } from './session';

/** The dock's layout (§8.5): Linear (true) or the 3-row honeycomb (false, default). */
export const HEX_LINEAR: DeviceSetting<boolean> = {
  key: 'hexShape',
  read: (raw) => raw === 'linear',
  store: (linear) => (linear ? 'linear' : 'honeycomb'),
};

/** The hex panel hidden (the chart takes the whole screen); shown by default. */
export const HEX_HIDDEN: DeviceSetting<boolean> = { key: 'hexHidden', read: (raw) => raw === true };

/** The transport's Loop (§3.7), shared by Improvise and Read etude: on unless switched off. Stored as `practiceLoop`. */
export const TRANSPORT_LOOP: DeviceSetting<boolean> = { key: 'practiceLoop', read: (raw) => raw !== false };

/** The transport's tempo (30–300, default 100) and click sound (default Click), shared by both modes. */
export const METRONOME_BPM: DeviceSetting<number> = { key: 'metronomeBpm', read: clampBpm };
export const METRONOME_SOUND: DeviceSetting<ClickSound> = { key: 'metronomeSound', read: clickSoundOf };

export const CHORD_BUMP_NOTES_OPTIONS = [1, 2, 4, 8, 16, 32] as const;
export type ChordBumpNotes = (typeof CHORD_BUMP_NOTES_OPTIONS)[number];

/** Grid improv's chord bump switch: on, the chords move on after N notes picked; off (default), the transport moves them. */
export const CHORD_BUMP: DeviceSetting<boolean> = { key: 'chordBump', read: (raw) => raw === true };

/** The mode last used: the next open starts there (none yet: grid improv). */
export const LAST_MODE: DeviceSetting<Mode | undefined> = { key: 'lastMode', read: (raw) => (isMode(raw) ? raw : undefined) };

/** Grid improv, by notes: after this many hex picks in a slot, move on to the next chord. */
export const CHORD_BUMP_NOTES: DeviceSetting<ChordBumpNotes> = {
  key: 'chordBumpNotes',
  read: (raw) => {
    const n = typeof raw === 'number' ? raw : 4;
    return CHORD_BUMP_NOTES_OPTIONS.includes(n as ChordBumpNotes) ? (n as ChordBumpNotes) : 4;
  },
};
