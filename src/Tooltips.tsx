// App tooltips (SPEC §3.1): any element with a `title` shows it in a small dark label just under it, ~300 ms after the
// pointer comes to rest on it — reliably, icon buttons included (the browser's own tooltip is slow and easily missed).
// While shown, the `title` is parked in `data-title` so the browser's tooltip doesn't appear as well.
import { useEffect, useState } from 'react';

const DELAY_MS = 300;

export function Tooltips() {
  const [tip, setTip] = useState<{ text: string; x: number; y: number; above: boolean } | null>(null);
  useEffect(() => {
    let el: HTMLElement | null = null;
    let timer = 0;
    const restore = () => {
      window.clearTimeout(timer);
      if (el?.dataset.title !== undefined) {
        // Put it back — unless React gave the element a new title meanwhile (e.g. Sound on → off).
        if (!el.getAttribute('title')) el.setAttribute('title', el.dataset.title);
        delete el.dataset.title;
      }
      el = null;
      setTip(null);
    };
    const over = (e: PointerEvent) => {
      const t = (e.target as Element | null)?.closest?.('[title], [data-title]');
      if (t === el) return;
      restore();
      if (!(t instanceof HTMLElement) || !t.getAttribute('title')) return;
      el = t;
      const text = t.getAttribute('title')!;
      t.dataset.title = text;
      t.removeAttribute('title');
      timer = window.setTimeout(() => {
        if (el !== t || !t.isConnected) return;
        const r = t.getBoundingClientRect();
        // Under the element; above it when there's no room below (the hex panel's bottom corner).
        const above = r.bottom + 44 > window.innerHeight;
        setTip({ text, x: r.left + r.width / 2, y: above ? r.top - 6 : r.bottom + 6, above });
      }, DELAY_MS);
    };
    document.addEventListener('pointerover', over);
    document.addEventListener('pointerdown', restore);
    window.addEventListener('blur', restore);
    window.addEventListener('scroll', restore, true);
    return () => {
      restore();
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerdown', restore);
      window.removeEventListener('blur', restore);
      window.removeEventListener('scroll', restore, true);
    };
  }, []);
  if (!tip) return null;
  // Kept on screen: centred under the element, clamped to the window's edges by CSS (max-width) and here (left).
  const left = Math.min(Math.max(tip.x, 140), window.innerWidth - 140);
  return (
    <div className={tip.above ? 'app-tooltip above' : 'app-tooltip'} role="tooltip" style={{ left, top: tip.y }}>
      {tip.text}
    </div>
  );
}
