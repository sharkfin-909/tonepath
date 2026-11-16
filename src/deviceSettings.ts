// The remembered UI settings (SPEC §12.5), each with its validation and default — one place, read and written through
// `readSetting` / `writeSetting` (and `useDeviceSetting` in components).
import type { DeviceSetting } from './device';
import { ADVANCE_RULES, practiceCount, type AdvanceRule } from './practice';
import { clampBpm, clickSoundOf } from './metronome';
import type { ClickSound } from './audio';

/** The dock's layout (§8.5): Linear (true) or the 3-row honeycomb (false, default). */
export const HEX_LINEAR: DeviceSetting<boolean> = {
  key: 'hexShape',
  read: (raw) => raw === 'linear',
  store: (linear) => (linear ? 'linear' : 'honeycomb'),
};

/** The hex panel hidden (the chart takes the whole screen); shown by default. */
export const HEX_HIDDEN: DeviceSetting<boolean> = { key: 'hexHidden', read: (raw) => raw === true };

/** Practice's advance rule (§3.7), default Guide tone. */
export const PRACTICE_RULE: DeviceSetting<AdvanceRule> = {
  key: 'practiceRule',
  read: (raw) => (ADVANCE_RULES.some((r) => r.id === raw) ? (raw as AdvanceRule) : 'guide'),
};

/** Practice's Loop: on unless switched off. */
export const PRACTICE_LOOP: DeviceSetting<boolean> = { key: 'practiceLoop', read: (raw) => raw !== false };

/** Practice's note count per chord: 1, 2, 4, 8, 16 or 32 (default 4). */
export const PRACTICE_COUNT: DeviceSetting<number> = { key: 'practiceCount', read: practiceCount };

/** The metronome's tempo (30–300, default 100) and click sound (default Click). */
export const METRONOME_BPM: DeviceSetting<number> = { key: 'metronomeBpm', read: clampBpm };
export const METRONOME_SOUND: DeviceSetting<ClickSound> = { key: 'metronomeSound', read: clickSoundOf };
