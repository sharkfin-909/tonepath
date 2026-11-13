// Pure `hex` module (SPEC §8.1–8.2): docked-hex grid layout for a slot + range + dock size.
// 4 left-slanted rows; cell (r, c) = scale step t₀ + c + 2r; pitch anchor t₀ = lowest in-range scale tone;
// Fit range row lengths; largest radius that fits. Pitches are in the view's pitch (written for an instrument).

import { classify, scalePitchClasses, slotHarmony, type SlotHarmony } from './harmony';
import { pcName, slotSpelling, spelledDegree } from './spelling';

export const ROWS = 4;

/** A pitch range in MIDI. `limited: false` = a fixed view with nothing out of range (Concert). */
export interface PitchRange {
  lo: number;
  hi: number;
  limited: boolean;
}

/** Concert: fixed C3–C6 view (SPEC §8.1). */
export const CONCERT_VIEW: PitchRange = { lo: 48, hi: 84, limited: false };

export interface GridCell {
  /** Row from the bottom (0–3) and column from the row's left. */
  r: number;
  c: number;
  /** Scale steps above the anchor: c + 2r. */
  step: number;
  midi: number;
  /** Centre x in cell widths from the grid's left edge. */
  x: number;
  inRange: boolean;
}

export interface HexGrid {
  /** Top-row length; also the grid width in cell widths. */
  top: number;
  /** Cells per row, bottom → top. */
  rowLengths: number[];
  /** MIDI pitch at the bottom-left (the pitch anchor). */
  anchor: number;
  /** Scale steps in range (N). */
  stepsInRange: number;
  cells: GridCell[];
}

/** Grid for a set of pitch classes over a range (SPEC §8.1). */
export function hexGrid(pcs: Set<number>, range: PitchRange): HexGrid {
  const ladder: number[] = [];
  for (let m = 0; m <= 127; m++) if (pcs.has(m % 12)) ladder.push(m);
  const i0 = Math.max(0, ladder.findIndex((m) => m >= range.lo));
  const stepsInRange = ladder.filter((m) => m >= range.lo && m <= range.hi).length;
  const top = Math.max(4, stepsInRange - 2 * (ROWS - 1));
  const rowLengths: number[] = [];
  const cells: GridCell[] = [];
  for (let r = 0; r < ROWS; r++) {
    const offset = (ROWS - 1 - r) / 2; // each row half a cell left of the row below
    const n = Math.floor(top - offset);
    rowLengths.push(n);
    for (let c = 0; c < n; c++) {
      const step = c + 2 * r;
      const midi = ladder[Math.min(i0 + step, ladder.length - 1)];
      cells.push({ r, c, step, midi, x: offset + c + 0.5, inRange: !range.limited || (midi >= range.lo && midi <= range.hi) });
    }
  }
  return { top, rowLengths, anchor: ladder[i0], stepsInRange, cells };
}

/** Largest pointy-top cell radius (centre → vertex) that fits the dock, with padding. */
export function hexRadius(grid: HexGrid, width: number, height: number, pad = 12): number {
  const byWidth = (width - 2 * pad) / (Math.sqrt(3) * grid.top);
  const byHeight = (height - 2 * pad) / (2 + 1.5 * (ROWS - 1));
  return Math.max(0, Math.min(byWidth, byHeight));
}

/** Cell centre in px for a radius, with the grid centred in the dock. */
export function cellCentre(cell: GridCell, grid: HexGrid, R: number, width: number, height: number) {
  const w = Math.sqrt(3) * R;
  const gridH = 2 * R + 1.5 * R * (ROWS - 1);
  const x0 = (width - w * grid.top) / 2;
  const y0 = (height - gridH) / 2;
  return { cx: x0 + cell.x * w, cy: y0 + R + (ROWS - 1 - cell.r) * 1.5 * R };
}

export type CellRole = 'chord' | 'scale';

export interface HexCell extends GridCell {
  /** Note name, no octave (in the view's pitch). */
  name: string;
  /** Spelled degree 1–7: colour of the degree ring. */
  degree: number;
  role: CellRole;
}

export interface SlotHex extends Omit<HexGrid, 'cells'> {
  cells: HexCell[];
}

/**
 * The hex for a slot with a chord: its scale, or for a valid chord no scale fits, the **chord-tones hex** (each cell
 * the next chord tone up, all chord-tone centres; SPEC §8.4). Null for `N.C.`, empty and unparseable slots.
 */
export function slotHex(h: SlotHarmony, range: PitchRange = CONCERT_VIEW): SlotHex | null {
  if (h.kind !== 'chord') return null;
  const grid = hexGrid(h.scale ? scalePitchClasses(h.root, h.scale) : h.chordTones, range);
  const sp = slotSpelling(h);
  return {
    ...grid,
    cells: grid.cells.map((cell) => {
      const name = pcName(cell.midi, sp);
      return { ...cell, name, degree: spelledDegree(h.root, name), role: classify(cell.midi, h) === 'chord' ? 'chord' : 'scale' };
    }),
  };
}

export type DockMode = 'scale' | 'chord-tones' | 'rests-only';

export interface DockHex {
  hex: SlotHex;
  mode: DockMode;
  /** Dock label (SPEC §8.4); null for an ordinary scale hex. */
  label: string | null;
  /** Clicking the label focuses the active slot's chord field (empty / unparseable slots). */
  labelEditsChord: boolean;
}

const C_MAJOR: SlotHarmony = slotHarmony({ chord: 'C' });

/**
 * The docked hex for the active slot (SPEC §8.4). A slot without a scale (`N.C.`, empty, unparseable) shows the
 * **rests-only hex**: the layout of the nearest earlier slot with a scale, else the next one after it, else C major —
 * dimmed, every cell inactive. `harmonies` are per form slot, in the view's pitch.
 */
export function dockHex(harmonies: SlotHarmony[], active: number, range: PitchRange = CONCERT_VIEW): DockHex {
  const h = harmonies[active];
  if (h.kind === 'chord') {
    return h.scale
      ? { hex: slotHex(h, range)!, mode: 'scale', label: null, labelEditsChord: false }
      : { hex: slotHex(h, range)!, mode: 'chord-tones', label: 'No scale fits: chord tones only', labelEditsChord: false };
  }
  const scaled = (x: SlotHarmony) => x.kind === 'chord' && x.scale !== null;
  let source: SlotHarmony | undefined;
  for (let i = active - 1; i >= 0 && !source; i--) if (scaled(harmonies[i])) source = harmonies[i];
  for (let i = active + 1; i < harmonies.length && !source; i++) if (scaled(harmonies[i])) source = harmonies[i];
  const label =
    h.reason === 'nc'
      ? 'N.C. — rests only'
      : h.reason === 'empty'
        ? 'No chord yet: type one to enter notes'
        : 'Chord not recognised: fix the symbol to enter notes';
  return { hex: slotHex(source ?? C_MAJOR, range)!, mode: 'rests-only', label, labelEditsChord: h.reason !== 'nc' };
}

/** Degree-ring palette, degrees 1–7 (SPEC §8.2, user theme). */
export const DEGREE_COLOURS = ['#53131E', '#FFD52E', '#EC7C25', '#390099', '#9E0059', '#5BB561', '#12EAEA'];

export const HEX_THEME = {
  dock: '#D9D6CE',
  chordFill: '#FFFFFF',
  chordInk: '#1D1B19',
  scaleFill: '#938581',
  scaleInk: '#FFFFFF',
  outFill: '#BDBAB3',
  outInk: '#8A877F',
  ringWidth: 10,
  keyline: 2,
} as const;
