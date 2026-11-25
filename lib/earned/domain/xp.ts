import { XP_RULES } from "../config";

/**
 * XP for a quest: half of max XP for the verified minimum (attendance, awarded immediately and
 * irreversibly) and up to the other half as a self-rated effort bonus for optional work.
 */

export function isValidMaxXp(maxXp: unknown): maxXp is number {
  return (
    typeof maxXp === "number" &&
    Number.isInteger(maxXp) &&
    maxXp >= XP_RULES.minMaxXp &&
    maxXp <= XP_RULES.maxMaxXp &&
    maxXp % 2 === 0
  );
}

export function attendanceXp(maxXp: number): number {
  if (!isValidMaxXp(maxXp)) throw new Error("maxXp must be a positive even integer within limits");
  return maxXp / 2;
}

export function isValidEffortRating(rating: unknown): rating is number {
  return (
    typeof rating === "number" &&
    Number.isInteger(rating) &&
    rating >= XP_RULES.effortRating.min &&
    rating <= XP_RULES.effortRating.max
  );
}

/**
 * round((rating / 10) * (maxXp / 2)), half rounding up. No rating means no bonus.
 * The rating is self-reported: photo/GPS evidence verifies only the minimum, never effort.
 */
export function effortBonusXp(rating: number | null | undefined, maxXp: number): number {
  if (rating === null || rating === undefined) return 0;
  if (!isValidEffortRating(rating)) throw new Error("rating must be an integer 1–10");
  const half = attendanceXp(maxXp);
  // Integer arithmetic avoids float drift: (rating * half) / 10, rounded half-up.
  return Math.floor((rating * half * 2 + 10) / 20);
}

export const EFFORT_ANCHORS: Record<number, string> = {
  1: "Barely engaged",
  5: "Partial effort",
  10: "Focused effort toward the extension",
};
