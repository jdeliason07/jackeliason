"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import { CATEGORY_SHORT, isPlaceId, PLACE_CATEGORIES, PLACE_LABEL } from "@/lib/meros/content/places";
import { CATEGORY_INFO, QUEST_TEMPLATES, type QuestCategory, type QuestTemplate, STARTER_TEMPLATE_IDS } from "@/lib/meros/content/templates";
import { describeSchedule } from "@/lib/meros/domain/schedule";
import type { QuestDefinition } from "@/lib/meros/service/quest-definition";
import { useGame } from "../GameProvider";
import Suggestions from "../Suggestions";
import TaskBuilder, { definitionFromTemplate } from "../TaskBuilder";
import { CATEGORY_ICON, Icon, Note } from "../ui";

type Chosen = { definition: QuestDefinition; templateId: string | null; heading: string };

function Browser() {
  const v = useGame().view!;
  const router = useRouter();
  const params = useSearchParams();
  const onboarding = params.get("start") === "1";
  const placeParam = params.get("place");
  const place = placeParam && isPlaceId(placeParam) ? placeParam : null;
  const placeCats = place ? PLACE_CATEGORIES[place] : null;
  const [category, setCategory] = useState<QuestCategory | "starter">(onboarding ? "starter" : (placeCats?.[0] ?? "fitness"));
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const activeCount = v.quests.filter((q) => q.status === "active").length;
  const used = new Set(v.quests.filter((q) => q.status !== "archived").map((q) => q.templateId));
  const list = category === "starter" ? QUEST_TEMPLATES.filter((t) => STARTER_TEMPLATE_IDS.includes(t.id)) : QUEST_TEMPLATES.filter((t) => t.category === category);
  const tabs = (placeCats && placeCats.length ? placeCats : (Object.keys(CATEGORY_INFO) as QuestCategory[]));

  const open = (t: QuestTemplate | null) =>
    setChosen({
      definition: definitionFromTemplate(t, { category: category === "starter" ? undefined : category, places: v.profile.places, atPlace: Boolean(place) }),
      templateId: t?.id ?? null,
      heading: t ? "Make it yours" : "Your own",
    });

  if (chosen) {
    return (
      <div className="flex flex-col gap-4">
        <button className="btn btn-ghost self-start px-2" onClick={() => setChosen(null)}>
          <Icon name="back" /> Back
        </button>
        <h1 className="font-display text-[2.25rem] leading-none">{chosen.heading}</h1>
        <TaskBuilder
          initial={chosen.definition}
          templateId={chosen.templateId}
          onSaved={() => {
            setChosen(null);
            if (place) router.push(APP_BASE_PATH);
            else if (!onboarding) router.push(`${APP_BASE_PATH}/tasks`);
          }}
          onCancel={() => setChosen(null)}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        {place && (
          <Link href={APP_BASE_PATH} className="btn btn-ghost -ml-2 px-2" aria-label="Back to Home">
            <Icon name="back" />
          </Link>
        )}
        <h1 className="flex-1 font-display text-[2.25rem] leading-none">{onboarding ? "Pick 3–5" : place ? `${PLACE_LABEL[place]} task` : "New task"}</h1>
        {onboarding && activeCount > 0 && (
          <Link href={APP_BASE_PATH} className={`btn ${activeCount >= 3 ? "btn-hero" : "btn-secondary"} min-h-11 px-4`}>
            Done · {activeCount}
          </Link>
        )}
      </div>

      {!onboarding && <Suggestions place={place} onPick={(definition) => setChosen({ definition, templateId: null, heading: "Try this" })} />}

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="tablist" aria-label="Categories">
        {onboarding && (
          <button role="tab" aria-selected={category === "starter"} className="chip min-h-10 shrink-0 px-3" onClick={() => setCategory("starter")}>
            <Icon name="star" className="h-4 w-4" /> Starter
          </button>
        )}
        {tabs.map((c) => (
          <button key={c} role="tab" aria-selected={category === c} className="chip min-h-10 shrink-0 px-3" onClick={() => setCategory(c)}>
            <Icon name={CATEGORY_ICON[c]} className="h-4 w-4" /> {CATEGORY_SHORT[c]}
          </button>
        ))}
      </div>

      <ul key={category} className="m-list flex flex-col gap-2">
        {list.map((t) => (
          <li key={t.id}>
            <button className="card flex w-full items-center gap-3 p-3.5 text-left" onClick={() => open(t)}>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-blood">
                <Icon name={CATEGORY_ICON[t.category]} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-display text-base leading-tight">
                  {t.title}
                  {used.has(t.id) && <Icon name="check" className="h-4 w-4" strokeWidth={3} />}
                </span>
                <span className="mt-0.5 block truncate text-[0.8125rem] font-bold">{describeSchedule(t.schedule)}</span>
              </span>
              <Icon name="plus" className="h-5 w-5 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
      <button className="btn btn-secondary" onClick={() => open(null)}>
        <Icon name="plus" /> Your own
      </button>
      {onboarding && activeCount === 0 && <Note tone="info">Tap one, tweak, add. Start small.</Note>}
    </div>
  );
}

export default function TaskNew() {
  return (
    <Suspense>
      <Browser />
    </Suspense>
  );
}
