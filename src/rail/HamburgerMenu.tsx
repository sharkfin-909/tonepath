// The header's ☰ menu (SPEC §3.1): the top right corner, right of the mode panel. The icon is TrueLathe's: three
// hairline lines on a 100×72 grid that morph — eased in — to one flat line (280 ms), then open into an X (320 ms),
// and back. A dark card under it holds the menu; Esc, a press outside or choosing an item closes it, and keys pressed
// in it never reach the chart.
import { useEffect, useRef, useState, type ReactNode } from 'react';

type Seg = [number, number, number, number]; // x1 y1 x2 y2

const LINES: Seg[] = [
  [10, 12, 90, 12],
  [10, 36, 90, 36],
  [10, 60, 90, 60],
];
const FLAT: Seg = [10, 36, 90, 36];
const X: Seg[] = [
  [30, 60, 70, 12],
  [30, 12, 70, 60],
];
const BURGER_MS = 280;
const X_MS = 320;

const easeIn = (t: number) => t * t; // mina.easein
const lerp = (a: Seg, b: Seg, t: number): Seg => a.map((v, i) => v + (b[i] - v) * t) as Seg;

/** Three segments drawn now: the burger, the flat line, or the X (the X's two lines + a hidden third). */
function useMorph(open: boolean): Seg[] {
  const [segs, setSegs] = useState<Seg[]>(open ? [...X, X[1]] : LINES);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const from = open ? LINES : [...X, X[1]];
    const to = open ? [...X, X[1]] : LINES;
    if (reduce) {
      setSegs(to);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const step = (now: number) => {
      const t = now - t0;
      if (t < BURGER_MS) {
        const k = easeIn(t / BURGER_MS);
        setSegs(from.map((s) => lerp(s, FLAT, k)));
      } else if (t < BURGER_MS + X_MS) {
        const k = easeIn((t - BURGER_MS) / X_MS);
        setSegs(to.map((s) => lerp(FLAT, s, k)));
      } else {
        setSegs(to);
        return;
      }
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [open]);
  return segs;
}

export interface MenuItem {
  label: string;
  onChoose: () => void;
  /** A small icon before the label. */
  icon?: ReactNode;
  /** A muted line under the label (Library: what's open, from tablet down). */
  detail?: string;
}

export function HamburgerMenu({ items, footer }: { items: MenuItem[]; footer?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const segs = useMorph(open);
  const wrap = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!open) return;
    setActive(0);
    list.current?.focus({ preventScroll: true });
    const away = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', away, true);
    return () => document.removeEventListener('pointerdown', away, true);
  }, [open]);

  const choose = (i: number) => {
    setOpen(false);
    items[i]?.onChoose();
  };

  return (
    <div className="hamburger" ref={wrap}>
      <button type="button" className="hamburger-button" aria-label={open ? 'Close menu' : 'Open menu'} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        <svg viewBox="0 0 100 72" width="44" height="34" aria-hidden>
          {segs.map(([x1, y1, x2, y2], i) => (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
          ))}
        </svg>
      </button>
      {open && (
        <div className="dropdown-menu compact right hamburger-menu" role="dialog" aria-label="Menu">
          <ul
            ref={list}
            role="menu"
            tabIndex={-1}
            onKeyDown={(e) => {
              e.stopPropagation(); // the chart's keys stay out of the menu
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                e.preventDefault();
                setActive((a) => Math.min(items.length - 1, Math.max(0, a + (e.key === 'ArrowDown' ? 1 : -1))));
              } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                choose(active);
              } else if (e.key === 'Escape' || e.key === 'Tab') {
                if (e.key === 'Escape') e.preventDefault();
                setOpen(false);
              }
            }}
          >
            {items.map((it, i) => (
              <li
                key={it.label}
                role="menuitem"
                className={['dropdown-option', i === active && 'active'].filter(Boolean).join(' ')}
                onPointerEnter={() => setActive(i)}
                onClick={() => choose(i)}
              >
                <span className="dropdown-option-head">
                  {it.icon}
                  <span className="dropdown-option-name">{it.label}</span>
                </span>
                {it.detail && <span className="hamburger-detail">{it.detail}</span>}
              </li>
            ))}
          </ul>
          {footer && <p className="dropdown-footer">{footer}</p>}
        </div>
      )}
    </div>
  );
}
