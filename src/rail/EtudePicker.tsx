// The etude picker (SPEC §3.1): in every mode, the open etude — whose melody Write etude and Read etude show, and
// whose instrument every mode follows — and the progression's other etudes; then New, Duplicate, Rename and Delete
// (on the last etude: Clear, since a fresh empty one takes its place). Each is a session intent; all undo.
import { useState } from 'react';
import { instrumentOf } from '../instruments';
import type { Etude } from '../progression';
import { Dropdown, type DropdownOption } from './Dropdown';
import { InlineField } from './RailSettings';

export interface EtudePickerProps {
  etudes: Etude[];
  open: string;
  onOpen: (id: string) => void;
  onNew: () => void;
  onDuplicate: () => void;
  onRename: (text: string) => void;
  onDelete: () => void;
}

const ACTIONS = { new: 'action:new', duplicate: 'action:duplicate', rename: 'action:rename', delete: 'action:delete' } as const;

export function EtudePicker({ etudes, open, onOpen, onNew, onDuplicate, onRename, onDelete }: EtudePickerProps) {
  const [renaming, setRenaming] = useState(false);
  const current = etudes.find((e) => e.id === open) ?? etudes[0];
  if (renaming) {
    return (
      <span className="etude-picker">
        <InlineField value={current.name} label="Etude name" className="etude-name" startEditing onCommit={onRename} onDone={() => setRenaming(false)} />
      </span>
    );
  }
  const options: DropdownOption<string>[] = [
    ...etudes.map((e) => ({ value: e.id, label: e.name, hint: instrumentOf(e.instrument).name, asTyped: true })),
    { value: ACTIONS.new, label: 'New etude', divider: true },
    { value: ACTIONS.duplicate, label: 'Duplicate' },
    { value: ACTIONS.rename, label: 'Rename' },
    { value: ACTIONS.delete, label: etudes.length === 1 ? 'Clear etude' : 'Delete' },
  ];
  return (
    <span className="etude-picker">
      <Dropdown
        value={current.id}
        label="Etude"
        className="etude-select"
        options={options}
        onChange={(v) => {
          if (v === ACTIONS.new) onNew();
          else if (v === ACTIONS.duplicate) onDuplicate();
          else if (v === ACTIONS.rename) setRenaming(true);
          else if (v === ACTIONS.delete) onDelete();
          else onOpen(v);
        }}
      />
    </span>
  );
}
