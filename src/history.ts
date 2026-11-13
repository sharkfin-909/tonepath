// Pure undo history (SPEC §6.3): whole-progression snapshots including the caret, ~100 steps, in memory only.
// Snapshots are references: edits build new objects, so nothing is copied.

export const HISTORY_LIMIT = 100;

export interface History<S> {
  /** Oldest first; the last entry is what one undo restores. */
  past: S[];
  /** Nearest first. */
  future: S[];
}

export function emptyHistory<S>(): History<S> {
  return { past: [], future: [] };
}

/** Record the state before an edit: one undo step; redo is no longer possible; the oldest step drops past the cap. */
export function record<S>(h: History<S>, before: S, limit = HISTORY_LIMIT): History<S> {
  const past = [...h.past, before];
  return { past: past.length > limit ? past.slice(past.length - limit) : past, future: [] };
}

/** Undo: the state to restore, and the history with `present` kept for redo. Null when there is nothing to undo. */
export function undo<S>(h: History<S>, present: S): { history: History<S>; state: S } | null {
  if (!h.past.length) return null;
  return {
    state: h.past[h.past.length - 1],
    history: { past: h.past.slice(0, -1), future: [present, ...h.future] },
  };
}

/** Redo: the reverse of undo. */
export function redo<S>(h: History<S>, present: S): { history: History<S>; state: S } | null {
  if (!h.future.length) return null;
  return {
    state: h.future[0],
    history: { past: [...h.past, present], future: h.future.slice(1) },
  };
}
