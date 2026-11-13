// Notation fonts are bundled with the app (SPEC §2): never loaded from a CDN.
import { Font, VexFlow } from 'vexflow/core';
import bravuraUrl from '@vexflow-fonts/bravura/bravura.woff2?url';
import academicoUrl from '@vexflow-fonts/academico/academico.woff2?url';

let ready: Promise<void> | null = null;

/** Load Bravura + Academico from local files, tell VexFlow to use them, and wait for the document's fonts. */
export function loadNotationFonts(): Promise<void> {
  ready ??= (async () => {
    await Promise.all([Font.load('Bravura', bravuraUrl), Font.load('Academico', academicoUrl)]);
    VexFlow.setFonts('Bravura', 'Academico');
    await document.fonts.ready;
  })();
  return ready;
}
