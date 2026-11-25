"use client";

import { useState } from "react";
import { GPS_RULES, XP_RULES } from "@/lib/meros/config";
import { CATEGORY_INFO, type QuestCategory, type QuestTemplate } from "@/lib/meros/content/templates";
import { describeSchedule, type Schedule, validateSchedule, WEEKDAY_LABELS } from "@/lib/meros/domain/schedule";
import type { QuestDefinition } from "@/lib/meros/service/quest-definition";
import { useAction, useGame } from "./GameProvider";
import { Icon, Note } from "./ui";

export function definitionFromTemplate(t: QuestTemplate | null): QuestDefinition {
  return {
    title: t?.title ?? "",
    category: t?.category ?? "learning",
    purpose: t?.purpose ?? "",
    why: "",
    minimumAction: t?.minimumAction ?? "",
    cue: t?.cue ?? "",
    extension: t?.extension ?? "",
    schedule: t?.schedule ?? { kind: "daily", window: { start: "06:00", end: "22:00" } },
    verification: { mode: t?.verification.mode ?? "photo", criteria: [...(t?.verification.criteria ?? [])], gps: null },
    maxXp: t?.maxXp ?? XP_RULES.defaultMaxXp,
    reviewOn: null,
    reviewIntervalDays: t?.reviewIntervalDays ?? 30,
  };
}

type GpsState = { name: "idle" } | { name: "locating" } | { name: "error"; message: string };

/**
 * SMART-style quest setup. Asks, in order: the minimum visible action, the cue, the days and time
 * window, why it matters, how it's verified, the optional extension, and when to review the plan.
 * Edits create a new version that applies to future occurrences only.
 */
export default function QuestBuilder({
  initial,
  templateId,
  questId,
  locationHint,
  onSaved,
  onCancel,
}: {
  initial: QuestDefinition;
  templateId: string | null;
  questId?: string;
  locationHint?: string;
  onSaved: (questId: string) => void;
  onCancel: () => void;
}) {
  const game = useGame();
  const [d, setD] = useState<QuestDefinition>(initial);
  const [gps, setGps] = useState<GpsState>({ name: "idle" });
  const [fixAccuracy, setFixAccuracy] = useState<number | null>(null);
  const [similar, setSimilar] = useState(false);
  const save = useAction<{ questId: string }>();
  const set = <K extends keyof QuestDefinition>(key: K, value: QuestDefinition[K]) => setD((x) => ({ ...x, [key]: value }));
  const setSchedule = (s: Schedule) => set("schedule", s);
  const allDay = d.schedule.window.start === "00:00" && d.schedule.window.end === "24:00";
  const scheduleError = validateSchedule(d.schedule);

  function useCurrentLocation() {
    if (!("geolocation" in navigator)) {
      setGps({ name: "error", message: "This browser can't read your location." });
      return;
    }
    setGps({ name: "locating" });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setFixAccuracy(Math.round(pos.coords.accuracy));
        set("verification", {
          ...d.verification,
          gps: {
            lat: Math.round(pos.coords.latitude * 1e6) / 1e6,
            lng: Math.round(pos.coords.longitude * 1e6) / 1e6,
            radiusM: d.verification.gps?.radiusM ?? GPS_RULES.defaultRadiusM,
            label: d.verification.gps?.label || locationHint || "Saved spot",
          },
        });
        setGps({ name: "idle" });
      },
      (err) =>
        setGps({
          name: "error",
          message:
            err.code === err.PERMISSION_DENIED
              ? "Location permission is off. Allow it for this site (iPhone: Settings → Privacy & Security → Location Services → Safari Websites), then try again."
              : "Couldn't get a fix. Step outside or near a window and try again.",
        }),
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 0 },
    );
  }

  async function submit(confirmDistinct = false) {
    const definition = { ...d, title: d.title.trim(), verification: { ...d.verification, criteria: d.verification.criteria.map((c) => c.trim()).filter(Boolean) } };
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

  return (
    <form
      className="flex flex-col gap-5"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(similar);
      }}
    >
      <div>
        <label className="label" htmlFor="q-title">Quest name</label>
        <input id="q-title" className="field" value={d.title} maxLength={60} onChange={(e) => set("title", e.target.value)} required />
      </div>

      <div>
        <span className="label">Category</span>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(CATEGORY_INFO) as QuestCategory[]).map((c) => (
            <button
              type="button"
              key={c}
              aria-pressed={d.category === c}
              onClick={() => set("category", c)}
              className="chip min-h-10 px-3"
            >
              {CATEGORY_INFO[c].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="label" htmlFor="q-min">What is the minimum visible action?</label>
        <textarea id="q-min" className="field min-h-20" value={d.minimumAction} maxLength={200} onChange={(e) => set("minimumAction", e.target.value)} required />
        <p className="hint mt-1">Small enough to do on your worst day. Doing just this earns full attendance credit.</p>
      </div>

      <div>
        <label className="label" htmlFor="q-cue">When, or after what cue, will it happen?</label>
        <input id="q-cue" className="field" value={d.cue} maxLength={160} onChange={(e) => set("cue", e.target.value)} placeholder="After I pour my morning water" />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="label">Which days and time window is it due?</legend>
        <div role="radiogroup" className="grid grid-cols-3 gap-2">
          {(
            [
              ["daily", "Every day"],
              ["weekdays", "Set days"],
              ["weekly", "N per week"],
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
          <div className="flex flex-wrap gap-2" aria-label="Weekdays">
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
                  {WEEKDAY_LABELS[day]}
                </button>
              );
            })}
          </div>
        )}
        {d.schedule.kind === "weekly" && (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3">
              <button type="button" className="btn btn-secondary h-11 w-11 px-0" aria-label="Fewer" onClick={() => d.schedule.kind === "weekly" && setSchedule({ ...d.schedule, timesPerWeek: Math.max(1, d.schedule.timesPerWeek - 1) })}>−</button>
              <span className="font-display text-xl" aria-live="polite">{d.schedule.timesPerWeek}× per week</span>
              <button type="button" className="btn btn-secondary h-11 w-11 px-0" aria-label="More" onClick={() => d.schedule.kind === "weekly" && setSchedule({ ...d.schedule, timesPerWeek: Math.min(7, d.schedule.timesPerWeek + 1) })}>+</button>
            </div>
            <Note tone="info">
              N per week means {d.schedule.timesPerWeek} scoring slots on different days (Mon–Sun), at most one per day. Every completed day earns full rewards, even if the week falls short. A week below {d.schedule.timesPerWeek} counts as <strong>one</strong> miss, not one per empty day, and the miss count resets only when you hit the target.
            </Note>
          </div>
        )}
        <label className="flex min-h-11 items-center gap-3 font-bold">
          <input type="checkbox" className="h-5 w-5" checked={allDay} onChange={(e) => setSchedule({ ...d.schedule, window: e.target.checked ? { start: "00:00", end: "24:00" } : { start: "06:00", end: "22:00" } })} />
          Any time of day
        </label>
        {!allDay && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="q-start">Opens</label>
              <input id="q-start" type="time" className="field" value={d.schedule.window.start} onChange={(e) => setSchedule({ ...d.schedule, window: { ...d.schedule.window, start: e.target.value } })} />
            </div>
            <div>
              <label className="label" htmlFor="q-end">Closes</label>
              <input id="q-end" type="time" className="field" value={d.schedule.window.end === "24:00" ? "23:59" : d.schedule.window.end} onChange={(e) => setSchedule({ ...d.schedule, window: { ...d.schedule.window, end: e.target.value } })} />
            </div>
          </div>
        )}
        <p className="hint">{scheduleError ?? describeSchedule(d.schedule)}. A close time before the open time runs past midnight. Starts from now; no past days are created.</p>
      </fieldset>

      <div>
        <label className="label" htmlFor="q-why">Why does it matter?</label>
        <textarea id="q-why" className="field min-h-16" value={d.why} maxLength={240} onChange={(e) => set("why", e.target.value)} placeholder={d.purpose} />
      </div>

      <fieldset className="flex flex-col gap-3">
        <legend className="label">How will it be verified?</legend>
        <div role="radiogroup" className="grid grid-cols-2 gap-2">
          {(["photo", "gps"] as const).map((m) => (
            <button
              type="button"
              role="radio"
              aria-checked={d.verification.mode === m}
              key={m}
              className={`btn ${d.verification.mode === m ? "btn-primary" : "btn-secondary"}`}
              onClick={() => set("verification", { ...d.verification, mode: m })}
            >
              <Icon name={m === "photo" ? "camera" : "pin"} /> {m === "photo" ? "Fresh photo" : "Location"}
            </button>
          ))}
        </div>
        {d.verification.mode === "photo" ? (
          <div className="flex flex-col gap-2">
            <p className="hint">What must be visible in the photo? Describe the setup, not people or private content. For private practices, photograph the preparation.</p>
            {d.verification.criteria.map((c, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className="field"
                  aria-label={`Evidence criterion ${i + 1}`}
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
              <button type="button" className="btn btn-secondary self-start" onClick={() => set("verification", { ...d.verification, criteria: [...d.verification.criteria, ""] })}>
                <Icon name="plus" /> Add criterion
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {locationHint && <p className="hint">Suggested place: {locationHint}. Set it while you’re there.</p>}
            <button type="button" className="btn btn-secondary" onClick={useCurrentLocation} disabled={gps.name === "locating"}>
              <Icon name="pin" /> {gps.name === "locating" ? "Getting a precise fix…" : d.verification.gps ? "Reset to my current location" : "Set to my current location"}
            </button>
            {gps.name === "error" && <Note tone="error">{gps.message}</Note>}
            {d.verification.gps && (
              <div className="m-rise border-l-2 border-blood pl-3">
                <p className="text-sm font-bold">
                  Location saved{fixAccuracy !== null ? ` (fix accurate to ±${fixAccuracy} m)` : ""}. It stays private to your account.
                </p>
                {fixAccuracy !== null && fixAccuracy > 50 && <p className="hint">That fix is a bit fuzzy. Setting it again outdoors gives a more reliable center.</p>}
                <label className="label mt-2" htmlFor="q-gps-label">Place name</label>
                <input id="q-gps-label" className="field" value={d.verification.gps.label} maxLength={60} onChange={(e) => set("verification", { ...d.verification, gps: { ...d.verification.gps!, label: e.target.value } })} />
                <label className="label mt-2" htmlFor="q-radius">Area radius: {d.verification.gps.radiusM} m</label>
                <input
                  id="q-radius"
                  type="range"
                  min={GPS_RULES.minRadiusM}
                  max={GPS_RULES.maxRadiusM}
                  step={10}
                  value={d.verification.gps.radiusM}
                  className="w-full"
                  onChange={(e) => set("verification", { ...d.verification, gps: { ...d.verification.gps!, radiusM: Number(e.target.value) } })}
                />
                <p className="hint">A check-in counts only when your whole accuracy circle fits inside this area. Near the edge, you’ll be asked to retry.</p>
              </div>
            )}
          </div>
        )}
        <p className="hint">Evidence shows the action you defined. It can’t be perfectly cheat-proof, and it never verifies effort; it keeps you honest with yourself.</p>
      </fieldset>

      <div>
        <label className="label" htmlFor="q-ext">What optional extension would count as extra effort?</label>
        <input id="q-ext" className="field" value={d.extension} maxLength={200} onChange={(e) => set("extension", e.target.value)} />
        <p className="hint mt-1">Always optional. Declining it never costs anything.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="label" htmlFor="q-review">Review the plan every</label>
          <select id="q-review" className="field" value={d.reviewIntervalDays} onChange={(e) => set("reviewIntervalDays", Number(e.target.value))}>
            {[14, 21, 30, 60, 90].map((n) => (
              <option key={n} value={n}>
                {n} days
              </option>
            ))}
          </select>
        </div>
        <div>
          <span className="label">Max XP</span>
          <div className="flex items-center gap-2">
            <button type="button" className="btn btn-secondary h-12 w-11 px-0" aria-label="Less XP" onClick={() => set("maxXp", Math.max(XP_RULES.minMaxXp, d.maxXp - 2))}>−</button>
            <span className="w-10 text-center font-display text-xl">{d.maxXp}</span>
            <button type="button" className="btn btn-secondary h-12 w-11 px-0" aria-label="More XP" onClick={() => set("maxXp", Math.min(XP_RULES.maxMaxXp, d.maxXp + 2))}>+</button>
          </div>
        </div>
      </div>
      <p className="hint -mt-3">
        {d.maxXp / 2} XP for the verified minimum, up to {d.maxXp / 2} more for self-rated optional effort.
      </p>

      {err && !isSimilar && <Note tone="error">{err.message}</Note>}
      {isSimilar && (
        <Note tone="warn">
          <p>{err.message}</p>
          <button type="button" className="btn btn-secondary mt-2 min-h-10" onClick={() => { setSimilar(true); void submit(true); }}>
            It’s a different action: add it
          </button>
        </Note>
      )}
      <div className="grid grid-cols-2 gap-3">
        <button type="button" className="btn btn-secondary" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={save.pending || Boolean(scheduleError) || (d.verification.mode === "gps" && !d.verification.gps)}>
          {questId ? "Save for future days" : "Activate quest"}
        </button>
      </div>
      {questId && <p className="hint">Changes apply from now on. Days already scheduled keep the rules they started with.</p>}
    </form>
  );
}
