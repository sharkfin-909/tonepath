// Pure chart layout (SPEC §3.1, §7.1): every size the chart is drawn at, in one place. The chart is laid out at
// logical size and scaled by z; VexFlow's staff line gap is 10 logical px, so the readable floor (≈ 5px) is z = 0.5.
// Label minimums (chord ≥ 11px, scale ≥ 9px) are kept by growing their logical size as z shrinks, which also grows
// the row's header. The chart hands these sizes to the CSS as variables (`chartLayout().vars`); styles.css never
// repeats them.

import type { ChartBudget, ChartKind } from './modeProfile';

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
/** The bar line's width (SPEC §3.1). */
export const BAR_LINE_PX = 2.5;
/** Each row's clef gutter. */
export const GUTTER_PX = 46;
/** The chart area's padding above the chart (rendered px); Read etude pads below it too. */
export const CHART_PAD_TOP_PX = 16;
export const READ_PAD_BOTTOM_PX = 16;
/** Improvise's 3-row slot: the hex never shrinks below this. */
export const LEAD_HEX_MIN_PX = 24;

/** How the chart is drawn: its kind, and (Read etude) whether scale names sit beside the chords. */
export interface ChartLook {
  kind: ChartKind;
  scales?: boolean;
}

/** Logical font size that renders at least `min` px at zoom z. */
export const labelPx = (base: number, min: number, z: number) => Math.max(base, min / z);

const isRead = (look: ChartLook) => look.kind === 'read';
const rowGapPx = (look: ChartLook) => (isRead(look) ? ROW_GAP_READ_PX : ROW_GAP_PX);
/** Read etude's cards are borderless (one continuous stave). */
const borderPx = (look: ChartLook) => (isRead(look) ? 0 : SLOT_BORDER_PX);
/** What a card adds to a row's height besides the header and stave: its top padding and top + bottom border. */
export const slotChromePx = (look: ChartLook) => SLOT_PAD_TOP_PX + 2 * borderPx(look);

/** Logical header height at zoom z: two label rows, or one compact row in Read etude. */
export function headerPx(z: number, look: ChartLook): number {
  const chord = labelPx(CHORD_PX, MIN_CHORD_PX, z);
  const scale = labelPx(SCALE_PX, MIN_SCALE_PX, z);
  if (isRead(look)) {
    // Chord line-height 1.4; the scale label's (styles.css .scale-label-wrap) 1.5 + 4px.
    const line = look.scales ? Math.max(chord * 1.4, scale * 1.5 + 4) : chord * 1.4;
    return Math.max(READ_HEADER_PX, Math.ceil(line + 6));
  }
  // Room for chord (1.4) + scale (1.5 + 4px pad) and a little air above the stave.
  return Math.max(HEADER_PX, Math.ceil(chord * 1.4 + scale * 1.5 + 4 + 10));
}

/** Rendered height of `rows` rows at zoom z. */
export function chartHeight(rows: number, staveHeight: number, z: number, look: ChartLook): number {
  // A row gap above every row, the first too (SPEC §3.1).
  return z * rows * (headerPx(z, look) + staveHeight + slotChromePx(look) + rowGapPx(look) + ROW_AFTER_PX);
}

export interface Fit {
  zoom: number;
  /** True when even the floor doesn't fit: the chart scrolls, following the caret. */
  scrolls: boolean;
}

/**
 * The largest zoom in [floor, cap] at which every row fits `height` (rendered px). Below the floor the chart doesn't
 * shrink further and scrolls. Read etude has no floor (every bar on one page).
 */
export function fitZoom(rows: number, staveHeight: number, height: number, look: ChartLook): Fit {
  const max = ZOOM_CAP;
  if (rows <= 0 || height <= 0) return { zoom: max, scrolls: false };
  if (chartHeight(rows, staveHeight, max, look) <= height) return { zoom: max, scrolls: false };
  const lo0 = Math.max(isRead(look) ? 0 : ZOOM_FLOOR, 0.05);
  if (chartHeight(rows, staveHeight, lo0, look) > height) return { zoom: lo0, scrolls: true };
  let lo = lo0;
  let hi = max;
  for (let k = 0; k < 30; k++) {
    const mid = (lo + hi) / 2;
    if (chartHeight(rows, staveHeight, mid, look) <= height) lo = mid;
    else hi = mid;
  }
  return { zoom: lo, scrolls: false };
}

export interface ChartLayout extends Fit {
  /** Rendered height of the rows. */
  height: number;
  /** Logical sizes at this zoom. */
  header: number;
  chordPx: number;
  scalePx: number;
  rowGap: number;
  /** A slot card's height (header + stave + chrome). */
  slotHeight: number;
  /** Improvise's 3-row slot (SPEC §3.3): the hex's height — what the two label rows leave of the usual slot height. */
  leadHexHeight: number;
  /** The CSS variables the chart sets for styles.css. */
  vars: Record<string, string>;
}

/** The chart's whole layout for `rows` rows fitted to `height` (rendered px). */
export function chartLayout(rows: number, staveHeight: number, height: number, look: ChartLook): ChartLayout {
  const fit = fitZoom(rows, staveHeight, height, look);
  const z = fit.zoom;
  const header = headerPx(z, look);
  const chordPx = labelPx(CHORD_PX, MIN_CHORD_PX, z);
  const scalePx = labelPx(SCALE_PX, MIN_SCALE_PX, z);
  const rowGap = rowGapPx(look);
  // The lead slot's label rows: [bar number · key pill] (scale-sized, line-height ≈ 1.6 + 6px) and [chord · scale]
  // (chord line-height 1.25 + 8px), as styles.css `.slot.lead` draws them.
  const leadHexHeight = Math.max(LEAD_HEX_MIN_PX, header + staveHeight - (1.595 * scalePx + 6) - (1.25 * chordPx + 8));
  return {
    ...fit,
    height: chartHeight(rows, staveHeight, z, look),
    header,
    chordPx,
    scalePx,
    rowGap,
    slotHeight: header + staveHeight + slotChromePx(look),
    leadHexHeight,
    vars: {
      '--row-gap': `${rowGap}px`,
      '--row-after': `${ROW_AFTER_PX}px`,
      '--slot-gap': `${SLOT_GAP_PX}px`,
      '--slot-pad-top': `${SLOT_PAD_TOP_PX}px`,
      '--bar-line': `${BAR_LINE_PX}px`,
      '--chord-px': `${chordPx}px`,
      '--scale-px': `${scalePx}px`,
    },
  };
}

/**
 * The chart area under the header (SPEC §3.1 Split): its padding, the cap on its own height, and the height budget
 * the chart fits its rows into — or none, when the chart fits the area the grid gives it (`fill`).
 */
export function chartArea(budget: ChartBudget, kind: ChartKind, mainHeight: number): { padTop: number; padBottom: number; maxHeight?: number; fitHeight?: number } {
  const padTop = CHART_PAD_TOP_PX;
  const padBottom = kind === 'read' ? READ_PAD_BOTTOM_PX : 0;
  if (!mainHeight || budget === 'fill') return { padTop, padBottom };
  if (budget === 'full') return { padTop, padBottom, fitHeight: mainHeight - padTop - padBottom };
  return { padTop, padBottom, maxHeight: mainHeight / 2, fitHeight: mainHeight / 2 - padTop - padBottom };
}
