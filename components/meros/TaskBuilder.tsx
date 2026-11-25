"use client";

import { useState } from "react";
import { XP_RULES } from "@/lib/meros/config";
import type { AreaId } from "@/lib/meros/content/estate";
import { CATEGORY_SHORT, PLACE_LABEL, PLACE_OF, type PlaceLocation, type Places } from "@/lib/meros/content/places";
import { CATEGORY_INFO, type QuestCategory, type QuestTemplate } from "@/lib/meros/content/templates";
import { describeSchedule, type Schedule, validateSchedule, WEEKDAY_LABELS } from "@/lib/meros/domain/schedule";
import type { QuestDefinition } from "@/lib/meros/service/quest-definition";
import { useAction, useGame } from "./GameProvider";
import LocationPicker from "./LocationPicker";
import { CATEGORY_ICON, Icon, Note } from "./ui";

/**
 * A definition to start from: a template, a suggestion, or blank. Created inside a building that
 * has a saved spot, it's checked in by being there; a location template uses the building's spot.
 */
export function definitionFromTemplate(t: QuestTemplate | null, opts: { category?: QuestCategory; places?: Places; atPlace?: boolean } = {}): QuestDefinition {
  const category = t?.category ?? opts.category ?? "learning";
  const spot = opts.places?.[PLACE_OF[category]] ?? null;
  const wantsGps = (opts.atPlace && spot) || t?.verification.mode === "gps";
  return {
    title: t?.title ?? "",
    category,
    purpose: t?.purpose ?? "",
    why: "",
    minimumAction: t?.minimumAction ?? "",
    cue: t?.cue ?? "",
    extension: t?.extension ?? "",
    schedule: t?.schedule ?? { kind: "daily", window: { start: "00:00", end: "24:00" } },
    verification: {
      mode: wantsGps ? "gps" : "photo",
      criteria: [...(t?.verification.criteria ?? [])].filter((c) => !/location/i.test(c) || !wantsGps),
      gps: wantsGps && spot ? { ...spot } : null,
    },
    maxXp: t?.maxXp ?? XP_RULES.defaultMaxXp,
    reviewOn: null,
    reviewIntervalDays: t?.reviewIntervalDays ?? 30,
    org: "",
    earns: false,
  };
}

const CATEGORIES = Object.keys(CATEGORY_INFO) as QuestCategory[];

export default function TaskBuilder({
  initial,
  templateId,
  questId,
  onSaved,
  onCancel,
}: {
  initial: QuestDefinition;
  templateId: string | null;
  questId?: string;
  onSaved: (questId: string) => void;
  onCancel: () => void;
}) {
  const game = useGame();
  const v = game.view!;
  const [d, setD] = useState<QuestDefinition>({ org: "", earns: false, ...initial });
  const [pickingSpot, setPickingSpot] = useState(initial.verification.mode === "gps" && !initial.verification.gps);
  const [alsoSavePlace, setAlsoSavePlace] = useState(true);
  const [similar, setSimilar] = useState(false);
  const [moneyOpen, setMoneyOpen] = useState(false);
  const save = useAction<{ questId: string }>();
  const placeSave = useAction();
  const set = <K extends keyof QuestDefinition>(key: K, value: QuestDefinition[K]) => setD((x) => ({ ...x, [key]: value }));
  const setSchedule = (s: Schedule) => set("schedule", s);
  const allDay = d.schedule.window.start === "00:00" && d.schedule.window.end === "24:00";
  const scheduleError = validateSchedule(d.schedule);
  const area: AreaId = PLACE_OF[d.category];
  const placeSpot = v.profile.places[area] ?? null;
  const gps = d.verification.gps;
  const isPlaceSpot = Boolean(gps && placeSpot && Math.abs(gps.lat - placeSpot.lat) < 1e-6 && Math.abs(gps.lng - placeSpot.lng) < 1e-6);
  const showMoney = moneyOpen || d.category === "business" || Boolean(d.org) || Boolean(d.earns);

  function setCategory(c: QuestCategory) {
    setD((x) => {
      const nextSpot = v.profile.places[PLACE_OF[c]] ?? null;
      const oldSpot = v.profile.places[PLACE_OF[x.category]] ?? null;
      // A location that was just the old building's spot follows the building.
      const followed = x.verification.mode === "gps" && x.verification.gps && oldSpot && x.verification.gps.lat === oldSpot.lat && x.verification.gps.lng === oldSpot.lng;
      return { ...x, category: c, verification: followed ? { ...x.verification, gps: nextSpot ? { ...nextSpot } : null } : x.verification };
    });
  }

  function setMode(mode: "photo" | "gps") {
    setD((x) => ({ ...x, verification: { ...x.verification, mode, gps: mode === "gps" ? (x.verification.gps ?? (placeSpot ? { ...placeSpot } : null)) : x.verification.gps } }));
    if (mode === "gps" && !d.verification.gps && !placeSpot) setPickingSpot(true);
  }

  async function submit(confirmDistinct = false) {
    const definition: QuestDefinition = {
      ...d,
      title: d.title.trim(),
      org: (d.org ?? "").trim(),
      verification: { ...d.verification, criteria: d.verification.criteria.map((c) => c.trim()).filter(Boolean), gps: d.verification.mode === "gps" ? d.verification.gps : null },
    };
    // A spot picked for a building that has none yet becomes the building's spot too.
    if (definition.verification.mode === "gps" && definition.verification.gps && !placeSpot && alsoSavePlace) {
      await placeSave.execute({ type: "setPlace", area, location: definition.verification.gps });
    }
    const res = questId
      ? await save.execute({ type: "updateQuest", questId, definition })
      : await save.execute({ type: "createQuest", templateId, definition, confirmDistinct });
    if (res) {
      game.sound("tap");
      onSaved(res.questId);
    }
  }

  const err = save.error;
  const isSimilar = err?.code === "similar_quest";
  const canSave = !save.pending && !scheduleError && d.title.trim() && d.minimumAction.trim().length >= 3 && !(d.verification.mode === "gps" && !gps) && !(d.verification.mode === "photo" && !d.verification.criteria.some((c) => c.trim().length >= 3));

  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(similar);
      }}
    >
      <input
        className="field font-display text-2xl"
        aria-label="Task name"
        placeholder="Name it"
        value={d.title}
        maxLength={60}
        onChange={(e) => set("title", e.target.value)}
        required
      />

      <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Where it belongs">
        {CATEGORIES.map((c) => (
          <button
            type="button"
            role="radio"
            key={c}
            aria-checked={d.category === c}
            onClick={() => setCategory(c)}
            className={`flex flex-col items-center gap-1 rounded-2xl border-[1.5px] border-blood px-1 py-2.5 transition-[background-color,color,transform] duration-300 ease-spring active:scale-95 ${d.category === c ? "bg-blood text-white" : "bg-white"}`}
          >
            <Icon name={CATEGORY_ICON[c]} className="h-6 w-6" />
            <span className="text-sm font-extrabold">{CATEGORY_SHORT[c]}</span>
            <span className="text-[0.6875rem] font-bold opacity-80">{PLACE_LABEL[PLACE_OF[c]]}</span>
          </button>
        ))}
      </div>

      <div>
        <label className="label" htmlFor="q-min">Smallest version</label>
        <textarea id="q-min" className="field min-h-16" placeholder="So small you'd do it on your worst day" value={d.minimumAction} maxLength={200} onChange={(e) => set("minimumAction", e.target.value)} required />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="label">When</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {(
            [
              ["daily", "Every day"],
              ["weekdays", "Days"],
              ["weekly", "× / week"],
            ] as const
          ).map(([kind, label]) => (
            <button
              type="button"
              role="radio"
              aria-checked={d.schedule.kind === kind}
              key={kind}
              className={`btn min-h-11 px-2 text-sm ${d.schedule.kind === kind ? "btn-primary" : "btn-secondary"}`}
              onClick={() =>
                setSchedule(
                  kind === "daily"
                    ? { kind, window: d.schedule.window }
                    : kind === "weekdays"
                      ? { kind, days: d.schedule.kind === "weekdays" ? d.schedule.days : [1, 3, 5], window: d.schedule.window }
                      : { kind, timesPerWeek: d.schedule.kind === "weekly" ? d.schedule.timesPerWeek : 3, window: d.schedule.window },
                )
              }
            >
              {label}
            </button>
          ))}
        </div>
        {d.schedule.kind === "weekdays" && (
          <div className="flex justify-between gap-1" aria-label="Weekdays">
            {[1, 2, 3, 4, 5, 6, 7].map((day) => {
              const on = d.schedule.kind === "weekdays" && d.schedule.days.includes(day);
              return (
                <button
                  type="button"
                  key={day}
                  aria-pressed={on}
                  className={`h-11 w-11 rounded-full border border-blood text-sm font-extrabold transition-[background-color,color,transform] duration-300 ease-spring active:scale-90 ${on ? "bg-blood text-white" : "bg-white"}`}
                  onClick={() => {
                    if (d.schedule.kind !== "weekdays") return;
                    const days = on ? d.schedule.days.filter((x) => x !== day) : [...d.schedule.days, day].sort();
                    setSchedule({ ...d.schedule, days });
                  }}
                >
                  {WEEKDAY_LABELS[day].slice(0, 2)}
                </button>
              );
            })}
          </div>
        )}
        {d.schedule.kind === "weekly" && (
          <div className="flex items-center justify-center gap-4">
            <button type="button" className="btn btn-secondary h-11 w-11 px-0" aria-label="Fewer" onClick={() => d.schedule.kind === "weekly" && setSchedule({ ...d.schedule, timesPerWeek: Math.max(1, d.schedule.timesPerWeek - 1) })}>−</button>
            <span className="font-display text-2xl" aria-live="polite">{d.schedule.timesPerWeek}× / week</span>
            <button type="button" className="btn btn-secondary h-11 w-11 px-0" aria-label="More" onClick={() => d.schedule.kind === "weekly" && setSchedule({ ...d.schedule, timesPerWeek: Math.min(7, d.schedule.timesPerWeek + 1) })}>+</button>
          </div>
        )}
        <div className="grid grid-cols-[auto_1fr_1fr] items-center gap-2">
          <button
            type="button"
            aria-pressed={allDay}
            className="chip min-h-12 px-3 whitespace-nowrap"
            onClick={() => setSchedule({ ...d.schedule, window: allDay ? { start: "06:00", end: "22:00" } : { start: "00:00", end: "24:00" } })}
          >
            <Icon name="clock" className="h-4 w-4" /> Any time
          </button>
          {!allDay && (
            <>
              <input aria-label="Opens" type="time" className="field" value={d.schedule.window.start} onChange={(e) => setSchedule({ ...d.schedule, window: { ...d.schedule.window, start: e.target.value } })} />
              <input aria-label="Closes" type="time" className="field" value={d.schedule.window.end === "24:00" ? "23:59" : d.schedule.window.end} onChange={(e) => setSchedule({ ...d.schedule, window: { ...d.schedule.window, end: e.target.value } })} />
            </>
          )}
        </div>
        {scheduleError ? <p className="text-sm font-bold">{scheduleError}</p> : <p className="hint">{describeSchedule(d.schedule)}</p>}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="label">Proof</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {(["gps", "photo"] as const).map((m) => (
            <button
              type="button"
              role="radio"
              aria-checked={d.verification.mode === m}
              key={m}
              className={`btn ${d.verification.mode === m ? "btn-primary" : "btn-secondary"}`}
              onClick={() => setMode(m)}
            >
              <Icon name={m === "photo" ? "camera" : "pin"} /> {m === "photo" ? "Photo" : "Be there"}
            </button>
          ))}
        </div>
        {d.verification.mode === "photo" ? (
          <div className="flex flex-col gap-2">
            {d.verification.criteria.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="field"
                  aria-label={`Evidence criterion ${i + 1}`}
                  placeholder="The photo shows…"
                  value={c}
                  maxLength={160}
                  onChange={(e) => {
                    const criteria = [...d.verification.criteria];
                    criteria[i] = e.target.value;
                    set("verification", { ...d.verification, criteria });
                  }}
                />
                <button type="button" className="btn btn-ghost w-12 shrink-0 px-0" aria-label={`Remove criterion ${i + 1}`} onClick={() => set("verification", { ...d.verification, criteria: d.verification.criteria.filter((_, j) => j !== i) })}>
                  <Icon name="trash" />
                </button>
              </div>
            ))}
            {d.verification.criteria.length < 5 && (
              <button type="button" className="btn btn-ghost self-start px-1" onClick={() => set("verification", { ...d.verification, criteria: [...d.verification.criteria, ""] })}>
                <Icon name="plus" /> {d.verification.criteria.length ? "Another" : "What the photo shows"}
              </button>
            )}
          </div>
        ) : pickingSpot || !gps ? (
          <div className="m-rise flex flex-col gap-3">
            <LocationPicker
              value={gps}
              defaultLabel={PLACE_LABEL[area]}
              near={placeSpot ?? Object.values(v.profile.places).find(Boolean) ?? null}
              onChange={(next: PlaceLocation) => set("verification", { ...d.verification, gps: next })}
            />
            {!placeSpot && (
              <label className="flex min-h-11 items-center gap-3 font-bold">
                <input type="checkbox" className="h-5 w-5" checked={alsoSavePlace} onChange={(e) => setAlsoSavePlace(e.target.checked)} />
                This is my {PLACE_LABEL[area].toLowerCase()}
              </label>
            )}
            {gps && (
              <button type="button" className="btn btn-secondary" onClick={() => setPickingSpot(false)}>
                <Icon name="check" /> Use this spot
              </button>
            )}
          </div>
        ) : (
          <button type="button" className="flex min-h-12 items-center gap-2 rounded-xl border-[1.5px] border-blood px-3 text-left font-bold" onClick={() => setPickingSpot(true)}>
            <Icon name="pin" />
            <span className="min-w-0 flex-1 truncate">
              {gps.label}
              {isPlaceSpot ? ` · your ${PLACE_LABEL[area].toLowerCase()}` : ""}
            </span>
            <span className="text-sm">{gps.radiusM} m</span>
            <span className="chip">Change</span>
          </button>
        )}
      </fieldset>

      {showMoney ? (
        <fieldset className="flex flex-col gap-3">
          <legend className="label">For</legend>
          {v.money.orgs.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {v.money.orgs.map((o) => (
                <button type="button" key={o} className="chip min-h-10 px-3" aria-pressed={d.org === o} onClick={() => set("org", d.org === o ? "" : o)}>
                  {o}
                </button>
              ))}
            </div>
          )}
          <input className="field" placeholder="Korvo, your nonprofit…" aria-label="Organization" maxLength={40} value={d.org ?? ""} onChange={(e) => set("org", e.target.value)} />
          <label className="flex min-h-11 items-center gap-3 font-bold">
            <input type="checkbox" className="h-5 w-5" checked={Boolean(d.earns)} onChange={(e) => set("earns", e.target.checked)} />
            <Icon name="coin" /> Can bring in money
          </label>
        </fieldset>
      ) : (
        <button type="button" className="btn btn-ghost -mt-3 self-start px-1" onClick={() => setMoneyOpen(true)}>
          <Icon name="briefcase" /> For a business or nonprofit
        </button>
      )}

      <details className="group">
        <summary className="btn btn-ghost list-none px-1">
          <Icon name="chevron" className="h-5 w-5 transition-transform group-open:rotate-90" /> More
        </summary>
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <label className="label" htmlFor="q-cue">Cue</label>
            <input id="q-cue" className="field" value={d.cue} maxLength={160} onChange={(e) => set("cue", e.target.value)} placeholder="After my morning water" />
          </div>
          <div>
            <label className="label" htmlFor="q-why">Why</label>
            <input id="q-why" className="field" value={d.why} maxLength={240} onChange={(e) => set("why", e.target.value)} placeholder={d.purpose} />
          </div>
          <div>
            <label className="label" htmlFor="q-ext">Extra (optional)</label>
            <input id="q-ext" className="field" value={d.extension} maxLength={200} onChange={(e) => set("extension", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="q-review">Review every</label>
              <select id="q-review" className="field" value={d.reviewIntervalDays} onChange={(e) => set("reviewIntervalDays", Number(e.target.value))}>
                {[14, 21, 30, 60, 90].map((n) => (
                  <option key={n} value={n}>
                    {n} days
                  </option>
                ))}
              </select>
            </div>
            <div>
              <span className="label">XP</span>
              <div className="flex items-center gap-2">
                <button type="button" className="btn btn-secondary h-12 w-11 px-0" aria-label="Less XP" onClick={() => set("maxXp", Math.max(XP_RULES.minMaxXp, d.maxXp - 2))}>−</button>
                <span className="w-10 text-center font-display text-xl">{d.maxXp}</span>
                <button type="button" className="btn btn-secondary h-12 w-11 px-0" aria-label="More XP" onClick={() => set("maxXp", Math.min(XP_RULES.maxMaxXp, d.maxXp + 2))}>+</button>
              </div>
            </div>
          </div>
        </div>
      </details>

      {(err && !isSimilar) || placeSave.error ? <Note tone="error">{(err ?? placeSave.error)!.message}</Note> : null}
      {isSimilar && (
        <Note tone="warn">
          <p>{err.message}</p>
          <button type="button" className="btn btn-secondary mt-2 min-h-10" onClick={() => { setSimilar(true); void submit(true); }}>
            Different: add it
          </button>
        </Note>
      )}
      <div className="grid grid-cols-[auto_1fr] gap-3">
        <button type="button" className="btn btn-ghost" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-hero" disabled={!canSave}>
          <Icon name="check" /> {questId ? "Save" : "Add task"}
        </button>
      </div>
    </form>
  );
}
