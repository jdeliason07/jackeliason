"use client";

import { useEffect } from "react";
import { type Celebration, useGame } from "./GameProvider";
import { Icon } from "./ui";

const STYLE: Record<Celebration["kind"], { rail: string; icon: string; tint: string }> = {
  verify: { rail: "bg-blood", icon: "check", tint: "text-blood-bright" },
  chest: { rail: "bg-gold", icon: "chest", tint: "text-gold" },
  levelup: { rail: "bg-gold", icon: "star", tint: "text-gold" },
  victory: { rail: "bg-gold", icon: "trophy", tint: "text-gold" },
  info: { rail: "bg-line", icon: "info", tint: "text-fg-soft" },
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
    <div aria-live="polite" className="pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+3.75rem)] z-30 flex flex-col items-center gap-2 px-4">
      {celebrations.map((c) => {
        const s = STYLE[c.kind];
        return (
          <div key={c.id} className="meros-pop pointer-events-auto relative flex w-full max-w-md items-start gap-3 overflow-hidden rounded-2xl border border-line bg-surface p-4 pl-5 shadow-[var(--shadow-pop)]">
            <span className={`absolute inset-y-0 left-0 w-1 ${s.rail}`} aria-hidden="true" />
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-raised ${s.tint}`}>
              <Icon name={s.icon} className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold">{c.title}</p>
              {c.lines.map((l, i) => (
                <p key={i} className="text-[0.9375rem] text-fg-soft">
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
