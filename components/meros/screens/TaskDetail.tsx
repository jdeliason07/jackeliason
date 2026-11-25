"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { CATEGORY_SHORT, PLACE_LABEL, PLACE_OF } from "@/lib/meros/content/places";
import { useAction, useGame } from "../GameProvider";
import TaskBuilder from "../TaskBuilder";
import { CATEGORY_ICON, Empty, Icon, Note } from "../ui";

export default function TaskDetail({ id }: { id: string }) {
  const v = useGame().view!;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const pause = useAction();
  const resume = useAction();
  const archive = useAction();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const q = v.quests.find((x) => x.id === id);
  if (!q) return <Empty title="Task not found" action={<Link href={`${APP_BASE_PATH}/tasks`} className="btn btn-hero">All tasks</Link>} />;
  const d = q.definition;
  const misses = q.momentum.consecutiveMisses;

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-[2.25rem] leading-none">Edit</h1>
        <TaskBuilder initial={d} templateId={q.templateId} questId={q.id} onSaved={() => setEditing(false)} onCancel={() => setEditing(false)} />
      </div>
    );
  }

  const error = pause.error ?? resume.error ?? archive.error;
  const facts: { icon: string; text: string }[] = [
    { icon: CATEGORY_ICON[d.category] ?? "quests", text: `${CATEGORY_SHORT[d.category]} · ${PLACE_LABEL[PLACE_OF[d.category]]}` },
    { icon: "clock", text: q.schedule },
    d.verification.mode === "photo"
      ? { icon: "camera", text: d.verification.criteria.join(" · ") }
      : { icon: "pin", text: `${d.verification.gps?.label ?? "Not set"} · ${d.verification.gps?.radiusM ?? "?"} m` },
    ...(d.org ? [{ icon: d.earns ? "coin" : "briefcase", text: d.earns ? `${d.org} · earns` : d.org }] : []),
    ...(d.extension ? [{ icon: "plus", text: d.extension }] : []),
    { icon: "star", text: `${d.maxXp / 2} XP + ${d.maxXp / 2} extra` },
  ];

  return (
    <div className="flex flex-col gap-5">
      <Link href={`${APP_BASE_PATH}/tasks`} className="btn btn-ghost self-start px-2">
        <Icon name="back" /> Tasks
      </Link>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-[2.25rem] leading-none">{d.title}</h1>
        <p className="text-[1.0625rem]">{d.minimumAction}</p>
      </div>

      {/* Four weeks at a glance. */}
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-2xl border-[1.5px] border-blood py-3">
          <p className="font-display text-3xl leading-none">
            {q.recent.done}/{q.recent.due || 0}
          </p>
          <p className="eyebrow mt-1">4 weeks</p>
        </div>
        <div className="rounded-2xl border-[1.5px] border-blood py-3">
          <p className="font-display text-3xl leading-none">{q.momentum.consecutiveSuccesses}</p>
          <p className="eyebrow mt-1">Streak</p>
        </div>
        <div className={`rounded-2xl border-[1.5px] border-blood py-3 ${q.momentum.status === "active" ? "bg-blood text-white" : ""}`}>
          <Icon name="bolt" className="mx-auto h-7 w-7" />
          <p className="eyebrow mt-1">{q.momentum.status === "active" ? "+5 credits" : q.momentum.status === "suspended" ? "Paused" : `${q.momentum.consecutiveSuccesses}/2`}</p>
        </div>
      </div>
      {misses > 0 && <Note tone="warn">{misses} missed in a row. One done resets it.</Note>}
      {q.reviewDue && <Note tone="warn">Review time: still small enough?</Note>}

      <ul className="m-list flex flex-col">
        {facts.map((f, i) => (
          <li key={i} className="rule flex items-start gap-3 py-3">
            <Icon name={f.icon} className="mt-0.5 h-5 w-5 shrink-0" />
            <span className="min-w-0 flex-1">{f.text}</span>
          </li>
        ))}
      </ul>

      {error && <Note tone="error">{error.message}</Note>}
      {q.status !== "archived" && (
        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-hero" onClick={() => setEditing(true)}>
            Edit
          </button>
          {q.status === "active" ? (
            <button className="btn btn-secondary" disabled={pause.pending} onClick={() => void pause.execute({ type: "pauseQuest", questId: q.id })}>
              <Icon name="clock" /> Pause
            </button>
          ) : (
            <button className="btn btn-secondary" disabled={resume.pending} onClick={() => void resume.execute({ type: "resumeQuest", questId: q.id })}>
              Resume
            </button>
          )}
        </div>
      )}
      {q.status !== "archived" &&
        (confirmArchive ? (
          <Note
            tone="warn"
            action={
              <button
                className="btn btn-secondary min-h-10 px-3 text-sm"
                disabled={archive.pending}
                onClick={async () => {
                  await archive.execute({ type: "archiveQuest", questId: q.id });
                  router.push(`${APP_BASE_PATH}/tasks`);
                }}
              >
                Archive
              </button>
            }
          >
            History stays.
          </Note>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirmArchive(true)}>
            <Icon name="trash" /> Archive
          </button>
        ))}
    </div>
  );
}
