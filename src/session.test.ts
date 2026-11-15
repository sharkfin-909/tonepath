// The editing session (SPEC §3.3, §6.2, §9): Write / Play rules, entry, browsing and *On arrival*, as pure steps.
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
  let state: SessionState = { ...initialSession(p, { onArrival: opts.onArrival ?? 'silent' }), ...opts.state };
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

describe('Write: entry', () => {
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

describe('Explore mode', () => {
  const explore: Intent = { type: 'mode', mode: 'explore' };
  it('a pick only auditions: nothing written, the caret stays', () => {
    const r = run([explore, pick(62)]);
    expect(r.p.melody).toEqual([]);
    expect(r.state.caret).toBe(0);
    expect(show(r.per[1])).toEqual(['note 62']);
  });

  it('nothing edits the hidden melody: delete, nudge and Clear do nothing', () => {
    const p = { ...prog(), melody: [{ pitch: 60, d: 'q' as const }] };
    for (const i of [{ type: 'delete', back: true }, { type: 'nudge', dir: 1, octave: false }, { type: 'clear-notes' }] as Intent[]) {
      const r = run([explore, i], { p, state: { caret: q } });
      expect(r.p.melody).toEqual(p.melody);
    }
  });

  it('Rest on: a length key inserts nothing', () => {
    const r = run([explore, { type: 'toggle-rest' }, { type: 'length', d: 'h' }]);
    expect(r.p.melody).toEqual([]);
    expect(r.state.length).toBe('h');
  });

  it('Write (or Practice, then Write) writes again; the input never stops hex picks writing', () => {
    expect(run([explore, { type: 'mode', mode: 'write' }, pick(62)]).p.melody).toEqual([{ pitch: 62, d: 'q' }]);
    expect(run([explore, { type: 'mode', mode: 'practice' }, { type: 'mode', mode: 'write' }, pick(62)]).p.melody).toEqual([{ pitch: 62, d: 'q' }]);
    expect(run([{ type: 'input', how: 'instrument' }, pick(62)]).p.melody).toEqual([{ pitch: 62, d: 'q' }]);
    expect(run([explore]).state).toMatchObject({ explore: true, playIndex: null });
  });
});

describe('Write: On arrival sounds with the first entry of a slot', () => {
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

describe('Play', () => {
  const play = (more: Intent[], onArrival: OnArrival = 'chord') => run([{ type: 'mode', mode: 'play' }, ...more], { onArrival });

  it('picks audition only; nothing is recorded', () => {
    const r = play([pick(62)]);
    expect(r.p.melody).toEqual([]);
  });

  it('arriving is silent; the first note played there brings the arrival sound, later ones play alone', () => {
    const r = play([{ type: 'browse', dir: 1 }, pick(67), pick(71)]);
    expect(r.per.map(show)).toEqual([[], [], ['note 67', 'chord G'], ['note 71']]);
  });

  it('entering Play is an arrival too', () => {
    expect(show(play([pick(62)]).per[1])).toEqual(['note 62', 'chord D']);
  });

  it('← / → and < > step slots, wrapping', () => {
    const r = play([{ type: 'step', dir: -1 }]);
    expect(r.state.playIndex).toBe(3);
    expect(play([{ type: 'step', dir: -1 }, { type: 'browse', dir: 1 }]).state.playIndex).toBe(0);
  });

  it('clicking a note in another slot arrives there and sounds with that note', () => {
    const p = { ...prog(), melody: [{ pitch: 62, d: 'w' as const }, { pitch: 67, d: 'w' as const }] };
    const r = run([{ type: 'mode', mode: 'play' }, { type: 'event-click', event: { ev: p.melody[1], i: 1, start: W, end: 2 * W } }], { p, onArrival: 'chord' });
    expect(r.state.playIndex).toBe(1);
    expect(show(r.per[1])).toEqual(['note 67', 'chord G']);
  });

  it('leaving Play puts the caret at the start of the current slot', () => {
    const r = play([{ type: 'browse', dir: 1 }, { type: 'mode', mode: 'write' }]);
    expect(r.state).toMatchObject({ playIndex: null, caret: W, arrival: null });
  });
});

describe('Write: stepwise playback (` / ~)', () => {
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

  it('an empty melody or Play mode: nothing', () => {
    expect(run([step]).effects).toEqual([]);
    expect(run([{ type: 'mode', mode: 'play' }, step], { p: melody }).per[1]).toEqual([]);
  });
});

describe('Practice (SPEC §3.7)', () => {
  it('input: hex panel by default; the dropdown switches it (kept across modes)', () => {
    expect(run([]).state.input).toBe('hex');
    const r = run([{ type: 'input', how: 'instrument' }, { type: 'mode', mode: 'practice' }, { type: 'mode', mode: 'write' }, { type: 'mode', mode: 'practice' }]);
    expect(r.state).toMatchObject({ practice: true, input: 'instrument' });
  });

  it('a hex pick in Practice auditions and is never written', () => {
    const r = run([{ type: 'mode', mode: 'practice' }, pick(62)]);
    expect(r.p.melody).toEqual([]);
    expect(show(r.per[1])).toContain('note 62');
  });

  it('is Play with the mic: entering, switching with Play, and leaving', () => {
    const r = run([{ type: 'mode', mode: 'practice' }]);
    expect(r.state).toMatchObject({ playIndex: 0, practice: true });
    expect(run([{ type: 'mode', mode: 'practice' }, { type: 'mode', mode: 'play' }]).state).toMatchObject({ playIndex: 0, practice: false });
    expect(run([{ type: 'mode', mode: 'practice' }, { type: 'mode', mode: 'write' }]).state).toMatchObject({ playIndex: null, practice: false });
  });
  it('entering Practice is silent: the first slot\'s On arrival waits for the first note played', () => {
    const r = run([{ type: 'mode', mode: 'practice' }, { type: 'practice-note' }, { type: 'practice-note' }], { onArrival: 'chord' });
    expect(r.per.map(show)).toEqual([[], ['chord D'], []]);
  });

  it('On arrival sounds when the form moves on (landed: with that note)', () => {
    const r = run([{ type: 'mode', mode: 'practice' }, { type: 'practice-advance', index: 1, landed: true }], { onArrival: 'bass-chord' });
    expect(r.per.map(show)).toEqual([[], ['chord G', 'bass G']]);
    expect(r.state.arrival).toBeNull(); // landed on the next chord: it sounded with that note
  });

  it('finishing a slot (note count, Follow): the arrival waits for the next note played — the new slot\'s first', () => {
    const r = run([{ type: 'mode', mode: 'practice' }, { type: 'practice-advance', index: 1, landed: false }, { type: 'practice-note' }, { type: 'practice-note' }], { onArrival: 'chord' });
    expect(r.per.map(show)).toEqual([[], [], ['chord G'], []]); // silent entry and finishing note; then with the next
  });

  it('the mic moves the form on; a length choice there never inserts a rest', () => {
    const r = run([{ type: 'mode', mode: 'practice' }, { type: 'practice-advance', index: 2, landed: true }, { type: 'toggle-rest' }, { type: 'length', d: 'e' }]);
    expect(r.state).toMatchObject({ playIndex: 2, length: 'e' });
    expect(r.p.melody).toEqual([]);
  });
});

describe('browsing in Write', () => {
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
