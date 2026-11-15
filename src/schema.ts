// Pure `schema` module (SPEC §12.2–12.4): file envelopes, the migration chain, lenient import repair.
// Files carry no ids, timestamps or device state. Import runs the same migration chain as storage.

import { layoutMeter, parseTimeSignature, slotsOf } from './form';
import { isScaleId, withValidOverride } from './harmony';
import { isInstrumentId } from './instruments';
import { DURATIONS, fitToForm } from './melody';
import { SCHEMA_VERSION, type Bar, type Duration, type MelodyEvent, type Progression, type Slot } from './progression';

export const APP = 'tonepath';
/** The app's name before the rename: files exported under it still import. */
export const LEGACY_APPS = ['honeycomb', 'improwiser']; // files from before the renames

type Json = Record<string, unknown>;
const isObj = (x: unknown): x is Json => typeof x === 'object' && x !== null && !Array.isArray(x);

// ── Migrations (§12.4): pure steps on raw progression objects ───────────────────────────────────────────────

/** v1 → v2: strip every slot's `notes` (the old note-sets); `melody` = `[]` if missing. */
export function migrate1to2(p: Json): Json {
  const bars = Array.isArray(p.bars)
    ? p.bars.map((bar) => (Array.isArray(bar) ? bar.map((s) => (isObj(s) ? (({ notes: _n, ...rest }) => rest)(s) : s)) : bar))
    : p.bars;
  return { ...p, bars, melody: Array.isArray(p.melody) ? p.melody : [] };
}

const STEPS: Record<number, (p: Json) => Json> = { 1: migrate1to2 };

/** Run the chain from version `v` up to the current one. */
export function migrate(p: Json, v: number): Json {
  let out = p;
  for (let k = v; k < SCHEMA_VERSION; k++) out = STEPS[k]?.(out) ?? out;
  return out;
}

// ── Repair (§12.3): any object → a valid progression, counting what changed ───────────────────────────────

export interface Repairs {
  /** Events shortened because they crossed a slot boundary (or the form's end). */
  shortened: number;
  /** An unknown (present but unrecognised) instrument was replaced by Concert. */
  unknownInstrument: boolean;
}

const emptyBars = (): Bar[] => Array.from({ length: 4 }, () => [{ chord: '' }]);

function repairSlot(x: unknown): Slot {
  const o = isObj(x) ? x : {};
  const chord = typeof o.chord === 'string' ? o.chord : '';
  const slot: Slot = isScaleId(o.scale) ? { chord, scale: o.scale } : { chord };
  return withValidOverride(slot); // a non-candidate scale is dropped (same rule as a chord edit)
}

function repairBar(x: unknown): Bar {
  const slots = Array.isArray(x) ? x.slice(0, 2) : [];
  return slots.length ? slots.map(repairSlot) : [{ chord: '' }];
}

function repairEvent(x: unknown): MelodyEvent | null {
  if (!isObj(x) || !DURATIONS.includes(x.d as Duration)) return null;
  const d = x.d as Duration;
  if (!('pitch' in x)) return { d };
  const pitch = x.pitch;
  return typeof pitch === 'number' && Number.isInteger(pitch) && pitch >= 0 && pitch <= 127 ? { pitch, d } : null;
}

export function repairProgression(x: Json): { progression: Progression; repairs: Repairs } {
  const title = typeof x.title === 'string' && x.title.trim() ? x.title : 'Untitled';
  const timeSignature = typeof x.timeSignature === 'string' && parseTimeSignature(x.timeSignature) ? x.timeSignature : '4/4';
  const bpr = x.barsPerRow;
  const barsPerRow = typeof bpr === 'number' && Number.isInteger(bpr) && bpr >= 1 && bpr <= 8 ? bpr : 4;
  // A missing instrument quietly means Concert; a present but unknown one is noted in the toast.
  const instrument = isInstrumentId(x.instrument) ? x.instrument : 'concert';
  const unknownInstrument = x.instrument !== undefined && !isInstrumentId(x.instrument);
  const bars = Array.isArray(x.bars) && x.bars.length ? x.bars.map(repairBar) : emptyBars();
  const events = Array.isArray(x.melody) ? x.melody.map(repairEvent).filter((e): e is MelodyEvent => e !== null) : [];
  const fit = fitToForm(events, slotsOf(bars, layoutMeter(timeSignature)));
  const etudeName = typeof x.etudeName === 'string' && x.etudeName.trim() ? x.etudeName.trim() : '';
  const progression: Progression = {
    title,
    ...(etudeName ? { etudeName } : {}),
    timeSignature,
    barsPerRow,
    instrument,
    ...(x.concertClef === 'bass' ? { concertClef: 'bass' as const } : {}),
    bars,
    melody: fit.melody,
  };
  return { progression, repairs: { shortened: fit.shortened, unknownInstrument } };
}

// ── Files (§12.3) ───────────────────────────────────────────────────────────────────────────────────────────

/** File data for a progression: no ids, timestamps or device state. */
export function fileData(p: Progression): Progression {
  const { title, etudeName, timeSignature, barsPerRow, instrument, concertClef, bars, melody } = p;
  return { title, ...(etudeName ? { etudeName } : {}), timeSignature, barsPerRow, instrument, ...(concertClef ? { concertClef } : {}), bars, melody };
}

/** A filename-safe version of a title. */
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'Untitled';

export function exportOne(p: Progression): { filename: string; text: string } {
  const env = { app: APP, v: SCHEMA_VERSION, kind: 'progression', progression: fileData(p) };
  return { filename: `${safeName(p.title)}.tonepath.json`, text: JSON.stringify(env, null, 2) + '\n' };
}

/** Export all: newest edit first (the order the caller passes). */
export function exportAll(ps: Progression[], now = new Date()): { filename: string; text: string } {
  const env = { app: APP, v: SCHEMA_VERSION, kind: 'library', exportedAt: now.toISOString(), progressions: ps.map(fileData) };
  return { filename: `tonepath-library-${now.toISOString().slice(0, 10)}.json`, text: JSON.stringify(env, null, 2) + '\n' };
}

export type ParsedFile =
  | { ok: true; progressions: Progression[]; skipped: number; shortened: number; unknownInstruments: number }
  | { ok: false; message: string };

export const NEWER_VERSION = 'Made by a newer Tonepath — reload to update';
export const NOT_OURS = 'not a Tonepath file';

/** Parse + migrate + repair one file's text. Whole-file rejections and per-entry skips per §12.3. */
export function parseFile(text: string): ParsedFile {
  let env: unknown;
  try {
    env = JSON.parse(text);
  } catch {
    return { ok: false, message: NOT_OURS };
  }
  if (!isObj(env) || (env.app !== APP && !LEGACY_APPS.includes(env.app as string))) return { ok: false, message: NOT_OURS };
  const v = typeof env.v === 'number' && Number.isInteger(env.v) && env.v >= 1 ? env.v : 1;
  if (v > SCHEMA_VERSION) return { ok: false, message: NEWER_VERSION };
  let entries: unknown[];
  if (env.kind === 'progression') entries = [env.progression];
  else if (env.kind === 'library') entries = Array.isArray(env.progressions) ? env.progressions : [];
  else return { ok: false, message: NOT_OURS };

  const progressions: Progression[] = [];
  let skipped = 0;
  let shortened = 0;
  let unknownInstruments = 0;
  for (const e of entries) {
    if (!isObj(e) || !Array.isArray(e.bars)) {
      skipped++;
      continue;
    }
    const r = repairProgression(migrate(e, v));
    progressions.push(r.progression);
    shortened += r.repairs.shortened;
    if (r.repairs.unknownInstrument) unknownInstruments++;
  }
  return { ok: true, progressions, skipped, shortened, unknownInstruments };
}

/** Title clash on import → "‹title› (2)", "(3)", … */
export function uniqueTitle(title: string, taken: Set<string>): string {
  if (!taken.has(title)) return title;
  for (let k = 2; ; k++) if (!taken.has(`${title} (${k})`)) return `${title} (${k})`;
}

/** One toast for an import (SPEC §12.3): counts, repairs, rejections. */
export function importSummary(r: { added: number; skipped: number; shortened: number; unknownInstruments: number; rejected: { name: string; message: string }[] }): string {
  const parts: string[] = [];
  parts.push(r.added === 1 ? 'Imported 1 progression' : `Imported ${r.added} progressions`);
  if (r.shortened) parts.push(r.shortened === 1 ? '1 note shortened' : `${r.shortened} notes shortened`);
  if (r.unknownInstruments) parts.push(`${r.unknownInstruments} unknown instrument${r.unknownInstruments === 1 ? '' : 's'} → Concert`);
  if (r.skipped) parts.push(`${r.skipped} entr${r.skipped === 1 ? 'y' : 'ies'} skipped`);
  for (const f of r.rejected) parts.push(`${f.name}: ${f.message}`);
  return parts.join(' · ');
}
