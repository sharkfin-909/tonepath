import { describe, expect, it } from 'vitest';
import demo from '../examples/demo.honeycomb.json';
import rhythmChanges from '../examples/rhythm-changes.honeycomb.json';
import { readDevice, writeDevice } from './device';
import {
  createProgression,
  deleteProgression,
  duplicateProgression,
  launch,
  readProgression,
  rememberOpen,
  renameProgression,
  restoreProgression,
  importTexts,
  migrateStorage,
} from './library';
import { exportAll, exportOne, NEWER_VERSION } from './schema';
import { isReadOnly, setReadOnly } from './readOnly';
import { PROGRESSION_PREFIX } from './storage';
import { listProgressions, saveProgression } from './storage';
import { MemoryStorage } from './test-memory-storage';
import { newProgression } from './progression';

let n = 0;
const ids = () => `id-${++n}`;
const at = (min: number) => new Date(Date.UTC(2026, 10, 13, 12, min));

describe('library', () => {
  it('first launch seeds the demo once and opens it; deleting it is permanent', () => {
    const s = new MemoryStorage();
    const l = launch(s, demo, ids, at(0));
    expect(l.kind).toBe('open');
    if (l.kind !== 'open') return;
    expect(l.progression.title).toBe('ii–V–I in C (demo)');
    expect(l.progression.bars.map((b) => b[0].chord)).toEqual(['Dm7', 'G7', 'Cmaj7', 'Cmaj7']);
    expect(readDevice(s).seeded).toBe(true);
    deleteProgression(s, l.progression.id);
    expect(launch(s, demo, ids, at(1))).toEqual({ kind: 'empty' });
    expect(listProgressions(s)).toHaveLength(0);
  });

  it('launch reopens lastOpenId; missing or dangling → newest', () => {
    const s = new MemoryStorage();
    writeDevice(s, { seeded: true });
    const a = createProgression(s, ids, at(1));
    const b = createProgression(s, ids, at(2));
    expect(launch(s, demo).kind === 'open' && (launch(s, demo) as { progression: { id: string } }).progression.id).toBe(b.id);
    rememberOpen(s, a.id);
    expect((launch(s, demo) as { progression: { id: string } }).progression.id).toBe(a.id);
    rememberOpen(s, 'gone');
    expect((launch(s, demo) as { progression: { id: string } }).progression.id).toBe(b.id);
  });

  it('an extra demo joins any library once, without being opened; deleting it is permanent', () => {
    const s = new MemoryStorage();
    saveProgression(s, { ...newProgression(), id: 'mine', updatedAt: '' }, at(0));
    rememberOpen(s, 'mine');
    const extras = [{ key: 'rhythm-changes', file: rhythmChanges }];
    const l = launch(s, demo, ids, at(1), extras);
    expect(l.kind === 'open' && l.progression.id).toBe('mine');
    const added = listProgressions(s).find((p) => p.title === 'Rhythm changes in B♭ (demo)')!;
    expect(added.bars).toHaveLength(32);
    deleteProgression(s, added.id);
    launch(s, demo, ids, at(2), extras);
    expect(listProgressions(s).map((p) => p.id)).toEqual(['mine']);
  });

  it('an existing library is not buried under the demo', () => {
    const s = new MemoryStorage();
    saveProgression(s, { ...newProgression(), id: 'mine', updatedAt: '' }, at(0));
    const l = launch(s, demo, ids, at(1));
    expect(l.kind === 'open' && l.progression.id).toBe('mine');
    expect(listProgressions(s)).toHaveLength(1);
  });

  it("New uses the device's last-picked instrument", () => {
    const s = new MemoryStorage();
    writeDevice(s, { lastInstrument: 'eb-alto-sax' });
    const p = createProgression(s, ids, at(0));
    expect(p).toMatchObject({ title: 'Untitled', timeSignature: '4/4', barsPerRow: 4, instrument: 'eb-alto-sax', melody: [] });
    expect(p.bars).toHaveLength(4);
  });

  it('Duplicate copies everything as "‹title› (copy)" and lands at the top', () => {
    const s = new MemoryStorage();
    const src = saveProgression(s, { ...newProgression(), title: 'Blues', melody: [{ pitch: 60, d: 'q' }], id: 'src', updatedAt: '' }, at(0));
    createProgression(s, ids, at(1));
    const d = duplicateProgression(s, src, ids, at(2));
    expect(d.title).toBe('Blues (copy)');
    expect(d.melody).toEqual(src.melody);
    expect(d.id).not.toBe(src.id);
    expect(listProgressions(s)[0].id).toBe(d.id);
  });

  it('Rename persists (blank → Untitled)', () => {
    const s = new MemoryStorage();
    const p = createProgression(s, ids, at(0));
    renameProgression(s, p, '  Autumn  ', at(1));
    expect(readProgression(s, p.id)?.title).toBe('Autumn');
  });

  it('Delete + Undo restores exactly, updatedAt included', () => {
    const s = new MemoryStorage();
    const p = createProgression(s, ids, at(0));
    const raw = deleteProgression(s, p.id)!;
    expect(readProgression(s, p.id)).toBeNull();
    restoreProgression(s, p.id, raw);
    expect(readProgression(s, p.id)).toEqual(p);
  });
});

describe('import and storage migration', () => {
  it('Export one → import round-trips exactly, with a new id; a title clash gets "(2)"', () => {
    const s = new MemoryStorage();
    const p = saveProgression(s, { ...newProgression('violin'), title: 'Blues', melody: [{ pitch: 67, d: 'h' }], id: 'orig', updatedAt: '' }, at(0));
    const r = importTexts(s, [{ name: 'Blues.honeycomb.json', text: exportOne(p).text }], ids, at(5));
    expect(r.added).toHaveLength(1);
    const { id, updatedAt, ...data } = r.added[0];
    expect(id).not.toBe('orig');
    expect(data).toEqual({ ...p, id: undefined, updatedAt: undefined, title: 'Blues (2)' } as unknown as typeof data);
    expect(r.summary).toBe('Imported 1 progression');
  });

  it('a library bundle adds every entry at the top in file order; counts; a rejected file is named', () => {
    const s = new MemoryStorage();
    saveProgression(s, { ...newProgression(), title: 'Old', id: 'old', updatedAt: '' }, at(0));
    const bundle = exportAll([{ ...newProgression(), title: 'A' }, { ...newProgression(), title: 'B' }], at(1)).text;
    const r = importTexts(s, [{ name: 'lib.json', text: bundle }, { name: 'bad.json', text: '{' }], ids, at(10));
    expect(r.added.map((p) => p.title)).toEqual(['A', 'B']);
    expect(listProgressions(s).map((p) => p.title)).toEqual(['A', 'B', 'Old']);
    expect(r.summary).toBe('Imported 2 progressions · bad.json: not an Honeycomb file');
  });

  it('a hand-edited slot-crossing note imports shortened and padded, counted in the toast', () => {
    const s = new MemoryStorage();
    const text = JSON.stringify({ app: 'honeycomb', v: 2, kind: 'progression', progression: { title: 'X', bars: [[{ chord: 'C' }, { chord: 'F' }], [{ chord: 'G' }]], melody: [{ pitch: 60, d: 'q' }, { pitch: 62, d: 'h' }, { pitch: 64, d: 'q' }] } });
    const r = importTexts(s, [{ name: 'x.json', text }], ids, at(0));
    expect(r.added[0].melody).toEqual([{ pitch: 60, d: 'q' }, { pitch: 62, d: 'q' }, { d: 'q' }, { pitch: 64, d: 'q' }]);
    expect(r.summary).toBe('Imported 1 progression · 1 note shortened');
  });

  it('newer files are refused with the reload message', () => {
    const s = new MemoryStorage();
    const r = importTexts(s, [{ name: 'new.json', text: JSON.stringify({ app: 'honeycomb', v: 9, kind: 'progression', progression: { bars: [] } }) }]);
    expect(r.added).toHaveLength(0);
    expect(r.summary).toContain(NEWER_VERSION);
  });

  it('launch migrates older storage (v1 note-sets stripped) and bumps the device v', () => {
    const s = new MemoryStorage();
    s.setItem(PROGRESSION_PREFIX + 'a', JSON.stringify({ id: 'a', updatedAt: 'T', title: 'Old', bars: [[{ chord: 'C', notes: [60] }]] }));
    s.setItem(PROGRESSION_PREFIX + 'bad', '{corrupt');
    writeDevice(s, { v: 1, seeded: true });
    expect(migrateStorage(s)).toBe(true);
    expect(JSON.parse(s.getItem(PROGRESSION_PREFIX + 'a')!)).toEqual({ id: 'a', updatedAt: 'T', title: 'Old', bars: [[{ chord: 'C' }]], melody: [] });
    expect(s.getItem(PROGRESSION_PREFIX + 'bad')).toBe('{corrupt'); // raw string kept
    expect(readDevice(s).v).toBe(2);
  });

  it('newer storage → read-only: nothing is written', () => {
    const s = new MemoryStorage();
    writeDevice(s, { v: 3 });
    const before = s.getItem('honeycomb:device');
    expect(migrateStorage(s)).toBe(false);
    expect(isReadOnly()).toBe(true);
    createProgression(s, ids, at(0));
    writeDevice(s, { muted: true });
    expect(listProgressions(s)).toHaveLength(0);
    expect(s.getItem('honeycomb:device')).toBe(before);
    setReadOnly(false);
  });

  it('old improwiser:* keys move to honeycomb:* (new keys win), then migrate', () => {
    const s = new MemoryStorage();
    s.setItem('improwiser:device', JSON.stringify({ v: 2, muted: true }));
    s.setItem('improwiser:progression:a', JSON.stringify({ id: 'a', updatedAt: 'T', title: 'Old', bars: [[{ chord: 'C' }]], melody: [] }));
    s.setItem('improwiser:progression:b', '"stale"');
    s.setItem('honeycomb:progression:b', '"kept"');
    s.setItem('other', 'x');
    expect(migrateStorage(s)).toBe(true);
    expect(readDevice(s).muted).toBe(true);
    expect(listProgressions(s).map((p) => p.title)).toEqual(['Old']);
    expect(s.getItem('honeycomb:progression:b')).toBe('"kept"');
    expect(s.getItem('other')).toBe('x');
    expect([...Array(s.length).keys()].map((i) => s.key(i)).filter((k) => k?.startsWith('improwiser:'))).toEqual([]);
  });
});
