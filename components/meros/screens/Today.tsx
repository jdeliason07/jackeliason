"use client";

import Link from "next/link";
import { useState } from "react";
import { APP_BASE_PATH, APP_MOTTO } from "@/lib/meros/config";
import { CATEGORY_INFO } from "@/lib/meros/content/templates";
import type { DueView, GameView } from "@/lib/meros/service/view";
import Character from "../art/Character";
import RiseArrow from "../art/RiseArrow";
import ChestArt from "../art/ChestArt";
import ChestSheet from "../ChestSheet";
import { useAction, useGame } from "../GameProvider";
import RatingSheet from "../RatingSheet";
import { Empty, formatTime, Icon, Note, ProgressBar } from "../ui";
import VerifySheet from "../VerifySheet";

const ENERGY_LABEL = { radiant: "Radiant", steady: "Steady", tired: "Tired", drained: "Low energy" } as const;

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

  return (
    <div className="flex flex-col gap-4">
      {/* 1 · Character */}
      <section aria-label="Your character" className="red-surface relative flex items-center gap-3 overflow-hidden rounded-2xl p-3 shadow-[var(--shadow-card)]">
        <RiseArrow opacity={0.85} />
        <Link href={`${APP_BASE_PATH}/collection`} aria-label="Open collection and equipment" className="relative shrink-0 rounded-xl">
          <Character appearance={p.appearance} equipped={equipped} level={p.progress.level} energy={p.energy} className="h-[118px] w-[98px]" animate />
        </Link>
        <div className="relative min-w-0 flex-1">
          <p className="eyebrow text-bone/80">{APP_MOTTO}</p>
          <p className="truncate font-display text-[1.375rem] leading-tight">{p.displayName}</p>
          <Link href={`${APP_BASE_PATH}/progress`} className="mt-0.5 flex min-h-8 items-center gap-2 rounded-lg">
            <span className="chip bg-black/30 text-bone">Level {p.progress.level}</span>
            <span className="text-sm font-bold text-bone/85">
              {p.progress.nextLevelAt ? `${p.progress.intoLevel}/${p.progress.levelSpan} XP` : "Max level"}
            </span>
          </Link>
          <ProgressBar value={p.progress.intoLevel} max={p.progress.levelSpan || 1} color="var(--color-bone)" track="bg-black/35" label={`Progress to level ${p.progress.level + 1}`} className="mt-1.5" />
          <Link href={`${APP_BASE_PATH}/progress#vitality`} className="mt-2 flex min-h-8 items-center gap-2 rounded-lg text-sm font-bold">
            <span className="chip bg-black/30 text-bone">
              <Icon name="heart" className="h-4 w-4" /> Vitality {p.vitality}
            </span>
            <span className="text-bone/85">{ENERGY_LABEL[p.energy]}</span>
          </Link>
        </div>
      </section>

      {latestLoss && p.vitality < 100 && (
        <Note tone="warn">
          {latestLoss.explanation}{" "}
          <Link href={`${APP_BASE_PATH}/progress#vitality`} className="font-extrabold underline">
            Why and how to recover
          </Link>
        </Note>
      )}

      {/* 2 · Due quests */}
      <section aria-labelledby="due-heading" className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h1 id="due-heading" className="font-display text-2xl font-semibold">
            Today
          </h1>
          <span className="text-sm font-bold text-muted">
            {due.filter((d) => d.status === "completed").length}/{due.length} secured
          </span>
        </div>
        {due.length === 0 && (
          <Empty
            title="Nothing due right now"
            action={
              <Link href={`${APP_BASE_PATH}/quests/new`} className="btn btn-primary">
                <Icon name="plus" /> Add a quest
              </Link>
            }
          >
            {v.quests.some((q) => q.status === "active") ? "Rest days count as rest, not misses." : "Pick 3–5 small quests to start. The minimum is all that's required."}
          </Empty>
        )}
        {due.map((d) => (
          <DueCard key={d.occurrenceId} due={d} timezone={p.timezone} onVerify={() => setVerifying(d)} onRate={() => setRating(d)} />
        ))}
      </section>

      {/* 3 · Optional sessions */}
      {sessions.length > 0 && (
        <section aria-labelledby="sessions-heading" className="flex flex-col gap-3">
          <h2 id="sessions-heading" className="font-display text-xl font-semibold">
            Optional work in progress
          </h2>
          {sessions.map((d) => (
            <div key={d.occurrenceId} className="card flex flex-col gap-3 p-4">
              <div>
                <p className="font-extrabold">{d.title}</p>
                <p className="hint">
                  Extension: {d.extension}. Started {d.sessionStartedAt ? formatTime(d.sessionStartedAt, p.timezone) : ""}; counts until {formatTime(d.closesAt, p.timezone)}.
                </p>
              </div>
              <SessionActions due={d} onFinish={() => setRating(d)} />
            </div>
          ))}
        </section>
      )}

      {/* 4 · Chests and next unlock */}
      <section aria-labelledby="chest-heading" className="card flex flex-col gap-3 p-4">
        <div className="flex items-center gap-3">
          <ChestArt className="h-16 w-16 shrink-0" />
          <div className="min-w-0 flex-1">
            <h2 id="chest-heading" className="font-display text-lg font-semibold">
              {v.chests.unopened.length ? `${v.chests.unopened.length} chest${v.chests.unopened.length > 1 ? "s" : ""} to open` : "Next chest"}
            </h2>
            <p className="hint">Every 3 verified minimums earns a chest. Chests never expire.</p>
            <ProgressBar value={v.chests.progress} max={v.chests.perChest} label="Chest progress" className="mt-1.5" />
            <p className="mt-1 text-sm font-bold text-muted">
              {v.chests.progress}/{v.chests.perChest} toward the next
            </p>
          </div>
        </div>
        {v.chests.unopened.slice(0, 1).map((c) => (
          <button key={c.id} className="btn btn-primary w-full" onClick={() => setChest(c)}>
            <Icon name="chest" /> Open chest #{c.seq}
          </button>
        ))}
        <div className="flex flex-wrap gap-2 text-sm">
          {v.nextUnlock && (
            <Link href={`${APP_BASE_PATH}/progress`} className="chip min-h-9 bg-bone-soft text-bone">
              <Icon name="star" className="h-4 w-4" /> Level {v.nextUnlock.level}: {v.nextUnlock.label} · {v.nextUnlock.xpNeeded} XP to go
            </Link>
          )}
          <Link href={`${APP_BASE_PATH}/rewards`} className="chip min-h-9 bg-blood-soft text-fg">
            <Icon name="gift" className="h-4 w-4" />
            {v.rewards.nextLocked
              ? `Next reward: ${v.rewards.nextLocked.title}${v.rewards.nextLocked.targetLevel ? ` (Level ${v.rewards.nextLocked.targetLevel})` : ""}`
              : "Set up real-world rewards"}
          </Link>
          <Link href={`${APP_BASE_PATH}/ventures`} className="chip min-h-9 border border-line bg-raised text-fg">
            <Icon name="ticket" className="h-4 w-4" /> {p.tickets} ticket{p.tickets === 1 ? "" : "s"}
          </Link>
        </div>
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
      <button className="btn btn-go" onClick={onFinish}>
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

function DueCard({ due, timezone, onVerify, onRate }: { due: DueView; timezone: string; onVerify: () => void; onRate: () => void }) {
  const game = useGame();
  const start = useAction<{ sessionId: string }>();
  const decline = useAction();
  const cat = CATEGORY_INFO[due.category];
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
    <article className={`card relative overflow-hidden p-4 ${done ? "ring-2 ring-success/50" : ""}`} aria-label={due.title}>
      <span className="absolute inset-y-0 left-0 w-1.5" style={{ background: cat.color }} aria-hidden="true" />
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-extrabold" style={{ color: cat.color }}>
            {cat.label}
            {due.weekly && ` · ${due.weekly.completed}/${due.weekly.target} this week`}
          </p>
          <h3 className="font-display text-lg leading-tight font-semibold">{due.title}</h3>
          <p className="mt-1 text-[0.9375rem] text-fg-soft">{due.minimumAction}</p>
        </div>
        <span className={`chip shrink-0 ${done ? "bg-success-soft text-success" : "bg-raised text-fg-soft"}`}>
          {done ? (
            <>
              <Icon name="check" className="h-4 w-4" /> Done
            </>
          ) : (
            `+${due.attendanceXp} XP`
          )}
        </span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-sm font-bold text-muted">
        <Icon name="clock" className="h-4 w-4" /> {window}
        <span aria-hidden="true">·</span>
        <Icon name={due.mode === "photo" ? "camera" : "pin"} className="h-4 w-4" /> {due.mode === "photo" ? "Photo" : "Location"}
        {due.momentum.status === "active" && (
          <>
            <span aria-hidden="true">·</span>
            <span className="text-success">Momentum +5</span>
          </>
        )}
      </p>

      {!done && attempt && attempt.status !== "accepted" && (
        <div className="mt-3">
          <Note tone={attempt.status === "unavailable" || attempt.status === "pending" ? "warn" : "error"}>
            {attempt.reason}
            {attempt.guidance ? ` ${attempt.guidance}` : ""}
            {due.inconclusiveCount >= 3 && " Still unclear after several tries? Better light, the whole object in frame, and a steady hand usually fix it. You can also adjust this quest's evidence description for future days in Quests."}
          </Note>
        </div>
      )}

      <div className="mt-3">
        {!done && due.phase === "open" && attempt?.retryable ? (
          <button className="btn btn-primary w-full" onClick={() => void retry()}>
            <Icon name="refresh" /> Retry check
          </button>
        ) : !done && due.phase === "open" ? (
          <button className="btn btn-primary w-full text-lg" onClick={onVerify}>
            <Icon name={due.mode === "photo" ? "camera" : "pin"} /> Check in
          </button>
        ) : !done && due.phase === "upcoming" ? (
          <button className="btn btn-secondary w-full" disabled>
            Opens {formatTime(due.opensAt, timezone)}
          </button>
        ) : !done ? (
          <p className="text-sm font-bold text-muted">{due.status === "missed" ? "Window closed. Tomorrow is a fresh start." : due.status === "excused" ? "Excused (not counted as a miss)." : "Window closed."}</p>
        ) : due.optionalStatus === "none" && due.phase === "open" ? (
          <div className="flex flex-col gap-2">
            <p className="text-sm text-fg-soft">
              Minimum done: full credit. Optional: {due.extension}
            </p>
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
          <button className="btn btn-go w-full" onClick={onRate}>
            Finish optional work
          </button>
        ) : (
          <p className="text-sm font-bold text-success">
            {due.optionalStatus === "finished" ? "Minimum + extra effort logged." : "Minimum complete. That's the win."}
          </p>
        )}
        {(start.error || decline.error) && <p className="mt-2 text-sm text-danger">{(start.error ?? decline.error)!.message}</p>}
      </div>
    </article>
  );
}
