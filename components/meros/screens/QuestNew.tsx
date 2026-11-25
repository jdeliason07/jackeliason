"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { CATEGORY_INFO, QUEST_TEMPLATES, type QuestCategory, type QuestTemplate, STARTER_TEMPLATE_IDS } from "@/lib/meros/content/templates";
import { describeSchedule } from "@/lib/meros/domain/schedule";
import { useGame } from "../GameProvider";
import QuestBuilder, { definitionFromTemplate } from "../QuestBuilder";
import { Icon, Note } from "../ui";

function Browser() {
  const v = useGame().view!;
  const router = useRouter();
  const params = useSearchParams();
  const onboarding = params.get("start") === "1";
  const [category, setCategory] = useState<QuestCategory | "starter">(onboarding ? "starter" : "fitness");
  const [chosen, setChosen] = useState<QuestTemplate | "custom" | null>(null);
  const activeCount = v.quests.filter((q) => q.status === "active").length;
  const used = new Set(v.quests.filter((q) => q.status !== "archived").map((q) => q.templateId));
  const list = category === "starter" ? QUEST_TEMPLATES.filter((t) => STARTER_TEMPLATE_IDS.includes(t.id)) : QUEST_TEMPLATES.filter((t) => t.category === category);

  if (chosen) {
    const template = chosen === "custom" ? null : chosen;
    return (
      <div className="flex flex-col gap-4">
        <button className="btn btn-ghost self-start px-2" onClick={() => setChosen(null)}>
          <Icon name="back" /> Templates
        </button>
        <div>
          <h1 className="font-display text-[2.25rem] leading-none">{template ? "Make it yours" : "Custom quest"}</h1>
          {template && <p className="hint">{template.purpose} Edit anything before activating.</p>}
        </div>
        <QuestBuilder
          initial={definitionFromTemplate(template)}
          templateId={template?.id ?? null}
          locationHint={template?.verification.locationHint}
          onSaved={() => {
            setChosen(null);
            if (!onboarding) router.push(`${APP_BASE_PATH}/quests`);
          }}
          onCancel={() => setChosen(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="font-display text-[2.25rem] leading-none">{onboarding ? "Pick your first quests" : "New quest"}</h1>
      </div>
      {onboarding && (
        <Note tone={activeCount >= 3 ? "ok" : "info"} action={activeCount > 0 ? <Link href={APP_BASE_PATH} className="btn btn-primary min-h-10 px-4 text-sm">Done</Link> : undefined}>
          Recommended: start with 3–5 ({activeCount} added). That’s a starting point, not a limit.
        </Note>
      )}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Categories">
        {onboarding && (
          <button role="tab" aria-selected={category === "starter"} className="chip min-h-10 shrink-0 px-3" onClick={() => setCategory("starter")}>
            Starter set
          </button>
        )}
        {(Object.keys(CATEGORY_INFO) as QuestCategory[]).map((c) => (
          <button
            key={c}
            role="tab"
            aria-selected={category === c}
            className="chip min-h-10 shrink-0 px-3"
            onClick={() => setCategory(c)}
          >
            {CATEGORY_INFO[c].label} · {QUEST_TEMPLATES.filter((t) => t.category === c).length}
          </button>
        ))}
      </div>
      <ul key={category} className="m-list flex flex-col gap-2">
        {list.map((t) => (
          <li key={t.id}>
            <button className="card flex w-full items-start gap-3 p-4 text-left" onClick={() => setChosen(t)}>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-display text-base leading-tight">
                  {t.title}
                  {used.has(t.id) && <span className="chip chip-solid">Added</span>}
                </span>
                <span className="mt-0.5 block text-[0.9375rem] font-normal">{t.minimumAction}</span>
                <span className="mt-1 block text-[0.8125rem] font-bold">
                  <Icon name={t.verification.mode === "photo" ? "camera" : "pin"} className="mr-1 inline h-4 w-4" />
                  {t.verification.mode === "photo" ? "Photo" : "Location (you set it)"} · {describeSchedule(t.schedule)}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-secondary" onClick={() => setChosen("custom")}>
        <Icon name="plus" /> Write a custom quest
      </button>
    </div>
  );
}

export default function QuestNew() {
  return (
    <Suspense>
      <Browser />
    </Suspense>
  );
}
