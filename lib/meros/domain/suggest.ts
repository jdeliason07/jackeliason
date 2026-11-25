import { XP_RULES } from "../config";
import { PLACE_OF, type Places } from "../content/places";
import { CATEGORY_INFO, QUEST_TEMPLATES, type QuestCategory, type QuestTemplate } from "../content/templates";
import type { QuestDefinition } from "../service/quest-definition";
import type { Schedule, TimeWindow } from "./schedule";
import { similarity } from "./similarity";

/**
 * Learns from what actually gets done. Each task's last 28 days give a completion rate; tasks you
 * keep doing say what works for you (time of day, how you prove it, which part of life), and tasks
 * you skip say what doesn't. Suggestions are mostly "more like what works", plus one deliberate
 * experiment: a kind of task you haven't tried, so the picture keeps widening.
 */

export interface HabitRecord {
  title: string;
  minimumAction: string;
  category: QuestCategory;
  mode: "photo" | "gps";
  window: TimeWindow;
  scheduleKind: Schedule["kind"];
  status: "active" | "paused" | "archived";
  templateId: string | null;
  org: string;
  done: number;
  due: number;
}

export interface Suggestion {
  kind: "similar" | "experiment";
  /** Short and visual: "Like Open the textbook · 9/10". */
  reason: string;
  basedOn: string | null;
  definition: QuestDefinition;
}

/** Completion rate with a gentle prior, so 1/1 doesn't outrank 18/20. */
export function rate(h: Pick<HabitRecord, "done" | "due">): number {
  return (h.done + 1) / (h.due + 2);
}

export type TimeBucket = "morning" | "midday" | "evening" | "anytime";

export function bucketOf(w: TimeWindow): TimeBucket {
  if (w.start === "00:00" && w.end === "24:00") return "anytime";
  const h = Number(w.start.slice(0, 2));
  return h < 11 ? "morning" : h < 16 ? "midday" : "evening";
}

const BUCKET_WINDOW: Record<TimeBucket, TimeWindow> = {
  morning: { start: "05:30", end: "11:00" },
  midday: { start: "11:00", end: "16:00" },
  evening: { start: "16:00", end: "23:00" },
  anytime: { start: "00:00", end: "24:00" },
};

export interface Traits {
  winners: HabitRecord[];
  strugglers: HabitRecord[];
  bucket: TimeBucket;
  mode: "photo" | "gps";
  categories: QuestCategory[];
}

/** What your follow-through says about you. */
export function traitsOf(habits: HabitRecord[]): Traits {
  const scored = habits.filter((h) => h.due >= 3);
  const winners = scored.filter((h) => rate(h) >= 0.65).sort((a, b) => rate(b) - rate(a));
  const strugglers = scored.filter((h) => rate(h) < 0.4).sort((a, b) => rate(a) - rate(b));
  const pool = winners.length ? winners : habits.filter((h) => h.status === "active");
  const tally = <K extends string>(get: (h: HabitRecord) => K, fallback: K): K => {
    const counts = new Map<K, number>();
    for (const h of pool) counts.set(get(h), (counts.get(get(h)) ?? 0) + (h.done || 1));
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? fallback;
  };
  const categories = [...new Set(pool.map((h) => h.category))];
  return { winners, strugglers, bucket: tally((h) => bucketOf(h.window), "anytime"), mode: tally((h) => h.mode, "photo"), categories };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** A template, moved to the time of day that works for you. Its proof stays what makes sense for it. */
function fromTemplate(t: QuestTemplate, window: TimeWindow, places: Places): QuestDefinition {
  const spot = places[PLACE_OF[t.category]] ?? null;
  const gps = t.verification.mode === "gps";
  return {
    title: t.title,
    category: t.category,
    purpose: t.purpose,
    why: "",
    minimumAction: t.minimumAction,
    cue: t.cue,
    extension: t.extension,
    schedule: { ...t.schedule, window } as Schedule,
    verification: { mode: t.verification.mode, criteria: gps ? [] : [...t.verification.criteria], gps: gps && spot ? { ...spot } : null },
    maxXp: t.maxXp ?? XP_RULES.defaultMaxXp,
    reviewOn: null,
    reviewIntervalDays: t.reviewIntervalDays,
    org: "",
    earns: false,
  };
}

/**
 * Two "more like what works" and one experiment, from the built-in templates. Deterministic for a
 * given day (the experiment rotates daily), so the list doesn't reshuffle on every visit.
 */
export function heuristicSuggestions(habits: HabitRecord[], places: Places, today: string, onlyCategories?: QuestCategory[] | null): Suggestion[] {
  const traits = traitsOf(habits);
  const live = habits.filter((h) => h.status !== "archived");
  const usedTemplates = new Set(live.map((h) => h.templateId).filter(Boolean));
  const fresh = (t: QuestTemplate) => !usedTemplates.has(t.id) && !live.some((h) => similarity(h, t) >= 0.5);
  const allowed = (c: QuestCategory) => !onlyCategories || onlyCategories.includes(c);
  const out: Suggestion[] = [];
  const taken = new Set<string>();

  // More like what works: same part of life, same time of day, same way of proving it.
  const anchors = traits.winners.length ? traits.winners : live.filter((h) => h.status === "active");
  for (const w of anchors) {
    if (out.length >= 2) break;
    if (!allowed(w.category)) continue;
    const t = QUEST_TEMPLATES.filter((x) => x.category === w.category && fresh(x) && !taken.has(x.id)).sort((a, b) => hash(a.id + today) - hash(b.id + today))[0];
    if (!t) continue;
    taken.add(t.id);
    const window = bucketOf(w.window) === "anytime" ? t.schedule.window : w.window;
    out.push({
      kind: "similar",
      reason: w.due ? `Like ${w.title} · ${w.done}/${w.due}` : `Like ${w.title}`,
      basedOn: w.title,
      definition: fromTemplate(t, window, places),
    });
  }

  // Fill from your usual time and proof if there weren't enough anchors (a brand-new account).
  if (out.length < 2) {
    const pool = QUEST_TEMPLATES.filter((t) => fresh(t) && !taken.has(t.id) && allowed(t.category)).sort((a, b) => hash(a.id + today) - hash(b.id + today));
    for (const t of pool.slice(0, 2 - out.length)) {
      taken.add(t.id);
      out.push({ kind: "similar", reason: "Small and easy to start", basedOn: null, definition: fromTemplate(t, t.schedule.window, places) });
    }
  }

  // One experiment: a part of life you aren't working on, at a time you don't usually use.
  const usedCats = new Set(live.map((h) => h.category));
  const otherCats = (Object.keys(CATEGORY_INFO) as QuestCategory[]).filter((c) => allowed(c));
  const newCats = otherCats.filter((c) => !usedCats.has(c));
  const cats = newCats.length ? newCats : otherCats;
  const cat = cats[hash(today + "cat") % cats.length];
  const options = QUEST_TEMPLATES.filter((t) => t.category === cat && fresh(t) && !taken.has(t.id));
  const pick = options[hash(today + "pick") % Math.max(1, options.length)];
  if (pick) {
    const buckets = (["morning", "midday", "evening"] as TimeBucket[]).filter((b) => b !== traits.bucket);
    const bucket = buckets[hash(today + "time") % buckets.length];
    const window = pick.schedule.window.start === "00:00" && pick.schedule.window.end === "24:00" ? pick.schedule.window : BUCKET_WINDOW[bucket];
    out.push({
      kind: "experiment",
      reason: usedCats.has(cat) ? `New time: ${bucket}` : `New: ${CATEGORY_INFO[cat].label}`,
      basedOn: null,
      definition: fromTemplate(pick, window, places),
    });
  }
  return out.slice(0, 3);
}

/** The view's tasks, as the records suggestions learn from. */
export function habitsOf(
  quests: {
    status: "active" | "paused" | "archived";
    templateId: string | null;
    definition: QuestDefinition;
    recent: { done: number; due: number };
  }[],
): HabitRecord[] {
  return quests.map((q) => ({
    title: q.definition.title,
    minimumAction: q.definition.minimumAction,
    category: q.definition.category,
    mode: q.definition.verification.mode,
    window: q.definition.schedule.window,
    scheduleKind: q.definition.schedule.kind,
    status: q.status,
    templateId: q.templateId,
    org: q.definition.org ?? "",
    done: q.recent?.done ?? 0,
    due: q.recent?.due ?? 0,
  }));
}
