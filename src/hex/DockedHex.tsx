// The docked hex (SPEC §8): React SVG for the active slot. Click = pick; a nudged pitch gets a dashed halo.
// Slots without a scale (§8.4): the unchecked hex (no chord) or the chord-tones hex, each with a dock label.
// Geometry and the travel plan come from `hexLayout`; colours from the CSS theme tokens (styles.css :root).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { HEX_THEME as T, type DockHex, type HexBorder, type HexCell } from '../hex';
import { layoutHex, travelSteps, type HexLayout } from '../hexLayout';
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

/** A cell's octave number as written (C4 = middle C; a C♭ belongs to the octave above its sounding pitch). */
const octaveOf = (cell: HexCell) => Math.floor((cell.midi + (cell.name.startsWith('Cb') ? 1 : 0)) / 12) - 1;

const buttonKey = (b: HexBorder, i: number) => `b${b.r}:${b.x}:${i}`;

/** Slide an element in from `dx` px to its place (the travel plan); a new slide takes over mid-way. */
function slideIn(el: Element | null, dx: number) {
  if (!el) return;
  el.getAnimations().forEach((a) => a.cancel());
  el.animate([{ transform: `translate(${dx}px, 0)` }, { transform: 'translate(0, 0)' }], { duration: T.travelMs, easing: 'ease-in' });
}

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
  /** Listen (SPEC §9.2): the written pitch the mic hears; its cells light. */
  heard?: number | null;
}

export function DockedHex({ dock, onPick, halo, onLabelClick, onHoverPitch, heard = null }: DockedHexProps) {
  const [ref, { width, height }] = useSize<HTMLDivElement>();
  const { hex, mode, label, labelEditsChord } = dock;
  const layout: HexLayout | null = width > 0 && height > 0 ? layoutHex(hex, width, height, T.borderButtonGap) : null;

  // Hover (SPEC §8.2 duplicates): kept as a place, so its pitch follows the hex when the slot changes under a still pointer.
  const [hover, setHoverState] = useState<HoverTarget | null>(null);
  const resolve = (t: HoverTarget | null): { midi: number | null; pick: number | null } => {
    if (!t) return { midi: null, pick: null };
    if (t.kind === 'border') {
      const b = hex.borders.find((x) => x.r === t.r && x.x === t.x)?.buttons[t.i];
      return { midi: b?.midi ?? null, pick: b?.playable && onPick ? b.midi : null };
    }
    const cell = hex.cells.find((c) => c.r === t.r && c.c === t.c);
    return { midi: cell?.midi ?? null, pick: cell?.playable && onPick ? cell.midi : null };
  };
  // Border buttons show beside the hovered cell (both its borders) or while hovered themselves (CSS: always on touch).
  const hoverCell = hover?.kind === 'cell' ? hex.cells.find((c) => c.r === hover.r && c.c === hover.c) : undefined;
  const shown = (b: HexBorder) =>
    hover !== null && b.r === hover.r && (hover.kind === 'border' ? b.x === hover.x : !!hoverCell && Math.abs(b.x - hoverCell.x) === 0.5);
  const { midi: hoverMidi, pick: hoverPick } = resolve(hover);
  // Reported straight from the pointer handler, so a key pressed before the next paint still sees it.
  const setHover = (t: HoverTarget | null) => {
    setHoverState(t);
    onHoverPitch?.(resolve(t).pick);
  };
  // A picks what is under the pointer (SPEC §11). When the hex changes under a still pointer, report the new pitch too.
  useLayoutEffect(() => {
    onHoverPitch?.(hoverPick);
  }, [hoverPick, onHoverPitch]);

  // A click: the pitch is picked, its cells light (~600 ms) and the clicked ball pops (re-keyed by `n` to replay).
  const [flash, setFlash] = useState<number | null>(null);
  const flashTimer = useRef<number>();
  useEffect(() => () => window.clearTimeout(flashTimer.current), []);
  const [pressed, setPressed] = useState<{ at: string; n: number }>({ at: '', n: 0 });
  const pick = !onPick
    ? undefined
    : (midi: number, at: string) => {
        setPressed((p) => ({ at, n: p.n + 1 }));
        onPick(midi);
        setFlash(midi);
        window.clearTimeout(flashTimer.current);
        flashTimer.current = window.setTimeout(() => setFlash(null), 600);
      };
  const popOf = (at: string) => (pressed.at === at ? pressed.n : 0);

  // Travel (SPEC §8.2): in the same key, the balls and a copy of the coloured cells slide together by the plan's
  // cells; the real cells show plain until the copy lands, then take the colour back before the copy is removed.
  const ballsRef = useRef<SVGGElement>(null);
  const coloursRef = useRef<SVGGElement>(null);
  const prevDock = useRef(dock);
  const [travel, setTravel] = useState<{ id: number; dx: number; settled: boolean } | null>(null);
  const travelTimers = useRef<number[]>([]);
  useEffect(() => () => travelTimers.current.forEach((t) => window.clearTimeout(t)), []);
  const look = hex.cells.map((c) => `${c.midi}:${c.degree}`).join(' ');
  useLayoutEffect(() => {
    const prev = prevDock.current;
    prevDock.current = dock;
    const steps = travelSteps(prev, dock);
    if (steps === null || !layout || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const dx = -steps * layout.cellWidth; // each ball starts where its degree was
    slideIn(ballsRef.current, dx);
    travelTimers.current.forEach((t) => window.clearTimeout(t));
    const id = performance.now();
    setTravel({ id, dx, settled: false });
    travelTimers.current = [
      window.setTimeout(() => setTravel((t) => (t?.id === id ? { ...t, settled: true } : t)), T.travelMs),
      window.setTimeout(() => setTravel((t) => (t?.id === id ? null : t)), T.travelMs + 250), // after the cells' colour fade
    ];
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs when what the hex shows changes
  }, [look]);
  useLayoutEffect(() => {
    if (travel && !travel.settled) slideIn(coloursRef.current, travel.dx);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per travel
  }, [travel?.id]);
  const plain = !!travel && !travel.settled;

  return (
    <div ref={ref} className="docked-hex" data-mode={mode}>
      {layout && (
        <svg width={width} height={height} role="img" aria-label={`Docked hex: ${hex.cells.length} cells`}>
          <NoteDefs R={layout.size.rx} />
          <clipPath id="hex-grid-clip">
            {layout.cells.map(({ cell, cx, cy }) => (
              <polygon key={`${cell.r}-${cell.c}`} points={hexPoints(cx, cy, layout.size.rx + 0.5, layout.size.ry + 0.5)} />
            ))}
          </clipPath>
          {/* A warm glow around the whole honeycomb: every cell's shape, blurred, behind the cells. */}
          <g className="hex-glow" filter="url(#hex-glow-blur)" aria-hidden>
            {layout.cells.map(({ cell, cx, cy }) => (
              <polygon key={`${cell.r}-${cell.c}`} points={hexPoints(cx, cy, layout.size.rx, layout.size.ry)} />
            ))}
          </g>
          {(['bg', 'top'] as const).map((part) => (
            <g key={part} className={`hex-layer-${part}`}>
              {layout.cells.map(({ cell, cx, cy }) => (
                <Cell
                  key={`${cell.r}-${cell.c}`}
                  part={part}
                  plain={plain}
                  cell={cell}
                  cx={cx}
                  cy={cy}
                  R={layout.size.rx}
                  ry={layout.size.ry}
                  onPick={pick}
                  halo={cell.midi === halo}
                  lit={cell.midi === hoverMidi || cell.midi === flash || cell.midi === heard}
                  onHover={setHover}
                />
              ))}
              {/* Travelling colours: a copy of the coloured cells between the cells' fill and their names, clipped
                  to the grid (the clip stays put; the inner group slides). */}
              {part === 'bg' && travel && (
                <g clipPath="url(#hex-grid-clip)" aria-hidden>
                  <g ref={coloursRef} className="hex-colour-copy">
                    {layout.cells
                      .filter(({ cell }) => cell.triad || cell.guide)
                      .map(({ cell, cx, cy }) => (
                        <polygon
                          key={`${cell.r}-${cell.c}`}
                          points={hexPoints(cx, cy, layout.size.rx + 0.5, layout.size.ry + 0.5)}
                          fill={cell.colour}
                          opacity={cell.inRange ? 1 : T.outOpacity}
                        />
                      ))}
                  </g>
                </g>
              )}
            </g>
          ))}
          {/* Balls above all cells, so they can travel; pointer events go to the cells. */}
          <g className="hex-balls" ref={ballsRef}>
            {layout.cells.map(({ cell, cx, cy }) => (
              <Ball key={`${cell.r}-${cell.c}`} cell={cell} cx={cx} cy={cy} R={layout.size.rx} halo={cell.midi === halo} pop={popOf(`${cell.r}:${cell.c}`)} />
            ))}
          </g>
          {/* Chromatic entry (suspensions, anticipations): on the border between two cells of a row, the pitch(es)
              between those steps. Drawn above every cell, as a button overlaps both. */}
          {pick &&
            layout.buttons.map(({ border, button, i, cx, cy }) => (
              <BorderButtonView
                key={buttonKey(border, i)}
                cx={cx}
                cy={cy}
                R={layout.size.rx}
                glyph={button.glyph}
                label={prettyName(button.name)}
                shown={shown(border)}
                onClick={() => pick(button.midi, buttonKey(border, i))}
                pop={popOf(buttonKey(border, i))}
                onEnter={() => setHover({ kind: 'border', r: border.r, x: border.x, i })}
                onLeave={() => setHover(null)}
              />
            ))}
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

/** Shared SVG defs: the note sphere's gradient (theme tokens), the glows and the drop shadow. */
function NoteDefs({ R }: { R: number }) {
  return (
    <defs>
      <radialGradient id="hex-note-sphere" cx="0.5" cy="0.5" r="0.5" fx="0.24" fy="0.16">
        <stop offset="0" style={{ stopColor: 'var(--ball-highlight)' }} />
        <stop offset="1" style={{ stopColor: 'var(--ball-edge)' }} />
      </radialGradient>
      <filter id="hex-glow-blur" x="-10%" y="-30%" width="120%" height="160%">
        <feGaussianBlur stdDeviation={Math.max(4, R * 0.3)} />
      </filter>
      {/* Lit cells: a soft white glow inside the cell's edge (blurred stroke, clipped to the cell). */}
      <filter id="hex-lit-blur" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation={Math.max(1.5, R * 0.05)} />
      </filter>
      <filter id="hex-note-shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feDropShadow dx="0" dy={Math.max(1, R * 0.06)} stdDeviation={Math.max(1, R * 0.07)} floodColor="#000" floodOpacity="0.45" />
      </filter>
    </defs>
  );
}

interface CellProps {
  /** `bg`: the fill (and the pointer target); `top`: the lit glow, name and socket, drawn over travelling colours. */
  part: 'bg' | 'top';
  /** While the colours travel: show the neutral fill (the copy carries the colour). */
  plain: boolean;
  cell: HexCell;
  cx: number;
  cy: number;
  /** Horizontal radius (also sizes the ball, names and buttons) and vertical radius. */
  R: number;
  ry: number;
  onPick?: (midi: number, at: string) => void;
  halo: boolean;
  /** Same pitch as the hovered / just-clicked cell: colour shown and a white glow inside the cell edge. */
  lit: boolean;
  onHover: (target: HoverTarget | null) => void;
}

function Cell({ part, plain, cell, cx, cy, R, ry, onPick, halo, lit, onHover }: CellProps) {
  const active = cell.playable && !!onPick;
  const r = R * (cell.triad ? T.triadNote : T.otherNote);
  // Triad cells and a quartad's guide tone (7th / 6th) show their degree colour; the rest stay neutral until lit
  // (CSS: .hex-cell.muted).
  const coloured = cell.triad || cell.guide;
  const className = ['hex-cell', coloured && !plain ? '' : 'muted', lit ? 'lit' : ''].join(' ').trim();
  const style = { ['--deg' as string]: cell.colour, ['--deg-ink' as string]: cell.ink };
  const opacity = cell.inRange ? 1 : T.outOpacity;
  if (part === 'top') {
    const clipId = `hex-clip-${cell.r}-${cell.c}`;
    return (
      <g className={`${className} hex-cell-top`} style={style} opacity={opacity}>
        {/* Triad cells: a thin white edge (in the top layer, so no neighbour's fill covers it; off while colours travel). */}
        {cell.triad && !plain && <polygon className="hex-triad-edge" points={hexPoints(cx, cy, R - 0.75, ry - 0.75)} />}
        {lit && (
          <>
            <clipPath id={clipId}>
              <polygon points={hexPoints(cx, cy, R, ry)} />
            </clipPath>
            <polygon className="hex-lit" points={hexPoints(cx, cy, R, ry)} clipPath={`url(#${clipId})`} strokeWidth={R * 0.2} filter="url(#hex-lit-blur)" />
          </>
        )}
        <text x={cx} y={cy - R * 0.6} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(8, R * 0.25)} fontWeight={700} className="hex-name">
          {prettyName(cell.name)}
        </text>
        {/* The socket shows only while a sharp / flat ball is out of it. */}
        <circle className="hex-socket" cx={cx} cy={cy} r={r} opacity={cell.accidental === 0 ? 0 : 1} />
        {/* C cells: the octave number under the ball (C4 = middle C), so you can tell the Cs apart. */}
        {cell.name[0] === 'C' && (
          <text x={cx} y={cy + r + Math.max(7, R * 0.16)} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(8, R * 0.2)} fontWeight={700} className="hex-octave">
            {`oct-${octaveOf(cell)}`}
          </text>
        )}
      </g>
    );
  }
  const name = prettyName(cell.name);
  const tone = cell.role === 'chord' ? (cell.triad ? ', triad tone' : ', chord tone') : '';
  return (
    <g
      className={className}
      data-midi={cell.midi}
      data-degree={cell.degree ?? undefined}
      data-role={cell.inRange ? cell.role : 'out'}
      data-triad={cell.triad || undefined}
      data-halo={halo || undefined}
      onMouseEnter={() => onHover({ kind: 'cell', r: cell.r, c: cell.c })}
      onMouseLeave={() => onHover(null)}
      aria-label={cell.degree === null ? name : `${name}, degree ${cell.degree}${tone}`}
      role={active ? 'button' : undefined}
      onClick={active ? () => onPick!(cell.midi, `${cell.r}:${cell.c}`) : undefined}
      style={{ ...style, cursor: active ? 'pointer' : undefined }}
      opacity={opacity}
    >
      {/* +0.5 px overlaps neighbours so the grid shows no hairline seams */}
      <polygon className="hex-bg" points={hexPoints(cx, cy, R + 0.5, ry + 0.5)} />
    </g>
  );
}

interface BallProps {
  cell: HexCell;
  cx: number;
  cy: number;
  R: number;
  halo: boolean;
  /** Non-zero while this ball is the last one clicked; each new value replays its pop. */
  pop: number;
}

/** A cell's ball and degree number, in the layer above every cell (it travels with that layer; clicks pass through). */
function Ball({ cell, cx, cy, R, halo, pop }: BallProps) {
  const r = R * (cell.triad ? T.triadNote : T.otherNote);
  // Sharps sit to the right, flats to the left of the cell centre (over the cell's socket).
  const slide = R * cell.accidental * T.accidentalShift; // a transform, so the slide can be transitioned (CSS: .hex-ball)
  const dfs = Math.max(8, r * (cell.triad ? 0.85 : 0.95)); // degree number on the ball
  return (
    <g opacity={cell.inRange ? 1 : T.outOpacity}>
      <g className="hex-ball" style={{ transform: `translateX(${slide.toFixed(2)}px)` }}>
        {/* Re-keyed on every click of this ball, so the pop (CSS: .hex-pop) plays again. */}
        <g key={pop} className={pop > 0 ? 'hex-pop' : undefined}>
          <circle cx={cx} cy={cy} r={r} fill="url(#hex-note-sphere)" filter={cell.inRange ? 'url(#hex-note-shadow)' : undefined} />
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={dfs} fontWeight={cell.triad ? 700 : 600} className="hex-ball-ink">
            {cell.degree ?? ''}
          </text>
        </g>
        {halo && <circle className="hex-halo" cx={cx} cy={cy} r={r + 3} />}
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
  /** Non-zero while this button is the last one clicked; each new value replays its pop. */
  pop: number;
}

function BorderButtonView({ cx, cy, R, glyph, label, shown, onClick, onEnter, onLeave, pop }: BorderButtonProps) {
  const r = R * T.accidentalButton;
  return (
    <g className={shown ? 'hex-acc shown' : 'hex-acc'} role="button" aria-label={label} onClick={onClick} onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <g key={pop} className={pop > 0 ? 'hex-pop' : undefined}>
        <circle cx={cx} cy={cy} r={r} fill="url(#hex-note-sphere)" filter="url(#hex-note-shadow)" />
        <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" fontSize={Math.max(10, r * 1.45)} fontWeight={700} className="hex-ball-ink">
          {glyph}
        </text>
      </g>
    </g>
  );
}
