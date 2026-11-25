const RED = "#761011";
const st = { stroke: RED, strokeWidth: 3, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/**
 * The chest, drawn in the two Meros tones: a white body outlined in red, a solid red lid. `open`
 * swings the lid and, with a rarity, turns slow red rays behind it (both skipped under reduced
 * motion). Rarity itself is announced in text by the caller, never by color.
 */
export default function ChestArt({ open = false, rarity, className = "h-32 w-32", shake = false }: { open?: boolean; rarity?: string; className?: string; shake?: boolean }) {
  return (
    <svg viewBox="0 0 120 120" className={className} role="img" aria-label={open ? `Opened chest${rarity ? `, ${rarity}` : ""}` : "Treasure chest"}>
      {open && rarity && (
        <g className="meros-rays" style={{ transformOrigin: "60px 62px" }}>
          {Array.from({ length: 12 }, (_, i) => (
            <path key={i} d="M60 62 L58 8 L62 8 Z" fill={RED} transform={`rotate(${i * 30} 60 62)`} />
          ))}
        </g>
      )}
      <g className={shake ? "meros-shake" : undefined} style={{ transformOrigin: "60px 96px" }}>
        <rect x={20} y={58} width={80} height={44} rx={6} fill="#fff" {...st} />
        <path d="M20 74 H100" {...st} />
        <rect x={53} y={66} width={14} height={18} rx={3} fill={RED} {...st} strokeWidth={2} />
        <g className={open ? "meros-lid" : undefined} style={{ transformOrigin: "20px 58px" }}>
          <path d="M20 58 Q20 30 60 30 Q100 30 100 58 Z" fill={RED} {...st} />
          <path d="M44 33 V58 M76 33 V58" stroke="#fff" strokeWidth={3} />
        </g>
      </g>
    </svg>
  );
}
