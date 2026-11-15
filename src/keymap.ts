// Pure `keymap` module: the keyboard table of SPEC §11 as one function.
// A key press + where the screen is (mode, bar selection, the pitch under the pointer) → the session intent, and
// whether the browser's default should be suppressed (no page scroll, button activation or browser back).
// The caller ignores keys while a text field has focus (native undo and typing there).

import type { Duration } from './progression';
import type { Intent } from './session';

export interface KeyPress {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  repeat: boolean;
}

export interface KeyContext {
  mode: 'write' | 'play' | 'stand';
  /** A bar selection is active (Write). */
  selection: { from: number } | null;
  /** The written pitch A would pick: the hovered hex cell or ♯ / ♭ button, if playable. */
  hovered: number | null;
  /** Practice (SPEC §3.7): Play with the mic; keys 1–5 still choose the note length (it sets the note count). */
  practice?: boolean;
}

export interface KeyResult {
  intent: Intent | null;
  /** Suppress the browser default. */
  handled: boolean;
  /** Space: click whatever is under the pointer (the caller does it; SPEC §11). */
  click?: boolean;
}

const NONE: KeyResult = { intent: null, handled: false };
const handled = (intent: Intent | null = null): KeyResult => ({ intent, handled: true });
const LENGTHS: Duration[] = ['w', 'h', 'q', 'e', 's'];

/** Space (no ⇧): a click under the pointer, in every mode. */
const CLICK: KeyResult = { intent: null, handled: true, click: true };

/** Keys shared by Write and Play: A picks, S / ⇧Space scale, C / B sound, < > browse, ⇧M mute. */
function shared(e: KeyPress, ctx: KeyContext): KeyResult | null {
  const k = e.key.toLowerCase();
  if (e.key === ' ') {
    if (e.repeat) return handled();
    if (e.shiftKey) return handled({ type: 'sound', what: 'scale' });
    return CLICK;
  }
  if (k === 'a') return handled(!e.repeat && ctx.hovered !== null ? { type: 'pick', written: ctx.hovered } : null);
  if (k === 'c' || k === 'b' || k === 's') {
    return handled(e.repeat ? null : { type: 'sound', what: k === 'c' ? 'chord' : k === 'b' ? 'bass' : 'scale' });
  }
  if (e.key === '<' || e.key === ',') return handled({ type: 'browse', dir: -1 });
  if (e.key === '>' || e.key === '.') return handled({ type: 'browse', dir: 1 });
  if (k === 'm' && e.shiftKey) return handled({ type: 'toggle-mute' }); // ⇧M (plain M does nothing)
  return null;
}

export function keyIntent(e: KeyPress, ctx: KeyContext): KeyResult {
  const plain = !e.metaKey && !e.ctrlKey && !e.altKey;
  const cmd = (e.metaKey || e.ctrlKey) && !e.altKey;

  if (plain && e.key === '\\') return handled({ type: 'stand', on: 'toggle' });

  if (ctx.mode === 'stand') {
    // Read (`stand`): only ⇧M, Space = click (and \ above). Nothing is editable.
    if (plain && e.shiftKey && (e.key === 'm' || e.key === 'M')) return handled({ type: 'toggle-mute' });
    if (plain && e.key === ' ' && !e.shiftKey) return e.repeat ? handled() : CLICK;
    if (plain && (e.key === ' ' || e.key.startsWith('Arrow') || e.key === 'Backspace')) return handled();
    return NONE;
  }

  // P leaves Practice for Write (there is no Play mode in the UI: P never enters it).
  if (plain && !e.shiftKey && (e.key === 'p' || e.key === 'P') && ctx.mode === 'play') return handled({ type: 'mode', mode: 'write' });

  if (ctx.mode === 'play') {
    // Play: ← / → step slots (wrapping); the shared keys; everything else does nothing.
    if (!plain) return NONE;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return handled({ type: 'step', dir: e.key === 'ArrowLeft' ? -1 : 1 });
    const r = shared(e, ctx);
    if (r) return r;
    if (e.key.startsWith('Arrow') || e.key === 'Backspace' || e.key === 'Delete') return handled();
    const d = ctx.practice && !e.shiftKey ? LENGTHS[Number(e.key) - 1] : undefined;
    if (d && e.key.length === 1) return handled({ type: 'length', d });
    return NONE;
  }

  // Write.
  if (cmd && (e.key === 'z' || e.key === 'Z')) return handled({ type: e.shiftKey ? 'redo' : 'undo' });
  if (ctx.selection) {
    // With a bar selection: ⌘C / ⌘V / ⌘D, ⌫ / Del deletes the bar(s), Esc clears it.
    const k = e.key.toLowerCase();
    const bar = ctx.selection.from;
    if (cmd && !e.shiftKey && (k === 'c' || k === 'v' || k === 'd')) {
      return handled({ type: 'bar-action', bar, action: k === 'c' ? 'copy' : k === 'v' ? 'paste' : 'duplicate' });
    }
    if (!e.metaKey && !e.ctrlKey && (e.key === 'Backspace' || e.key === 'Delete')) return handled({ type: 'bar-action', bar, action: 'delete' });
    if (e.key === 'Escape') return handled({ type: 'clear-selection' });
  }
  // ⌥↑ / ⌥↓: nudge by an octave.
  if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    return handled({ type: 'nudge', dir: e.key === 'ArrowUp' ? 1 : -1, octave: true });
  }
  if (!plain) return NONE;
  switch (e.key) {
    case '`':
    case '~':
      return handled(e.repeat ? null : { type: 'step-play' }); // stepwise playback, note by note
    case 'ArrowLeft':
    case 'ArrowRight':
      return handled({ type: 'step', dir: e.key === 'ArrowLeft' ? -1 : 1 });
    case 'ArrowUp':
    case 'ArrowDown':
      // ↑ / ↓: one step of the slot's scale (diatonic); ⇧: a semitone (chromatic).
      return handled({ type: 'nudge', dir: e.key === 'ArrowUp' ? 1 : -1, octave: false, scale: !e.shiftKey });
    case 'Delete':
    case 'Backspace':
      return handled({ type: 'delete', back: e.key === 'Backspace' });
  }
  const r = shared(e, ctx);
  if (r) return r;
  if (e.shiftKey) return NONE;
  if (e.key === 'r' || e.key === 'R') return handled({ type: 'toggle-rest' });
  const d = LENGTHS[Number(e.key) - 1];
  if (d && e.key.length === 1) return handled({ type: 'length', d });
  return NONE;
}
