// Rail audio controls (SPEC §3.1, §9): mute (speaker, M), ▶ Chord (Space), ▶ Scale (⇧Space).
export interface AudioControlsProps {
  muted: boolean;
  onToggleMute: () => void;
  onChord: () => void;
  onScale: () => void;
}

export function AudioControls({ muted, onToggleMute, onChord, onScale }: AudioControlsProps) {
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
      <button type="button" className="rail-button" title="Play the chord (Space)" onClick={onChord}>
        ▶ Chord
      </button>
      <button type="button" className="rail-button" title="Play the scale (⇧Space)" onClick={onScale}>
        ▶ Scale
      </button>
    </div>
  );
}
