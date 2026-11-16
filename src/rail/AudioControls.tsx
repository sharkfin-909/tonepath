// Sound buttons in the header's sound pill (SPEC §3.1, §9): mute (speaker, ⇧M), ▶ Chord (C), ▶ Bass (B), ▶ Scale (S / ⇧Space).
// (The `rail/` folder holds the header's controls; the name dates from the old left-hand control rail.)
export interface AudioControlsProps {
  muted: boolean;
  onToggleMute: () => void;
  onChord: () => void;
  onBass: () => void;
  onScale: () => void;
  /** Tune (SPEC §3.8): no chord — ▶ Chord / Bass / Scale greyed. */
  noChord?: boolean;
}

export function AudioControls({ muted, onToggleMute, onChord, onBass, onScale, noChord = false }: AudioControlsProps) {
  return (
    <div className="audio-controls">
      <button
        type="button"
        className={muted ? 'rail-button chip mute on' : 'rail-button chip mute'}
        aria-pressed={muted}
        title={muted ? 'Sound off (⇧M)' : 'Sound on (⇧M)'}
        onClick={onToggleMute}
      >
        <span aria-hidden>{muted ? '🔇' : '🔊'}</span> {muted ? 'Muted' : 'Sound'}
      </button>
      <button type="button" className="rail-button chip" title="Play the chord (C)" disabled={noChord} onClick={onChord}>
        ▶ Chord
      </button>
      <button type="button" className="rail-button chip" title="Play the bass (B)" disabled={noChord} onClick={onBass}>
        ▶ Bass
      </button>
      <button type="button" className="rail-button chip" title="Play the scale (S or ⇧Space)" disabled={noChord} onClick={onScale}>
        ▶ Scale
      </button>
    </div>
  );
}
