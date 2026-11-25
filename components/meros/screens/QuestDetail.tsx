"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { CATEGORY_INFO, TEMPLATES_BY_ID } from "@/lib/meros/content/templates";
import { describeMissConsequence } from "@/lib/meros/domain/momentum";
import { useAction, useGame } from "../GameProvider";
import QuestBuilder from "../QuestBuilder";
import { Empty, Icon, Note } from "../ui";

export default function QuestDetail({ id }: { id: string }) {
  const v = useGame().view!;
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const pause = useAction();
  const resume = useAction();
  const archive = useAction();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const q = v.quests.find((x) => x.id === id);
  if (!q) return <Empty title="Quest not found" action={<Link href={`${APP_BASE_PATH}/quests`} className="btn btn-primary">All quests</Link>} />;
  const d = q.definition;
  const cat = CATEGORY_INFO[d.category];
  const misses = q.momentum.consecutiveMisses;

  if (editing) {
    return (
      <div className="flex flex-col gap-4">
        <h1 className="font-display text-2xl font-semibold">Edit quest</h1>
        <QuestBuilder
          initial={d}
          templateId={q.templateId}
          questId={q.id}
          locationHint={q.templateId ? TEMPLATES_BY_ID.get(q.templateId)?.verification.locationHint : undefined}
          onSaved={() => setEditing(false)}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  const error = pause.error ?? resume.error ?? archive.error;
  return (
    <div className="flex flex-col gap-4">
      <Link href={`${APP_BASE_PATH}/quests`} className="btn btn-ghost self-start px-2">
        <Icon name="back" /> Quests
      </Link>
      <div className="card flex flex-col gap-3 p-5">
        <p className="text-sm font-extrabold" style={{ color: cat.color }}>
          {cat.label} · v{q.versionNo} · {q.status}
        </p>
        <h1 className="font-display text-2xl leading-tight font-semibold">{d.title}</h1>
        {q.reviewDue && <Note tone="warn">Time to review this plan: is the minimum still small enough, and the window still right?</Note>}
        <dl className="grid gap-2 text-[0.9375rem]">
          <div><dt className="font-extrabold">Minimum action</dt><dd>{d.minimumAction}</dd></div>
          {d.cue && <div><dt className="font-extrabold">Cue</dt><dd>{d.cue}</dd></div>}
          <div><dt className="font-extrabold">Schedule</dt><dd>{q.schedule}</dd></div>
          {(d.why || d.purpose) && <div><dt className="font-extrabold">Why</dt><dd>{d.why || d.purpose}</dd></div>}
          <div>
            <dt className="font-extrabold">Evidence</dt>
            <dd>
              {d.verification.mode === "photo" ? (
                <ul className="list-disc pl-5">{d.verification.criteria.map((c) => <li key={c}>{c}</li>)}</ul>
              ) : (
                `Location: ${d.verification.gps?.label ?? "not set"} (${d.verification.gps?.radiusM ?? "?"} m)`
              )}
            </dd>
          </div>
          {d.extension && <div><dt className="font-extrabold">Optional extension</dt><dd>{d.extension}</dd></div>}
          <div><dt className="font-extrabold">XP</dt><dd>{d.maxXp / 2} for the minimum + up to {d.maxXp / 2} self-rated</dd></div>
          {d.reviewOn && <div><dt className="font-extrabold">Review on</dt><dd>{d.reviewOn}</dd></div>}
        </dl>
      </div>

      <div className="card p-4">
        <p className="font-extrabold">
          {q.momentum.status === "active" ? "Momentum active: +5 Estate Credits per success" : q.momentum.status === "suspended" ? "Momentum paused" : `Building momentum (${q.momentum.consecutiveSuccesses}/2)`}
        </p>
        <p className="hint">
          {misses > 0 ? `${misses} scheduled ${q.definition.schedule.kind === "weekly" ? "week" : "occurrence"}${misses > 1 ? "s" : ""} missed in a row. ${describeMissConsequence(misses + 1)} (if the next one is missed)` : "No current misses."} One verified minimum resets the count.
        </p>
      </div>

      {error && <Note tone="error">{error.message}</Note>}
      {q.status !== "archived" && (
        <div className="grid grid-cols-2 gap-3">
          <button className="btn btn-secondary" onClick={() => setEditing(true)}>Edit</button>
          {q.status === "active" ? (
            <button className="btn btn-secondary" disabled={pause.pending} onClick={() => void pause.execute({ type: "pauseQuest", questId: q.id })}>Pause</button>
          ) : (
            <button className="btn btn-go" disabled={resume.pending} onClick={() => void resume.execute({ type: "resumeQuest", questId: q.id })}>Resume</button>
          )}
        </div>
      )}
      {q.status === "active" && <p className="hint">Pausing is prospective: a window that’s already open stays due; nothing after it is scheduled until you resume. Paused days are never misses.</p>}
      {q.status !== "archived" &&
        (confirmArchive ? (
          <Note tone="warn" action={<button className="btn btn-secondary min-h-10 px-3 text-sm" disabled={archive.pending} onClick={async () => { await archive.execute({ type: "archiveQuest", questId: q.id }); router.push(`${APP_BASE_PATH}/quests`); }}>Archive</button>}>
            Archive “{d.title}”? History and earned rewards stay. It stops scheduling.
          </Note>
        ) : (
          <button className="btn btn-ghost" onClick={() => setConfirmArchive(true)}>Archive quest</button>
        ))}
    </div>
  );
}
