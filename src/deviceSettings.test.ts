// Remembered settings (SPEC §12.5): validated on read, with defaults; stored as read back.
import { describe, expect, it } from 'vitest';
import { readDevice, readSetting, writeDevice, writeSetting } from './device';
import { HEX_LINEAR, METRONOME_BPM, METRONOME_SOUND, PRACTICE_COUNT, PRACTICE_LOOP, PRACTICE_RULE } from './deviceSettings';
import { MemoryStorage } from './test-memory-storage';

describe('device settings', () => {
  it('defaults when missing', () => {
    const s = new MemoryStorage();
    expect([readSetting(s, HEX_LINEAR), readSetting(s, PRACTICE_RULE), readSetting(s, PRACTICE_LOOP), readSetting(s, PRACTICE_COUNT)]).toEqual([false, 'guide', true, 4]);
    expect([readSetting(s, METRONOME_BPM), readSetting(s, METRONOME_SOUND)]).toEqual([100, 'click']);
  });

  it('bad stored values read as the defaults (or the nearest allowed)', () => {
    const s = new MemoryStorage();
    writeDevice(s, { hexShape: 'cube' as never, practiceRule: 'vibes', practiceLoop: 'no' as never, practiceCount: 7, metronomeBpm: 999, metronomeSound: 'woodblock' });
    expect([readSetting(s, HEX_LINEAR), readSetting(s, PRACTICE_RULE), readSetting(s, PRACTICE_LOOP), readSetting(s, PRACTICE_COUNT)]).toEqual([false, 'guide', true, 8]);
    expect([readSetting(s, METRONOME_BPM), readSetting(s, METRONOME_SOUND)]).toEqual([300, 'click']);
  });

  it('write stores the value as it reads back (clamped), in its stored form, keeping other fields', () => {
    const s = new MemoryStorage();
    writeDevice(s, { muted: true });
    expect(writeSetting(s, METRONOME_BPM, 12)).toBe(30);
    expect(writeSetting(s, HEX_LINEAR, true)).toBe(true);
    expect(readDevice(s)).toMatchObject({ muted: true, metronomeBpm: 30, hexShape: 'linear' });
    writeSetting(s, PRACTICE_LOOP, false);
    expect(readSetting(s, PRACTICE_LOOP)).toBe(false);
  });
});
