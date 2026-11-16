// Device settings (SPEC §12.5): `tonepath:device`, never exported. Reads / writes `muted`, `playArrival`,
// `lastInstrument`, `lastOpenId`, `seeded`, `seededDemos`, `v`, `lastBackupAt`, `reminderDismissedAt`, `hexShape`,
// `practiceRule`, `practiceLoop` and `micGainDb`; unknown fields are preserved untouched.

import { isReadOnly } from './readOnly';

export const DEVICE_KEY = 'tonepath:device';

export type OnArrival = 'silent' | 'chord' | 'root' | 'bass' | 'bass-chord';
const ARRIVALS: OnArrival[] = ['silent', 'chord', 'root', 'bass', 'bass-chord'];

/** UI labels for *On arrival* — shown as *Audio on chord* (SPEC §3.3). */
export const ON_ARRIVAL_LABELS: Record<OnArrival, string> = {
  silent: 'Silent',
  chord: 'Chord',
  root: 'Root note',
  bass: 'Bass note',
  'bass-chord': 'Bass note + chord',
};

export function onArrivalOf(d: DeviceSettings): OnArrival {
  return ARRIVALS.includes(d.playArrival as OnArrival) ? (d.playArrival as OnArrival) : 'silent';
}

export interface DeviceSettings {
  muted?: boolean;
  /** Listen's input level control (SPEC §9.2), in dB: −12 … +24, default 0. */
  micGainDb?: number;
  /** Practice (SPEC §3.7): the advance rule, and whether the form loops (default) or stops at the end. */
  practiceRule?: string;
  practiceLoop?: boolean;
  /** Practice: the note count per chord (count rules), default 4. */
  practiceCount?: number;
  /** Practice's metronome: tempo (bpm, 30–300, default 100) and click sound. */
  metronomeBpm?: number;
  metronomeSound?: string;
  /** The dock's layout (SPEC §8.5): the honeycomb (default) or one row, Linear. */
  hexShape?: 'honeycomb' | 'linear';
  /** The hex panel hidden (SPEC §3.1). */
  hexHidden?: boolean;
  /** Play mode *On arrival* (SPEC §3.3). */
  playArrival?: OnArrival;
  /** Last-picked instrument: the default for new progressions (SPEC §10). */
  lastInstrument?: string;
  /** The progression to reopen on launch (SPEC §12.5). */
  lastOpenId?: string;
  /** The bundled demo has been seeded once (deleting it is permanent). */
  seeded?: boolean;
  /** Further bundled demos already added (by key), each once (SPEC §12.5). */
  seededDemos?: string[];
  /** Last Export all (SPEC §3.5 backup reminder). */
  lastBackupAt?: string;
  /** The reminder was dismissed at this time; it returns after the next change. */
  reminderDismissedAt?: string;
  /** Schema version of all storage (SPEC §12.4). */
  v?: number;
  [key: string]: unknown;
}

export function readDevice(storage: Storage): DeviceSettings {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(DEVICE_KEY) ?? '{}');
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as DeviceSettings) : {};
  } catch {
    return {};
  }
}

/** Merge a change into the device key, keeping fields this slice doesn't know. */
export function writeDevice(storage: Storage, change: Partial<DeviceSettings>): DeviceSettings {
  const next = { ...readDevice(storage), ...change };
  if (isReadOnly()) return next;
  try {
    storage.setItem(DEVICE_KEY, JSON.stringify(next));
  } catch (err) {
    console.warn('Tonepath: could not save device settings', err);
  }
  return next;
}

/**
 * One remembered setting (SPEC §12.5): its key in the device record, how a stored value is read — validated, with the
 * default for anything missing or bad — and, when the value isn't stored as is, how it is stored.
 */
export interface DeviceSetting<T> {
  key: string;
  read: (raw: unknown) => T;
  store?: (value: T) => unknown;
}

export function readSetting<T>(storage: Storage, setting: DeviceSetting<T>): T {
  return setting.read(readDevice(storage)[setting.key]);
}

/** Store a setting's value (as read back, so a later read gives the same value). */
export function writeSetting<T>(storage: Storage, setting: DeviceSetting<T>, value: T): T {
  const v = setting.read(setting.store ? setting.store(value) : value);
  writeDevice(storage, { [setting.key]: setting.store ? setting.store(v) : v });
  return v;
}
