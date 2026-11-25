/**
 * Photographic art for Meros: every image is pre-rendered (scripts/meros/generate-art.mts) and
 * served from /meros/art. This file is the single map from game state to an image path, shared by
 * the app and the generator so the two can never disagree.
 *
 * The character is one photograph per (skin tone × hair style × outfit): 6 × 9 × 8 = 432 images.
 * Each person (skin × hair) is generated once, then re-dressed from that photo so the face stays the
 * same as outfits unlock. Hair color, outfit color, and the other old drawn layers have no photo.
 */
import type { BaseOutfit, HairStyle } from "./appearance";

export const ART_BASE = "/meros/art";

/** The six photographed skin tones, light to deep. Stored appearances keep their hex; it maps to the nearest. */
export const PHOTO_SKINS = [
  { key: "s1", hex: "#FBE3D1", prompt: "very fair skin" },
  { key: "s2", hex: "#E5B08A", prompt: "light skin with warm undertones" },
  { key: "s3", hex: "#C98E64", prompt: "medium olive skin" },
  { key: "s4", hex: "#A8704B", prompt: "tan brown skin" },
  { key: "s5", hex: "#8A5636", prompt: "brown skin" },
  { key: "s6", hex: "#4A2B1B", prompt: "deep dark brown skin" },
] as const;

export const PHOTO_HAIR: Record<HairStyle, string> = {
  short: "short, neatly cut dark brown hair",
  crew: "a short dark brown crew cut",
  curly: "short curly dark brown hair",
  long: "straight dark brown hair grown out to his shoulders",
  coils: "short tight black coily hair",
  buzz: "a very short black buzz cut",
  waves: "short wavy brown hair with natural texture",
  bun: "longer dark brown hair tied back in a neat man bun",
  sidepart: "a classic dark brown side-part haircut, combed neatly",
};

export const PHOTO_OUTFITS: Record<BaseOutfit, string> = {
  tee: "a plain white crew-neck t-shirt, slim blue jeans and brown leather boots",
  henley: "a heather grey long-sleeve henley, dark indigo jeans and brown leather boots",
  polo: "a navy piqué polo shirt, khaki chinos and brown suede loafers",
  buttondown: "a light blue oxford button-down shirt tucked into grey wool trousers, a brown leather belt and brown derby shoes",
  quarterzip: "a charcoal merino quarter-zip sweater over a white t-shirt, dark navy chinos and white leather sneakers",
  vest: "a white dress shirt with sleeves rolled once, a charcoal waistcoat, grey trousers and black oxford shoes",
  blazer: "a tailored navy blazer over a white dress shirt, grey trousers and brown leather oxford shoes",
  suit: "a tailored charcoal three-piece suit, a white dress shirt, a deep burgundy tie and polished black oxford shoes",
};

function rgb(hex: string) {
  const n = parseInt(hex.replace("#", ""), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The photographed skin tone nearest to any stored hex. */
export function skinKey(hex: string): string {
  const [r, g, b] = rgb(hex);
  let best: string = PHOTO_SKINS[1].key;
  let bestD = Infinity;
  for (const s of PHOTO_SKINS) {
    const [r2, g2, b2] = rgb(s.hex);
    const d = (r - r2) ** 2 + (g - g2) ** 2 + (b - b2) ** 2;
    if (d < bestD) {
      bestD = d;
      best = s.key;
    }
  }
  return best;
}

export function characterSrc(skin: string, hair: HairStyle, outfit: BaseOutfit) {
  return `${ART_BASE}/char/${skinKey(skin)}-${hair}-${outfit}.webp`;
}

/**
 * While a set is still being generated (or if one image failed), a missing photo falls back to the
 * default person in the same outfit, then in the T-shirt. Used by <img onError>.
 */
export function fallbackSrc(failed: string): string | null {
  const m = failed.match(/\/char\/s\d-[a-z]+-([a-z]+)\.webp$/);
  if (!m) return null;
  const sameOutfit = `${ART_BASE}/char/s2-short-${m[1]}.webp`;
  return failed.endsWith(sameOutfit) ? (m[1] === "tee" ? null : `${ART_BASE}/char/s2-short-tee.webp`) : sameOutfit;
}

/** Hides an image that failed to load, after trying the character fallbacks above. */
export function onPhotoError(e: { currentTarget: HTMLImageElement }) {
  const img = e.currentTarget;
  const next = fallbackSrc(img.src);
  if (next && !img.src.endsWith(next)) img.src = next;
  else img.style.visibility = "hidden";
}

export function itemSrc(itemId: string) {
  return `${ART_BASE}/items/${itemId}.webp`;
}

/** An estate area at a tier (0 is the starting state). */
export function areaSrc(area: string, tier: number) {
  return `${ART_BASE}/estate/${area}-${tier}.webp`;
}

/** The estate grounds grow with level alone; these are the levels where the overview changes. */
export const ESTATE_STAGES = [1, 3, 5, 7, 10, 15, 20] as const;

export function estateStage(level: number) {
  return [...ESTATE_STAGES].reverse().find((s) => level >= s) ?? 1;
}

export function estateSrc(level: number) {
  return `${ART_BASE}/estate/overview-${estateStage(level)}.webp`;
}
