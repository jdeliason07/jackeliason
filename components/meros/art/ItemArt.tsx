import { itemById } from "@/lib/meros/content/items";

const INK = "#0e0e10";
const st = { stroke: INK, strokeWidth: 2.2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

/** Small original icon for any catalog item, on a rarity-tinted tile. */
export default function ItemArt({ itemId, className = "h-14 w-14" }: { itemId: string; className?: string }) {
  const item = itemById(itemId);
  if (!item) return null;
  const c = item.color;
  const tile = { common: "#26262b", uncommon: "#12291e", rare: "#16213b", legendary: "#2e2413" }[item.rarity];
  let glyph;
  if (item.kind === "cosmetic") {
    switch (item.slot) {
      case "outfit":
        glyph = <path d="M18 16 L26 12 Q32 16 38 12 L46 16 L50 26 L44 28 L44 50 L20 50 L20 28 L14 26 Z" fill={c} {...st} />;
        break;
      case "headwear":
        glyph = (
          <g>
            <ellipse cx={32} cy={40} rx={22} ry={6} fill={c} {...st} />
            <path d="M18 40 Q18 18 32 18 Q46 18 46 40 Z" fill={c} {...st} />
          </g>
        );
        break;
      case "handheld":
        glyph = <rect x={22} y={14} width={20} height={36} rx={4} fill={c} {...st} />;
        break;
      default:
        glyph = (
          <g>
            <circle cx={32} cy={32} r={14} fill={c} {...st} />
            <circle cx={32} cy={32} r={6} fill="#fff" opacity={0.7} />
          </g>
        );
    }
  } else if (item.kind === "decoration") {
    glyph = (
      <g>
        <rect x={16} y={42} width={32} height={8} rx={3} fill="#95D5B2" {...st} />
        <path d="M24 42 L32 18 L40 42 Z" fill={c} {...st} />
      </g>
    );
  } else {
    glyph = <path d="M32 12 L48 26 L42 50 L22 50 L16 26 Z" fill={c} {...st} />;
  }
  return (
    <svg viewBox="0 0 64 64" className={className} role="img" aria-label={item.name}>
      <rect x={2} y={2} width={60} height={60} rx={10} fill={tile} />
      {glyph}
    </svg>
  );
}
