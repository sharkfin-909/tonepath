import { describe, expect, it } from 'vitest';
import {
  CHART_PAD_TOP_PX,
  MIN_CHORD_PX,
  MIN_SCALE_PX,
  READ_PAD_BOTTOM_PX,
  ZOOM_CAP,
  ZOOM_FLOOR,
  chartArea,
  chartHeight,
  chartLayout,
  fitZoom,
  headerPx,
  labelPx,
  slotChromePx,
  type ChartLook,
} from './zoom';

const STAVE = 110; // staveMetrics().height with 3 ledger lines of headroom
const WRITE: ChartLook = { kind: 'write' };
const LEAD: ChartLook = { kind: 'lead' };
const READ: ChartLook = { kind: 'read' };
const READ_SCALES: ChartLook = { kind: 'read', scales: true };

describe('chart zoom fit', () => {
  it('a 4-bar form (1 row) in a laptop chart area is capped at 1.4×', () => {
    expect(fitZoom(1, STAVE, 360, WRITE)).toEqual({ zoom: ZOOM_CAP, scrolls: false });
  });

  it('a mid-size form fits exactly between floor and cap', () => {
    const f = fitZoom(3, STAVE, 400, WRITE);
    expect(f.scrolls).toBe(false);
    expect(f.zoom).toBeGreaterThan(ZOOM_FLOOR);
    expect(f.zoom).toBeLessThan(ZOOM_CAP);
    expect(chartHeight(3, STAVE, f.zoom, WRITE)).toBeLessThanOrEqual(400);
    expect(chartHeight(3, STAVE, f.zoom + 0.01, WRITE)).toBeGreaterThan(400);
  });

  it('32 bars at 4 per row (8 rows) on a 1280×800 laptop stops at the floor and scrolls', () => {
    expect(fitZoom(8, STAVE, 360, WRITE)).toEqual({ zoom: ZOOM_FLOOR, scrolls: true });
    expect(fitZoom(8, STAVE, 360, LEAD)).toEqual({ zoom: ZOOM_FLOOR, scrolls: true });
  });

  it('Read etude has no floor: it keeps shrinking to fit', () => {
    const f = fitZoom(8, STAVE, 700, READ);
    expect(f.scrolls).toBe(false);
    expect(f.zoom).toBeLessThan(ZOOM_FLOOR + 0.3);
    expect(chartHeight(8, STAVE, f.zoom, READ)).toBeLessThanOrEqual(700);
  });

  it('labels never render below their minimums; the header grows to hold them', () => {
    for (const z of [0.3, 0.5, 0.8, 1, 1.4]) {
      expect(labelPx(17, MIN_CHORD_PX, z) * z).toBeGreaterThanOrEqual(MIN_CHORD_PX - 1e-9);
      expect(labelPx(11, MIN_SCALE_PX, z) * z).toBeGreaterThanOrEqual(MIN_SCALE_PX - 1e-9);
    }
    expect(headerPx(1, WRITE)).toBe(55);
    expect(headerPx(0.5, WRITE)).toBeGreaterThan(55);
    expect(headerPx(1, READ_SCALES)).toBe(30);
    expect(headerPx(0.5, READ_SCALES)).toBeGreaterThan(30);
    expect(headerPx(1, READ)).toBeLessThanOrEqual(headerPx(1, READ_SCALES));
  });

  it("Read etude's cards are borderless: no border counted in its rows", () => {
    expect(slotChromePx(WRITE) - slotChromePx(READ)).toBe(2);
  });
});

describe('chart layout', () => {
  it('its height is the fitted rows, within the budget', () => {
    for (const look of [WRITE, LEAD, READ, READ_SCALES]) {
      const l = chartLayout(4, STAVE, 500, look);
      expect(l.height).toBeCloseTo(chartHeight(4, STAVE, l.zoom, look));
      expect(l.height).toBeLessThanOrEqual(500);
    }
  });

  it('hands every size to the CSS at the zoom it chose', () => {
    const l = chartLayout(8, STAVE, 360, WRITE);
    expect(l.vars['--chord-px']).toBe(`${l.chordPx}px`);
    expect(l.chordPx * l.zoom).toBeGreaterThanOrEqual(MIN_CHORD_PX - 1e-9);
    expect(l.vars['--row-gap']).toBe('30px');
    expect(chartLayout(1, STAVE, 360, READ).vars['--row-gap']).toBe('10px');
    expect(l.vars['--bar-line']).toBe('2.5px');
  });

  it("Improvise's 3-row slot keeps the usual slot height; its hex gets what the label rows leave", () => {
    const l = chartLayout(1, STAVE, 360, LEAD);
    expect(l.slotHeight).toBe(l.header + STAVE + slotChromePx(LEAD));
    expect(l.leadHexHeight).toBeGreaterThan(24);
    expect(l.leadHexHeight).toBeLessThan(l.header + STAVE);
    // At a tiny zoom the labels grow; the hex never goes below its minimum.
    expect(chartLayout(40, STAVE, 100, LEAD).leadHexHeight).toBeGreaterThanOrEqual(24);
  });
});

describe('chart area', () => {
  it('Write etude and Tune: the chart takes up to half the space under the header', () => {
    expect(chartArea('half', 'write', 800)).toEqual({ padTop: CHART_PAD_TOP_PX, padBottom: 0, maxHeight: 400, fitHeight: 400 - CHART_PAD_TOP_PX });
  });

  it('Read etude: all of it, less the padding above and below the chart', () => {
    expect(chartArea('full', 'read', 800)).toEqual({
      padTop: CHART_PAD_TOP_PX,
      padBottom: READ_PAD_BOTTOM_PX,
      fitHeight: 800 - CHART_PAD_TOP_PX - READ_PAD_BOTTOM_PX,
    });
  });

  it('Improvise: the chart fits the grid row it is given (no budget)', () => {
    expect(chartArea('fill', 'lead', 800)).toEqual({ padTop: CHART_PAD_TOP_PX, padBottom: 0 });
  });

  it('before the screen is measured: no budget', () => {
    expect(chartArea('half', 'write', 0).fitHeight).toBeUndefined();
  });
});
