"use client";

import type { DueView } from "@/lib/meros/service/view";
import EarningPrompt from "./EarningPrompt";
import { useAction, useGame } from "./GameProvider";
import { formatTime, Icon, Note } from "./ui";

/**
 * One task due today. Not done: what to do, when, and one button. Done: a check, then (for money
 * tasks) what it earned, then the optional extra. `focal` makes its button the screen's hero.
 */
export default function TaskRow({
  due,
  focal,
  timezone,
  onVerify,
  onRate,
}: {
  due: DueView;
  focal: boolean;
  timezone: string;
  onVerify: () => void;
  onRate: () => void;
}) {
  const game = useGame();
  const start = useAction<{ sessionId: string }>();
  const decline = useAction();
  const done = due.status === "completed";
  const window = due.opensAt && due.closesAt ? `${formatTime(due.opensAt, timezone)}–${formatTime(due.closesAt, timezone)}` : "";
  const allDay = new Date(due.closesAt).getTime() - new Date(due.opensAt).getTime() >= 23.9 * 3_600_000;
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
      <div className="flex items-start gap-3">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-full border-[1.5px] border-blood ${done ? "bg-blood text-white" : ""}`}>
          {done ? <Icon name="check" strokeWidth={3} className="m-pop h-5 w-5" /> : <Icon name={due.mode === "photo" ? "camera" : "pin"} className="h-5 w-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className={`font-display text-xl leading-tight ${done ? "line-through decoration-2" : ""}`}>{due.title}</h3>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[0.8125rem] font-bold">
            {!allDay && (
              <span className="inline-flex items-center gap-1">
                <Icon name="clock" className="h-3.5 w-3.5" /> {window}
              </span>
            )}
            {due.weekly && <span>{due.weekly.completed}/{due.weekly.target} this week</span>}
            {due.org && <span>· {due.org}</span>}
            {due.momentum.status === "active" && (
              <span className="inline-flex items-center gap-0.5">
                <Icon name="bolt" className="h-3.5 w-3.5" /> streak
              </span>
            )}
          </p>
        </div>
        {!done && <span className="shrink-0 font-display text-lg">+{due.attendanceXp}</span>}
      </div>

      {!done && attempt && attempt.status !== "accepted" && (
        <Note tone={attempt.status === "unavailable" || attempt.status === "pending" ? "warn" : "error"}>
          {attempt.reason}
          {attempt.guidance ? ` ${attempt.guidance}` : ""}
        </Note>
      )}

      {!done && due.phase === "open" && attempt?.retryable ? (
        <button className={`btn w-full ${focal ? "btn-hero" : "btn-secondary"}`} onClick={() => void retry()}>
          <Icon name="refresh" /> Retry
        </button>
      ) : !done && due.phase === "open" ? (
        <button className={`btn w-full ${focal ? "btn-hero" : "btn-secondary"}`} onClick={onVerify}>
          <Icon name={due.mode === "photo" ? "camera" : "pin"} /> {due.mode === "photo" ? "Snap it" : "I'm here"}
        </button>
      ) : !done && due.phase === "upcoming" ? (
        <p className="inline-flex items-center gap-1.5 text-sm font-bold">
          <Icon name="lock" className="h-4 w-4" /> {formatTime(due.opensAt, timezone)}
        </p>
      ) : !done ? (
        <p className="text-sm font-bold">{due.status === "excused" ? "Excused" : "Missed. Tomorrow’s fresh."}</p>
      ) : (
        <>
          {due.earns && (
            <EarningPrompt occurrenceId={due.occurrenceId} org={due.org} suggestedCents={due.lastEarningCents} loggedCents={due.earningCents} hero={focal && due.earningCents === null} />
          )}
          {due.optionalStatus === "none" && due.phase === "open" && due.extension ? (
            <div className="m-rise flex items-center gap-2">
              <button
                className="btn btn-secondary min-h-10 flex-1 px-3 text-sm"
                disabled={start.pending}
                onClick={async () => {
                  const r = await start.execute({ type: "startOptional", occurrenceId: due.occurrenceId });
                  if (r) game.sound("tap");
                }}
              >
                <Icon name="plus" className="h-4 w-4" /> Extra: {due.extension.replace(/\.$/, "")}
              </button>
              <button className="btn btn-ghost min-h-10 px-2 text-sm" aria-label="Skip the extra" disabled={decline.pending} onClick={() => void decline.execute({ type: "declineOptional", occurrenceId: due.occurrenceId })}>
                <Icon name="x" />
              </button>
            </div>
          ) : due.optionalStatus === "active" ? (
            <button className="btn btn-secondary w-full" onClick={onRate}>
              <Icon name="check" /> Finish extra
            </button>
          ) : null}
        </>
      )}
      {(start.error || decline.error) && <p className="text-sm font-bold">{(start.error ?? decline.error)!.message}</p>}
    </article>
  );
}
