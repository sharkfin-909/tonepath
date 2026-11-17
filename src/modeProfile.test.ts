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
  it('six modes, the hex grid three first, then the instrument three', () => {
    expect(MODES).toEqual(['progression', 'write', 'grid', 'tune', 'improvise', 'read']);
  });

  it.each<[Mode, boolean, ReturnType<typeof pick>]>([
    ['progression', false, { listens: false, transport: true, editsMelody: false, editsForm: true, movesByHand: true, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: true, heardLights: false, targets: false }],
    ['progression', true, { listens: false, transport: true, editsMelody: false, editsForm: false, movesByHand: false, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: true, heardLights: false, targets: true }],
    ['write', false, { listens: false, transport: false, editsMelody: true, editsForm: true, movesByHand: true, chartInert: false, chart: 'write', chartBudget: 'half', hex: true, heardLights: false, targets: false }],
    ['grid', false, { listens: false, transport: false, editsMelody: false, editsForm: false, movesByHand: true, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: true, heardLights: false, targets: false }],
    ['tune', false, { listens: true, transport: false, editsMelody: false, editsForm: false, movesByHand: true, chartInert: false, chart: 'lead', chartBudget: 'half', hex: true, heardLights: true, targets: false }],
    ['improvise', false, { listens: true, transport: true, editsMelody: false, editsForm: true, movesByHand: true, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: true, heardLights: true, targets: false }],
    ['improvise', true, { listens: true, transport: true, editsMelody: false, editsForm: false, movesByHand: false, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: true, heardLights: false, targets: true }],
    ['read', false, { listens: false, transport: true, editsMelody: false, editsForm: false, movesByHand: true, chartInert: false, chart: 'read', chartBudget: 'full', hex: false, heardLights: false, targets: false }],
    ['read', true, { listens: false, transport: true, editsMelody: false, editsForm: false, movesByHand: false, chartInert: true, chart: 'read', chartBudget: 'full', hex: false, heardLights: false, targets: false }],
  ])('%s (running: %s)', (mode, running, expected) => {
    expect(pick(modeProfile(mode, running))).toEqual(expected);
  });

  it('grid improv moves on by notes (chord bump) or in time (the transport), never both', () => {
    const notes = modeProfile('grid', false, 'notes');
    expect(notes).toMatchObject({ chordBump: true, transport: false, transportBar: false, moveOn: true });
    expect(modeProfile('grid', true, 'notes').running).toBe(false); // no transport to run
    const time = modeProfile('grid', false, 'time');
    expect(time).toMatchObject({ chordBump: false, transport: true, transportBar: true, moveOn: true });
    expect(modeProfile('grid', true, 'time')).toMatchObject({ running: true, targets: true, movesByHand: false });
    // Chord bump is grid improv's alone; the move-on choice too.
    expect(MODES.filter((m) => modeProfile(m).chordBump)).toEqual(['grid']);
    expect(MODES.filter((m) => modeProfile(m).moveOn)).toEqual(['grid']);
  });

  it('only a mode with a transport runs', () => {
    for (const mode of MODES) expect(modeProfile(mode, true).running).toBe(modeProfile(mode).transport);
    expect(modeProfile('write', true).editsForm).toBe(true);
  });

  it("each mode's own header group: the editing pill, the form group (stopped), the transport bar and its loop pickers", () => {
    expect(MODES.filter((m) => modeProfile(m).editPill)).toEqual(['write']);
    expect(MODES.filter((m) => modeProfile(m).formGroup)).toEqual(['progression', 'improvise']);
    expect(modeProfile('improvise', true).formGroup).toBe(false);
    expect(MODES.filter((m) => modeProfile(m).transportBar)).toEqual(['progression', 'improvise', 'read']);
    // Progression plays the form back to hear it: nothing to practise, so no looped bars.
    expect(MODES.filter((m) => modeProfile(m, false, 'time').loopPickers)).toEqual(['grid', 'improvise', 'read']);
  });

  it("a slot reached by hand waits for the first note picked or played to sound (On arrival): the lead sheet's modes but Tune", () => {
    expect(MODES.filter((m) => modeProfile(m).arrivalWaits)).toEqual(['progression', 'grid', 'improvise']);
    expect(modeProfile('improvise', true).arrivalWaits).toBe(false);
  });

  it('key pills everywhere but Read etude; a clef only over a stave; Hide hex only in ins improv', () => {
    expect(MODES.filter((m) => !modeProfile(m).keyPills)).toEqual(['read']);
    expect(MODES.filter((m) => modeProfile(m).clef)).toEqual(['write', 'read']);
    expect(MODES.filter((m) => modeProfile(m).hexHideable)).toEqual(['improvise']);
  });
});
