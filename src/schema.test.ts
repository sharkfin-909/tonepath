// Test table 7 (SPEC §14.7): migrate1to2, every repair in §12.3 (incl. slot-crossing events shortened + rest-padded),
// newer-version refusal; plus export / import round trips.
import { describe, expect, it } from 'vitest';
import demo from '../examples/demo.honeycomb.json';
import { NEWER_VERSION, NOT_OURS, exportAll, exportOne, importSummary, migrate1to2, parseFile, repairProgression, uniqueTitle } from './schema';
import { newProgression, type Progression } from './progression';

const env = (progression: unknown, v = 2) => JSON.stringify({ app: 'honeycomb', v, kind: 'progression', progression });
const one = (text: string) => {
  const r = parseFile(text);
  if (!r.ok) throw new Error(r.message);
  return r;
};
const repaired = (x: Record<string, unknown>) => repairProgression(x).progression;

describe('test table 7: migrate1to2', () => {
  it("strips every slot's notes and adds an empty melody", () => {
    const v1 = { title: 'Old', bars: [[{ chord: 'Dm7', notes: [62, 65] }], [{ chord: 'G7', notes: [] }, { chord: 'G7alt', scale: 'altered', notes: [59] }]] };
    expect(migrate1to2(v1)).toEqual({ title: 'Old', bars: [[{ chord: 'Dm7' }], [{ chord: 'G7' }, { chord: 'G7alt', scale: 'altered' }]], melody: [] });
  });

  it('a v1 file imports through the chain', () => {
    const r = one(env({ title: 'Old', timeSignature: '4/4', barsPerRow: 4, instrument: 'concert', bars: [[{ chord: 'C', notes: [60] }]] }, 1));
    expect(r.progressions[0].bars).toEqual([[{ chord: 'C' }]]);
    expect(r.progressions[0].melody).toEqual([]);
  });
});

describe('test table 7: repairs', () => {
  const base = { title: 'T', timeSignature: '4/4', barsPerRow: 4, instrument: 'concert', bars: [[{ chord: 'C' }]], melody: [] };

  it('blank title → Untitled', () => {
    expect(repaired({ ...base, title: '   ' }).title).toBe('Untitled');
    expect(repaired({ ...base, title: 3 }).title).toBe('Untitled');
  });
  it('etude name: kept (trimmed) when a non-blank string, else left out', () => {
    expect(repaired({ ...base, etudeName: ' Lines ' }).etudeName).toBe('Lines');
    expect('etudeName' in repaired({ ...base, etudeName: '  ' })).toBe(false);
    expect('etudeName' in repaired({ ...base, etudeName: 7 })).toBe(false);
    expect('etudeName' in repaired(base)).toBe(false);
  });
  it('bad timeSignature → 4/4', () => expect(repaired({ ...base, timeSignature: 'waltz' }).timeSignature).toBe('4/4'));
  it('barsPerRow outside 1–8 → 4', () => {
    expect(repaired({ ...base, barsPerRow: 9 }).barsPerRow).toBe(4);
    expect(repaired({ ...base, barsPerRow: 2.5 }).barsPerRow).toBe(4);
    expect(repaired({ ...base, barsPerRow: 8 }).barsPerRow).toBe(8);
  });
  it('unknown instrument → concert (noted)', () => {
    const r = repairProgression({ ...base, instrument: 'kazoo' });
    expect(r.progression.instrument).toBe('concert');
    expect(r.repairs.unknownInstrument).toBe(true);
  });
  it('bad concertClef dropped; bass kept', () => {
    expect('concertClef' in repaired({ ...base, concertClef: 'alto' })).toBe(false);
    expect(repaired({ ...base, concertClef: 'bass' }).concertClef).toBe('bass');
  });
  it('bar with 0 slots → one empty slot; > 2 → first 2', () => {
    expect(repaired({ ...base, bars: [[], [{ chord: 'A' }, { chord: 'B' }, { chord: 'C' }]] }).bars).toEqual([[{ chord: '' }], [{ chord: 'A' }, { chord: 'B' }]]);
  });
  it('non-string chord → ""; any string kept as typed', () => {
    expect(repaired({ ...base, bars: [[{ chord: 7 }], [{ chord: 'Hm7' }]] }).bars).toEqual([[{ chord: '' }], [{ chord: 'Hm7' }]]);
  });
  it('bad or non-candidate scale → dropped', () => {
    const bars = [[{ chord: 'Dm7', scale: 'nope' }], [{ chord: 'Dm7', scale: 'lydian' }], [{ chord: 'Dm7', scale: 'aeolian' }]];
    expect(repaired({ ...base, bars }).bars).toEqual([[{ chord: 'Dm7' }], [{ chord: 'Dm7' }], [{ chord: 'Dm7', scale: 'aeolian' }]]);
  });
  it('0 bars → 4 empty bars', () => {
    expect(repaired({ ...base, bars: [] }).bars).toEqual(Array.from({ length: 4 }, () => [{ chord: '' }]));
  });
  it('melody: non-array → []; invalid events dropped; unknown keys ignored', () => {
    expect(repaired({ ...base, melody: 'x' }).melody).toEqual([]);
    const melody = [{ pitch: 60, d: 'q', vel: 9 }, { pitch: 60.5, d: 'q' }, { pitch: 200, d: 'q' }, { d: 'x' }, { d: 'q' }, 'junk'];
    expect(repaired({ ...base, melody }).melody).toEqual([{ pitch: 60, d: 'q' }, { d: 'q' }]);
  });
  it('the suffix past the form is dropped; out-of-range pitches kept', () => {
    const melody = [{ pitch: 10, d: 'w' }, { pitch: 62, d: 'q' }];
    expect(repaired({ ...base, melody }).melody).toEqual([{ pitch: 10, d: 'w' }]);
  });
  it('an event crossing a slot boundary is shortened; the cut-off becomes rests; later events keep their time', () => {
    const r = repairProgression({ ...base, bars: [[{ chord: 'C' }, { chord: 'F' }], [{ chord: 'G' }]], melody: [{ pitch: 60, d: 'q' }, { pitch: 62, d: 'h' }, { pitch: 64, d: 'h' }, { pitch: 67, d: 'w' }] });
    // D h crosses the split → D q + rest q; E h crosses the bar line → E q + rest q; G w runs past the form → G h + rest q
    expect(r.progression.melody).toEqual([
      { pitch: 60, d: 'q' },
      { pitch: 62, d: 'q' },
      { d: 'q' },
      { pitch: 64, d: 'q' },
      { d: 'q' },
      { pitch: 67, d: 'h' },
      { d: 'q' },
    ]);
    expect(r.repairs.shortened).toBe(3);
  });
});

describe('test table 7: files', () => {
  it('newer version refused; wrong app, bad JSON, unknown kind rejected', () => {
    expect(parseFile(env({ bars: [] }, 3))).toEqual({ ok: false, message: NEWER_VERSION });
    expect(parseFile('{not json')).toEqual({ ok: false, message: NOT_OURS });
    expect(parseFile(JSON.stringify({ app: 'other', v: 2, kind: 'progression', progression: {} }))).toEqual({ ok: false, message: NOT_OURS });
    expect(parseFile(JSON.stringify({ app: 'honeycomb', v: 2, kind: 'song' }))).toEqual({ ok: false, message: NOT_OURS });
    // files exported before the rename still import
    expect(parseFile(JSON.stringify({ app: 'improwiser', v: 2, kind: 'progression', progression: { bars: [[{ chord: 'C' }]] } }))).toMatchObject({ ok: true });
  });

  it('bundle entries that are not objects or have no bars list are skipped', () => {
    const r = one(JSON.stringify({ app: 'honeycomb', v: 2, kind: 'library', progressions: [{ bars: [[{ chord: 'C' }]] }, 'x', { title: 'no bars' }] }));
    expect(r.progressions).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });

  it('Export one → import round-trips exactly (no ids or timestamps in the file)', () => {
    const p: Progression = { ...newProgression('bb-tenor-sax'), title: 'Blues', concertClef: 'bass', bars: [[{ chord: 'Dm7', scale: 'aeolian' }], [{ chord: 'G7' }, { chord: 'G7alt' }]], melody: [{ pitch: 62, d: 'q' }, { d: 'q' }] };
    const stored = { ...p, id: 'x', updatedAt: '2026-01-01T00:00:00Z' };
    const f = exportOne(stored);
    expect(f.filename).toBe('Blues.honeycomb.json');
    expect(f.text).not.toContain('updatedAt');
    expect(f.text).not.toContain('"id"');
    expect(f.text.startsWith('{\n  "app": "honeycomb",\n  "v": 2,')).toBe(true);
    expect(one(f.text).progressions[0]).toEqual(p);
  });

  it('Export all → a library bundle, newest first, that imports every entry', () => {
    const ps = [{ ...newProgression(), title: 'A' }, { ...newProgression(), title: 'B' }];
    const f = exportAll(ps, new Date('2026-11-13T10:00:00Z'));
    expect(f.filename).toBe('honeycomb-library-2026-11-13.json');
    expect(one(f.text).progressions.map((p) => p.title)).toEqual(['A', 'B']);
  });

  it('the bundled demo is a valid file', () => {
    const r = one(JSON.stringify(demo));
    expect(r.progressions[0].title).toBe('ii–V–I in C (demo)');
    expect(r.shortened).toBe(0);
  });

  it('title clash → "(2)", "(3)"', () => {
    expect(uniqueTitle('A', new Set(['B']))).toBe('A');
    expect(uniqueTitle('A', new Set(['A']))).toBe('A (2)');
    expect(uniqueTitle('A', new Set(['A', 'A (2)']))).toBe('A (3)');
  });

  it('one toast with counts', () => {
    expect(importSummary({ added: 3, skipped: 1, shortened: 2, unknownInstruments: 1, rejected: [{ name: 'x.json', message: NOT_OURS }] })).toBe(
      'Imported 3 progressions · 2 notes shortened · 1 unknown instrument → Concert · 1 entry skipped · x.json: not an Honeycomb file',
    );
  });
});
