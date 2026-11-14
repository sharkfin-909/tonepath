// The keyboard table (SPEC §11) as a test: key + mode → intent, and whether the browser default is suppressed.
import { describe, expect, it } from 'vitest';
import { keyIntent, type KeyContext, type KeyPress } from './keymap';

const key = (k: string, mods: Partial<KeyPress> = {}): KeyPress => ({ key: k, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, repeat: false, ...mods });
const ctx = (mode: KeyContext['mode'], more: Partial<KeyContext> = {}): KeyContext => ({ mode, selection: null, hovered: null, ...more });
const intent = (k: KeyPress, c: KeyContext) => keyIntent(k, c).intent;

describe('keymap (SPEC §11)', () => {
  it('Write: lengths, Rest, caret, nudge, delete, undo', () => {
    const w = ctx('write');
    expect(intent(key('3'), w)).toEqual({ type: 'length', d: 'q' });
    expect(intent(key('r'), w)).toEqual({ type: 'toggle-rest' });
    expect(intent(key('ArrowLeft'), w)).toEqual({ type: 'step', dir: -1 });
    expect(intent(key('ArrowUp', { shiftKey: true }), w)).toEqual({ type: 'nudge', dir: 1, octave: true });
    expect(intent(key('Backspace'), w)).toEqual({ type: 'delete', back: true });
    expect(intent(key('z', { metaKey: true }), w)).toEqual({ type: 'undo' });
    expect(intent(key('z', { metaKey: true, shiftKey: true }), w)).toEqual({ type: 'redo' });
    expect(intent(key('ArrowDown'), w)).toEqual({ type: 'nudge', dir: -1, octave: false });
    expect(intent(key('ArrowUp', { altKey: true }), w)).toEqual({ type: 'nudge', dir: 1, octave: false, scale: true });
    expect(intent(key('`'), w)).toEqual({ type: 'step-play' });
    expect(intent(key('~', { shiftKey: true }), w)).toEqual({ type: 'step-play' });
    expect(keyIntent(key('`', { repeat: true }), w)).toEqual({ intent: null, handled: true });
    expect(intent(key('`'), ctx('play'))).toBeNull(); // Write only
  });

  it('Space clicks under the pointer in every mode (no repeat); A picks the hovered pitch; ⇧Space plays the scale', () => {
    const over = ctx('write', { hovered: 67 });
    for (const mode of ['write', 'play', 'stand'] as const) {
      expect(keyIntent(key(' '), ctx(mode, { hovered: 67 }))).toEqual({ intent: null, handled: true, click: true });
    }
    expect(intent(key('a'), over)).toEqual({ type: 'pick', written: 67 });
    expect(keyIntent(key(' ', { repeat: true }), over)).toEqual({ intent: null, handled: true });
    expect(intent(key(' ', { shiftKey: true }), over)).toEqual({ type: 'sound', what: 'scale' });
    expect(intent(key('a'), ctx('play', { hovered: 60 }))).toEqual({ type: 'pick', written: 60 });
  });

  it('C / B / S sound the chord / bass / scale; < > (and , .) browse — in Write and Play', () => {
    for (const mode of ['write', 'play'] as const) {
      expect(intent(key('c'), ctx(mode))).toEqual({ type: 'sound', what: 'chord' });
      expect(intent(key('B', { shiftKey: true }), ctx(mode))).toEqual({ type: 'sound', what: 'bass' });
      expect(intent(key('<', { shiftKey: true }), ctx(mode))).toEqual({ type: 'browse', dir: -1 });
      expect(intent(key('.'), ctx(mode))).toEqual({ type: 'browse', dir: 1 });
    }
    expect(keyIntent(key('c', { repeat: true }), ctx('write'))).toEqual({ intent: null, handled: true });
    for (const mode of ['write', 'play'] as const) expect(intent(key('s'), ctx(mode))).toEqual({ type: 'sound', what: 'scale' });
  });

  it('Play: ← / → step slots; editing keys do nothing but are swallowed', () => {
    const p = ctx('play');
    expect(intent(key('ArrowRight'), p)).toEqual({ type: 'step', dir: 1 });
    expect(keyIntent(key('Backspace'), p)).toEqual({ intent: null, handled: true });
    expect(intent(key('3'), p)).toBeNull();
    expect(intent(key('z', { metaKey: true }), p)).toBeNull();
  });

  it('P toggles Write / Play; \\ toggles Stand; M mutes', () => {
    expect(intent(key('p'), ctx('write'))).toEqual({ type: 'mode', mode: 'toggle' });
    expect(intent(key('\\'), ctx('play'))).toEqual({ type: 'stand', on: 'toggle' });
    expect(intent(key('m'), ctx('write'))).toEqual({ type: 'toggle-mute' });
  });

  it('Stand: only M, \\ and Space (click); arrows / ⌫ swallowed', () => {
    const s = ctx('stand', { hovered: 60 });
    expect(intent(key('m'), s)).toEqual({ type: 'toggle-mute' });
    expect(intent(key('\\'), s)).toEqual({ type: 'stand', on: 'toggle' });
    expect(keyIntent(key('ArrowLeft'), s)).toEqual({ intent: null, handled: true });
    expect(intent(key('a'), s)).toBeNull();
    expect(keyIntent(key('p'), s)).toEqual({ intent: null, handled: false });
  });

  it('with a bar selection: ⌘C / ⌘V / ⌘D, ⌫ deletes bars, Esc clears', () => {
    const sel = ctx('write', { selection: { from: 2 } });
    expect(intent(key('c', { metaKey: true }), sel)).toEqual({ type: 'bar-action', bar: 2, action: 'copy' });
    expect(intent(key('d', { ctrlKey: true }), sel)).toEqual({ type: 'bar-action', bar: 2, action: 'duplicate' });
    expect(intent(key('Backspace'), sel)).toEqual({ type: 'bar-action', bar: 2, action: 'delete' });
    expect(intent(key('Escape'), sel)).toEqual({ type: 'clear-selection' });
    expect(intent(key('Backspace'), ctx('write'))).toEqual({ type: 'delete', back: true });
  });
});
