// Improvise's lead sheet (SPEC §3.3): in place of the stave, the slot's scale spelled from its root — chord tones as
// filled chips in their degree colour (the hex's), the guide tone ringed, other scale tones as outlined chips. Sized to
// the stave's height so rows keep their size and the zoom is unchanged.
import type { CSSProperties } from 'react';
import { DEGREE_COLOURS, inkOn } from '../hex';
import { leadTones } from '../leadSheet';
import type { SlotHarmony } from '../harmony';
import { prettyName } from '../spelling';
import { staveMetrics } from '../notation/Stave';

export function LeadTones({ harmony }: { harmony: SlotHarmony }) {
  const { height } = staveMetrics();
  const tones = leadTones(harmony);
  return (
    <div className="lead-tones" style={{ height }} aria-label={tones ? `Scale: ${tones.map((t) => t.name).join(' ')}` : undefined}>
      {tones && (
        <span className="lead-tones-row">
          {tones.map((t, i) => {
            const colour = DEGREE_COLOURS[t.degree - 1];
            const style = { '--deg': colour, '--deg-ink': inkOn(colour) } as CSSProperties;
            return (
              <span key={i} className={`lead-tone ${t.role}`} style={style} title={t.role === 'scale' ? 'Scale tone' : t.role === 'guide' ? 'Guide tone' : 'Chord tone'}>
                {prettyName(t.name)}
              </span>
            );
          })}
        </span>
      )}
    </div>
  );
}
