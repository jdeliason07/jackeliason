"use client";

import Link from "next/link";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { CATEGORY_INFO } from "@/lib/meros/content/templates";
import { useGame } from "../GameProvider";
import { Empty, Icon } from "../ui";

const STATUS_LABEL = { active: "Active", paused: "Paused", archived: "Archived" } as const;
const MOMENTUM_LABEL = { building: "Building momentum", active: "Momentum +5", suspended: "Momentum paused" } as const;

export default function Quests() {
  const v = useGame().view!;
  const groups = (["active", "paused", "archived"] as const).map((s) => [s, v.quests.filter((q) => q.status === s)] as const);
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-semibold">Quests</h1>
        <Link href={`${APP_BASE_PATH}/quests/new`} className="btn btn-primary min-h-11">
          <Icon name="plus" /> New
        </Link>
      </div>
      {v.quests.length === 0 && (
        <Empty title="No quests yet" action={<Link href={`${APP_BASE_PATH}/quests/new`} className="btn btn-primary">Browse 50 templates</Link>}>
          Start with three to five small ones. You can add more any time.
        </Empty>
      )}
      {groups.map(([status, list]) =>
        list.length ? (
          <section key={status} aria-labelledby={`q-${status}`} className="flex flex-col gap-2">
            <h2 id={`q-${status}`} className="text-sm font-extrabold tracking-wide text-muted uppercase">
              {STATUS_LABEL[status]} · {list.length}
            </h2>
            <ul className="flex flex-col gap-2">
              {list.map((q) => {
                const cat = CATEGORY_INFO[q.definition.category];
                return (
                  <li key={q.id}>
                    <Link href={`${APP_BASE_PATH}/quests/${q.id}`} className="card flex items-center gap-3 p-4">
                      <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: cat.color }} aria-hidden="true" />
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-base leading-tight font-semibold">{q.definition.title}</p>
                        <p className="hint truncate">{q.schedule}</p>
                        <p className="mt-0.5 text-[0.8125rem] font-bold text-muted">
                          <Icon name={q.definition.verification.mode === "photo" ? "camera" : "pin"} className="mr-1 inline h-4 w-4" />
                          {q.status === "active" ? MOMENTUM_LABEL[q.momentum.status] : STATUS_LABEL[q.status]}
                          {q.momentum.consecutiveMisses > 0 && q.status === "active" ? ` · ${q.momentum.consecutiveMisses} missed in a row` : ""}
                          {q.reviewDue ? " · Review due" : ""}
                        </p>
                      </div>
                      <Icon name="chevron" className="h-5 w-5 text-muted" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        ) : null,
      )}
    </div>
  );
}
