// What lights the docked hex, by mode (SPEC §3.3, §3.8, §6.2).
import { describe, expect, it } from 'vitest';
import { withFlat } from './test-progression';
import { hexLighting, type HexLightingInput } from './hexLighting';
import { modeProfile } from './modeProfile';
import { newProgression } from './progression';
import type { Mode } from './session';
import { instrumentView } from './view';

/** Dm7 | G7 | Cmaj7, on B♭ trumpet (written a tone above concert). */
const view = instrumentView(withFlat(newProgression(), {
  instrument: 'bb-trumpet',
  bars: [[{ chord: 'Dm7' }], [{ chord: 'G7' }], [{ chord: 'Cmaj7' }]],
  melody: [],
}));

const light = (mode: Mode, running: boolean, more: Partial<HexLightingInput> = {}) =>
  hexLighting({ profile: modeProfile(mode, running), view, active: 0, range: null, heard: 60, sounded: { midi: 62, n: 1 }, halo: 64, ...more });

describe('hex lighting', () => {
  it('a heard note lights the hex in Tune and in Improvise while stopped, at its written pitch', () => {
    expect(light('tune', false).heard).toBe(62);
    expect(light('improvise', false).heard).toBe(62);
    expect(light('improvise', true).heard).toBeNull();
    expect(light('write', false).heard).toBeNull();
    expect(light('tune', false, { heard: null }).heard).toBeNull();
  });

  it("Improvise running: the upcoming chord's tones ringed, the hex held still", () => {
    const l = light('improvise', true);
    expect([...l.targets!.pcs].sort((a, b) => a - b)).toEqual([1, 4, 7, 9]); // G7 written for B♭ trumpet: A C♯ E G
    expect(l.still).toBe(true);
    expect(light('improvise', false).targets).toBeNull();
    expect(light('improvise', false).still).toBe(false);
  });

  it("Write etude only: the nudge halo and the stepped note, at their written pitch", () => {
    expect(light('write', false)).toMatchObject({ halo: 66, sounded: { midi: 64, n: 1 } });
    for (const mode of ['tune', 'improvise', 'read'] as const) expect(light(mode, false)).toMatchObject({ halo: null, sounded: null });
  });
});
