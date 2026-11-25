/**
 * The brand's rising zigzag arrow, tone-on-tone, for red surfaces (splash, hero, victory). Purely
 * decorative; sits behind content.
 */
export default function RiseArrow({ className = "", opacity = 1 }: { className?: string; opacity?: number }) {
  return (
    <svg viewBox="0 0 400 300" preserveAspectRatio="xMaxYMax slice" className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} aria-hidden="true" style={{ opacity }}>
      <path d="M-20 300 L110 190 L170 230 L330 70 L300 56 L410 0 L398 118 L372 92 L178 286 L118 246 L20 330 Z" fill="#8a1316" opacity="0.55" />
      <path d="M-20 330 L128 214 L190 258 L380 92 L420 120 L420 330 Z" fill="#420003" opacity="0.5" />
    </svg>
  );
}
