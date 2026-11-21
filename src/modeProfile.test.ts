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
    expect(MODES).toEqual(['progression', 'grid', 'write', 'tune', 'improvise', 'read']);
  });

  it.each<[Mode, boolean, ReturnType<typeof pick>]>([
    ['progression', false, { listens: false, transport: true, editsMelody: false, editsForm: true, movesByHand: true, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: false, heardLights: false, targets: false }],
    ['progression', true, { listens: false, transport: true, editsMelody: false, editsForm: false, movesByHand: false, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: false, heardLights: false, targets: false }],
    ['write', false, { listens: false, transport: false, editsMelody: true, editsForm: false, movesByHand: true, chartInert: false, chart: 'write', chartBudget: 'half', hex: true, heardLights: false, targets: false }],
    ['grid', false, { listens: false, transport: false, editsMelody: false, editsForm: false, movesByHand: true, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: true, heardLights: false, targets: false }],
    ['tune', false, { listens: true, transport: false, editsMelody: false, editsForm: false, movesByHand: true, chartInert: false, chart: 'lead', chartBudget: 'half', hex: true, heardLights: true, targets: false }],
    ['improvise', false, { listens: true, transport: true, editsMelody: false, editsForm: false, movesByHand: true, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: true, heardLights: true, targets: false }],
    ['improvise', true, { listens: true, transport: true, editsMelody: false, editsForm: false, movesByHand: false, chartInert: false, chart: 'lead', chartBudget: 'fill', hex: true, heardLights: false, targets: false }],
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
    expect(modeProfile('grid', true, 'time')).toMatchObject({ running: true, targets: false, movesByHand: false }); // no next-chord hint
    // Chord bump is grid improv's alone; the move-on choice too.
    expect(MODES.filter((m) => modeProfile(m).chordBump)).toEqual(['grid']);
    expect(MODES.filter((m) => modeProfile(m).moveOn)).toEqual(['grid']);
  });

  it('only a mode with a transport runs', () => {
    for (const mode of MODES) expect(modeProfile(mode, true).running).toBe(modeProfile(mode).transport);
    expect(MODES.filter((m) => modeProfile(m).editsForm)).toEqual(['progression']); // the chords: edit progression's alone
  });

  it("each mode's own header group: the editing pill, the form group (stopped), the transport bar and its loop pickers", () => {
    expect(MODES.filter((m) => modeProfile(m).editPill)).toEqual(['write']);
    expect(MODES.filter((m) => modeProfile(m).formGroup)).toEqual(['progression']);
    expect(modeProfile('progression', true).formGroup).toBe(false);
    expect(MODES.filter((m) => modeProfile(m).transportBar)).toEqual(['progression', 'improvise', 'read']);
    // The loop pill (Loop, whole form, the bar pickers): the modes you practise in — grid improv either way.
    expect(MODES.filter((m) => modeProfile(m).loopPill)).toEqual(['grid', 'improvise', 'read']);
    expect(modeProfile('grid', false, 'time').loopPill).toBe(true);
    // Progression plays the form back to hear it: its transport keeps a plain Loop switch, no looped bars.
    expect(MODES.filter((m) => modeProfile(m).transport && !modeProfile(m).loopPill)).toEqual(['progression']);
  });

  it("a slot reached by hand waits for the first note picked or played to sound (On arrival): the lead sheet's modes but Tune", () => {
    expect(MODES.filter((m) => modeProfile(m).arrivalWaits)).toEqual(['progression', 'grid', 'improvise']);
    expect(modeProfile('improvise', true).arrivalWaits).toBe(false);
  });

  it('a standard (locked): edit progression shows it read-only — no form group, nothing edits; ▶ still plays', () => {
    expect(modeProfile('progression', false, 'notes', true)).toMatchObject({ editsForm: false, formGroup: false, transport: true, hex: false });
    expect(modeProfile('write', false, 'notes', true)).toMatchObject({ editsMelody: true, editPill: true });
  });

  it('edit etude and ins read need chords to work over', () => {
    expect(MODES.filter((m) => modeProfile(m).needsChords)).toEqual(['write', 'read']);
  });

  it('key pills everywhere but Read etude; a clef only over a stave; Hide hex only in ins improv', () => {
    expect(MODES.filter((m) => !modeProfile(m).keyPills)).toEqual(['read']);
    expect(MODES.filter((m) => modeProfile(m).clef)).toEqual(['write', 'read']);
    expect(MODES.filter((m) => modeProfile(m).hexHideable)).toEqual(['improvise']);
  });
});
