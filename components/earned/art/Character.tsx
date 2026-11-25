import type { ReactNode } from "react";
import { type Appearance, BACKGROUNDS } from "@/lib/earned/content/appearance";
import { itemById } from "@/lib/earned/content/items";
import type { EnergyBand } from "@/lib/earned/domain/momentum";

/**
 * The owner's character: original layered SVG (no photos, no external assets). Layers, back to
 * front: aura, coat-behind, back hair, legs, torso + outfit, equipped outfit overlay, arms, head,
 * face, hair, headwear, accessories, handheld item. Accomplishment shows through tailoring (outfits
 * unlocked by level), posture (straighter at higher level tiers), equipment, and flair. Low vitality
 * shows as tiredness (heavy eyelids, a slight slump, a cooler aura) and never as humiliation.
 */

const INK = "#2B2540";
const SHIRT = "#F7F8FC";

interface Props {
  appearance: Appearance;
  equipped?: string[];
  level: number;
  energy?: EnergyBand;
  className?: string;
  title?: string;
  /** Gentle idle bob (disabled under reduced motion via CSS). */
  animate?: boolean;
}

function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
  const r = clamp(((n >> 16) & 255) + amount);
  const g = clamp(((n >> 8) & 255) + amount);
  const b = clamp((n & 255) + amount);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

const s = { stroke: INK, strokeWidth: 2.5, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

function HairBack({ style, color }: { style: string; color: string }) {
  if (style === "long") return <path d="M60 74 Q56 30 100 30 Q144 30 140 74 L144 124 Q100 134 56 124 Z" fill={color} {...s} />;
  if (style === "coils") return <path d="M58 86 Q52 34 100 30 Q148 34 142 86 Q100 70 58 86 Z" fill={color} {...s} />;
  return null;
}

function HairFront({ style, color }: { style: string; color: string }) {
  const light = shade(color, 30);
  switch (style) {
    case "crew":
      return <path d="M64 66 Q66 36 100 34 Q134 36 136 66 Q122 52 100 51 Q78 52 64 66 Z" fill={color} {...s} />;
    case "buzz":
      return <path d="M66 62 Q70 38 100 37 Q130 38 134 62 Q100 50 66 62 Z" fill={color} {...s} opacity={0.92} />;
    case "curly":
      return (
        <g fill={color} {...s}>
          {[
            [68, 58], [80, 44], [96, 38], [112, 40], [126, 48], [134, 62], [74, 50], [104, 46], [118, 54], [88, 50],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={11} />
          ))}
        </g>
      );
    case "waves":
      return (
        <path
          d="M62 72 Q60 32 100 32 Q140 32 138 72 Q132 62 124 66 Q116 54 106 60 Q96 50 86 58 Q76 52 70 64 Q66 64 62 72 Z"
          fill={color}
          {...s}
        />
      );
    case "long":
      return <path d="M62 74 Q62 36 100 34 Q138 36 138 74 Q124 50 100 52 Q84 52 72 62 Q66 66 62 74 Z" fill={color} {...s} />;
    case "bun":
      return (
        <g>
          <circle cx={100} cy={30} r={13} fill={color} {...s} />
          <path d="M63 70 Q62 36 100 36 Q138 36 137 70 Q124 54 100 53 Q76 54 63 70 Z" fill={color} {...s} />
        </g>
      );
    case "coils":
      return (
        <g fill={color} {...s}>
          {[[70, 54], [84, 42], [100, 38], [116, 42], [130, 54], [62, 70], [138, 70], [92, 48], [108, 48]].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={9} />
          ))}
        </g>
      );
    case "sidepart":
      return (
        <g>
          <path d="M62 72 Q60 34 100 32 Q140 34 138 72 Q132 56 118 52 Q96 46 78 54 Q68 60 62 72 Z" fill={color} {...s} />
          <path d="M84 36 Q92 46 116 50" fill="none" stroke={light} strokeWidth={3} strokeLinecap="round" />
        </g>
      );
    default: // short
      return <path d="M62 72 Q60 34 100 32 Q140 34 138 72 Q128 52 100 50 Q72 52 62 72 Z" fill={color} {...s} />;
  }
}

function Face({ energy, skin }: { energy: EnergyBand; skin: string }) {
  const tired = energy === "tired" || energy === "drained";
  const lid = energy === "drained" ? 4.5 : energy === "tired" ? 2.5 : 0;
  return (
    <g>
      {/* eyes */}
      {[86, 114].map((x) => (
        <g key={x}>
          <ellipse cx={x} cy={80} rx={4.5} ry={5.5} fill={INK} />
          {!tired && <circle cx={x + 1.5} cy={78} r={1.5} fill="#fff" />}
          {lid > 0 && <rect x={x - 6} y={74} width={12} height={lid + 1} fill={skin} />}
          {lid > 0 && <line x1={x - 5.5} y1={74.5 + lid} x2={x + 5.5} y2={74.5 + lid} stroke={INK} strokeWidth={2} strokeLinecap="round" />}
        </g>
      ))}
      {/* brows */}
      <path d={energy === "radiant" ? "M80 68 Q86 64 92 68 M108 68 Q114 64 120 68" : "M80 69 Q86 67 92 69 M108 69 Q114 67 120 69"} fill="none" stroke={INK} strokeWidth={2.2} strokeLinecap="round" />
      {/* cheeks */}
      <circle cx={78} cy={92} r={5} fill="#FF8FA3" opacity={tired ? 0.25 : 0.45} />
      <circle cx={122} cy={92} r={5} fill="#FF8FA3" opacity={tired ? 0.25 : 0.45} />
      {/* mouth */}
      {energy === "radiant" ? (
        <path d="M89 93 Q100 106 111 93 Z" fill="#fff" stroke={INK} strokeWidth={2.2} strokeLinejoin="round" />
      ) : energy === "steady" ? (
        <path d="M90 95 Q100 102 110 95" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      ) : energy === "tired" ? (
        <path d="M92 97 Q100 99 108 97" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      ) : (
        <path d="M93 98 L107 98" fill="none" stroke={INK} strokeWidth={2.4} strokeLinecap="round" />
      )}
    </g>
  );
}

function BaseOutfit({ outfit, color, accent }: { outfit: string; color: string; accent: string }) {
  const dark = shade(color, -35);
  const torso = "M60 142 Q60 118 82 116 L118 116 Q140 118 140 142 L136 192 Q100 200 64 192 Z";
  const layered = outfit === "vest" || outfit === "blazer" || outfit === "suit";
  return (
    <g>
      <path d={torso} fill={layered ? SHIRT : color} {...s} />
      {outfit === "tee" && <path d="M88 116 Q100 126 112 116" fill="none" stroke={dark} strokeWidth={2.5} />}
      {outfit === "henley" && (
        <g>
          <path d="M90 116 Q100 124 110 116" fill="none" stroke={dark} strokeWidth={2.5} />
          <line x1={100} y1={122} x2={100} y2={142} stroke={dark} strokeWidth={2} />
          {[127, 134, 141].map((y) => <circle key={y} cx={100} cy={y} r={1.6} fill={dark} />)}
        </g>
      )}
      {(outfit === "polo" || outfit === "buttondown") && (
        <g>
          <path d="M84 114 L100 128 L94 134 Z M116 114 L100 128 L106 134 Z" fill={shade(color, 25)} {...s} strokeWidth={2} />
          {(outfit === "buttondown" ? [136, 148, 160, 172, 184] : [136, 144]).map((y) => <circle key={y} cx={100} cy={y} r={1.8} fill={dark} />)}
          {outfit === "buttondown" && <line x1={100} y1={130} x2={100} y2={192} stroke={dark} strokeWidth={1.5} />}
        </g>
      )}
      {outfit === "quarterzip" && (
        <g>
          <rect x={86} y={110} width={28} height={12} rx={5} fill={shade(color, 20)} {...s} strokeWidth={2} />
          <line x1={100} y1={112} x2={100} y2={150} stroke={dark} strokeWidth={2.2} />
          <rect x={97.5} y={148} width={5} height={7} rx={1.5} fill="#C9CED8" />
        </g>
      )}
      {outfit === "vest" && (
        <g>
          <path d="M64 136 Q64 120 84 118 L100 150 L116 118 Q136 120 136 136 L134 192 Q100 200 66 192 Z" fill={color} {...s} />
          {[160, 172, 184].map((y) => <circle key={y} cx={100} cy={y} r={2} fill={accent} stroke={INK} strokeWidth={1} />)}
          <path d="M100 124 L96 134 L100 150 L104 134 Z" fill={accent} {...s} strokeWidth={1.5} />
        </g>
      )}
      {(outfit === "blazer" || outfit === "suit") && (
        <g>
          <path d="M60 142 Q60 118 82 116 L98 168 L94 194 Q76 196 64 192 Z" fill={color} {...s} />
          <path d="M140 142 Q140 118 118 116 L102 168 L106 194 Q124 196 136 192 Z" fill={color} {...s} />
          <path d="M84 116 L92 140 L86 146 L98 168 M116 116 L108 140 L114 146 L102 168" fill="none" stroke={dark} strokeWidth={2} />
          {outfit === "suit" && <path d="M100 124 L95 134 L100 162 L105 134 Z" fill={accent} {...s} strokeWidth={1.5} />}
          <rect x={112} y={150} width={12} height={3} rx={1} fill={dark} />
        </g>
      )}
    </g>
  );
}

function OutfitItem({ art, color }: { art: string; color: string }) {
  const dark = shade(color, -40);
  switch (art) {
    case "overshirt":
    case "cardigan":
      return (
        <g>
          <path d="M60 142 Q60 118 82 116 L92 194 Q76 196 64 192 Z" fill={color} {...s} />
          <path d="M140 142 Q140 118 118 116 L108 194 Q124 196 136 192 Z" fill={color} {...s} />
          {art === "overshirt" ? <rect x={68} y={138} width={14} height={12} rx={2} fill={dark} opacity={0.5} /> : [140, 156, 172].map((y) => <circle key={y} cx={90} cy={y} r={2} fill={dark} />)}
        </g>
      );
    case "oxford":
      return (
        <g>
          <path d="M60 142 Q60 118 82 116 L118 116 Q140 118 140 142 L136 192 Q100 200 64 192 Z" fill={color} {...s} />
          <path d="M84 114 L100 128 L94 134 Z M116 114 L100 128 L106 134 Z" fill="#fff" {...s} strokeWidth={2} />
          {[140, 154, 168, 182].map((y) => <circle key={y} cx={100} cy={y} r={1.8} fill="#9AA3B5" />)}
        </g>
      );
    case "sweater":
      return (
        <g>
          <path d="M60 142 Q60 118 82 116 L118 116 Q140 118 140 142 L136 192 Q100 200 64 192 Z" fill={color} {...s} />
          <path d="M86 116 Q100 128 114 116" fill="none" stroke={dark} strokeWidth={3} />
          {[70, 82, 94, 106, 118, 130].map((x) => <line key={x} x1={x} y1={184} x2={x} y2={194} stroke={dark} strokeWidth={1.5} />)}
        </g>
      );
    case "vest":
      return (
        <g>
          <path d="M64 136 Q64 120 84 118 L96 150 L96 194 Q78 196 66 192 Z" fill={color} {...s} />
          <path d="M136 136 Q136 120 116 118 L104 150 L104 194 Q122 196 134 192 Z" fill={color} {...s} />
          <rect x={70} y={160} width={16} height={12} rx={2} fill={dark} opacity={0.45} />
          <rect x={114} y={160} width={16} height={12} rx={2} fill={dark} opacity={0.45} />
        </g>
      );
    case "blazer":
    case "suit":
    case "coat":
      return (
        <g>
          <path d={`M60 142 Q60 118 82 116 L98 168 L94 ${art === "coat" ? 214 : 194} Q76 ${art === "coat" ? 216 : 196} 62 ${art === "coat" ? 212 : 192} Z`} fill={color} {...s} />
          <path d={`M140 142 Q140 118 118 116 L102 168 L106 ${art === "coat" ? 214 : 194} Q124 ${art === "coat" ? 216 : 196} 138 ${art === "coat" ? 212 : 192} Z`} fill={color} {...s} />
          <path d="M84 116 L92 140 L86 146 L98 168 M116 116 L108 140 L114 146 L102 168" fill="none" stroke={dark} strokeWidth={2} />
          {art === "suit" && <path d="M100 124 L95 134 L100 162 L105 134 Z" fill={dark} {...s} strokeWidth={1.5} />}
          {art === "coat" && [172, 186].map((y) => <circle key={y} cx={92} cy={y} r={2.2} fill="#E9C46A" />)}
        </g>
      );
    case "apron":
      return (
        <g>
          <path d="M84 116 L84 130 M116 116 L116 130" stroke={dark} strokeWidth={3} />
          <path d="M80 130 L120 130 L124 208 Q100 214 76 208 Z" fill={color} {...s} />
          <rect x={90} y={160} width={20} height={14} rx={2} fill={dark} opacity={0.4} />
          {[[82, 134], [118, 134]].map(([x, y]) => <circle key={x} cx={x} cy={y} r={2.2} fill="#E9C46A" />)}
        </g>
      );
    default:
      return null;
  }
}

function Headwear({ art, color }: { art: string; color: string }) {
  const dark = shade(color, -35);
  switch (art) {
    case "beanie":
      return (
        <g>
          <path d="M62 64 Q62 26 100 26 Q138 26 138 64 Z" fill={color} {...s} />
          <rect x={60} y={58} width={80} height={12} rx={5} fill={dark} {...s} strokeWidth={2} />
          <circle cx={100} cy={24} r={6} fill={dark} {...s} strokeWidth={2} />
        </g>
      );
    case "headband":
      return <rect x={62} y={56} width={76} height={9} rx={4} fill={color} {...s} strokeWidth={2} />;
    case "flatcap":
      return (
        <g>
          <path d="M62 60 Q64 32 100 32 Q136 32 138 60 Z" fill={color} {...s} />
          <path d="M100 60 Q130 56 150 64 Q132 70 100 66 Z" fill={dark} {...s} strokeWidth={2} />
        </g>
      );
    case "explorer":
      return (
        <g>
          <ellipse cx={100} cy={58} rx={54} ry={10} fill={dark} {...s} />
          <path d="M70 58 Q70 26 100 26 Q130 26 130 58 Z" fill={color} {...s} />
          <rect x={70} y={48} width={60} height={6} fill={dark} />
        </g>
      );
    case "fedora":
      return (
        <g>
          <ellipse cx={100} cy={56} rx={50} ry={9} fill={color} {...s} />
          <path d="M72 56 Q70 28 88 28 Q100 34 112 28 Q130 28 128 56 Z" fill={color} {...s} />
          <rect x={72} y={46} width={56} height={7} fill={dark} />
        </g>
      );
    case "laurel":
      return (
        <g fill="#7CB518" stroke={INK} strokeWidth={1.6}>
          {Array.from({ length: 9 }, (_, i) => {
            const a = Math.PI * (0.95 + (i / 8) * 1.1);
            const x = 100 + Math.cos(a) * 40;
            const y = 72 + Math.sin(a) * 40;
            return <ellipse key={i} cx={x} cy={y} rx={7} ry={3.5} transform={`rotate(${(a * 180) / Math.PI + 90} ${x} ${y})`} fill={i % 2 ? "#D4AF37" : "#E9C46A"} />;
          })}
        </g>
      );
    default:
      return null;
  }
}

function Handheld({ art, color }: { art: string; color: string }) {
  const dark = shade(color, -40);
  const g = (child: ReactNode) => <g transform="translate(150 168)">{child}</g>;
  switch (art) {
    case "notebook":
      return g(<><rect x={-4} y={-6} width={20} height={26} rx={2} fill={color} {...s} strokeWidth={2} /><line x1={0} y1={-6} x2={0} y2={20} stroke={dark} strokeWidth={2} /></>);
    case "ledger":
      return g(<><rect x={-6} y={-8} width={24} height={30} rx={3} fill={color} {...s} strokeWidth={2} /><rect x={-2} y={0} width={16} height={4} fill="#E9C46A" /></>);
    case "thermos":
      return g(<><rect x={0} y={-12} width={13} height={32} rx={4} fill={color} {...s} strokeWidth={2} /><rect x={-1} y={-16} width={15} height={7} rx={2} fill={dark} {...s} strokeWidth={2} /></>);
    case "pen":
      return g(<rect x={2} y={-14} width={5} height={30} rx={2} fill={color} {...s} strokeWidth={2} transform="rotate(20 4 0)" />);
    case "multitool":
      return g(<><rect x={-2} y={-4} width={18} height={10} rx={4} fill={color} {...s} strokeWidth={2} /><rect x={12} y={-10} width={3} height={10} fill="#C9CED8" stroke={INK} strokeWidth={1.2} /></>);
    case "compass":
      return g(<><circle cx={6} cy={4} r={11} fill={color} {...s} strokeWidth={2} /><circle cx={6} cy={4} r={7} fill="#FFF8E1" /><path d="M6 -2 L8 4 L6 10 L4 4 Z" fill="#E63946" /></>);
    case "gavel":
      return g(<><rect x={4} y={-6} width={4} height={28} rx={2} fill={color} {...s} strokeWidth={2} /><rect x={-6} y={-14} width={24} height={10} rx={3} fill={dark} {...s} strokeWidth={2} /></>);
    default:
      return null;
  }
}

function Accessory({ art, color, skin }: { art: string; color: string; skin: string }) {
  switch (art) {
    case "watch":
      return <rect x={46} y={172} width={14} height={7} rx={2} fill={color} {...s} strokeWidth={1.8} />;
    case "glasses":
      return (
        <g fill="none" stroke={color} strokeWidth={2.6}>
          <circle cx={86} cy={80} r={9} />
          <circle cx={114} cy={80} r={9} />
          <line x1={95} y1={80} x2={105} y2={80} />
        </g>
      );
    case "pin":
      return <circle cx={82} cy={136} r={4} fill={color} {...s} strokeWidth={1.6} />;
    case "scarf":
      return (
        <g>
          <path d="M80 112 Q100 124 120 112 L122 120 Q100 132 78 120 Z" fill={color} {...s} strokeWidth={2} />
          <path d="M108 120 L114 152 L104 150 L100 124 Z" fill={shade(color, -20)} {...s} strokeWidth={2} />
        </g>
      );
    case "ring":
      return <circle cx={142} cy={186} r={3} fill={color} stroke={INK} strokeWidth={1.2} />;
    case "satchel":
      return (
        <g>
          <path d="M80 116 L132 186" stroke={shade(color, -30)} strokeWidth={5} strokeLinecap="round" />
          <rect x={122} y={176} width={26} height={20} rx={4} fill={color} {...s} strokeWidth={2} />
          <rect x={132} y={182} width={6} height={4} fill="#E9C46A" />
        </g>
      );
    default:
      void skin;
      return null;
  }
}

function Flair({ id, accent }: { id: string; accent: string }) {
  switch (id) {
    case "rolled-sleeves":
      return <g stroke={INK} strokeWidth={2}><line x1={48} y1={156} x2={64} y2={156} /><line x1={136} y1={156} x2={152} y2={156} /></g>;
    case "pocket-square":
      return <path d="M114 138 L126 138 L120 130 Z" fill={accent} stroke={INK} strokeWidth={1.5} />;
    case "wristwatch":
      return <rect x={46} y={172} width={14} height={7} rx={2} fill="#C9CED8" {...s} strokeWidth={1.8} />;
    case "lapel-flower":
      return (
        <g>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle key={a} cx={84 + Math.cos((a * Math.PI) / 180) * 3.5} cy={134 + Math.sin((a * Math.PI) / 180) * 3.5} r={2.8} fill="#FF5D8F" />
          ))}
          <circle cx={84} cy={134} r={2} fill="#FFD60A" />
        </g>
      );
    case "cufflinks":
      return <g fill="#D4AF37" stroke={INK} strokeWidth={1}><circle cx={55} cy={172} r={2.5} /><circle cx={145} cy={172} r={2.5} /></g>;
    case "signet":
      return <circle cx={58} cy={186} r={3} fill="#D4AF37" stroke={INK} strokeWidth={1.2} />;
    default:
      return null;
  }
}

export default function Character({ appearance, equipped = [], level, energy = "steady", className, title, animate = false }: Props) {
  const a = appearance;
  const items = equipped.map((id) => itemById(id)).filter((x) => x && x.kind === "cosmetic");
  const bySlot = Object.fromEntries(items.map((i) => [i!.slot!, i!]));
  const bg = BACKGROUNDS.find((b) => b.id === a.background) ?? BACKGROUNDS[0];
  const tier = level >= 15 ? 3 : level >= 8 ? 2 : level >= 4 ? 1 : 0;
  const slump = energy === "drained" ? 4 : energy === "tired" ? 2 : 0;
  const stand = 1 + tier * 0.012;
  const longSleeve = !["tee", "polo"].includes(a.baseOutfit) || Boolean(bySlot.outfit) || a.flair.includes("cape-coat");
  const sleeve = bySlot.outfit ? bySlot.outfit.color : ["vest", "blazer", "suit"].includes(a.baseOutfit) ? (a.baseOutfit === "vest" ? SHIRT : a.outfitColor) : a.outfitColor;
  const trousers = a.baseOutfit === "suit" ? shade(a.outfitColor, -20) : "#3D405B";
  const auraOpacity = energy === "radiant" ? 1 : energy === "steady" ? 0.85 : energy === "tired" ? 0.6 : 0.45;
  const id = `aura-${a.background}-${energy}`;

  return (
    <svg viewBox="0 0 200 240" className={className} role="img" aria-label={title ?? "Your character"}>
      <defs>
        <radialGradient id={id} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor={bg.to} />
          <stop offset="100%" stopColor={bg.from} />
        </radialGradient>
      </defs>
      <circle cx={100} cy={118} r={98} fill={`url(#${id})`} opacity={auraOpacity} />
      {energy === "radiant" && (
        <g fill="#FFD60A" className="earned-twinkle">
          <path d="M34 60 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3 Z" />
          <path d="M164 44 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2 Z" />
          <path d="M170 150 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z" />
        </g>
      )}
      <ellipse cx={100} cy={228} rx={50} ry={8} fill="#1F2240" opacity={0.14} />
      <g className={animate ? "earned-bob" : undefined} style={{ transformOrigin: "100px 228px" }}>
        <g transform={`translate(0 ${slump}) scale(1 ${stand}) translate(0 ${-(stand - 1) * 228})`}>
          {a.flair.includes("cape-coat") && <path d="M56 130 Q50 118 76 114 L124 114 Q150 118 144 130 L150 214 Q100 222 50 214 Z" fill="#3A3F4B" {...s} />}
          <HairBack style={a.hairStyle} color={a.hairColor} />
          {/* legs + shoes */}
          <rect x={78} y={184} width={19} height={38} rx={6} fill={trousers} {...s} />
          <rect x={103} y={184} width={19} height={38} rx={6} fill={trousers} {...s} />
          <ellipse cx={86} cy={223} rx={14} ry={6.5} fill="#2B2540" />
          <ellipse cx={114} cy={223} rx={14} ry={6.5} fill="#2B2540" />
          {/* arms (behind torso edges) */}
          <g>
            <rect x={44} y={122} width={20} height={58} rx={10} fill={longSleeve ? sleeve : a.skin} {...s} />
            <rect x={136} y={122} width={20} height={58} rx={10} fill={longSleeve ? sleeve : a.skin} {...s} />
            {!longSleeve && (
              <>
                <path d="M44 132 Q44 122 54 122 Q64 122 64 132 L64 146 L44 146 Z" fill={a.outfitColor} {...s} />
                <path d="M136 132 Q136 122 146 122 Q156 122 156 132 L156 146 L136 146 Z" fill={a.outfitColor} {...s} />
              </>
            )}
            <circle cx={54} cy={184} r={9} fill={a.skin} {...s} />
            <circle cx={146} cy={184} r={9} fill={a.skin} {...s} />
          </g>
          <BaseOutfit outfit={a.baseOutfit} color={a.outfitColor} accent={a.accent} />
          {bySlot.outfit && <OutfitItem art={bySlot.outfit.art} color={bySlot.outfit.color} />}
          {tier >= 2 && <path d="M82 116 Q100 122 118 116" fill="none" stroke="#E9C46A" strokeWidth={1.5} opacity={0.9} />}
          {/* neck + head */}
          <rect x={91} y={102} width={18} height={18} rx={4} fill={a.skin} {...s} />
          <g transform={energy === "drained" ? "rotate(-4 100 110)" : undefined}>
            <circle cx={62} cy={82} r={7} fill={a.skin} {...s} />
            <circle cx={138} cy={82} r={7} fill={a.skin} {...s} />
            <circle cx={100} cy={76} r={38} fill={a.skin} {...s} />
            <Face energy={energy} skin={a.skin} />
            <HairFront style={a.hairStyle} color={a.hairColor} />
            {bySlot.headwear && <Headwear art={bySlot.headwear.art} color={bySlot.headwear.color} />}
            {bySlot.accessory?.art === "glasses" && <Accessory art="glasses" color={bySlot.accessory.color} skin={a.skin} />}
          </g>
          {bySlot.accessory && bySlot.accessory.art !== "glasses" && <Accessory art={bySlot.accessory.art} color={bySlot.accessory.color} skin={a.skin} />}
          {a.flair.map((f) => (
            <Flair key={f} id={f} accent={a.accent} />
          ))}
          {bySlot.handheld && <Handheld art={bySlot.handheld.art} color={bySlot.handheld.color} />}
        </g>
      </g>
    </svg>
  );
}
