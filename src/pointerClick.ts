// Space = click (SPEC §11): Space clicks whatever is under the mouse pointer, anywhere in the app, as if the mouse
// button were pressed there. The full press sequence is sent (pointerdown → mousedown → pointerup → mouseup → click),
// so handlers that act on press (slots, the stave's time click) and on click (buttons, hex cells) both fire.

let at: { x: number; y: number } | null = null;

/** Follow the pointer; returns the cleanup. */
export function trackPointer(): () => void {
  const move = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' || e.pointerType === 'pen') at = { x: e.clientX, y: e.clientY };
  };
  const leave = (e: MouseEvent) => {
    if (!e.relatedTarget) at = null; // left the window
  };
  window.addEventListener('pointermove', move, true);
  window.addEventListener('pointerdown', move, true);
  document.addEventListener('mouseout', leave);
  return () => {
    window.removeEventListener('pointermove', move, true);
    window.removeEventListener('pointerdown', move, true);
    document.removeEventListener('mouseout', leave);
  };
}

/** Click the element under the pointer. False when the pointer is outside the window or over nothing. */
export function clickUnderPointer(): boolean {
  if (!at) return false;
  const el = document.elementFromPoint(at.x, at.y);
  if (!el) return false;
  const base = { bubbles: true, cancelable: true, composed: true, clientX: at.x, clientY: at.y, button: 0, view: window };
  const ptr = { ...base, pointerId: 1, pointerType: 'mouse', isPrimary: true };
  el.dispatchEvent(new PointerEvent('pointerdown', { ...ptr, buttons: 1 }));
  el.dispatchEvent(new MouseEvent('mousedown', { ...base, buttons: 1 }));
  // A real press focuses form fields: a text field starts editing. (Dropdowns are buttons: the click opens them.)
  const field = el.closest('input, textarea');
  if (field instanceof HTMLElement) field.focus();
  el.dispatchEvent(new PointerEvent('pointerup', ptr));
  el.dispatchEvent(new MouseEvent('mouseup', base));
  el.dispatchEvent(new MouseEvent('click', base));
  return true;
}
