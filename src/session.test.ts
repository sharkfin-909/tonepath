// The editing session (SPEC §3.0–3.8, §6.2, §9): each mode's rules, entry, browsing, the transport and *On arrival*, as pure steps.
import { describe, expect, it } from 'vitest';
import { melodyOf, withFlat } from './test-progression';
import { TICKS } from './melody';
import { newProgression, type Progression } from './progression';
import { activeIndex, initialSession, reduce, type Effect, type Intent, type Outcome, type SessionState } from './session';
import type { OnArrival } from './device';

const q = TICKS.q;
const W = 4 * q;

/** Dm7 | G7 | Cmaj7 | A7, concert, empty melody. */
const prog = (): Progression => (withFlat(newProgression(), {
  bars: [[{ chord: 'Dm7' }], [{ chord: 'G7' }], [{ chord: 'Cmaj7' }], [{ chord: 'A7' }]],
  melody: [],
}));

/** The effects the screen performs besides sounds and device writes: tested on their own (`signals`). The mode
 * remembered on every switch counts as one. */
const SIGNALS: Effect['type'][] = ['light', 'transport-restart'];
const isSignal = (e: Effect) => SIGNALS.includes(e.type) || (e.type === 'device' && 'lastMode' in e.patch);

/** Apply intents in order, committing edits; collects every effect (`signals` apart). */
function run(intents: Intent[], opts: { p?: Progression; onArrival?: OnArrival; state?: Partial<SessionState> } = {}) {
  let p = opts.p ?? prog();
  let state: SessionState = { ...initialSession(p, { onArrival: opts.onArrival ?? 'silent' }), mode: 'write', ...opts.state };
  const effects: Effect[] = [];
  const per: Effect[][] = [];
  const signals: Effect[][] = [];
  const outcomes: Outcome[] = [];
  for (const intent of intents) {
    const out = reduce(state, p, intent);
    if (out.edit) p = out.edit;
    state = out.state;
    const sounds = out.effects.filter((e) => !isSignal(e));
    effects.push(...sounds);
    per.push(sounds);
    signals.push(out.effects.filter(isSignal));
    outcomes.push(out);
  }
  return { p, state, effects, per, signals, outcomes };
}

/** Effects as short strings: `note 62`, `chord D`. */
const show = (es: Effect[]) =>
  es.map((e) => (e.type === 'note' ? `note ${e.midi}` : 'harmony' in e ? `${e.type} ${e.harmony.kind === 'chord' ? e.harmony.root : '-'}` : e.type));

const pick = (written: number): Intent => ({ type: 'pick', written });

describe('Write etude: entry', () => {
  it('a pick inserts with the latched length, plays the note, and moves the caret', () => {
    const r = run([pick(62)]);
    expect(melodyOf(r.p)).toEqual([{ pitch: 62, d: 'q' }]);
    expect(r.state.caret).toBe(q);
    expect(show(r.effects)).toEqual(['note 62']);
  });

  it('a refused insert plays the note, records nothing, and flashes the length', () => {
    const r = run([{ type: 'length', d: 'w' }, pick(62)], { p: withFlat(prog(), { melody: [{ pitch: 60, d: 'q' }] }) });
    expect(melodyOf(r.p)).toHaveLength(1);
    expect(r.state.refusal).toMatchObject({ d: 'w', message: "Doesn't fit in this slot" });
    expect(show(r.per[1])).toEqual(['note 62']);
  });

  it('Rest on: a length key inserts a rest; a pick turns Rest off', () => {
    const r = run([{ type: 'toggle-rest' }, { type: 'length', d: 'h' }, pick(62)]);
    expect(melodyOf(r.p)).toEqual([{ d: 'h' }, { pitch: 62, d: 'h' }]);
    expect(r.state.rest).toBe(false);
  });

  it('the last note of the form puts the caret back at the start (first slot active)', () => {
    const r = run(Array.from({ length: 16 }, () => pick(60)));
    expect(r.state.caret).toBe(0);
    expect(activeIndex(r.state, r.p)).toBe(0);
    const again = reduce(r.state, r.p, pick(72));
    expect(melodyOf(again.edit!)[0]).toEqual({ pitch: 72, d: 'q' }); // overwrites from the start
  });
});

describe('opening, and the mode decides', () => {
  it('opening another progression keeps the mode (Improvise: the slot\'s sound waits for a note)', () => {
    expect(initialSession(prog(), { onArrival: 'chord' }, null, { mode: 'write', clip: null })).toMatchObject({ mode: 'write', arrival: null });
    expect(initialSession(prog(), { onArrival: 'chord' }, null, { mode: 'improvise', clip: null })).toMatchObject({ mode: 'improvise', arrival: 0, running: false });
    const clip = { bars: [[{ chord: 'Am7' }]], slices: [[]], barTicks: W };
    expect(initialSession(prog(), { onArrival: 'chord' }, null, { mode: 'write', clip }).clip).toBe(clip); // copy here, paste there
  });

  it('a first open starts in grid improv, on the caret\'s slot (the melody\'s end)', () => {
    const p = withFlat(prog(), { melody: [{ pitch: 62, d: 'w' as const }, { pitch: 67, d: 'q' as const }] });
    expect(initialSession(p, { onArrival: 'silent' })).toMatchObject({ mode: 'grid', slot: 1, running: false });
  });

  it('only Write etude writes: a pick elsewhere auditions and records nothing', () => {
    for (const mode of ['tune', 'improvise'] as const) {
      const r = run([{ type: 'mode', mode }, pick(62)]);
      expect(melodyOf(r.p)).toEqual([]);
      expect(show(r.per[1])).toContain('note 62');
    }
    expect(run([{ type: 'mode', mode: 'read' }, pick(62)]).per[1]).toEqual([]); // no hex in Read etude
  });

  it('only Write etude edits the melody: delete, nudge, Rest + length and Clear do nothing elsewhere', () => {
    const p = withFlat(prog(), { melody: [{ pitch: 60, d: 'q' as const }] });
    const edits = [{ type: 'delete', back: true }, { type: 'nudge', dir: 1, octave: false }, { type: 'clear-notes' }, { type: 'clear-all' }, { type: 'step-play' }] as Intent[];
    for (const mode of ['tune', 'improvise', 'read'] as const) {
      for (const i of edits) expect(run([{ type: 'mode', mode }, i], { p, state: { caret: q } }).p).toBe(p);
      const r = run([{ type: 'mode', mode }, { type: 'toggle-rest' }, { type: 'length', d: 'h' }], { p });
      expect(r.p).toBe(p);
    }
  });

  it('Tune: no chord to sound, no chart to click', () => {
    const r = run([{ type: 'mode', mode: 'tune' }, { type: 'sound', what: 'chord' }, { type: 'slot-click', index: 2 }, { type: 'browse', dir: 1 }, { type: 'bar-select', bar: 1, extend: false }]);
    expect(r.effects).toEqual([]);
    expect(r.state).toMatchObject({ slot: 0, selection: null });
    expect(run([{ type: 'mode', mode: 'tune' }, { type: 'toggle-mute' }]).state.muted).toBe(true);
  });
});

describe('switching modes', () => {
  const to = (mode: Extract<Intent, { type: 'mode' }>['mode']): Intent => ({ type: 'mode', mode });
  it('[ / ] step through progression · etude · grid improv · ins tune · ins improv · ins read, no wrap', () => {
    expect(run([to('prev')]).state.mode).toBe('progression');
    expect(run([to('prev'), to('prev')]).state.mode).toBe('progression');
    expect(run([to('next')]).state.mode).toBe('grid');
    expect(run([to('next'), to('next'), to('next')]).state.mode).toBe('improvise');
    expect(run([to('read'), to('next')]).state.mode).toBe('read');
  });

  it('\\ jumps to the partner mode: etude ↔ ins read, grid improv ↔ ins improv; progression and ins tune have none', () => {
    expect(run([to('partner')]).state.mode).toBe('read');
    expect(run([to('partner'), to('partner')]).state.mode).toBe('write');
    expect(run([to('grid'), to('partner')]).state.mode).toBe('improvise');
    expect(run([to('improvise'), to('partner')]).state.mode).toBe('grid');
    expect(run([to('tune'), to('partner')]).state.mode).toBe('tune');
    expect(run([to('progression'), to('partner')]).state.mode).toBe('progression');
  });

  it('the mode is remembered on the device; a first open lands in grid improv', () => {
    expect(run([to('tune')]).signals[0]).toContainEqual({ type: 'device', patch: { lastMode: 'tune' } });
    expect(run([to('write')]).signals[0]).toEqual([]); // no change, nothing written
    const p = prog();
    expect(initialSession(p, { onArrival: 'silent' }).mode).toBe('grid');
    expect(initialSession(p, { onArrival: 'silent', lastMode: 'read' }).mode).toBe('read');
    expect(initialSession(p, { onArrival: 'silent', lastMode: 'read' }, null, { mode: 'tune', clip: null }).mode).toBe('tune'); // carried wins
  });

  it('the current slot carries: the caret\'s slot on the way out, the slot\'s start on the way back', () => {
    const r = run([to('improvise'), { type: 'browse', dir: 1 }, to('read'), { type: 'step', dir: 1 }, to('write')], { state: { caret: q } });
    expect(r.state).toMatchObject({ mode: 'write', caret: 2 * W });
    // Back to the caret's own slot: the caret stays where it was.
    expect(run([to('tune'), to('write')], { state: { caret: q } }).state.caret).toBe(q);
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
  const improvise = (more: Intent[], opts: { onArrival?: OnArrival; state?: Partial<SessionState> } | OnArrival = 'chord') =>
    run(
      [{ type: 'mode', mode: 'improvise' }, ...more],
      typeof opts === 'string' ? { onArrival: opts } : { onArrival: opts.onArrival ?? 'chord', state: opts.state },
    );

  it('arriving is silent; the first note played there (hex or mic) brings the arrival sound, later ones play alone', () => {
    const r = improvise([{ type: 'browse', dir: 1 }, pick(67), pick(71)]);
    expect(r.per.map(show)).toEqual([[], [], ['note 67', 'chord G'], ['note 71']]);
    expect(improvise([{ type: 'heard' }, { type: 'heard' }], 'chord').per.map(show)).toEqual([[], ['chord D'], []]);
  });

  it('no chord bump in ins improv: hex picks never move the form', () => {
    const r = improvise([pick(62), pick(64)], { state: { chordBumpNotes: 2, moveBy: 'notes' } });
    expect(r.state.slot).toBe(0);
  });

  it('← / → and < > step slots, wrapping; clicking a slot makes it current', () => {
    expect(improvise([{ type: 'step', dir: -1 }]).state.slot).toBe(3);
    expect(improvise([{ type: 'step', dir: -1 }, { type: 'browse', dir: 1 }]).state.slot).toBe(0);
    expect(improvise([{ type: 'slot-click', index: 2 }]).state.slot).toBe(2);
  });

  it('the chords are read-only: no time signature, undo, "+", trash or ⋯ bar menu (edit progression has them)', () => {
    const r = improvise([{ type: 'append-bar' }, { type: 'bar-action', bar: 3, action: 'delete' }, { type: 'time-signature', text: '3/4' }, { type: 'undo' }]);
    expect(r.p).toEqual(prog());
    expect(r.effects).toEqual([]);
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

  it('Write etude and Tune have no transport', () => {
    expect(run([{ type: 'transport', run: true }]).state.running).toBe(false);
    expect(run([{ type: 'mode', mode: 'tune' }, { type: 'transport', run: true }]).state.running).toBe(false);
  });
});

describe('Read etude', () => {
  const read = (more: Intent[], p = prog()) => run([{ type: 'mode', mode: 'read' }, ...more], { p, onArrival: 'chord', state: { caret: 0 } });
  const two = withFlat(prog(), { melody: [{ pitch: 62, d: 'w' as const }, { pitch: 67, d: 'w' as const }] });

  it('stopped: clicking a slot moves the playhead there, silently; a note auditions and moves it to its slot', () => {
    const r = read([{ type: 'slot-click', index: 2 }]);
    expect(r.state.slot).toBe(2);
    expect(r.effects).toEqual([]);
    const n = read([{ type: 'event-click', event: { ev: melodyOf(two)[1], i: 1, start: W, end: 2 * W } }], two);
    expect(n.state.slot).toBe(1);
    expect(show(n.per[1])).toEqual(['note 67']);
  });

  it('▶ Chord / Bass / Scale preview the current slot; nothing edits', () => {
    const r = read([{ type: 'slot-click', index: 1 }, { type: 'sound', what: 'chord' }, { type: 'append-bar' }, { type: 'time-signature', text: '3/4' }, { type: 'bar-action', bar: 0, action: 'delete' }]);
    expect(show(r.per[2])).toEqual(['chord G']);
    expect(r.p).toEqual(prog());
  });

  it('running: chart clicks do nothing — slots, notes, bar numbers', () => {
    const r = read([{ type: 'transport', run: true }, { type: 'slot-click', index: 2 }, { type: 'event-click', event: { ev: melodyOf(two)[1], i: 1, start: W, end: 2 * W } }, { type: 'bar-select', bar: 1, extend: false }], two);
    expect(r.state).toMatchObject({ slot: 0, selection: null });
    expect(r.effects).toEqual([]);
  });
});

describe('Write etude: stepwise playback (` / ~)', () => {
  const melody = withFlat(prog(), { melody: [{ pitch: 62, d: 'h' as const }, { d: 'h' as const }, { pitch: 67, d: 'w' as const }] });
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
  it('C / B / ⇧Space sound the active slot (concert); B is the bass note, an octave below the root note', () => {
    const r = run([{ type: 'sound', what: 'chord' }, { type: 'sound', what: 'bass' }, { type: 'sound', what: 'scale' }]);
    expect(show(r.effects)).toEqual(['chord D', 'bass D', 'scale D']);
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
    expect(melodyOf(r.p)).toEqual([{ pitch: 61, d: 'q' }, { pitch: 66, d: 'q' }]);
    expect(show(r.effects)).toEqual(['note 61', 'note 66']);
    const n = run([{ type: 'nudge', dir: 1, octave: false }], { p: r.p, state: { caret: r.state.caret } });
    expect(melodyOf(n.p)[1]).toEqual({ pitch: 67, d: 'q' });
  });
});

describe('editing commands', () => {
  it('delete, nudge (plays, halo) and clear notes; clear all is edit progression\'s', () => {
    const p = withFlat(prog(), { melody: [{ pitch: 62, d: 'q' as const }, { pitch: 65, d: 'q' as const }] });
    const n = run([{ type: 'nudge', dir: 1, octave: false }], { p });
    expect(melodyOf(n.p)[1]).toEqual({ pitch: 66, d: 'q' }); // ↑: a semitone
    expect(show(n.effects)).toEqual(['note 66']);
    expect(n.state.halo?.pitch).toBe(66);
    const step = run([{ type: 'nudge', dir: 1, octave: false, scale: true }], { p });
    expect(melodyOf(step.p)[1]).toEqual({ pitch: 67, d: 'q' }); // ⌥↑: the next D Dorian step (F → G)
    expect(melodyOf(run([{ type: 'delete', back: true }], { p }).p)).toHaveLength(1);
    const c = run([{ type: 'clear-notes' }], { p });
    expect([melodyOf(c.p), c.state.caret, c.p.bars]).toEqual([[], 0, p.bars]); // notes only
    expect(run([{ type: 'clear-all' }], { p }).p).toBe(p);
  });

  it('bars: copy says so; paste puts the copied bars\' notes in, chords untouched; nothing else edits bars', () => {
    const p = withFlat(prog(), { melody: [{ pitch: 62, d: 'w' as const }] });
    const copied = run([{ type: 'bar-select', bar: 0, extend: false }, { type: 'bar-action', bar: 0, action: 'copy' }], { p });
    expect(copied.state.notice?.text).toBe('Copied bar 1');
    const pasted = run([{ type: 'bar-select', bar: 2, extend: false }, { type: 'bar-action', bar: 2, action: 'paste' }], { p, state: { clip: copied.state.clip } });
    expect(pasted.p.bars).toEqual(p.bars); // chords stay
    expect(melodyOf(pasted.p)).toEqual([{ pitch: 62, d: 'w' }, { d: 'w' }, { pitch: 62, d: 'w' }]);
    for (const action of ['delete', 'duplicate', 'insert-after', 'split'] as const) {
      expect(run([{ type: 'bar-action', bar: 1, action }], { p }).p).toBe(p);
    }
    expect(run([{ type: 'append-bar' }], { p }).p).toBe(p);
  });

  it('undo / redo are effects (edit etude too); a restore puts the caret back and clears selection and refusal', () => {
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

describe('the screen\'s signals', () => {
  const melody = withFlat(prog(), { melody: [{ pitch: 62, d: 'h' as const }, { d: 'h' as const }, { pitch: 67, d: 'w' as const }] });

  it('Write etude: a stepped or clicked melody note lights the hex (a rest does not)', () => {
    const r = run([{ type: 'step-play' }, { type: 'step-play' }, { type: 'event-click', event: { ev: melodyOf(melody)[2], i: 2, start: W, end: 2 * W } }], { p: melody });
    expect(r.signals).toEqual([[{ type: 'light', midi: 62 }], [], [{ type: 'light', midi: 67 }]]);
  });

  it('Read etude: a clicked note auditions but lights nothing', () => {
    const r = run([{ type: 'event-click', event: { ev: melodyOf(melody)[0], i: 0, start: 0, end: W / 2 } }], { p: melody, state: { mode: 'read' } });
    expect(show(r.per[0])).toEqual(['note 62']);
    expect(r.signals[0]).toEqual([]);
  });

  it('the transport restarts on start and on a rewind while running — not on a rewind while stopped, nor on stop', () => {
    const r = run([{ type: 'rewind' }, { type: 'transport', run: true }, { type: 'rewind' }, { type: 'transport', run: false }], { state: { mode: 'improvise' } });
    expect(r.signals.map((x) => x.length)).toEqual([0, 1, 1, 0]);
  });
});

describe('edits outside the melody go through the mode too', () => {
  it('edit progression while stopped: chords, scales, bars per row', () => {
    for (const mode of ['progression'] as const) {
      const r = run(
        [
          { type: 'chord-entry', bar: 0, part: 0, text: 'Em7' },
          { type: 'scale-override', bar: 1, part: 0, scale: 'lydian-dominant' },
          { type: 'chord-clear', bar: 2, part: 0 },
          { type: 'bars-per-row', n: 2 },
        ],
        { state: { mode } },
      );
      expect(r.outcomes[0].entry).toMatchObject({ ok: true });
      expect(r.p.bars[0][0].chord).toBe('Em7');
      expect(r.p.bars[1][0].scale).toBeDefined();
      expect(r.p.bars[2][0].chord).toBe('');
      expect(r.p.barsPerRow).toBe(2);
    }
  });

  it('nowhere else: progression running, edit etude, grid improv, ins improv, ins read, ins tune refuse them', () => {
    for (const state of [{ mode: 'progression' as const, running: true }, { mode: 'write' as const }, { mode: 'grid' as const }, { mode: 'improvise' as const }, { mode: 'read' as const }, { mode: 'tune' as const }]) {
      const r = run(
        [
          { type: 'chord-entry', bar: 0, part: 0, text: 'Em7' },
          { type: 'chord-clear', bar: 1, part: 0 },
          { type: 'bars-per-row', n: 2 },
        ],
        { state },
      );
      expect(r.outcomes[0].entry).toBeUndefined();
      expect(r.p).toEqual(prog());
    }
  });

  it('the header, in every mode: title, clef and instrument (remembered on the device)', () => {
    const r = run(
      [
        { type: 'title', text: 'Blues' },
        { type: 'clef', clef: 'bass' },
        { type: 'instrument', id: 'bb-trumpet' },
      ],
      { state: { mode: 'read', running: true } },
    );
    expect(r.p).toMatchObject({ title: 'Blues', etudes: [{ concertClef: 'bass', instrument: 'bb-trumpet' }] });
    expect(r.per[2]).toEqual([{ type: 'device', patch: { lastInstrument: 'bb-trumpet' } }]);
  });
});

describe('the open etude (issue 080)', () => {
  /** Two etudes: A (Concert) with one note, B (B♭ trumpet) with two. */
  const two = (): Progression => ({
    ...prog(),
    etudes: [
      { id: 'e1', name: 'A', instrument: 'concert', melody: [{ pitch: 60, d: 'q' }] },
      { id: 'e2', name: 'B', instrument: 'bb-trumpet', melody: [{ pitch: 62, d: 'q' }, { pitch: 64, d: 'q' }] },
    ],
  });
  const names = (p: Progression) => p.etudes.map((e) => `${e.id}:${e.name}:${e.instrument}:${e.melody.length}`);

  it('opens on the given etude (missing → the first), the caret at its melody\'s end', () => {
    expect(initialSession(two(), { onArrival: 'silent' }, 'e2')).toMatchObject({ etude: 'e2', caret: 2 * q });
    expect(initialSession(two(), { onArrival: 'silent' }, 'gone')).toMatchObject({ etude: 'e1', caret: q });
  });

  it('melody intents touch only the open etude, in its instrument\'s written pitch', () => {
    const r = run([pick(64)], { p: two(), state: { etude: 'e2', caret: 2 * q } }); // written E on B♭ trumpet = concert D
    expect(r.p.etudes[0]).toEqual(two().etudes[0]);
    expect(r.p.etudes[1].melody[2]).toEqual({ pitch: 62, d: 'q' });
    const cleared = run([{ type: 'clear-all' }], { p: two(), state: { etude: 'e2', mode: 'progression' } }).p;
    expect(cleared.etudes.map((e) => e.melody.length)).toEqual([1, 0]); // Clear all: chords + the open etude's notes
  });

  it('etude-open switches (caret to its end, halo and refusal cleared); an unknown id does nothing', () => {
    const r = run([{ type: 'etude-open', id: 'e2' }], { p: two() });
    expect(r.state).toMatchObject({ etude: 'e2', caret: 2 * q, halo: null, refusal: null });
    expect(r.outcomes[0].edit).toBeUndefined(); // not an undo step
    expect(run([{ type: 'etude-open', id: 'nope' }], { p: two() }).state.etude).toBe('e1');
  });

  it('every mode, the transport running too, lets the picker through', () => {
    for (const state of [{ mode: 'tune' as const }, { mode: 'improvise' as const, running: true }, { mode: 'read' as const, running: true }, { mode: 'write' as const }]) {
      expect(run([{ type: 'etude-open', id: 'e2' }], { p: two(), state }).state.etude).toBe('e2');
    }
  });

  it('etude-new: an empty "Etude N" on the open etude\'s instrument, after the others, opened', () => {
    const r = run([{ type: 'etude-new' }], { p: two(), state: { etude: 'e2' } });
    expect(names(r.p)).toEqual(['e1:A:concert:1', 'e2:B:bb-trumpet:2', 'e3:Etude 1:bb-trumpet:0']);
    expect(r.state).toMatchObject({ etude: 'e3', caret: 0 });
    const again = run([{ type: 'etude-new' }, { type: 'etude-new' }]);
    expect(again.p.etudes.map((e) => e.name)).toEqual(['Etude 1', 'Etude 2', 'Etude 3']);
  });

  it('etude-duplicate: a copy named "‹name› (copy)" straight after it, opened, caret kept', () => {
    const r = run([{ type: 'etude-duplicate' }], { p: two(), state: { etude: 'e1', caret: 0 } });
    expect(names(r.p)).toEqual(['e1:A:concert:1', 'e3:A (copy):concert:1', 'e2:B:bb-trumpet:2']);
    expect(r.state).toMatchObject({ etude: 'e3', caret: 0 });
  });

  it('etude-rename: trimmed; blank or unchanged does nothing', () => {
    expect(run([{ type: 'etude-rename', text: '  Lines ' }], { p: two() }).p.etudes[0].name).toBe('Lines');
    expect(run([{ type: 'etude-rename', text: '  ' }], { p: two() }).outcomes[0].edit).toBeUndefined();
    expect(run([{ type: 'etude-rename', text: 'A' }], { p: two() }).outcomes[0].edit).toBeUndefined();
  });

  it('etude-delete opens its neighbour; deleting the only one leaves a fresh empty Etude 1 on its instrument', () => {
    const a = run([{ type: 'etude-delete' }], { p: two(), state: { etude: 'e1' } });
    expect(names(a.p)).toEqual(['e2:B:bb-trumpet:2']);
    expect(a.state).toMatchObject({ etude: 'e2', caret: 2 * q });
    const b = run([{ type: 'etude-delete' }], { p: two(), state: { etude: 'e2' } });
    expect(b.state.etude).toBe('e1'); // the last one: the one before it
    const last = run([{ type: 'etude-delete' }, { type: 'etude-delete' }], { p: two(), state: { etude: 'e2' } });
    expect(names(last.p)).toEqual(['e2:Etude 1:concert:0']);
    expect(last.state).toMatchObject({ etude: 'e2', caret: 0 });
  });

  it('restored: the snapshot\'s etude; without one the open etude stays — unless it is gone', () => {
    expect(run([{ type: 'restored', caret: 0, etude: 'e2' }], { p: two() }).state).toMatchObject({ etude: 'e2', caret: 0 });
    expect(run([{ type: 'restored' }], { p: two(), state: { etude: 'e2' } }).state.etude).toBe('e2');
    const gone = { ...two(), etudes: [two().etudes[1]] };
    expect(run([{ type: 'restored' }], { p: gone, state: { etude: 'e1' } }).state).toMatchObject({ etude: 'e2', caret: 2 * q });
  });
});

describe("a slot's trash goes through the mode", () => {
  const split = (): Progression => ({ ...prog(), bars: [[{ chord: 'Dm7' }, { chord: 'G7' }], [{ chord: 'C' }]] });
  it('edit progression (stopped) deletes the slot (one undo step); elsewhere, nothing', () => {
    expect(run([{ type: 'slot-delete', bar: 0, part: 0 }], { p: split(), state: { mode: 'progression' } }).p.bars[0]).toEqual([{ chord: 'G7' }]);
    for (const state of [{ mode: 'progression' as const, running: true }, { mode: 'write' as const }, { mode: 'improvise' as const }, { mode: 'read' as const }]) {
      expect(run([{ type: 'slot-delete', bar: 0, part: 0 }], { p: split(), state }).p.bars[0]).toHaveLength(2);
    }
  });
});

describe('grid improv', () => {
  const grid = (more: Intent[], state: Partial<SessionState> = {}) =>
    run([{ type: 'mode', mode: 'grid' }, ...more], { onArrival: 'chord', state: { chordBumpNotes: 2, ...state } });

  it('by notes (chord bump): hex picks in a slot move the form on after N notes', () => {
    expect(grid([pick(62)]).state).toMatchObject({ slot: 0, bumpCount: 1 });
    expect(grid([pick(62), pick(64)]).state).toMatchObject({ slot: 1, bumpCount: 0, arrival: 1 });
  });

  it('arriving is silent; the first note picked there brings the arrival sound', () => {
    expect(grid([pick(62), pick(64), pick(67)]).per.map(show)).toEqual([[], ['note 62', 'chord D'], ['note 64'], ['note 67', 'chord G']]);
  });

  it('by notes keeps to the looped bars: at their last chord it wraps to their first', () => {
    const loop: Intent[] = [{ type: 'bar-select', bar: 1, extend: false }, { type: 'bar-select', bar: 2, extend: true }];
    expect(grid([...loop]).state.slot).toBe(1); // picking the loop moves to its first chord
    expect(grid([...loop, pick(62), pick(64)]).state.slot).toBe(2);
    expect(grid([...loop, pick(62), pick(64), pick(62), pick(64)]).state.slot).toBe(1); // not 3
  });

  it('by notes without Loop: at the last chord (of the form, or the looped bars) it stays', () => {
    expect(grid([{ type: 'set-loop', on: false }, { type: 'slot-click', index: 3 }, pick(62), pick(64)]).state.slot).toBe(3);
    const loop: Intent[] = [{ type: 'bar-select', bar: 1, extend: false }, { type: 'bar-select', bar: 2, extend: true }];
    expect(grid([{ type: 'set-loop', on: false }, ...loop, pick(62), pick(64), pick(62), pick(64)]).state.slot).toBe(2);
  });

  it('Loop is remembered on the device (shared with the transport)', () => {
    const r = grid([{ type: 'set-loop', on: false }]);
    expect(r.state.loop).toBe(false);
    expect(r.effects).toContainEqual({ type: 'device', patch: { practiceLoop: false } });
    expect(initialSession(prog(), { onArrival: 'silent', loop: false }).loop).toBe(false);
    expect(initialSession(prog(), { onArrival: 'silent' }).loop).toBe(true);
  });

  it('in time: the transport moves the form, picks never do; by notes has no transport', () => {
    const time = grid([{ type: 'set-move-by', moveBy: 'time' }, pick(62), pick(64)]);
    expect(time.state).toMatchObject({ moveBy: 'time', slot: 0 });
    expect(time.effects).toContainEqual({ type: 'device', patch: { moveBy: 'time' } });
    expect(grid([{ type: 'set-move-by', moveBy: 'time' }, { type: 'transport', run: true }]).state.running).toBe(true);
    expect(grid([{ type: 'transport', run: true }]).state.running).toBe(false);
  });

  it('chord bump off: picks never move the form, and there is no transport; on again, the choice is kept', () => {
    const off = grid([{ type: 'set-chord-bump', on: false }, pick(62), pick(64), { type: 'transport', run: true }]);
    expect(off.state).toMatchObject({ chordBump: false, slot: 0, running: false });
    expect(off.effects).toContainEqual({ type: 'device', patch: { chordBump: false } });
    const time = grid([{ type: 'set-move-by', moveBy: 'time' }, { type: 'set-chord-bump', on: false }, { type: 'set-chord-bump', on: true }, { type: 'transport', run: true }]);
    expect(time.state).toMatchObject({ moveBy: 'time', running: true });
  });

  it('switching chord bump off stops the metronome', () => {
    const r = grid([{ type: 'set-move-by', moveBy: 'time' }, { type: 'transport', run: true }, { type: 'set-chord-bump', on: false }]);
    expect(r.state.running).toBe(false);
  });

  it('a first open has chord bump on (by notes)', () => {
    expect(initialSession(prog(), { onArrival: 'silent' })).toMatchObject({ chordBump: true, moveBy: 'notes' });
    expect(initialSession(prog(), { onArrival: 'silent', chordBump: false }).chordBump).toBe(false);
  });

  it('switching to by notes stops the transport', () => {
    const r = grid([{ type: 'set-move-by', moveBy: 'time' }, { type: 'transport', run: true }, { type: 'set-move-by', moveBy: 'notes' }]);
    expect(r.state).toMatchObject({ moveBy: 'notes', running: false });
  });

  it('the chords are read-only here', () => {
    const r = grid([{ type: 'append-bar' }, { type: 'bar-action', bar: 1, action: 'delete' }]);
    expect(r.p.bars).toHaveLength(4);
  });
});

describe('progression', () => {
  const progression = (more: Intent[]) => run([{ type: 'mode', mode: 'progression' }, ...more], { onArrival: 'chord' });

  it('edits the form; there is no hex panel, so a pick (A) does nothing', () => {
    expect(progression([{ type: 'append-bar' }]).p.bars).toHaveLength(5);
    const r = progression([pick(62), pick(64)]);
    expect(melodyOf(r.p)).toEqual([]);
    expect(r.effects).toEqual([]);
    expect(r.state.slot).toBe(0);
  });

  it('edits the lead sheet\'s form: time signature, undo, "+", trash and the ⋯ bar menu', () => {
    expect(progression([{ type: 'append-bar' }]).p.bars).toHaveLength(5);
    expect(progression([{ type: 'bar-action', bar: 3, action: 'delete' }]).p.bars).toHaveLength(3);
    expect(progression([{ type: 'bar-action', bar: 1, action: 'duplicate' }]).p.bars).toHaveLength(5);
    expect(progression([{ type: 'time-signature', text: '3/4' }]).p.timeSignature).toBe('3/4');
    expect(progression([{ type: 'undo' }]).effects).toEqual([{ type: 'history', dir: 'undo' }]);
  });

  it('deleting the current slot\'s bar keeps the current slot in the form', () => {
    const r = progression([{ type: 'step', dir: -1 }, { type: 'bar-action', bar: 3, action: 'delete' }]);
    expect(r.state.slot).toBe(2);
  });

  it('clear all: chords, scales and the open etude\'s notes (bars and splits stay)', () => {
    const p = withFlat(prog(), { melody: [{ pitch: 62, d: 'q' as const }] });
    const all = run([{ type: 'mode', mode: 'progression' }, { type: 'clear-all' }], { p: { ...p, bars: [[{ chord: 'Dm7', scale: 'aeolian' }], [{ chord: 'G7' }, { chord: 'G7alt' }]] } });
    expect([melodyOf(all.p), all.p.bars]).toEqual([[], [[{ chord: '' }], [{ chord: '' }, { chord: '' }]]]);
  });

  it('bar actions: copy says so, delete refuses the last bar with a notice', () => {
    const r = progression([{ type: 'bar-select', bar: 1, extend: false }, { type: 'bar-select', bar: 2, extend: true }, { type: 'bar-action', bar: 1, action: 'copy' }]);
    expect(r.state.notice?.text).toBe('Copied bars 2–3');
    const one = { ...prog(), bars: [[{ chord: 'C' }]] };
    expect(run([{ type: 'mode', mode: 'progression' }, { type: 'bar-action', bar: 0, action: 'delete' }], { p: one }).state.notice).not.toBeNull();
  });

  it('▶ plays the form back', () => {
    expect(progression([{ type: 'transport', run: true }]).state.running).toBe(true);
  });
});

describe('etude and ins read need chords', () => {
  const empty = (): Progression => ({ ...prog(), bars: [[{ chord: '' }], [{ chord: '' }]] });
  const to = (mode: Extract<Intent, { type: 'mode' }>['mode']): Intent => ({ type: 'mode', mode });

  it('with no chords, picking them (or \\) is refused with a notice', () => {
    for (const mode of ['write', 'read'] as const) {
      const r = run([to(mode)], { p: empty(), state: { mode: 'progression' } });
      expect(r.state.mode).toBe('progression');
      expect(r.state.notice?.text).toBe('Add chords first (edit progression)');
    }
    expect(run([to('partner')], { p: empty(), state: { mode: 'improvise' } }).state.mode).toBe('grid'); // not affected
  });

  it('[ / ] step over them', () => {
    expect(run([to('next')], { p: empty(), state: { mode: 'progression' } }).state.mode).toBe('grid');
    expect(run([to('prev')], { p: empty(), state: { mode: 'grid' } }).state.mode).toBe('progression');
    expect(run([to('next')], { p: empty(), state: { mode: 'improvise' } }).state.mode).toBe('improvise'); // ins read was the last
  });

  it('an open with no chords in a mode that needs them starts in edit progression', () => {
    expect(initialSession(empty(), { onArrival: 'silent', lastMode: 'write' }).mode).toBe('progression');
    expect(initialSession(empty(), { onArrival: 'silent' }, null, { mode: 'read', clip: null }).mode).toBe('progression');
    expect(initialSession(prog(), { onArrival: 'silent', lastMode: 'write' }).mode).toBe('write');
  });
});

describe('a standard progression is locked (SPEC §3.12)', () => {
  const locked = (mode: SessionState['mode'], more: Intent[]) => run(more, { state: { mode, locked: true } });

  it('edit progression shows it but edits nothing: chords, scales, bars, time, title, Clear all, undo', () => {
    const r = locked('progression', [
      { type: 'chord-entry', bar: 0, part: 0, text: 'Em7' },
      { type: 'scale-override', bar: 1, part: 0, scale: 'lydian-dominant' },
      { type: 'append-bar' },
      { type: 'bar-action', bar: 1, action: 'delete' },
      { type: 'time-signature', text: '3/4' },
      { type: 'bars-per-row', n: 2 },
      { type: 'title', text: 'Mine' },
      { type: 'clear-all' },
    ]);
    expect(r.p).toEqual(prog());
    expect(r.outcomes[0].entry).toBeUndefined();
  });

  it('your etudes over it still edit: notes, new etude, rename, instrument', () => {
    const r = locked('write', [pick(62), { type: 'etude-new' }, { type: 'etude-rename', text: 'Line' }, { type: 'instrument', id: 'bb-trumpet' }]);
    expect(r.p.etudes).toHaveLength(2);
    expect(melodyOf(r.p)).toEqual([{ pitch: 62, d: 'q' }]);
    expect(r.p.etudes[1]).toMatchObject({ name: 'Line', instrument: 'bb-trumpet' });
    expect(r.p.bars).toEqual(prog().bars);
  });

  it('an open of a standard is locked', () => {
    expect(initialSession(prog(), { onArrival: 'silent' }, null, undefined, { locked: true }).locked).toBe(true);
    expect(initialSession(prog(), { onArrival: 'silent' }).locked).toBe(false);
  });
});
