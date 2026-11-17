// Library (SPEC §3.5), a modal over the chart screen. *Now open* on top — the open progression (rename in place) and
// its etude picker, so the state shows even where the header hides it (tablet and down) — then *My progressions*: rows
// newest edit first (title, instrument, bar count, last edited); click opens.
// New · Duplicate · Rename · Delete (immediate, ~10 s Undo toast that restores exactly) · Export one · Export all ·
// Import (several files at once; one toast with counts; new rows highlighted) · the backup reminder · a line for
// unreadable keys.
import { useEffect, useRef, useState } from 'react';
import { etudeSummary } from '../library';
import type { Etude } from '../progression';
import { EtudePicker } from '../rail/EtudePicker';
import { LockIcon, TitleField } from '../rail/RailSettings';
import type { StoredProgression } from '../storage';

/** The open chart, so the library can switch its etude without leaving the modal. */
export interface LibraryCurrent {
  /** The open progression's id (its row is marked) and title (renamed in place). */
  id: string;
  title: string;
  /** A standard (SPEC §3.12): its title is frozen. */
  locked: boolean;
  onRenameTitle: (text: string) => void;
  etudes: Etude[];
  open: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onRename: (text: string) => void;
  onDelete: () => void;
  /** Share etude… (SPEC §3.13). */
  onShare: () => void;
}

/** A standard's row (SPEC §3.12): built in; `stored` once opened (it holds your etudes over it). */
export interface StandardRow {
  id: string;
  title: string;
  bars: number;
  stored: StoredProgression | null;
}

export interface LibraryScreenProps {
  /** My progressions (the standards apart). */
  progressions: StoredProgression[];
  standards: StandardRow[];
  onOpenStandard: (id: string) => void;
  onCopyStandard: (id: string) => void;
  onOpen: (p: StoredProgression) => void;
  onNew: () => void;
  onDuplicate: (p: StoredProgression) => void;
  onRename: (p: StoredProgression, title: string) => void;
  onDelete: (p: StoredProgression) => void;
  /** The last delete, for the Undo toast; `n` changes on every delete. */
  deleted: { title: string; n: number } | null;
  onUndoDelete: () => void;
  onToastDone: () => void;
  onExportOne: (p: StoredProgression) => void;
  onExportAll: () => void;
  onImport: (files: FileList) => void;
  /** The last import's toast line (empty once shown) and new rows. */
  imported: { summary: string; ids: Set<string>; n: number } | null;
  onImportDone: () => void;
  /** Progression keys that couldn't be read (SPEC §12.1). */
  unreadable: number;
  /** The backup reminder, when due (SPEC §3.5). */
  reminder: { age: string; safari: boolean; onDismiss: () => void } | null;
  /** Back to the open progression (×, Esc, the backdrop); absent when none is open. */
  onClose?: () => void;
  /** The progression behind the modal, when one is open. */
  current?: LibraryCurrent | null;
}

/** "just now", "5 min ago", "3 h ago", "yesterday", "4 days ago", else the date. */
export function lastEdited(iso: string, now = new Date()): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '—';
  const min = Math.floor((now.getTime() - t) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.floor(h / 24);
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d} days ago`;
  return new Date(t).toLocaleDateString();
}

export function LibraryScreen(props: LibraryScreenProps) {
  const { progressions, onOpen, onNew, deleted, onUndoDelete, onToastDone, onExportAll, onImport, imported, onImportDone, unreadable, reminder, onClose, current } = props;
  const fileInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);

  // The dialog takes focus, so keys go to it (never to the chart behind).
  useEffect(() => {
    dialog.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    if (!imported?.summary) return;
    const id = setTimeout(onImportDone, 6000);
    return () => clearTimeout(id);
  }, [imported, onImportDone]);

  useEffect(() => {
    if (!deleted) return;
    const id = setTimeout(onToastDone, 10000);
    return () => clearTimeout(id);
  }, [deleted, onToastDone]);

  return (
    <div
      className="library-overlay"
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) onClose?.(); // the backdrop
      }}
    >
    <div
      ref={dialog}
      className="library"
      role="dialog"
      aria-modal="true"
      aria-label="Library"
      tabIndex={-1}
      onKeyDown={(e) => {
        e.stopPropagation(); // the chart's keys stay out of the library
        if (e.key === 'Escape' && onClose && !(e.target instanceof HTMLInputElement) && !(e.target instanceof Element && e.target.closest('.dropdown'))) {
          e.preventDefault();
          onClose();
        }
      }}
    >
      <header className="library-header">
        <h1>Library</h1>
        <span className="library-tools">
          <button type="button" className="library-tool" onClick={() => fileInput.current?.click()}>
            Import…
          </button>
          {progressions.length > 0 && (
            <button type="button" className="library-tool" onClick={onExportAll}>
              Export all
            </button>
          )}
          {progressions.length > 0 && (
            <button type="button" className="library-new" onClick={onNew}>
              + New
            </button>
          )}
          <input
            ref={fileInput}
            type="file"
            accept=".json,application/json"
            multiple
            hidden
            onChange={(e) => {
              if (e.currentTarget.files?.length) onImport(e.currentTarget.files);
              e.currentTarget.value = ''; // the same file can be imported again
            }}
          />
          {onClose && (
            <button type="button" className="library-close" title="Close (Esc)" aria-label="Close the library" onClick={onClose}>
              <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden>
                <path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </span>
      </header>
      {current && (
        <section className="library-current" aria-label="Now open">
          <h2 className="library-section">now open</h2>
          <div className="library-current-body">
            <span className="library-current-seq pill">
              <span className="pill-label">chord sequence:</span>
              <TitleField title={current.title} locked={current.locked} onRename={current.onRenameTitle} />
            </span>
            <span className="library-current-etude pill">
              <span className="pill-label">etude:</span>
              <EtudePicker
                etudes={current.etudes}
                open={current.open}
                onOpen={(id) => {
                  current.onOpen(id);
                  onClose?.();
                }}
                onNew={current.onNew}
                onDuplicate={current.onDuplicate}
                onRename={current.onRename}
                onDelete={current.onDelete}
                onShare={current.onShare}
              />
            </span>
          </div>
        </section>
      )}
      {reminder && (
        <p className="backup-reminder" role="note">
          Last backup: {reminder.age} ·{' '}
          <button type="button" className="link" onClick={onExportAll}>
            Export all
          </button>
          {reminder.safari && <span> · Safari can clear site data: add Tonepath to your home screen (or Dock) to keep it.</span>}
          <button type="button" className="dismiss" aria-label="Dismiss backup reminder" onClick={reminder.onDismiss}>
            ×
          </button>
        </p>
      )}
      {unreadable > 0 && (
        <p className="unreadable-note">
          {unreadable === 1 ? "1 progression couldn't be read" : `${unreadable} progressions couldn't be read`}
        </p>
      )}
      <h2 className="library-section">standards</h2>
      <ul className="library-list standards" aria-label="Standards">
        {props.standards.map((st) => (
          <li key={st.id} className={['library-row', st.id === current?.id && 'open'].filter(Boolean).join(' ')}>
            <button type="button" className="library-open" onClick={() => props.onOpenStandard(st.id)}>
              <span className="library-title">
                <LockIcon />
                {st.title}
                {st.id === current?.id && <span className="library-open-tag">open</span>}
              </span>
              <span className="library-meta">
                {st.stored && st.stored.etudes.some((e) => e.melody.length > 0) ? etudeSummary(st.stored) : 'read-only chords'} · {st.bars} bars
              </span>
            </button>
            <span className="library-actions">
              <button type="button" onClick={() => props.onCopyStandard(st.id)}>
                Make my own copy
              </button>
            </span>
          </li>
        ))}
      </ul>
      {progressions.length === 0 ? (
        <div className="library-empty">
          <p>No progressions yet.</p>
          <button type="button" className="library-new big" onClick={onNew}>
            + New progression
          </button>
        </div>
      ) : (
        <>
          <h2 className="library-section">my progressions</h2>
          <ul className="library-list" aria-label="My progressions">
            {progressions.map((p) => (
              <Row key={p.id} p={p} {...props} onOpen={onOpen} fresh={!!imported?.ids.has(p.id)} isOpen={p.id === current?.id} />
            ))}
          </ul>
        </>
      )}
      {imported?.summary && (
        <div key={`import-${imported.n}`} className="library-toast" role="status">
          {imported.summary}
        </div>
      )}
      {deleted && (
        <div key={deleted.n} className="library-toast" role="status">
          “{deleted.title}” deleted
          <button type="button" onClick={onUndoDelete}>
            Undo
          </button>
        </div>
      )}
    </div>
    </div>
  );
}

function Row({ p, fresh, isOpen, onOpen, onDuplicate, onRename, onDelete, onExportOne }: { p: StoredProgression; fresh: boolean; isOpen: boolean } & LibraryScreenProps) {
  const [renaming, setRenaming] = useState(false);
  const done = useRef(false);
  const finish = (text: string | null) => {
    if (done.current) return;
    done.current = true;
    setRenaming(false);
    if (text !== null) onRename(p, text);
  };
  return (
    <li className={['library-row', fresh && 'fresh', isOpen && 'open'].filter(Boolean).join(' ')}>
      {renaming ? (
        <input
          className="library-rename"
          aria-label="Title"
          defaultValue={p.title}
          autoFocus
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => {
            if (e.key === 'Enter') finish(e.currentTarget.value);
            else if (e.key === 'Escape') finish(null);
          }}
          onBlur={(e) => finish(e.currentTarget.value)}
        />
      ) : (
        <button type="button" className="library-open" onClick={() => onOpen(p)}>
          <span className="library-title">
            {p.title}
            {isOpen && <span className="library-open-tag">open</span>}
          </span>
          <span className="library-meta">
            {etudeSummary(p)} · {p.bars.length} bar{p.bars.length === 1 ? '' : 's'} · {lastEdited(p.updatedAt)}
          </span>
        </button>
      )}
      <span className="library-actions">
        <button type="button" onClick={() => onDuplicate(p)}>
          Duplicate
        </button>
        <button type="button" onClick={() => onExportOne(p)}>
          Export
        </button>
        <button
          type="button"
          onClick={() => {
            done.current = false;
            setRenaming(true);
          }}
        >
          Rename
        </button>
        <button type="button" className="danger" onClick={() => onDelete(p)}>
          Delete
        </button>
      </span>
    </li>
  );
}
