"use client";

import { useMemo, useState } from "react";
import { APP_BASE_PATH } from "@/lib/meros/config";
import type { AreaId } from "@/lib/meros/content/estate";
import { PLACE_CATEGORIES } from "@/lib/meros/content/places";
import { habitsOf, heuristicSuggestions, type Suggestion } from "@/lib/meros/domain/suggest";
import type { QuestDefinition } from "@/lib/meros/service/quest-definition";
import { useGame } from "./GameProvider";
import { CATEGORY_ICON, Icon, Spinner } from "./ui";

const CACHE = "meros-ideas";

function readCache(day: string, place: string): Suggestion[] | null {
  try {
    const raw = JSON.parse(sessionStorage.getItem(CACHE) ?? "null") as { day: string; place: string; list: Suggestion[] } | null;
    return raw && raw.day === day && raw.place === place ? raw.list : null;
  } catch {
    return null;
  }
}

/**
 * "For you": two tasks like the ones you actually keep doing, and one experiment. Built instantly
 * from your history; in the live app, one tap asks Claude for fresh ideas from the same history.
 */
export default function Suggestions({ place, onPick }: { place: AreaId | null; onPick: (d: QuestDefinition) => void }) {
  const game = useGame();
  const v = game.view!;
  const cats = place ? PLACE_CATEGORIES[place] : null;
  const local = useMemo(() => heuristicSuggestions(habitsOf(v.quests), v.profile.places, v.today.localDate, cats), [v.quests, v.profile.places, v.today.localDate, cats]);
  const [ai, setAi] = useState<Suggestion[] | null>(() => (typeof window === "undefined" ? null : readCache(v.today.localDate, place ?? "")));
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const list = (ai ?? local).filter((s) => !cats || cats.includes(s.definition.category));

  async function fresh() {
    setState("loading");
    try {
      const res = await fetch(`${APP_BASE_PATH}/api/suggest`, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{}" });
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { suggestions: Suggestion[] };
      setAi(body.suggestions);
      try {
        sessionStorage.setItem(CACHE, JSON.stringify({ day: v.today.localDate, place: place ?? "", list: body.suggestions }));
      } catch {
        // ignore
      }
      setState("idle");
    } catch {
      setState("error");
    }
  }

  if (!list.length && state !== "loading") return null;

  return (
    <section aria-labelledby="ideas" className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 id="ideas" className="eyebrow flex items-center gap-1.5">
          <Icon name="sparkle" className="h-4 w-4" /> For you
        </h2>
        {game.mode === "live" && (
          <button type="button" className="btn btn-ghost min-h-9 px-1 text-sm" onClick={() => void fresh()} disabled={state === "loading"}>
            {state === "loading" ? <Spinner label="Thinking…" /> : state === "error" ? "Try again" : (<><Icon name="refresh" className="h-4 w-4" /> Fresh ideas</>)}
          </button>
        )}
      </div>
      <ul className="m-list flex flex-col gap-2">
        {list.map((s, i) => (
          <li key={`${s.definition.title}-${i}`}>
            <button type="button" className="card flex w-full items-center gap-3 p-3.5 text-left" onClick={() => onPick(s.definition)}>
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full border-[1.5px] border-blood ${s.kind === "experiment" ? "" : "bg-blood text-white"}`}>
                <Icon name={s.kind === "experiment" ? "flask" : (CATEGORY_ICON[s.definition.category] ?? "star")} className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-display text-base leading-tight">{s.definition.title}</span>
                <span className="mt-0.5 block truncate text-[0.8125rem] font-bold">
                  {s.kind === "experiment" ? "Experiment · " : ""}
                  {s.reason}
                </span>
              </span>
              <Icon name="plus" className="h-5 w-5 shrink-0" />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
