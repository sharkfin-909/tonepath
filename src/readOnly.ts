// Newer storage than this app (SPEC §12.4): the tab treats storage as read-only and never writes.
let readOnly = false;

export function setReadOnly(on: boolean): void {
  readOnly = on;
}

export function isReadOnly(): boolean {
  return readOnly;
}
