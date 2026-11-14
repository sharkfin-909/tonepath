// Hex layout and the travel plan (SPEC §8.2): where things sit for a dock size; how far the degree pattern slides.
import { describe, expect, it } from 'vitest';
import { slotHarmony } from './harmony';
import { CONCERT_VIEW, dockHex } from './hex';
import { layoutHex, travelSteps } from './hexLayout';

const dock = (chord: string, scale?: string) => dockHex([slotHarmony({ chord, scale })], 0, CONCERT_VIEW);

describe('travel plan', () => {
  it('same key, the new root up to a 4th above: slide right by the steps (F Lydian → G7: 1; Dm7 → G7: 3)', () => {
    expect(travelSteps(dock('Fmaj7#11'), dock('G7'))).toBe(1);
    expect(travelSteps(dock('Dm7'), dock('G7'))).toBe(3);
    expect(travelSteps(dock('G7'), dock('Cmaj7'))).toBe(3);
  });

  it('same key, the new root further up (a 5th or more): slide left, down to it — a return mirrors its move', () => {
    expect(travelSteps(dock('G7'), dock('Dm7'))).toBe(-3); // Dm7 → G7 went 3 right
    expect(travelSteps(dock('C'), dock('G7'))).toBe(-3);
    expect(travelSteps(dock('G7'), dock('Fmaj7#11'))).toBe(-1);
    expect(travelSteps(dock('C'), dock('Am7', 'aeolian'))).toBe(-2);
  });

  it('nothing travels on a key change, when the root stays, or without a scale', () => {
    expect(travelSteps(dock('Dm7'), dock('A7'))).toBeNull();
    expect(travelSteps(dock('Cmaj7'), dock('Cm7'))).toBeNull();
    expect(travelSteps(dock('Dm7'), dock('N.C.'))).toBeNull();
    expect(travelSteps(dock('C7sus4b9'), dock('C'))).toBeNull(); // chord-tones hex: no key
  });

  it('in the same key the grid is identical, so one cell-width step moves every ball onto its degree', () => {
    const a = layoutHex(dock('C').hex, 1200, 300, 0.24);
    const b = layoutHex(dock('G7').hex, 1200, 300, 0.24);
    const k = travelSteps(dock('C'), dock('G7'))!; // −3
    for (const p of b.cells) {
      const from = a.cells.find((q) => q.cell.r === p.cell.r && q.cell.c === p.cell.c - k);
      if (!from) continue; // enters from off the grid
      expect(from.cell.degree).toBe(p.cell.degree);
      expect(p.cx - from.cx).toBeCloseTo(k * b.cellWidth);
    }
  });
});

describe('hex layout', () => {
  const l = layoutHex(dock('Dm7').hex, 1200, 300, 0.24);
  it('every cell placed, inside the dock', () => {
    expect(l.cells).toHaveLength(dock('Dm7').hex.cells.length);
    for (const { cx, cy } of l.cells) {
      expect(cx).toBeGreaterThan(0);
      expect(cx).toBeLessThan(1200);
      expect(cy + l.size.ry).toBeLessThanOrEqual(300 + 0.01);
    }
  });
  it('border buttons: one centred on a whole-step border; none on a half step', () => {
    const d = l.cells.find((c) => c.cell.r === 0 && c.cell.name === 'D')!;
    const right = l.buttons.filter((b) => b.border.r === 0 && b.border.x === d.cell.x + 0.5);
    expect(right).toHaveLength(1);
    expect(right[0].cy).toBeCloseTo(d.cy);
    const e = l.cells.find((c) => c.cell.r === 0 && c.cell.name === 'E')!;
    expect(l.buttons.some((b) => b.border.r === 0 && b.border.x === e.cell.x + 0.5)).toBe(false);
  });
});
