// The chart (SPEC §3.1): rows of `barsPerRow` bars, a clef gutter per row, slots at time-proportional width.
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { layoutMeter, slotAt, slotsOf, type FormSlot, type Meter } from '../form';
import { eventsForSlot, type TimedEvent } from '../melody';
import { noteName, slotSpelling } from '../spelling';
import { parseChord, interpretation } from '../chords';
import { scaleLabel, slotHarmony, type ScaleId, type SlotHarmony } from '../harmony';
import type { ChordCommit, Progression, Slot } from '../progression';
import { ClefGutter, SlotStave, staveMetrics } from '../notation/Stave';
import { clefOf, instrumentOf, writtenChord, type Instrument } from '../instruments';
import { noteMark } from '../marks';
import { ChordField } from './ChordField';
import { ScaleLabel } from './ScaleLabel';
import { BarHandle, type BarAction } from './BarHandle';

import { CHORD_PX, MIN_CHORD_PX, MIN_SCALE_PX, ROW_GAP_PX, SCALE_PX, chartHeight, fitZoom, headerPx, labelPx } from '../zoom';

const GUTTER_WIDTH = 46;

export interface ChartProps {
  progression: Progression;
  /** Caret time (form ticks); its slot is the active slot (tinted; drives the docked hex). */
  caret: number;
  /** A click on a slot (caret placement). */
  onSlotClick: (slot: FormSlot) => void;
  /** A click on an engraved note or rest. */
  onEventClick: (e: TimedEvent) => void;
  /** A click on a stave away from the notes: the form time under the pointer. */
  onTimeClick: (t: number) => void;
  /** Apply typed chord text to a slot; returns the result (refused commits change nothing). */
  onChordCommit: (bar: number, part: number, text: string) => ChordCommit;
  /** Set (or with null, clear) a slot's scale override. */
  onScaleChange: (bar: number, part: number, scale: ScaleId | null) => void;
  /** Open a slot's chord field from outside (the dock label); `n` changes on every request. */
  editRequest?: { bar: number; part: number; n: number } | null;
  /** Bar selection (a run), for the bar handles and ⌘C / ⌘V / ⌘D / ⌫ (SPEC §4.1). */
  selection: { from: number; to: number } | null;
  onBarSelect: (bar: number, extend: boolean) => void;
  onBarAction: (bar: number, action: BarAction) => void;
  onAppendBar: () => void;
  canPaste: boolean;
  /** Play mode (SPEC §3.3): the current slot. The caret, bar handles, "+" and all editing are hidden. */
  playIndex?: number | null;
  /** Stand mode (SPEC §3.4): read-only, nothing highlighted or clickable, fit the page with no zoom floor. */
  stand?: boolean;
}

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setWidth(Math.floor(el.clientWidth));
    const ro = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Content-box size of the element's parent (the chart area): what the zoom fits into. */
function useParentSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const parent = ref.current?.parentElement;
    if (!parent) return;
    const ro = new ResizeObserver(([e]) => setSize({ width: Math.floor(e.contentRect.width), height: Math.floor(e.contentRect.height) }));
    ro.observe(parent);
    return () => ro.disconnect();
  }, []);
  return [ref, size] as const;
}

export function Chart({ progression, caret, onSlotClick, onEventClick, onTimeClick, onChordCommit, onScaleChange, editRequest, selection, onBarSelect, onBarAction, onAppendBar, canPaste, playIndex = null, stand = false }: ChartProps) {
  const playing = playIndex !== null;
  /** Play and Stand both hide the caret, bar handles, "+" and editing. */
  const readOnly = playing || stand;
  const { bars, barsPerRow, timeSignature } = progression;
  const [fitRef, area] = useParentSize<HTMLDivElement>();
  const chartRef = useRef<HTMLDivElement>(null);
  const layout = layoutMeter(timeSignature);
  const slots = slotsOf(bars, layout);
  const activeSlot = stand ? -1 : playing ? playIndex : (slotAt(slots, caret)?.index ?? 0);
  const [editing, setEditing] = useState<{ bar: number; part: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inst = instrumentOf(progression.instrument);
  const clef = clefOf(inst, progression.concertClef);

  const rows: FormSlot[][] = [];
  for (const s of slots) (rows[Math.floor(s.bar / barsPerRow)] ??= []).push(s);

  // Chart zoom (SPEC §3.1): lay out at logical width area/z, scale by z. Fit every row, capped at 1.4×, floor 0.5.
  const staveHeight = staveMetrics().height;
  const { zoom, scrolls } = fitZoom(rows.length, staveHeight, area.height, stand ? 0 : undefined);
  const header = headerPx(zoom);
  const zoomStyle = {
    width: area.width / zoom,
    transform: `scale(${zoom})`,
    gap: ROW_GAP_PX,
    '--chord-px': `${labelPx(CHORD_PX, MIN_CHORD_PX, zoom)}px`,
    '--scale-px': `${labelPx(SCALE_PX, MIN_SCALE_PX, zoom)}px`,
  } as CSSProperties;

  // Below the floor the chart scrolls, keeping the caret's row in view.
  useEffect(() => {
    if (!scrolls) return;
    chartRef.current?.querySelector('.slot.active')?.scrollIntoView({ block: 'nearest' });
  }, [scrolls, caret, zoom, playIndex]);

  const startEditing = (target: { bar: number; part: number } | null) => {
    setError(null);
    setEditing(target);
  };

  useEffect(() => {
    if (editRequest) startEditing({ bar: editRequest.bar, part: editRequest.part });
  }, [editRequest]);

  /** Returns false when the text was refused and the field should stay open. */
  const commit = (slot: FormSlot, text: string, move: -1 | 1 | null): boolean => {
    const r = onChordCommit(slot.bar, slot.part, text);
    if (!r.ok) {
      if (move === null) startEditing(null); // blur: discard, nothing committed
      else setError(r.message);
      return r.ok || move === null;
    }
    const b = r.progression.bars;
    if (move === 1) {
      const part = r.lastPart + 1;
      startEditing(part < b[slot.bar].length ? { bar: slot.bar, part } : slot.bar + 1 < b.length ? { bar: slot.bar + 1, part: 0 } : null);
    } else if (move === -1) {
      startEditing(slot.part > 0 ? { bar: slot.bar, part: slot.part - 1 } : slot.bar > 0 ? { bar: slot.bar - 1, part: b[slot.bar - 1].length - 1 } : null);
    } else startEditing(null);
    return true;
  };

  return (
    <div ref={fitRef} className="chart-fit" style={{ height: chartHeight(rows.length, staveHeight, zoom) }} data-zoom={zoom.toFixed(3)}>
    <div ref={chartRef} className="chart" aria-label="Chart" style={area.width ? zoomStyle : { visibility: 'hidden' }}>
      {rows.map((row, r) => (
        <div
          className="chart-row"
          key={r}
          style={{ gridTemplateColumns: `${GUTTER_WIDTH}px repeat(${barsPerRow * 2}, minmax(0, 1fr))` }}
        >
          <div className="clef-gutter" style={{ paddingTop: header }}>
            <ClefGutter width={GUTTER_WIDTH} clef={clef} />
          </div>
          {row.map((slot) => (
            <SlotView
              key={slot.index}
              slot={slot}
              data={bars[slot.bar][slot.part]}
              active={slot.index === activeSlot}
              onActivate={stand ? () => {} : () => onSlotClick(slot)}
              clef={clef}
              inst={inst}
              melody={progression.melody}
              caret={!readOnly && slot.index === activeSlot ? caret : undefined}
              playing={playing}
              onEventClick={stand ? undefined : onEventClick}
              onTimeClick={stand ? undefined : onTimeClick}
              span={2 / bars[slot.bar].length}
              layout={layout}
              header={header}
              showTimeSignature={slot.index === 0}
              barTools={
                !readOnly && slot.part === 0
                  ? {
                      selected: !!selection && slot.bar >= selection.from && slot.bar <= selection.to,
                      split: bars[slot.bar].length === 2,
                      canPaste,
                      canDelete: bars.length - (selection && slot.bar >= selection.from && slot.bar <= selection.to ? selection.to - selection.from + 1 : 1) >= 1,
                      onSelect: onBarSelect,
                      onAction: onBarAction,
                    }
                  : null
              }
              inSelection={!!selection && slot.bar >= selection.from && slot.bar <= selection.to}
              onAppend={!readOnly && slot.index === slots.length - 1 ? onAppendBar : undefined}
              editing={editing?.bar === slot.bar && editing.part === slot.part}
              error={error}
              onEdit={stand ? undefined : playing ? () => onSlotClick(slot) : () => startEditing({ bar: slot.bar, part: slot.part })}
              onCommit={(text, move) => commit(slot, text, move)}
              onScaleChange={readOnly ? undefined : (scale) => onScaleChange(slot.bar, slot.part, scale)}
            />
          ))}
        </div>
      ))}
    </div>
    </div>
  );
}

interface SlotViewProps {
  slot: FormSlot;
  data: Slot;
  active: boolean;
  onActivate: () => void;
  clef: 'treble' | 'bass';
  /** The instrument view: labels, spelling and notation in written pitch (SPEC §10). */
  inst: Instrument;
  melody: Progression['melody'];
  caret?: number;
  /** Play mode: the active slot gets the solid "current slot" highlight. */
  playing: boolean;
  onEventClick?: (e: TimedEvent) => void;
  onTimeClick?: (t: number) => void;
  span: number;
  /** The layout meter (bad time signatures lay out as 4/4). */
  layout: Meter;
  /** Logical header height (grows as the zoom shrinks, for the label minimums). */
  header: number;
  /** Bar number + ⋯ handle, on the bar's first slot. */
  barTools: { selected: boolean; split: boolean; canPaste: boolean; canDelete: boolean; onSelect: (bar: number, extend: boolean) => void; onAction: (bar: number, action: BarAction) => void } | null;
  inSelection: boolean;
  /** On the last slot: the "+" that appends a bar. */
  onAppend?: () => void;
  /** The first slot carries the time signature. */
  showTimeSignature: boolean;
  editing: boolean;
  error: string | null;
  onEdit?: () => void;
  onCommit: (text: string, move: -1 | 1 | null) => boolean;
  onScaleChange?: (scale: ScaleId | null) => void;
}

function SlotView({ slot, data, active, onActivate, clef, inst, melody, caret, playing, onEventClick, onTimeClick, span, layout, header, barTools, inSelection, onAppend, showTimeSignature, editing, error, onEdit, onCommit, onScaleChange }: SlotViewProps) {
  // Everything shown runs against the written chord; the stored melody stays concert (SPEC §5.3, §10).
  const chord = writtenChord(data.chord, inst);
  const harmony = slotHarmony({ ...data, chord });
  const spelling = slotSpelling(harmony);
  const spell = (midi: number) => noteName(midi + inst.semitones, spelling);
  const [ref, width] = useWidth<HTMLDivElement>();
  const { staffTop, staffBottom } = staveMetrics();
  // Unparseable time signatures are shown in the rail as typed; the stave shows (and beams by) the layout meter.
  const meter = showTimeSignature ? layout : undefined;
  /** Marks against this (owning) slot's written harmony (SPEC §7.2). */
  const markOf = (e: TimedEvent) => ('pitch' in e.ev ? noteMark(e.ev.pitch + inst.semitones, harmony, chord, inst) : null);

  return (
    <div
      className={['slot', active && 'active', active && playing && 'playing', inSelection && 'bar-selected'].filter(Boolean).join(' ')}
      style={{ gridColumn: `span ${span}` }}
      data-slot={slot.index}
      onPointerDown={(e) => {
        // Notes handle their own click (a redraw here would remove the note before its click fires).
        if (!(e.target as Element).closest('button, input, .scale-menu, .melody-event')) onActivate();
      }}
    >
      {barTools && <BarHandle bar={slot.bar} {...barTools} />}
      {onAppend && (
        <button type="button" className="append-bar" title="Add a bar" aria-label="Add a bar" onClick={onAppend}>
          +
        </button>
      )}
      <div className="slot-header" style={{ height: header }}>
        {editing ? (
          <ChordField initial={chord} error={error} onCommit={onCommit} />
        ) : (
          <ChordLabel chord={chord} harmony={harmony} bar={slot.bar} part={slot.part} onEdit={onEdit} />
        )}
        <ScaleLabel harmony={harmony} bar={slot.bar} onPick={onScaleChange} />
      </div>
      <div ref={ref} className="slot-body">
        <SlotStave
          width={width}
          timeSignature={meter && `${meter.beats}/${meter.unit}`}
          clef={clef}
          start={slot.start}
          end={slot.end}
          events={eventsForSlot(melody, slot)}
          spell={spell}
          caret={caret}
          onEventClick={onEventClick}
          onTimeClick={onTimeClick}
          meter={layout}
          markOf={markOf}
        />
      </div>
      <div
        className={slot.barEnd ? 'bar-line' : 'slot-divider'}
        style={{ top: header + staffTop, height: staffBottom - staffTop }}
      />
    </div>
  );
}

/** Tooltip text: `Dm7 → D F A C · D Dorian` (SPEC §4.2). */
function tooltip(chord: string, h: SlotHarmony): string {
  const base = interpretation(chord);
  if (h.kind === 'none') return base;
  return `${base} · ${h.scale ? `${scaleLabel(h.root, h.scale)}${h.overridden ? ' (override)' : ''}` : 'no scale fits'}`;
}

interface ChordLabelProps {
  chord: string;
  harmony: SlotHarmony;
  bar: number;
  part: number;
  onEdit?: () => void;
}

function ChordLabel({ chord, harmony, bar, part, onEdit }: ChordLabelProps) {
  const overridden = harmony.kind === 'chord' && harmony.overridden;
  const kind = parseChord(chord).kind;
  const tipId = `chord-tip-${bar}-${part}`;
  const cls = ['chord-label', kind === 'empty' && 'empty', kind === 'invalid' && 'invalid'].filter(Boolean).join(' ');
  return (
    <span className="chord-wrap">
      <button
        type="button"
        className={cls}
        onClick={onEdit}
        disabled={!onEdit}
        aria-label={chord ? `Chord ${chord}, bar ${bar + 1}` : `Add chord, bar ${bar + 1}`}
        aria-describedby={tipId}
      >
        {chord || '+'}
      </button>
      {overridden && <span className="override-dot" aria-hidden title="Scale override" />}
      <span role="tooltip" id={tipId} className="chord-tip">
        {tooltip(chord, harmony)}
      </span>
    </span>
  );
}
