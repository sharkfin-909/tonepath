// Share links (SPEC §3.13): one etude and a copy of its chords, packed into the URL fragment; opening one imports it.
import { describe, expect, it } from 'vitest';
import { importShared, openStandard } from './library';
import { newProgression, type Progression } from './progression';
import { MAX_SHARE_URL, SHARE_PREFIX, decodeShare, encodeShare, shareLink, shareOf, shareToken } from './share';
import { FIRST_STANDARD, listMine, standardOf } from './standards';
import { listProgressions } from './storage';
import { MemoryStorage } from './test-memory-storage';

/** Dm7 | G7 | Cmaj7 | Cmaj7, two etudes. */
const prog = (): Progression => ({
  ...newProgression(),
  title: 'My ii–V',
  bars: [[{ chord: 'Dm7', scale: 'aeolian' }], [{ chord: 'G7' }], [{ chord: 'Cmaj7' }], [{ chord: 'Cmaj7' }]],
  etudes: [
    { id: 'e1', name: 'Warm-up', instrument: 'bb-trumpet', melody: [{ pitch: 62, d: 'q' }, { d: 'q' }, { pitch: 65, d: 'h' }] },
    { id: 'e2', name: 'Other', instrument: 'concert', melody: [{ pitch: 60, d: 'w' }] },
  ],
});

describe('encoding', () => {
  it('round-trips one etude with a copy of the chords (and the standard id, if any)', async () => {
    const s = shareOf(prog(), 'e1', 'std/x');
    const back = await decodeShare(await encodeShare(s));
    expect(back?.std).toBe('std/x');
    expect(back?.progression.bars).toEqual(prog().bars);
    expect(back?.progression.title).toBe('My ii–V');
    expect(back?.progression.etudes).toEqual([{ id: 'e1', name: 'Warm-up', instrument: 'bb-trumpet', melody: prog().etudes[0].melody }]);
  });

  it('the token is URL-safe and compact', async () => {
    const t = await encodeShare(shareOf(prog(), 'e1'));
    expect(t).toMatch(/^1[A-Za-z0-9_-]+$/);
    const long = { ...prog(), etudes: [{ ...prog().etudes[0], melody: Array.from({ length: 64 }, (_, i) => ({ pitch: 60 + (i % 12), d: 'e' as const })) }] };
    expect((await encodeShare(shareOf(long, 'e1'))).length).toBeLessThan(600);
  });

  it('garbage, another version or a broken payload is null; bad fields are repaired as a file import would', async () => {
    expect(await decodeShare('')).toBeNull();
    expect(await decodeShare('1!!!')).toBeNull();
    expect(await decodeShare('9abc')).toBeNull();
    const t = shareToken({ v: 1, p: { title: 'X', bars: [[{ chord: 'C' }]], etudes: [{ name: 'E', instrument: 'kazoo', melody: [{ pitch: 999, d: 'q' }, { d: 'q' }] }] } });
    const back = await decodeShare(await t);
    expect(back?.progression.etudes[0]).toMatchObject({ instrument: 'concert', melody: [{ d: 'q' }] });
  });

  it('the link: the page address and #share=…; too long, it says so', async () => {
    const r = await shareLink('https://tonepath.app/', prog(), 'e1');
    expect(r.kind === 'link' && r.url.startsWith(`https://tonepath.app/${SHARE_PREFIX}1`)).toBe(true);
    const huge = { ...prog(), etudes: [{ ...prog().etudes[0], melody: Array.from({ length: 20000 }, () => ({ pitch: Math.floor(Math.random() * 128), d: 's' as const })) }] };
    expect((await shareLink('https://tonepath.app/', huge, 'e1')).kind).toBe('too-long');
    expect(MAX_SHARE_URL).toBeGreaterThan(2000);
  });
});

describe('opening a share link', () => {
  it('over a standard this app has (same chords): the etude joins your etudes under it, opened', () => {
    const s = new MemoryStorage();
    const std = standardOf(FIRST_STANDARD)!;
    const shared = { std: FIRST_STANDARD, progression: { ...newProgression(), title: std.title, bars: std.bars, timeSignature: std.timeSignature, etudes: [{ id: 'e1', name: 'Etude 1', instrument: 'concert', melody: [{ pitch: 65, d: 'q' as const }] }] } };
    openStandard(s, FIRST_STANDARD); // already has your Etude 1
    const r = importShared(s, shared);
    expect(r.progression.id).toBe(FIRST_STANDARD);
    expect(r.progression.etudes.map((e) => e.name)).toEqual(['Etude 1', 'Etude 1 (shared)']);
    expect(r.progression.openEtudeId).toBe(r.etudeId);
    expect(r.progression.etudes.find((e) => e.id === r.etudeId)?.melody).toEqual([{ pitch: 65, d: 'q' }]);
    expect(listMine(listProgressions(s))).toEqual([]); // nothing new among my progressions
  });

  it('otherwise (no standard, one this app lacks, or chords that differ): a new progression of mine with its chords', () => {
    const s = new MemoryStorage();
    const p = prog();
    const one = { ...p, etudes: [p.etudes[0]] };
    for (const std of [undefined, 'std/not-here', FIRST_STANDARD]) {
      const r = importShared(s, { std, progression: one }, () => `id-${std}`);
      expect(r.progression.id).toBe(`id-${std}`);
      expect(r.progression.bars).toEqual(p.bars);
      expect(r.progression.etudes).toHaveLength(1);
      expect(r.progression.openEtudeId).toBe(r.etudeId);
    }
    expect(listMine(listProgressions(s)).map((x) => x.title).sort()).toEqual(['My ii–V (shared)', 'My ii–V (shared 2)', 'My ii–V (shared 3)'].sort());
  });
});
