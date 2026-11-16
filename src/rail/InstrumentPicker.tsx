// The header's **Ins:** instrument picker (SPEC §3.1, §10), with Concert's clef choice before it (§7.3).
import { INSTRUMENTS } from '../instruments';
import { Dropdown } from './Dropdown';

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
        <div className="rail-setting">
          <span className="pill-label">Clef</span>
          <Dropdown
            value={concertClef}
            label="Clef"
            options={[
              { value: 'treble', label: 'Treble' },
              { value: 'bass', label: 'Bass' },
            ]}
            onChange={onConcertClef}
          />
        </div>
      )}
      <span className="pill-label ins-label">Ins:</span>
      <Dropdown value={instrument} label="Instrument" className="instrument-select" options={INSTRUMENTS.map((i) => ({ value: i.id, label: i.name }))} onChange={onInstrument} />
    </div>
  );
}
