"use client";

import { useEffect } from "react";
import { type Celebration, useGame } from "./GameProvider";
import { Icon } from "./ui";

const STYLE: Record<Celebration["kind"], { bg: string; icon: string }> = {
  verify: { bg: "bg-mint-soft", icon: "check" },
  chest: { bg: "bg-sun-soft", icon: "chest" },
  levelup: { bg: "bg-grape-soft", icon: "star" },
  victory: { bg: "bg-sky-soft", icon: "trophy" },
  info: { bg: "bg-cloud", icon: "info" },
};

/**
 * Short, non-blocking celebrations. They sit at the top, away from the check-in buttons, auto-
 * dismiss, and can be closed. Several level-ups from one award arrive as ONE card ("Level 3 → 5").
 */
export default function Celebrations() {
  const { celebrations, dismiss } = useGame();
  useEffect(() => {
    const timers = celebrations.map((c) => setTimeout(() => dismiss(c.id), c.kind === "levelup" ? 9000 : 6000));
    return () => timers.forEach(clearTimeout);
  }, [celebrations, dismiss]);
  if (!celebrations.length) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.75rem)] z-50 flex flex-col items-center gap-2 px-4">
      {celebrations.map((c) => {
        const s = STYLE[c.kind];
        return (
          <div key={c.id} className={`earned-pop pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-3xl ${s.bg} p-4 shadow-[var(--shadow-pop)]`}>
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white">
              <Icon name={s.icon} className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold">{c.title}</p>
              {c.lines.map((l, i) => (
                <p key={i} className="text-[0.9375rem] text-ink-soft">
                  {l}
                </p>
              ))}
            </div>
            <button type="button" className="btn btn-ghost -mt-1 -mr-2 h-10 min-h-0 w-10 px-0" aria-label="Dismiss" onClick={() => dismiss(c.id)}>
              <Icon name="x" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
