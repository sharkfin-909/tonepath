// The chart screen for one progression, with the library as a modal over it (SPEC §3, §3.5).
// Launch reopens the last-open progression, seeding the bundled demo on first launch and each extra demo (rhythm
// changes) once per device (§12.5).
import { useCallback, useEffect, useRef, useState } from 'react';
import demo from '../examples/demo.tonepath.json';
import rhythmChanges from '../examples/rhythm-changes.tonepath.json';
import { App } from './App';
import {
  copyStandard,
  createProgression,
  openStandard,
  deleteProgression,
  duplicateProgression,
  importTexts,
  launch,
  migrateStorage,
  readProgression,
  rememberOpen,
  renameProgression,
  restoreProgression,
} from './library';
import { LibraryScreen, type LibraryCurrent } from './library/LibraryScreen';
import { Tooltips } from './Tooltips';
import { countUnreadable, listProgressions, onSaveStatus, type StoredProgression } from './storage';
import { backupAge, isSafari, shouldRemind } from './backup';
import { readDevice, writeDevice } from './device';
import { exportAll, exportOne } from './schema';
import { isReadOnly } from './readOnly';
import type { Carried } from './session';
import { FIRST_STANDARD, STANDARDS, listMine } from './standards';

/** The open progression (null: none, e.g. an empty library) — `n` re-mounts the chart when it changes underneath. */
type Chart = { progression: StoredProgression; rename: boolean; n: number } | null;

/** Save a text file through the browser's download. */
function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function initialChart(): Chart {
  migrateStorage(localStorage); // SPEC §12.4: older storage is migrated; newer makes the tab read-only
  // A first ever launch lands on the 12-bar blues standard (in grid improv, SPEC §3.0); the demos are still seeded.
  const l = launch(localStorage, demo, undefined, undefined, [{ key: 'rhythm-changes', file: rhythmChanges }], (s) => openStandard(s, FIRST_STANDARD));
  if (l.kind === 'empty') return null;
  rememberOpen(localStorage, l.progression.id);
  return { progression: l.progression, rename: false, n: 0 };
}

export function Root() {
  const [chart, setChart] = useState<Chart>(initialChart);
  /** The library modal: open over the chart — always, when no progression is open. */
  const [libraryOpen, setLibraryOpen] = useState(() => chart === null);
  const showLibrary = libraryOpen || chart === null;
  /** The chart's mode and bar clipboard: opening another progression keeps them (a reload starts afresh, SPEC §3.0). */
  const carried = useRef<Carried | undefined>(undefined);
  const onCarry = useCallback((c: Carried) => {
    carried.current = c;
  }, []);
  const [currentEtude, setCurrentEtude] = useState<LibraryCurrent | null>(null);
  const onEtudeDock = useCallback((dock: LibraryCurrent | null) => setCurrentEtude(dock), []);
  const [list, setList] = useState<StoredProgression[]>(() => listProgressions(localStorage));
  const [deleted, setDeleted] = useState<{ id: string; raw: string; title: string; n: number } | null>(null);
  const [unreadable, setUnreadable] = useState(() => countUnreadable(localStorage));
  const refresh = () => {
    setList(listProgressions(localStorage));
    setUnreadable(countUnreadable(localStorage));
  };

  // Quota errors (SPEC §12.1): a persistent banner until a later save succeeds.
  const [saveFailed, setSaveFailed] = useState(false);
  useEffect(() => onSaveStatus((ok) => setSaveFailed(!ok)), []);

  // The library list refreshes on any change from another tab.
  useEffect(() => {
    if (!showLibrary) return;
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea === localStorage) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [showLibrary]);

  // The open progression renamed from *now open*: its row follows (the edit is already saved).
  const openTitle = currentEtude?.title;
  useEffect(() => {
    if (showLibrary) refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- on a rename only
  }, [openTitle]);

  // Backup reminder (SPEC §3.5), re-read whenever the list changes.
  const [device, setDevice] = useState(() => readDevice(localStorage));
  useEffect(() => setDevice(readDevice(localStorage)), [list]);
  const remind = shouldRemind({ edits: list.map((p) => p.updatedAt), lastBackupAt: device.lastBackupAt, reminderDismissedAt: device.reminderDismissedAt });
  /** The last import: its toast line and the new rows to highlight. */
  const [imported, setImported] = useState<{ summary: string; ids: Set<string>; n: number } | null>(null);
  const onImportDone = useCallback(() => setImported((r) => (r ? { ...r, summary: '' } : r)), []);

  const onImport = async (files: FileList) => {
    const texts = await Promise.all([...files].map(async (f) => ({ name: f.name, text: await f.text() })));
    const r = importTexts(localStorage, texts);
    refresh();
    setImported((old) => ({ summary: r.summary, ids: new Set(r.added.map((p) => p.id)), n: (old?.n ?? 0) + 1 }));
  };

  const banner = isReadOnly() ? (
    <p className="read-only-banner" role="alert">
      Made by a newer Tonepath — reload to update. Nothing in this tab will be saved.
    </p>
  ) : (
    saveFailed && (
      <p className="read-only-banner" role="alert">
        Can't save — storage full. Export and delete some progressions.
      </p>
    )
  );

  const exportAllNow = () => {
    const f = exportAll(listProgressions(localStorage));
    download(f.filename, f.text);
    setDevice(writeDevice(localStorage, { lastBackupAt: new Date().toISOString() }));
  };

  const open = (p: StoredProgression, rename = false) => {
    rememberOpen(localStorage, p.id);
    setDeleted(null);
    setChart((c) => ({ progression: readProgression(localStorage, p.id) ?? p, rename, n: (c?.n ?? 0) + 1 }));
    setLibraryOpen(false);
  };
  const toLibrary = () => {
    refresh();
    setLibraryOpen(true);
  };
  /** The open progression changed in storage from the library (renamed): the chart reloads it. */
  const reloadIfOpen = (id: string) => {
    if (chart?.progression.id !== id) return;
    const p = readProgression(localStorage, id);
    if (p) setChart((c) => c && { progression: p, rename: false, n: c.n + 1 });
  };
  const onToastDone = useCallback(() => setDeleted(null), []);

  return (
    <>
    {banner}
    <Tooltips />
    {/* Keyed by id (and reloads): a fresh chart screen (and empty undo history) for every progression opened. */}
    {chart && (
      <App
        key={`${chart.progression.id}:${chart.n}`}
        initial={chart.progression}
        renameOnOpen={chart.rename}
        onLibrary={toLibrary}
        carried={carried.current}
        onCarry={onCarry}
        onEtudeDock={onEtudeDock}
        onCopyStandard={(id) => open(copyStandard(localStorage, id), true)}
      />
    )}
    {showLibrary && <LibraryScreen
      onClose={chart ? () => setLibraryOpen(false) : undefined}
      progressions={listMine(list)}
      standards={STANDARDS.map((st) => ({ id: st.id, title: st.title, bars: st.bars.length, stored: list.find((p) => p.id === st.id) ?? null }))}
      onOpenStandard={(id) => open(openStandard(localStorage, id))}
      onCopyStandard={(id) => open(copyStandard(localStorage, id), true)}
      onExportOne={(p) => {
        const f = exportOne(p);
        download(f.filename, f.text);
      }}
      onExportAll={exportAllNow}
      unreadable={unreadable}
      reminder={
        remind
          ? {
              age: backupAge(device.lastBackupAt),
              safari: isSafari(navigator.userAgent),
              onDismiss: () => setDevice(writeDevice(localStorage, { reminderDismissedAt: new Date().toISOString() })),
            }
          : null
      }
      onImport={onImport}
      imported={imported}
      onImportDone={onImportDone}
      onOpen={(p) => open(p)}
      onNew={() => open(createProgression(localStorage), true)}
      onDuplicate={(p) => open(duplicateProgression(localStorage, p))}
      onRename={(p, title) => {
        renameProgression(localStorage, p, title);
        refresh();
        reloadIfOpen(p.id);
      }}
      onDelete={(p) => {
        const raw = deleteProgression(localStorage, p.id);
        refresh();
        if (chart?.progression.id === p.id) setChart(null); // the open one: nothing behind the library now
        if (raw) setDeleted((old) => ({ id: p.id, raw, title: p.title, n: (old?.n ?? 0) + 1 }));
      }}
      deleted={deleted && { title: deleted.title, n: deleted.n }}
      onUndoDelete={() => {
        if (!deleted) return;
        restoreProgression(localStorage, deleted.id, deleted.raw);
        setDeleted(null);
        refresh();
      }}
      onToastDone={onToastDone}
      current={currentEtude}
    />}
    </>
  );
}
