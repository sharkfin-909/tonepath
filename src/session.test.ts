// The editing session (SPEC §3.0–3.8, §6.2, §9): each mode's rules, entry, browsing, the transport and *On arrival*, as pure steps.
import { describe, expect, it } from 'vitest';
import { TICKS } from './melody';
import { newProgression, type Progression } from './progression';
import { activeIndex, initialSession, reduce, type Effect, type Intent, type SessionState } from './session';
import type { OnArrival } from './device';

const q = TICKS.q;
const W = 4 * q;

/** Dm7 | G7 | Cmaj7 | A7, concert, empty melody. */
const prog = (): Progression => ({
  ...newProgression(),
  bars: [[{ chord: 'Dm7' }], [{ chord: 'G7' }], [{ chord: 'Cmaj7' }], [{ chord: 'A7' }]],
  melody: [],
});

/** Apply intents in order, committing edits; collects every effect. */
function run(intents: Intent[], opts: { p?: Progression; onArrival?: OnArrival; state?: Partial<SessionState> } = {}) {
  let p = opts.p ?? prog();
  let state: SessionState = { ...initialSession(p, { onArrival: opts.onArrival ?? 'silent' }), mode: 'write', ...opts.state };
  const effects: Effect[] = [];
  const per: Effect[][] = [];
  for (const intent of intents) {
    const out = reduce(state, p, intent);
    if (out.edit) p = out.edit;
    state = out.state;
    effects.push(...out.effects);
    per.push(out.effects);
  }
  return { p, state, effects, per };
}

/** Effects as short strings: `note 62`, `chord D`. */
const show = (es: Effect[]) =>
  es.map((e) => (e.type === 'note' ? `note ${e.midi}` : 'harmony' in e ? `${e.type} ${e.harmony.kind === 'chord' ? e.harmony.root : '-'}` : e.type));

const pick = (written: number): Intent => ({ type: 'pick', written });

describe('Write etude: entry', () => {
  it('a pick inserts with the latched length, plays the note, and moves the caret', () => {
    const r = run([pick(62)]);
    expect(r.p.melody).toEqual([{ pitch: 62, d: 'q' }]);
    expect(r.state.caret).toBe(q);
    expect(show(r.effects)).toEqual(['note 62']);
  });

  it('a refused insert plays the note, records nothing, and flashes the length', () => {
    const r = run([{ type: 'length', d: 'w' }, pick(62)], { p: { ...prog(), melody: [{ pitch: 60, d: 'q' }] } });
    expect(r.p.melody).toHaveLength(1);
    expect(r.state.refusal).toMatchObject({ d: 'w', message: "Doesn't fit in this slot" });
    expect(show(r.per[1])).toEqual(['note 62']);
  });

  it('Rest on: a length key inserts a rest; a pick turns Rest off', () => {
    const r = run([{ type: 'toggle-rest' }, { type: 'length', d: 'h' }, pick(62)]);
    expect(r.p.melody).toEqual([{ d: 'h' }, { pitch: 62, d: 'h' }]);
    expect(r.state.rest).toBe(false);
  });

  it('the last note of the form puts the caret back at the start (first slot active)', () => {
    const r = run(Array.from({ length: 16 }, () => pick(60)));
    expect(r.state.caret).toBe(0);
    expect(activeIndex(r.state, r.p)).toBe(0);
    const again = reduce(r.state, r.p, pick(72));
    expect(again.edit!.melody[0]).toEqual({ pitch: 72, d: 'q' }); // overwrites from the start
  });
});

describe('opening, and the mode decides', () => {
  it('every open starts in Tuner, on the caret\'s slot (the melody\'s end)', () => {
    const p = { ...prog(), melody: [{ pitch: 62, d: 'w' as const }, { pitch: 67, d: 'q' as const }] };
    expect(initialSession(p, { onArrival: 'silent' })).toMatchObject({ mode: 'tuner', slot: 1, running: false });
  });

  it('only Write etude writes: a pick elsewhere auditions and records nothing', () => {
    for (const mode of ['tuner', 'improvise'] as const) {
      const r = run([{ type: 'mode', mode }, pick(62)]);
      expect(r.p.melody).toEqual([]);
      expect(show(r.per[1])).toContain('note 62');
    }
    expect(run([{ type: 'mode', mode: 'read' }, pick(62)]).per[1]).toEqual([]); // no hex in Read etude
  });

  it('only Write etude edits the melody: delete, nudge, Rest + length and Clear do nothing elsewhere', () => {
    const p = { ...prog(), melody: [{ pitch: 60, d: 'q' as const }] };
    const edits = [{ type: 'delete', back: true }, { type: 'nudge', dir: 1, octave: false }, { type: 'clear-notes' }, { type: 'clear-all' }, { type: 'step-play' }] as Intent[];
    for (const mode of ['tuner', 'improvise', 'read'] as const) {
      for (const i of edits) expect(run([{ type: 'mode', mode }, i], { p, state: { caret: q } }).p).toBe(p);
      const r = run([{ type: 'mode', mode }, { type: 'toggle-rest' }, { type: 'length', d: 'h' }], { p });
      expect(r.p).toBe(p);
    }
  });

  it('Tuner: no chord to sound, no chart to click', () => {
    const r = run([{ type: 'mode', mode: 'tuner' }, { type: 'sound', what: 'chord' }, { type: 'slot-click', index: 2 }, { type: 'browse', dir: 1 }, { type: 'bar-select', bar: 1, extend: false }]);
    expect(r.effects).toEqual([]);
    expect(r.state).toMatchObject({ slot: 0, selection: null });
    expect(run([{ type: 'mode', mode: 'tuner' }, { type: 'toggle-mute' }]).state.muted).toBe(true);
  });
});

describe('switching modes', () => {
  const to = (mode: Extract<Intent, { type: 'mode' }>['mode']): Intent => ({ type: 'mode', mode });
  it('[ / ] step through Tuner · Improvise · Write etude · Read etude, no wrap', () => {
    expect(run([to('prev')]).state.mode).toBe('improvise');
    expect(run([to('next')]).state.mode).toBe('read');
    expect(run([to('next'), to('next')]).state.mode).toBe('read');
    expect(run([to('tuner'), to('prev')]).state.mode).toBe('tuner');
  });

  it('\\ toggles Write etude ↔ Read etude; from Tuner or Improvise it goes to Read etude', () => {
    expect(run([to('toggle-read')]).state.mode).toBe('read');
    expect(run([to('toggle-read'), to('toggle-read')]).state.mode).toBe('write');
    expect(run([to('tuner'), to('toggle-read')]).state.mode).toBe('read');
  });

  it('the current slot carries: the caret\'s slot on the way out, the slot\'s start on the way back', () => {
    const r = run([to('improvise'), { type: 'browse', dir: 1 }, to('read'), { type: 'step', dir: 1 }, to('write')], { state: { caret: q } });
    expect(r.state).toMatchObject({ mode: 'write', caret: 2 * W });
    // Back to the caret's own slot: the caret stays where it was.
    expect(run([to('tuner'), to('write')], { state: { caret: q } }).state.caret).toBe(q);
  });

  it('switching stops the transport; the selection (= the looped bars) is kept', () => {
    const r = run([{ type: 'bar-select', bar: 2, extend: false }, to('improvise'), { type: 'transport', run: true }, to('read')]);
    expect(r.state).toMatchObject({ mode: 'read', running: false, selection: { from: 2, to: 2 }, slot: 2 });
  });
});

describe('Write etude: On arrival sounds with the first entry of a slot', () => {
  it('first note of a slot: the note plus the slot chord; later notes alone', () => {
    const r = run([pick(62), pick(65), pick(69), pick(72), pick(67)], { onArrival: 'chord' });
    expect(r.per.map(show)).toEqual([['note 62', 'chord D'], ['note 65'], ['note 69'], ['note 72'], ['note 67', 'chord G']]);
  });

  it('finishing a slot, moving the caret and browsing are silent', () => {
    const r = run([{ type: 'browse', dir: 1 }, { type: 'slot-click', index: 2 }, { type: 'step', dir: 1 }], { onArrival: 'chord' });
    expect(r.effects).toEqual([]);
  });

  it('bass note + chord: the chord and the bass an octave below the root note', () => {
    expect(show(run([pick(62)], { onArrival: 'bass-chord' }).effects)).toEqual(['note 62', 'chord D', 'bass D']);
  });
});

describe('Improvise (stopped)', () => {
  const improvise = (more: Intent[], onArrival: OnArrival = 'chord') => run([{ type: 'mode', mode: 'improvise' }, ...more], { onArrival });

  it('arriving is silent; the first note played there (hex or mic) brings the arrival sound, later ones play alone', () => {
    const r = improvise([{ type: 'browse', dir: 1 }, pick(67), pick(71)]);
    expect(r.per.map(show)).toEqual([[], [], ['note 67', 'chord G'], ['note 71']]);
    expect(improvise([{ type: 'heard' }, { type: 'heard' }]).per.map(show)).toEqual([[], ['chord D'], []]);
  });

  it('← / → and < > step slots, wrapping; clicking a slot makes it current', () => {
    expect(improvise([{ type: 'step', dir: -1 }]).state.slot).toBe(3);
    expect(improvise([{ type: 'step', dir: -1 }, { type: 'browse', dir: 1 }]).state.slot).toBe(0);
    expect(improvise([{ type: 'slot-click', index: 2 }]).state.slot).toBe(2);
  });

  it('edits the lead sheet\'s form: time signature, undo, "+" and the trash can — not the bar menu', () => {
    expect(improvise([{ type: 'append-bar' }]).p.bars).toHaveLength(5);
    expect(improvise([{ type: 'bar-action', bar: 3, action: 'delete' }]).p.bars).toHaveLength(3);
    expect(improvise([{ type: 'bar-action', bar: 1, action: 'duplicate' }]).p.bars).toHaveLength(4);
    expect(improvise([{ type: 'time-signature', text: '3/4' }]).p.timeSignature).toBe('3/4');
    expect(improvise([{ type: 'undo' }]).effects).toEqual([{ type: 'history', dir: 'undo' }]);
  });

  it('deleting the current slot\'s bar keeps the current slot in the form', () => {
    const r = improvise([{ type: 'step', dir: -1 }, { type: 'bar-action', bar: 3, action: 'delete' }]);
    expect(r.state.slot).toBe(2);
  });
});

describe('the transport (Improvise, Read etude)', () => {
  const improvise = (more: Intent[], opts: { onArrival?: OnArrival; state?: Partial<SessionState> } = {}) =>
    run([{ type: 'mode', mode: 'improvise' }, ...more], { onArrival: opts.onArrival ?? 'chord', state: opts.state });

  it('running: each chord sounds as it begins; nothing waits for a note; played notes don\'t bring it', () => {
    const r = improvise([{ type: 'transport', run: true }, { type: 'transport-chord', index: 0 }, { type: 'transport-chord', index: 1 }, pick(62)]);
    expect(r.per.map(show)).toEqual([[], [], ['chord D'], ['chord G'], ['note 62']]);
    expect(r.state).toMatchObject({ running: true, slot: 1, arrival: null });
  });

  it('running: slots aren\'t moved by hand and the form isn\'t edited', () => {
    const r = improvise([{ type: 'transport', run: true }, { type: 'step', dir: 1 }, { type: 'slot-click', index: 3 }, { type: 'append-bar' }, { type: 'time-signature', text: '3/4' }, { type: 'undo' }]);
    expect(r.state.slot).toBe(0);
    expect(r.p.bars).toHaveLength(4);
    expect(r.p.timeSignature).toBe('4/4');
    expect(r.effects).toEqual([]);
  });

  it('the end (no Loop) stops it on the first chord — of the looped bars, if any; rewind goes there too', () => {
    expect(improvise([{ type: 'transport', run: true }, { type: 'transport-chord', index: 3 }, { type: 'transport-end' }]).state).toMatchObject({ running: false, slot: 0 });
    const sel = improvise([{ type: 'bar-select', bar: 1, extend: false }, { type: 'bar-select', bar: 2, extend: true }, { type: 'step', dir: 1 }, { type: 'rewind' }]);
    expect(sel.state.slot).toBe(1);
  });

  it('starts from the current slot — or, outside the looped bars, from their first', () => {
    expect(improvise([{ type: 'browse', dir: 1 }, { type: 'transport', run: true }]).state.slot).toBe(1);
    const r = run([{ type: 'bar-select', bar: 2, extend: false }, { type: 'mode', mode: 'read' }, { type: 'slot-click', index: 0 }, { type: 'transport', run: true }]);
    expect(r.state).toMatchObject({ slot: 2, running: true });
  });

  it('stopping: in Improvise, the current slot\'s sound waits for the next note played', () => {
    const r = improvise([{ type: 'transport', run: true }, { type: 'transport', run: false }, { type: 'heard' }]);
    expect(show(r.per[3])).toEqual(['chord D']);
  });

  it('Write etude and Tuner have no transport', () => {
    expect(run([{ type: 'transport', run: true }]).state.running).toBe(false);
    expect(run([{ type: 'mode', mode: 'tuner' }, { type: 'transport', run: true }]).state.running).toBe(false);
  });
});

describe('Read etude', () => {
  const read = (more: Intent[], p = prog()) => run([{ type: 'mode', mode: 'read' }, ...more], { p, onArrival: 'chord', state: { caret: 0 } });
  const two = { ...prog(), melody: [{ pitch: 62, d: 'w' as const }, { pitch: 67, d: 'w' as const }] };

  it('stopped: clicking a slot moves the playhead there, silently; a note auditions and moves it to its slot', () => {
    const r = read([{ type: 'slot-click', index: 2 }]);
    expect(r.state.slot).toBe(2);
    expect(r.effects).toEqual([]);
    const n = read([{ type: 'event-click', event: { ev: two.melody[1], i: 1, start: W, end: 2 * W } }], two);
    expect(n.state.slot).toBe(1);
    expect(show(n.per[1])).toEqual(['note 67']);
  });

  it('▶ Chord / Bass / Scale preview the current slot; nothing edits', () => {
    const r = read([{ type: 'slot-click', index: 1 }, { type: 'sound', what: 'chord' }, { type: 'append-bar' }, { type: 'time-signature', text: '3/4' }, { type: 'bar-action', bar: 0, action: 'delete' }]);
    expect(show(r.per[2])).toEqual(['chord G']);
    expect(r.p).toEqual(prog());
  });

  it('running: chart clicks do nothing — slots, notes, bar numbers', () => {
    const r = read([{ type: 'transport', run: true }, { type: 'slot-click', index: 2 }, { type: 'event-click', event: { ev: two.melody[1], i: 1, start: W, end: 2 * W } }, { type: 'bar-select', bar: 1, extend: false }], two);
    expect(r.state).toMatchObject({ slot: 0, selection: null });
    expect(r.effects).toEqual([]);
  });
});

describe('Write etude: stepwise playback (` / ~)', () => {
  const melody = { ...prog(), melody: [{ pitch: 62, d: 'h' as const }, { d: 'h' as const }, { pitch: 67, d: 'w' as const }] };
  const step: Intent = { type: 'step-play' };

  it('each press plays the event at the caret and moves past it; rests pass silently; slot starts bring On arrival', () => {
    const r = run([step, step, step], { p: melody, onArrival: 'chord' });
    expect(r.per.map(show)).toEqual([['note 62', 'chord D'], [], ['note 67', 'chord G']]);
    expect(r.state.caret).toBe(2 * W);
    expect(r.p).toBe(melody); // nothing recorded
  });

  it('after the last event it starts again at bar 1; from inside an event it plays that event', () => {
    expect(show(run([step], { p: melody, state: { caret: 2 * W } }).effects)).toEqual(['note 62']);
    expect(run([step], { p: melody, state: { caret: q } }).state.caret).toBe(2 * q); // mid-note: plays it, caret to its end
  });

  it('back: the event before the caret, played, caret to its start; before the first, the last (wrapping)', () => {
    const back: Intent = { type: 'step-play', dir: -1 };
    const r = run([back, back, back, back], { p: melody, state: { caret: 2 * W } });
    expect(r.per.map(show)).toEqual([['note 67'], [], ['note 62'], ['note 67']]);
    expect(run([back], { p: melody, state: { caret: W } }).state.caret).toBe(W / 2); // the rest's start
    expect(run([back, step], { p: melody, state: { caret: W } }).per.map(show)).toEqual([[], []]); // back onto the rest, then over it
  });

  it('an empty melody, or another mode: nothing', () => {
    expect(run([step]).effects).toEqual([]);
    expect(run([{ type: 'mode', mode: 'improvise' }, step], { p: melody }).per[1]).toEqual([]);
  });
});

describe('browsing in Write etude', () => {
  it('< > move the caret to the slot start, wrapping', () => {
    expect(run([{ type: 'browse', dir: -1 }]).state.caret).toBe(3 * W);
    expect(run([{ type: 'browse', dir: 1 }]).state.caret).toBe(W);
  });
});

describe('sound, mute and settings', () => {
  it('C / B / ⇧Space sound the active slot (concert)', () => {
    const r = run([{ type: 'sound', what: 'chord' }, { type: 'sound', what: 'bass' }, { type: 'sound', what: 'scale' }]);
    expect(show(r.effects)).toEqual(['chord D', 'root D', 'scale D']);
  });

  it('mute and On arrival are remembered on the device', () => {
    const r = run([{ type: 'toggle-mute' }, { type: 'set-arrival', how: 'bass' }]);
    expect(r.state).toMatchObject({ muted: true, onArrival: 'bass' });
    expect(r.effects).toEqual([
      { type: 'device', patch: { muted: true } },
      { type: 'device', patch: { playArrival: 'bass' } },
    ]);
  });
});

describe('slots without a chord', () => {
  it('notes are written and played (N.C., empty); nudge steps by semitone', () => {
    const p = { ...prog(), bars: [[{ chord: 'N.C.' }], [{ chord: '' }]] };
    const r = run([pick(61), pick(66)], { p });
    expect(r.p.melody).toEqual([{ pitch: 61, d: 'q' }, { pitch: 66, d: 'q' }]);
    expect(show(r.effects)).toEqual(['note 61', 'note 66']);
    const n = run([{ type: 'nudge', dir: 1, octave: false }], { p: r.p, state: { caret: r.state.caret } });
    expect(n.p.melody[1]).toEqual({ pitch: 67, d: 'q' });
  });
});

describe('editing commands', () => {
  it('delete, nudge (plays, halo) and clear all', () => {
    const p = { ...prog(), melody: [{ pitch: 62, d: 'q' as const }, { pitch: 65, d: 'q' as const }] };
    const n = run([{ type: 'nudge', dir: 1, octave: false }], { p });
    expect(n.p.melody[1]).toEqual({ pitch: 66, d: 'q' }); // ↑: a semitone
    expect(show(n.effects)).toEqual(['note 66']);
    expect(n.state.halo?.pitch).toBe(66);
    const step = run([{ type: 'nudge', dir: 1, octave: false, scale: true }], { p });
    expect(step.p.melody[1]).toEqual({ pitch: 67, d: 'q' }); // ⌥↑: the next D Dorian step (F → G)
    expect(run([{ type: 'delete', back: true }], { p }).p.melody).toHaveLength(1);
    const c = run([{ type: 'clear-notes' }], { p });
    expect([c.p.melody, c.state.caret, c.p.bars]).toEqual([[], 0, p.bars]); // notes only
    const all = run([{ type: 'clear-all' }], { p: { ...p, bars: [[{ chord: 'Dm7', scale: 'aeolian' }], [{ chord: 'G7' }, { chord: 'G7alt' }]] } });
    expect([all.p.melody, all.p.bars]).toEqual([[], [[{ chord: '' }], [{ chord: '' }, { chord: '' }]]]); // bars and splits stay
  });

  it('bar actions: copy says so, delete refuses the last bar with a notice', () => {
    const r = run([{ type: 'bar-select', bar: 1, extend: false }, { type: 'bar-select', bar: 2, extend: true }, { type: 'bar-action', bar: 1, action: 'copy' }]);
    expect(r.state.notice?.text).toBe('Copied bars 2–3');
    const one = { ...prog(), bars: [[{ chord: 'C' }]] };
    expect(run([{ type: 'bar-action', bar: 0, action: 'delete' }], { p: one }).state.notice).not.toBeNull();
  });

  it('undo / redo are effects; a restore puts the caret back and clears selection and refusal', () => {
    expect(run([{ type: 'undo' }]).effects).toEqual([{ type: 'history', dir: 'undo' }]);
    const r = run([{ type: 'bar-select', bar: 1, extend: false }, { type: 'restored', caret: q }]);
    expect(r.state).toMatchObject({ caret: q, selection: null, refusal: null });
  });
});

describe('looped bars = the bar selection', () => {
  it('entering Improvise with bars selected starts on their first bar (when the caret is outside them)', () => {
    const r = run([{ type: 'bar-select', bar: 1, extend: false }, { type: 'bar-select', bar: 2, extend: true }, { type: 'mode', mode: 'improvise' }]);
    expect(r.state).toMatchObject({ slot: 1, selection: { anchor: 1, from: 1, to: 2 } });
    const back = run([{ type: 'mode', mode: 'write' }], { p: r.p, state: r.state });
    expect(back.state.selection).toEqual({ anchor: 1, from: 1, to: 2 }); // the same selection in Write etude
  });
  it('× (clear-selection) goes back to the whole form', () => {
    const r = run([{ type: 'bar-select', bar: 3, extend: false }, { type: 'mode', mode: 'improvise' }, { type: 'clear-selection' }]);
    expect(r.state.selection).toBeNull();
  });
});

describe('bar selection: ⇧ extends', () => {
  it('from the anchor; with nothing selected, from the caret\'s bar', () => {
    expect(run([{ type: 'bar-select', bar: 1, extend: false }, { type: 'bar-select', bar: 3, extend: true }]).state.selection).toEqual({ anchor: 1, from: 1, to: 3 });
    expect(run([{ type: 'bar-select', bar: 2, extend: true }], { state: { caret: 0 } }).state.selection).toEqual({ anchor: 0, from: 0, to: 2 });
  });
});

describe('Improvise / Read etude: bar numbers pick the bars to loop', () => {
  for (const mode of ['improvise', 'read'] as const) {
    it(`${mode}: a click loops that bar (moving there), ⇧ extends, the only one again: the whole form`, () => {
      const r0 = run([{ type: 'mode', mode }], { state: { caret: 0 } });
      const r = run([{ type: 'bar-select', bar: 2, extend: false }], { p: r0.p, state: r0.state });
      expect(r.state.selection).toEqual({ anchor: 2, from: 2, to: 2 });
      expect(r.state.slot).toBe(2);
      const ext = run([{ type: 'bar-select', bar: 3, extend: true }], { p: r.p, state: r.state });
      expect(ext.state.selection).toEqual({ anchor: 2, from: 2, to: 3 });
      expect(ext.state.slot).toBe(2);
      const off = run([{ type: 'bar-select', bar: 2, extend: false }], { p: r.p, state: r.state });
      expect(off.state.selection).toBeNull();
    });
  }
});

describe('deselecting', () => {
  it('Write: a plain click on any selected bar clears the selection', () => {
    const r = run([{ type: 'bar-select', bar: 1, extend: false }, { type: 'bar-select', bar: 3, extend: true }, { type: 'bar-select', bar: 2, extend: false }]);
    expect(r.state.selection).toBeNull();
  });
  it('Improvise: a plain click on any looped bar goes back to the whole form', () => {
    const r = run([{ type: 'mode', mode: 'improvise' }, { type: 'bar-select', bar: 1, extend: false }, { type: 'bar-select', bar: 3, extend: true }, { type: 'bar-select', bar: 3, extend: false }], { state: { caret: 0 } });
    expect(r.state.selection).toBeNull();
  });
});
