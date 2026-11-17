// Standard progressions (SPEC §3.12): built in, read-only, frozen ids; your etudes over them are stored under the id.
import { describe, expect, it } from 'vitest';
import { parseChord } from './chords';
import { readDevice, writeDevice } from './device';
import { copyStandard, launch, openStandard, readProgression } from './library';
import { listProgressions, saveProgression, PROGRESSION_PREFIX } from './storage';
import { FIRST_STANDARD, STANDARDS, barsOf, isStandardId, listMine, standardOf } from './standards';
import { MemoryStorage } from './test-memory-storage';
import demo from '../examples/demo.tonepath.json';

describe('the standards', () => {
  it('each has a frozen std/ id, a title, a time signature and chords that all parse', () => {
    const ids = STANDARDS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const s of STANDARDS) {
      expect(isStandardId(s.id)).toBe(true);
      expect(s.title).not.toBe('');
      expect(s.bars.length).toBeGreaterThan(0);
      for (const bar of s.bars) {
        expect(bar.length === 1 || bar.length === 2).toBe(true);
        for (const slot of bar) expect(parseChord(slot.chord).kind, `${s.id}: ${slot.chord}`).toBe('chord');
      }
    }
  });

  it('the first set: the generic forms', () => {
    expect(STANDARDS.map((s) => s.title)).toEqual([
      '12-bar blues in F',
      'Jazz blues in F',
      'Minor blues in C',
      'Rhythm changes in B♭',
      'ii–V–I in four keys',
      'Minor ii–V–i in four keys',
      'I–vi–ii–V turnaround in C',
      'Dorian vamp in D',
    ]);
    expect(standardOf(FIRST_STANDARD)?.title).toBe('12-bar blues in F');
  });

  it('bars are written one per |, two chords in a bar split it', () => {
    expect(barsOf('F7 | Bb7 | Cm7 F7')).toEqual([[{ chord: 'F7' }], [{ chord: 'Bb7' }], [{ chord: 'Cm7' }, { chord: 'F7' }]]);
  });
});

describe('opening a standard', () => {
  const id = FIRST_STANDARD;

  it('the first open stores it with one empty etude, on the device\'s instrument', () => {
    const s = new MemoryStorage();
    writeDevice(s, { lastInstrument: 'bb-trumpet' });
    const p = openStandard(s, id);
    expect(p.id).toBe(id);
    expect(p.title).toBe('12-bar blues in F');
    expect(p.etudes).toHaveLength(1);
    expect(p.etudes[0]).toMatchObject({ instrument: 'bb-trumpet', melody: [] });
    expect(s.getItem(PROGRESSION_PREFIX + id)).not.toBeNull();
  });

  it('later opens keep your etudes; the chords always come from the frozen definition', () => {
    const s = new MemoryStorage();
    const p = openStandard(s, id);
    const tampered = { ...p, bars: [[{ chord: 'C' }]], title: 'Mine now', etudes: [{ ...p.etudes[0], melody: [{ pitch: 65, d: 'q' as const }] }] };
    saveProgression(s, tampered);
    const again = openStandard(s, id);
    expect(again.bars).toEqual(standardOf(id)!.bars);
    expect(again.title).toBe('12-bar blues in F');
    expect(again.etudes[0].melody).toEqual([{ pitch: 65, d: 'q' }]);
    expect(readProgression(s, id)?.bars).toEqual(standardOf(id)!.bars); // reads go through it too
  });

  it('my progressions leaves the standards out', () => {
    const s = new MemoryStorage();
    openStandard(s, id);
    saveProgression(s, { ...openStandard(s, id), id: 'mine', title: 'Mine' });
    expect(listMine(listProgressions(s)).map((p) => p.id)).toEqual(['mine']);
  });

  it('make my own copy: its chords in a new progression of mine, one fresh etude (the etudes stay with the standard)', () => {
    const s = new MemoryStorage();
    const p = openStandard(s, id);
    saveProgression(s, { ...p, etudes: [{ ...p.etudes[0], melody: [{ pitch: 65, d: 'q' as const }] }] });
    const copy = copyStandard(s, id, () => 'copy-1');
    expect(copy.id).toBe('copy-1');
    expect(copy.title).toBe('12-bar blues in F (my copy)');
    expect(copy.bars).toEqual(standardOf(id)!.bars);
    expect(copy.etudes).toHaveLength(1);
    expect(copy.etudes[0].melody).toEqual([]);
    expect(openStandard(s, id).etudes[0].melody).toHaveLength(1);
  });
});

describe('the first launch lands on the 12-bar blues', () => {
  it('first ever launch: the demo is still seeded, but the 12-bar blues opens', () => {
    const s = new MemoryStorage();
    const l = launch(s, demo, undefined, undefined, [], (st) => openStandard(st, FIRST_STANDARD));
    expect(l.kind === 'open' && l.progression.id).toBe(FIRST_STANDARD);
    expect(readDevice(s).seeded).toBe(true);
    expect(listMine(listProgressions(s)).map((p) => p.title)).toContain('ii–V–I in C (demo)');
  });

  it('a later launch reopens the last open progression, as before', () => {
    const s = new MemoryStorage();
    launch(s, demo, undefined, undefined, [], (st) => openStandard(st, FIRST_STANDARD));
    const demoId = listMine(listProgressions(s))[0].id;
    writeDevice(s, { lastOpenId: demoId });
    const l = launch(s, demo, undefined, undefined, [], (st) => openStandard(st, FIRST_STANDARD));
    expect(l.kind === 'open' && l.progression.id).toBe(demoId);
  });
});
