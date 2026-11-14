// Rail audio controls (SPEC §3.1, §9): mute (speaker, M), ▶ Chord (C), ▶ Bass (B), ▶ Scale (⇧Space).
export interface AudioControlsProps {
  muted: boolean;
  onToggleMute: () => void;
  onChord: () => void;
  onBass: () => void;
  onScale: () => void;
}

export function AudioControls({ muted, onToggleMute, onChord, onBass, onScale }: AudioControlsProps) {
  return (
    <div className="audio-controls">
      <button
        type="button"
        className={muted ? 'rail-button mute on' : 'rail-button mute'}
        aria-pressed={muted}
        title={muted ? 'Sound off (M)' : 'Sound on (M)'}
        onClick={onToggleMute}
      >
        <span aria-hidden>{muted ? '🔇' : '🔊'}</span> {muted ? 'Muted' : 'Sound'}
      </button>
      <button type="button" className="rail-button" title="Play the chord (C)" onClick={onChord}>
        ▶ Chord
      </button>
      <button type="button" className="rail-button" title="Play the bass (B)" onClick={onBass}>
        ▶ Bass
      </button>
      <button type="button" className="rail-button" title="Play the scale (⇧Space)" onClick={onScale}>
        ▶ Scale
      </button>
    </div>
  );
}
