// The header's **Ins:** instrument picker (SPEC §3.1, §10), with the clef choice beside it (§7.3).
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
      <select className="rail-select instrument-select" aria-label="Instrument" value={instrument} onChange={(e) => onInstrument(e.target.value)}>
        {INSTRUMENTS.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
          </option>
        ))}
      </select>
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
    </div>
  );
}
