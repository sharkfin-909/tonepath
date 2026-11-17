// The keyboard table (SPEC §11) as a test: key + mode → intent, and whether the browser default is suppressed.
import { describe, expect, it } from 'vitest';
import { keyIntent, type KeyContext, type KeyPress } from './keymap';

const key = (k: string, mods: Partial<KeyPress> = {}): KeyPress => ({ key: k, shiftKey: false, metaKey: false, ctrlKey: false, altKey: false, repeat: false, ...mods });
const ctx = (mode: KeyContext['mode'], more: Partial<KeyContext> = {}): KeyContext => ({ mode, selection: null, hovered: null, ...more });
const intent = (k: KeyPress, c: KeyContext) => keyIntent(k, c).intent;

describe('keymap (SPEC §11)', () => {
  it('Write etude: lengths, Rest, caret, nudge, delete, undo', () => {
    const w = ctx('write');
    expect(intent(key('3'), w)).toEqual({ type: 'length', d: 'q' });
    expect(intent(key('r'), w)).toEqual({ type: 'toggle-rest' });
    expect(intent(key('ArrowLeft'), w)).toEqual({ type: 'step', dir: -1 });
    expect(intent(key('ArrowUp', { shiftKey: true }), w)).toEqual({ type: 'nudge', dir: 1, octave: false, scale: false }); // ⇧: chromatic
    expect(intent(key('Backspace'), w)).toEqual({ type: 'delete', back: true });
    expect(intent(key('z', { metaKey: true }), w)).toEqual({ type: 'undo' });
    expect(intent(key('z', { metaKey: true, shiftKey: true }), w)).toEqual({ type: 'redo' });
    expect(intent(key('ArrowDown'), w)).toEqual({ type: 'nudge', dir: -1, octave: true }); // an octave
    expect(intent(key('ArrowUp'), w)).toEqual({ type: 'nudge', dir: 1, octave: true });
    expect(intent(key('ArrowUp', { altKey: true }), w)).toEqual({ type: 'nudge', dir: 1, octave: false, scale: true }); // ⌥: a scale step (diatonic)
    expect(intent(key('`'), w)).toEqual({ type: 'step-play' });
    expect(intent(key('~', { shiftKey: true }), w)).toEqual({ type: 'step-play' });
    expect(keyIntent(key('`', { repeat: true }), w)).toEqual({ intent: null, handled: true });
  });

  it('Space clicks under the pointer in every mode (no repeat); A picks the hovered pitch; ⇧Space plays the scale', () => {
    const over = ctx('write', { hovered: 67 });
    for (const mode of ['progression', 'write', 'grid', 'tune', 'improvise', 'read'] as const) {
      expect(keyIntent(key(' '), ctx(mode, { hovered: 67 }))).toEqual({ intent: null, handled: true, click: true });
    }
    expect(intent(key('a'), over)).toEqual({ type: 'pick', written: 67 });
    expect(keyIntent(key(' ', { repeat: true }), over)).toEqual({ intent: null, handled: true });
    expect(intent(key(' ', { shiftKey: true }), over)).toEqual({ type: 'sound', what: 'scale' });
    expect(intent(key('a'), ctx('improvise', { hovered: 60 }))).toEqual({ type: 'pick', written: 60 });
    expect(intent(key('a'), ctx('tune', { hovered: 60 }))).toEqual({ type: 'pick', written: 60 });
    expect(intent(key('a'), ctx('read', { hovered: 60 }))).toBeNull(); // no hex in Read etude
  });

  it('C / B / S sound the chord / bass / scale; < > (and , .) browse — not in Tune (no chord)', () => {
    for (const mode of ['progression', 'write', 'grid', 'improvise', 'read'] as const) {
      expect(intent(key('c'), ctx(mode))).toEqual({ type: 'sound', what: 'chord' });
      expect(intent(key('B', { shiftKey: true }), ctx(mode))).toEqual({ type: 'sound', what: 'bass' });
      expect(intent(key('<', { shiftKey: true }), ctx(mode))).toEqual({ type: 'browse', dir: -1 });
      expect(intent(key('.'), ctx(mode))).toEqual({ type: 'browse', dir: 1 });
      expect(intent(key('s'), ctx(mode))).toEqual({ type: 'sound', what: 'scale' });
    }
    expect(keyIntent(key('c', { repeat: true }), ctx('write'))).toEqual({ intent: null, handled: true });
    for (const k of ['c', 'b', 's']) expect(intent(key(k), ctx('tune'))).toBeNull();
    expect(keyIntent(key(' ', { shiftKey: true }), ctx('tune'))).toEqual({ intent: null, handled: true });
  });

  it('the lead sheet\'s modes and Read etude: ← / → step slots while stopped; editing keys do nothing but are swallowed', () => {
    for (const mode of ['progression', 'grid', 'improvise', 'read'] as const) {
      expect(intent(key('ArrowRight'), ctx(mode))).toEqual({ type: 'step', dir: 1 });
      expect(keyIntent(key('ArrowRight'), ctx(mode, { running: true }))).toEqual({ intent: null, handled: true });
      expect(keyIntent(key('Backspace'), ctx(mode))).toEqual({ intent: null, handled: true });
      expect(intent(key('3'), ctx(mode))).toBeNull();
      expect(intent(key('`'), ctx(mode))).toBeNull(); // stepwise playback: Write etude only
      expect(intent(key('Escape'), ctx(mode, { selection: { from: 1 } }))).toEqual({ type: 'clear-selection' }); // the whole form again
    }
    expect(intent(key('z', { metaKey: true }), ctx('improvise'))).toEqual({ type: 'undo' }); // the lead sheet's form
    expect(intent(key('z', { metaKey: true }), ctx('improvise', { running: true }))).toBeNull();
    expect(intent(key('z', { metaKey: true }), ctx('read'))).toBeNull();
    expect(intent(key('z', { metaKey: true }), ctx('progression'))).toEqual({ type: 'undo' });
    expect(intent(key('z', { metaKey: true }), ctx('grid'))).toBeNull(); // grid improv's chords are read-only
    expect(intent(key('a'), ctx('grid', { hovered: 60 }))).toEqual({ type: 'pick', written: 60 });
  });

  it('[ / ] previous / next mode, \\ the partner mode — in every mode; P does nothing; ⇧M mutes', () => {
    for (const mode of ['progression', 'write', 'grid', 'tune', 'improvise', 'read'] as const) {
      expect(intent(key('['), ctx(mode))).toEqual({ type: 'mode', mode: 'prev' });
      expect(intent(key(']'), ctx(mode))).toEqual({ type: 'mode', mode: 'next' });
      expect(intent(key('\\'), ctx(mode))).toEqual({ type: 'mode', mode: 'partner' });
      expect(intent(key('p'), ctx(mode))).toBeNull();
      expect(intent(key('M', { shiftKey: true }), ctx(mode))).toEqual({ type: 'toggle-mute' });
    }
    expect(keyIntent(key(']', { repeat: true }), ctx('write'))).toEqual({ intent: null, handled: true });
    expect(intent(key('m'), ctx('write'))).toBeNull(); // plain M: nothing
  });

  it('Tune: no chart keys — arrows / ⌫ swallowed, lengths nothing', () => {
    const t = ctx('tune');
    expect(keyIntent(key('ArrowLeft'), t)).toEqual({ intent: null, handled: true });
    expect(intent(key('3'), t)).toBeNull();
    expect(intent(key('<', { shiftKey: true }), t)).toBeNull();
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
