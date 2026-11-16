// Pure `modeProfile` module (SPEC §3.0–3.8): what each **mode** shows and lets through, in one place. The session's
// gate (`session.ts`), the keyboard table (`keymap.ts`), the chart, the chart zoom and the screen all read the
// profile instead of testing `mode === …` themselves, so a mode's rules change here and nowhere else.

import type { Mode } from './session';

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
   * undo / redo. Write etude; Improvise while stopped.
   */
  editsForm: boolean;
  /** The current slot moves by hand (← / →, < >, clicks): stopped. Write etude moves its caret instead. */
  movesByHand: boolean;
  /** Nothing on the chart answers a click (Read etude while running). */
  chartInert: boolean;

  // ——— What shows ———
  /** The header's own groups: Write etude's editing pill, Improvise's form group, the transport bar. */
  editPill: boolean;
  formGroup: boolean;
  transportBar: boolean;
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

export function modeProfile(mode: Mode, running = false): ModeProfile {
  const tune = mode === 'tune';
  const improvise = mode === 'improvise';
  const write = mode === 'write';
  const read = mode === 'read';
  const transport = improvise || read;
  running = running && transport; // only a mode with a transport runs
  return {
    mode,
    running,
    listens: tune || improvise,
    transport,
    editsMelody: write,
    editsForm: write || (improvise && !running),
    movesByHand: !running,
    chartInert: read && running,
    editPill: write,
    formGroup: improvise && !running,
    transportBar: transport,
    chartEmpty: tune,
    // Tune lays its (hidden) pane out as a lead sheet, so the chart's height doesn't change on the way to Improvise.
    chart: write ? 'write' : read ? 'read' : 'lead',
    // Improvise: the grid gives the chart the row above the tuner bar (it scrolls there). Read etude: no hex.
    chartBudget: read ? 'full' : improvise ? 'fill' : 'half',
    keyPills: !read,
    clef: write || read,
    hex: !read,
    hexHideable: improvise,
    noChord: tune,
    heardLights: tune || (improvise && !running),
    targets: improvise && running,
    writeLights: write,
  };
}
