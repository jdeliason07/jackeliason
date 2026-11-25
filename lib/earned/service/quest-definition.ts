import { z } from "zod";
import { GPS_RULES, XP_RULES } from "../config";
import type { QuestCategory, VerificationMode } from "../content/templates";
import { isValidCoordinate } from "../domain/geofence";
import { type Schedule, validateSchedule } from "../domain/schedule";
import { isLocalDate } from "../domain/time";
import { isValidMaxXp } from "../domain/xp";

/** The editable definition of a quest. Each saved version is an immutable snapshot of this. */
export interface QuestDefinition {
  title: string;
  category: QuestCategory;
  purpose: string;
  why: string;
  minimumAction: string;
  cue: string;
  extension: string;
  schedule: Schedule;
  verification: {
    mode: VerificationMode;
    criteria: string[];
    gps: { lat: number; lng: number; radiusM: number; label: string } | null;
  };
  maxXp: number;
  reviewOn: string | null;
  reviewIntervalDays: number;
}

const wall = z.string().regex(/^\d{2}:\d{2}$/);
const window = z.object({ start: wall, end: wall });
const text = (max: number, min = 0) => z.string().trim().min(min).max(max);

export const scheduleSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("daily"), window }),
  z.object({ kind: z.literal("weekdays"), days: z.array(z.number().int().min(1).max(7)).min(1).max(7), window }),
  z.object({ kind: z.literal("weekly"), timesPerWeek: z.number().int().min(1).max(7), window }),
]);

export const questDefinitionSchema = z
  .object({
    title: text(60, 1),
    category: z.enum(["fitness", "learning", "business", "faith", "relationships", "household"]),
    purpose: text(240),
    why: text(240),
    minimumAction: text(200, 3),
    cue: text(160),
    extension: text(200),
    schedule: scheduleSchema,
    verification: z.object({
      mode: z.enum(["photo", "gps"]),
      criteria: z.array(text(160, 3)).max(5),
      gps: z
        .object({
          lat: z.number(),
          lng: z.number(),
          radiusM: z.number().int().min(GPS_RULES.minRadiusM).max(GPS_RULES.maxRadiusM),
          label: text(60),
        })
        .nullable(),
    }),
    maxXp: z.number().int(),
    reviewOn: z.string().nullable(),
    reviewIntervalDays: z.number().int().min(7).max(365),
  })
  .superRefine((d, ctx) => {
    const scheduleError = validateSchedule(d.schedule as Schedule);
    if (scheduleError) ctx.addIssue({ code: "custom", path: ["schedule"], message: scheduleError });
    if (!isValidMaxXp(d.maxXp)) {
      ctx.addIssue({
        code: "custom",
        path: ["maxXp"],
        message: `Max XP must be an even number from ${XP_RULES.minMaxXp} to ${XP_RULES.maxMaxXp}.`,
      });
    }
    if (d.verification.mode === "photo" && d.verification.criteria.length === 0) {
      ctx.addIssue({ code: "custom", path: ["verification", "criteria"], message: "Describe at least one thing the photo must show." });
    }
    if (d.verification.mode === "gps") {
      const g = d.verification.gps;
      if (!g || !isValidCoordinate(g.lat, g.lng)) {
        ctx.addIssue({ code: "custom", path: ["verification", "gps"], message: "Set the location with “Use my current location”." });
      }
    }
    if (d.reviewOn !== null && !isLocalDate(d.reviewOn)) {
      ctx.addIssue({ code: "custom", path: ["reviewOn"], message: "Use a YYYY-MM-DD review date." });
    }
  });

export function parseDefinition(input: unknown): QuestDefinition {
  const def = questDefinitionSchema.parse(input) as QuestDefinition;
  if (def.verification.mode === "photo") def.verification.gps = null;
  return def;
}

/** Frozen per-occurrence copy: what the evidence must show and how XP works for this occurrence. */
export interface OccurrenceSnapshot {
  title: string;
  category: QuestCategory;
  minimumAction: string;
  extension: string;
  verification: QuestDefinition["verification"];
  maxXp: number;
  scheduleKind: Schedule["kind"];
  versionNo: number;
}

export function snapshotOf(def: QuestDefinition, versionNo: number): OccurrenceSnapshot {
  return {
    title: def.title,
    category: def.category,
    minimumAction: def.minimumAction,
    extension: def.extension,
    verification: structuredClone(def.verification),
    maxXp: def.maxXp,
    scheduleKind: def.schedule.kind,
    versionNo,
  };
}

export function sameSchedule(a: Schedule, b: Schedule): boolean {
  const norm = (s: Schedule) =>
    JSON.stringify({ ...s, ...(s.kind === "weekdays" ? { days: [...s.days].sort() } : {}) });
  return norm(a) === norm(b);
}
