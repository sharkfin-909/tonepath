// Device settings (SPEC §12.5): `honeycomb:device`, never exported. Reads / writes `muted`, `playArrival`,
// `lastInstrument`, `lastOpenId`, `seeded`, `v`, `lastBackupAt` and `reminderDismissedAt`; unknown fields are
// preserved untouched.

import { isReadOnly } from './readOnly';

export const DEVICE_KEY = 'honeycomb:device';

export type OnArrival = 'silent' | 'chord' | 'root';

export function onArrivalOf(d: DeviceSettings): OnArrival {
  return d.playArrival === 'chord' || d.playArrival === 'root' ? d.playArrival : 'silent';
}

export interface DeviceSettings {
  muted?: boolean;
  /** Play mode *On arrival* (SPEC §3.3). */
  playArrival?: OnArrival;
  /** Last-picked instrument: the default for new progressions (SPEC §10). */
  lastInstrument?: string;
  /** The progression to reopen on launch (SPEC §12.5). */
  lastOpenId?: string;
  /** The bundled demo has been seeded once (deleting it is permanent). */
  seeded?: boolean;
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
    console.warn('Honeycomb: could not save device settings', err);
  }
  return next;
}
