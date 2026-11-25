"use client";

import { useEffect } from "react";
import { type Celebration, useGame } from "./GameProvider";
import { Count, Sparks } from "./motion";
import { Icon } from "./ui";

const ICON: Record<Celebration["kind"], string> = { verify: "check", chest: "chest", levelup: "star", victory: "trophy", info: "info", money: "coin" };
const MILESTONE = new Set<Celebration["kind"]>(["levelup", "victory", "chest", "money"]);

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
  const level = celebrations.find((c) => c.kind === "levelup");
  return (
    <>
      {level && <LevelUp key={level.id} title={level.title} lines={level.lines} to={level.levels?.at(-1) ?? 0} onDone={() => dismiss(level.id)} />}
      <Toasts celebrations={celebrations.filter((c) => c.kind !== "levelup")} dismiss={dismiss} />
    </>
  );
}

/**
 * A level-up takes the whole screen for a moment: red, slow rays, the number slamming in with a ring
 * of white sparks, then what it unlocked. Tap anywhere (or wait) to carry on.
 */
function LevelUp({ title, lines, to, onDone }: { title: string; lines: string[]; to: number; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 4200);
    return () => clearTimeout(t);
  }, [onDone]);
  return (
    <button type="button" onClick={onDone} aria-label={`${title} Tap to continue.`} className="m-fade fixed inset-0 z-50 grid place-items-center overflow-hidden bg-blood text-white">
      <span aria-hidden="true" className="m-rays absolute h-[160vmax] w-[160vmax] bg-[repeating-conic-gradient(white_0deg_5deg,transparent_5deg_24deg)] opacity-10" />
      <span className="relative flex flex-col items-center gap-2 px-8 text-center">
        <span className="m-rise font-display text-2xl tracking-[0.3em]">Level up</span>
        <span className="relative grid place-items-center">
          <span aria-hidden="true" className="m-ring absolute h-40 w-40 rounded-full border-4 border-white" />
          <Sparks count={24} distance={160} delay={200} color="white" />
          <span className="m-slam font-display text-[9rem] leading-none [animation-delay:150ms]">
            <Count value={to} />
          </span>
        </span>
        {lines.map((l, i) => (
          <span key={i} className="m-rise text-lg font-bold" style={{ animationDelay: `${600 + i * 120}ms` }}>
            {l}
          </span>
        ))}
        <span className="m-fade mt-6 text-sm [animation-delay:1400ms]">Tap to continue</span>
      </span>
    </button>
  );
}

function Toasts({ celebrations, dismiss }: { celebrations: Celebration[]; dismiss: (id: string) => void }) {
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
