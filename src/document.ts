// The **progression document** (SPEC §6.3, §12.1): the open progression, its undo history and its persistence,
// behind one small interface. Every committed edit is one undo step (the progression and the caret before it) and
// one save; undo / redo restore a snapshot exactly and save it; another tab's write reloads it and clears undo.
// Storage is passed in (localStorage in the app, MemoryStorage in tests).

import { emptyHistory, record, redo, undo, type History } from './history';
import { newEtude, type Progression } from './progression';
import { PROGRESSION_PREFIX, saveProgression, writeProgression, type StoredProgression } from './storage';

/** One undo step: the whole progression and the caret. */
interface Snapshot {
  progression: StoredProgression;
  caret: number;
}

export interface ProgressionDocument {
  readonly progression: StoredProgression;
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  /** Commit an edit made at `caret`: one undo step + one save. False (nothing recorded) when it changes nothing. */
  commit(next: Progression, caret: number): boolean;
  /** Undo / redo from `caret`; returns the caret to restore, or null when there is nothing to undo / redo. */
  undo(caret: number): number | null;
  redo(caret: number): number | null;
  /**
   * A storage event from another tab: `deleted` (this progression is gone), `reloaded` (taken as is — last write
   * wins — and undo cleared), or `ignored` (another key, or an unreadable write).
   */
  external(key: string | null, value: string | null): 'deleted' | 'reloaded' | 'ignored';
  /** The safety save when the page hides: written as is, `updatedAt` kept. */
  flush(): void;
  /** Remember the open etude: written as is (`updatedAt` kept), no undo step. Undo snapshots carry it. */
  setOpenEtude(id: string): void;
}

export function openDocument(storage: Storage, initial: StoredProgression, now: () => Date = () => new Date()): ProgressionDocument {
  // Storage is migrated on launch (full repair is the schema's job); a record without etudes gets one empty etude.
  let current: StoredProgression = Array.isArray(initial.etudes) && initial.etudes.length ? initial : { ...initial, etudes: [newEtude()] };
  let history: History<Snapshot> = emptyHistory();

  const restore = (r: { history: History<Snapshot>; state: Snapshot } | null): number | null => {
    if (!r) return null;
    history = r.history;
    current = saveProgression(storage, r.state.progression, now());
    return r.state.caret;
  };

  return {
    get progression() {
      return current;
    },
    get canUndo() {
      return history.past.length > 0;
    },
    get canRedo() {
      return history.future.length > 0;
    },
    commit(next, caret) {
      if (next === current) return false;
      history = record(history, { progression: current, caret });
      current = saveProgression(storage, { ...current, ...next }, now());
      return true;
    },
    undo: (caret) => restore(undo(history, { progression: current, caret })),
    redo: (caret) => restore(redo(history, { progression: current, caret })),
    external(key, value) {
      if (key !== PROGRESSION_PREFIX + current.id) return 'ignored';
      if (value === null) return 'deleted';
      try {
        const next = JSON.parse(value) as StoredProgression;
        if (!Array.isArray(next.bars) || !Array.isArray(next.etudes) || next.etudes.length === 0) return 'ignored';
        current = next;
        history = emptyHistory();
        return 'reloaded';
      } catch {
        return 'ignored'; // unreadable write from elsewhere: keep what we have
      }
    },
    flush: () => writeProgression(storage, current),
    setOpenEtude(id) {
      if (current.openEtudeId === id) return;
      current = { ...current, openEtudeId: id };
      writeProgression(storage, current);
    },
  };
}
