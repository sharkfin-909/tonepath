// The app's two screens (SPEC §3): the library and the chart screen for one progression.
// Launch reopens the last-open progression, seeding the bundled demo on first launch and each extra demo (rhythm
// changes) once per device (§12.5).
import { useCallback, useEffect, useState } from 'react';
import demo from '../examples/demo.tonepath.json';
import rhythmChanges from '../examples/rhythm-changes.tonepath.json';
import { App } from './App';
import {
  createProgression,
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
import { LibraryScreen } from './library/LibraryScreen';
import { Tooltips } from './Tooltips';
import { countUnreadable, listProgressions, onSaveStatus, type StoredProgression } from './storage';
import { backupAge, isSafari, shouldRemind } from './backup';
import { readDevice, writeDevice } from './device';
import { exportAll, exportOne } from './schema';
import { isReadOnly } from './readOnly';

type Screen = { kind: 'library' } | { kind: 'chart'; progression: StoredProgression; rename: boolean };

/** Save a text file through the browser's download. */
function download(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function initialScreen(): Screen {
  migrateStorage(localStorage); // SPEC §12.4: older storage is migrated; newer makes the tab read-only
  const l = launch(localStorage, demo, undefined, undefined, [{ key: 'rhythm-changes', file: rhythmChanges }]);
  if (l.kind === 'empty') return { kind: 'library' };
  rememberOpen(localStorage, l.progression.id);
  return { kind: 'chart', progression: l.progression, rename: false };
}

export function Root() {
  const [screen, setScreen] = useState<Screen>(initialScreen);
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
    if (screen.kind !== 'library') return;
    const onStorage = (e: StorageEvent) => {
      if (e.storageArea === localStorage) refresh();
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [screen.kind]);

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
    setScreen({ kind: 'chart', progression: readProgression(localStorage, p.id) ?? p, rename });
  };
  const toLibrary = () => {
    refresh();
    setScreen({ kind: 'library' });
  };
  const onToastDone = useCallback(() => setDeleted(null), []);

  if (screen.kind === 'chart') {
    // Keyed by id: a fresh chart screen (and empty undo history) for every progression opened.
    return (
      <>
        {banner}
        <Tooltips />
        <App key={screen.progression.id} initial={screen.progression} renameOnOpen={screen.rename} onLibrary={toLibrary} />
      </>
    );
  }
  return (
    <>
    {banner}
    <Tooltips />
    <LibraryScreen
      progressions={list}
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
      }}
      onDelete={(p) => {
        const raw = deleteProgression(localStorage, p.id);
        refresh();
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
    />
    </>
  );
}
