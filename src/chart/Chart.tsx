// The chart (SPEC §3.1): rows of `barsPerRow` bars, a clef gutter per row, slots at time-proportional width.
import type { Clef } from '../instruments';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
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
import { LeadTones } from './LeadTones';
import { keyName, keyOf, sameKey } from '../key';
import { prettyName } from '../spelling';

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
  /** The × after a chord: clear the slot's chord (one undo step). Where chords are editable. */
  onChordClear?: (bar: number, part: number) => void;
  /** Open a slot's chord field from outside (the dock label); `n` changes on every request. */
  editRequest?: { bar: number; part: number; n: number } | null;
  /** Bar selection (a run), for the bar handles and ⌘C / ⌘V / ⌘D / ⌫ (SPEC §4.1). */
  selection: { from: number; to: number } | null;
  onBarSelect: (bar: number, extend: boolean) => void;
  onBarAction: (bar: number, action: BarAction) => void;
  onAppendBar: () => void;
  /** Improvise / Read etude: remove the loop (the × at its end repeat) — back to the whole form. */
  onLoopClear?: () => void;
  canPaste: boolean;
  /**
   * The chart's mode (SPEC §3.0): Write etude (the caret, the bar menu); Improvise (a lead sheet — empty staves,
   * chords, scales and the form editable while stopped; bar numbers pick the looped bars); Read etude (the etude,
   * fitted to the page with no zoom floor; nothing edits; bar numbers pick the looped bars).
   */
  mode?: 'improvise' | 'write' | 'read';
  /** Improvise / Read etude: the current slot (the playhead), highlighted. */
  current?: number | null;
  /** The transport is running: nothing on the chart edits; in Read etude nothing is clickable. */
  running?: boolean;
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

export function Chart({ progression, view, caret, onSlotClick, onEventClick, onTimeClick, onChordCommit, onScaleChange, onChordClear, editRequest, selection, onBarSelect, onBarAction, onAppendBar, onLoopClear, canPaste, mode = 'write', current = null, running = false, maxHeight }: ChartProps) {
  const writing = mode === 'write';
  const read = mode === 'read';
  /** Read etude while running: nothing on the chart answers a click. */
  const inert = read && running;
  /** Chords, scales, "+" and the trash cans: Write etude, and Improvise while stopped. */
  const editsForm = writing || (mode === 'improvise' && !running);
  const { bars, barsPerRow } = progression;
  const [fitRef, area] = useParentSize<HTMLDivElement>();
  const chartRef = useRef<HTMLDivElement>(null);
  const { slots, meter: layout, clef, usedChords } = view;
  const activeSlot = writing ? view.slotAt(caret).index : (current ?? -1);
  const [editing, setEditing] = useState<{ bar: number; part: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The key pill on each slot (SPEC §3.1), and the slots sharing the current slot's key — highlighted like it.
  const keys = useMemo(() => slots.map((s) => keyOf(s.harmony)), [slots]);
  const activeKey = activeSlot >= 0 ? keys[activeSlot] : null;

  const rows: ViewSlot[][] = [];
  for (const s of slots) (rows[Math.floor(s.bar / barsPerRow)] ??= []).push(s);

  // Chart zoom (SPEC §3.1): lay out at logical width area/z, scale by z. Fit every row, capped at 1.4×, floor 0.5.
  const staveHeight = staveMetrics().height;
  const { zoom, scrolls } = fitZoom(rows.length, staveHeight, maxHeight ?? area.height, read ? 0 : undefined);
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
  }, [scrolls, caret, zoom, current]);

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
            {/* Improvise's lead sheet has no stave, so no clef (SPEC §3.3). */}
            {mode !== 'improvise' && <ClefGutter width={GUTTER_WIDTH} clef={clef} />}
          </div>
          {row.map((slot) => (
            <SlotView
              key={slot.index}
              slot={slot}
              view={view}
              active={slot.index === activeSlot}
              onActivate={inert ? () => {} : () => onSlotClick(slot)}
              clef={clef}
              melody={progression.melody}
              caret={writing && slot.index === activeSlot ? caret : undefined}
              playing={!writing}
              keyLabel={keys[slot.index] && keyName(keys[slot.index]!)}
              keyMate={slot.index !== activeSlot && sameKey(keys[slot.index], activeKey)}
              hideMelody={mode === 'improvise'}
              onEventClick={inert ? undefined : onEventClick}
              onTimeClick={inert ? undefined : onTimeClick}
              span={2 / bars[slot.bar].length}
              layout={layout}
              header={header}
              showTimeSignature={slot.index === 0}
              barTools={
                !inert && slot.part === 0
                  ? {
                      menu: writing,
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
              loop={
                // Improvise / Read etude: the selection is the looped bars, drawn as one band with repeat signs (SPEC §3.7).
                !writing && selection && slot.bar >= selection.from && slot.bar <= selection.to
                  ? {
                      start: slot.bar === selection.from && slot.part === 0,
                      end: slot.bar === selection.to && slot.barEnd,
                      onClear: inert ? undefined : onLoopClear,
                    }
                  : null
              }
              onShiftSelect={!inert ? () => onBarSelect(slot.bar, true) : undefined}
              onDeleteBar={editsForm && slot.barEnd && bars.length > 1 ? () => onBarAction(slot.bar, 'delete') : undefined}
              onAppend={editsForm && slot.index === slots.length - 1 ? onAppendBar : undefined}
              editing={editing?.bar === slot.bar && editing.part === slot.part}
              error={error}
              usedChords={usedChords}
              onEdit={
                editsForm
                  ? () => {
                      if (!writing) onSlotClick(slot); // Improvise: the slot becomes current too
                      startEditing({ bar: slot.bar, part: slot.part }); // chord entry in Write etude and Improvise
                    }
                  : undefined
              }
              onCommit={(text, move) => commit(slot, text, move)}
              onClear={editsForm && onChordClear && slot.data.chord !== '' ? () => onChordClear(slot.bar, slot.part) : undefined}
              onScaleChange={editsForm ? (scale) => onScaleChange(slot.bar, slot.part, scale) : undefined} // Write etude and Improvise
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
  /** Improvise / Read etude: the active slot gets the solid "current slot" highlight. */
  playing: boolean;
  /** The key pill's text (the parent scale's name), or null (no scale). */
  keyLabel: string | null;
  /** Shares the current slot's key: its key pill lights like the current slot's (the slot itself isn't tinted). */
  keyMate: boolean;
  /** Improvise: the lead sheet — the slot's chord and scale tones in place of the stave. */
  hideMelody: boolean;
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
  /** Part of the loop (Improvise / Read etude): its first slot carries the start repeat, its last the end repeat and the ×. */
  loop: { start: boolean; end: boolean; onClear?: () => void } | null;
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
  /** The × after the chord: clear it. */
  onClear?: () => void;
  usedChords: string[];
  onScaleChange?: (scale: ScaleId | null) => void;
}

function SlotView({ slot, view, active, onActivate, clef, melody, caret, playing, keyLabel, keyMate, hideMelody, onEventClick, onTimeClick, span, layout, header, barTools, inSelection, loop, onShiftSelect, onDeleteBar, onAppend, showTimeSignature, editing, error, usedChords, onEdit, onCommit, onClear, onScaleChange }: SlotViewProps) {
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
      className={['slot', active && 'active', keyMate && 'key-mate', (active || keyMate) && playing && 'playing', inSelection && !loop && 'bar-selected', loop && 'looped', loop?.start && 'loop-start', loop?.end && 'loop-end'].filter(Boolean).join(' ')}
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
      {keyLabel && (
        // The key pill (SPEC §3.1): the key this slot's scale belongs to; lit on the current slot and its key mates (only the pill).
        <span className={['key-pill', onAppend && 'beside-append'].filter(Boolean).join(' ')} title={`Key: ${prettyName(keyLabel)}`}>
          {prettyName(keyLabel)}
        </span>
      )}
      <div className="slot-header" style={{ height: header }}>
        {editing ? (
          <ChordField initial={chord} error={error} onCommit={onCommit} used={usedChords} inKey={view.keyChords(slot.index).map((k) => k.symbol)} />
        ) : (
          <ChordLabel chord={chord} harmony={harmony} bar={slot.bar} part={slot.part} onEdit={onEdit} onClear={onClear} />
        )}
        <ScaleLabel harmony={harmony} bar={slot.bar} onPick={onScaleChange} />
      </div>
      <div ref={ref} className="slot-body">
        {hideMelody ? (
          // Improvise (SPEC §3.3): the slot's scale, chord tones marked, where the stave would be.
          <LeadTones harmony={harmony} />
        ) : (
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
        )}
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
      {/* The loop's repeat signs (SPEC §3.7): [: at its first bar line, :] and the × (stop looping) at its last. */}
      {loop?.start && <RepeatSign side="start" top={header + staffTop} height={staffBottom - staffTop} />}
      {loop?.end && <RepeatSign side="end" top={header + staffTop} height={staffBottom - staffTop} />}
      {loop?.end && loop.onClear && (
        <button
          type="button"
          className="loop-clear"
          style={{ top: header + staffTop }}
          title="Stop looping: back to the whole form (Esc)"
          aria-label="Stop looping"
          onClick={loop.onClear}
        >
          <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden>
            <path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
        </button>
      )}
      {/* A bar line at the end of each bar; nothing between two chords in a bar (a chord change, not a bar). */}
      {slot.barEnd && <div className={hideMelody ? 'bar-line lead' : 'bar-line'} style={{ top: header + staffTop, height: staffBottom - staffTop }} />}
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
  onClear?: () => void;
}

function ChordLabel({ chord, harmony, bar, part, onEdit, onClear }: ChordLabelProps) {
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
      {onClear && (
        // Clear the chord (SPEC §4.2): faint until the slot is hovered or current, like the bar's trash can.
        <button type="button" className="chord-clear" aria-label={`Clear chord ${chord}, bar ${bar + 1}`} onClick={onClear}>
          <svg viewBox="0 0 12 12" width="9" height="9" aria-hidden>
            <path d="M3 3l6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      )}
      <span role="tooltip" id={tipId} className="chord-tip">
        {tooltip(chord, harmony)}
      </span>
    </span>
  );
}

/** A repeat sign over the stave's height: start `[:` (thick, thin, dots) or end `:]` (dots, thin, thick). */
function RepeatSign({ side, top, height }: { side: 'start' | 'end'; top: number; height: number }) {
  const x = side === 'start' ? { thick: 0, thin: 7, dots: 14 } : { thick: 15, thin: 11, dots: 6 };
  return (
    <svg className={`repeat-sign ${side}`} style={{ top, height }} viewBox="0 0 20 40" preserveAspectRatio="none" aria-hidden>
      <rect x={x.thick} y={0} width={5} height={40} />
      <rect x={x.thin} y={0} width={2} height={40} />
      <circle cx={x.dots} cy={14.5} r={3} />
      <circle cx={x.dots} cy={25.5} r={3} />
    </svg>
  );
}
