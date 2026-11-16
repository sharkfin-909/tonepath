// Test table 7 (SPEC §14.7): migrate1to2, every repair in §12.3 (incl. slot-crossing events shortened + rest-padded),
// newer-version refusal; plus export / import round trips.
import { describe, expect, it } from 'vitest';
import { melodyOf, withFlat } from './test-progression';
import demo from '../examples/demo.tonepath.json';
import { NEWER_VERSION, NOT_OURS, exportAll, exportOne, importSummary, migrate1to2, migrate2to3, parseFile, repairProgression, uniqueTitle } from './schema';
import { newProgression, type Progression } from './progression';

const env = (progression: unknown, v = 2) => JSON.stringify({ app: 'tonepath', v, kind: 'progression', progression });
const one = (text: string) => {
  const r = parseFile(text);
  if (!r.ok) throw new Error(r.message);
  return r;
};
/** Repair after the v2 → v3 step, as import does: the tables below are written in v2's flat shape. */
const repairV2 = (x: Record<string, unknown>) => repairProgression(migrate2to3(x));
const repaired = (x: Record<string, unknown>) => repairV2(x).progression;
const etude = (x: Record<string, unknown>) => repaired(x).etudes[0];

describe('test table 7: migrate1to2', () => {
  it("strips every slot's notes and adds an empty melody", () => {
    const v1 = { title: 'Old', bars: [[{ chord: 'Dm7', notes: [62, 65] }], [{ chord: 'G7', notes: [] }, { chord: 'G7alt', scale: 'altered', notes: [59] }]] };
    expect(migrate1to2(v1)).toEqual({ title: 'Old', bars: [[{ chord: 'Dm7' }], [{ chord: 'G7' }, { chord: 'G7alt', scale: 'altered' }]], melody: [] });
  });

  it('a v1 file imports through the chain', () => {
    const r = one(env({ title: 'Old', timeSignature: '4/4', barsPerRow: 4, instrument: 'concert', bars: [[{ chord: 'C', notes: [60] }]] }, 1));
    expect(r.progressions[0].bars).toEqual([[{ chord: 'C' }]]);
    expect(melodyOf(r.progressions[0])).toEqual([]);
  });
});

describe('test table 7: repairs', () => {
  const base = { title: 'T', timeSignature: '4/4', barsPerRow: 4, instrument: 'concert', bars: [[{ chord: 'C' }]], melody: [] };

  it('blank title → Untitled', () => {
    expect(repaired({ ...base, title: '   ' }).title).toBe('Untitled');
    expect(repaired({ ...base, title: 3 }).title).toBe('Untitled');
  });
  it("v2's etude name names its one etude (trimmed); blank or missing → Etude 1", () => {
    expect(etude({ ...base, etudeName: ' Lines ' }).name).toBe('Lines');
    expect(etude({ ...base, etudeName: '  ' }).name).toBe('Etude 1');
    expect(etude({ ...base, etudeName: 7 }).name).toBe('Etude 1');
    expect('etudeName' in repaired({ ...base, etudeName: 'Lines' })).toBe(false);
  });
  it('bad timeSignature → 4/4', () => expect(repaired({ ...base, timeSignature: 'waltz' }).timeSignature).toBe('4/4'));
  it('barsPerRow outside 1–8 → 4', () => {
    expect(repaired({ ...base, barsPerRow: 9 }).barsPerRow).toBe(4);
    expect(repaired({ ...base, barsPerRow: 2.5 }).barsPerRow).toBe(4);
    expect(repaired({ ...base, barsPerRow: 8 }).barsPerRow).toBe(8);
  });
  it('unknown instrument → concert (noted)', () => {
    const r = repairV2({ ...base, instrument: 'kazoo' });
    expect(r.progression.etudes[0].instrument).toBe('concert');
    expect(r.repairs.unknownInstrument).toBe(true);
  });
  it('bad concertClef dropped; bass kept', () => {
    expect('concertClef' in etude({ ...base, concertClef: 'alto' })).toBe(false);
    expect(etude({ ...base, concertClef: 'bass' }).concertClef).toBe('bass');
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
    expect(etude({ ...base, melody: 'x' }).melody).toEqual([]);
    const melody = [{ pitch: 60, d: 'q', vel: 9 }, { pitch: 60.5, d: 'q' }, { pitch: 200, d: 'q' }, { d: 'x' }, { d: 'q' }, 'junk'];
    expect(etude({ ...base, melody }).melody).toEqual([{ pitch: 60, d: 'q' }, { d: 'q' }]);
  });
  it('the suffix past the form is dropped; out-of-range pitches kept', () => {
    const melody = [{ pitch: 10, d: 'w' }, { pitch: 62, d: 'q' }];
    expect(etude({ ...base, melody }).melody).toEqual([{ pitch: 10, d: 'w' }]);
  });
  it('an event crossing a slot boundary is shortened; the cut-off becomes rests; later events keep their time', () => {
    const r = repairV2({ ...base, bars: [[{ chord: 'C' }, { chord: 'F' }], [{ chord: 'G' }]], melody: [{ pitch: 60, d: 'q' }, { pitch: 62, d: 'h' }, { pitch: 64, d: 'h' }, { pitch: 67, d: 'w' }] });
    // D h crosses the split → D q + rest q; E h crosses the bar line → E q + rest q; G w runs past the form → G h + rest q
    expect(melodyOf(r.progression)).toEqual([
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
    expect(parseFile(env({ bars: [] }, 4))).toEqual({ ok: false, message: NEWER_VERSION });
    expect(parseFile('{not json')).toEqual({ ok: false, message: NOT_OURS });
    expect(parseFile(JSON.stringify({ app: 'other', v: 2, kind: 'progression', progression: {} }))).toEqual({ ok: false, message: NOT_OURS });
    expect(parseFile(JSON.stringify({ app: 'tonepath', v: 2, kind: 'song' }))).toEqual({ ok: false, message: NOT_OURS });
    // files exported before the renames (Honeycomb, Improwiser) still import
    expect(parseFile(JSON.stringify({ app: 'honeycomb', v: 2, kind: 'progression', progression: { bars: [[{ chord: 'C' }]] } }))).toMatchObject({ ok: true });
    expect(parseFile(JSON.stringify({ app: 'improwiser', v: 2, kind: 'progression', progression: { bars: [[{ chord: 'C' }]] } }))).toMatchObject({ ok: true });
  });

  it('bundle entries that are not objects or have no bars list are skipped', () => {
    const r = one(JSON.stringify({ app: 'tonepath', v: 2, kind: 'library', progressions: [{ bars: [[{ chord: 'C' }]] }, 'x', { title: 'no bars' }] }));
    expect(r.progressions).toHaveLength(1);
    expect(r.skipped).toBe(2);
  });

  it('Export one → import round-trips exactly (no ids or timestamps in the file)', () => {
    const p: Progression = withFlat(newProgression('bb-tenor-sax'), { title: 'Blues', concertClef: 'bass', bars: [[{ chord: 'Dm7', scale: 'aeolian' }], [{ chord: 'G7' }, { chord: 'G7alt' }]], melody: [{ pitch: 62, d: 'q' }, { d: 'q' }] });
    const stored = { ...p, id: 'x', updatedAt: '2026-01-01T00:00:00Z' };
    const f = exportOne(stored);
    expect(f.filename).toBe('Blues.tonepath.json');
    expect(f.text).not.toContain('updatedAt');
    expect(f.text).not.toContain('"id"');
    expect(f.text.startsWith('{\n  "app": "tonepath",\n  "v": 3,')).toBe(true);
    expect(one(f.text).progressions[0]).toEqual(p);
  });

  it('Export all → a library bundle, newest first, that imports every entry', () => {
    const ps = [{ ...newProgression(), title: 'A' }, { ...newProgression(), title: 'B' }];
    const f = exportAll(ps, new Date('2026-11-13T10:00:00Z'));
    expect(f.filename).toBe('tonepath-library-2026-11-13.json');
    expect(one(f.text).progressions.map((p) => p.title)).toEqual(['A', 'B']);
  });

  it('a two-etude progression round-trips; each etude gets an id again on import', () => {
    const p: Progression = {
      ...newProgression(),
      title: 'Two',
      etudes: [
        { id: 'e1', name: 'Guide tones', instrument: 'bb-trumpet', melody: [{ pitch: 62, d: 'w' }] },
        { id: 'e2', name: 'Arpeggios', instrument: 'concert', concertClef: 'bass', melody: [{ d: 'h' }, { pitch: 50, d: 'h' }] },
      ],
    };
    expect(one(exportOne(p).text).progressions[0]).toEqual(p);
  });

  it('a v2 export imports as one etude, its instrument and notes intact', () => {
    const v2 = { title: 'Old', timeSignature: '4/4', barsPerRow: 4, instrument: 'eb-alto-sax', concertClef: 'bass', etudeName: 'Lines', bars: [[{ chord: 'C' }]], melody: [{ pitch: 60, d: 'w' }] };
    expect(one(env(v2, 2)).progressions[0].etudes).toEqual([{ id: 'e1', name: 'Lines', instrument: 'eb-alto-sax', concertClef: 'bass', melody: [{ pitch: 60, d: 'w' }] }]);
  });

  it('etude repairs: none or junk → one default etude; duplicate ids and blank names fixed; a bad entry skipped', () => {
    const v3 = (etudes: unknown) => repairProgression({ title: 'T', timeSignature: '4/4', barsPerRow: 4, bars: [[{ chord: 'C' }]], etudes }).progression.etudes;
    const one1 = [{ id: 'e1', name: 'Etude 1', instrument: 'concert', melody: [] }];
    expect(v3(undefined)).toEqual(one1);
    expect(v3([])).toEqual(one1);
    expect(v3(['x', 7])).toEqual(one1);
    const fixed = v3([{ id: 'a', name: ' ', melody: [] }, 'junk', { id: 'a', name: 'B' }, { name: 'C' }]);
    expect(fixed.map((e) => [e.id, e.name])).toEqual([['a', 'Etude 1'], ['e1', 'B'], ['e2', 'C']]);
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
      'Imported 3 progressions · 2 notes shortened · 1 unknown instrument → Concert · 1 entry skipped · x.json: not a Tonepath file',
    );
  });
});
