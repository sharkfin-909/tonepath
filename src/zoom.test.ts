import { describe, expect, it } from 'vitest';
import { MIN_CHORD_PX, MIN_SCALE_PX, ZOOM_CAP, ZOOM_FLOOR, chartHeight, fitZoom, headerPx, labelPx } from './zoom';

const STAVE = 110; // staveMetrics().height with 3 ledger lines of headroom

describe('chart zoom fit', () => {
  it('a 4-bar form (1 row) in a laptop chart area is capped at 1.4×', () => {
    expect(fitZoom(1, STAVE, 360)).toEqual({ zoom: ZOOM_CAP, scrolls: false });
  });

  it('a mid-size form fits exactly between floor and cap', () => {
    const f = fitZoom(3, STAVE, 400);
    expect(f.scrolls).toBe(false);
    expect(f.zoom).toBeGreaterThan(ZOOM_FLOOR);
    expect(f.zoom).toBeLessThan(ZOOM_CAP);
    expect(chartHeight(3, STAVE, f.zoom)).toBeLessThanOrEqual(400);
    expect(chartHeight(3, STAVE, f.zoom + 0.01)).toBeGreaterThan(400);
  });

  it('32 bars at 4 per row (8 rows) on a 1280×800 laptop stops at the floor and scrolls', () => {
    expect(fitZoom(8, STAVE, 360)).toEqual({ zoom: ZOOM_FLOOR, scrolls: true });
  });

  it('with no floor (Read etude) it keeps shrinking to fit', () => {
    const f = fitZoom(8, STAVE, 700, 0, ZOOM_CAP, true);
    expect(f.scrolls).toBe(false);
    expect(f.zoom).toBeLessThan(ZOOM_FLOOR + 0.3);
    expect(chartHeight(8, STAVE, f.zoom, true)).toBeLessThanOrEqual(700);
  });

  it('labels never render below their minimums; the header grows to hold them', () => {
    for (const z of [0.3, 0.5, 0.8, 1, 1.4]) {
      expect(labelPx(17, MIN_CHORD_PX, z) * z).toBeGreaterThanOrEqual(MIN_CHORD_PX - 1e-9);
      expect(labelPx(11, MIN_SCALE_PX, z) * z).toBeGreaterThanOrEqual(MIN_SCALE_PX - 1e-9);
    }
    expect(headerPx(1)).toBe(55);
    expect(headerPx(0.5)).toBeGreaterThan(55);
    expect(headerPx(1, true)).toBe(30);
    expect(headerPx(0.5, true)).toBeGreaterThan(30);
    expect(headerPx(1, true, false)).toBeLessThanOrEqual(headerPx(1, true, true));
  });
});
