// Share links (SPEC §3.13): one etude and a copy of its chords (plus the standard's frozen id, if it is over one),
// packed into the URL **fragment** — `#share=1…`, never sent to a server, so no backend. The payload is JSON,
// deflate-raw compressed, base64url; `1` is the format version. Decoding runs the data through the file importer's
// repair (`repairProgression`), so a hand-made or damaged link can't put bad data in the library. Opening one:
// `importShared` (library.ts).
import { fileData, repairProgression } from './schema';
import type { Progression } from './progression';

export const SHARE_PREFIX = '#share=';
/** Longer links break in some chat apps and mail clients: past this, Share etude downloads a file instead. */
export const MAX_SHARE_URL = 8000;
const VERSION = '1';

/** What a link carries: one etude's progression (its chords, that etude alone) and the standard's id, if any. */
export interface Shared {
  std?: string;
  progression: Progression;
}

/** The share of etude `etudeId` of `p`: its chords and that etude only. */
export function shareOf(p: Progression, etudeId: string, std?: string): Shared {
  const etude = p.etudes.find((e) => e.id === etudeId) ?? p.etudes[0];
  return { ...(std ? { std } : {}), progression: { ...p, etudes: [etude] } };
}

const toBase64url = (bytes: Uint8Array) => {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};
const fromBase64url = (s: string): Uint8Array => {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
};

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** The token for any JSON-able payload (tests use it to make odd links). */
export async function shareToken(payload: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  return VERSION + toBase64url(await pipe(bytes, new CompressionStream('deflate-raw')));
}

/** A share's token: `{ v, std?, p }`, `p` as a file holds a progression (no ids, no device state). */
export function encodeShare(s: Shared): Promise<string> {
  return shareToken({ v: 1, ...(s.std ? { std: s.std } : {}), p: fileData(s.progression) });
}

/** A token back to a share, repaired as a file import would be; null when it isn't one. */
export async function decodeShare(token: string): Promise<Shared | null> {
  if (!token.startsWith(VERSION) || token.length < 2) return null;
  try {
    const json: unknown = JSON.parse(new TextDecoder().decode(await pipe(fromBase64url(token.slice(1)), new DecompressionStream('deflate-raw'))));
    if (typeof json !== 'object' || json === null) return null;
    const o = json as Record<string, unknown>;
    if (o.v !== 1 || typeof o.p !== 'object' || o.p === null || Array.isArray(o.p)) return null;
    const { progression } = repairProgression(o.p as Record<string, unknown>);
    return { ...(typeof o.std === 'string' && o.std ? { std: o.std } : {}), progression: { ...progression, etudes: progression.etudes.slice(0, 1) } };
  } catch {
    return null; // not base64, not deflate, not JSON
  }
}

/** The link for etude `etudeId` on page `base` (no fragment) — or `too-long` (then a file is the way). */
export async function shareLink(base: string, p: Progression, etudeId: string, std?: string): Promise<{ kind: 'link'; url: string } | { kind: 'too-long' }> {
  const url = base.split('#')[0] + SHARE_PREFIX + (await encodeShare(shareOf(p, etudeId, std)));
  return url.length > MAX_SHARE_URL ? { kind: 'too-long' } : { kind: 'link', url };
}

/** The token in a page's fragment (`location.hash`), or null. */
export const tokenIn = (hash: string): string | null => (hash.startsWith(SHARE_PREFIX) ? hash.slice(SHARE_PREFIX.length) : null);
