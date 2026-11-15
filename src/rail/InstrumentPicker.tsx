// The header's **Ins:** instrument picker (SPEC §3.1, §10), with Concert's clef choice before it (§7.3).
import { INSTRUMENTS } from '../instruments';

export interface InstrumentPickerProps {
  instrument: string;
  concertClef: 'treble' | 'bass';
  onInstrument: (id: string) => void;
  onConcertClef: (clef: 'treble' | 'bass') => void;
}

export function InstrumentPicker({ instrument, concertClef, onInstrument, onConcertClef }: InstrumentPickerProps) {
  return (
    <div className="instrument-picker">
      {instrument === 'concert' && (
        <label className="rail-setting">
          <span className="rail-label">Clef</span>
          <select
            className="rail-select"
            value={concertClef}
            onChange={(e) => onConcertClef(e.target.value === 'bass' ? 'bass' : 'treble')}
          >
            <option value="treble">Treble</option>
            <option value="bass">Bass</option>
          </select>
        </label>
      )}
      <span className="rail-label ins-label">Ins:</span>
      <select className="rail-select instrument-select" aria-label="Instrument" value={instrument} onChange={(e) => onInstrument(e.target.value)}>
        {INSTRUMENTS.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
    </div>
  );
}
