/**
 * The mark: two rules and three pills, wood brown deepening to ink (the favicon's mark too; see app/icon.svg).
 * Measured from the original artwork: 586 × 736 units, 55-unit gaps.
 */
export default function Logo({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 586 736" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="logo-wood" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#8b5e3c" />
          <stop offset="0.5" stopColor="#734e33" />
          <stop offset="1" stopColor="#2a1f16" />
        </linearGradient>
      </defs>
      <g fill="url(#logo-wood)">
        <rect x="0" y="0" width="586" height="20" />
        <rect x="0" y="75" width="586" height="160" rx="80" />
        <rect x="0" y="289" width="495" height="160" rx="80" />
        <rect x="0" y="502" width="586" height="160" rx="80" />
        <rect x="0" y="716" width="586" height="20" />
      </g>
    </svg>
  );
}
