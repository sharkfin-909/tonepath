// Pure-ish library operations over browser storage (SPEC §3.5, §12.1, §12.5): launch, demo seeding, new,
// duplicate, rename, delete + exact restore. One key per progression; no index key.

import { readDevice, writeDevice } from './device';
import { SCHEMA_VERSION, newProgression, setTitle, type Progression } from './progression';
import { importSummary, migrate, parseFile, uniqueTitle } from './schema';
import { PROGRESSION_PREFIX, listProgressions, saveProgression, type StoredProgression } from './storage';
import { isReadOnly, setReadOnly } from './readOnly';

type MakeId = () => string;
const uuid: MakeId = () => crypto.randomUUID();

/** Read one progression by id (null if missing or unreadable). */
export function readProgression(storage: Storage, id: string): StoredProgression | null {
  return listProgressions(storage).find((p) => p.id === id) ?? null;
}

/** Store a progression as a new library entry (fresh id, saved now). */
export function addProgression(storage: Storage, p: Progression, makeId: MakeId = uuid, now = new Date()): StoredProgression {
  return saveProgression(storage, { ...p, id: makeId(), updatedAt: '' }, now);
}

/** New (SPEC §3.5): "Untitled", 4 empty bars, 4/4, 4 per row, the device's last-picked instrument, no melody. */
export function createProgression(storage: Storage, makeId: MakeId = uuid, now = new Date()): StoredProgression {
  const inst = readDevice(storage).lastInstrument;
  return addProgression(storage, newProgression(typeof inst === 'string' ? inst : undefined), makeId, now);
}

/** Duplicate: copies everything as "‹title› (copy)"; newest, so it lands at the top. */
export function duplicateProgression(storage: Storage, p: StoredProgression, makeId: MakeId = uuid, now = new Date()): StoredProgression {
  const { id: _id, updatedAt: _u, ...data } = structuredClone(p);
  return addProgression(storage, { ...data, title: `${p.title} (copy)` }, makeId, now);
}

/** Rename from the library (same rules as the header title: trimmed, blank → "Untitled"). */
export function renameProgression(storage: Storage, p: StoredProgression, title: string, now = new Date()): StoredProgression {
  const next = setTitle(p, title);
  return next === p ? p : saveProgression(storage, { ...p, ...next }, now);
}

/** Delete: removes the key and returns the raw string, so Undo restores it exactly (updatedAt included). */
export function deleteProgression(storage: Storage, id: string): string | null {
  const key = PROGRESSION_PREFIX + id;
  const raw = storage.getItem(key);
  if (isReadOnly()) return null;
  storage.removeItem(key);
  return raw;
}

export function restoreProgression(storage: Storage, id: string, raw: string): void {
  if (isReadOnly()) return;
  storage.setItem(PROGRESSION_PREFIX + id, raw);
}

export interface ImportResult {
  /** The new library entries, top first (highlight them). */
  added: StoredProgression[];
  /** One toast line with counts (SPEC §12.3). */
  summary: string;
}

/**
 * Import files (SPEC §12.3): either kind, several at once; **only adds** (fresh id, `updatedAt` = now, title clash →
 * "(2)"). Entries go to the top in file order. Rejected files and skipped entries are reported in the summary.
 */
export function importTexts(storage: Storage, files: { name: string; text: string }[], makeId: MakeId = uuid, now = new Date()): ImportResult {
  const taken = new Set(listProgressions(storage).map((p) => p.title));
  const added: StoredProgression[] = [];
  const rejected: { name: string; message: string }[] = [];
  let skipped = 0;
  let shortened = 0;
  let unknownInstruments = 0;
  const incoming: Progression[] = [];
  for (const f of files) {
    const r = parseFile(f.text);
    if (!r.ok) {
      rejected.push({ name: f.name, message: r.message });
      continue;
    }
    incoming.push(...r.progressions);
    skipped += r.skipped;
    shortened += r.shortened;
    unknownInstruments += r.unknownInstruments;
  }
  incoming.forEach((p, i) => {
    const title = uniqueTitle(p.title, taken);
    taken.add(title);
    // The first entry is the newest, so the batch lands at the top in file order.
    added.push(addProgression(storage, { ...p, title }, makeId, new Date(now.getTime() - i)));
  });
  return { added, summary: importSummary({ added: added.length, skipped, shortened, unknownInstruments, rejected }) };
}

/**
 * Storage migration on launch (SPEC §12.4): the device `v` speaks for all storage. Older → every progression key is
 * migrated in memory and written back, then `v` is bumped. Newer → storage is left alone and the tab is read-only.
 * Returns false for newer storage.
 */
/** Storage keys from before the rename to Honeycomb: moved to `honeycomb:*` once (existing new keys win). */
const LEGACY_PREFIX = 'improwiser:';
const PREFIX = 'honeycomb:';

export function renameLegacyKeys(storage: Storage): void {
  const old: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(LEGACY_PREFIX)) old.push(key);
  }
  for (const key of old) {
    const target = PREFIX + key.slice(LEGACY_PREFIX.length);
    try {
      if (storage.getItem(target) === null) storage.setItem(target, storage.getItem(key) ?? '');
      storage.removeItem(key);
    } catch {
      // storage full: the old key stays and the move is retried next launch
    }
  }
}

export function migrateStorage(storage: Storage): boolean {
  renameLegacyKeys(storage);
  const device = readDevice(storage);
  const v = typeof device.v === 'number' && Number.isInteger(device.v) ? device.v : 1;
  if (v > SCHEMA_VERSION) {
    setReadOnly(true);
    return false;
  }
  if (v < SCHEMA_VERSION) {
    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i);
      if (!key?.startsWith(PROGRESSION_PREFIX)) continue;
      try {
        const raw: unknown = JSON.parse(storage.getItem(key) ?? '');
        if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
          storage.setItem(key, JSON.stringify(migrate(raw as Record<string, unknown>, v)));
        }
      } catch {
        // corrupt key: left exactly as it is
      }
    }
    writeDevice(storage, { v: SCHEMA_VERSION });
  }
  return true;
}

export type Launch = { kind: 'open'; progression: StoredProgression } | { kind: 'empty' };

/** A further bundled demo, added to every library once (by `key`), even a non-empty one. */
export interface ExtraDemo {
  key: string;
  file: unknown;
}

/**
 * Launch (SPEC §12.5): first launch seeds the demo once (guarded by `seeded`, so deleting it is permanent);
 * then reopen `lastOpenId`, or if it is missing / dangling the newest; an empty library → the empty state.
 * Each extra demo is added once per device (`seededDemos`, so deleting it is permanent too) without being opened.
 */
export function launch(storage: Storage, demo: unknown, makeId: MakeId = uuid, now = new Date(), extras: ExtraDemo[] = []): Launch {
  const device = readDevice(storage);
  if (!device.seeded) {
    // Through the normal import path. Existing (pre-library) progressions count as a library already: don't bury them.
    if (listProgressions(storage).length === 0) importTexts(storage, [{ name: 'demo', text: JSON.stringify(demo) }], makeId, now);
    writeDevice(storage, { seeded: true });
  }
  const all = listProgressions(storage);
  const last = device.lastOpenId ? all.find((p) => p.id === device.lastOpenId) : undefined;
  const open = last ?? all[0];
  // Extra demos join the library after the choice of what to open, so they never displace it.
  const seeded = device.seededDemos ?? [];
  const fresh = extras.filter((x) => !seeded.includes(x.key));
  if (fresh.length) {
    importTexts(storage, fresh.map((x) => ({ name: x.key, text: JSON.stringify(x.file) })), makeId, now);
    writeDevice(storage, { seededDemos: [...seeded, ...fresh.map((x) => x.key)] });
  }
  const opened = open ?? listProgressions(storage)[0];
  return opened ? { kind: 'open', progression: opened } : { kind: 'empty' };
}

/** Remember the open progression for the next launch. */
export function rememberOpen(storage: Storage, id: string): void {
  writeDevice(storage, { lastOpenId: id });
}
