"use client";

import { CONSEQUENCE_POLICY_V1 } from "@/lib/meros/config";
import { LEVEL_UNLOCKS, unlockLabel } from "@/lib/meros/content/appearance";
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
    <div className="flex flex-col gap-6">
      <h1 className="font-display text-[2.25rem] leading-none">Progress</h1>
      <section className="flex flex-col gap-2">
        <p className="font-display text-[2rem] leading-none">Level {p.progress.level} · {p.progress.xpTotal} XP</p>
        <ProgressBar value={p.progress.intoLevel} max={p.progress.levelSpan || 1} label="Level progress" className="mt-1" />
        <p className="text-[0.9375rem]">
          {p.progress.nextLevelAt ? `${p.progress.nextLevelAt - p.progress.xpTotal} XP to Level ${p.progress.level + 1}. ` : "Top level reached. "}
          {p.progress.level >= 10
            ? ""
            : days === null
              ? "Add a task to see an estimate for Level 10."
              : `Level 10 in about ${Math.ceil(days)} days at your current schedule.`}
        </p>
        <p className="hint inline-flex items-center gap-1.5">
          <Icon name="check" className="h-4 w-4" /> XP only from finished tasks · 3 a day ≈ {REFERENCE_XP_PER_DAY} XP
        </p>
      </section>

      <section className="rule py-4" aria-labelledby="curve">
        <h2 id="curve" className="font-display text-xl">The level curve</h2>
        <ul className="mt-2 flex flex-col gap-1.5">
          {levels.map((l) => {
            const reached = p.progress.level >= l;
            const unlockText = (() => { const u = LEVEL_UNLOCKS.find((x) => x.level === l); return u ? unlockLabel(u) : null; })();
            return (
              <li key={l} className="grid grid-cols-[3.25rem_1fr_4.5rem] items-center gap-2 text-sm">
                <span className="font-extrabold">L{l}</span>
                <span className="flex min-w-0 flex-col">
                  <span className={`h-2.5 origin-left rounded-full border border-blood ${reached ? "bg-blood" : "bg-white"}`} style={{ width: `${Math.max(6, (marginalCost(l) / maxCost) * 100)}%`, animation: "m-grow-x 500ms var(--ease-out-expo) backwards", animationDelay: `${(l - 2) * 18}ms` }} />
                  {unlockText && <span className="hint truncate">{unlockText}</span>}
                </span>
                <span className="text-right font-bold">{xpToReach(l)}</span>
              </li>
            );
          })}
        </ul>
      </section>

      <section id="vitality" className="rule flex flex-col gap-2 py-4" aria-labelledby="vit">
        <h2 id="vit" className="font-display text-xl">
          <Icon name="heart" className="mr-1 inline h-5 w-5" /> Vitality {p.vitality}/100
        </h2>
        <ul className="flex flex-col gap-1.5 text-[0.9375rem]">
          <li className="flex items-center gap-2"><Icon name="plus" className="h-4 w-4 shrink-0" /> +{CONSEQUENCE_POLICY_V1.restorePerMinimum} per task done (max +{CONSEQUENCE_POLICY_V1.restoreDailyCap}/day)</li>
          <li className="flex items-center gap-2"><Icon name="bolt" className="h-4 w-4 shrink-0" /> 3 misses in a row pauses that streak</li>
          <li className="flex items-center gap-2"><Icon name="x" className="h-4 w-4 shrink-0" /> 5th miss −2 · 6th −3 · then −4 (max −{p.dailyPenaltyCap}/day, floor {CONSEQUENCE_POLICY_V1.vitalityMin})</li>
          <li className="flex items-center gap-2"><Icon name="lock" className="h-4 w-4 shrink-0" /> Never touches XP, level, buildings, items · battles ×{p.vitalityModifier.toFixed(2)}</li>
        </ul>
        <h3 className="mt-2 font-extrabold">Recent changes</h3>
        <ul className="m-list flex flex-col divide-y divide-blood">
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
