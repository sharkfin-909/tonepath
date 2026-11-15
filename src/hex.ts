// Pure `hex` module (SPEC §8): the docked hex for a slot + range — its grid, cells and border buttons — and the dock
// for the active slot (with its key and root, for the travel plan). Honeycomb: 3 left-slanted rows, cell (r, c) =
// scale step t₀ + c + 2r, pitch anchor t₀ = lowest in-range scale tone, Fit range row lengths. Linear (§8.5): one
// octave in one row. Cell size for a dock (`hexSize`, `cellCentre`); placing everything is `hexLayout.ts`. Also the
// hex's proportions and timings (HEX_THEME; its colours are CSS tokens) and the degree colours. Pitches are in the
// view's pitch (written for an instrument).

import { classify, scalePitchClasses, triadPitchClasses, guidePitchClasses, slotHarmony, type SlotHarmony } from './harmony';
import { keyOf, type Key } from './key';
import { pcName, pcOfName, slotSpelling, spelledDegree } from './spelling';

export const ROWS = 3;

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
  /** Rows: 3 for the honeycomb, 1 for Linear. */
  rows: number;
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

/**
 * Steps a 7-note scale has in a range (SPEC §8.1 Fit range): every scale hex is sized from this, so the grid keeps
 * its shape and cell size whatever the key or scale; only which pitches sit at the ends changes.
 */
export const fitSteps = (range: PitchRange) => Math.floor(((range.hi - range.lo) * 7) / 12) + 1;

/**
 * Grid for a set of pitch classes over a range (SPEC §8.1). `ownSize`: size from this set's own steps in the range
 * (the chord-tones hex) instead of the fixed 7-note fit.
 */
export function hexGrid(pcs: Set<number>, range: PitchRange, ownSize = false): HexGrid {
  const ladder: number[] = [];
  for (let m = 0; m <= 127; m++) if (pcs.has(m % 12)) ladder.push(m);
  const i0 = Math.max(0, ladder.findIndex((m) => m >= range.lo));
  const stepsInRange = ladder.filter((m) => m >= range.lo && m <= range.hi).length;
  const top = Math.max(4, (ownSize ? stepsInRange : fitSteps(range)) - 2 * (ROWS - 1));
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
  return { rows: ROWS, top, rowLengths, anchor: ladder[i0], stepsInRange, cells };
}

/**
 * How the dock lays out the hex: the 3-row honeycomb, or **Linear** — one row, one octave of the scale from `octave`
 * (the MIDI of a C) up, switched by octave (SPEC §8.5).
 */
export type HexShape = { kind: 'honeycomb' } | { kind: 'linear'; octave: number };
export const HONEYCOMB: HexShape = { kind: 'honeycomb' };

/**
 * Linear (SPEC §8.5): one row — the scale's steps from the first at or above `octave` (a C), one octave's worth plus
 * the octave above (8 cells for a 7-note scale), so every key shows the same number of cells.
 */
export function linearGrid(pcs: Set<number>, range: PitchRange, octave: number): HexGrid {
  const ladder: number[] = [];
  for (let m = 0; m <= 127; m++) if (pcs.has(m % 12)) ladder.push(m);
  const i0 = Math.max(0, ladder.findIndex((m) => m >= octave));
  const n = pcs.size + 1;
  const cells: GridCell[] = [];
  for (let c = 0; c < n; c++) {
    const midi = ladder[Math.min(i0 + c, ladder.length - 1)];
    cells.push({ r: 0, c, step: c, midi, x: c + 0.5, inRange: !range.limited || (midi >= range.lo && midi <= range.hi) });
  }
  const stepsInRange = ladder.filter((m) => m >= range.lo && m <= range.hi).length;
  return { rows: 1, top: n, rowLengths: [n], anchor: ladder[i0], stepsInRange, cells };
}

/** Linear's octave switch (SPEC §8.5): the Cs whose octave overlaps the range, and where it starts (mid-range). */
export function linearOctaves(range: PitchRange): { min: number; max: number; start: number } {
  const c = (m: number) => Math.floor(m / 12) * 12;
  const min = c(range.lo);
  const max = Math.max(min, c(range.hi) === range.hi ? range.hi - 12 : c(range.hi));
  return { min, max, start: Math.min(max, Math.max(min, c((range.lo + range.hi) / 2))) };
}

/**
 * Cell size for the dock: `rx` = horizontal radius (a cell is √3·rx wide), `ry` = vertical radius (centre → top
 * vertex). Cells are regular hexagons (ry = rx), the largest that fit both the width and the height.
 */
export interface HexSize {
  rx: number;
  ry: number;
}

/** Padding inside the dock: left / right, and top / bottom. */
export const HEX_PAD_X = 24;
export const HEX_PAD_Y = 24;

export function hexSize(grid: HexGrid, width: number, height: number, padX = HEX_PAD_X, padY = HEX_PAD_Y): HexSize {
  const byWidth = (width - 2 * padX) / (Math.sqrt(3) * grid.top);
  const byHeight = (height - 2 * padY) / (2 + 1.5 * (grid.rows - 1));
  const rx = Math.max(0, Math.min(byWidth, byHeight));
  return { rx, ry: rx };
}

/** Cell centre in px for a cell size, with the grid centred in the dock. */
export function cellCentre(cell: GridCell, grid: HexGrid, size: HexSize, width: number, height: number) {
  const w = Math.sqrt(3) * size.rx;
  const gridH = 2 * size.ry + 1.5 * size.ry * (grid.rows - 1);
  const x0 = (width - w * grid.top) / 2;
  const y0 = (height - gridH) / 2;
  return { cx: x0 + cell.x * w, cy: y0 + size.ry + (grid.rows - 1 - cell.r) * 1.5 * size.ry };
}

export type CellRole = 'chord' | 'scale';

export interface HexCell extends GridCell {
  /** Note name, no octave (in the view's pitch). */
  name: string;
  /** Spelled degree 1–7: the cell's degree colour. Null on the unchecked hex (no chord: no degrees). */
  degree: number | null;
  role: CellRole;
  /** A triad tone (root, 3rd / sus, 5th): its cell always shows its degree colour. */
  triad: boolean;
  /** A guide tone of a quartad (its 7th or 6th): its cell shows its degree colour, like a triad tone. */
  guide: boolean;
  /** The degree colour, and black or white lettering, whichever reads better on it. */
  colour: string;
  ink: string;
  /** The spelled accidental: a sharp ball sits high (+1), a flat ball low (−1), a natural in its socket (0). */
  accidental: -1 | 0 | 1;
  /** Can be clicked / picked: in range. */
  playable: boolean;
}

/** A chromatic-entry button: a pitch between two neighbouring steps, spelled as it will be written. */
export interface BorderButton {
  midi: number;
  /** Note name, no octave (the slot's spelling), and its accidental glyph. */
  name: string;
  glyph: '♯' | '♭' | '♮';
  playable: boolean;
}

/**
 * The border between two neighbouring cells in a row (the step and the next step up) and the pitches between them:
 * one button for a whole step, two for a wider gap (the semitone above the lower step and below the upper one),
 * none for a half step. Rows' outer edges count too (towards the step beyond).
 */
export interface HexBorder {
  r: number;
  /** In cell units, like `GridCell.x`: half-way between two cell centres. */
  x: number;
  /** Lower pitch first. */
  buttons: BorderButton[];
}

export interface SlotHex extends Omit<HexGrid, 'cells'> {
  cells: HexCell[];
  borders: HexBorder[];
}

/**
 * The hex for a slot with a chord: its scale, or for a valid chord no scale fits, the **chord-tones hex** (each cell
 * the next chord tone up, all chord-tone centres; SPEC §8.4). Null for `N.C.`, empty and unparseable slots.
 */
export function slotHex(h: SlotHarmony, range: PitchRange = CONCERT_VIEW, shape: HexShape = HONEYCOMB): SlotHex | null {
  if (h.kind !== 'chord') return null;
  const pcs = h.scale ? scalePitchClasses(h.root, h.scale) : h.chordTones;
  const grid = shape.kind === 'linear' ? linearGrid(pcs, range, shape.octave) : hexGrid(pcs, range, !h.scale);
  const onHex = (m: number) => pcs.has(((m % 12) + 12) % 12);
  const sp = slotSpelling(h);
  const triad = triadPitchClasses(h);
  const guide = guidePitchClasses(h);
  return {
    ...grid,
    cells: grid.cells.map((cell) => {
      const name = pcName(cell.midi, sp);
      const degree = spelledDegree(h.root, name);
      const colour = DEGREE_COLOURS[degree - 1];
      return {
        ...cell,
        name,
        degree,
        role: classify(cell.midi, h) === 'chord' ? 'chord' : 'scale',
        triad: triad.has(cell.midi % 12),
        guide: guide.has(cell.midi % 12),
        colour,
        ink: inkOn(colour),
        accidental: name[1] === '#' ? 1 : name[1] === 'b' ? -1 : 0,
        playable: cell.inRange,
      };
    }),
    borders: hexBorders(grid, onHex, (m) => pcName(m, sp), range),
  };
}

/** Chromatic entry on the borders between cells (SPEC §8.3). */
function hexBorders(grid: HexGrid, onHex: (m: number) => boolean, name: (m: number) => string, range: PitchRange): HexBorder[] {
  const step = (m: number, dir: 1 | -1) => {
    let x = m + dir;
    while (x > 0 && x < 127 && !onHex(x)) x += dir;
    return x;
  };
  const button = (midi: number): BorderButton => {
    const n = name(midi);
    return { midi, name: n, glyph: n[1] === '#' ? '♯' : n[1] === 'b' ? '♭' : '♮', playable: !range.limited || (midi >= range.lo && midi <= range.hi) };
  };
  const between = (lo: number, hi: number) => (hi - lo < 2 ? [] : hi - lo === 2 ? [button(lo + 1)] : [button(lo + 1), button(hi - 1)]);
  const borders: HexBorder[] = [];
  for (let r = 0; r < grid.rowLengths.length; r++) {
    const row = grid.cells.filter((c) => c.r === r);
    row.forEach((cell, i) => {
      borders.push({ r, x: cell.x - 0.5, buttons: between(step(cell.midi, -1), cell.midi) });
      if (i === row.length - 1) borders.push({ r, x: cell.x + 0.5, buttons: between(cell.midi, step(cell.midi, 1)) });
    });
  }
  return borders.filter((b) => b.buttons.length > 0);
}

export type DockMode = 'scale' | 'chord-tones' | 'unchecked';

export interface DockHex {
  hex: SlotHex;
  mode: DockMode;
  /** Dock label (SPEC §8.4); null for an ordinary scale hex. */
  label: string | null;
  /** Clicking the label focuses the active slot's chord field (empty / unparseable slots). */
  labelEditsChord: boolean;
  /** The slot's key (its scale's notes) — null without a scale; and its root pitch class (the travel plan). */
  key: Key | null;
  root: number | null;
}

const C_MAJOR: SlotHarmony = slotHarmony({ chord: 'C' });
/** The neutral cell colour: the CSS theme token (same as .hex-cell.muted). */
const NEUTRAL = 'var(--cell-neutral)';

/**
 * The docked hex for the active slot (SPEC §8.4). A slot without a chord (`N.C.`, empty, unparseable) shows the
 * **unchecked hex**: C major (in the view's pitch), names only — fully playable (♯ / ♭ reach every other pitch); notes written there are not checked against any scale.
 * `harmonies` are per form slot, in the view's pitch.
 */
export function dockHex(harmonies: SlotHarmony[], active: number, range: PitchRange = CONCERT_VIEW, shape: HexShape = HONEYCOMB): DockHex {
  const h = harmonies[active];
  if (h.kind === 'chord') {
    const root = ((pcOfName(h.root) % 12) + 12) % 12;
    return h.scale
      ? { hex: slotHex(h, range, shape)!, mode: 'scale', label: null, labelEditsChord: false, key: keyOf(h), root }
      : { hex: slotHex(h, range, shape)!, mode: 'chord-tones', label: 'No scale fits: chord tones only', labelEditsChord: false, key: null, root };
  }
  const label =
    h.reason === 'nc' ? 'N.C.: notes not checked' : h.reason === 'empty' ? 'No chord yet: notes not checked' : 'Chord not recognised: notes not checked';
  // C major's layout and note names only: no chord here, so no degrees, degree colours or triad tones.
  const c = slotHex(C_MAJOR, range, shape)!;
  const cells = c.cells.map((x) => ({ ...x, degree: null, role: 'scale' as const, triad: false, guide: false, colour: NEUTRAL, ink: HEX_THEME.noteInk }));
  return { hex: { ...c, cells }, mode: 'unchecked', label, labelEditsChord: h.reason !== 'nc', key: null, root: null };
}

/** Degree colours, degrees 1–7 (SPEC §8.2, user theme). */
export const DEGREE_COLOURS = ['#12EAEA', '#FFD52E', '#EC7C25', '#390099', '#9E0059', '#2F6B38', '#7B4A26'];

/** Dark or white lettering for a degree colour (relative luminance). */
export function inkOn(colour: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(colour.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? HEX_THEME.noteInk : '#FFFFFF';
}

/**
 * The hex's proportions and timings. Its colours (sphere, glow, neutral cells, ink on balls) are CSS theme tokens in
 * styles.css `:root`; only the degree colours and the dark lettering for them live here.
 */
export const HEX_THEME = {
  /** Dark lettering on a light degree colour (inkOn). */
  noteInk: '#1D1B19',
  /** Ball radius as a fraction of the cell radius (one size for every tone; triads stand out by colour). */
  triadNote: 0.36,
  otherNote: 0.36,
  /** Sharp balls sit this far (× cell radius) right of the default spot, flat balls this far left. */
  accidentalShift: 0.26,
  /** Chromatic-entry buttons on the borders between cells: radius × cell radius. */
  accidentalButton: 0.22,
  /** Two buttons on one border sit this far (× vertical cell radius) above and below its middle. */
  borderButtonGap: 0.28,
  /** Balls travelling to their new cells on a slot change (ms). */
  travelMs: 450,
  /** Out-of-range cells: the whole cell faded. */
  outOpacity: 0.35,
} as const;
