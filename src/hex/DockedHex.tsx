// The docked hex (SPEC §8): React SVG for the active slot. Click = pick; a nudged pitch gets a dashed halo.
// Slots without a scale (§8.4): a dimmed, inactive rests-only hex or the chord-tones hex, each with a dock label.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  // Duplicates (SPEC §8.2): hovering a cell, or clicking it (~600 ms), lights every cell with the same pitch.
  const [hover, setHover] = useState<number | null>(null);
  const [flash, setFlash] = useState<number | null>(null);
  const flashTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const pick = inactive || !onPick
    ? undefined
    : (midi: number) => {
        onPick(midi);
        setFlash(midi);
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(null), 600);
      };

  // Space (or A) = a click on the hovered cell (SPEC §11): hover to choose, Space to write (Play: audition).
  const keyPick = useRef<() => void>(() => {});
  keyPick.current = () => {
    const cell = hex.cells.find((c) => c.midi === hover && c.inRange);
    if (cell && pick) pick(cell.midi);
  };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'a' && e.key !== 'A') return;
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat || (e.key === ' ' && e.shiftKey)) return;
      if (e.target instanceof Element && e.target.closest('input, textarea, select, [contenteditable]')) return;
      e.preventDefault();
      keyPick.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div ref={ref} className={inactive ? 'docked-hex inactive' : 'docked-hex'} data-mode={mode}>
      {width > 0 && height > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Docked hex: ${hex.cells.length} cells${inactive ? ', inactive' : ''}`}>
          <NoteDefs R={hexRadius(hex, width, height)} />
          {hex.cells.map((cell) => {
            const R = hexRadius(hex, width, height);
            const { cx, cy } = cellCentre(cell, hex, R, width, height);
            return (
              <Cell
                key={`${cell.r}-${cell.c}`}
                cell={cell}
                cx={cx}
                cy={cy}
                R={R}
                onPick={pick}
                halo={cell.midi === halo}
                lit={cell.midi === hover || cell.midi === flash}
                onHover={setHover}
              />
            );
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
  /** Same pitch as the hovered / just-clicked cell: colour shown and a white glow round the ball. */
  lit: boolean;
  onHover: (midi: number | null) => void;
}

/** Dark or light ink for text on a degree colour (relative luminance). */
function inkOn(hex: string): string {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.3 ? T.noteInk : '#FFFFFF';
}

/** Shared SVG defs: the note sphere's gradient and drop shadow. */
function NoteDefs({ R }: { R: number }) {
  return (
    <defs>
      <radialGradient id="hex-note-sphere" cx="0.5" cy="0.5" r="0.5" fx="0.36" fy="0.3">
        <stop offset="0" stopColor={T.noteHighlight} />
        <stop offset="0.45" stopColor={T.noteFill} />
        <stop offset="1" stopColor={T.noteEdge} />
      </radialGradient>
      <filter id="hex-note-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy={Math.max(1, R * 0.06)} stdDeviation={Math.max(1, R * 0.07)} floodColor="#000" floodOpacity="0.45" />
      </filter>
    </defs>
  );
}

function Cell({ cell, cx, cy, R, onPick, halo, lit, onHover }: CellProps) {
  const active = cell.inRange && !!onPick;
  const colour = DEGREE_COLOURS[cell.degree - 1];
  const r = R * (cell.triad ? T.triadNote : T.otherNote);
  const home = cy + R * 0.12; // the ball's default spot: a little low, leaving the top of the cell for the note name
  // Sharps ride higher, flats lower; a dark socket marks the default spot behind them.
  const accidental = cell.name.slice(1);
  const shift = accidental.startsWith('#') ? -T.accidentalShift : accidental.startsWith('b') ? T.accidentalShift : 0;
  const lift = R * shift; // applied as a transform so the slide can be transitioned (CSS: .hex-ball)
  const dfs = Math.max(8, r * (cell.triad ? 0.85 : 0.95)); // degree number on the ball
  const nfs = Math.max(8, R * 0.27); // note name on the cell
  const name = prettyName(cell.name);
  const tone = cell.role === 'chord' ? (cell.triad ? ', triad tone' : ', chord tone') : '';
  return (
    <g
      className={['hex-cell', cell.triad ? '' : 'muted', lit ? 'lit' : ''].join(' ').trim()}
      data-midi={cell.midi}
      data-degree={cell.degree}
      data-role={cell.inRange ? cell.role : 'out'}
      data-triad={cell.triad || undefined}
      data-halo={halo || undefined}
      onMouseEnter={() => onHover(cell.midi)}
      onMouseLeave={() => onHover(null)}
      aria-label={`${name}, degree ${cell.degree}${tone}`}
      role={active ? 'button' : undefined}
      onClick={active ? () => onPick!(cell.midi) : undefined}
      // Only triad cells show their degree colour; the rest stay neutral until hovered (CSS: .hex-cell.muted).
      style={{ cursor: active ? 'pointer' : undefined, ['--deg' as string]: colour, ['--deg-ink' as string]: inkOn(colour) }}
      opacity={cell.inRange ? 1 : T.outOpacity}
    >
      {/* +0.5 px overlaps neighbours so the grid shows no hairline seams */}
      <polygon className="hex-bg" points={hexPoints(cx, cy, R + 0.5)} />
      <text x={cx} y={cy - R * 0.68} textAnchor="middle" dominantBaseline="central" fontSize={nfs} fontWeight={700} className="hex-name">
        {name}
      </text>
      {/* The socket shows only while a sharp / flat ball is out of it. */}
      <circle className="hex-socket" cx={cx} cy={home} r={r} opacity={shift === 0 ? 0 : 1} />
      <g className="hex-ball" style={{ transform: `translateY(${lift.toFixed(2)}px)` }}>
        <circle cx={cx} cy={home} r={r} fill="url(#hex-note-sphere)" filter={cell.inRange ? 'url(#hex-note-shadow)' : undefined} />
        <text x={cx} y={home} textAnchor="middle" dominantBaseline="central" fontSize={dfs} fontWeight={cell.triad ? 700 : 600} fill={T.noteInk}>
          {cell.degree}
        </text>
        {lit && <circle className="hex-lit" cx={cx} cy={home} r={r + 1.5} />}
        {halo && <circle className="hex-halo" cx={cx} cy={home} r={r + 3} />}
      </g>
    </g>
  );
}
