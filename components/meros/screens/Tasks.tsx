"use client";

import Link from "next/link";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { PLACE_CATEGORIES, PLACE_LABEL, TASK_PLACES } from "@/lib/meros/content/places";
import { useGame } from "../GameProvider";
import { CATEGORY_ICON, Empty, Icon } from "../ui";

/** Every task, under the building it lives in. The little bar is the last four weeks. */
export default function Tasks() {
  const v = useGame().view!;
  const live = v.quests.filter((q) => q.status !== "archived");
  const archived = v.quests.filter((q) => q.status === "archived");
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="font-display text-[2.25rem] leading-none">Tasks</h1>
        <Link href={`${APP_BASE_PATH}/tasks/new`} className="btn btn-hero min-h-12 px-5 text-lg">
          <Icon name="plus" /> New
        </Link>
      </div>
      {live.length === 0 && <Empty title="No tasks yet">Start with three small ones.</Empty>}
      {TASK_PLACES.map((place) => {
        const list = live.filter((q) => PLACE_CATEGORIES[place].includes(q.definition.category));
        if (!list.length) return null;
        return (
          <section key={place} aria-labelledby={`t-${place}`} className="flex flex-col gap-2">
            <h2 id={`t-${place}`} className="eyebrow">
              {PLACE_LABEL[place]} · {list.length}
            </h2>
            <ul className="m-list flex flex-col gap-2">
              {list.map((q) => {
                const pct = q.recent.due ? q.recent.done / q.recent.due : null;
                return (
                  <li key={q.id}>
                    <Link href={`${APP_BASE_PATH}/tasks/${q.id}`} className={`card group flex items-center gap-3 p-3.5 ${q.status === "paused" ? "opacity-60" : ""}`}>
                      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-blood">
                        <Icon name={q.status === "paused" ? "clock" : (CATEGORY_ICON[q.definition.category] ?? "quests")} className="h-5 w-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 font-display text-base leading-tight">
                          <span className="truncate">{q.definition.title}</span>
                          {q.momentum.status === "active" && <Icon name="bolt" className="h-4 w-4 shrink-0" />}
                          {q.definition.earns && <Icon name="coin" className="h-4 w-4 shrink-0" />}
                          {q.reviewDue && <Icon name="refresh" className="h-4 w-4 shrink-0" />}
                        </p>
                        <p className="mt-0.5 flex items-center gap-1.5 text-[0.8125rem] font-bold">
                          <Icon name={q.definition.verification.mode === "photo" ? "camera" : "pin"} className="h-3.5 w-3.5 shrink-0" />
                          <span className="truncate">{q.status === "paused" ? "Paused" : q.schedule}</span>
                        </p>
                      </div>
                      {pct !== null && (
                        <span className="flex w-12 shrink-0 flex-col items-end gap-1" aria-label={`${q.recent.done} of ${q.recent.due} in 4 weeks`}>
                          <span className="font-display text-sm leading-none">
                            {q.recent.done}/{q.recent.due}
                          </span>
                          <span className="m-bar w-full">
                            <span className="m-bar-fill block" style={{ "--p": pct } as React.CSSProperties} />
                          </span>
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      {archived.length > 0 && (
        <details>
          <summary className="eyebrow cursor-pointer list-none">Archived · {archived.length}</summary>
          <ul className="mt-2 flex flex-col gap-2">
            {archived.map((q) => (
              <li key={q.id}>
                <Link href={`${APP_BASE_PATH}/tasks/${q.id}`} className="card flex items-center gap-3 p-3 opacity-60">
                  <span className="min-w-0 flex-1 truncate font-display">{q.definition.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}
