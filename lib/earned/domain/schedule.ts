import { TIMING_RULES } from "../config";
import {
  addDays,
  compareDates,
  isWallTime,
  localDateOf,
  type LocalDate,
  wallMinutes,
  type WallTime,
  weekdayOf,
  weekStartOf,
  zonedTimeToUtc,
} from "./time";

/**
 * Schedules. Three kinds:
 * - daily: due every day.
 * - weekdays: due on named ISO weekdays (Mon = 1 … Sun = 7).
 * - weekly: N distinct scoring slots per Monday-start week (1–7), at most one per local day. A week
 *   that ends below N advances the miss counter ONCE (not once per empty slot). Partial weeks still
 *   earn normal rewards for each completed slot; the miss counter resets only when the target is met.
 *
 * Every schedule has a daily time window. An end at or before the start crosses midnight; "00:00"–
 * "24:00" is the whole day. Windows are at most 24 hours, so a quest's windows never overlap.
 */

export interface TimeWindow {
  start: WallTime;
  end: WallTime;
}

export type Schedule =
  | { kind: "daily"; window: TimeWindow }
  | { kind: "weekdays"; days: number[]; window: TimeWindow }
  | { kind: "weekly"; timesPerWeek: number; window: TimeWindow };

export const WEEKDAY_LABELS = ["", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

export function validateSchedule(schedule: Schedule): string | null {
  const w = schedule.window;
  if (!w || !isWallTime(w.start) || !isWallTime(w.end, true)) return "Use HH:MM times for the window.";
  if (w.start === w.end) return "The window needs a start and a different end. Use 00:00–24:00 for all day.";
  if (wallMinutes(w.start) >= 24 * 60) return "The window must start before midnight.";
  if (schedule.kind === "weekdays") {
    const days = schedule.days;
    if (!Array.isArray(days) || days.length === 0) return "Pick at least one weekday.";
    if (days.some((d) => !Number.isInteger(d) || d < 1 || d > 7)) return "Weekdays are 1 (Mon) to 7 (Sun).";
    if (new Set(days).size !== days.length) return "Each weekday only once.";
  }
  if (schedule.kind === "weekly") {
    const n = schedule.timesPerWeek;
    if (!Number.isInteger(n) || n < 1 || n > 7) return "Times per week must be 1–7.";
  }
  return null;
}

/** Window length in minutes (crossing midnight when end ≤ start). */
export function windowMinutes(w: TimeWindow): number {
  const s = wallMinutes(w.start);
  const e = w.end === "24:00" ? 24 * 60 : wallMinutes(w.end);
  return e > s ? e - s : 24 * 60 - s + e;
}

export function windowFor(localDate: LocalDate, w: TimeWindow, timeZone: string): { opensAt: Date; closesAt: Date } {
  const opensAt = zonedTimeToUtc(localDate, w.start, timeZone);
  const s = wallMinutes(w.start);
  const crosses = w.end !== "24:00" && wallMinutes(w.end) <= s;
  const closesAt = zonedTimeToUtc(crosses ? addDays(localDate, 1) : localDate, w.end, timeZone);
  return { opensAt, closesAt };
}

/** Is a scoring opportunity offered on this local date? (Weekly: every day can hold a slot.) */
export function isOfferedOn(schedule: Schedule, localDate: LocalDate): boolean {
  if (schedule.kind === "weekdays") return schedule.days.includes(weekdayOf(localDate));
  return true;
}

/** For daily and weekday schedules, a missed offered date is a scheduled miss. Weekly: never per day. */
export function isScheduledDue(schedule: Schedule): boolean {
  return schedule.kind !== "weekly";
}

export function describeSchedule(schedule: Schedule): string {
  const window = schedule.window.start === "00:00" && schedule.window.end === "24:00"
    ? "any time"
    : `${schedule.window.start}–${schedule.window.end}`;
  switch (schedule.kind) {
    case "daily":
      return `Every day, ${window}`;
    case "weekdays":
      return `${[...schedule.days].sort().map((d) => WEEKDAY_LABELS[d]).join(", ")}, ${window}`;
    case "weekly":
      return `${schedule.timesPerWeek}× per week (one per day), ${window}`;
  }
}

/**
 * Whether an occurrence window should exist given when the quest became active (activation or
 * resume). Not retroactive: windows that closed before activation are never created, and a window
 * is only created if enough of it remains to act on.
 */
export function windowStartsAfterActivation(closesAt: Date, activeFrom: Date): boolean {
  return closesAt.getTime() - activeFrom.getTime() >= TIMING_RULES.minimumRemainingWindowMinutes * 60_000;
}

/** Scheduled weekly opportunities per week, for weekly-target estimates. */
export function expectedCompletionsPerWeek(schedule: Schedule): number {
  switch (schedule.kind) {
    case "daily":
      return 7;
    case "weekdays":
      return schedule.days.length;
    case "weekly":
      return schedule.timesPerWeek;
  }
}

export interface WeekBounds {
  weekStart: LocalDate;
  opensAt: Date;
  closesAt: Date;
}

/** A weekly-target week runs Monday 00:00 to the later of next Monday 00:00 and Sunday's window close. */
export function weekBounds(localDate: LocalDate, w: TimeWindow, timeZone: string): WeekBounds {
  const weekStart = weekStartOf(localDate);
  const opensAt = zonedTimeToUtc(weekStart, "00:00", timeZone);
  const nextMonday = zonedTimeToUtc(addDays(weekStart, 7), "00:00", timeZone);
  const sunday = windowFor(addDays(weekStart, 6), w, timeZone).closesAt;
  return { weekStart, opensAt, closesAt: sunday > nextMonday ? sunday : nextMonday };
}

/**
 * The first week's target when a weekly quest is activated mid-week: no more than the number of
 * days still able to hold a slot, so activation never creates a guaranteed miss.
 */
export function prorateWeeklyTarget(
  timesPerWeek: number,
  weekStart: LocalDate,
  activeFrom: Date,
  w: TimeWindow,
  timeZone: string,
): number {
  let available = 0;
  for (let i = 0; i < 7; i++) {
    const { closesAt } = windowFor(addDays(weekStart, i), w, timeZone);
    if (windowStartsAfterActivation(closesAt, activeFrom)) available++;
  }
  return Math.min(timesPerWeek, available);
}

/** Local dates from `from` to `to` inclusive. */
export function datesBetween(from: LocalDate, to: LocalDate): LocalDate[] {
  const out: LocalDate[] = [];
  for (let d = from; compareDates(d, to) <= 0; d = addDays(d, 1)) out.push(d);
  return out;
}

/**
 * The local date whose window is open at `now`, or the most recent date whose window has opened.
 * Windows can cross midnight, so at 00:30 a 22:00–01:00 window belongs to yesterday's date.
 */
export function currentOccurrenceDate(now: Date, w: TimeWindow, timeZone: string): LocalDate {
  const today = localDateOf(now, timeZone);
  const yesterday = addDays(today, -1);
  const y = windowFor(yesterday, w, timeZone);
  if (now >= y.opensAt && now < y.closesAt) return yesterday;
  return today;
}
