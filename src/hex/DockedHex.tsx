// The docked hex (SPEC §8): React SVG for the active slot. Click = pick; a nudged pitch gets a dashed halo.
// Slots without a scale (§8.4): a dimmed, inactive rests-only hex or the chord-tones hex, each with a dock label.
import { useLayoutEffect, useRef, useState } from 'react';
import { DEGREE_COLOURS, HEX_THEME as T, cellCentre, hexRadius, type DockHex, type HexCell } from '../hex';
import { prettyName } from '../spelling';

function hexPoints(cx: number, cy: number, R: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30); // pointy-top
    pts.push(`${(cx + R * Math.cos(a)).toFixed(1)},${(cy + R * Math.sin(a)).toFixed(1)}`);
  }
  return pts.join(' ');
}

function useSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setSize({ width: Math.floor(e.contentRect.width), height: Math.floor(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export interface DockedHexProps {
  /** What the dock shows for the active slot (SPEC §8.4), in the view's (written) pitch. */
  dock: DockHex;
  /** Called with the cell's written MIDI pitch. Never called on a rests-only hex. */
  onPick?: (midi: number) => void;
  /** Written pitch of the nudge target: its cell(s) get a dashed halo (SPEC §6.2 item 8). */
  halo?: number | null;
  /** Clicking an empty / unparseable slot's label focuses its chord field. */
  onLabelClick?: () => void;
}

export function DockedHex({ dock, onPick, halo, onLabelClick }: DockedHexProps) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const { hex, mode, label, labelEditsChord } = dock;
  const inactive = mode === 'rests-only';
  const pick = inactive ? undefined : onPick;

  return (
    <div ref={ref} className={inactive ? 'docked-hex inactive' : 'docked-hex'} data-mode={mode}>
      {width > 0 && height > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Docked hex: ${hex.cells.length} cells${inactive ? ', inactive' : ''}`}>
          {hex.cells.map((cell) => {
            const R = hexRadius(hex, width, height);
            const { cx, cy } = cellCentre(cell, hex, R, width, height);
            return <Cell key={`${cell.r}-${cell.c}`} cell={cell} cx={cx} cy={cy} R={R} onPick={pick} halo={cell.midi === halo} />;
          })}
        </svg>
      )}
      {label &&
        (labelEditsChord && onLabelClick ? (
          <button type="button" className="dock-label edits" onClick={onLabelClick}>
            {label}
          </button>
        ) : (
          <span className="dock-label">{label}</span>
        ))}
    </div>
  );
}

interface CellProps {
  cell: HexCell;
  cx: number;
  cy: number;
  R: number;
  onPick?: (midi: number) => void;
  halo: boolean;
}

function Cell({ cell, cx, cy, R, onPick, halo }: CellProps) {
  const active = cell.inRange && !!onPick;
  const outer = R - 2; // small gap between neighbours
  const ring = Math.min(T.ringWidth, outer * 0.3);
  const inner = outer - ring / Math.cos(Math.PI / 6);
  const fill = !cell.inRange ? T.outFill : cell.role === 'chord' ? T.chordFill : T.scaleFill;
  const ink = !cell.inRange ? T.outInk : cell.role === 'chord' ? T.chordInk : T.scaleInk;
  const fs = Math.max(9, R * 0.42);
  const name = prettyName(cell.name);
  return (
    <g
      className="hex-cell"
      data-midi={cell.midi}
      data-degree={cell.degree}
      data-role={cell.inRange ? cell.role : 'out'}
      data-halo={halo || undefined}
      aria-label={`${name}, degree ${cell.degree}${cell.role === 'chord' ? ', chord tone' : ''}`}
      role={active ? 'button' : undefined}
      onClick={active ? () => onPick!(cell.midi) : undefined}
      style={active ? { cursor: 'pointer' } : undefined}
    >
      <polygon points={hexPoints(cx, cy, outer)} fill={DEGREE_COLOURS[cell.degree - 1]} fillOpacity={cell.inRange ? 1 : 0.35} />
      <polygon
        points={hexPoints(cx, cy, inner)}
        fill={fill}
        stroke={cell.inRange ? T.dock : 'none'}
        strokeWidth={T.keyline}
      />
      <text x={cx} y={cy - inner * 0.22} textAnchor="middle" fontSize={fs * 0.62} fontWeight={700} fill={ink} opacity={0.8}>
        {cell.degree}
      </text>
      <text x={cx} y={cy + inner * 0.42} textAnchor="middle" fontSize={fs} fontWeight={600} fill={ink}>
        {name}
      </text>
      {halo && <polygon className="hex-halo" points={hexPoints(cx, cy, R - 1)} />}
    </g>
  );
}
