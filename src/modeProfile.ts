// Pure `modeProfile` module (SPEC §3.0–3.8): what each **mode** shows and lets through, in one place. The session's
// gate (`session.ts`), the keyboard table (`keymap.ts`), the chart, the chart zoom and the screen all read the
// profile instead of testing `mode === …` themselves, so a mode's rules change here and nowhere else.

import type { Mode } from './session';

/** Grid improv's one choice (SPEC §3.11): the chords move on after N notes picked (chord bump) or in time (the transport). */
export type MoveBy = 'notes' | 'time';

/** How the chart draws its slots: Improvise's lead sheet, Write etude's cards, Read etude's continuous staves. */
export type ChartKind = 'lead' | 'write' | 'read';

/** How tall the chart may be: half the space under the header, the whole of it, or the grid row it is given. */
export type ChartBudget = 'half' | 'full' | 'fill';

export interface ModeProfile {
  mode: Mode;
  running: boolean;

  /** Listen is on: the mic, the tuner bar (SPEC §9.2). */
  listens: boolean;
  /** The transport bar and the playhead (SPEC §3.7). */
  transport: boolean;

  // ——— What edits ———
  /** Write etude: the melody (entry, lengths, Rest, delete, nudge, step-play, Clear). */
  editsMelody: boolean;
  /**
   * The form and the chart's tonality: chords, scales, time signature, bars per row, the ⋯ bar menu, "+", the trash,
   * Clear all. Edit progression alone, while stopped.
   */
  editsForm: boolean;
  /** Edit etude and ins read work over the chords: with none, they can't be picked (SPEC §3.0). */
  needsChords: boolean;
  /** The current slot moves by hand (← / →, < >, clicks): stopped. Write etude moves its caret instead. */
  movesByHand: boolean;
  /** Nothing on the chart answers a click (Read etude while running). */
  chartInert: boolean;

  // ——— What shows ———
  /** The header's own groups: edit etude's editing pill, edit progression's form group, the transport bar. */
  editPill: boolean;
  formGroup: boolean;
  transportBar: boolean;
  /** The transport's loop pickers (looped bars): not in progression, which only plays the form back. */
  loopPickers: boolean;
  /** Grid improv: the *move on* control (by notes | in time). */
  moveOn: boolean;
  /** Grid improv, by notes: hex picks in a slot move the form on after N notes. */
  chordBump: boolean;
  /** A slot reached by hand keeps its *On arrival* sound for the first note picked or played there (stopped). */
  arrivalWaits: boolean;
  /** Tune: the chart pane keeps its height, empty (SPEC §3.8). */
  chartEmpty: boolean;
  chart: ChartKind;
  chartBudget: ChartBudget;
  /** The key pills and key mates (SPEC §3.1): not in Read etude. */
  keyPills: boolean;
  /** The clef gutter's clef: not on Improvise's lead sheet (no stave). */
  clef: boolean;
  /** The docked hex (not in Read etude); Hide hex can hide it (Improvise only). */
  hex: boolean;
  hexHideable: boolean;
  /** Tune: the unchecked hex (every pitch, no slot); the sound pill's chord controls greyed. */
  noChord: boolean;

  // ——— What lights the hex ———
  /** Heard notes light the hex: Tune, and Improvise while stopped (SPEC §3.3, §3.8). */
  heardLights: boolean;
  /** Improvise running: the upcoming chord's tones ringed; the hex holds still. */
  targets: boolean;
  /** Write etude: the nudge halo and the stepped / clicked note light the hex. */
  writeLights: boolean;
}

export function modeProfile(
  mode: Mode,
  running = false,
  moveBy: MoveBy = 'notes',
  /** A standard progression (SPEC §3.12): its chords never edit. */
  locked = false,
): ModeProfile {
  const progression = mode === 'progression';
  const grid = mode === 'grid';
  const tune = mode === 'tune';
  const improvise = mode === 'improvise';
  const write = mode === 'write';
  const read = mode === 'read';
  const transport = progression || improvise || read || (grid && moveBy === 'time');
  running = running && transport; // only a mode with a transport runs
  /** The lead sheet's modes that play over the chords (Tune's chart pane is empty). */
  const lead = progression || grid || improvise;
  return {
    mode,
    running,
    listens: tune || improvise,
    transport,
    editsMelody: write,
    editsForm: progression && !running && !locked,
    needsChords: write || read,
    movesByHand: !running,
    chartInert: read && running,
    editPill: write,
    formGroup: progression && !running && !locked,
    transportBar: transport,
    loopPickers: transport && !progression,
    moveOn: grid,
    chordBump: grid && moveBy === 'notes',
    arrivalWaits: lead && !running,
    chartEmpty: tune,
    // Tune lays its (hidden) pane out as a lead sheet, so the chart's height doesn't change on the way to Improvise.
    chart: write ? 'write' : read ? 'read' : 'lead',
    // The lead sheet's modes: the grid gives the chart the row above the hex panel (it scrolls there). Read etude: no hex.
    chartBudget: read ? 'full' : lead ? 'fill' : 'half',
    keyPills: !read,
    clef: write || read,
    hex: !read,
    hexHideable: improvise,
    noChord: tune,
    heardLights: tune || (improvise && !running),
    targets: lead && running,
    writeLights: write,
  };
}
