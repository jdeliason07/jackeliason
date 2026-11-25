"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import type { DueView, GameView } from "@/lib/meros/service/view";
import Character from "../art/Character";
import ChestArt from "../art/ChestArt";
import ChestSheet from "../ChestSheet";
import { useAction, useGame } from "../GameProvider";
import { Count } from "../motion";
import RatingSheet from "../RatingSheet";
import { Empty, formatTime, Icon, Note, ProgressBar } from "../ui";
import VerifySheet from "../VerifySheet";

export default function Today() {
  const { view } = useGame();
  const v = view!;
  const [verifying, setVerifying] = useState<DueView | null>(null);
  const [chest, setChest] = useState<GameView["chests"]["unopened"][number] | null>(null);
  const [rating, setRating] = useState<DueView | null>(null);
  const due = v.today.due.filter((d) => !(d.status === "lapsed" || (d.status === "excused" && d.phase === "closed" && d.localDate !== v.today.localDate)));
  const sessions = due.filter((d) => d.optionalStatus === "active");
  const equipped = v.inventory.filter((i) => i.equipped).map((i) => i.itemId);
  const p = v.profile;
  const latestLoss = v.consequences.find((c) => c.kind === "vitality_loss" && c.delta < 0);
  const secured = due.filter((d) => d.status === "completed").length;
  // The screen's one focal action: the first check-in that's open now. Every other check-in is outlined.
  const focal = due.find((d) => d.status !== "completed" && d.phase === "open")?.occurrenceId;
  const unopened = v.chests.unopened[0];

  return (
    <div className="flex flex-col gap-8">
      {/* Character: the avatar, the name, the level bar. Nothing else. */}
      <section aria-label="Your character" className="flex items-center gap-4">
        <Link href={`${APP_BASE_PATH}/collection`} aria-label="Open collection and equipment" className="shrink-0 rounded-xl transition-transform duration-300 ease-spring active:scale-95">
          <Character appearance={p.appearance} equipped={equipped} level={p.progress.level} energy={p.energy} className="h-[112px] w-[94px]" animate />
        </Link>
        <Link href={`${APP_BASE_PATH}/progress`} className="min-w-0 flex-1 rounded-lg">
          <p className="truncate font-display text-[1.625rem] leading-none">{p.displayName}</p>
          <p className="mt-2 flex items-baseline justify-between gap-2 text-sm font-bold">
            <span>
              Level <Count value={p.progress.level} />
            </span>
            <span>
              {p.progress.nextLevelAt ? (
                <>
                  <Count value={p.progress.intoLevel} />/{p.progress.levelSpan} XP
                </>
              ) : (
                "Max level"
              )}
            </span>
          </p>
          <ProgressBar value={p.progress.intoLevel} max={p.progress.levelSpan || 1} label={`Progress to level ${p.progress.level + 1}`} className="mt-1.5" />
          {p.vitality < 100 && (
            <p className="mt-2 flex items-center gap-1 text-sm font-bold">
              <Icon name="heart" className="h-4 w-4" /> Vitality <Count value={p.vitality} />
            </p>
          )}
        </Link>
      </section>

      {latestLoss && p.vitality < 100 && (
        <Note tone="warn">
          {latestLoss.explanation}{" "}
          <Link href={`${APP_BASE_PATH}/progress#vitality`} className="font-extrabold underline decoration-2 underline-offset-4">
            How to recover
          </Link>
        </Note>
      )}

      <section aria-labelledby="due-heading" className="flex flex-col">
        <div className="flex items-baseline justify-between pb-2">
          <h1 id="due-heading" className="font-display text-[2.25rem] leading-none">
            Today
          </h1>
          <span className="font-display text-xl" aria-label={`${secured} of ${due.length} secured`}>
            <Count value={secured} />/{due.length}
          </span>
        </div>
        {due.length === 0 && (
          <Empty
            title="Nothing due"
            action={
              <Link href={`${APP_BASE_PATH}/quests/new`} className="btn btn-primary">
                <Icon name="plus" /> Add a quest
              </Link>
            }
          >
            {v.quests.some((q) => q.status === "active") ? "Rest days count as rest, not misses." : "Pick 3–5 small quests to start."}
          </Empty>
        )}
        <ul className="m-list flex flex-col">
          {due.map((d) => (
            <li key={d.occurrenceId} className="rule">
              <DueCard due={d} focal={d.occurrenceId === focal} timezone={p.timezone} onVerify={() => setVerifying(d)} onRate={() => setRating(d)} />
            </li>
          ))}
        </ul>
      </section>

      {sessions.length > 0 && (
        <section aria-labelledby="sessions-heading" className="flex flex-col gap-3">
          <h2 id="sessions-heading" className="font-display text-xl">
            In progress
          </h2>
          {sessions.map((d) => (
            <div key={d.occurrenceId} className="rule flex flex-col gap-3 pt-3">
              <div>
                <p className="font-display text-lg leading-tight">{d.title}</p>
                <p className="hint">
                  {d.extension} · until {formatTime(d.closesAt, p.timezone)}
                </p>
              </div>
              <SessionActions due={d} onFinish={() => setRating(d)} />
            </div>
          ))}
        </section>
      )}

      {/* The next chest: one bar, one count, and the button when one is waiting. */}
      <section aria-labelledby="chest-heading" className="rule flex flex-col gap-4 pt-4">
        <div className="flex items-center gap-4">
          <span className={unopened ? "m-nudge" : ""}>
            <ChestArt className={`h-14 w-14 shrink-0 ${unopened ? "m-breathe" : ""}`} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id="chest-heading" className="flex items-baseline justify-between font-display text-lg">
              <span>{v.chests.unopened.length ? `${v.chests.unopened.length} chest${v.chests.unopened.length > 1 ? "s" : ""} ready` : "Next chest"}</span>
              <span className="text-base">
                <Count value={v.chests.progress} />/{v.chests.perChest}
              </span>
            </h2>
            <ProgressBar value={v.chests.progress} max={v.chests.perChest} label="Chest progress" className="mt-1.5" />
          </div>
        </div>
        {unopened && (
          <button className="btn btn-secondary w-full" onClick={() => setChest(unopened)}>
            <Icon name="chest" /> Open chest #{unopened.seq}
          </button>
        )}
      </section>

      {verifying && <VerifySheet due={verifying} onClose={() => setVerifying(null)} />}
      {chest && <ChestSheet chest={chest} onClose={() => setChest(null)} />}
      {rating?.sessionId && <RatingSheet sessionId={rating.sessionId} title={rating.title} maxXp={rating.maxXp} onClose={() => setRating(null)} />}
    </div>
  );
}

function SessionActions({ due, onFinish }: { due: DueView; onFinish: () => void }) {
  const action = useAction();
  return (
    <div className="grid grid-cols-2 gap-2">
      <button className="btn btn-primary" onClick={onFinish}>
        <Icon name="check" /> Finish
      </button>
      <button
        className="btn btn-secondary"
        disabled={action.pending}
        onClick={() => due.sessionId && void action.execute({ type: "finishOptional", sessionId: due.sessionId, rating: null })}
      >
        Done for today
      </button>
    </div>
  );
}

function DueCard({ due, focal, timezone, onVerify, onRate }: { due: DueView; focal: boolean; timezone: string; onVerify: () => void; onRate: () => void }) {
  const game = useGame();
  const start = useAction<{ sessionId: string }>();
  const decline = useAction();
  const done = due.status === "completed";
  const window = `${formatTime(due.opensAt, timezone)}–${formatTime(due.closesAt, timezone)}`;
  const attempt = due.lastAttempt;

  async function retry() {
    if (!attempt) return;
    try {
      const r = await game.retryPhoto(attempt.attemptId);
      if (r.status === "accepted") game.sound("verify");
    } catch {
      // surfaced by provider error state
    }
  }

  return (
    <article className="flex flex-col gap-3 py-4" aria-label={due.title}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-display text-xl leading-tight">{due.title}</h3>
          <p className="mt-0.5 text-[0.9375rem] font-normal">{due.minimumAction}</p>
          <p className="mt-1.5 flex flex-wrap items-center gap-x-1.5 text-[0.8125rem] font-bold">
            <Icon name={due.mode === "photo" ? "camera" : "pin"} className="h-3.5 w-3.5" /> {window}
            {due.weekly && <span>· {due.weekly.completed}/{due.weekly.target} this week</span>}
            {due.momentum.status === "active" && <span>· Momentum</span>}
          </p>
        </div>
        {done ? (
          <span key="done" className="m-pop chip chip-solid shrink-0">
            <Icon name="check" className="h-4 w-4" strokeWidth={3} /> Done
          </span>
        ) : (
          <span className="shrink-0 font-display text-lg">+{due.attendanceXp} XP</span>
        )}
      </div>

      {!done && attempt && attempt.status !== "accepted" && (
        <Note tone={attempt.status === "unavailable" || attempt.status === "pending" ? "warn" : "error"}>
          {attempt.reason}
          {attempt.guidance ? ` ${attempt.guidance}` : ""}
          {due.inconclusiveCount >= 3 && " Better light, the whole object in frame, and a steady hand usually fix it."}
        </Note>
      )}

      {!done && due.phase === "open" && attempt?.retryable ? (
        <button className={`btn w-full ${focal ? "btn-primary" : "btn-secondary"}`} onClick={() => void retry()}>
          <Icon name="refresh" /> Retry check
        </button>
      ) : !done && due.phase === "open" ? (
        <button className={`btn w-full ${focal ? "btn-primary min-h-14 text-lg" : "btn-secondary"}`} onClick={onVerify}>
          <Icon name={due.mode === "photo" ? "camera" : "pin"} /> Check in
        </button>
      ) : !done && due.phase === "upcoming" ? (
        <p className="text-sm font-bold">Opens {formatTime(due.opensAt, timezone)}</p>
      ) : !done ? (
        <p className="text-sm font-bold">{due.status === "missed" ? "Window closed. Tomorrow is a fresh start." : due.status === "excused" ? "Excused (not counted as a miss)." : "Window closed."}</p>
      ) : due.optionalStatus === "none" && due.phase === "open" ? (
        <div className="m-rise flex flex-col gap-2">
          <p className="text-sm font-normal">Optional: {due.extension}</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              className="btn btn-secondary"
              disabled={start.pending}
              onClick={async () => {
                const r = await start.execute({ type: "startOptional", occurrenceId: due.occurrenceId });
                if (r) game.sound("tap");
              }}
            >
              Keep going
            </button>
            <button className="btn btn-ghost" disabled={decline.pending} onClick={() => void decline.execute({ type: "declineOptional", occurrenceId: due.occurrenceId })}>
              Done for today
            </button>
          </div>
        </div>
      ) : due.optionalStatus === "active" ? (
        <button className="btn btn-secondary w-full" onClick={onRate}>
          Finish optional work
        </button>
      ) : (
        <p className="m-rise text-sm font-bold">{due.optionalStatus === "finished" ? "Minimum + extra effort logged." : "Minimum complete. That's the win."}</p>
      )}
      {(start.error || decline.error) && <p className="text-sm font-bold">{(start.error ?? decline.error)!.message}</p>}
    </article>
  );
}
