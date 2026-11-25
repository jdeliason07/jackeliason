/**
 * Appearance catalog for the layered SVG character (components/earned/art/Character.tsx). No selfie
 * needed: skin tone, hair, outfit, and accessories. Every level from 2 to 20 unlocks one appearance
 * choice; notable levels also change the estate's environment. The character also grows more
 * accomplished on its own: posture straightens and tailoring sharpens by level tier.
 */

export interface Appearance {
  skin: string;
  hairStyle: HairStyle;
  hairColor: string;
  baseOutfit: BaseOutfit;
  outfitColor: string;
  accent: string;
  /** Appearance unlocks currently shown (ids from LEVEL_UNLOCKS of kind "flair"). */
  flair: string[];
  background: string;
}

export type HairStyle = "short" | "crew" | "curly" | "waves" | "long" | "bun" | "coils" | "sidepart" | "buzz";
export type BaseOutfit = "tee" | "henley" | "polo" | "buttondown" | "quarterzip" | "vest" | "blazer" | "suit";

export const SKIN_TONES = ["#FBE3D1", "#F3C9A5", "#E5B08A", "#C98E64", "#A8704B", "#8A5636", "#6A3F26", "#4A2B1B"];
export const HAIR_COLORS = ["#1F1A17", "#4A2F1E", "#7A4B2A", "#B07A45", "#D9B26F", "#8C8C8C", "#C0392B", "#2C3E50"];
export const OUTFIT_COLORS = ["#2D3A8C", "#2F9E6E", "#E4572E", "#5B8DEF", "#8E5BD9", "#F2C14E", "#3A3F4B", "#E9ECEF"];
export const ACCENT_COLORS = ["#FFB703", "#FF5D8F", "#17BEBB", "#E63946", "#B08D57", "#06D6A0"];

export const HAIR_STYLES: { id: HairStyle; label: string; minLevel: number }[] = [
  { id: "short", label: "Short", minLevel: 1 },
  { id: "crew", label: "Crew cut", minLevel: 1 },
  { id: "curly", label: "Curly", minLevel: 1 },
  { id: "long", label: "Long", minLevel: 1 },
  { id: "coils", label: "Coils", minLevel: 1 },
  { id: "buzz", label: "Buzz", minLevel: 1 },
  { id: "waves", label: "Waves", minLevel: 3 },
  { id: "bun", label: "Bun", minLevel: 6 },
  { id: "sidepart", label: "Side part", minLevel: 9 },
];

export const BASE_OUTFITS: { id: BaseOutfit; label: string; minLevel: number }[] = [
  { id: "tee", label: "T-shirt", minLevel: 1 },
  { id: "henley", label: "Henley", minLevel: 1 },
  { id: "polo", label: "Polo", minLevel: 2 },
  { id: "buttondown", label: "Button-down", minLevel: 4 },
  { id: "quarterzip", label: "Quarter-zip", minLevel: 5 },
  { id: "vest", label: "Waistcoat", minLevel: 8 },
  { id: "blazer", label: "Blazer", minLevel: 11 },
  { id: "suit", label: "Tailored suit", minLevel: 15 },
];

export const BACKGROUNDS: { id: string; label: string; minLevel: number; from: string; to: string }[] = [
  { id: "morning", label: "Morning sky", minLevel: 1, from: "#BDE0FE", to: "#FFF1D6" },
  { id: "meadow", label: "Meadow", minLevel: 1, from: "#C7F9CC", to: "#FFFBE6" },
  { id: "sunset", label: "Golden hour", minLevel: 7, from: "#FFD6A5", to: "#FFADAD" },
  { id: "twilight", label: "Twilight", minLevel: 12, from: "#A0C4FF", to: "#BDB2FF" },
  { id: "aurora", label: "Aurora", minLevel: 18, from: "#9BF6FF", to: "#CAFFBF" },
];

export type UnlockKind = "flair" | "hair" | "outfit" | "background" | "accent";

export interface LevelUnlock {
  level: number;
  kind: UnlockKind;
  id: string;
  label: string;
  /** Notable levels also change the estate environment. */
  estate?: string;
}

/** One appearance choice per level, 2–20. */
export const LEVEL_UNLOCKS: LevelUnlock[] = [
  { level: 2, kind: "outfit", id: "polo", label: "Polo shirt" },
  { level: 3, kind: "hair", id: "waves", label: "Waves hairstyle", estate: "A gravel path winds up to the house." },
  { level: 4, kind: "outfit", id: "buttondown", label: "Button-down shirt" },
  { level: 5, kind: "flair", id: "rolled-sleeves", label: "Rolled sleeves", estate: "Lamp posts line the path at dusk." },
  { level: 6, kind: "hair", id: "bun", label: "Bun hairstyle" },
  { level: 7, kind: "background", id: "sunset", label: "Golden-hour backdrop", estate: "Orchard trees take root on the hill." },
  { level: 8, kind: "outfit", id: "vest", label: "Waistcoat" },
  { level: 9, kind: "hair", id: "sidepart", label: "Side part" },
  { level: 10, kind: "flair", id: "pocket-square", label: "Pocket square", estate: "A stone gate and your banner at the entrance." },
  { level: 11, kind: "outfit", id: "blazer", label: "Blazer" },
  { level: 12, kind: "background", id: "twilight", label: "Twilight backdrop" },
  { level: 13, kind: "flair", id: "wristwatch", label: "Steel wristwatch" },
  { level: 14, kind: "accent", id: "accent-gold", label: "Gold accent color" },
  { level: 15, kind: "outfit", id: "suit", label: "Tailored suit", estate: "A river and footbridge run below the estate." },
  { level: 16, kind: "flair", id: "lapel-flower", label: "Lapel flower" },
  { level: 17, kind: "flair", id: "cufflinks", label: "Cufflinks" },
  { level: 18, kind: "background", id: "aurora", label: "Aurora backdrop" },
  { level: 19, kind: "flair", id: "signet", label: "Founder's signet" },
  { level: 20, kind: "flair", id: "cape-coat", label: "Overcoat over the shoulders", estate: "Fireworks light the sky over the estate." },
];

export const FLAIR_LABELS = Object.fromEntries(LEVEL_UNLOCKS.filter((u) => u.kind === "flair").map((u) => [u.id, u.label]));

/** Estate environment upgrades that come from level alone (visual only). */
export function environmentFeatures(level: number): string[] {
  return LEVEL_UNLOCKS.filter((u) => u.estate && u.level <= level).map((u) => u.id);
}

export const DEFAULT_APPEARANCE: Appearance = {
  skin: SKIN_TONES[2],
  hairStyle: "short",
  hairColor: HAIR_COLORS[1],
  baseOutfit: "tee",
  outfitColor: OUTFIT_COLORS[0],
  accent: ACCENT_COLORS[0],
  flair: [],
  background: "morning",
};

export function unlockedAt(level: number) {
  return {
    hair: HAIR_STYLES.filter((h) => h.minLevel <= level).map((h) => h.id),
    outfits: BASE_OUTFITS.filter((o) => o.minLevel <= level).map((o) => o.id),
    backgrounds: BACKGROUNDS.filter((b) => b.minLevel <= level).map((b) => b.id),
    flair: LEVEL_UNLOCKS.filter((u) => u.kind === "flair" && u.level <= level).map((u) => u.id),
    accents: [...ACCENT_COLORS, ...(level >= 14 ? ["#D4AF37"] : [])],
  };
}

/** Rejects appearance values the level hasn't unlocked or that aren't in the catalog. */
export function validateAppearance(a: Appearance, level: number): string | null {
  const u = unlockedAt(level);
  if (!SKIN_TONES.includes(a.skin)) return "Unknown skin tone.";
  if (!HAIR_COLORS.includes(a.hairColor)) return "Unknown hair color.";
  if (!OUTFIT_COLORS.includes(a.outfitColor)) return "Unknown outfit color.";
  if (!u.accents.includes(a.accent)) return "That accent color isn't unlocked yet.";
  if (!u.hair.includes(a.hairStyle)) return "That hairstyle isn't unlocked yet.";
  if (!u.outfits.includes(a.baseOutfit)) return "That outfit isn't unlocked yet.";
  if (!u.backgrounds.includes(a.background)) return "That backdrop isn't unlocked yet.";
  if (!Array.isArray(a.flair) || a.flair.some((f) => !u.flair.includes(f))) return "That flair isn't unlocked yet.";
  return null;
}
