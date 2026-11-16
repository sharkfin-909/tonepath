// The chart (SPEC §3.1): rows of `barsPerRow` bars, a clef gutter per row, slots at time-proportional width.
import type { Clef } from '../instruments';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import type { FormSlot, Meter } from '../form';
import { eventsForSlot, type TimedEvent } from '../melody';
import { parseChord, interpretation } from '../chords';
import { scaleLabel, type ScaleId, type SlotHarmony } from '../harmony';
import type { ChordCommit, Progression } from '../progression';
import { ClefGutter, SlotStave, staveMetrics } from '../notation/Stave';
import type { InstrumentView, ViewSlot } from '../view';
import { ChordField } from './ChordField';
import { ScaleLabel } from './ScaleLabel';
import { BarHandle, type BarAction } from './BarHandle';

import { CHORD_PX, MIN_CHORD_PX, MIN_SCALE_PX, ROW_GAP_PX, SCALE_PX, chartHeight, fitZoom, headerPx, labelPx } from '../zoom';

const GUTTER_WIDTH = 46;

export interface ChartProps {
  progression: Progression;
  /** The progression in the instrument's written pitch (slots, chords, names, marks). */
  view: InstrumentView;
  /** Caret time (form ticks); its slot is the active slot (tinted; drives the docked hex). */
  caret: number;
  /** A click on a slot (caret placement). */
  onSlotClick: (slot: FormSlot) => void;
  /** A click on an engraved note or rest. */
  onEventClick: (e: TimedEvent) => void;
  /** A click on a stave away from the notes: the form time under the pointer. */
  onTimeClick: (t: number) => void;
  /** Apply typed chord text to a slot; returns the result (refused commits change nothing). */
  /** Chord entry (chordEntry.ts): the typed text for a slot → the commit result. */
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
  /** Practice, Follow the etude (SPEC §3.7): show the written melody in Play after all, the notes already played green. */
  follow?: { played: ReadonlySet<number> } | null;
  /** Practice: bar numbers (no menu) pick the bars to loop; `selection` is those bars. */
  practiceBars?: boolean;
  /** Play mode (SPEC §3.3): the current slot. The caret, bar handles and "+" are hidden; chords and scales stay editable. */
  playIndex?: number | null;
  /** Explore (SPEC §3.2): empty staves like Play, and no caret, bar handles or "+"; chords and scales stay editable. */
  explore?: boolean;
  /** Etude view (SPEC §3.4; `stand` in code): read-only, nothing highlighted or clickable, fit the page with no zoom floor. */
  stand?: boolean;
  /**
   * Height budget (rendered px) to fit the rows into, when the chart's own area sizes to its content (the chart
   * screen: the hex takes whatever the chart leaves). Without it the chart fits its parent's height.
   */
  maxHeight?: number;
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

export function Chart({ progression, view, caret, onSlotClick, onEventClick, onTimeClick, onChordCommit, onScaleChange, editRequest, selection, onBarSelect, onBarAction, onAppendBar, canPaste, playIndex = null, explore = false, stand = false, maxHeight, follow = null, practiceBars = false }: ChartProps) {
  const playing = playIndex !== null;
  /** Play, Explore and Etude view hide the caret, bar handles, trash cans and "+" (Play keeps chord and scale entry; Practice keeps bar numbers, to pick bars to loop). */
  const readOnly = playing || stand || explore;
  const { bars, barsPerRow } = progression;
  const [fitRef, area] = useParentSize<HTMLDivElement>();
  const chartRef = useRef<HTMLDivElement>(null);
  const { slots, meter: layout, clef, usedChords } = view;
  const activeSlot = stand ? -1 : playing ? playIndex : view.slotAt(caret).index;
  const [editing, setEditing] = useState<{ bar: number; part: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows: ViewSlot[][] = [];
  for (const s of slots) (rows[Math.floor(s.bar / barsPerRow)] ??= []).push(s);

  // Chart zoom (SPEC §3.1): lay out at logical width area/z, scale by z. Fit every row, capped at 1.4×, floor 0.5.
  const staveHeight = staveMetrics().height;
  const { zoom, scrolls } = fitZoom(rows.length, staveHeight, maxHeight ?? area.height, stand ? 0 : undefined);
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
              view={view}
              active={slot.index === activeSlot}
              onActivate={stand ? () => {} : () => onSlotClick(slot)}
              clef={clef}
              melody={progression.melody}
              caret={!readOnly && slot.index === activeSlot ? caret : undefined}
              playing={playing || explore}
              follow={follow}
              onEventClick={stand ? undefined : onEventClick}
              onTimeClick={stand ? undefined : onTimeClick}
              span={2 / bars[slot.bar].length}
              layout={layout}
              header={header}
              showTimeSignature={slot.index === 0}
              barTools={
                (!readOnly || practiceBars) && slot.part === 0
                  ? {
                      menu: !readOnly,
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
              onShiftSelect={!readOnly || practiceBars ? () => onBarSelect(slot.bar, true) : undefined}
              onDeleteBar={!readOnly && slot.barEnd && bars.length > 1 ? () => onBarAction(slot.bar, 'delete') : undefined}
              onAppend={!readOnly && slot.index === slots.length - 1 ? onAppendBar : undefined}
              editing={editing?.bar === slot.bar && editing.part === slot.part}
              error={error}
              usedChords={usedChords}
              onEdit={
                stand
                  ? undefined
                  : () => {
                      if (playing) onSlotClick(slot); // Play: the slot becomes current too
                      startEditing({ bar: slot.bar, part: slot.part }); // chord entry in Write and Play
                    }
              }
              onCommit={(text, move) => commit(slot, text, move)}
              onScaleChange={stand ? undefined : (scale) => onScaleChange(slot.bar, slot.part, scale)} // Write and Play
            />
          ))}
        </div>
      ))}
    </div>
    </div>
  );
}

interface SlotViewProps {
  slot: ViewSlot;
  view: InstrumentView;
  active: boolean;
  onActivate: () => void;
  clef: Clef;
  melody: Progression['melody'];
  caret?: number;
  /** Play mode: the active slot gets the solid "current slot" highlight. */
  playing: boolean;
  follow: { played: ReadonlySet<number> } | null;
  onEventClick?: (e: TimedEvent) => void;
  onTimeClick?: (t: number) => void;
  span: number;
  /** The layout meter (bad time signatures lay out as 4/4). */
  layout: Meter;
  /** Logical header height (grows as the zoom shrinks, for the label minimums). */
  header: number;
  /** Bar number + ⋯ handle, on the bar's first slot. */
  barTools: { menu: boolean; selected: boolean; split: boolean; canPaste: boolean; canDelete: boolean; onSelect: (bar: number, extend: boolean) => void; onAction: (bar: number, action: BarAction) => void } | null;
  inSelection: boolean;
  /** Write: ⇧-click anywhere in the bar extends the bar selection to it (instead of moving the caret). */
  onShiftSelect?: () => void;
  /** On a bar's last slot: the trash can at its bottom right that deletes the bar (the selection, if it's in one). */
  onDeleteBar?: () => void;
  /** On the last slot: the "+" that appends a bar. */
  onAppend?: () => void;
  /** The first slot carries the time signature. */
  showTimeSignature: boolean;
  editing: boolean;
  error: string | null;
  onEdit?: () => void;
  onCommit: (text: string, move: -1 | 1 | null) => boolean;
  usedChords: string[];
  onScaleChange?: (scale: ScaleId | null) => void;
}

const NO_EVENTS: TimedEvent[] = [];

function SlotView({ slot, view, active, onActivate, clef, melody, caret, playing, follow, onEventClick, onTimeClick, span, layout, header, barTools, inSelection, onShiftSelect, onDeleteBar, onAppend, showTimeSignature, editing, error, usedChords, onEdit, onCommit, onScaleChange }: SlotViewProps) {
  // Everything shown runs against the written chord; the stored melody stays concert (SPEC §5.3, §10).
  const { chord, harmony } = slot;
  const spell = (midi: number) => view.name(midi, slot);
  const [ref, width] = useWidth<HTMLDivElement>();
  const { staffTop, staffBottom } = staveMetrics();
  // Unparseable time signatures are shown in the header as typed; the stave shows (and beams by) the layout meter.
  const meter = showTimeSignature ? layout : undefined;
  /** Marks against this (owning) slot's written harmony (SPEC §7.2). */
  const markOf = (e: TimedEvent) => ('pitch' in e.ev ? view.mark(e.ev.pitch, slot) : null);

  return (
    <div
      className={['slot', active && 'active', active && playing && 'playing', inSelection && 'bar-selected'].filter(Boolean).join(' ')}
      // --staff-top: where the stave's top line sits in the slot; the bar number sits just above it (CSS .bar-handle).
      style={{ gridColumn: `span ${span}`, ['--staff-top' as string]: `${header + staffTop}px` }}
      data-slot={slot.index}
      // ⇧-click (Write): extend the bar selection to this bar — caught before notes, the stave or the chord see it.
      onClickCapture={(e) => {
        if (!e.shiftKey || !onShiftSelect || (e.target as Element).closest('.bar-menu, input')) return;
        e.stopPropagation();
        e.preventDefault();
        onShiftSelect();
      }}
      // …and its press is kept from the stave (which moves the caret on pointerdown) and from text selection.
      onPointerDownCapture={(e) => {
        if (e.shiftKey && onShiftSelect && !(e.target as Element).closest('.bar-menu, input')) e.stopPropagation();
      }}
      onMouseDownCapture={(e) => {
        if (!e.shiftKey || !onShiftSelect || (e.target as Element).closest('.bar-menu, input')) return;
        e.stopPropagation();
        e.preventDefault();
      }}
      onPointerDown={(e) => {
        // Notes handle their own click (a redraw here would remove the note before its click fires).
        if (!(e.target as Element).closest('button, input, .scale-menu, .melody-event, .chord-suggest')) onActivate();
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
          <ChordField initial={chord} error={error} onCommit={onCommit} used={usedChords} inKey={view.keyChords(slot.index).map((k) => k.symbol)} />
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
          // Play: an empty stave to play over (SPEC §3.3) — unless Practice follows the etude (§3.7).
          events={playing && !follow ? NO_EVENTS : eventsForSlot(melody, slot)}
          played={follow?.played}
          spell={spell}
          caret={caret}
          onEventClick={onEventClick}
          onTimeClick={onTimeClick}
          meter={layout}
          markOf={markOf}
        />
      </div>
      {onDeleteBar && (
        <button
          type="button"
          className="delete-bar"
          title={inSelection ? 'Delete the selected bars' : 'Delete this bar'}
          aria-label={inSelection ? 'Delete the selected bars' : 'Delete this bar'}
          onClick={onDeleteBar}
        >
          <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden>
            <path
              d="M2.5 4h11M6 4V2.5h4V4M4 4l.7 9.5h6.6L12 4M6.6 6.5v5M9.4 6.5v5"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      )}
      {/* A bar line at the end of each bar; nothing between two chords in a bar (a chord change, not a bar). */}
      {slot.barEnd && <div className="bar-line" style={{ top: header + staffTop, height: staffBottom - staffTop }} />}
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
