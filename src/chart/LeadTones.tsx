// Improvise's lead sheet (SPEC §3.3): in place of the stave, a little hex of the slot's scale, spelled from its root —
// rows [1 2] [3 4] [5 6 7] from the bottom, each half a cell left of the one below (the docked hex's geometry: right =
// the next step, up-left = a third). Coloured as the docked hex: triad tones and the guide tone in their degree colour,
// the rest neutral. Sized to the stave's height so rows keep their size and the zoom is unchanged.
import { DEGREE_COLOURS, inkOn } from '../hex';
import { leadRows, leadTones } from '../leadSheet';
import type { SlotHarmony } from '../harmony';
import { prettyName } from '../spelling';
import { staveMetrics } from '../notation/Stave';

/** Pointy-top hexagon of circumradius r, centred at (cx, cy). */
function hexPoints(cx: number, cy: number, r: number): string {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 90);
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
}

export function LeadTones({ harmony }: { harmony: SlotHarmony }) {
  const { height } = staveMetrics();
  const tones = leadTones(harmony);
  const rows = tones ? leadRows(tones) : [];
  // Cell geometry: rows overlap by a quarter of a cell's height; each row sits half a cell left of the one below.
  const pad = 4;
  const r = (height - 2 * pad) / (2 + 1.5 * Math.max(0, rows.length - 1));
  const w = Math.sqrt(3) * r;
  const shift = (rows.length - 1) * (w / 2); // the top row's lean
  const width = shift + Math.max(0, ...rows.map((row) => row.length)) * w + 2 * pad;
  return (
    <div className="lead-tones" style={{ height }} aria-label={tones ? `Scale: ${tones.map((t) => t.name).join(' ')}` : undefined}>
      {tones && (
        <svg className="lead-hex" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden>
          {rows.map((row, ri) => {
            const cy = height - pad - r - ri * 1.5 * r;
            const x0 = pad + shift - ri * (w / 2) + w / 2;
            return row.map((t, ci) => {
              const cx = x0 + ci * w;
              const lit = t.role === 'triad' || t.role === 'guide';
              const colour = DEGREE_COLOURS[t.degree - 1];
              return (
                <g key={`${ri}-${ci}`} className={`lead-cell ${t.role}`}>
                  <title>{t.role === 'guide' ? 'Guide tone' : t.role === 'triad' ? 'Chord tone' : t.role === 'chord' ? 'Chord tone (extension)' : 'Scale tone'}</title>
                  <polygon points={hexPoints(cx, cy, r - 0.6)} style={lit ? { fill: colour } : undefined} />
                  <text x={cx} y={cy} style={{ fontSize: r * 0.82, fill: lit ? inkOn(colour) : undefined }}>
                    {prettyName(t.name)}
                  </text>
                </g>
              );
            });
          })}
        </svg>
      )}
    </div>
  );
}
