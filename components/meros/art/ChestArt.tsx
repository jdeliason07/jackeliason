const INK = "#0e0e10";
const st = { stroke: INK, strokeWidth: 3, strokeLinejoin: "round" as const };

const GLOW: Record<string, string> = { common: "#b5b5b5", uncommon: "#5fd09a", rare: "#86a8ff", legendary: "#e6b85a" };

/** An original treasure chest. `open` swings the lid (animation skipped under reduced motion). */
export default function ChestArt({ open = false, rarity, className = "h-32 w-32", shake = false }: { open?: boolean; rarity?: string; className?: string; shake?: boolean }) {
  const glow = rarity ? GLOW[rarity] : null;
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={open ? `Opened chest${rarity ? `, ${rarity}` : ""}` : "Treasure chest"}>
      {glow && (
        <g className="meros-rays" style={{ transformOrigin: "60px 62px" }} opacity={0.55}>
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M60 62 L56 6 L64 6 Z" fill={glow} transform={`rotate(${i * 30} 60 62)`} />
          ))}
        </g>
      )}
      <g className={shake ? "meros-shake" : undefined} style={{ transformOrigin: "60px 96px" }}>
        <rect x={20} y={58} width={80} height={44} rx={6} fill="#5a1a1f" {...st} />
        <rect x={20} y={72} width={80} height={8} fill="#d1aa55" {...st} strokeWidth={2} />
        <rect x={52} y={66} width={16} height={20} rx={2} fill="#d1aa55" {...st} strokeWidth={2.4} />
        {open && glow && <ellipse cx={60} cy={60} rx={34} ry={8} fill={glow} opacity={0.9} />}
        <g className={open ? "meros-lid" : undefined} style={{ transformOrigin: "20px 58px" }}>
          <path d="M20 58 Q20 30 60 30 Q100 30 100 58 Z" fill="#8a0f1a" {...st} />
          <path d="M44 32 L44 58 M76 32 L76 58" stroke="#d1aa55" strokeWidth={5} />
        </g>
      </g>
    </svg>
  );
}
