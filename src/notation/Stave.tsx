// React wrappers around VexFlow staves (SPEC §7). Draw only after loadNotationFonts() resolves.
import type { Clef } from '../instruments';
import { useLayoutEffect, useRef } from 'react';
import { Accidental, Formatter, GhostNote, Renderer, Stave, StaveNote, Voice, type RenderContext } from 'vexflow/core';
import type { Meter } from '../form';
import type { NoteMark } from '../marks';
import { beamsFor } from './beaming';
import { TICKS, fillDurations, type TimedEvent } from '../melody';
import type { Duration } from '../progression';
import { HIGHLIGHT } from '../theme';

/** Fixed headroom of 3 ledger lines above and below on every row (SPEC §7.1). */
const STAVE_OPTIONS = { spaceAboveStaffLn: 3, spaceBelowStaffLn: 3 };

export interface StaveMetrics {
  /** Height of one stave's SVG, headroom included. */
  height: number;
  /** y of the top and bottom staff lines. */
  staffTop: number;
  staffBottom: number;
}

let metrics: StaveMetrics | null = null;

export function staveMetrics(): StaveMetrics {
  if (!metrics) {
    const probe = new Stave(0, 0, 100, STAVE_OPTIONS);
    metrics = { height: probe.getBottomY(), staffTop: probe.getYForLine(0), staffBottom: probe.getYForLine(4) };
  }
  return metrics;
}

function useVexSvg(width: number, draw: (ctx: RenderContext) => void, deps: unknown[]) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = ref.current;
    if (!host) return;
    host.innerHTML = '';
    if (width <= 0) return;
    const { height } = staveMetrics();
    const renderer = new Renderer(host, Renderer.Backends.SVG);
    renderer.resize(width, height);
    // Renderer.resize writes inline width / height styles on the <svg> (SPEC §7.1 gotcha);
    // set them explicitly so later zoom can override them in one place.
    const svg = host.querySelector('svg');
    if (svg) {
      svg.style.width = `${width}px`;
      svg.style.height = `${height}px`;
      svg.style.display = 'block';
    }
    draw(renderer.getContext());
  }, [width, ...deps]);
  return ref;
}

export interface SlotStaveProps {
  width: number;
  timeSignature?: string;
  clef: Clef;
  /** The slot's time range (form ticks). */
  start: number;
  end: number;
  /** Events owned by this slot, in time order. */
  events: TimedEvent[];
  /** Spells a concert MIDI pitch for this slot, e.g. `Bb4`. */
  spell: (midi: number) => string;
  /** Caret time when the caret is in this slot. */
  caret?: number;
  /** Click on an engraved note or rest. */
  onEventClick?: (e: TimedEvent) => void;
  /** Click elsewhere on the stave: the form time under the pointer (caret placement, SPEC §6.2 item 7). */
  onTimeClick?: (t: number) => void;
  /** The layout meter, for beaming by beat (SPEC §7.1). */
  meter: Meter;
  /** Marks for a note (SPEC §7.2); rests are never marked. */
  markOf?: (e: TimedEvent) => NoteMark | null;
  /** Read etude: extend staff lines this many px past the slot (into gaps / across bar lines). */
  extendRight?: number;
}

/** Time ↔ x anchors on a drawn stave: each tickable's start (where the caret sits), then the slot end. */
type Anchor = { t: number; x: number };

/** Piecewise-linear between anchors (VexFlow spacing is not time-proportional, SPEC §15 risk 2). */
function lerp(anchors: Anchor[], v: number, from: 't' | 'x', to: 't' | 'x'): number {
  if (v <= anchors[0][from]) return anchors[0][to];
  for (let k = 1; k < anchors.length; k++) {
    const a = anchors[k - 1];
    const b = anchors[k];
    if (v < b[from]) return b[from] === a[from] ? a[to] : a[to] + ((v - a[from]) / (b[from] - a[from])) * (b[to] - a[to]);
  }
  return anchors[anchors.length - 1][to];
}

/** VexFlow key from a scientific name: `Bb4` → `bb/4`. */
function vexKey(name: string): string {
  const m = /^([A-G])([#b]?)(-?\d+)$/.exec(name)!;
  return `${m[1].toLowerCase()}${m[2]}/${m[3]}`;
}

const VEX_DURATION: Record<Duration, string> = { w: 'w', h: 'h', q: 'q', e: '8', s: '16' };
const CARET = HIGHLIGHT;
/** Mark colours (SPEC §7.2). */
const OUT_OF_SCALE = '#C8650A'; // orange
const OUT_OF_RANGE = '#B5B5B5';
const SVG_NS = 'http://www.w3.org/2000/svg';

/** Extend the five staff lines past the stave's right edge (Read etude: continuous stave across gaps). */
function drawStaffBridge(svg: SVGSVGElement, stave: Stave, bridge: number) {
  if (bridge <= 0) return;
  const x1 = stave.getX() + stave.getWidth();
  for (let i = 0; i < 5; i++) {
    const y = Math.floor(stave.getYForLine(i)) + 0.5;
    const line = document.createElementNS(SVG_NS, 'line');
    line.setAttribute('x1', String(x1));
    line.setAttribute('x2', String(x1 + bridge));
    line.setAttribute('y1', String(y));
    line.setAttribute('y2', String(y));
    line.setAttribute('stroke', '#000');
    line.setAttribute('stroke-width', '1');
    svg.appendChild(line);
  }
}

/**
 * One slot's stave (SPEC §7.1): no bar lines of its own (bar lines are chart chrome). Engraves the slot's events
 * in a SOFT voice padded with GhostNotes, accidentals per slot (no key signature), default beams, and the caret.
 */
export function SlotStave({
  width,
  timeSignature,
  clef,
  start,
  end,
  events,
  spell,
  caret,
  onEventClick,
  onTimeClick,
  meter,
  markOf,
  extendRight = 0,
}: SlotStaveProps) {
  const anchors = useRef<Anchor[]>([]);
  const bridge = extendRight > 0 ? extendRight + 1 : 0; // +1 overlaps the next stave at fractional zoom
  const ref = useVexSvg(
    width + bridge,
    (ctx) => {
      const stave = new Stave(0, 0, width, { ...STAVE_OPTIONS, leftBar: false, rightBar: false });
      if (timeSignature) stave.addTimeSignature(timeSignature);
      stave.setContext(ctx).draw();
      if (bridge > 0) {
        const svg = (ctx as unknown as { svg?: SVGSVGElement }).svg;
        if (svg) drawStaffBridge(svg, stave, bridge);
      }

      const timed: { t: number; note: StaveNote | GhostNote }[] = [];
      const clickable: { e: TimedEvent; note: StaveNote; mark: NoteMark | null }[] = [];
      for (const e of events) {
        const rest = !('pitch' in e.ev);
        const note = new StaveNote({
          clef,
          keys: ['pitch' in e.ev ? vexKey(spell(e.ev.pitch)) : clef === 'bass' ? 'd/3' : clef === 'alto' ? 'c/4' : 'b/4'],
          duration: VEX_DURATION[e.ev.d] + (rest ? 'r' : ''),
          autoStem: true,
        });
        const mark = !rest && markOf ? markOf(e) : null;
        if (mark?.range) {
          // Out of range (or both): the whole note light grey, ledger lines included; "both" shows as out of range (the tooltip names both).
          note.setStyle({ fillStyle: OUT_OF_RANGE, strokeStyle: OUT_OF_RANGE });
          note.setLedgerLineStyle({ fillStyle: OUT_OF_RANGE, strokeStyle: OUT_OF_RANGE });
        } else if (mark?.outOfScale) {
          // Out of scale: notehead, stem and flag orange; accidentals stay black.
          const oos = { fillStyle: OUT_OF_SCALE, strokeStyle: OUT_OF_SCALE };
          note.setKeyStyle(0, oos).setStemStyle(oos);
          note.setFlagStyle(oos);
        } else if (caret !== undefined && e.start === caret) note.setStyle({ fillStyle: CARET, strokeStyle: CARET });
        timed.push({ t: e.start, note });
        clickable.push({ e, note, mark });
      }
      let t = events.length ? events[events.length - 1].end : start;
      for (const d of fillDurations(start, t, end)) {
        timed.push({ t, note: new GhostNote({ duration: VEX_DURATION[d] }) });
        t += TICKS[d];
      }
      const notes = timed.map((x) => x.note);
      if (notes.length) {
        const voice = new Voice({ numBeats: (end - start) / TICKS.s, beatValue: 16 }).setMode(Voice.Mode.SOFT);
        voice.addTickables(notes);
        Accidental.applyAccidentals([voice], 'C');
        for (const { note, mark } of clickable) {
          if (mark?.range) for (const m of note.getModifiers()) m.setStyle({ fillStyle: OUT_OF_RANGE, strokeStyle: OUT_OF_RANGE });
        }
        // Events only (rests break beams; trailing ghosts are not beamed), grouped by beat from the bar.
        const beams = beamsFor(clickable.map((c) => c.note), meter, start, end);
        new Formatter().joinVoices([voice]).formatToStave([voice], stave);
        voice.draw(ctx, stave);
        beams.forEach((b) => b.setContext(ctx).draw());
        for (const { note, mark } of clickable) {
          if (!mark) continue;
          const el = note.getSVGElement();
          if (mark.reason && el) {
            const title = document.createElementNS(SVG_NS, 'title');
            title.textContent = mark.reason; // hover tooltip
            el.prepend(title);
            el.setAttribute('data-mark', mark.range ? (mark.outOfScale ? 'both' : 'range') : 'scale');
          }
        }
        if (onEventClick) {
          for (const { e, note } of clickable) {
            const el = note.getSVGElement();
            if (!el) continue;
            el.classList.add('melody-event');
            el.addEventListener('click', (ev) => {
              ev.stopPropagation();
              onEventClick(e);
            });
          }
        }
      }

      const x0 = stave.getNoteStartX();
      const x1 = stave.getNoteEndX();
      const pts: Anchor[] = notes.length ? timed.map((x) => ({ t: x.t, x: x.note.getAbsoluteX() - 4 })) : [{ t: start, x: x0 }];
      pts.push({ t: end, x: x1 });
      anchors.current = pts;

      if (caret !== undefined) {
        const x = lerp(pts, caret, 't', 'x');
        const top = stave.getYForLine(0) - 14;
        const bottom = stave.getYForLine(4) + 14;
        const svg = ctx as unknown as { svg: SVGSVGElement };
        const ns = 'http://www.w3.org/2000/svg';
        const g = document.createElementNS(ns, 'g');
        g.setAttribute('class', 'caret');
        g.setAttribute('data-caret', String(caret));
        const line = document.createElementNS(ns, 'rect');
        line.setAttribute('x', String(x - 1));
        line.setAttribute('y', String(top));
        line.setAttribute('width', '2');
        line.setAttribute('height', String(bottom - top));
        line.setAttribute('fill', CARET);
        const marker = document.createElementNS(ns, 'path');
        marker.setAttribute('d', `M${x - 5},${top - 6} L${x + 5},${top - 6} L${x},${top} Z`);
        marker.setAttribute('fill', CARET);
        g.append(line, marker);
        svg.svg.appendChild(g);
      }
    },
    [timeSignature, clef, start, end, events, spell, caret, onEventClick, meter, markOf, extendRight],
  );
  return (
    <div
      ref={ref}
      className="vex-host"
      onPointerDown={
        onTimeClick &&
        ((e) => {
          // Notes take their own click (a redraw here would remove the note before its click fires).
          if ((e.target as Element).closest('.melody-event')) return;
          e.stopPropagation();
          // Screen px → logical px: the chart may be scaled by chart zoom.
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) * e.currentTarget.offsetWidth) / (rect.width || 1);
          onTimeClick(Math.min(end - 1, Math.round(lerp(anchors.current, x, 'x', 't')))); // stay in this slot
        })
      }
    />
  );
}

/** The clef drawn at the start of every row, in a gutter outside the slots (SPEC §7.3). */
export function ClefGutter({ width, clef, extendRight = 0 }: { width: number; clef: Clef; extendRight?: number }) {
  const bridge = extendRight > 0 ? extendRight + 1 : 0;
  const ref = useVexSvg(
    width + bridge,
    (ctx) => {
      const stave = new Stave(0, 0, width, { ...STAVE_OPTIONS, leftBar: false, rightBar: false });
      stave.addClef(clef).setContext(ctx).draw();
      if (bridge > 0) {
        const svg = (ctx as unknown as { svg?: SVGSVGElement }).svg;
        if (svg) drawStaffBridge(svg, stave, bridge);
      }
    },
    [clef, extendRight],
  );
  return <div ref={ref} className="vex-host" />;
}
