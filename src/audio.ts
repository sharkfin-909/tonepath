// `audio` module (SPEC §9): playNote / playChord / playScale / playRoot over Web Audio, plus mute.
// The UI never touches Web Audio. Voicings are pure functions (tested); the engine is a thin sine synth.
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
 * ▶ Scale: the slot scale ascending one octave from the tonic (tonic in concert octave 3), top tonic included.
 * A no-fit chord plays its chord tones ascending over one octave. Empty for slots without a chord.
 */
export function scaleRun(h: SlotHarmony): number[] {
  if (h.kind !== 'chord') return [];
  const root = OCTAVE_3 + pc(h.root);
  const steps = h.scale
    ? SCALES[h.scale].intervals.map(semis)
    : [...new Set(h.intervals.map((iv) => semis(iv) % 12))].sort((a, b) => a - b);
  return [...steps.map((s) => root + s), root + 12];
}

/** Play mode's Root note: the chord's bass (the slash bass if any) in concert octave 3. Null without a chord. */
export function rootNote(h: SlotHarmony): number | null {
  if (h.kind !== 'chord') return null;
  return OCTAVE_3 + pc(h.bass ?? h.root);
}

export const midiToHz = (m: number) => 440 * 2 ** ((m - 69) / 12);

// ---------------------------------------------------------------- engine

const NOTE = { gain: 0.22, attack: 0.01, decay: 0.9 };
const CHORD = { gain: 0.1, attack: 0.01, decay: 1.6 };
const SCALE_GAP = 0.15;

let ctx: AudioContext | null = null;
let muted = false;

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

function tone(midi: number, at: number, env: typeof NOTE): void {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = midiToHz(midi);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(env.gain, at + env.attack);
  g.gain.exponentialRampToValueAtTime(0.0001, at + env.attack + env.decay);
  osc.connect(g).connect(ctx.destination);
  osc.start(at);
  osc.stop(at + env.attack + env.decay + 0.05);
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

/** Play mode *On arrival: Root note*. */
export function playRoot(h: SlotHarmony): void {
  const c = ready();
  const m = rootNote(h);
  if (c && m !== null) tone(m, c.currentTime, NOTE);
}
