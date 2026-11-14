// The docked hex (SPEC §8): React SVG for the active slot. Click = pick; a nudged pitch gets a dashed halo.
// Slots without a scale (§8.4): the unchecked hex (no chord) or the chord-tones hex, each with a dock label.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HEX_THEME as T, cellCentre, hexSize, type DockHex, type HexBorder, type HexCell } from '../hex';
import { prettyName } from '../spelling';

/** A pointy-top hex, `rx` across (half-width √3/2·rx) and `ry` from centre to top vertex. */
function hexPoints(cx: number, cy: number, rx: number, ry: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30); // pointy-top
    pts.push(`${(cx + rx * Math.cos(a)).toFixed(1)},${(cy + ry * Math.sin(a)).toFixed(1)}`);
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

/** A hover place: a cell (by grid position), or a chromatic-entry button on a border (row, x, index). */
type HoverTarget = { kind: 'cell'; r: number; c: number } | { kind: 'border'; r: number; x: number; i: number };

export interface DockedHexProps {
  /** What the dock shows for the active slot (SPEC §8.4), in the view's (written) pitch. */
  dock: DockHex;
  /** Called with the cell's written MIDI pitch. */
  onPick?: (midi: number) => void;
  /** Written pitch of the nudge target: its cell(s) get a dashed halo (SPEC §6.2 item 8). */
  halo?: number | null;
  /** Clicking an empty / unparseable slot's label focuses its chord field. */
  onLabelClick?: () => void;
  /** The playable written pitch under the pointer (a cell or a border button), or null: what A would pick (Space clicks it). */
  onHoverPitch?: (written: number | null) => void;
}

export function DockedHex({ dock, onPick, halo, onLabelClick, onHoverPitch }: DockedHexProps) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const { hex, mode, label, labelEditsChord } = dock;
  // Duplicates (SPEC §8.2): hovering a cell, or clicking it (~600 ms), lights every cell with the same pitch.
  // What is under the pointer is kept as a place (a cell, or a border button), so its pitch follows the hex when the
  // slot changes under a still pointer.
  const [hover, setHoverState] = useState<HoverTarget | null>(null);
  /** A hover place's pitch in the current hex, and whether A may pick it. */
  const resolve = (t: HoverTarget | null): { midi: number | null; pick: number | null } => {
    if (!t) return { midi: null, pick: null };
    if (t.kind === 'border') {
      const b = hex.borders.find((x) => x.r === t.r && x.x === t.x)?.buttons[t.i];
      return { midi: b?.midi ?? null, pick: b?.playable && onPick ? b.midi : null };
    }
    const cell = hex.cells.find((c) => c.r === t.r && c.c === t.c);
    return { midi: cell?.midi ?? null, pick: cell?.playable && onPick ? cell.midi : null };
  };
  // Border buttons show next to the hovered cell (both its borders) or while hovered themselves (CSS: always on touch).
  const hoverCell = hover?.kind === 'cell' ? hex.cells.find((c) => c.r === hover.r && c.c === hover.c) : undefined;
  const shown = (b: HexBorder) =>
    hover !== null && b.r === hover.r && (hover.kind === 'border' ? b.x === hover.x : !!hoverCell && Math.abs(b.x - hoverCell.x) === 0.5);
  const { midi: hoverMidi, pick: hoverPick } = resolve(hover);
  // Reported straight from the pointer handler, so a key pressed before the next paint still sees it.
  const setHover = (t: HoverTarget | null) => {
    setHoverState(t);
    onHoverPitch?.(resolve(t).pick);
  };
  const [flash, setFlash] = useState<number | null>(null);
  const flashTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const pick = !onPick
    ? undefined
    : (midi: number) => {
        onPick(midi);
        setFlash(midi);
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(null), 600);
      };

  // A picks what is under the pointer (SPEC §11, keymap.ts). When the hex changes under a still pointer
  // (a new active slot), the same place now holds another pitch: report that too, before paint.
  useLayoutEffect(() => {
    onHoverPitch?.(hoverPick);
  }, [hoverPick, onHoverPitch]);

  return (
    <div ref={ref} className="docked-hex" data-mode={mode}>
      {width > 0 && height > 0 && (
        <svg width={width} height={height} role="img" aria-label={`Docked hex: ${hex.cells.length} cells`}>
          <NoteDefs R={hexSize(hex, width, height).rx} />
          {hex.cells.map((cell) => {
            const size = hexSize(hex, width, height);
            const { cx, cy } = cellCentre(cell, hex, size, width, height);
            return (
              <Cell
                key={`${cell.r}-${cell.c}`}
                cell={cell}
                cx={cx}
                cy={cy}
                R={size.rx}
                ry={size.ry}
                onPick={pick}
                halo={cell.midi === halo}
                lit={cell.midi === hoverMidi || cell.midi === flash}
                onHover={setHover}
              />
            );
          })}
          {/* Chromatic entry (suspensions, anticipations): on the border between two cells of a row, the pitch(es)
              between those steps. Drawn above every cell, as a button overlaps both. */}
          {pick &&
            hex.borders.map((b) => {
              const size = hexSize(hex, width, height);
              // A border's centre: the cell centre formula at a half-cell x.
              const { cx, cy } = cellCentre({ r: b.r, x: b.x } as HexCell, hex, size, width, height);
              const gap = size.ry * T.borderButtonGap;
              return b.buttons.map((btn, i) => {
                if (!btn.playable) return null;
                const y = b.buttons.length === 1 ? cy : i === 0 ? cy + gap : cy - gap; // two: the higher pitch on top
                return (
                  <BorderButton
                    key={`${b.r}:${b.x}:${i}`}
                    cx={cx}
                    cy={y}
                    R={size.rx}
                    glyph={btn.glyph}
                    label={prettyName(btn.name)}
                    shown={shown(b)}
                    onClick={() => pick(btn.midi)}
                    onEnter={() => setHover({ kind: 'border', r: b.r, x: b.x, i })}
                    onLeave={() => setHover(null)}
                  />
                );
              });
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
  /** Horizontal radius (also sizes the ball, names and buttons) and vertical radius (the cell is stretched to fill). */
  R: number;
  ry: number;
  onPick?: (midi: number) => void;
  halo: boolean;
  /** Same pitch as the hovered / just-clicked cell: colour shown and a white glow round the ball. */
  lit: boolean;
  onHover: (target: HoverTarget | null) => void;
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

function Cell({ cell, cx, cy, R, ry, onPick, halo, lit, onHover }: CellProps) {
  const active = cell.playable && !!onPick;
  const r = R * (cell.triad ? T.triadNote : T.otherNote);
  const home = cy; // the ball's default spot: the cell centre
  // Sharps sit to the right, flats to the left; a dark socket marks the default spot behind them.
  const shift = cell.accidental * T.accidentalShift;
  const slide = R * shift; // applied as a transform so the slide can be transitioned (CSS: .hex-ball)
  const dfs = Math.max(8, r * (cell.triad ? 0.85 : 0.95)); // degree number on the ball
  const nfs = Math.max(8, R * 0.25); // note name, above the ball
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
      onMouseEnter={() => onHover({ kind: 'cell', r: cell.r, c: cell.c })}
      onMouseLeave={() => onHover(null)}
      aria-label={`${name}, degree ${cell.degree}${tone}`}
      role={active ? 'button' : undefined}
      onClick={active ? () => onPick!(cell.midi) : undefined}
      // Only triad cells show their degree colour; the rest stay neutral until lit (CSS: .hex-cell.muted).
      style={{ cursor: active ? 'pointer' : undefined, ['--deg' as string]: cell.colour, ['--deg-ink' as string]: cell.ink }}
      opacity={cell.inRange ? 1 : T.outOpacity}
    >
      {/* +0.5 px overlaps neighbours so the grid shows no hairline seams */}
      <polygon className="hex-bg" points={hexPoints(cx, cy, R + 0.5, ry + 0.5)} />
      <text x={cx} y={cy - R * 0.6} textAnchor="middle" dominantBaseline="central" fontSize={nfs} fontWeight={700} className="hex-name">
        {name}
      </text>
      {/* The socket shows only while a sharp / flat ball is out of it. */}
      <circle className="hex-socket" cx={cx} cy={home} r={r} opacity={shift === 0 ? 0 : 1} />
      <g className="hex-ball" style={{ transform: `translateX(${slide.toFixed(2)}px)` }}>
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

interface BorderButtonProps {
  cx: number;
  cy: number;
  R: number;
  glyph: '♯' | '♭' | '♮';
  /** The pitch's name, for the accessible label. */
  label: string;
  /** Next to the hovered cell, or hovered itself (always on touch screens: CSS). */
  shown: boolean;
  onClick: () => void;
  onEnter: () => void;
  onLeave: () => void;
}

function BorderButton({ cx, cy, R, glyph, label, shown, onClick, onEnter, onLeave }: BorderButtonProps) {
  const r = R * T.accidentalButton;
  return (
    <g className={shown ? 'hex-acc shown' : 'hex-acc'} role="button" aria-label={label} onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <circle cx={cx} cy={cy} r={r} fill="url(#hex-note-sphere)" filter="url(#hex-note-shadow)" />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(10, r * 1.45)} fontWeight={700} fill={T.noteInk}>
        {glyph}
      </text>
    </g>
  );
}
