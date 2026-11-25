"use client";

import type { ReactNode } from "react";
import { AREAS, type AreaId } from "@/lib/earned/content/estate";
import { itemById } from "@/lib/earned/content/items";

/**
 * The estate: an original illustrated hillside with six areas, each drawn in four states (base plus
 * three upgrades), environment features that arrive with notable levels (path, lamps, orchard, gate,
 * river, fireworks), and placed decorations. Every area is a button with a text label.
 */

const INK = "#2B2540";
const st = { stroke: INK, strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };

const POS: Record<AreaId, [number, number]> = {
  residence: [200, 140],
  office: [78, 162],
  library: [322, 162],
  gym: [86, 254],
  workshop: [314, 254],
  gardens: [200, 268],
};

const DECOR_SLOTS: [number, number][] = [
  [146, 196], [254, 196], [36, 206], [364, 206], [140, 288], [262, 288], [200, 198],
];

function Win({ x, y, w = 10, h = 12, lit = false }: { x: number; y: number; w?: number; h?: number; lit?: boolean }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={1.5} fill={lit ? "#FFE08A" : "#BDE0FE"} {...st} strokeWidth={1.6} />
      <line x1={x + w / 2} y1={y} x2={x + w / 2} y2={y + h} stroke={INK} strokeWidth={1} />
    </g>
  );
}

function Door({ x, y, w = 10, h = 16, color = "#8B5E3C" }: { x: number; y: number; w?: number; h?: number; color?: string }) {
  return <rect x={x} y={y} width={w} height={h} rx={w / 2.5} ry={3} fill={color} {...st} strokeWidth={1.6} />;
}

function Residence({ tier }: { tier: number }) {
  switch (tier) {
    case 0:
      return (
        <g>
          <rect x={-26} y={-30} width={52} height={30} fill="#E9C9A0" {...st} />
          <path d="M-32 -30 L0 -54 L32 -30 Z" fill="#C9A66B" {...st} />
          <Door x={-5} y={-18} />
          <Win x={-20} y={-24} />
          <Win x={10} y={-24} />
        </g>
      );
    case 1:
      return (
        <g>
          <rect x={-38} y={-36} width={76} height={36} fill="#C8CCD4" {...st} />
          <path d="M-14 -36 h28 M-38 -24 h76 M-38 -12 h76" stroke="#A9AFBB" strokeWidth={1.2} />
          <path d="M-44 -36 L0 -62 L44 -36 Z" fill="#8D99AE" {...st} />
          <rect x={22} y={-62} width={8} height={16} fill="#A9AFBB" {...st} />
          <rect x={-32} y={-58} width={8} height={14} fill="#A9AFBB" {...st} />
          <Door x={-6} y={-20} w={12} h={20} />
          <Win x={-30} y={-28} lit />
          <Win x={18} y={-28} lit />
          <circle cx={12} cy={-16} r={2.5} fill="#FFD60A" />
        </g>
      );
    case 2:
      return (
        <g>
          <rect x={-46} y={-62} width={92} height={62} fill="#F1E3C6" {...st} />
          <path d="M-52 -62 L-20 -90 L12 -62 Z M4 -62 L28 -84 L52 -62 Z" fill="#4A5568" {...st} />
          {[-38, -22, 14, 30].map((x) => <Win key={x} x={x} y={-52} w={9} h={16} lit />)}
          {[-38, -22, 14, 30].map((x) => <Win key={`b${x}`} x={x} y={-26} w={9} h={16} />)}
          <Door x={-7} y={-24} w={14} h={24} color="#2D3A8C" />
          <rect x={-10} y={-30} width={20} height={4} fill="#E9C46A" />
        </g>
      );
    default:
      return (
        <g>
          <rect x={-62} y={-58} width={124} height={58} fill="#FFF3DC" {...st} />
          <path d="M-68 -58 L0 -84 L68 -58 Z" fill="#2D3A8C" {...st} />
          <rect x={-12} y={-118} width={24} height={46} fill="#FFF3DC" {...st} />
          <path d="M-16 -118 L0 -136 L16 -118 Z" fill="#2D3A8C" {...st} />
          <circle cx={0} cy={-100} r={8} fill="#fff" {...st} />
          <path d="M0 -100 L0 -105 M0 -100 L4 -100" stroke={INK} strokeWidth={1.5} />
          {[-54, -38, -22, 14, 30, 46].map((x) => <Win key={x} x={x} y={-48} w={9} h={18} lit />)}
          <Door x={-8} y={-28} w={16} h={28} color="#2D3A8C" />
          {[-60, 60].map((x) => <circle key={x} cx={x} cy={-4} r={3} fill="#FFD60A" />)}
          <rect x={-62} y={-4} width={124} height={4} fill="#E9C46A" />
        </g>
      );
  }
}

function Office({ tier }: { tier: number }) {
  switch (tier) {
    case 0:
      return (
        <g>
          <rect x={-16} y={-14} width={32} height={4} fill="#A47148" {...st} />
          <line x1={-12} y1={-10} x2={-12} y2={0} {...st} />
          <line x1={12} y1={-10} x2={12} y2={0} {...st} />
          <line x1={0} y1={-14} x2={0} y2={-40} {...st} />
          <path d="M-22 -36 Q0 -54 22 -36 Z" fill="#FF6B6B" {...st} />
          <rect x={-6} y={-20} width={12} height={6} fill="#C9CED8" {...st} strokeWidth={1.4} />
        </g>
      );
    case 1:
      return (
        <g>
          <rect x={-24} y={-34} width={48} height={34} fill="#C1666B" {...st} />
          <rect x={-28} y={-40} width={56} height={6} fill="#6D597A" {...st} />
          <Win x={-18} y={-26} w={12} h={10} lit />
          <Door x={4} y={-20} w={12} h={20} color="#2D3A8C" />
          <rect x={-18} y={-12} width={14} height={4} fill="#E9C46A" stroke={INK} strokeWidth={1} />
        </g>
      );
    case 2:
      return (
        <g>
          <rect x={-30} y={-42} width={60} height={42} fill="#E3F2FD" {...st} />
          {[-22, -6, 10].map((x) => <rect key={x} x={x} y={-36} width={12} height={34} fill="#90E0EF" opacity={0.8} stroke={INK} strokeWidth={1.2} />)}
          <rect x={-34} y={-48} width={68} height={6} fill="#2D3A8C" {...st} />
          <rect x={-14} y={-14} width={28} height={3} fill="#A47148" />
        </g>
      );
    default:
      return (
        <g>
          <rect x={-30} y={-82} width={60} height={82} fill="#DDE5F2" {...st} />
          {[-70, -50, -30].map((y) => [-22, -6, 10].map((x) => <rect key={`${x}${y}`} x={x} y={y} width={12} height={14} fill="#FFE08A" stroke={INK} strokeWidth={1.2} />))}
          <Door x={-8} y={-16} w={16} h={16} color="#2D3A8C" />
          <line x1={0} y1={-82} x2={0} y2={-106} {...st} />
          <path d="M0 -106 L18 -100 L0 -94 Z" fill="#06D6A0" {...st} strokeWidth={1.5} />
        </g>
      );
  }
}

function Library({ tier }: { tier: number }) {
  switch (tier) {
    case 0:
      return (
        <g>
          <rect x={-16} y={-14} width={32} height={14} fill="#A47148" {...st} />
          {[-12, -6, 0, 6].map((x, i) => <rect key={x} x={x} y={-24} width={5} height={10} fill={["#3A86FF", "#FF6B6B", "#06D6A0", "#FFB703"][i]} stroke={INK} strokeWidth={1} />)}
        </g>
      );
    case 1:
      return (
        <g>
          <rect x={-24} y={-32} width={48} height={32} fill="#FFE5B4" {...st} />
          <path d="M-30 -32 L0 -52 L30 -32 Z" fill="#8E5BD9" {...st} />
          <circle cx={0} cy={-20} r={7} fill="#FFE08A" {...st} strokeWidth={1.6} />
          <Door x={-5} y={-12} w={10} h={12} />
        </g>
      );
    case 2:
      return (
        <g>
          <rect x={-30} y={-56} width={60} height={56} fill="#EDE7F6" {...st} />
          <path d="M-36 -56 L0 -76 L36 -56 Z" fill="#6A4C93" {...st} />
          {[-22, 12].map((x) => <Win key={x} x={x} y={-48} w={10} h={18} lit />)}
          {[-22, 12].map((x) => <Win key={`b${x}`} x={x} y={-24} w={10} h={18} lit />)}
          <Door x={-5} y={-18} w={10} h={18} color="#6A4C93" />
        </g>
      );
    default:
      return (
        <g>
          <rect x={-36} y={-50} width={72} height={50} fill="#F3E9FF" {...st} />
          <path d="M-28 -50 Q-28 -92 0 -92 Q28 -92 28 -50 Z" fill="#2EC4B6" {...st} />
          <path d="M0 -92 L0 -100" {...st} />
          <circle cx={0} cy={-102} r={3} fill="#D4AF37" {...st} strokeWidth={1} />
          {[-28, -12, 4, 20].map((x) => <rect key={x} x={x} y={-42} width={8} height={38} fill="#fff" stroke={INK} strokeWidth={1.3} />)}
        </g>
      );
  }
}

function Gym({ tier }: { tier: number }) {
  switch (tier) {
    case 0:
      return (
        <g>
          <line x1={-14} y1={0} x2={-14} y2={-34} {...st} strokeWidth={3} />
          <line x1={14} y1={0} x2={14} y2={-34} {...st} strokeWidth={3} />
          <line x1={-18} y1={-32} x2={18} y2={-32} {...st} strokeWidth={3} />
        </g>
      );
    case 1:
      return (
        <g>
          <path d="M-26 -30 L26 -36 L26 0 L-26 0 Z" fill="#FFD6A5" {...st} />
          <path d="M-30 -30 L30 -38" {...st} strokeWidth={3} />
          <circle cx={-12} cy={-6} r={6} fill="#3D405B" {...st} />
          <circle cx={10} cy={-6} r={6} fill="#3D405B" {...st} />
          <rect x={-2} y={-24} width={4} height={18} fill="#C9CED8" stroke={INK} strokeWidth={1} />
        </g>
      );
    case 2:
      return (
        <g>
          <rect x={-30} y={-34} width={60} height={34} fill="#D62828" {...st} />
          <path d="M-36 -34 L0 -58 L36 -34 Z" fill="#9D0208" {...st} />
          <path d="M-12 0 L-12 -20 L12 -20 L12 0 M-12 -20 L12 0 M12 -20 L-12 0" fill="#fff" stroke={INK} strokeWidth={1.6} />
          <rect x={-8} y={-50} width={16} height={8} fill="#fff" {...st} strokeWidth={1.4} />
        </g>
      );
    default:
      return (
        <g>
          <ellipse cx={0} cy={-2} rx={46} ry={12} fill="#F28482" {...st} />
          <ellipse cx={0} cy={-2} rx={36} ry={7} fill="#B7E4C7" stroke={INK} strokeWidth={1.4} />
          <rect x={-26} y={-44} width={52} height={36} fill="#FFF3DC" {...st} />
          <path d="M-32 -44 L32 -44 L26 -54 L-26 -54 Z" fill="#E4572E" {...st} />
          {[-18, 8].map((x) => <Win key={x} x={x} y={-36} w={10} h={12} lit />)}
        </g>
      );
  }
}

function Workshop({ tier }: { tier: number }) {
  switch (tier) {
    case 0:
      return (
        <g>
          <rect x={-18} y={-16} width={36} height={5} fill="#A47148" {...st} />
          <line x1={-14} y1={-11} x2={-14} y2={0} {...st} />
          <line x1={14} y1={-11} x2={14} y2={0} {...st} />
          <rect x={-8} y={-24} width={6} height={8} fill="#C1121F" stroke={INK} strokeWidth={1} />
          <rect x={4} y={-22} width={10} height={6} fill="#7D8597" stroke={INK} strokeWidth={1} />
        </g>
      );
    case 1:
      return (
        <g>
          <rect x={-22} y={-30} width={44} height={30} fill="#B08968" {...st} />
          <path d="M-26 -30 L22 -44 L26 -30 Z" fill="#7F5539" {...st} />
          <rect x={-14} y={-24} width={18} height={14} fill="#EDE0D4" stroke={INK} strokeWidth={1.4} />
          {[-10, -4, 2].map((x) => <circle key={x} cx={x} cy={-18} r={1.4} fill={INK} />)}
          <Door x={8} y={-18} w={10} h={18} color="#7F5539" />
        </g>
      );
    case 2:
      return (
        <g>
          <rect x={-30} y={-38} width={60} height={38} fill="#BC6C25" {...st} />
          <path d="M-34 -38 L34 -38 L28 -50 L-28 -50 Z" fill="#6C584C" {...st} />
          <rect x={-10} y={-50} width={20} height={6} fill="#90E0EF" stroke={INK} strokeWidth={1.2} />
          <Win x={-22} y={-30} w={12} h={12} lit />
          <Door x={6} y={-24} w={16} h={24} color="#6C584C" />
        </g>
      );
    default:
      return (
        <g>
          <rect x={-34} y={-40} width={68} height={40} fill="#6C584C" {...st} />
          <rect x={16} y={-86} width={12} height={46} fill="#9C6644" {...st} />
          <circle cx={26} cy={-94} r={6} fill="#ADB5BD" opacity={0.8} />
          <circle cx={32} cy={-104} r={8} fill="#ADB5BD" opacity={0.6} />
          {[-26, -10, 4].map((x) => <rect key={x} x={x} y={-30} width={10} height={14} fill="#FFB703" stroke={INK} strokeWidth={1.3} />)}
        </g>
      );
  }
}

function Gardens({ tier }: { tier: number }) {
  switch (tier) {
    case 0:
      return (
        <g fill="#80B918">
          {[-24, -12, 0, 12, 24].map((x, i) => <path key={x} d={`M${x} 0 l-4 -${8 + (i % 2) * 5} l4 4 l4 -${10 - (i % 2) * 3} l-1 9 Z`} stroke={INK} strokeWidth={1} />)}
        </g>
      );
    case 1:
      return (
        <g>
          {[-30, 2].map((x) => <rect key={x} x={x} y={-10} width={28} height={10} fill="#A47148" {...st} />)}
          {[-24, -14, 8, 18].map((x) => <circle key={x} cx={x} cy={-14} r={5} fill="#52B788" {...st} strokeWidth={1.4} />)}
          {[-24, 18].map((x) => <circle key={x} cx={x} cy={-15} r={2} fill="#FF5D8F" />)}
        </g>
      );
    case 2:
      return (
        <g>
          <ellipse cx={0} cy={-4} rx={18} ry={6} fill="#4CC9F0" {...st} />
          <rect x={-46} y={-14} width={20} height={14} rx={6} fill="#2D6A4F" {...st} />
          <rect x={26} y={-14} width={20} height={14} rx={6} fill="#2D6A4F" {...st} />
          <path d="M-20 -6 L-20 -30 L20 -30 L20 -6" fill="none" {...st} />
          <path d="M-24 -30 L24 -30" {...st} strokeWidth={3} />
          <circle cx={-6} cy={-5} r={2.5} fill="#FFAFCC" />
        </g>
      );
    default:
      return (
        <g>
          <rect x={-50} y={-10} width={100} height={10} fill="#95D5B2" {...st} />
          <rect x={-40} y={-20} width={80} height={10} fill="#74C69D" {...st} />
          <path d="M-14 -20 L-14 -40 Q0 -54 14 -40 L14 -20 Z" fill="#CAF0F8" opacity={0.9} {...st} />
          {[-34, 34].map((x) => (
            <g key={x}>
              <line x1={x} y1={-20} x2={x} y2={-34} {...st} />
              <circle cx={x} cy={-40} r={9} fill="#52B788" {...st} />
              <circle cx={x + 3} cy={-42} r={2} fill="#E63946" />
            </g>
          ))}
        </g>
      );
  }
}

const DRAW: Record<AreaId, (p: { tier: number }) => ReactNode> = {
  residence: Residence,
  office: Office,
  library: Library,
  gym: Gym,
  workshop: Workshop,
  gardens: Gardens,
};

function Decoration({ art, color }: { art: string; color: string }) {
  switch (art) {
    case "lanterns":
      return <g>{[-10, 0, 10].map((x) => <circle key={x} cx={x} cy={-12} r={3.5} fill={color} {...st} strokeWidth={1} />)}<path d="M-14 -14 Q0 -8 14 -14" fill="none" stroke={INK} strokeWidth={1} /></g>;
    case "bench":
      return <g><rect x={-12} y={-10} width={24} height={4} fill={color} {...st} strokeWidth={1.4} /><rect x={-12} y={-16} width={24} height={3} fill={color} {...st} strokeWidth={1.2} /></g>;
    case "flowers":
      return <g>{[-8, 0, 8].map((x, i) => <circle key={x} cx={x} cy={-5} r={3.5} fill={["#FF5D8F", "#FFD60A", "#9B5DE5"][i]} {...st} strokeWidth={1} />)}</g>;
    case "birdbath":
      return <g><rect x={-2} y={-12} width={4} height={12} fill="#ADB5BD" {...st} strokeWidth={1.2} /><ellipse cx={0} cy={-13} rx={10} ry={3} fill={color} {...st} strokeWidth={1.2} /></g>;
    case "weathervane":
      return <g><line x1={0} y1={0} x2={0} y2={-24} {...st} /><path d="M-8 -22 L8 -22 L4 -26 Z" fill={color} {...st} strokeWidth={1} /></g>;
    case "banner":
      return <g><line x1={-6} y1={0} x2={-6} y2={-28} {...st} /><path d="M-6 -28 L10 -24 L-6 -18 Z" fill={color} {...st} strokeWidth={1.2} /></g>;
    case "fountain":
      return <g><ellipse cx={0} cy={-3} rx={14} ry={4} fill="#ADB5BD" {...st} strokeWidth={1.2} /><path d="M0 -6 Q-6 -20 0 -24 Q6 -20 0 -6" fill={color} stroke={INK} strokeWidth={1} /></g>;
    case "telescope":
      return <g><line x1={-6} y1={0} x2={0} y2={-10} {...st} /><line x1={6} y1={0} x2={0} y2={-10} {...st} /><rect x={-10} y={-16} width={20} height={5} rx={2} fill={color} {...st} strokeWidth={1.2} transform="rotate(-25 0 -13)" /></g>;
    case "statue":
      return <g><rect x={-7} y={-6} width={14} height={6} fill="#ADB5BD" {...st} strokeWidth={1.2} /><circle cx={0} cy={-22} r={4} fill={color} {...st} strokeWidth={1.2} /><path d="M0 -18 L0 -8 M0 -14 L-5 -10 M0 -14 L5 -16 M0 -8 L-4 -6 M0 -8 L5 -6" stroke={INK} strokeWidth={2} /></g>;
    case "observatory":
      return <g><rect x={-10} y={-10} width={20} height={10} fill="#E9ECEF" {...st} strokeWidth={1.2} /><path d="M-10 -10 Q-10 -24 0 -24 Q10 -24 10 -10 Z" fill={color} {...st} strokeWidth={1.2} /></g>;
    default:
      return <circle cx={0} cy={-6} r={5} fill={color} {...st} strokeWidth={1} />;
  }
}

interface Props {
  tiers: Record<string, number>;
  level: number;
  decorations?: string[];
  onSelect?: (area: AreaId) => void;
  selected?: AreaId | null;
  className?: string;
  /** Static preview with one area at a different tier (upgrade preview). */
  preview?: { area: AreaId; tier: number } | null;
}

export default function EstateScene({ tiers, level, decorations = [], onSelect, selected, className, preview }: Props) {
  const warm = level >= 7;
  return (
    <svg viewBox="0 0 400 300" className={className} role="group" aria-label="Your estate">
      <defs>
        <linearGradient id="earned-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={warm ? "#FFC6A5" : "#9ED8FF"} />
          <stop offset="100%" stopColor={warm ? "#FFF1D6" : "#E8F7FF"} />
        </linearGradient>
      </defs>
      <rect width={400} height={300} fill="url(#earned-sky)" />
      <circle cx={340} cy={46} r={22} fill={warm ? "#FF9F1C" : "#FFD60A"} opacity={0.9} />
      <g fill="#fff" opacity={0.85}>
        <ellipse cx={70} cy={44} rx={26} ry={9} />
        <ellipse cx={92} cy={38} rx={18} ry={9} />
        <ellipse cx={230} cy={28} rx={20} ry={7} />
      </g>
      {level >= 20 && (
        <g className="earned-twinkle">
          {[[120, 40, "#FF5D8F"], [280, 30, "#FFD60A"], [190, 18, "#4CC9F0"]].map(([x, y, c]) => (
            <g key={String(x)} stroke={String(c)} strokeWidth={2} strokeLinecap="round">
              {Array.from({ length: 8 }, (_, i) => {
                const a = (i / 8) * Math.PI * 2;
                return <line key={i} x1={Number(x) + Math.cos(a) * 4} y1={Number(y) + Math.sin(a) * 4} x2={Number(x) + Math.cos(a) * 12} y2={Number(y) + Math.sin(a) * 12} />;
              })}
            </g>
          ))}
        </g>
      )}
      <path d="M0 120 Q100 80 200 100 Q300 120 400 90 L400 300 L0 300 Z" fill="#B7E4C7" />
      <path d="M0 170 Q120 140 220 160 Q320 176 400 150 L400 300 L0 300 Z" fill="#95D5B2" />
      {level >= 15 && (
        <g>
          <path d="M0 292 Q100 276 200 290 Q300 302 400 284 L400 300 L0 300 Z" fill="#4CC9F0" opacity={0.85} />
          <path d="M176 292 Q200 278 224 292" fill="none" stroke="#8B5E3C" strokeWidth={5} />
        </g>
      )}
      {level >= 3 && <path d="M200 300 Q190 240 200 200 Q210 170 200 142" fill="none" stroke="#E9D8A6" strokeWidth={14} strokeLinecap="round" />}
      {level >= 5 &&
        [[180, 230], [222, 214], [188, 176]].map(([x, y]) => (
          <g key={x}>
            <line x1={x} y1={y} x2={x} y2={y - 18} stroke={INK} strokeWidth={2} />
            <circle cx={x} cy={y - 20} r={3.5} fill="#FFE08A" stroke={INK} strokeWidth={1.2} />
          </g>
        ))}
      {level >= 7 &&
        [[30, 128], [370, 120], [140, 112]].map(([x, y]) => (
          <g key={x}>
            <line x1={x} y1={y} x2={x} y2={y - 12} stroke="#7F5539" strokeWidth={3} />
            <circle cx={x} cy={y - 18} r={10} fill="#52B788" stroke={INK} strokeWidth={1.5} />
            <circle cx={x - 3} cy={y - 20} r={2} fill="#E63946" />
          </g>
        ))}
      {level >= 10 && (
        <g>
          <rect x={176} y={276} width={8} height={22} fill="#ADB5BD" {...st} />
          <rect x={216} y={276} width={8} height={22} fill="#ADB5BD" {...st} />
          <path d="M184 280 Q200 268 216 280" fill="none" {...st} strokeWidth={3} />
          <path d="M224 276 L240 280 L224 286 Z" fill="#E63946" {...st} strokeWidth={1.2} />
        </g>
      )}
      {AREAS.map((area) => {
        const [x, y] = POS[area.id];
        const Draw = DRAW[area.id];
        const tier = preview?.area === area.id ? preview.tier : (tiers[area.id] ?? 0);
        const isSel = selected === area.id;
        const name = tier === 0 ? area.baseName : area.tiers[tier - 1].name;
        return (
          <g
            key={area.id}
            transform={`translate(${x} ${y})`}
            role={onSelect ? "button" : undefined}
            tabIndex={onSelect ? 0 : undefined}
            aria-label={onSelect ? `${area.name}: ${name}, tier ${tier} of 3` : undefined}
            aria-pressed={onSelect ? isSel : undefined}
            onClick={onSelect ? () => onSelect(area.id) : undefined}
            onKeyDown={
              onSelect
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onSelect(area.id);
                    }
                  }
                : undefined
            }
            className={onSelect ? "earned-plot" : undefined}
          >
            <ellipse cx={0} cy={2} rx={46} ry={8} fill={isSel ? "#FFD60A" : "#1F2240"} opacity={isSel ? 0.6 : 0.1} />
            <g transform="scale(1.22)">
              <Draw tier={tier} />
            </g>
            {onSelect && (
              <g transform="translate(0 16)">
                <rect x={-34} y={-7} width={68} height={14} rx={7} fill="#fff" opacity={0.92} stroke={isSel ? "#FFB703" : "#E3E7F2"} strokeWidth={isSel ? 2 : 1} />
                <text x={0} y={3.5} textAnchor="middle" fontSize={9} fontWeight={700} fill={INK} fontFamily="var(--font-ui), system-ui, sans-serif">
                  {area.name.replace("Main ", "")} · {tier}/3
                </text>
              </g>
            )}
          </g>
        );
      })}
      {decorations.slice(0, DECOR_SLOTS.length).map((id, i) => {
        const item = itemById(id);
        if (!item) return null;
        const [x, y] = DECOR_SLOTS[i];
        return (
          <g key={id} transform={`translate(${x} ${y})`} aria-hidden="true">
            <Decoration art={item.art} color={item.color} />
          </g>
        );
      })}
    </svg>
  );
}
