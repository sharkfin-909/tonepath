// What each mode shows and lets through (SPEC §3.0–3.8), as one table.
import { describe, expect, it } from 'vitest';
import { modeProfile, type ModeProfile } from './modeProfile';
import { MODES, type Mode } from './session';

const pick = (m: ModeProfile) => ({
  listens: m.listens,
  transport: m.transport,
  editsMelody: m.editsMelody,
  editsForm: m.editsForm,
  movesByHand: m.movesByHand,
  chartInert: m.chartInert,
  chart: m.chart,
  chartBudget: m.chartBudget,
  hex: m.hex,
  heardLights: m.heardLights,
  targets: m.targets,
});

describe('mode profile', () => {
  it.each<[Mode, boolean, ReturnType<typeof pick>]>([
    ['tune', false, { listens: true, transport: false, editsMelody: false, editsForm: false, movesByHand: true, chartInert: false, chart: 'lead', chartBudget: 'half', hex: true, heardLights: true, targets: false }],
    ['improvise', false, { listens: true, transport: true, editsMelody: false, editsForm: true, movesByHand: true, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: true, heardLights: true, targets: false }],
    ['improvise', true, { listens: true, transport: true, editsMelody: false, editsForm: false, movesByHand: false, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: true, heardLights: false, targets: true }],
    ['write', false, { listens: false, transport: false, editsMelody: true, editsForm: true, movesByHand: true, chartInert: false, chart: 'write', chartBudget: 'half', hex: true, heardLights: false, targets: false }],
    ['read', false, { listens: false, transport: true, editsMelody: false, editsForm: false, movesByHand: true, chartInert: false, chart: 'read', chartBudget: 'full', hex: false, heardLights: false, targets: false }],
    ['read', true, { listens: false, transport: true, editsMelody: false, editsForm: false, movesByHand: false, chartInert: true, chart: 'read', chartBudget: 'full', hex: false, heardLights: false, targets: false }],
  ])('%s (running: %s)', (mode, running, expected) => {
    expect(pick(modeProfile(mode, running))).toEqual(expected);
  });

  it('only a mode with a transport runs', () => {
    for (const mode of MODES) expect(modeProfile(mode, true).running).toBe(modeProfile(mode).transport);
    expect(modeProfile('write', true).editsForm).toBe(true);
  });

  it("each mode's own header group: Write etude's editing pill, Improvise's form group (stopped), the transport bar", () => {
    expect(MODES.filter((m) => modeProfile(m).editPill)).toEqual(['write']);
    expect(MODES.filter((m) => modeProfile(m).formGroup)).toEqual(['improvise']);
    expect(modeProfile('improvise', true).formGroup).toBe(false);
    expect(MODES.filter((m) => modeProfile(m).transportBar)).toEqual(['improvise', 'read']);
  });

  it('key pills everywhere but Read etude; a clef only over a stave; Hide hex only in Improvise', () => {
    expect(MODES.filter((m) => !modeProfile(m).keyPills)).toEqual(['read']);
    expect(MODES.filter((m) => modeProfile(m).clef)).toEqual(['write', 'read']);
    expect(MODES.filter((m) => modeProfile(m).hexHideable)).toEqual(['improvise']);
  });
});
