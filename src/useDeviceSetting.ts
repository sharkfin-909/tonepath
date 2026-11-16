// A remembered setting as React state (SPEC §12.5): read once (validated), and stored on every change.
import { useState } from 'react';
import { readSetting, writeSetting, type DeviceSetting } from './device';

export function useDeviceSetting<T>(setting: DeviceSetting<T>): [T, (value: T) => void] {
  const [value, setValue] = useState(() => readSetting(localStorage, setting));
  return [value, (next: T) => setValue(writeSetting(localStorage, setting, next))];
}
