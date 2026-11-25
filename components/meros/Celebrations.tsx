"use client";

import { useEffect } from "react";
import { type Celebration, useGame } from "./GameProvider";
import { Icon } from "./ui";

const ICON: Record<Celebration["kind"], string> = { verify: "check", chest: "chest", levelup: "star", victory: "trophy", info: "info" };
const MILESTONE = new Set<Celebration["kind"]>(["levelup", "victory", "chest"]);

/**
 * Short, non-blocking celebrations at the top, away from the check-in buttons. They spring in,
 * auto-dismiss, and can be closed. Milestones (level-ups, victories, chests) get the solid red
 * card and a single expanding ring: decisive, then gone. Several levels from one award arrive as
 * ONE card ("Level 3 → 5").
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
        const solid = MILESTONE.has(c.kind);
        return (
          <div
            key={c.id}
            className={`m-toast pointer-events-auto relative flex w-full max-w-md items-start gap-3 rounded-2xl border border-blood p-4 ${solid ? "bg-blood text-white" : "bg-white"}`}
          >
            <span className="relative grid h-10 w-10 shrink-0 place-items-center">
              {solid && <span aria-hidden="true" className="m-ring absolute inset-0 rounded-full border-2 border-white" />}
              <span className={`m-pop grid h-10 w-10 place-items-center rounded-full ${solid ? "bg-white text-blood" : "bg-blood text-white"}`}>
                <Icon name={ICON[c.kind]} className="h-5 w-5" strokeWidth={2.6} />
              </span>
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-xl leading-tight">{c.title}</p>
              {c.lines.map((l, i) => (
                <p key={i} className="m-rise text-[0.9375rem]" style={{ animationDelay: `${80 + i * 40}ms` }}>
                  {l}
                </p>
              ))}
            </div>
            <button type="button" className={`btn btn-ghost -mt-1 -mr-2 h-10 min-h-0 w-10 px-0 ${solid ? "text-white" : ""}`} aria-label="Dismiss" onClick={() => dismiss(c.id)}>
              <Icon name="x" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
