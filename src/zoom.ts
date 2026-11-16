// Pure chart-zoom fit (SPEC §3.1, §7.1). The chart is laid out at logical size and scaled by z; VexFlow's staff
// line gap is 10 logical px, so the readable floor (≈ 5px) is z = 0.5. Label minimums (chord ≥ 11px, scale ≥ 9px)
// are kept by growing their logical size as z shrinks, which also grows the row's header.

export const ZOOM_FLOOR = 0.5;
export const ZOOM_CAP = 1.4;
/** Logical sizes at z = 1. */
export const CHORD_PX = 17;
export const SCALE_PX = 11;
export const HEADER_PX = 55;
/** Read etude: one chrome row (bar · chord · scale) — shorter header, smaller row gap. */
export const READ_HEADER_PX = 30;
export const MIN_CHORD_PX = 11;
export const MIN_SCALE_PX = 9;
/** Logical gap above each chart row: the **bar strip** — each bar's number (left) and trash can (right) (SPEC §3.1). */
export const ROW_GAP_PX = 30;
/** Read etude: bar numbers sit in the slot header, so the row gap is only row separation. */
export const ROW_GAP_READ_PX = 10;
/** Logical space under each row's cards, so a bar strip reads as belonging to the bar below it, not the one above. */
export const ROW_AFTER_PX = 14;
/** Logical gap between slots in a row (each slot a card); after a bar, the same gap sits on each side of the bar line. */
export const SLOT_GAP_PX = 10;
/** Logical padding at the top of each slot card (above the chord name), and the card's border (1px each side). */
export const SLOT_PAD_TOP_PX = 6;
export const SLOT_BORDER_PX = 1;
/** What a card adds to a row's height besides the header and stave: its top padding and top + bottom border. */
export const SLOT_CHROME_PX = SLOT_PAD_TOP_PX + 2 * SLOT_BORDER_PX;

/** Logical font size that renders at least `min` px at zoom z. */
export const labelPx = (base: number, min: number, z: number) => Math.max(base, min / z);

/** Logical header height at zoom z: two label rows, or one compact row in Read etude. */
export function headerPx(z: number, readEtude = false, readShowScales = true): number {
  const chord = labelPx(CHORD_PX, MIN_CHORD_PX, z);
  const scale = labelPx(SCALE_PX, MIN_SCALE_PX, z);
  if (readEtude) {
    const line = readShowScales ? Math.max(chord * 1.4, scale * 1.5 + 4) : chord * 1.4;
    return Math.max(READ_HEADER_PX, Math.ceil(line + 6));
  }
  // Room for chord (1.4) + scale (1.5 + 4px pad) and a little air above the stave.
  return Math.max(HEADER_PX, Math.ceil(chord * 1.4 + scale * 1.5 + 4 + 10));
}

/** Rendered height of `rows` rows at zoom z. */
export function chartHeight(rows: number, staveHeight: number, z: number, readEtude = false, readShowScales = true): number {
  const rowGap = readEtude ? ROW_GAP_READ_PX : ROW_GAP_PX;
  // A row gap above every row, the first too (SPEC §3.1).
  return z * (rows * (headerPx(z, readEtude, readShowScales) + staveHeight + SLOT_CHROME_PX) + rows * (rowGap + ROW_AFTER_PX));
}

export interface Fit {
  zoom: number;
  /** True when even the floor doesn't fit: the chart scrolls, following the caret. */
  scrolls: boolean;
}

/**
 * The largest zoom in [min, max] at which every row fits `height` (rendered px). Below `min` the chart doesn't
 * shrink further and scrolls. Read etude passes min = 0 (no floor).
 */
export function fitZoom(
  rows: number,
  staveHeight: number,
  height: number,
  min = ZOOM_FLOOR,
  max = ZOOM_CAP,
  readEtude = false,
  readShowScales = true,
): Fit {
  if (rows <= 0 || height <= 0) return { zoom: max, scrolls: false };
  if (chartHeight(rows, staveHeight, max, readEtude, readShowScales) <= height) return { zoom: max, scrolls: false };
  const lo0 = Math.max(min, 0.05);
  if (chartHeight(rows, staveHeight, lo0, readEtude, readShowScales) > height) return { zoom: lo0, scrolls: true };
  let lo = lo0;
  let hi = max;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (chartHeight(rows, staveHeight, mid, readEtude, readShowScales) <= height) lo = mid;
    else hi = mid;
  }
  return { zoom: lo, scrolls: false };
}
