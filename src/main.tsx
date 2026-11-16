import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Root } from './Root';
import { loadNotationFonts } from './notation/fonts';
import './pills.css';
import './styles.css';

const root = createRoot(document.getElementById('root')!);
root.render(<p className="boot">Loading notation…</p>);

// Bravura must be ready before the first stave is drawn (SPEC §7.1).
loadNotationFonts().then(
  () =>
    root.render(
      <StrictMode>
        <Root />
      </StrictMode>,
    ),
  (err) => root.render(<p className="boot">Couldn't load the notation fonts: {String(err)}</p>),
);
