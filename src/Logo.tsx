/** The Tonepath mark: a small flat-top hexagon holding a note head, with the stem rising through its top edge and
 *  the flag wholly outside. Drawn in currentColor so it takes the wordmark's colour. Mirrors public/logo.svg. */
export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="3 0 120 120" aria-hidden="true" focusable="false">
      <polygon
        points="80,76 63,105.4 29,105.4 12,76 29,46.6 63,46.6"
        fill="none"
        stroke="currentColor"
        strokeWidth={6.5}
        strokeLinejoin="round"
      />
      <g fill="currentColor" transform="rotate(28 46 76)">
        <circle cx="46" cy="76" r="12" />
        <rect x="53.5" y="-1" width="4.5" height="74" rx="1" />
        <path d="M58 -1 C61.5 11 87.5 14 99.5 26 C108.5 35 109.5 45 104.5 53 C103.5 44 98.5 36 89.5 31 C80.5 26 67.5 24 58 23 Z" />
      </g>
    </svg>
  );
}
