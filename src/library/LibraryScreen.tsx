// Library screen (SPEC §3.5): rows newest edit first (title, instrument, bar count, last edited); click opens.
// New · Duplicate · Rename · Delete (immediate, ~10 s Undo toast that restores exactly) · Export one · Export all ·
// Import (several files at once; one toast with counts; new rows highlighted) · the backup reminder · a line for
// unreadable keys.
import { useEffect, useRef, useState } from 'react';
import { instrumentOf } from '../instruments';
import type { StoredProgression } from '../storage';

export interface LibraryScreenProps {
  progressions: StoredProgression[];
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
  const { progressions, onOpen, onNew, deleted, onUndoDelete, onToastDone, onExportAll, onImport, imported, onImportDone, unreadable, reminder } = props;
  const fileInput = useRef<HTMLInputElement>(null);

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
    <div className="library">
      <header className="library-header">
        <h1>Tonepath</h1>
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
        </span>
      </header>
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
      {progressions.length === 0 ? (
        <div className="library-empty">
          <p>No progressions yet.</p>
          <button type="button" className="library-new big" onClick={onNew}>
            + New progression
          </button>
        </div>
      ) : (
        <ul className="library-list" aria-label="Progressions">
          {progressions.map((p) => (
            <Row key={p.id} p={p} {...props} onOpen={onOpen} fresh={!!imported?.ids.has(p.id)} />
          ))}
        </ul>
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
  );
}

function Row({ p, fresh, onOpen, onDuplicate, onRename, onDelete, onExportOne }: { p: StoredProgression; fresh: boolean } & LibraryScreenProps) {
  const [renaming, setRenaming] = useState(false);
  const done = useRef(false);
  const finish = (text: string | null) => {
    if (done.current) return;
    done.current = true;
    setRenaming(false);
    if (text !== null) onRename(p, text);
  };
  return (
    <li className={fresh ? 'library-row fresh' : 'library-row'}>
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
          <span className="library-title">{p.title}</span>
          <span className="library-meta">
            {instrumentOf(p.instrument).name} · {p.bars.length} bar{p.bars.length === 1 ? '' : 's'} · {lastEdited(p.updatedAt)}
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
