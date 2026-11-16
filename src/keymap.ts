// Pure `keymap` module: the keyboard table of SPEC §11 as one function.
// A key press + where the screen is (mode, bar selection, the pitch under the pointer) → the session intent, and
// whether the browser's default should be suppressed (no page scroll, button activation or browser back).
// The caller ignores keys while a text field has focus (native undo and typing there).

import type { Duration } from './progression';
import { modeProfile } from './modeProfile';
import type { Intent, Mode } from './session';

export interface KeyPress {
  key: string;
  shiftKey: boolean;
  metaKey: boolean;
  ctrlKey: boolean;
  altKey: boolean;
  repeat: boolean;
}

export interface KeyContext {
  mode: Mode;
  /** The transport is running (Improvise, Read etude): slots aren't moved by hand, the form isn't edited. */
  running?: boolean;
  /** A bar selection is active. */
  selection: { from: number } | null;
  /** The written pitch A would pick: the hovered hex cell or ♯ / ♭ button, if playable. */
  hovered: number | null;
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

/** Keys shared by Write etude, Improvise and Read etude: A picks, S / ⇧Space scale, C / B sound, < > browse, ⇧M mute. */
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
  const m = modeProfile(ctx.mode, ctx.running);

  // Every mode: \ Write etude ↔ Read etude, [ / ] the previous / next mode (SPEC §11).
  if (plain && e.key === '\\') return handled({ type: 'mode', mode: 'toggle-read' });
  if (plain && (e.key === '[' || e.key === ']')) return handled(e.repeat ? null : { type: 'mode', mode: e.key === '[' ? 'prev' : 'next' });

  if (ctx.mode === 'tune') {
    // Tune: Space = click, A picks, ⇧M; no chord to sound (C, B, S do nothing), no chart.
    if (!plain) return NONE;
    if (e.key === ' ') return e.repeat || e.shiftKey ? handled() : CLICK;
    const k = e.key.toLowerCase();
    if (k === 'a') return handled(!e.repeat && ctx.hovered !== null ? { type: 'pick', written: ctx.hovered } : null);
    if (k === 'm' && e.shiftKey) return handled({ type: 'toggle-mute' });
    if (e.key.startsWith('Arrow') || e.key === 'Backspace') return handled();
    return NONE;
  }

  if (ctx.mode === 'improvise' || ctx.mode === 'read') {
    // Improvise / Read etude: ← / → step slots (stopped); the shared keys; Esc: the whole form again (no looped bars).
    if (cmd && (e.key === 'z' || e.key === 'Z')) return handled(m.editsForm ? { type: e.shiftKey ? 'redo' : 'undo' } : null);
    if (!plain) return NONE;
    if (e.key === 'Escape') return ctx.selection ? handled({ type: 'clear-selection' }) : NONE;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') return handled(m.movesByHand ? { type: 'step', dir: e.key === 'ArrowLeft' ? -1 : 1 } : null);
    if (!m.hex && e.key.toLowerCase() === 'a') return handled(); // no hex in Read etude
    const r = shared(e, ctx);
    if (r) return r;
    if (e.key.startsWith('Arrow') || e.key === 'Backspace' || e.key === 'Delete') return handled();
    return NONE;
  }

  // Write etude.
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
  // ⌥↑ / ⌥↓: nudge one step of the slot's scale (diatonic).
  if (e.altKey && !e.metaKey && !e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
    return handled({ type: 'nudge', dir: e.key === 'ArrowUp' ? 1 : -1, octave: false, scale: true });
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
      // ↑ / ↓: an octave; ⇧: a semitone (chromatic).
      return handled(e.shiftKey ? { type: 'nudge', dir: e.key === 'ArrowUp' ? 1 : -1, octave: false, scale: false } : { type: 'nudge', dir: e.key === 'ArrowUp' ? 1 : -1, octave: true });
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
