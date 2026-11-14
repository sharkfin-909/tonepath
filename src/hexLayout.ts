// Pure `hexLayout` module: where everything on the docked hex sits for a dock size (cells, border buttons, inversion
// labels), computed once — and the **travel plan** for a slot change: how far the degree pattern slides (SPEC §8.2).
// DockedHex renders the layout and plays the plan; it does no geometry of its own.

import { cellCentre, hexSize, inversionLabel, type BorderButton, type DockHex, type HexBorder, type HexCell, type HexSize, type SlotHex } from './hex';
import { sameKey, stepsUp } from './key';

/** Height (px) of the strip under the grid for the inversion labels. */
export const INVERSION_STRIP = 22;

export interface PlacedCell {
  cell: HexCell;
  cx: number;
  cy: number;
}

export interface PlacedButton {
  border: HexBorder;
  button: BorderButton;
  /** Its index on the border (0 = lower pitch). */
  i: number;
  cx: number;
  cy: number;
}

export interface PlacedLabel {
  /** The bottom-row cell it sits under. */
  cell: HexCell;
  label: 'root' | '1st' | '2nd' | '3rd';
  /** Hover tip: "Root position", "1st inversion", … */
  tip: string;
  cx: number;
  cy: number;
}

export interface HexLayout {
  size: HexSize;
  /** A cell's width (√3 · rx): one step along a row. */
  cellWidth: number;
  cells: PlacedCell[];
  buttons: PlacedButton[];
  inversions: PlacedLabel[];
}

/** Lay out a hex in a `width` × `height` dock: the grid above a strip for the inversion labels. */
export function layoutHex(hex: SlotHex, width: number, height: number, borderGap: number): HexLayout {
  const gridH = Math.max(0, height - INVERSION_STRIP);
  const size = hexSize(hex, width, gridH);
  const at = (x: { r: number; x: number }) => cellCentre(x as HexCell, hex, size, width, gridH);
  const cells = hex.cells.map((cell) => ({ cell, ...at(cell) }));
  const buttons: PlacedButton[] = [];
  for (const border of hex.borders) {
    const { cx, cy } = at(border); // a border's centre: the cell-centre formula at a half-cell x
    const gap = size.ry * borderGap;
    border.buttons.forEach((button, i) => {
      if (!button.playable) return;
      const y = border.buttons.length === 1 ? cy : i === 0 ? cy + gap : cy - gap; // two: the higher pitch on top
      buttons.push({ border, button, i, cx, cy: y });
    });
  }
  const inversions: PlacedLabel[] = [];
  for (const { cell, cx, cy } of cells) {
    const label = cell.r === 0 ? inversionLabel(cell) : null;
    if (label) inversions.push({ cell, label, tip: label === 'root' ? 'Root position' : `${label} inversion`, cx, cy: cy + size.ry + INVERSION_STRIP / 2 + 2 });
  }
  return { size, cellWidth: Math.sqrt(3) * size.rx, cells, buttons, inversions };
}

/**
 * The travel plan for a slot change (SPEC §8.2): how many cells the degree pattern slides along the rows — positive
 * rightwards — or null when nothing travels. Only in the **same key** (the same notes) and with a new root: right when
 * the new root is up to a 5th above the old (C → G: 4), left for more, i.e. down to it (G → F: −1; C → A: −2).
 * The grid is the same in the same key, so every ball (and colour) moves by exactly this many cells; balls entering at
 * a row's end come in from just off the grid as part of the same slide.
 */
export function travelSteps(prev: DockHex, next: DockHex): number | null {
  if (!sameKey(prev.key, next.key) || prev.root === null || next.root === null || prev.root === next.root) return null;
  const up = stepsUp(next.key!, prev.root, next.root);
  if (up === null || up === 0) return null;
  const semis = (((next.root - prev.root) % 12) + 12) % 12; // the new root, this far above the old
  return semis <= 7 ? up : up - next.key!.pcs.length;
}
