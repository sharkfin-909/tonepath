// Pure chart-zoom fit (SPEC §3.1, §7.1). The chart is laid out at logical size and scaled by z; VexFlow's staff
// line gap is 10 logical px, so the readable floor (≈ 5px) is z = 0.5. Label minimums (chord ≥ 11px, scale ≥ 9px)
// are kept by growing their logical size as z shrinks, which also grows the row's header.

export const ZOOM_FLOOR = 0.5;
export const ZOOM_CAP = 1.4;
/** Logical sizes at z = 1. */
export const CHORD_PX = 17;
export const SCALE_PX = 11;
export const HEADER_PX = 48;
export const MIN_CHORD_PX = 11;
export const MIN_SCALE_PX = 9;
export const ROW_GAP_PX = 8;

/** Logical font size that renders at least `min` px at zoom z. */
export const labelPx = (base: number, min: number, z: number) => Math.max(base, min / z);

/** Logical header height at zoom z: room for both labels at their (logical) sizes. */
export function headerPx(z: number): number {
  const chord = labelPx(CHORD_PX, MIN_CHORD_PX, z);
  const scale = labelPx(SCALE_PX, MIN_SCALE_PX, z);
  return Math.max(HEADER_PX, Math.ceil(chord * 1.4 + scale * 1.4 + 6));
}

/** Rendered height of `rows` rows at zoom z. */
export function chartHeight(rows: number, staveHeight: number, z: number): number {
  return z * (rows * (headerPx(z) + staveHeight) + Math.max(0, rows - 1) * ROW_GAP_PX);
}

export interface Fit {
  zoom: number;
  /** True when even the floor doesn't fit: the chart scrolls, following the caret. */
  scrolls: boolean;
}

/**
 * The largest zoom in [min, max] at which every row fits `height` (rendered px). Below `min` the chart doesn't
 * shrink further and scrolls. Etude view passes min = 0 (no floor).
 */
export function fitZoom(rows: number, staveHeight: number, height: number, min = ZOOM_FLOOR, max = ZOOM_CAP): Fit {
  if (rows <= 0 || height <= 0) return { zoom: max, scrolls: false };
  if (chartHeight(rows, staveHeight, max) <= height) return { zoom: max, scrolls: false };
  const lo0 = Math.max(min, 0.05);
  if (chartHeight(rows, staveHeight, lo0) > height) return { zoom: lo0, scrolls: true };
  let lo = lo0;
  let hi = max;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (chartHeight(rows, staveHeight, mid) <= height) lo = mid;
    else hi = mid;
  }
  return { zoom: lo, scrolls: false };
}
