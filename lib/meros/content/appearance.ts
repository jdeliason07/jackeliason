/**
 * Appearance catalog for the layered SVG character (components/meros/art/Character.tsx). No selfie
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
export const OUTFIT_COLORS = ["#8A0F1A", "#1A1A1E", "#2E3440", "#3B4A5A", "#5A1A1F", "#2F4F3E", "#6B6B70", "#E8E4DC"];
export const ACCENT_COLORS = ["#C8102E", "#F2EFEA", "#9C9C9C", "#8FB3D6", "#4CC28B", "#1A1A1E"];

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
  { id: "steel", label: "Steel", minLevel: 1, from: "#14161B", to: "#3A4250" },
  { id: "crimson", label: "Crimson", minLevel: 1, from: "#2A070C", to: "#8A0F1A" },
  { id: "ember", label: "Ember", minLevel: 7, from: "#2A0A08", to: "#C2412F" },
  { id: "midnight", label: "Midnight", minLevel: 12, from: "#07070C", to: "#22305A" },
  { id: "gold", label: "Champion gold", minLevel: 18, from: "#2A1E08", to: "#C8A04A" },
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
  { level: 3, kind: "hair", id: "waves", label: "Waves hairstyle", estate: "Sidewalks, street trees, and a corner market." },
  { level: 4, kind: "outfit", id: "buttondown", label: "Button-down shirt" },
  { level: 5, kind: "flair", id: "rolled-sleeves", label: "Rolled sleeves", estate: "A new apartment building and a bike lane." },
  { level: 6, kind: "hair", id: "bun", label: "Bun hairstyle" },
  { level: 7, kind: "background", id: "ember", label: "Ember backdrop", estate: "The empty field becomes a park." },
  { level: 8, kind: "outfit", id: "vest", label: "Waistcoat" },
  { level: 9, kind: "hair", id: "sidepart", label: "Side part" },
  { level: 10, kind: "flair", id: "pocket-square", label: "Pocket square", estate: "A glass office rises across the road." },
  { level: 11, kind: "outfit", id: "blazer", label: "Blazer" },
  { level: 12, kind: "background", id: "midnight", label: "Midnight backdrop" },
  { level: 13, kind: "flair", id: "wristwatch", label: "Steel wristwatch" },
  { level: 14, kind: "accent", id: "accent-gold", label: "Gold accent" },
  { level: 15, kind: "outfit", id: "suit", label: "Tailored suit", estate: "The empty lots fill in; a river walk opens." },
  { level: 16, kind: "flair", id: "lapel-flower", label: "Lapel flower" },
  { level: 17, kind: "flair", id: "cufflinks", label: "Cufflinks" },
  { level: 18, kind: "background", id: "gold", label: "Champion-gold backdrop" },
  { level: 19, kind: "flair", id: "signet", label: "Founder's signet" },
  { level: 20, kind: "flair", id: "cape-coat", label: "Overcoat over the shoulders", estate: "New towers join the skyline." },
];

/**
 * What a level unlock shows now that the character is a photograph (lib/meros/content/art.ts): new
 * hair and outfits appear in the photo, and estate changes appear in the estate overview. Flair,
 * accents, and backdrops have no photo, so a level that only grants one of those shows nothing.
 * Their data stays as it was so saved appearances keep validating.
 */
export function unlockLabel(u: LevelUnlock): string | null {
  const shown = u.kind === "hair" || u.kind === "outfit" ? u.label : null;
  if (shown && u.estate) return `${shown} · ${u.estate}`;
  return shown ?? u.estate ?? null;
}

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
  accent: ACCENT_COLORS[1],
  flair: [],
  background: "steel",
};

export function unlockedAt(level: number) {
  return {
    hair: HAIR_STYLES.filter((h) => h.minLevel <= level).map((h) => h.id),
    outfits: BASE_OUTFITS.filter((o) => o.minLevel <= level).map((o) => o.id),
    backgrounds: BACKGROUNDS.filter((b) => b.minLevel <= level).map((b) => b.id),
    flair: LEVEL_UNLOCKS.filter((u) => u.kind === "flair" && u.level <= level).map((u) => u.id),
    accents: [...ACCENT_COLORS, ...(level >= 14 ? ["#D1AA55"] : [])],
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
