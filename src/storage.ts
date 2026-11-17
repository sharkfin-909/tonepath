// Browser storage for progressions (SPEC §12.1): one key per progression.
// Library operations are in library.ts. Writes report success / quota failure to save-status listeners.

import { newProgression, type Progression } from './progression';
import { readDevice } from './device';
import { isReadOnly } from './readOnly';
import { withStandard } from './standards';

export const PROGRESSION_PREFIX = 'tonepath:progression:';

export interface StoredProgression extends Progression {
  id: string;
  updatedAt: string;
  /** The etude last open here (SPEC §3.0): reopened next time. Storage only — never in files, not an undo step. */
  openEtudeId?: string;
}

function isStored(x: unknown): x is StoredProgression {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as Record<string, unknown>;
  return typeof o.id === 'string' && typeof o.updatedAt === 'string' && Array.isArray(o.bars);
}

// ── Save status (SPEC §12.1): a quota error keeps the edit in memory and shows a persistent banner; every later
// save is the retry. Listeners hear the outcome of each write.
type SaveListener = (ok: boolean) => void;
const listeners = new Set<SaveListener>();
export function onSaveStatus(fn: SaveListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
function tryWrite(storage: Storage, key: string, value: string): boolean {
  let ok = true;
  try {
    storage.setItem(key, value);
  } catch (err) {
    ok = false;
    console.warn('Tonepath: could not save', err);
  }
  listeners.forEach((fn) => fn(ok));
  return ok;
}

/** Progression keys that can't be read (skipped in the library, raw strings left untouched). */
export function countUnreadable(storage: Storage): number {
  let n = 0;
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PROGRESSION_PREFIX)) continue;
    try {
      if (!isStored(JSON.parse(storage.getItem(key) ?? ''))) n++;
    } catch {
      n++;
    }
  }
  return n;
}

/** Every readable progression in storage, newest edit first. Corrupt keys are skipped; a standard comes back with its
 *  frozen chords (SPEC §3.12). */
export function listProgressions(storage: Storage): StoredProgression[] {
  const out: StoredProgression[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (!key?.startsWith(PROGRESSION_PREFIX)) continue;
    try {
      const parsed: unknown = JSON.parse(storage.getItem(key) ?? '');
      if (isStored(parsed)) out.push(withStandard(parsed));
    } catch {
      // corrupt key: skipped, raw string left in place
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** Write a progression as-is (no `updatedAt` bump): the safety save on hide, which isn't an edit. */
export function writeProgression(storage: Storage, p: StoredProgression): void {
  if (isReadOnly()) return;
  tryWrite(storage, PROGRESSION_PREFIX + p.id, JSON.stringify(p));
}

/** Save after a committed edit: `updatedAt` = now (the library's "last edited"). */
export function saveProgression(storage: Storage, p: StoredProgression, now = new Date()): StoredProgression {
  const saved = { ...p, updatedAt: now.toISOString() };
  if (isReadOnly()) return saved;
  tryWrite(storage, PROGRESSION_PREFIX + saved.id, JSON.stringify(saved)); // on failure the edit stays in memory
  return saved;
}

/** The progression to open on launch: the newest one, or a new one (saved immediately). */
export function openInitial(storage: Storage, makeId: () => string = () => crypto.randomUUID()): StoredProgression {
  const newest = listProgressions(storage)[0];
  if (newest) return newest;
  const instrument = readDevice(storage).lastInstrument;
  return saveProgression(storage, { ...newProgression(typeof instrument === 'string' ? instrument : undefined), id: makeId(), updatedAt: '' });
}
