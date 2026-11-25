"use client";

import { CONSEQUENCE_POLICY_V1, DETERIORATION_SCOPE } from "@/lib/meros/config";
import { LEVEL_UNLOCKS } from "@/lib/meros/content/appearance";
import { marginalCost, REFERENCE_XP_PER_DAY, xpToReach } from "@/lib/meros/domain/levels";
import { useGame } from "../GameProvider";
import { formatDay, Icon, ProgressBar } from "../ui";

export default function Progress() {
  const v = useGame().view!;
  const p = v.profile;
  const levels = Array.from({ length: 19 }, (_, i) => i + 2);
  const maxCost = marginalCost(20);
  const days = p.estimatedDaysToLevel10;

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-2xl font-semibold">Progress</h1>
      <section className="card flex flex-col gap-2 p-4">
        <p className="font-display text-xl font-semibold">Level {p.progress.level} · {p.progress.xpTotal} XP</p>
        <ProgressBar value={p.progress.intoLevel} max={p.progress.levelSpan || 1} color="var(--color-gold)" label="Level progress" />
        <p className="hint">
          {p.progress.nextLevelAt ? `${p.progress.nextLevelAt - p.progress.xpTotal} XP to Level ${p.progress.level + 1}.` : "Top level reached."} XP comes only from real-world quests: never from chests, battles, or opening the app.
        </p>
        <p className="text-[0.9375rem]">
          {p.progress.level >= 10
            ? "Level 10 reached."
            : days === null
              ? "Add a quest to see an estimate for Level 10."
              : `At your current schedule (${p.schedulePaceXpPerDay} XP/day from minimums alone), Level 10 is about ${Math.ceil(days)} days away.`}{" "}
          The reference pace is three daily minimums ({REFERENCE_XP_PER_DAY} XP/day) ≈ 90 days to Level 10. It’s an estimate, not a promise: optional effort speeds it up; misses slow it down. Thresholds never move.
        </p>
      </section>

      <section className="card p-4" aria-labelledby="curve">
        <h2 id="curve" className="font-display text-lg font-semibold">The level curve</h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {levels.map((l) => {
            const reached = p.progress.level >= l;
            const unlock = LEVEL_UNLOCKS.find((u) => u.level === l);
            return (
              <li key={l} className="grid grid-cols-[3.25rem_1fr_4.5rem] items-center gap-2 text-sm">
                <span className={`font-extrabold ${reached ? "text-gold" : ""}`}>L{l}</span>
                <span className="flex min-w-0 flex-col">
                  <span className="h-2.5 rounded-full" style={{ width: `${Math.max(6, (marginalCost(l) / maxCost) * 100)}%`, background: reached ? "var(--color-gold)" : "var(--color-line)" }} />
                  {unlock && <span className="hint truncate">{unlock.label}{unlock.estate ? ` · ${unlock.estate}` : ""}</span>}
                </span>
                <span className="text-right font-bold text-muted">{xpToReach(l)}</span>
              </li>
            );
          })}
        </ul>
        <p className="hint mt-2">Each level costs more than the last. XP is cumulative and never resets.</p>
      </section>

      <section id="vitality" className="card flex flex-col gap-2 p-4" aria-labelledby="vit">
        <h2 id="vit" className="font-display text-lg font-semibold">
          <Icon name="heart" className="mr-1 inline h-5 w-5" /> Vitality {p.vitality}/100
        </h2>
        <p className="text-[0.9375rem]">
          Vitality reflects recent consistency. It affects only {DETERIORATION_SCOPE.affects.join(", ")} (battle stats ×{p.vitalityModifier.toFixed(2)}). It never touches {DETERIORATION_SCOPE.neverAffects.join(", ")}.
        </p>
        <ul className="hint list-disc pl-5">
          <li>1–2 misses in a row on a quest: nothing happens.</li>
          <li>3–4: that quest’s momentum bonus pauses until you complete it again.</li>
          <li>5th: −2 · 6th: −3 · 7th and beyond: −4 each.</li>
          <li>At most −{p.dailyPenaltyCap} per day across all quests; never below {CONSEQUENCE_POLICY_V1.vitalityMin}.</li>
          <li>Every verified minimum restores +{CONSEQUENCE_POLICY_V1.restorePerMinimum} (up to +{CONSEQUENCE_POLICY_V1.restoreDailyCap} a day). Coming back always works.</li>
          <li>Rest days, pauses, technical problems, and skipped optional work are never misses.</li>
        </ul>
        <h3 className="mt-2 font-extrabold">Recent changes</h3>
        <ul className="flex flex-col divide-y divide-line">
          {v.consequences.length === 0 && <li className="hint py-2">Nothing yet.</li>}
          {v.consequences.slice(0, 15).map((c) => (
            <li key={c.id} className="flex items-start justify-between gap-3 py-2 text-[0.9375rem]">
              <span>{c.explanation}</span>
              <span className="hint shrink-0">{formatDay(c.createdAt)}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
