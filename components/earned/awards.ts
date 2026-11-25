"use client";

import { LEVEL_UNLOCKS } from "@/lib/earned/content/appearance";
import type { AwardSummary } from "@/lib/earned/service/awards";
import type { Celebration } from "./GameProvider";
import type { Cue } from "@/lib/earned/client/sound";

type Celebrate = (c: Omit<Celebration, "id">, cue?: Cue) => void;

/** One consolidated celebration per award, plus one for any levels crossed (never a stack). */
export function celebrateAward(celebrate: Celebrate, award: AwardSummary, title: string) {
  const lines = [`+${award.xp} XP for showing up.`];
  if (award.chestEarned) lines.push("A treasure chest is ready to open!");
  else lines.push(`Chest progress ${award.chestProgress}/3.`);
  if (award.ticketEarned) lines.push("+1 Ventures ticket.");
  else if (award.ticketNote) lines.push(award.ticketNote);
  if (award.vitalityRestored) lines.push(`Vitality +${award.vitalityRestored}.`);
  if (award.momentumBonus) lines.push(`Momentum bonus +${award.momentumBonus} Estate Credits.`);
  for (const r of award.rewardsUnlocked) lines.push(`Reward unlocked: ${r}.`);
  celebrate({ kind: "verify", title: `${title}: verified`, lines }, "verify");
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
            ...unlocks.map((u) => `Unlocked: ${u.label}${u.estate ? ` · ${u.estate}` : ""}`),
            "Pick new looks in Profile.",
          ],
          levels,
        },
        "levelup",
      ),
    450,
  );
}
