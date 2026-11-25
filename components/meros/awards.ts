"use client";

import { LEVEL_UNLOCKS, unlockLabel } from "@/lib/meros/content/appearance";
import type { AwardSummary } from "@/lib/meros/service/awards";
import type { Celebration } from "./GameProvider";
import type { Cue } from "@/lib/meros/client/sound";

type Celebrate = (c: Omit<Celebration, "id">, cue?: Cue) => void;

/** One consolidated celebration per award, plus one for any levels crossed (never a stack). */
export function celebrateAward(celebrate: Celebrate, award: AwardSummary, title: string) {
  // One line of gains, then only what changed state: a chest, a reward.
  const gains = [`+${award.xp} XP`];
  if (award.ticketEarned) gains.push("+1 ticket");
  if (award.momentumBonus) gains.push(`+${award.momentumBonus} credits`);
  if (award.vitalityRestored) gains.push(`+${award.vitalityRestored} vitality`);
  const lines = [gains.join(" · ")];
  if (award.chestEarned) lines.push("A chest is ready to open.");
  for (const r of award.rewardsUnlocked) lines.push(`Reward unlocked: ${r}.`);
  celebrate({ kind: "verify", title: `${title}: done`, lines }, "verify");
  if (award.levelsGained.length) celebrateLevels(celebrate, award.levelsGained);
}

export function celebrateLevels(celebrate: Celebrate, levels: number[]) {
  const from = levels[0] - 1;
  const to = levels[levels.length - 1];
  const unlocks = LEVEL_UNLOCKS.filter((u) => levels.includes(u.level));
  setTimeout(
    () =>
      celebrate(
        {
          kind: "levelup",
          title: levels.length > 1 ? `Level ${from} → ${to}!` : `Level ${to}!`,
          lines: [
            ...unlocks.map(unlockLabel).filter(Boolean).map((l) => `Unlocked: ${l}`),
          ],
          levels,
        },
        "levelup",
      ),
    450,
  );
}
