// `audio` module (SPEC §9): playNote / playChord / playScale / playRoot / playBass over Web Audio, plus mute.
// The UI never touches Web Audio. Voicings are pure functions (tested); the engine is a thin sine synth through an
// output bus with a generated-impulse convolution reverb (no library, no audio files).
// Always concert pitch; no instrument range applied.

import { semitones } from '@tonaljs/interval';
import { chroma } from '@tonaljs/note';
import { SCALES, type SlotHarmony } from './harmony';

const OCTAVE_3 = 48; // C3 (tonal / scientific: C4 = 60)

const pc = (name: string) => chroma(name) ?? 0;
const semis = (iv: string) => semitones(iv) ?? 0;

/**
 * ▶ Chord voicing: root in concert octave 3; 3rd / 5th / 6th-or-7th close above; extensions (9, 11, 13 and their
 * alterations) above the 7th; a slash bass an octave below the root, not doubled. Chord tones only. Empty for
 * slots without a chord.
 */
export function chordVoicing(h: SlotHarmony): number[] {
  if (h.kind !== 'chord') return [];
  const root = OCTAVE_3 + pc(h.root);
  let upper = h.intervals.map((iv) => root + semis(iv));
  if (!h.bass) return upper;
  const bassPc = pc(h.bass);
  const bass = root - 12 + ((bassPc - pc(h.root) + 12) % 12); // in the octave below the root
  upper = upper.filter((m) => m % 12 !== bassPc); // not doubled
  return [bass, ...upper];
}

/**
 * ▶ Scale: the slot scale ascending one octave from the tonic (tonic in concert octave 4), top tonic included.
 * A no-fit chord plays its chord tones ascending over one octave. Empty for slots without a chord.
 */
export function scaleRun(h: SlotHarmony): number[] {
  if (h.kind !== 'chord') return [];
  const root = OCTAVE_3 + 12 + pc(h.root); // concert octave 4
  const steps = h.scale
    ? SCALES[h.scale].intervals.map(semis)
    : [...new Set(h.intervals.map((iv) => semis(iv) % 12))].sort((a, b) => a - b);
  return [...steps.map((s) => root + s), root + 12];
}

/** *Audio on chord*'s Root note: the chord's bass (the slash bass if any) in concert octave 3. Null without a chord. */
export function rootNote(h: SlotHarmony): number | null {
  if (h.kind !== 'chord') return null;
  return OCTAVE_3 + pc(h.bass ?? h.root);
}

/** The bass note's lowest pitch: E2 (82 Hz). A sine any lower is lost on laptop and phone speakers. */
export const BASS_FLOOR = 40;

/**
 * *On arrival: Bass note* (and ▶ Bass / B): the chord's bass (slash bass if any) an octave below the root note —
 * but never below E2: C2–D♯2 sound an octave up, so the bass is always E2–D♯3.
 */
export function bassNote(h: SlotHarmony): number | null {
  const m = rootNote(h);
  if (m === null) return null;
  return m - 12 < BASS_FLOOR ? m : m - 12;
}

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

// ---------------------------------------------------------------- engine

type Envelope = { gain: number; attack: number; decay: number; /** Held at full level before the decay (s). */ hold?: number };
const NOTE: Envelope = { gain: 0.22, attack: 0.01, decay: 0.9 };
const CHORD: Envelope = { gain: 0.06, attack: 0.04, decay: 3.2 };
/** *Audio on chord*'s bass note sustains under the chord: held, then a long fade (~3.6 s in all). */
const BASS: Envelope = { gain: 0.24, attack: 0.01, hold: 1.2, decay: 2.4 };
/** How long each *Audio on chord* sound rings (ms): the mic's echo guard (`micIntake.ts`). */
export const RING_MS = {
  chord: (CHORD.attack + CHORD.decay) * 1000,
  bass: (BASS.attack + (BASS.hold ?? 0) + BASS.decay) * 1000,
  note: 1100, // a note's audible tail (its envelope's 0.9 s, and the room)
} as const;
const SCALE_GAP = 0.15;

let ctx: AudioContext | null = null;
let muted = false;

/**
 * Reverb without a library (SPEC §9): a ConvolverNode fed a generated impulse response — stereo white noise fading
 * out exponentially over `seconds`. Every tone goes to the output bus, which splits into the dry signal and the
 * reverb (`wet`), both to the speakers.
 */
const REVERB = { seconds: 2.2, decay: 3, wet: 0.16 };
let bus: AudioNode | null = null;

function output(c: AudioContext): AudioNode {
  if (bus) return bus;
  const input = c.createGain();
  input.connect(c.destination); // dry
  const verb = c.createConvolver();
  verb.buffer = impulse(c, REVERB.seconds, REVERB.decay);
  const wet = c.createGain();
  wet.gain.value = REVERB.wet;
  input.connect(verb).connect(wet).connect(c.destination);
  bus = input;
  return bus;
}

/** A room's impulse response: noise, each channel independent (a wide stereo tail), fading as (1 − t)^decay. */
function impulse(c: AudioContext, seconds: number, decay: number): AudioBuffer {
  const length = Math.floor(c.sampleRate * seconds);
  const buf = c.createBuffer(2, length, c.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const data = buf.getChannelData(ch);
    for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** decay;
  }
  return buf;
}

/**
 * Create / resume the AudioContext. Call from a user gesture (SPEC §9: created / resumed on the first gesture);
 * the play functions call it too, since every trigger is a gesture.
 */
export function unlockAudio(): void {
  if (typeof AudioContext === 'undefined') return;
  ctx ??= new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

export function setMuted(m: boolean): void {
  muted = m;
}

export function isMuted(): boolean {
  return muted;
}

function tone(midi: number, at: number, env: Envelope, wave: OscillatorType = 'sine'): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = wave;
  osc.frequency.value = midiToHz(midi);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(env.gain, at + env.attack);
  const held = at + env.attack + (env.hold ?? 0);
  if (env.hold) g.gain.setValueAtTime(env.gain, held);
  g.gain.exponentialRampToValueAtTime(0.0001, held + env.decay);
  osc.connect(g).connect(output(ctx));
  osc.start(at);
  osc.stop(held + env.decay + 0.05);
}

function ready(): AudioContext | null {
  if (muted) return null;
  unlockAudio();
  return ctx;
}

/** One note (hex cell, notation note, nudge). Sounds overlap. */
export function playNote(midi: number): void {
  const c = ready();
  if (c) tone(midi, c.currentTime, NOTE);
}

/** ▶ Chord / Space. Silent on N.C. / empty / unparseable slots. */
export function playChord(h: SlotHarmony): void {
  const c = ready();
  if (!c) return;
  for (const m of chordVoicing(h)) tone(m, c.currentTime, CHORD);
}

/** ▶ Scale / ⇧Space, ~150 ms apart. */
export function playScale(h: SlotHarmony): void {
  const c = ready();
  if (!c) return;
  scaleRun(h).forEach((m, i) => tone(m, c.currentTime + i * SCALE_GAP, NOTE));
}

/** *Audio on chord* (*On arrival*): Root note. */
export function playRoot(h: SlotHarmony): void {
  const c = ready();
  const m = rootNote(h);
  if (c && m !== null) tone(m, c.currentTime, NOTE);
}

/** *On arrival: Bass note* (and the bass of *Bass note + chord*): the bass an octave lower than the root note. */
export function playBass(h: SlotHarmony): void {
  const c = ready();
  const m = bassNote(h);
  if (c && m !== null) tone(m, c.currentTime, BASS);
}

// ---------------------------------------------------------------- metronome

export type ClickSound = 'click' | 'hihat' | 'cowbell';

/** The audio clock (seconds), for scheduling ahead; 0 before the first gesture. */
export function audioNow(): number {
  return ctx?.currentTime ?? 0;
}

/** A short burst of white noise (the hi-hat), cached. */
let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext): AudioBuffer {
  if (noiseBuf) return noiseBuf;
  const len = Math.floor(c.sampleRate * 0.2);
  noiseBuf = c.createBuffer(1, len, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return noiseBuf;
}

/**
 * One metronome click at audio time `at` (the transport, SPEC §3.7): synthesised, dry (no reverb), louder
 * and higher on a bar's first beat (`accent`).
 */
export function playClick(sound: ClickSound, accent: boolean, at: number): void {
  const c = ready();
  if (!c) return;
  const out = c.destination;
  const g = c.createGain();
  g.connect(out);
  const peak = accent ? 0.5 : 0.32;
  const env = (decay: number) => {
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  };
  if (sound === 'hihat') {
    const src = c.createBufferSource();
    src.buffer = noise(c);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = accent ? 6000 : 7500;
    src.connect(hp).connect(g);
    env(accent ? 0.09 : 0.05);
    src.start(at);
    src.stop(at + 0.12);
    return;
  }
  const oscs: OscillatorNode[] = [];
  const add = (type: OscillatorType, hz: number, into: AudioNode = g) => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = hz;
    o.connect(into);
    oscs.push(o);
  };
  let decay = 0.05;
  if (sound === 'click') {
    add('sine', accent ? 1760 : 1320);
    decay = 0.04;
  } else {
    // cowbell: two square partials through a bandpass
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2640;
    bp.Q.value = 1.5;
    bp.connect(g);
    add('square', accent ? 587 : 540, bp);
    add('square', accent ? 870 : 800, bp);
    decay = accent ? 0.35 : 0.25;
  }
  env(decay);
  for (const o of oscs) {
    o.start(at);
    o.stop(at + decay + 0.02);
  }
}
